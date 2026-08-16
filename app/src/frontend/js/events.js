const AUTH_API = '/api/auth';

const elLoginView  = document.getElementById('login-view');
const elLoginForm  = document.getElementById('login-form');
const elLoginError = document.getElementById('login-error');
const elContent    = document.getElementById('events-content');
const elUserBadge  = document.getElementById('user-badge');
const btnLogout    = document.getElementById('btn-logout');

const elLoading    = document.getElementById('loading');
const elEmpty      = document.getElementById('empty');
const elError      = document.getElementById('error');
const elEventList  = document.getElementById('event-list');

const f = id => document.getElementById(id);

btnLogout.addEventListener('click', async () => {
  await fetch(`${AUTH_API}/logout`, { method: 'POST', credentials: 'include' });
  elContent.classList.add('hidden');
  elUserBadge.style.display = 'none';
  btnLogout.style.display = 'none';
  elLoginView.classList.remove('hidden');
});

elLoginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  elLoginError.classList.add('hidden');

  const email = f('login-email').value.trim();
  const pin   = f('login-pin').value;

  if (!email || !pin) {
    elLoginError.textContent = 'Email and PIN are required.';
    elLoginError.classList.remove('hidden');
    return;
  }

  f('btn-login').disabled = true;
  f('btn-login').textContent = 'Signing in…';

  try {
    const res = await fetch(`${AUTH_API}/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, pin }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');

    elLoginView.classList.add('hidden');
    f('login-pin').value = '';
    checkAccess();

  } catch (err) {
    elLoginError.textContent = err.message;
    elLoginError.classList.remove('hidden');
  } finally {
    f('btn-login').disabled = false;
    f('btn-login').textContent = 'Sign in';
  }
});

async function checkAccess() {
  try {
    const res = await fetch(`${AUTH_API}/me`, { credentials: 'include' });
    if (!res.ok) throw new Error('Not authenticated');
    const user = await res.json();

    elUserBadge.textContent = user.name;
    elUserBadge.style.display = '';
    btnLogout.style.display = '';
    elContent.classList.remove('hidden');
    loadEvents();

  } catch {
    elLoginView.classList.remove('hidden');
  }
}

async function loadEvents() {
  elLoading.classList.remove('hidden');
  elEmpty.classList.add('hidden');
  elError.classList.add('hidden');
  elEventList.innerHTML = '';

  try {
    const res  = await fetch(API_BASE, { credentials: 'include' });
    if (!res.ok) throw new Error(`Server responded with ${res.status}`);
    const data = await res.json();

    elLoading.classList.add('hidden');

    if (!data.length) {
      elEmpty.classList.remove('hidden');
      return;
    }

    data.forEach(ev => elEventList.appendChild(buildPlayerCard(ev)));

  } catch (err) {
    elLoading.classList.add('hidden');
    elError.textContent = `Could not load events — ${err.message}`;
    elError.classList.remove('hidden');
  }
}

function buildPlayerCard(ev) {
  const li = document.createElement('li');
  li.className = 'event-card';
  li.style.gridTemplateColumns = '1fr';
  li.innerHTML = `<div class="event-card-body">${buildCardBody(ev)}</div>`;
  return li;
}

checkAccess();
