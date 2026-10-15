
/* ── XSS Guard (مورد ۱۱) ────────────────────────────────
   هر داده از سرور/کاربر قبل از innerHTML باید از h() رد شود
   مثال:  el.innerHTML = h(user.name)  ✅
          el.innerHTML = user.name      ❌
   ─────────────────────────────────────────────────────── */
function h(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

// expose برای استفاده در تمام صفحات
window.h = h;

/**
 * ui.js — کامپوننت‌های مشترک UI
 * navbar + footer را خودکار inject می‌کند
 */

const API = (typeof API_BASE === 'string' ? API_BASE : ((window.location.protocol === 'http:' || window.location.protocol === 'https:') ? ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && window.location.port === '5500' ? 'http://localhost:4000/api' : `${window.location.origin}/api`) : 'http://localhost:4000/api'));

/* ── NAVBAR ──────────────────────────────────────────── */
function renderNav() {
  const page = document.body.dataset.page || '';
  const links = [
    { href:'index.html',            key:'home',     label:'خانه' },
    { href:'index.html#catalog',    key:'products', label:'فروشگاه' },
    { href:'about.html',            key:'about',    label:'درباره ما' },
    { href:'contact.html',          key:'contact',  label:'تماس' },
    { href:'shipment-tracking.html',key:'track',    label:'رهگیری سفارش' },
  ];

  const nav = document.createElement('nav');
  nav.className = 'ds-nav';
  nav.innerHTML = `
    <a href="index.html" class="ds-nav-brand">خانه‌برق</a>
    <ul class="ds-nav-links" id="dsNavLinks">
      ${links.map(l => `
        <li><a href="${l.href}" class="${page===l.key?'active':''}">${l.label}</a></li>
      `).join('')}
    </ul>
    <div class="ds-nav-actions">
      <a href="login.html" class="ds-nav-login" id="dsNavLogin">ورود</a>
      <a href="cart.html" class="ds-nav-cart">
        <span>🛒</span> سبد خرید
        <span class="ds-nav-count" id="dsNavCount">0</span>
      </a>
      <button class="ds-nav-burger" id="dsNavBurger" aria-label="منو">
        <span></span><span></span><span></span>
      </button>
    </div>`;

  document.body.prepend(nav);

  // Burger
  document.getElementById('dsNavBurger').onclick = () =>
    document.getElementById('dsNavLinks').classList.toggle('open');

  // Cart count
  const cart = (typeof CartStorage !== 'undefined' ? CartStorage.load() : []);
  const count = cart.reduce((s, i) => s + (i.qty || 1), 0);
  document.getElementById('dsNavCount').textContent = count;
  if (!count) document.getElementById('dsNavCount').style.display = 'none';

  // Auth state
  const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  if (user) {
    const loginEl = document.getElementById('dsNavLogin');
    loginEl.textContent = user.name?.split(' ')[0] || 'حساب';
    loginEl.href = user.role === 'ADMIN' ? 'admin.html' : '#';
  }

  // Scroll effect
  window.addEventListener('scroll', () => {
    nav.style.background = window.scrollY > 40
      ? 'rgba(8,10,20,0.95)' : 'rgba(8,10,20,0.8)';
  }, { passive:true });
}

/* ── FOOTER ──────────────────────────────────────────── */
function renderFooter() {
  const footer = document.createElement('footer');
  footer.className = 'ds-footer';
  footer.innerHTML = `
    <div class="ds-footer-top">
      <div>
        <div class="ds-footer-brand">خانه‌برق</div>
        <p class="ds-footer-desc">فروشگاه لوازم خانگی اصیل با گارانتی شرکتی و ارسال سریع به سراسر ایران.</p>
      </div>
      <div>
        <div class="ds-footer-col-title">لینک‌های سریع</div>
        <ul class="ds-footer-links">
          <li><a href="index.html">صفحه اصلی</a></li>
          <li><a href="about.html">درباره ما</a></li>
          <li><a href="contact.html">تماس</a></li>
          <li><a href="shipment-tracking.html">رهگیری سفارش</a></li>
        </ul>
      </div>
      <div>
        <div class="ds-footer-col-title">خدمات مشتریان</div>
        <ul class="ds-footer-links">
          <li><a href="#">سوالات متداول</a></li>
          <li><a href="#">شرایط بازگشت</a></li>
          <li><a href="#">گارانتی محصولات</a></li>
          <li><a href="#">راهنمای خرید</a></li>
        </ul>
      </div>
      <div>
        <div class="ds-footer-col-title">تماس با ما</div>
        <ul class="ds-footer-links">
          <li><a href="tel:02100000000">۰۲۱-۰۰۰۰-۰۰۰۰</a></li>
          <li><a href="mailto:info@khanebargh.ir">info@khanebargh.ir</a></li>
          <li><a href="#">شنبه تا پنجشنبه ۹–۱۸</a></li>
        </ul>
      </div>
    </div>
    <div class="ds-footer-bottom">
      <span>© ۱۴۰۳ خانه‌برق — تمام حقوق محفوظ است</span>
      <span>طراحی و توسعه با ❤️</span>
    </div>`;

  document.body.appendChild(footer);
}

/* ── UTILS ───────────────────────────────────────────── */
function showAlert(el, type, msg) {
  if (!el) return;
  el.className = `ds-alert ds-alert-${type} show`;
  el.textContent = msg;
  el.style.display = 'block';
}

function hideAlert(el) {
  if (!el) return;
  el.className = 'ds-alert';
  el.style.display = 'none';
}

function setLoading(btn, loading) {
  if (!btn) return;
  if (loading) {
    btn._text = btn.innerHTML;
    btn.innerHTML = '<span class="ds-spinner"></span>';
    btn.disabled = true;
  } else {
    btn.innerHTML = btn._text || 'ارسال';
    btn.disabled = false;
  }
}

function updateCartBadge() {
  const cart  = (typeof CartStorage !== 'undefined' ? CartStorage.load() : []);
  const count = cart.reduce((s, i) => s + (i.qty || 1), 0);
  const el    = document.getElementById('dsNavCount');
  if (el) {
    el.textContent    = count;
    el.style.display  = count ? 'flex' : 'none';
  }
}

/* ── API fallback for simple pages ─────────────────────
   storage.js provides the full cookie + refresh implementation.
   Some informational pages intentionally load only ui.js, so keep a
   small cookie-only fallback instead of leaving DS.apiFetch undefined.
   ─────────────────────────────────────────────────────── */
let _uiRefreshPromise = null;

async function uiSilentRefresh() {
  if (_uiRefreshPromise) return _uiRefreshPromise;
  _uiRefreshPromise = (async () => {
    try {
      const res = await fetch(`${API}/auth/refresh`, { method: 'POST', credentials: 'include' });
      return res.ok;
    } catch {
      return false;
    } finally {
      _uiRefreshPromise = null;
    }
  })();
  return _uiRefreshPromise;
}

async function uiApiFetch(path, options = {}, _retry = false) {
  const headers = { ...(options.headers || {}) };
  if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  let res;
  try {
    res = await fetch(API + path, { ...options, headers, credentials: 'include' });
  } catch {
    throw new Error('اتصال به سرور برقرار نشد.');
  }

  if (res.status === 401 && !_retry) {
    const refreshed = await uiSilentRefresh();
    if (refreshed) return uiApiFetch(path, options, true);
  }

  const text = await res.text();
  let data = null;
  if (text) { try { data = JSON.parse(text); } catch (_) {} }
  if (!res.ok) {
    const err = new Error((data && data.error) || `خطای سرور (کد ${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

/* ── INIT ────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  renderNav();
  renderFooter();
});

window.DS = { showAlert, hideAlert, setLoading, updateCartBadge, apiFetch: (...args) => (typeof apiFetch === 'function' ? apiFetch(...args) : uiApiFetch(...args)), API };
