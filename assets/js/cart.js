/* ============================================================
   HomeShop — assets/js/cart.js
   فقط در cart.html لود می‌شود.
   ============================================================ */

let cartLines = []; // [{ productId, qty, product }]

async function loadCart() {
  const raw = CartStorage.load();
  if (raw.length === 0) { cartLines = []; renderCart(); return; }

  try {
    const products = await Promise.all(raw.map(l => ProductsAPI.get(l.productId).then(d => d.product).catch(() => null)));
    cartLines = raw
      .map((l, i) => ({ productId: l.productId, qty: l.qty, product: products[i] }))
      .filter(l => l.product && l.product.stock > 0); // حذف محصولات حذف‌شده/ناموجود

    // اگر موجودی واقعی کمتر از تعداد درخواستی سبد شده باشد، کاهشش بده
    cartLines.forEach(l => { l.qty = Math.min(l.qty, l.product.stock); });
    saveCartLinesToStorage();
  } catch {
    cartLines = [];
  }
  renderCart();
}

function saveCartLinesToStorage() {
  CartStorage.save(cartLines.map(l => ({ productId: l.productId, qty: l.qty })));
  updateCartBadge();
}

function cartTotal() {
  return cartLines.reduce((s, l) => s + l.product.price * l.qty, 0);
}

function renderCart() {
  const listBox = document.getElementById('cartItems');
  const summaryBox = document.querySelector('.ds-cart-summary');
  const emptyBox = document.getElementById('cartEmpty');
  const fullBox = document.getElementById('cartFull');

  if (cartLines.length === 0) {
    if (fullBox) fullBox.style.display = 'none';
    if (emptyBox) emptyBox.style.display = 'block';
    return;
  }
  if (fullBox) fullBox.style.display = 'grid';
  if (emptyBox) emptyBox.style.display = 'none';

  listBox.innerHTML = cartLines.map(l => {
    const cover = coverImage(l.product);
    return `
    <div class="cart-line">
      <div class="ic">${cover ? `<img src="${cover}" alt="">` : categoryIcon(l.product.category)}</div>
      <div class="info">
        <h4>${escapeHTML(l.product.name)}</h4>
        <div class="p">${fmt(l.product.price)} × ${l.qty}</div>
        <div class="qty-box" style="margin-top:6px;">
          <button data-dec="${l.productId}">−</button>
          <span>${l.qty}</span>
          <button data-inc="${l.productId}">+</button>
          <button data-rm="${l.productId}" style="margin-right:auto; color:var(--danger);">حذف</button>
        </div>
      </div>
      <div class="line-total">${fmt(l.product.price * l.qty)}</div>
    </div>`;
  }).join('');

  document.getElementById('subtotal').textContent = fmt(cartTotal());
  document.getElementById('total').textContent = fmt(cartTotal());

  listBox.querySelectorAll('[data-inc]').forEach(b => b.onclick = () => changeQty(b.dataset.inc, 1));
  listBox.querySelectorAll('[data-dec]').forEach(b => b.onclick = () => changeQty(b.dataset.dec, -1));
  listBox.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => removeLine(b.dataset.rm));
}

function changeQty(productId, delta) {
  const line = cartLines.find(l => l.productId === productId);
  if (!line) return;
  line.qty = Math.max(1, Math.min(line.product.stock, line.qty + delta));
  saveCartLinesToStorage();
  renderCart();
}
function removeLine(productId) {
  cartLines = cartLines.filter(l => l.productId !== productId);
  saveCartLinesToStorage();
  renderCart();
}

loadCart();
