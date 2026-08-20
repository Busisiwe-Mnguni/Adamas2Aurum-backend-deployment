document.addEventListener('DOMContentLoaded', () => {
  const signupForm = document.getElementById('signup-form');
  const loginForm = document.getElementById('login-form');
  const signupError = document.getElementById('signup-error');
  const loginError = document.getElementById('login-error');

  const API_BASE = 'http://localhost:3000/api/auth';

  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      signupError.style.display = 'none';

      const name = document.getElementById('signup-name').value;
      const email = document.getElementById('signup-email').value;
      const password = document.getElementById('signup-password').value;

      try {
        const response = await fetch(`${API_BASE}/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password }),
        });

        const data = await response.json();

        if (response.ok) {
          alert('Account created successfully! Returning to map...');
          window.location.href = '/';
        } else {
          signupError.textContent = data.message || 'Registration failed';
          signupError.style.display = 'block';
        }
      } catch (err) {
        signupError.textContent = 'Server connection error. Please try again later.';
        signupError.style.display = 'block';
      }
    });
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      loginError.style.display = 'none';

      const email = document.getElementById('login-email').value;
      const password = document.getElementById('login-password').value;

      try {
        const response = await fetch(`${API_BASE}/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        const data = await response.json();

        if (response.ok) {
          alert('Login successful! Returning to map...');
          window.location.href = '/';
        } else {
          loginError.textContent = data.message || 'Invalid credentials';
          loginError.style.display = 'block';
        }
      } catch (err) {
        loginError.textContent = 'Server connection error. Please try again later.';
        loginError.style.display = 'block';
      }
    });
  }
});