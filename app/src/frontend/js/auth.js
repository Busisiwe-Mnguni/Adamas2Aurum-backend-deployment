import { API_BASE } from './constants.js'

// ── Helpers ───────────────────────────────────────────────────
function showError(elId, msg) {
  const el = document.getElementById(elId)
  if (!el) return
  el.textContent = msg
  el.classList.add('show')
}

function hideError(elId) {
  const el = document.getElementById(elId)
  if (el) el.classList.remove('show')
}

function setBtn(id, disabled, text) {
  const btn = document.getElementById(id)
  if (!btn) return
  btn.disabled = disabled
  btn.textContent = text
}

async function redirectBasedOnRole() {
  try {
    const res = await fetch(`${API_BASE}/api/auth/me`, { credentials: 'include' })
    if (!res.ok) throw new Error()
    const user = await res.json()
    const isAdmin = (user.roles || []).some(r =>
      ['SUPER_ADMIN', 'EVENT_AUTHOR', 'CARD_AUTHOR'].includes(r)
    )
    if (isAdmin) {
      window.location.href = '../pages/console.html'
    } else {
      const params = new URLSearchParams(window.location.search)
      const redirect = params.get('redirect') || '../pages/events.html'
      window.location.href = redirect
    }
  } catch {
    window.location.href = '../pages/events.html'
  }
}

// ── Tab switching ────────────────────────────────────────────
document.querySelectorAll('.auth-tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.auth-tab').forEach((b) => b.classList.remove('active'))
    document.querySelectorAll('.auth-panel').forEach((p) => p.classList.remove('active'))
    btn.classList.add('active')
    document.getElementById('panel-' + btn.dataset.panel).classList.add('active')
    hideError('login-error')
    hideError('register-error')
  })
})

// ── Google OAuth ─────────────────────────────────────────────
// Manual redirect — no client library needed. Better-auth handles the rest.
const callbackURL = `${window.location.origin}/pages/events.html`
const googleAuthURL = `${API_BASE}/api/auth/signin/social?provider=google&callbackURL=${encodeURIComponent(callbackURL)}`

document.getElementById('btn-google-signin')?.addEventListener('click', () => {
  window.location.href = googleAuthURL
})

document.getElementById('btn-google-signup')?.addEventListener('click', () => {
  window.location.href = googleAuthURL
})

// ── Username + PIN Sign In ───────────────────────────────────
const loginForm = document.getElementById('login-form')
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault()
    hideError('login-error')

    const username = document.getElementById('login-username').value.trim()
    const pin = document.getElementById('login-pin').value

    if (!username || !pin) {
      showError('login-error', 'Username and PIN are required.')
      return
    }

    setBtn('btn-login', true, 'Signing in…')

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, pin }),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Login failed')
      }

      await redirectBasedOnRole()
    } catch (err) {
      showError('login-error', err.message)
      setBtn('btn-login', false, 'Sign In')
    }
  })
}

// ── Username + PIN Sign Up ─────────────────────────────────
const registerForm = document.getElementById('register-form')
if (registerForm) {
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault()
    hideError('register-error')

    const name = document.getElementById('reg-name').value.trim()
    const username = document.getElementById('reg-username').value.trim()
    const pin = document.getElementById('reg-pin').value
    const confirm = document.getElementById('reg-confirm').value

    if (!name || !username || !pin || !confirm) {
      showError('register-error', 'All fields are required.')
      return
    }
    if (pin !== confirm) {
      showError('register-error', 'PINs do not match.')
      return
    }

    setBtn('btn-register', true, 'Creating account…')

    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, username, pin }),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Registration failed')
      }

      await redirectBasedOnRole()
    } catch (err) {
      showError('register-error', err.message)
      setBtn('btn-register', false, 'Create Account')
    }
  })
}

// ── If already logged in, redirect ─────────────────────────────
(async () => {
  try {
    const res = await fetch(`${API_BASE}/api/auth/me`, { credentials: 'include' })
    if (res.ok) {
      await redirectBasedOnRole()
    }
  } catch {
    // not logged in, stay on auth page
  }
})()
