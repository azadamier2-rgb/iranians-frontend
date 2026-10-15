/* ============================================================
   HomeShop — assets/js/auth.js
   ⚠️ فایل اضافه (جزو لیست اصلی نبود) — منطق صفحه‌ی login.html.
   ============================================================ */

document.getElementById('showRegister')?.addEventListener('click', () => {
  document.getElementById('loginBox').style.display = 'none';
  document.getElementById('registerBox').style.display = 'block';
});
document.getElementById('showLogin')?.addEventListener('click', () => {
  document.getElementById('registerBox').style.display = 'none';
  document.getElementById('loginBox').style.display = 'block';
});

function wirePasswordStrength(inputId, hintId) { const input=document.getElementById(inputId), hint=document.getElementById(hintId); if(!input||!hint)return; input.addEventListener('input',()=>{ const v=input.value; hint.textContent=!v?'':(v.length>=8&&/[A-Za-z]/.test(v)&&/[0-9]/.test(v)?'✅ رمز مناسب':'⚠️ حداقل ۸ کاراکتر، شامل حرف و عدد'); }); }
wirePasswordStrength('regPass','regPassHint');

document.getElementById('registerBtn')?.addEventListener('click', async (e) => {
  const errBox = document.getElementById('registerErr');
  const okBox = document.getElementById('registerOk');
  errBox.style.display = 'none';
  okBox.style.display = 'none';
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPass').value;
  const btn = document.getElementById('registerBtn');
  btn.disabled = true;
  try {
    await AuthAPI.register(name, email, password);
    okBox.style.display = 'block';
    document.getElementById('regName').value=''; document.getElementById('regEmail').value=''; document.getElementById('regPass').value='';
    setTimeout(() => document.getElementById('showLogin')?.click(), 1200);
  } catch (err) {
    errBox.textContent = err.message;
    errBox.style.display = 'block';
  } finally {
    btn.disabled = false;
  }
});

document.getElementById('loginBtn')?.addEventListener('click', async (e) => {
  const errBox = document.getElementById('loginErr');
  errBox.style.display = 'none';
  const email = document.getElementById('loginEmail').value.trim();
  const pass = document.getElementById('loginPass').value;
  const btn = document.getElementById('loginBtn');
  btn.disabled = true;
  try {
    const user = await AuthAPI.login(email, pass);
    window.location.href = user.role === 'ADMIN' ? 'admin.html' : 'index.html';
  } catch (err) {
    // Never clear the user's credentials on an ordinary authentication error.
    // The browser should show the actual API error (401/423/429/etc.).
    errBox.textContent = err?.message || 'ورود ناموفق بود. لطفاً ایمیل و رمز عبور را بررسی کنید.';
    errBox.style.display = 'block';
    document.getElementById('loginPass')?.focus();
  } finally {
    btn.disabled = false;
  }
});

/* ---------- Forgot password (forgot-password.html) ---------- */
document.getElementById('forgotForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const errBox = document.getElementById('forgotError');
  const okBox = document.getElementById('forgotSuccess');
  errBox.style.display = 'none';
  okBox.style.display = 'none';
  const email = document.getElementById('forgotEmail').value.trim();
  const btn = document.getElementById('forgotSubmitBtn');
  btn.disabled = true;
  try {
    const data = await AuthAPI.forgotPassword(email);
    okBox.textContent = data.message || 'اگر این ایمیل ثبت شده باشد، لینک بازیابی ارسال شد.';
    okBox.style.display = 'block';
    document.getElementById('forgotForm').reset();
  } catch (err) {
    errBox.textContent = err.message;
    errBox.style.display = 'block';
  } finally {
    btn.disabled = false;
  }
});

/* ---------- Reset password (reset-password.html) ---------- */
document.getElementById('resetForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const errBox = document.getElementById('resetError');
  const okBox = document.getElementById('resetSuccess');
  errBox.style.display = 'none';
  okBox.style.display = 'none';

  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  const email = params.get('email');
  if (!token || !email) {
    errBox.textContent = 'لینک بازیابی نامعتبر است. دوباره از صفحه‌ی «فراموشی رمز عبور» اقدام کن.';
    errBox.style.display = 'block';
    return;
  }

  const newPass = document.getElementById('resetNewPass').value;
  const confirmPass = document.getElementById('resetConfirmPass').value;
  if (newPass !== confirmPass) {
    errBox.textContent = 'تکرار رمز عبور مطابقت ندارد.';
    errBox.style.display = 'block';
    return;
  }

  const btn = document.getElementById('resetSubmitBtn');
  btn.disabled = true;
  try {
    const data = await AuthAPI.resetPassword(email, token, newPass);
    okBox.textContent = (data.message || 'رمز عبور با موفقیت تغییر یافت.') + ' در حال انتقال به صفحه ورود…';
    okBox.style.display = 'block';
    document.getElementById('resetForm').reset();
    setTimeout(() => { window.location.href = 'login.html'; }, 1800);
  } catch (err) {
    errBox.textContent = err.message;
    errBox.style.display = 'block';
  } finally {
    btn.disabled = false;
  }
});
