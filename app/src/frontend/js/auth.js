document.addEventListener('DOMContentLoaded', () => {
	const loginForm = document.getElementById('login-form')
	const signupForm = document.getElementById('signup-form')
	const loginError = document.getElementById('login-error')
	const signupError = document.getElementById('signup-error')

	const API_BASE = 'http://localhost:3000/api/auth'

	// Inform users on the sign-up form
	if (signupForm) {
		signupForm.addEventListener('submit', (e) => {
			e.preventDefault()
			signupError.textContent =
				'Registration is managed via pre-seeded accounts. Please use Log In with your PIN.'
			signupError.style.display = 'block'
		})
	}

	// Handle Login
	if (loginForm) {
		loginForm.addEventListener('submit', async (e) => {
			e.preventDefault()
			loginError.style.display = 'none'

			const email = document
				.getElementById('login-email')
				.value.trim()
			const pin = document
				.getElementById('login-password')
				.value.trim()

			try {
				const response = await fetch(
					`${API_BASE}/login`,
					{
						method: 'POST',
						headers: {
							'Content-Type':
								'application/json',
						},
						credentials: 'include',
						body: JSON.stringify({
							email,
							pin,
						}),
					}
				)

				const data = await response.json()

				if (response.ok) {
					alert(
						`Welcome back, ${data.user.name}! Returning to map...`
					)
					window.location.href = '../index.html'
				} else {
					loginError.textContent =
						data.error ||
						'Invalid credentials'
					loginError.style.display = 'block'
				}
			} catch (err) {
				loginError.textContent =
					'Server error. Please ensure backend is running.'
				loginError.style.display = 'block'
			}
		})
	}
})
