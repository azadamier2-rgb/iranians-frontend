'use strict';
const productId = new URLSearchParams(location.search).get('id');
let currentProduct = null;
let qty = 1;

async function loadProduct() {
  const errorBox = document.getElementById('productDesc');
  if (!productId) { if (errorBox) errorBox.textContent = 'شناسه محصول یافت نشد.'; return; }
  try {
    const { product } = await ProductsAPI.get(productId);
    currentProduct = product;
    qty = Math.min(1, product.stock);
    renderProduct(product);
  loadRelatedProducts(product.id);
  rememberRecentlyViewed(product);
  } catch (err) {
    if (errorBox) errorBox.textContent = `محصول یافت نشد: ${err.message}`;
  }
}
function renderProduct(p) {
  document.title = `${p.name} | HomeShop`;
  document.getElementById('productName').textContent = p.name || '';
  document.getElementById('productCategory').textContent = p.category || '';
  const brandEl=document.getElementById('productBrand'); if(brandEl) brandEl.textContent=p.brand||'';
  document.getElementById('productDesc').textContent = p.description || '';
  document.getElementById('fullDesc').textContent = p.description || '';
  document.getElementById('productPrice').textContent = fmt(p.price);
  document.getElementById('stockBadge').textContent = p.stock > 0 ? `${p.stock} عدد موجود` : 'ناموجود';
  document.getElementById('qtyVal').textContent = String(Math.max(1, qty));
  document.getElementById('addToCart').disabled = p.stock <= 0;
  const rb=document.getElementById('restockBox'); if(rb) rb.style.display=p.stock<=0?'block':'none';
  document.getElementById('buyNow').disabled = p.stock <= 0;
  const reviews = p.reviews || [];
  const avg = reviews.length ? reviews.reduce((s,r)=>s+Number(r.rating||0),0)/reviews.length : 0;
  document.getElementById('productRating').textContent = avg ? `${'★'.repeat(Math.round(avg))}${'☆'.repeat(5-Math.round(avg))}` : '☆☆☆☆☆';
  document.getElementById('productReviewCount').textContent = reviews.length ? `(${reviews.length} نظر)` : '(بدون نظر)';
  const specs=[['برند',p.brand],['مدل',p.model],['کد کالا',p.sku],['گارانتی',p.warranty],...Object.entries(p.specifications||{})]; document.getElementById('specsList').innerHTML = specs.filter(([,v])=>v!==null&&v!==undefined&&String(v).trim()!=='').map(([k,v])=>`<div class="ds-flex ds-gap-16" style="justify-content:space-between;gap:20px;padding:8px 0;border-bottom:1px solid var(--line)"><span>${escapeHTML(String(k))}</span><b>${escapeHTML(String(v))}</b></div>`).join('') || `<div>دسته‌بندی: ${escapeHTML(p.category||'')} · موجودی: ${p.stock}</div>`;
  const main = document.getElementById('mainImg'), thumbs = document.getElementById('thumbsRow');
  const images = p.images || [];
  if (images.length) {
    main.src = imgUrl(images[0].url); main.alt = p.name || '';
    thumbs.innerHTML = images.map((im,i)=>`<button type="button" class="product-thumb" data-i="${i}"><img src="${imgUrl(im.url)}" alt=""></button>`).join('');
    thumbs.querySelectorAll('[data-i]').forEach(b=>b.onclick=()=>{ main.src=imgUrl(images[Number(b.dataset.i)].url); });
  } else { main.removeAttribute('src'); thumbs.innerHTML=''; }
  document.getElementById('reviewsList').innerHTML = reviews.length ? reviews.map(r=>`<div class="ds-card" style="padding:12px;margin-bottom:8px"><b>${escapeHTML(r.user?.name||'کاربر')}</b><div>${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</div><p>${escapeHTML(r.comment||'')}</p></div>`).join('') : '<p>هنوز نظری ثبت نشده است.</p>';
}
function addCurrentToCart(goCheckout=false) {
  if (!currentProduct || currentProduct.stock <= 0) return;
  const cart = CartStorage.load(); const line = cart.find(x=>x.productId===currentProduct.id);
  if (line) line.qty=Math.min(currentProduct.stock,line.qty+qty); else cart.push({productId:currentProduct.id,qty});
  CartStorage.save(cart); updateCartBadge();
  if (goCheckout) location.href='checkout.html';
}
document.getElementById('qtyMinus')?.addEventListener('click',()=>{qty=Math.max(1,qty-1);document.getElementById('qtyVal').textContent=qty;});
document.getElementById('qtyPlus')?.addEventListener('click',()=>{if(currentProduct)qty=Math.min(currentProduct.stock,qty+1);document.getElementById('qtyVal').textContent=qty;});
document.getElementById('addToCart')?.addEventListener('click',()=>addCurrentToCart(false));
document.getElementById('buyNow')?.addEventListener('click',()=>addCurrentToCart(true));
document.getElementById('restockBtn')?.addEventListener('click',async()=>{const email=document.getElementById('restockEmail').value.trim();const msg=document.getElementById('restockMsg');try{await StoreFeaturesAPI.restockAlert(productId,email);msg.textContent='اعلان با موفقیت ثبت شد ✓';}catch(e){msg.textContent=e.message;}});
loadProduct();

async function loadRelatedProducts(id){
  const box=document.getElementById('relatedProducts'); if(!box)return;
  try{const {products}=await StoreFeaturesAPI.relatedProducts(id);box.innerHTML=products.map(p=>`<a class="ds-card" style="text-decoration:none;padding:12px" href="product.html?id=${encodeURIComponent(p.id)}"><strong>${escapeHTML(p.name)}</strong><div>${fmt(p.price)} تومان</div></a>`).join('') || '<p>محصول مرتبطی پیدا نشد.</p>';}catch{box.innerHTML='';}
}
function rememberRecentlyViewed(p){try{const key='homeshop_recent_products_v1';const old=JSON.parse(localStorage.getItem(key)||'[]').filter(x=>x&&x.id&&x.id!==p.id);old.unshift({id:p.id,name:p.name,price:p.price});localStorage.setItem(key,JSON.stringify(old.slice(0,10)));}catch{}}
