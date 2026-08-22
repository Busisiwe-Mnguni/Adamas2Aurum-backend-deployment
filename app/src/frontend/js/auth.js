/**
 * Adamas2Aurum - Authentication Client Logic (Vanilla JavaScript)
 *
 * Handles Sign Up, Log In, Forgot Password, and Delete Account
 * using Better Auth's built-in client APIs. No custom auth logic.
 */

const authClient = window.authClient;

// Where to redirect after successful auth.
// On dev this is the map (index.html). Update this path if the map moves.
const MAP_URL = "/";

// ---------------------------------------------------------------------------
// Utility: show status message
// ---------------------------------------------------------------------------
function showStatus(message, isError) {
  const statusEl = document.getElementById("status");
  statusEl.className = isError ? "status error" : "status";
  statusEl.textContent = message;
}

// ===========================================================================
// GOOGLE OAUTH
// ===========================================================================

/**
 * Google Sign Up — redirects to Google OAuth consent screen.
 * Better Auth creates the account automatically on first sign-in.
 */
window.handleGoogleSignUp = async function () {
  showStatus("Redirecting to Google…", false);

  const { error } = await authClient.signIn.social({
    provider: "google",
    callbackURL: MAP_URL,
    newUserCallbackURL: MAP_URL,
    errorCallbackURL: "/",
  });

  if (error) {
    showStatus("Sign up failed: " + error.message, true);
  }
};

/**
 * Google Log In — redirects to Google OAuth consent screen.
 * Existing users are signed in; new users are also created.
 */
window.handleGoogleLogin = async function () {
  showStatus("Redirecting to Google…", false);

  const { error } = await authClient.signIn.social({
    provider: "google",
    callbackURL: MAP_URL,
    errorCallbackURL: "/",
  });

  if (error) {
    showStatus("Log in failed: " + error.message, true);
  }
};

// ===========================================================================
// EMAIL / PASSWORD
// ===========================================================================

/**
 * Email/Password Sign Up — creates a new account with name, email, password.
 * All hashing and storage handled by Better Auth (scrypt).
 */
window.handleEmailSignUp = async function (event) {
  event.preventDefault();

  const name = document.getElementById("signup-name").value.trim();
  const email = document.getElementById("signup-email").value.trim();
  const password = document.getElementById("signup-password").value;

  showStatus("Creating account…", false);

  const { data, error } = await authClient.signUp.email({
    name,
    email,
    password,
    callbackURL: MAP_URL,
  });

  if (error) {
    showStatus("Sign up failed: " + error.message, true);
  } else {
    showStatus("Account created! Redirecting…", false);
    window.location.href = MAP_URL;
  }
};

/**
 * Email/Password Log In — signs in with email and password.
 */
window.handleEmailLogin = async function (event) {
  event.preventDefault();

  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;

  showStatus("Signing in…", false);

  const { data, error } = await authClient.signIn.email({
    email,
    password,
    callbackURL: MAP_URL,
  });

  if (error) {
    showStatus("Log in failed: " + error.message, true);
  } else {
    showStatus("Signed in! Redirecting…", false);
    window.location.href = MAP_URL;
  }
};

// ===========================================================================
// FORGOT PASSWORD
// ===========================================================================

/**
 * Forgot Password — prompts for email and sends a reset link.
 * The reset URL is logged to the server console (no SMTP configured).
 */
window.handleForgotPassword = async function (event) {
  event.preventDefault();

  const email = prompt("Enter your email address to receive a password reset link:");
  if (!email) return;

  showStatus("Sending reset link…", false);

  const { data, error } = await authClient.requestPasswordReset({
    email,
    redirectTo: window.location.origin + "/reset-password.html",
  });

  if (error) {
    showStatus("Reset request failed: " + error.message, true);
  } else {
    showStatus(
      "If an account exists with that email, a reset link has been sent. " +
      "Check the server console for the reset URL.",
      false
    );
  }
};
