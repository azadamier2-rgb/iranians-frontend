/* ============================================================
   HomeShop — assets/js/products.js

   ⚠️ نکته: این فایل طبق ساختار درخواستی «products.js» نام‌گذاری شده،
   اما چون در ساختار فایل‌ها یک "api.js" جداگانه وجود نداشت، تمام
   لایه‌ی ارتباط با بک‌اند (محصولات، سفارش‌ها، مشتریان، ورود/ثبت‌نام،
   نظرات) اینجا نگه‌داری می‌شود تا تعداد فایل‌ها دقیقاً با درخواست
   شما یکی بماند. همچنین توابع کمکی نمایش محصول (فرمت قیمت، آیکون
   دسته‌بندی، کارت محصول) که در چند صفحه مشترک است، همین‌جاست.

   وابسته به storage.js (باید قبل از این فایل لود شود).
   ============================================================ */

const ALLOWED_CATEGORIES = ['یخچال و فریزر', 'لباسشویی', 'آشپزخانه', 'نظافت', 'گرمایشی و سرمایشی', 'تلویزیون'];
const CATEGORY_ICONS = {
  'یخچال و فریزر': '🧊',
  'لباسشویی': '🧺',
  'آشپزخانه': '🍳',
  'نظافت': '🧹',
  'گرمایشی و سرمایشی': '❄️',
  'تلویزیون': '📺',
};

function fmt(n) { return Number(n).toLocaleString('fa-IR') + ' تومان'; }

/**
 * ⚠️ امنیت: تمام متن‌هایی که کاربر/ادمین وارد کرده (نام محصول، توضیحات،
 * نام مشتری، آدرس، متن نظر، نام کاربر ثبت‌نام‌کننده) باید قبل از درج در
 * innerHTML از این تابع رد بشن — even اگر بک‌اند هم اعتبارسنجی می‌کند.
 * دلیل: escape کردن باید در «نقطه‌ی خروجی» (رندر) انجام شود، نه در
 * «نقطه‌ی ورودی» (ذخیره‌سازی) — چون:
 *   ۱. اگر یک مسیر جدید بعداً به دیتابیس بدون عبور از اعتبارسنج اضافه شود
 *      (مثل یک اسکریپت import دستی)، تنها خط دفاعی همین‌جاست.
 *   ۲. escape کردن در سمت سرور و ذخیره‌ی نسخه‌ی encode‌شده، داده‌ی خام را
 *      خراب می‌کند (مثلاً جستجوی دقیق یا خروجی CSV بعداً درست کار نمی‌کند).
 * همچنین این تابع مقادیر را برای درج داخل attribute (مثل alt="...")
 * هم امن می‌کند، چون کوتیشن (") را هم escape می‌کند.
 */
function escapeHTML(str) {
  return String(str ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}
function categoryIcon(cat) { return `<span class="icon-fallback">${CATEGORY_ICONS[cat] || '📦'}</span>`; }
function coverImage(product) {
  if (product.images && product.images.length > 0) return imgUrl(product.images[0].url);
  return '';
}

/** کارت محصول HTML — در صفحه اصلی (کاتالوگ) و محصولات مرتبط استفاده می‌شود. */
function cardHTML(p) {
  const cover = coverImage(p);
  return `
  <div class="card">
    <div class="thumb">
      ${cover ? `<img src="${cover}" alt="${escapeHTML(p.name)}" loading="lazy">` : categoryIcon(p.category)}
    </div>
    <div class="body">
      <span class="cat">${escapeHTML(p.category)}</span>
      <h3>${escapeHTML(p.name)}</h3>
      <p class="desc">${escapeHTML(p.description || '')}</p>
      <div class="row">
        <span class="price">${fmt(p.price)}</span>
        ${p.stock === 0 ? '<span class="stockwarn">ناموجود</span>' : (p.stock < 5 ? `<span class="stockwarn">${p.stock} عدد</span>` : '')}
      </div>
      <div class="row" style="margin-top:4px; gap:8px;">
        <a class="btn small" style="flex:1; text-align:center;" href="product.html?id=${encodeURIComponent(p.id)}">مشاهده</a>
        <button class="btn outline small" style="flex:1;" data-quick-add="${escapeHTML(p.id)}" ${p.stock === 0 ? 'disabled' : ''}>افزودن</button>
      </div>
    </div>
  </div>`;
}

/* ============================================================
   API resource layer
   ============================================================ */
const ProductsAPI = {
  async list({ category, search, page = 1, pageSize = 48, minPrice, maxPrice, sort, stockBelow } = {}) {
    const params = new URLSearchParams();
    if (category && category !== 'همه') params.set('category', category);
    if (search) params.set('search', search);
    if (minPrice !== undefined && minPrice !== null && minPrice !== '') params.set('minPrice', minPrice);
    if (maxPrice !== undefined && maxPrice !== null && maxPrice !== '') params.set('maxPrice', maxPrice);
    if (sort) params.set('sort', sort);
    if (stockBelow !== undefined && stockBelow !== null && stockBelow !== '') params.set('stockBelow', stockBelow);
    params.set('page', page);
    params.set('pageSize', pageSize);
    return apiFetch(`/products?${params.toString()}`);
  },
  async get(id) { return apiFetch(`/products/${id}`); },
  async create(payload) { return apiFetch('/products', { method: 'POST', body: JSON.stringify(payload) }); },
  async update(id, payload) { return apiFetch(`/products/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }); },
  async remove(id) { return apiFetch(`/products/${id}`, { method: 'DELETE' }); },
  async uploadImages(id, files) {
    const form = new FormData();
    Array.from(files).forEach(file => form.append('images', file));
    return apiFetch(`/products/${id}/images`, { method: 'POST', body: form });
  },
  async deleteImage(productId, imageId) { return apiFetch(`/products/${productId}/images/${imageId}`, { method: 'DELETE' }); },
  async reorderImages(productId, orderedImageIds) {
    return apiFetch(`/products/${productId}/images/reorder`, { method: 'PATCH', body: JSON.stringify({ order: orderedImageIds }) });
  },
  async adjustStock(id, delta, reason) {
    return apiFetch(`/products/${id}/stock`, { method: 'PATCH', body: JSON.stringify({ delta, reason }) });
  },
  async getStockLogs(id) { return apiFetch(`/products/${id}/stock-logs`); },
  async lowStockAlerts(){ return apiFetch('/store/admin/low-stock'); },
  async getPriceLogs(id) { return apiFetch(`/products/${id}/price-logs`); },
};

const WishlistAPI = {
  async list(){ return apiFetch('/wishlist'); },
  async add(productId){ return apiFetch(`/wishlist/${encodeURIComponent(productId)}`, {method:'POST'}); },
  async remove(productId){ return apiFetch(`/wishlist/${encodeURIComponent(productId)}`, {method:'DELETE'}); },
};
const AddressesAPI = {
  async list(){ return apiFetch('/users/addresses'); },
  async create(payload){ return apiFetch('/users/addresses',{method:'POST',body:JSON.stringify(payload)}); },
  async update(id,payload){ return apiFetch(`/users/addresses/${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify(payload)}); },
  async remove(id){ return apiFetch(`/users/addresses/${encodeURIComponent(id)}`,{method:'DELETE'}); },
};
const ReturnsAPI = {
  async create(orderId,reason,description){ return apiFetch('/returns',{method:'POST',body:JSON.stringify({orderId,reason,description})}); },
  async mine(){ return apiFetch('/returns/mine'); },
};

const ReviewsAPI = {
  async create(productId, rating, comment) {
    return apiFetch(`/products/${productId}/reviews`, { method: 'POST', body: JSON.stringify({ rating, comment }) });
  },
  async remove(reviewId) { return apiFetch(`/reviews/${reviewId}`, { method: 'DELETE' }); },
};

const OrdersAPI = {
  async create(payload) { return apiFetch('/orders', { method: 'POST', body: JSON.stringify(payload) }); },
  async listMine() { return apiFetch('/orders/mine'); },
  async listCompleted() { return apiFetch('/orders/completed'); },
  async listAll({ status, search, startDate, endDate, page = 1, pageSize = 50 } = {}) {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (search) params.set('search', search);
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    params.set('page', page);
    params.set('pageSize', pageSize);
    return apiFetch(`/orders?${params.toString()}`);
  },
  async updateStatus(id, status) { return apiFetch(`/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }); },
  async getSalesReport({ startDate, endDate } = {}) {
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    return apiFetch(`/orders/report?${params.toString()}`);
  },
};

const PaymentAPI = {
  async initiate(orderId, guestPhone) {
    return apiFetch('/payment/initiate', {
      method: 'POST',
      body: JSON.stringify({ orderId, ...(guestPhone ? { guestPhone } : {}) }),
    });
  },
  async status(orderId, guestPhone) {
    const q = guestPhone ? `?guestPhone=${encodeURIComponent(guestPhone)}` : '';
    return apiFetch(`/payment/status/${orderId}${q}`);
  },
};

const CouponsAPI = {
  async list() { return apiFetch('/coupons'); },
  async create(payload) { return apiFetch('/coupons', { method: 'POST', body: JSON.stringify(payload) }); },
  async update(id, payload) { return apiFetch(`/coupons/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }); },
  async remove(id) { return apiFetch(`/coupons/${id}`, { method: 'DELETE' }); },
  async validate(code, subtotal) {
    return apiFetch('/coupons/validate', { method: 'POST', body: JSON.stringify({ code, subtotal }) });
  },
};

const UsersAPI = {
  async list() { return apiFetch('/users'); },
};

const PricingAPI = {
  async getConfig() { return apiFetch('/pricing/config'); },
  async updateConfig(payload) { return apiFetch('/pricing/config', { method: 'PATCH', body: JSON.stringify(payload) }); },
  async runNow() { return apiFetch('/pricing/run-now', { method: 'POST' }); },
  async getLogs() { return apiFetch('/pricing/logs'); },
};

const AuthAPI = {
  async register(name, email, password) {
    return apiFetch('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) });
  },
  async login(email, password) {
    const data = await apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    setSession(data.user);
    return data.user;
  },
  async logout() {
    try { await apiFetch('/auth/logout', { method: 'POST' }); } catch { /* best effort */ }
    clearSession();
  },
  async changePassword(currentPassword, newPassword) {
    return apiFetch('/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) });
  },
  async forgotPassword(email) {
    return apiFetch('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
  },
  async resetPassword(email, token, newPassword) {
    return apiFetch('/auth/reset-password', { method: 'POST', body: JSON.stringify({ email, token, newPassword }) });
  },
};
