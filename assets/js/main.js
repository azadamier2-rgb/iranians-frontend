/* ============================================================
   HomeShop — assets/js/main.js
   در انتهای <body> هر ۸ صفحه (بعد از storage.js و products.js) لود می‌شود.
   کارهای مشترک همه‌ی صفحات: هایلایت‌کردن لینک فعال در نوبار، آپدیت
   نشان تعداد سبد خرید، و نمایش وضعیت ورود در دکمه‌ی بالای صفحه.
   ============================================================ */

function updateCartBadge() {
  const badge = document.getElementById('cartCount');
  if (!badge) return;
  const count = CartStorage.load().reduce((s, l) => s + l.qty, 0);
  badge.textContent = count;
}

function highlightActiveNav() {
  const current = document.body.dataset.page;
  if (!current) return;
  document.querySelectorAll('#mainnav a').forEach(a => {
    a.classList.toggle('active', a.dataset.page === current);
  });
}

function updateHeaderForSession(user) {
  const loginBtn = document.getElementById('loginBtn');
  if (!loginBtn) return;
  if (user) {
    if (user.role === 'ADMIN') {
      loginBtn.textContent = '🛠️ پنل مدیریت';
      loginBtn.setAttribute('href', 'admin.html');
      loginBtn.onclick = null;
    } else {
      loginBtn.textContent = '👤 ' + user.name;
      loginBtn.setAttribute('href', '#');
      loginBtn.onclick = (e) => {
        e.preventDefault();
        if (confirm('از حساب خارج شوید؟')) {
          AuthAPI.logout().then(() => window.location.reload());
        }
      };
    }
  } else {
    loginBtn.textContent = 'ورود';
    loginBtn.setAttribute('href', 'login.html');
    loginBtn.onclick = null;
  }
}

/**
 * نشانگر ساده‌ی قدرت رمز عبور. زیر هر input رمز جدید یک نوار رنگی و
 * پیام راهنما نشان می‌دهد. این فقط یک کمک بصری است — اعتبارسنجی واقعی
 * و الزام‌آور همیشه سمت سرور (isPasswordStrongEnough در بک‌اند) انجام
 * می‌شود، چون کلاینت هرگز منبع اعتماد نیست.
 */
function wirePasswordStrength(inputId, hintId) {
  const input = document.getElementById(inputId);
  const hint = document.getElementById(hintId);
  if (!input || !hint) return;
  input.addEventListener('input', () => {
    const v = input.value;
    let score = 0;
    if (v.length >= 8) score++;
    if (v.length >= 12) score++;
    if (/[a-z]/.test(v) && /[A-Z]/.test(v)) score++;
    if (/[0-9]/.test(v)) score++;
    if (/[^A-Za-z0-9]/.test(v)) score++;

    if (v.length === 0) { hint.textContent = ''; return; }
    if (score <= 2) { hint.textContent = 'ضعیف — حداقل ۸ کاراکتر و ترکیبی از حرف و عدد لازم است.'; hint.style.color = 'var(--danger)'; }
    else if (score <= 3) { hint.textContent = 'متوسط — بهتر است حرف بزرگ/کوچک و نماد هم اضافه کنید.'; hint.style.color = 'var(--warn)'; }
    else { hint.textContent = 'قوی ✓'; hint.style.color = 'var(--ok)'; }
  });
}

function wireContactForm() {
  const form = document.getElementById('contactForm');
  if (!form) return;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    document.getElementById('contactSuccess').style.display = 'block';
    form.reset();
  });
}

(async function initCommon() {
  highlightActiveNav();
  updateCartBadge();
  wireContactForm();
  const user = await restoreSession();
  updateHeaderForSession(user);
})();
