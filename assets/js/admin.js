/* ============================================================
   HomeShop — assets/js/admin.js
   ⚠️ فایل اضافه (جزو لیست اصلی نبود) — پنل مدیریت کامل.
   ============================================================ */

let editingProductId = null;
let productsCache = [];

function statusLabel(s) { return { PENDING: 'در انتظار پرداخت', PAID: 'پرداخت‌شده', PROCESSING: 'در حال آماده‌سازی', SHIPPED: 'ارسال‌شده', DELIVERED: 'تحویل‌شده', COMPLETED: 'تکمیل‌شده', CANCELLED: 'لغوشده', REFUNDED: 'بازگشت وجه' }[s] || s; }
function orderTransitions(s) { return { PENDING: ['PAID','CANCELLED'], PAID: ['PROCESSING','CANCELLED'], PROCESSING: ['SHIPPED','CANCELLED'], SHIPPED: ['DELIVERED'], DELIVERED: ['COMPLETED'], COMPLETED: [], CANCELLED: [], REFUNDED: [] }[s] || []; }
function orderStatusOptions(current) { const allowed = orderTransitions(current); const all = [ ['PENDING','در انتظار پرداخت'], ['PAID','پرداخت‌شده'], ['PROCESSING','در حال آماده‌سازی'], ['SHIPPED','ارسال‌شده'], ['DELIVERED','تحویل‌شده'], ['COMPLETED','تکمیل‌شده'], ['CANCELLED','لغوشده'] ]; return `<option value="${current}" selected>${statusLabel(current)}</option>` + allowed.map(([v,l]) => `<option value="${v}">${l}</option>`).join(''); }
function statusPillClass(s) { return { PENDING: 'wait', SHIPPED: 'wait', COMPLETED: 'ok', CANCELLED: 'low' }[s] || ''; }

async function guardAdminAccess() {
  const user = await restoreSession();
  if (!user || user.role !== 'ADMIN') {
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

async function initDashboard() {
  const ok = await guardAdminAccess();
  if (!ok) return;
  await Promise.all([
    renderOverview(),
    renderProductsTab(),
    renderInventoryTab(),
    renderPricingTab(),
    renderDiscountsTab(),
    renderOrdersTab(),
    renderCustomersTab(),
    renderReportsTab(),
    renderSupportTab(),
  ]);
  renderSecurityTab();
}

document.querySelectorAll('.dash-tab').forEach(tab => {
  tab.onclick = () => {
    document.querySelectorAll('.dash-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    document.querySelectorAll('.dash-tab-content').forEach(c => c.style.display = 'none');
    document.getElementById('tab-' + tab.dataset.tab).style.display = 'block';
  };
});

document.getElementById('logoutBtn')?.addEventListener('click', async () => {
  await AuthAPI.logout();
  window.location.href = 'index.html';
});

/* ---------- Overview ---------- */
async function renderOverview() {
  const box = document.getElementById('tab-overview');
  box.innerHTML = '<p class="empty-note">در حال بارگذاری…</p>';
  try {
    const [{ items: allProducts, total: productTotal }, { orders }] = await Promise.all([
      ProductsAPI.list({ pageSize: 200 }),
      OrdersAPI.listAll(),
    ]);
    const totalRevenue = orders.reduce((s, o) => s + o.total, 0);
    const pending = orders.filter(o => o.status === 'PENDING').length;
    const lowStock = allProducts.filter(p => p.stock > 0 && p.stock <= 5);
    const outOfStock = allProducts.filter(p => p.stock === 0);

    box.innerHTML = `
      <div class="dash-toolbar"><h2>نمای کلی فروشگاه</h2></div>
      <div class="stat-grid">
        <div class="stat-card"><div class="v">${productTotal}</div><div class="l">تعداد محصولات</div></div>
        <div class="stat-card"><div class="v">${orders.length}</div><div class="l">تعداد سفارش‌ها</div></div>
        <div class="stat-card"><div class="v">${fmt(totalRevenue)}</div><div class="l">درآمد کل</div></div>
        <div class="stat-card"><div class="v">${pending}</div><div class="l">سفارش در انتظار</div></div>
      </div>

      ${(lowStock.length > 0 || outOfStock.length > 0) ? `
      <div class="alert-box">
        <div class="alert-box-title">⚠️ هشدار موجودی</div>
        ${outOfStock.length > 0 ? `<div class="alert-line">${outOfStock.length} محصول <b>ناموجود</b> است: ${outOfStock.slice(0, 5).map(p => escapeHTML(p.name)).join('، ')}${outOfStock.length > 5 ? ' و ...' : ''}</div>` : ''}
        ${lowStock.length > 0 ? `<div class="alert-line">${lowStock.length} محصول <b>موجودی کم</b> دارد (۵ عدد یا کمتر): ${lowStock.slice(0, 5).map(p => escapeHTML(p.name)).join('، ')}${lowStock.length > 5 ? ' و ...' : ''}</div>` : ''}
      </div>` : ''}

      <div class="section-head" style="margin-top:10px;"><h2 style="font-size:18px;">آخرین سفارش‌ها</h2></div>
      <table>
        <thead><tr><th>مشتری</th><th>مبلغ</th><th>وضعیت</th><th>تاریخ</th></tr></thead>
        <tbody>
          ${orders.slice(0, 5).map(o => `
            <tr>
              <td>${escapeHTML(o.customerName)}</td><td>${fmt(o.total)}</td>
              <td><span class="pill ${statusPillClass(o.status)}">${statusLabel(o.status)}</span></td>
              <td>${new Date(o.createdAt).toLocaleDateString('fa-IR')}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    `;
  } catch (err) {
    box.innerHTML = `<p class="empty-note">خطا: ${escapeHTML(err.message)}</p>`;
  }
}

/* ---------- Products ---------- */
let productsAdminPage = 1;
const PRODUCTS_ADMIN_PAGE_SIZE = 20;

async function renderProductsTab() {
  const box = document.getElementById('tab-products');
  box.innerHTML = '<p class="empty-note">در حال بارگذاری…</p>';
  try {
    const { items, total } = await ProductsAPI.list({ page: productsAdminPage, pageSize: PRODUCTS_ADMIN_PAGE_SIZE, sort: 'newest' });
    productsCache = items;
    const totalPages = Math.max(1, Math.ceil(total / PRODUCTS_ADMIN_PAGE_SIZE));

    box.innerHTML = `
      <div class="dash-toolbar">
        <h2>مدیریت محصولات (${total.toLocaleString('fa-IR')} محصول)</h2>
        <button class="btn small" id="addProductBtn">+ افزودن محصول</button>
      </div>
      <table>
        <thead><tr><th></th><th>نام</th><th>دسته</th><th>قیمت</th><th>موجودی</th><th>عملیات</th></tr></thead>
        <tbody>
          ${items.map(p => {
            const cover = coverImage(p);
            return `
            <tr>
              <td>${cover ? `<img class="table-thumb" src="${cover}" alt="">` : `<span style="font-size:20px;">${categoryIcon(p.category)}</span>`}</td>
              <td>${escapeHTML(p.name)}</td>
              <td>${escapeHTML(p.category)}</td>
              <td>${fmt(p.price)}</td>
              <td>${p.stock === 0 ? '<span class="pill low">ناموجود</span>' : p.stock < 6 ? '<span class="pill wait">' + p.stock + ' عدد</span>' : p.stock}</td>
              <td class="actions-cell">
                <button data-edit="${p.id}">ویرایش</button>
                <button data-del="${p.id}">حذف</button>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
      ${totalPages > 1 ? `
        <div class="admin-pager">
          <button class="btn ghost small" id="adminProdPrev" ${productsAdminPage <= 1 ? 'disabled' : ''}>‹ قبلی</button>
          <span>صفحه ${productsAdminPage.toLocaleString('fa-IR')} از ${totalPages.toLocaleString('fa-IR')}</span>
          <button class="btn ghost small" id="adminProdNext" ${productsAdminPage >= totalPages ? 'disabled' : ''}>بعدی ›</button>
        </div>` : ''}
    `;
    document.getElementById('addProductBtn').onclick = () => openProductModal(null);
    document.querySelectorAll('#tab-products [data-edit]').forEach(b => b.onclick = () => openProductModal(b.dataset.edit));
    document.querySelectorAll('#tab-products [data-del]').forEach(b => {
      b.onclick = async () => {
        if (!confirm('آیا از حذف این محصول مطمئن هستید؟')) return;
        try {
          await ProductsAPI.remove(b.dataset.del);
          if (items.length === 1 && productsAdminPage > 1) productsAdminPage--; // avoid landing on a now-empty page
          await renderProductsTab();
          renderOverview();
        } catch (err) { alert(err.message); }
      };
    });
    document.getElementById('adminProdPrev')?.addEventListener('click', () => { if (productsAdminPage > 1) { productsAdminPage--; renderProductsTab(); } });
    document.getElementById('adminProdNext')?.addEventListener('click', () => { if (productsAdminPage < totalPages) { productsAdminPage++; renderProductsTab(); } });
  } catch (err) {
    box.innerHTML = `<p class="empty-note">خطا: ${escapeHTML(err.message)}</p>`;
  }
}

/* ---------- Orders ---------- */
/* ---------- Orders (with filters + pagination) ---------- */
let orderFilters = { status: '', search: '', startDate: '', endDate: '', page: 1 };
const ORDERS_PAGE_SIZE = 25;

async function renderOrdersTab() {
  const box = document.getElementById('tab-orders');
  box.innerHTML = '<p class="empty-note">در حال بارگذاری…</p>';
  try {
    const { orders, total } = await OrdersAPI.listAll({ ...orderFilters, pageSize: ORDERS_PAGE_SIZE });
    const totalPages = Math.max(1, Math.ceil(total / ORDERS_PAGE_SIZE));

    box.innerHTML = `
      <div class="dash-toolbar"><h2>مدیریت سفارش‌ها (${total.toLocaleString('fa-IR')} سفارش)</h2></div>
      <div class="order-filter-bar">
        <input type="text" id="orderSearchInput" placeholder="جستجوی نام مشتری…" value="${escapeHTML(orderFilters.search)}">
        <select id="orderStatusFilter">
          <option value="">همه وضعیت‌ها</option>
          ${[['PENDING','در انتظار پرداخت'],['PAID','پرداخت‌شده'],['PROCESSING','در حال آماده‌سازی'],['SHIPPED','ارسال‌شده'],['DELIVERED','تحویل‌شده'],['COMPLETED','تکمیل‌شده'],['CANCELLED','لغوشده']].map(([v,l]) => `<option value="${v}" ${orderFilters.status === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select>
        <input type="date" id="orderStartDate" value="${orderFilters.startDate}" title="از تاریخ">
        <input type="date" id="orderEndDate" value="${orderFilters.endDate}" title="تا تاریخ">
        <button class="btn small" id="orderFilterApply">اعمال فیلتر</button>
        <button class="btn ghost small" id="orderFilterClear">پاک‌کردن</button>
      </div>
      <table>
        <thead><tr><th></th><th>مشتری</th><th>اقلام</th><th>تخفیف</th><th>مبلغ نهایی</th><th>وضعیت</th><th>تاریخ</th><th>عملیات</th></tr></thead>
        <tbody>
          ${orders.map(o => `
            <tr>
              <td><button class="btn ghost small" data-order-expand="${o.id}">جزئیات</button></td>
              <td>${escapeHTML(o.customerName)}</td>
              <td>${o.items.reduce((s, i) => s + i.quantity, 0)} قلم</td>
              <td>${o.discountAmount > 0 ? fmt(o.discountAmount) + (o.couponCode ? ` (${escapeHTML(o.couponCode)})` : '') : '—'}</td>
              <td>${fmt(o.total)}</td>
              <td><span class="pill ${statusPillClass(o.status)}">${statusLabel(o.status)}</span></td>
              <td>${new Date(o.createdAt).toLocaleDateString('fa-IR')}</td>
              <td class="actions-cell">
                <select data-status="${o.id}" style="font-size:12px; padding:4px;">${orderStatusOptions(o.status)}</select>
              </td>
            </tr>
            <tr class="order-detail-row" id="order-detail-${o.id}" style="display:none;">
              <td colspan="8">
                <div class="order-detail-box">
                  <div><b>تلفن:</b> ${escapeHTML(o.customerPhone)}</div>
                  <div><b>آدرس:</b> ${escapeHTML(o.customerAddress)}</div>
                  <div style="margin-top:8px;"><b>اقلام سفارش:</b></div>
                  <ul>
                    ${o.items.map(i => `<li>${escapeHTML(i.product ? i.product.name : '(محصول حذف‌شده)')} × ${i.quantity} — ${fmt(i.unitPrice * i.quantity)}</li>`).join('')}
                  </ul>
                  <div class="order-detail-totals">
                    <div>جمع جزء: ${fmt(o.subtotal)}</div>
                    ${o.discountAmount > 0 ? `<div>تخفیف${o.couponCode ? ` (${escapeHTML(o.couponCode)})` : ''}: ${fmt(o.discountAmount)}-</div>` : ''}
                    <div><b>مبلغ نهایی: ${fmt(o.total)}</b></div><div style="margin-top:10px"><a class="btn ghost small" target="_blank" href="invoice.html?orderId=${encodeURIComponent(o.id)}">🧾 فاکتور</a></div>
                  </div>
                </div>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
      ${totalPages > 1 ? `
        <div class="admin-pager">
          <button class="btn ghost small" id="orderPagerPrev" ${orderFilters.page <= 1 ? 'disabled' : ''}>‹ قبلی</button>
          <span>صفحه ${orderFilters.page.toLocaleString('fa-IR')} از ${totalPages.toLocaleString('fa-IR')}</span>
          <button class="btn ghost small" id="orderPagerNext" ${orderFilters.page >= totalPages ? 'disabled' : ''}>بعدی ›</button>
        </div>` : ''}
    `;

    document.querySelectorAll('#tab-orders [data-status]').forEach(sel => {
      sel.onchange = async () => {
        try {
          await OrdersAPI.updateStatus(sel.dataset.status, sel.value);
          await renderOrdersTab();
          renderOverview();
        } catch (err) { alert(err.message); }
      };
    });
    document.querySelectorAll('[data-order-expand]').forEach(btn => {
      btn.onclick = () => {
        const row = document.getElementById('order-detail-' + btn.dataset.orderExpand);
        const isOpen = row.style.display !== 'none';
        row.style.display = isOpen ? 'none' : 'table-row';
        btn.textContent = isOpen ? 'جزئیات' : 'بستن';
      };
    });
    document.getElementById('orderFilterApply').onclick = () => {
      orderFilters.search = document.getElementById('orderSearchInput').value.trim();
      orderFilters.status = document.getElementById('orderStatusFilter').value;
      orderFilters.startDate = document.getElementById('orderStartDate').value;
      orderFilters.endDate = document.getElementById('orderEndDate').value;
      orderFilters.page = 1;
      renderOrdersTab();
    };
    document.getElementById('orderFilterClear').onclick = () => {
      orderFilters = { status: '', search: '', startDate: '', endDate: '', page: 1 };
      renderOrdersTab();
    };
    document.getElementById('orderPagerPrev')?.addEventListener('click', () => { if (orderFilters.page > 1) { orderFilters.page--; renderOrdersTab(); } });
    document.getElementById('orderPagerNext')?.addEventListener('click', () => { if (orderFilters.page < totalPages) { orderFilters.page++; renderOrdersTab(); } });
  } catch (err) {
    box.innerHTML = `<p class="empty-note">خطا: ${escapeHTML(err.message)}</p>`;
  }
}

/* ---------- Inventory management ---------- */
let inventoryLowStockOnly = false;

async function renderInventoryTab() {
  const box = document.getElementById('tab-inventory');
  box.innerHTML = '<p class="empty-note">در حال بارگذاری…</p>';
  try {
    const { items } = await ProductsAPI.list({
      pageSize: 200,
      sort: 'name_asc',
      stockBelow: inventoryLowStockOnly ? 6 : undefined,
    });

    box.innerHTML = `
      <div class="dash-toolbar">
        <h2>مدیریت موجودی</h2>
        <label style="display:flex; align-items:center; gap:6px; font-size:13px; color:var(--muted); cursor:pointer;">
          <input type="checkbox" id="lowStockOnlyToggle" ${inventoryLowStockOnly ? 'checked' : ''}>
          فقط موجودی کم (۵ عدد یا کمتر) و ناموجود
        </label>
      </div>
      <table>
        <thead><tr><th>نام محصول</th><th>دسته</th><th>موجودی فعلی</th><th>تنظیم سریع</th><th>عملیات</th></tr></thead>
        <tbody>
          ${items.map(p => `
            <tr>
              <td>${escapeHTML(p.name)}</td>
              <td>${escapeHTML(p.category)}</td>
              <td><b class="${p.stock === 0 ? 'stockwarn' : ''}">${p.stock.toLocaleString('fa-IR')}</b></td>
              <td class="actions-cell">
                <button data-quick-dec="${p.id}" ${p.stock === 0 ? 'disabled' : ''}>−۱</button>
                <button data-quick-inc="${p.id}">+۱</button>
              </td>
              <td class="actions-cell">
                <button data-open-stock="${p.id}" data-name="${escapeHTML(p.name)}" data-stock="${p.stock}">اصلاح / تاریخچه</button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
      ${items.length === 0 ? '<p class="empty-note">محصولی با این فیلتر یافت نشد.</p>' : ''}
    `;

    document.getElementById('lowStockOnlyToggle').onchange = (e) => {
      inventoryLowStockOnly = e.target.checked;
      renderInventoryTab();
    };
    document.querySelectorAll('[data-quick-inc]').forEach(btn => {
      btn.onclick = () => quickAdjustStock(btn.dataset.quickInc, 1, 'تنظیم سریع (+۱)');
    });
    document.querySelectorAll('[data-quick-dec]').forEach(btn => {
      btn.onclick = () => quickAdjustStock(btn.dataset.quickDec, -1, 'تنظیم سریع (−۱)');
    });
    document.querySelectorAll('[data-open-stock]').forEach(btn => {
      btn.onclick = () => openStockModal(btn.dataset.openStock, btn.dataset.name, btn.dataset.stock);
    });
  } catch (err) {
    box.innerHTML = `<p class="empty-note">خطا: ${escapeHTML(err.message)}</p>`;
  }
}

async function quickAdjustStock(productId, delta, reason) {
  try {
    await ProductsAPI.adjustStock(productId, delta, reason);
    await renderInventoryTab();
    renderOverview();
  } catch (err) {
    alert(err.message);
  }
}

let stockModalProductId = null;

function openStockModal(productId, name, currentStock) {
  stockModalProductId = productId;
  document.getElementById('stockModalProductName').textContent = name;
  document.getElementById('stockModalCurrent').textContent = currentStock;
  document.getElementById('stockDelta').value = '';
  document.getElementById('stockReason').value = '';
  document.getElementById('stockError').style.display = 'none';
  renderStockHistory(productId);
  document.getElementById('stockModalOverlay').classList.add('open');
}
document.getElementById('stockCancelBtn')?.addEventListener('click', () => {
  document.getElementById('stockModalOverlay').classList.remove('open');
});
document.getElementById('stockModalOverlay')?.addEventListener('click', (e) => {
  if (e.target.id === 'stockModalOverlay') document.getElementById('stockModalOverlay').classList.remove('open');
});

async function renderStockHistory(productId) {
  const box = document.getElementById('stockHistoryList');
  box.innerHTML = '<p class="image-manager-empty">در حال بارگذاری…</p>';
  try {
    const { logs } = await ProductsAPI.getStockLogs(productId);
    box.innerHTML = logs.length
      ? `<table><thead><tr><th>تاریخ</th><th>تغییر</th><th>موجودی جدید</th><th>دلیل</th></tr></thead><tbody>
          ${logs.map(l => `
            <tr>
              <td>${new Date(l.createdAt).toLocaleDateString('fa-IR')}</td>
              <td style="color:${l.delta > 0 ? 'var(--ok)' : 'var(--danger)'};">${l.delta > 0 ? '+' : ''}${l.delta.toLocaleString('fa-IR')}</td>
              <td>${l.newStock.toLocaleString('fa-IR')}</td>
              <td>${escapeHTML(l.reason)}</td>
            </tr>`).join('')}
        </tbody></table>`
      : '<p class="image-manager-empty">هنوز تغییری برای این محصول ثبت نشده است.</p>';
  } catch (err) {
    box.innerHTML = `<p class="image-manager-empty">خطا: ${escapeHTML(err.message)}</p>`;
  }
}

document.getElementById('stockSaveBtn')?.addEventListener('click', async () => {
  const errBox = document.getElementById('stockError');
  errBox.style.display = 'none';
  const delta = parseInt(document.getElementById('stockDelta').value, 10);
  const reason = document.getElementById('stockReason').value.trim();
  if (!Number.isInteger(delta) || delta === 0) { errBox.textContent = 'یک عدد غیرصفر برای تغییر موجودی وارد کنید.'; errBox.style.display = 'block'; return; }
  if (reason.length < 2) { errBox.textContent = 'دلیل تغییر را بنویسید.'; errBox.style.display = 'block'; return; }
  try {
    await ProductsAPI.adjustStock(stockModalProductId, delta, reason);
    document.getElementById('stockDelta').value = '';
    document.getElementById('stockReason').value = '';
    const { product } = await ProductsAPI.get(stockModalProductId);
    document.getElementById('stockModalCurrent').textContent = product.stock;
    await renderStockHistory(stockModalProductId);
    await renderInventoryTab();
    await renderProductsTab();
    renderOverview();
  } catch (err) {
    errBox.textContent = err.message;
    errBox.style.display = 'block';
  }
});

/* ---------- Auto-pricing (exchange-rate based) ---------- */
async function renderPricingTab() {
  const box = document.getElementById('tab-pricing');
  box.innerHTML = '<p class="empty-note">در حال بارگذاری…</p>';
  try {
    const [{ config }, { logs }] = await Promise.all([PricingAPI.getConfig(), PricingAPI.getLogs()]);

    const lastRunText = config.lastRunAt
      ? `${new Date(config.lastRunAt).toLocaleString('fa-IR')} — ${config.lastRunStatus === 'SUCCESS' ? '✅ موفق' : '❌ ناموفق'}`
      : 'هنوز اجرا نشده';

    box.innerHTML = `
      <div class="dash-toolbar"><h2>قیمت‌گذاری خودکار بر اساس نرخ ارز</h2></div>
      <p class="hint" style="margin-bottom:16px;">
        فقط محصولاتی که از فرم ویرایش محصول، «قیمت خودکار» را برایشان فعال کرده‌ای و هزینه دلاری وارد کرده‌ای، شامل این به‌روزرسانی می‌شوند.
        منبع نرخ ارز و کلید API در فایل <code>src/services/exchangeRateProvider.js</code> و <code>.env</code> بک‌اند تنظیم می‌شود.
      </p>

      <div class="form-error" id="pricingError" role="alert"></div>
      <div class="form-success" id="pricingSuccess" role="status"></div>

      <div class="pricing-status-box">
        <div><b>آخرین اجرا:</b> ${escapeHTML(lastRunText)}</div>
        ${config.lastFetchedRate ? `<div><b>آخرین نرخ دریافت‌شده:</b> ${fmt(config.lastFetchedRate)} به ازای هر دلار</div>` : ''}
        ${config.lastRunMessage ? `<div class="pricing-status-msg">${escapeHTML(config.lastRunMessage)}</div>` : ''}
      </div>

      <div style="max-width:420px; margin-top:18px;">
        <label style="display:flex; align-items:center; gap:8px; font-size:13.5px; font-weight:600; cursor:pointer;">
          <input type="checkbox" id="pricingAutoEnabled" ${config.autoUpdateEnabled ? 'checked' : ''}>
          قیمت‌گذاری خودکار فعال باشد (هر ۸ ساعت)
        </label>
        <div class="field" style="margin-top:12px;">
          <label>درصد سود پیش‌فرض (برای محصولاتی که سود اختصاصی ندارند)</label>
          <input type="number" id="pricingDefaultMarkup" min="0" max="500" step="1" value="${config.defaultMarkupPercent}">
        </div>
        <div style="display:flex; gap:10px; margin-top:10px;">
          <button class="btn small" id="pricingSaveBtn">ذخیره تنظیمات</button>
          <button class="btn outline small" id="pricingRunNowBtn">⚡ اجرای دستی الان</button>
        </div>
      </div>

      <div class="section-head" style="margin-top:24px;"><h2 style="font-size:16px;">تاریخچه‌ی تغییرات قیمت (کل فروشگاه)</h2></div>
      ${logs.length > 0 ? `
        <table>
          <thead><tr><th>محصول</th><th>قیمت قبلی</th><th>قیمت جدید</th><th>منبع</th><th>دلیل</th><th>تاریخ</th></tr></thead>
          <tbody>
            ${logs.map(l => `
              <tr>
                <td>${l.product ? escapeHTML(l.product.name) : '(محصول حذف‌شده)'}</td>
                <td>${fmt(l.oldPrice)}</td>
                <td>${fmt(l.newPrice)}</td>
                <td><span class="pill ${l.source === 'AUTO' ? 'ok' : 'wait'}">${l.source === 'AUTO' ? 'خودکار' : 'دستی'}</span></td>
                <td>${escapeHTML(l.reason)}</td>
                <td>${new Date(l.createdAt).toLocaleDateString('fa-IR')}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      ` : '<p class="empty-note">هنوز هیچ تغییر قیمتی ثبت نشده است.</p>'}
    `;

    document.getElementById('pricingSaveBtn').onclick = async () => {
      const errBox = document.getElementById('pricingError');
      const okBox = document.getElementById('pricingSuccess');
      errBox.style.display = 'none';
      okBox.style.display = 'none';
      try {
        await PricingAPI.updateConfig({
          autoUpdateEnabled: document.getElementById('pricingAutoEnabled').checked,
          defaultMarkupPercent: Number(document.getElementById('pricingDefaultMarkup').value) || 0,
        });
        okBox.textContent = 'تنظیمات ذخیره شد.';
        okBox.style.display = 'block';
      } catch (err) {
        errBox.textContent = err.message;
        errBox.style.display = 'block';
      }
    };

    document.getElementById('pricingRunNowBtn').onclick = async () => {
      const errBox = document.getElementById('pricingError');
      const okBox = document.getElementById('pricingSuccess');
      errBox.style.display = 'none';
      okBox.style.display = 'none';
      const btn = document.getElementById('pricingRunNowBtn');
      btn.disabled = true;
      btn.textContent = 'در حال اجرا…';
      try {
        const result = await PricingAPI.runNow();
        if (result.skipped) {
          okBox.textContent = result.reason;
        } else {
          okBox.textContent = `اجرا شد — نرخ: ${fmt(result.rate)}, ${result.updatedCount} محصول به‌روزرسانی شد.`;
        }
        okBox.style.display = 'block';
        await renderPricingTab();
        await renderProductsTab();
      } catch (err) {
        errBox.textContent = err.message;
        errBox.style.display = 'block';
        btn.disabled = false;
        btn.textContent = '⚡ اجرای دستی الان';
      }
    };
  } catch (err) {
    box.innerHTML = `<p class="empty-note">خطا: ${escapeHTML(err.message)}</p>`;
  }
}

/* ---------- Discounts / Coupons ---------- */
let editingCouponId = null;

async function renderDiscountsTab() {
  const box = document.getElementById('tab-discounts');
  box.innerHTML = '<p class="empty-note">در حال بارگذاری…</p>';
  try {
    const { coupons } = await CouponsAPI.list();
    box.innerHTML = `
      <div class="dash-toolbar">
        <h2>کدهای تخفیف</h2>
        <button class="btn small" id="addCouponBtn">+ افزودن کد تخفیف</button>
      </div>
      <table>
        <thead><tr><th>کد</th><th>نوع</th><th>مقدار</th><th>استفاده‌شده</th><th>انقضا</th><th>وضعیت</th><th>عملیات</th></tr></thead>
        <tbody>
          ${coupons.map(c => `
            <tr>
              <td><b>${escapeHTML(c.code)}</b></td>
              <td>${c.type === 'PERCENT' ? 'درصدی' : 'مبلغ ثابت'}</td>
              <td>${c.type === 'PERCENT' ? c.value + '٪' : fmt(c.value)}</td>
              <td>${c.usedCount.toLocaleString('fa-IR')}${c.maxUses ? ' / ' + c.maxUses.toLocaleString('fa-IR') : ''}</td>
              <td>${c.expiresAt ? new Date(c.expiresAt).toLocaleDateString('fa-IR') : 'نامحدود'}</td>
              <td><span class="pill ${c.active ? 'ok' : 'low'}">${c.active ? 'فعال' : 'غیرفعال'}</span></td>
              <td class="actions-cell">
                <button data-coupon-toggle="${c.id}" data-active="${c.active}">${c.active ? 'غیرفعال کن' : 'فعال کن'}</button>
                <button data-coupon-edit="${c.id}">ویرایش</button>
                <button data-coupon-del="${c.id}">حذف</button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
      ${coupons.length === 0 ? '<p class="empty-note">هنوز کد تخفیفی ثبت نشده است.</p>' : ''}
    `;

    document.getElementById('addCouponBtn').onclick = () => openCouponModal(null, coupons);
    document.querySelectorAll('[data-coupon-edit]').forEach(btn => {
      btn.onclick = () => openCouponModal(btn.dataset.couponEdit, coupons);
    });
    document.querySelectorAll('[data-coupon-toggle]').forEach(btn => {
      btn.onclick = async () => {
        try {
          await CouponsAPI.update(btn.dataset.couponToggle, { active: btn.dataset.active !== 'true' });
          await renderDiscountsTab();
        } catch (err) { alert(err.message); }
      };
    });
    document.querySelectorAll('[data-coupon-del]').forEach(btn => {
      btn.onclick = async () => {
        if (!confirm('این کد تخفیف حذف شود؟')) return;
        try {
          await CouponsAPI.remove(btn.dataset.couponDel);
          await renderDiscountsTab();
        } catch (err) { alert(err.message); }
      };
    });
  } catch (err) {
    box.innerHTML = `<p class="empty-note">خطا: ${escapeHTML(err.message)}</p>`;
  }
}

function openCouponModal(id, coupons) {
  editingCouponId = id;
  const c = id ? coupons.find(x => x.id === id) : null;
  document.getElementById('couponModalTitle').textContent = id ? 'ویرایش کد تخفیف' : 'افزودن کد تخفیف';
  document.getElementById('couponError').style.display = 'none';
  document.getElementById('couponCode').value = c ? c.code : '';
  document.getElementById('couponCode').disabled = Boolean(id); // کد بعد از ساخت قابل تغییر نیست (چون در سفارش‌های قبلی ثبت شده)
  document.getElementById('couponType').value = c ? c.type : 'PERCENT';
  document.getElementById('couponValue').value = c ? c.value : '';
  document.getElementById('couponMinOrder').value = c ? c.minOrderAmount : 0;
  document.getElementById('couponMaxUses').value = c && c.maxUses ? c.maxUses : '';
  document.getElementById('couponExpiry').value = c && c.expiresAt ? c.expiresAt.slice(0, 10) : '';
  document.getElementById('couponModalOverlay').classList.add('open');
}
document.getElementById('couponCancelBtn')?.addEventListener('click', () => {
  document.getElementById('couponModalOverlay').classList.remove('open');
});
document.getElementById('couponModalOverlay')?.addEventListener('click', (e) => {
  if (e.target.id === 'couponModalOverlay') document.getElementById('couponModalOverlay').classList.remove('open');
});

document.getElementById('couponSaveBtn')?.addEventListener('click', async () => {
  const errBox = document.getElementById('couponError');
  errBox.style.display = 'none';

  const code = document.getElementById('couponCode').value.trim().toUpperCase();
  const type = document.getElementById('couponType').value;
  const value = Number(document.getElementById('couponValue').value);
  const minOrderAmount = Number(document.getElementById('couponMinOrder').value) || 0;
  const maxUsesRaw = document.getElementById('couponMaxUses').value;
  const maxUses = maxUsesRaw ? Number(maxUsesRaw) : null;
  const expiryRaw = document.getElementById('couponExpiry').value;
  const expiresAt = expiryRaw ? new Date(expiryRaw).toISOString() : null;

  if (!editingCouponId && (!code || code.length < 3)) { errBox.textContent = 'کد تخفیف باید حداقل ۳ کاراکتر باشد.'; errBox.style.display = 'block'; return; }
  if (!value || value <= 0) { errBox.textContent = 'مقدار تخفیف را وارد کنید.'; errBox.style.display = 'block'; return; }
  if (type === 'PERCENT' && value > 100) { errBox.textContent = 'درصد تخفیف نمی‌تواند بیشتر از ۱۰۰ باشد.'; errBox.style.display = 'block'; return; }

  try {
    if (editingCouponId) {
      await CouponsAPI.update(editingCouponId, { type, value, minOrderAmount, maxUses, expiresAt });
    } else {
      await CouponsAPI.create({ code, type, value, minOrderAmount, maxUses, expiresAt });
    }
    document.getElementById('couponModalOverlay').classList.remove('open');
    await renderDiscountsTab();
  } catch (err) {
    errBox.textContent = err.message;
    errBox.style.display = 'block';
  }
});

/* ---------- Sales report ---------- */
let reportFilters = { startDate: '', endDate: '' };

function defaultReportDates() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 29); // last 30 days including today
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

async function renderReportsTab() {
  const box = document.getElementById('tab-reports');
  if (!reportFilters.startDate) {
    const d = defaultReportDates();
    reportFilters.startDate = d.start;
    reportFilters.endDate = d.end;
  }
  box.innerHTML = '<p class="empty-note">در حال بارگذاری…</p>';
  try {
    const report = await OrdersAPI.getSalesReport(reportFilters);
    const maxDayRevenue = Math.max(1, ...report.revenueByDay.map(d => d.revenue));

    box.innerHTML = `
      <div class="dash-toolbar"><h2>گزارش فروش</h2></div>
      <div class="report-filter-bar">
        <input type="date" id="reportStartDate" value="${reportFilters.startDate}">
        <span style="color:var(--muted);">تا</span>
        <input type="date" id="reportEndDate" value="${reportFilters.endDate}">
        <button class="btn small" id="reportApplyBtn">اعمال</button>
      </div>

      <div class="stat-grid">
        <div class="stat-card"><div class="v">${fmt(report.totalRevenue)}</div><div class="l">درآمد کل (بازه انتخابی)</div></div>
        <div class="stat-card"><div class="v">${report.totalOrders.toLocaleString('fa-IR')}</div><div class="l">تعداد سفارش</div></div>
        <div class="stat-card"><div class="v">${fmt(report.averageOrderValue)}</div><div class="l">میانگین ارزش سفارش</div></div>
        <div class="stat-card"><div class="v">${fmt(report.totalDiscount)}</div><div class="l">مجموع تخفیف اعمال‌شده</div></div>
      </div>

      <div class="section-head" style="margin-top:20px;"><h2 style="font-size:16px;">روند درآمد روزانه</h2></div>
      ${report.revenueByDay.length > 0 ? `
        <div class="revenue-chart">
          ${report.revenueByDay.map(d => `
            <div class="revenue-bar-col" title="${new Date(d.date).toLocaleDateString('fa-IR')} — ${fmt(d.revenue)}">
              <div class="revenue-bar" style="height:${Math.max(2, (d.revenue / maxDayRevenue) * 100)}%;"></div>
              <span class="revenue-bar-label">${new Date(d.date).toLocaleDateString('fa-IR', { day: '2-digit', month: '2-digit' })}</span>
            </div>
          `).join('')}
        </div>
      ` : '<p class="empty-note">در این بازه سفارشی ثبت نشده است.</p>'}

      <div class="section-head" style="margin-top:24px;"><h2 style="font-size:16px;">پرفروش‌ترین محصولات</h2></div>
      ${report.topProducts.length > 0 ? `
        <table>
          <thead><tr><th>محصول</th><th>تعداد فروخته‌شده</th><th>درآمد</th></tr></thead>
          <tbody>
            ${report.topProducts.map(p => `
              <tr><td>${escapeHTML(p.name)}</td><td>${p.quantity.toLocaleString('fa-IR')}</td><td>${fmt(p.revenue)}</td></tr>
            `).join('')}
          </tbody>
        </table>
      ` : '<p class="empty-note">داده‌ای برای نمایش نیست.</p>'}
    `;

    document.getElementById('reportApplyBtn').onclick = () => {
      reportFilters.startDate = document.getElementById('reportStartDate').value;
      reportFilters.endDate = document.getElementById('reportEndDate').value;
      renderReportsTab();
    };
  } catch (err) {
    box.innerHTML = `<p class="empty-note">خطا: ${escapeHTML(err.message)}</p>`;
  }
}

/* ---------- Customers ---------- */
async function renderCustomersTab() {
  const box = document.getElementById('tab-customers');
  box.innerHTML = '<p class="empty-note">در حال بارگذاری…</p>';
  try {
    const { users } = await UsersAPI.list();
    box.innerHTML = `
      <div class="dash-toolbar"><h2>مشتریان</h2></div>
      <table>
        <thead><tr><th>نام</th><th>ایمیل</th><th>تعداد سفارش</th><th>مجموع خرید</th></tr></thead>
        <tbody>${users.map(u => `<tr><td>${escapeHTML(u.name)}</td><td>${escapeHTML(u.email)}</td><td>${u.orderCount}</td><td>${fmt(u.totalSpent)}</td></tr>`).join('')}</tbody>
      </table>
    `;
  } catch (err) {
    box.innerHTML = `<p class="empty-note">خطا: ${escapeHTML(err.message)}</p>`;
  }
}

/* ---------- Security (change password) ---------- */
function renderSecurityTab() {
  const box = document.getElementById('tab-security');
  box.innerHTML = `
    <div class="dash-toolbar"><h2>تغییر رمز عبور مدیر</h2></div>
    <div class="form-error" id="pwError" role="alert"></div>
    <div class="form-success" id="pwSuccess" role="status"></div>
    <div style="max-width:380px;">
      <div class="field"><label>رمز عبور فعلی</label><input type="password" id="pwCurrent" autocomplete="current-password" maxlength="128"></div>
      <div class="field"><label>رمز عبور جدید (حداقل ۸ کاراکتر، شامل حرف و عدد)</label><input type="password" id="pwNew" autocomplete="new-password" maxlength="128"><p class="hint" id="pwNewHint"></p></div>
      <div class="field"><label>تکرار رمز عبور جدید</label><input type="password" id="pwConfirm" autocomplete="new-password" maxlength="128"></div>
      <button class="btn" id="pwSaveBtn">ذخیره رمز جدید</button>
      <p class="hint" style="margin-top:14px;">پس از تغییر رمز، باید دوباره وارد شوید.</p>
    </div>
  `;
  wirePasswordStrength('pwNew', 'pwNewHint');
  document.getElementById('pwSaveBtn').onclick = async () => {
    const errBox = document.getElementById('pwError');
    const okBox = document.getElementById('pwSuccess');
    errBox.style.display = 'none';
    okBox.style.display = 'none';
    const current = document.getElementById('pwCurrent').value;
    const next = document.getElementById('pwNew').value;
    const confirmVal = document.getElementById('pwConfirm').value;
    if (next !== confirmVal) { errBox.textContent = 'تکرار رمز عبور جدید مطابقت ندارد.'; errBox.style.display = 'block'; return; }
    try {
      await AuthAPI.changePassword(current, next);
      okBox.textContent = 'رمز عبور با موفقیت تغییر یافت. اکنون دوباره وارد شوید.';
      okBox.style.display = 'block';
      setTimeout(async () => { await AuthAPI.logout(); window.location.href = 'login.html'; }, 1500);
    } catch (err) {
      errBox.textContent = err.message;
      errBox.style.display = 'block';
    }
  };
}

/* ---------- Product modal + multi-image manager ---------- */
function openProductModal(id) {
  editingProductId = id;
  const p = id ? productsCache.find(x => x.id === id) : null;
  document.getElementById('pmError').style.display = 'none';
  document.getElementById('productModalTitle').textContent = id ? 'ویرایش محصول' : 'افزودن محصول';
  document.getElementById('pmName').value = p ? p.name : '';
  document.getElementById('pmBrand').value = p ? (p.brand || '') : '';
  document.getElementById('pmModel').value = p ? (p.model || '') : '';
  document.getElementById('pmSku').value = p ? (p.sku || '') : '';
  document.getElementById('pmWarranty').value = p ? (p.warranty || '') : '';
  document.getElementById('pmSpecs').value = p && p.specifications ? Object.entries(p.specifications).map(([k,v]) => `${k}: ${v}`).join('\n') : '';
  document.getElementById('pmCat').value = p ? p.category : ALLOWED_CATEGORIES[2];
  document.getElementById('pmPrice').value = p ? p.price : '';
  document.getElementById('pmStock').value = p ? p.stock : '';
  document.getElementById('pmLowStockThreshold').value = p ? (p.lowStockThreshold ?? 2) : 2;
  document.getElementById('pmDesc').value = p ? (p.description || '') : '';
  document.getElementById('pmAutoPriceEnabled').checked = p ? Boolean(p.autoPriceEnabled) : false;
  document.getElementById('pmBaseCostUSD').value = p && p.baseCostUSD !== null && p.baseCostUSD !== undefined ? p.baseCostUSD : '';
  document.getElementById('pmMarkupOverride').value = p && p.priceMarkupPercent !== null && p.priceMarkupPercent !== undefined ? p.priceMarkupPercent : '';
  document.getElementById('pmAutoPriceWarning').style.display = (p && p.autoPriceEnabled) ? 'block' : 'none';

  const imagesSection = document.getElementById('pmImagesSection');
  const reviewsSection = document.getElementById('pmReviewsSection');
  if (id) {
    imagesSection.style.display = 'block';
    reviewsSection.style.display = 'block';
    renderImageManager(id);
    renderReviewsManager(id);
  } else {
    imagesSection.style.display = 'none';
    reviewsSection.style.display = 'none';
  }
  document.getElementById('productModalOverlay').classList.add('open');
}
function closeProductModal() { document.getElementById('productModalOverlay').classList.remove('open'); }
document.getElementById('pmCancel')?.addEventListener('click', closeProductModal);
document.getElementById('productModalOverlay')?.addEventListener('click', (e) => { if (e.target.id === 'productModalOverlay') closeProductModal(); });
document.getElementById('pmAutoPriceEnabled')?.addEventListener('change', (e) => {
  document.getElementById('pmAutoPriceWarning').style.display = e.target.checked ? 'block' : 'none';
});

document.getElementById('pmSave')?.addEventListener('click', async () => {
  const errBox = document.getElementById('pmError');
  errBox.style.display = 'none';
  const name = document.getElementById('pmName').value.trim();
  const category = document.getElementById('pmCat').value;
  const brand = document.getElementById('pmBrand').value.trim();
  const model = document.getElementById('pmModel').value.trim();
  const sku = document.getElementById('pmSku').value.trim();
  const warranty = document.getElementById('pmWarranty').value.trim();
  const specifications = {};
  document.getElementById('pmSpecs').value.split('\n').map(x=>x.trim()).filter(Boolean).forEach(line=>{ const i=line.indexOf(':'); if(i>0){ const k=line.slice(0,i).trim(); const v=line.slice(i+1).trim(); if(k && v) specifications[k]=v; }});
  const price = Number(document.getElementById('pmPrice').value);
  const stock = Number(document.getElementById('pmStock').value);
  const lowStockThreshold = Number(document.getElementById('pmLowStockThreshold').value);
  const description = document.getElementById('pmDesc').value.trim();
  const autoPriceEnabled = document.getElementById('pmAutoPriceEnabled').checked;
  const baseCostUSDRaw = document.getElementById('pmBaseCostUSD').value.trim();
  const markupOverrideRaw = document.getElementById('pmMarkupOverride').value.trim();

  if (!name) { errBox.textContent = 'نام محصول الزامی است.'; errBox.style.display = 'block'; return; }
  if (!price || price <= 0) { errBox.textContent = 'قیمت معتبر وارد کنید.'; errBox.style.display = 'block'; return; }
  if (autoPriceEnabled && !baseCostUSDRaw) {
    errBox.textContent = 'برای فعال‌کردن قیمت‌گذاری خودکار، هزینه پایه به دلار را وارد کن.';
    errBox.style.display = 'block';
    return;
  }

  const payload = {
    name, brand: brand || null, model: model || null, sku: sku || null, warranty: warranty || null, specifications: Object.keys(specifications).length ? specifications : null, category, price, stock, description, autoPriceEnabled,
    baseCostUSD: baseCostUSDRaw ? Number(baseCostUSDRaw) : null,
    priceMarkupPercent: markupOverrideRaw ? Number(markupOverrideRaw) : null, lowStockThreshold,
  };
  try {
    if (editingProductId) {
      await ProductsAPI.update(editingProductId, payload);
    } else {
      const { product } = await ProductsAPI.create(payload);
      editingProductId = product.id;
      productsAdminPage = 1; // new products sort first (newest), so jump back to page 1 to see it
      document.getElementById('productModalTitle').textContent = 'ویرایش محصول';
      document.getElementById('pmImagesSection').style.display = 'block';
      document.getElementById('pmReviewsSection').style.display = 'block';
      renderImageManager(product.id);
      renderReviewsManager(product.id);
    }
    await renderProductsTab();
    renderOverview();
  } catch (err) {
    errBox.textContent = err.message;
    errBox.style.display = 'block';
  }
});

async function renderImageManager(productId) {
  const grid = document.getElementById('pmImageGrid');
  grid.innerHTML = '<p class="image-manager-empty">در حال بارگذاری…</p>';
  try {
    const { product } = await ProductsAPI.get(productId);
    const images = product.images || [];
    grid.innerHTML = images.length
      ? images.map((img, i) => `
          <div class="image-manager-item">
            <img src="${imgUrl(img.url)}" alt="">
            <button class="im-del" data-img-del="${img.id}">✕</button>
            ${i === 0 ? '<div class="im-cover-badge">اصلی</div>' : ''}
            <div class="im-reorder">
              <button data-img-up="${img.id}" title="جابه‌جایی به چپ (زودتر نمایش داده شود)" ${i === 0 ? 'disabled' : ''}>◀</button>
              <button data-img-down="${img.id}" title="جابه‌جایی به راست" ${i === images.length - 1 ? 'disabled' : ''}>▶</button>
            </div>
          </div>`).join('')
      : '<p class="image-manager-empty">هنوز عکسی آپلود نشده است.</p>';

    grid.querySelectorAll('[data-img-del]').forEach(btn => {
      btn.onclick = async () => {
        try {
          await ProductsAPI.deleteImage(productId, btn.dataset.imgDel);
          await renderImageManager(productId);
          await renderProductsTab();
        } catch (err) {
          document.getElementById('pmImageError').textContent = err.message;
          document.getElementById('pmImageError').style.display = 'block';
        }
      };
    });

    async function moveImage(imageId, direction) {
      const ids = images.map(im => im.id);
      const idx = ids.indexOf(imageId);
      const swapWith = idx + direction;
      if (swapWith < 0 || swapWith >= ids.length) return;
      [ids[idx], ids[swapWith]] = [ids[swapWith], ids[idx]];
      try {
        await ProductsAPI.reorderImages(productId, ids);
        await renderImageManager(productId);
        await renderProductsTab();
      } catch (err) {
        document.getElementById('pmImageError').textContent = err.message;
        document.getElementById('pmImageError').style.display = 'block';
      }
    }
    grid.querySelectorAll('[data-img-up]').forEach(btn => { btn.onclick = () => moveImage(btn.dataset.imgUp, -1); });
    grid.querySelectorAll('[data-img-down]').forEach(btn => { btn.onclick = () => moveImage(btn.dataset.imgDown, 1); });
  } catch (err) {
    grid.innerHTML = `<p class="image-manager-empty">خطا: ${escapeHTML(err.message)}</p>`;
  }
}

async function renderReviewsManager(productId) {
  const box = document.getElementById('pmReviewsList');
  box.innerHTML = '<p class="image-manager-empty">در حال بارگذاری…</p>';
  try {
    const { product } = await ProductsAPI.get(productId);
    const reviews = product.reviews || [];
    box.innerHTML = reviews.length
      ? reviews.map(r => `
          <div class="admin-review-item">
            <div class="admin-review-head">
              <span>${r.user ? escapeHTML(r.user.name) : 'کاربر'}</span>
              <span class="rev-stars" style="color:var(--warn);">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span>
              <button class="btn small danger" data-review-del="${r.id}" style="margin-right:auto;">حذف نظر</button>
            </div>
            <div class="admin-review-text">${escapeHTML(r.comment)}</div>
          </div>
        `).join('')
      : '<p class="image-manager-empty">هنوز نظری برای این محصول ثبت نشده است.</p>';

    box.querySelectorAll('[data-review-del]').forEach(btn => {
      btn.onclick = async () => {
        if (!confirm('این نظر حذف شود؟')) return;
        try {
          await ReviewsAPI.remove(btn.dataset.reviewDel);
          await renderReviewsManager(productId);
        } catch (err) {
          alert(err.message);
        }
      };
    });
  } catch (err) {
    box.innerHTML = `<p class="image-manager-empty">خطا: ${escapeHTML(err.message)}</p>`;
  }
}

document.getElementById('pmImageFiles')?.addEventListener('change', async (e) => {
  const files = e.target.files;
  const errBox = document.getElementById('pmImageError');
  errBox.style.display = 'none';
  if (!files || files.length === 0) return;
  if (!editingProductId) { errBox.textContent = 'ابتدا اطلاعات محصول را ذخیره کنید.'; errBox.style.display = 'block'; e.target.value = ''; return; }
  if (files.length > 8) { errBox.textContent = 'حداکثر ۸ عکس در هر بار قابل آپلود است.'; errBox.style.display = 'block'; e.target.value = ''; return; }
  for (const file of files) {
    if (file.size > 2 * 1024 * 1024) { errBox.textContent = `فایل «${file.name}» بیشتر از ۲ مگابایت است.`; errBox.style.display = 'block'; e.target.value = ''; return; }
  }
  try {
    await ProductsAPI.uploadImages(editingProductId, files);
    e.target.value = '';
    await renderImageManager(editingProductId);
    await renderProductsTab();
  } catch (err) {
    errBox.textContent = err.message;
    errBox.style.display = 'block';
  }
});

initDashboard();


async function renderSupportTab(){
  const box=document.getElementById('tab-support'); if(!box)return; box.innerHTML='<p class="empty-note">در حال بارگذاری…</p>';
  try{const [{tickets},low]=await Promise.all([StoreFeaturesAPI.adminTickets(),StoreFeaturesAPI.adminLowStock()]);
    box.innerHTML=`<div class="dash-toolbar"><h2>پشتیبانی و هشدار موجودی</h2></div><div class="alert-box"><div class="alert-box-title">⚠️ کمبود موجودی</div>${(low.products||[]).length?low.products.map(p=>`<div class="alert-line">${escapeHTML(p.name)} — موجودی: <b>${p.stock}</b> / آستانه: ${p.lowStockThreshold}</div>`).join(''):'<div class="alert-line">همه محصولات در محدوده مناسب موجودی هستند.</div>'}</div><div style="margin-top:20px"><h3>تیکت‌ها</h3>${(tickets||[]).map(t=>`<div class="ds-card" style="padding:16px;margin:10px 0"><div><b>${escapeHTML(t.subject)}</b> — ${escapeHTML(t.status)} — اولویت ${escapeHTML(t.priority)}</div><div style="font-size:12px;color:var(--muted);margin:5px 0">${escapeHTML(t.name)} | ${escapeHTML(t.email)}</div><p>${escapeHTML(t.message)}</p>${t.adminReply?`<div><b>پاسخ فعلی:</b> ${escapeHTML(t.adminReply)}</div>`:''}<div style="display:flex;gap:8px;flex-wrap:wrap"><select data-ticket-status="${t.id}"><option value="OPEN">باز</option><option value="IN_PROGRESS">در حال بررسی</option><option value="ANSWERED">پاسخ داده شد</option><option value="CLOSED">بسته</option></select><select data-ticket-priority="${t.id}"><option value="LOW">کم</option><option value="NORMAL">عادی</option><option value="HIGH">بالا</option><option value="URGENT">فوری</option></select><input data-ticket-reply="${t.id}" class="ds-input" placeholder="پاسخ پشتیبانی" value="${escapeHTML(t.adminReply||'')}" style="flex:1;min-width:220px"><button class="btn" data-ticket-save="${t.id}">ذخیره</button></div></div>`).join('')||'<p>تیکتی وجود ندارد.</p>'}</div>`;
    (tickets||[]).forEach(t=>{const st=document.querySelector(`[data-ticket-status="${t.id}"]`);const pr=document.querySelector(`[data-ticket-priority="${t.id}"]`);const rp=document.querySelector(`[data-ticket-reply="${t.id}"]`); if(st)st.value=t.status;if(pr)pr.value=t.priority; document.querySelector(`[data-ticket-save="${t.id}"]`)?.addEventListener('click',async()=>{try{await StoreFeaturesAPI.updateTicket(t.id,{status:st.value,priority:pr.value,adminReply:rp.value});await renderSupportTab();}catch(e){alert(e.message)}});});
  }catch(e){box.innerHTML=`<p class="empty-note">خطا: ${escapeHTML(e.message)}</p>`}
}
