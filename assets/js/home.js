/* HomeShop — real API catalog for the artistic homepage. */
'use strict';
const CATEGORY_MAP = {
  all: null,
  fridge: 'یخچال و فریزر',
  washer: 'لباسشویی',
  ac: 'گرمایشی و سرمایشی',
  oven: 'آشپزخانه',
  vacuum: 'نظافت',
  tv: 'تلویزیون',
  kitchen: 'آشپزخانه',
};
let homeCategory = 'all';
let homeItems = [];

function renderHomeProducts(items) {
  const grid = document.getElementById('productsGrid');
  if (!grid) return;
  grid.innerHTML = items.length ? items.slice(0, 8).map(p => {
    const cover = coverImage(p);
    return `<article class="pcard">
      <a href="product.html?id=${encodeURIComponent(p.id)}" aria-label="مشاهده ${escapeHTML(p.name)}">
        <div class="pcard-img">${cover ? `<img src="${escapeHTML(cover)}" alt="${escapeHTML(p.name)}" loading="lazy">` : `<div style="height:100%;display:flex;align-items:center;justify-content:center;font-size:48px">${CATEGORY_ICONS[p.category] || '📦'}</div>`}</div>
      </a>
      <div class="pcard-info">
        <div class="pcard-brand">${escapeHTML(p.category || 'لوازم خانگی')}</div>
        <div class="pcard-name">${escapeHTML(p.name)}</div>
        <div class="pcard-footer">
          <div><div class="pcard-price">${fmt(p.price)}</div>${p.stock < 5 ? `<div class="pcard-old">${p.stock ? `${p.stock} عدد باقی مانده` : 'ناموجود'}</div>` : ''}</div>
          <button type="button" class="pcard-add" data-home-add="${escapeHTML(p.id)}" ${p.stock === 0 ? 'disabled' : ''} aria-label="افزودن ${escapeHTML(p.name)}">+</button>
        </div>
      </div>
    </article>`;
  }).join('') : '<p class="empty-note">محصولی برای نمایش یافت نشد.</p>';
  grid.querySelectorAll('[data-home-add]').forEach(btn => btn.addEventListener('click', () => {
    const product = homeItems.find(p => p.id === btn.dataset.homeAdd);
    if (!product || product.stock < 1) return;
    const cart = CartStorage.load();
    const line = cart.find(x => x.productId === product.id);
    if (line) line.qty = Math.min(product.stock, line.qty + 1);
    else cart.push({ productId: product.id, qty: 1 });
    CartStorage.save(cart); updateCartBadge();
    btn.textContent = '✓'; setTimeout(() => { btn.textContent = '+'; }, 900);
  }));
}

async function loadHomeProducts() {
  const category = CATEGORY_MAP[homeCategory];
  try {
    const result = await ProductsAPI.list({ category: category || undefined, sort: 'newest', page: 1, pageSize: 8 });
    homeItems = result.items || [];
    renderHomeProducts(homeItems);
  } catch (err) {
    const grid = document.getElementById('productsGrid');
    if (grid) grid.innerHTML = `<p class="empty-note">خطا در دریافت محصولات: ${escapeHTML(err.message)}</p>`;
  }
}

document.querySelectorAll('.cat-pill').forEach(pill => pill.addEventListener('click', () => {
  document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
  pill.classList.add('active');
  homeCategory = pill.dataset.cat || 'all';
  loadHomeProducts();
}));

document.querySelector('.products-more')?.addEventListener('click', e => {
  e.preventDefault();
  document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' });
});

loadHomeProducts();
