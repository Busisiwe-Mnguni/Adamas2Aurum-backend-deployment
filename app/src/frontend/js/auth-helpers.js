/**
 * Shared auth utilities used across the frontend.
 *
 * This keeps the admin-role check and post-login redirect in one place so
 * every page behaves the same way after a successful login.
 */

export const ADMIN_ROLES = ["SUPER_ADMIN", "EVENT_AUTHOR", "CARD_AUTHOR"];

export function isAdmin(user) {
    return (user?.roles || []).some((role) => ADMIN_ROLES.includes(role));
}

/**
 * Redirect the user to the right landing page after authentication.
 * Admins/authors go to the console; everyone else goes to the player
 * dashboard (events list).
 */
export function redirectAfterLogin(user) {
    if (isAdmin(user)) {
        window.location.href = "/pages/console.html";
    } else {
        window.location.href = "/pages/events.html";
    }
}

/**
 * Update the shared header to reflect the current auth state.
 * Shows the user's name, logout button, and (for admins) Console link when
 * logged in; shows Sign In when logged out.
 */
export function updateAuthNav(user) {
    const badge = document.getElementById("user-badge");
    const btnLogout = document.getElementById("btn-logout");
    const btnSignin = document.getElementById("btn-signin");
    const navConsole = document.getElementById("nav-console");
    const playerLinks = ["nav-events", "nav-collection", "nav-battle"].map(
        (id) => document.getElementById(id),
    );

    if (user) {
        if (badge) {
            badge.textContent = user.name;
            badge.classList.remove("hidden");
        }
        if (btnLogout) btnLogout.classList.remove("hidden");
        if (btnSignin) btnSignin.classList.add("hidden");

        if (isAdmin(user)) {
            playerLinks.forEach((el) => el?.classList.add("hidden"));
            if (navConsole) navConsole.classList.remove("hidden");
        } else {
            playerLinks.forEach((el) => el?.classList.remove("hidden"));
            if (navConsole) navConsole.classList.add("hidden");
        }
    } else {
        if (badge) badge.classList.add("hidden");
        if (btnLogout) btnLogout.classList.add("hidden");
        if (btnSignin) btnSignin.classList.remove("hidden");
        playerLinks.forEach((el) => el?.classList.add("hidden"));
        if (navConsole) navConsole.classList.add("hidden");
    }
}
