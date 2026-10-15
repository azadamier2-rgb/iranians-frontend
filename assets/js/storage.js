/* ============================================================
   HomeShop — assets/js/storage.js
   لایه‌ی ذخیره‌سازی سمت مرورگر + ارتباط خام با API.

   ⚠️ نکته امنیتی مهم: توکن دسترسی (access token) دیگر اصلاً در این
   فایل یا در storage مرورگر نگه‌داری نمی‌شود. بک‌اند آن را در یک کوکی
   httpOnly تنظیم می‌کند که جاوااسکریپت اصلاً نمی‌تواند بخواندش —
   بنابراین حتی اگر یک حمله‌ی XSS در سایت رخ دهد، کد مخرب نمی‌تواند
   توکن ورود را بدزدد. مرورگر خودش این کوکی را با هر درخواست
   (به‌لطف credentials:'include') می‌فرستد؛ ما فقط اطلاعات نمایشیِ
   کاربر (نام/ایمیل/نقش — نه هیچ رمز/توکنی) را برای UI نگه می‌داریم.

   ⚠️ نکته درباره localStorage:
   چون این سایت چندصفحه‌ای است، سبد خرید باید در localStorage بماند
   تا با رفتن به صفحه‌ی بعدی از بین نرود.

   این فایل باید در <head> یا انتهای <body> هر صفحه، پیش از
   products.js و فایل مخصوص همان صفحه لود شود.
   ============================================================ */

const API_ORIGIN = (() => {
  // Priority 1: explicit config in assets/js/config.js (used for online testing)
  if (window.IRANIANS_CONFIG && window.IRANIANS_CONFIG.API_ORIGIN) {
    const configured = window.IRANIANS_CONFIG.API_ORIGIN.trim();
    // Ignore the placeholder value so local dev still works before deploy.
    if (configured && configured.indexOf('CHANGE_ME') === -1) {
      return configured.replace(/\/+$/, '');
    }
  }

  // Priority 2: same-origin proxy (local-gateway.js, nginx, or production).
  if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
    const host = window.location.hostname;
    const port = window.location.port;
    // Local Windows installer serves the frontend on 5500 and backend on 4000.
    if ((host === 'localhost' || host === '127.0.0.1') && port === '5500') {
      return 'http://localhost:4000';
    }
    return window.location.origin;
  }

  // Priority 3: opened directly as a file, no web server.
  return 'http://localhost:4000';
})();
const API_BASE = `${API_ORIGIN}/api`;

const CART_KEY = 'homeshop_cart_v1';

/* ---------- سبد خرید (localStorage) ---------- */
const CartStorage = {
  load() {
    try {
      const raw = localStorage.getItem(CART_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(l => l && typeof l.productId === 'string' && Number.isFinite(l.qty) && l.qty > 0);
    } catch {
      return [];
    }
  },
  save(items) {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(items));
    } catch {
      // localStorage ممکن است پر یا غیرفعال باشد (حالت خصوصی مرورگر) — بی‌صدا رد می‌شویم
    }
  },
  clear() {
    try { localStorage.removeItem(CART_KEY); } catch { /* noop */ }
  },
};

/* ---------- اطلاعات نمایشیِ کاربر (فقط برای UI، هیچ رمز/توکنی اینجا نیست) ---------- */
const SESSION_USER_KEY = 'homeshop_user_display';

const SessionStorage = {
  _memoryFallback: null,
  getUser() {
    try {
      const raw = sessionStorage.getItem(SESSION_USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return this._memoryFallback;
    }
  },
  setUser(user) {
    try { sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(user)); }
    catch { this._memoryFallback = user; }
  },
  clear() {
    try { sessionStorage.removeItem(SESSION_USER_KEY); } catch { /* noop */ }
    this._memoryFallback = null;
  },
};

function getCurrentUser() { return SessionStorage.getUser(); }
function setSession(user) { SessionStorage.setUser(user); }
function clearSession() { SessionStorage.clear(); }

/* ---------- درخواست خام به API ---------- */
async function apiFetch(path, options = {}, _isRetry = false) {
  const headers = { ...(options.headers || {}) };
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  // دیگر نیازی به هدر Authorization نیست — access token در کوکی httpOnly
  // است و مرورگر خودش آن را با credentials:'include' می‌فرستد.

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers, credentials: 'include' });
  } catch {
    throw new Error('اتصال به سرور برقرار نشد. مطمئن شوید بک‌اند در حال اجراست.');
  }

  // Login is a credential-checking endpoint. A 401 from /auth/login must
  // be returned directly; attempting refresh here can hide the real login
  // error and can also make the browser retry a failed login unnecessarily.
  // Only authenticated API requests may use the refresh-on-401 flow.
  const isLoginRequest = path === '/auth/login';
  if (res.status === 401 && !_isRetry && !isLoginRequest) {
    const refreshed = await silentRefresh();
    if (refreshed) return apiFetch(path, options, true);
  }

  let data = null;
  const text = await res.text();
  if (text) { try { data = JSON.parse(text); } catch { data = null; } }

  if (!res.ok) {
    const err = new Error((data && data.error) || `خطای سرور (کد ${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

/* ---------- جلوگیری از رقابت هم‌زمان (race condition) ----------
   بعضی صفحات (مثل admin.html) هم main.js و هم یک فایل مخصوص صفحه
   دارند که هر دو مستقل از هم restoreSession() را صدا می‌زنند. اگر این
   دو تقریباً هم‌زمان اجرا شوند، دو درخواست رفرش جداگانه با یک refresh
   token قدیمیِ یکسان به سرور می‌رود؛ چون /auth/refresh هر بار توکن را
   rotate می‌کند، ممکن است کوکیِ نهاییِ مرورگر با هشِ ذخیره‌شده در
   دیتابیس ناهم‌خوان شود. راه‌حل: تمام فراخوانی‌های هم‌زمان در یک
   Promise مشترک ادغام می‌شوند تا فقط یک درخواست واقعی برود. */
let pendingRefreshPromise = null;
let pendingRestorePromise = null;

async function silentRefresh() {
  if (pendingRefreshPromise) return pendingRefreshPromise;
  pendingRefreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, { method: 'POST', credentials: 'include' });
      return res.ok; // موفقیت یعنی سرور کوکی access token جدید را ست کرده — دیگر بدنه‌ی پاسخ چیزی برای خواندن ندارد
    } catch {
      return false;
    } finally {
      pendingRefreshPromise = null;
    }
  })();
  return pendingRefreshPromise;
}

/** در ابتدای هر صفحه صدا زده می‌شود تا در صورت وجود کوکی رفرش معتبر، نشست بازیابی شود. */
async function restoreSession() {
  if (pendingRestorePromise) return pendingRestorePromise;
  pendingRestorePromise = (async () => {
    const ok = await silentRefresh();
    if (!ok) { clearSession(); return null; }
    try {
      const { user } = await apiFetch('/auth/me');
      SessionStorage.setUser(user);
      return user;
    } catch {
      clearSession();
      return null;
    } finally {
      pendingRestorePromise = null;
    }
  })();
  return pendingRestorePromise;
}

/** هر مسیر عکسی که از بک‌اند می‌آید (مثل "/uploads/xxx.jpg") را به آدرس کامل تبدیل می‌کند. */
function imgUrl(relativePath) {
  if (!relativePath) return '';
  return `${API_ORIGIN}${relativePath}`;
}

const StoreFeaturesAPI = {
  async invoice(orderId){ return apiFetch(`/store/invoices/${encodeURIComponent(orderId)}`); },
  async restockAlert(productId,email){ return apiFetch(`/store/products/${encodeURIComponent(productId)}/restock-alert`,{method:'POST',body:JSON.stringify({email})}); },
  async myRestockAlerts(){ return apiFetch('/store/restock-alerts/mine'); },
  async createTicket(payload){ return apiFetch('/store/support/tickets',{method:'POST',body:JSON.stringify(payload)}); },
  async myTickets(){ return apiFetch('/store/support/tickets/mine'); },
  async adminTickets(){ return apiFetch('/store/admin/support/tickets'); },
  async adminLowStock(){ return apiFetch('/store/admin/low-stock'); },
  async updateTicket(id,payload){ return apiFetch(`/store/admin/support/tickets/${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify(payload)}); },
  async notifications(){ return apiFetch('/store/notifications'); },
  async markNotificationRead(id){ return apiFetch(`/store/notifications/${encodeURIComponent(id)}/read`,{method:'PATCH'}); },
  async markAllNotificationsRead(){ return apiFetch('/store/notifications/read-all',{method:'POST'}); },
  async relatedProducts(id){ return apiFetch(`/products/${encodeURIComponent(id)}/related`); },
};

