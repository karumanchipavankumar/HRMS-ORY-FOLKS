const hostname = window.location.hostname;
const BASE_URL = (hostname === 'localhost' || hostname === '127.0.0.1')
    ? "http://localhost:8080"
    : "";

/**
 * Decode a JWT and report whether it is expired.
 * Returns true ONLY when we can confirm expiry (has a numeric `exp` in the past).
 * If the token is missing, malformed, or has no `exp`, we return false so we never
 * force-logout a user we can't positively prove is expired.
 */
export function isTokenExpired(token) {
    if (!token) return false;
    try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        if (!payload || typeof payload.exp !== "number") return false;
        return Date.now() >= payload.exp * 1000;
    } catch (e) {
        return false;
    }
}

/**
 * Global session-expiry handler. Clears every place auth state can live and
 * redirects to the login page with a reason flag. Runs at most once per page
 * lifetime so concurrent failing requests don't fight over the redirect.
 */
let loggingOut = false;
export function forceLogout(reason = "session_expired") {
    if (loggingOut) return;
    loggingOut = true;
    try {
        localStorage.clear();
        sessionStorage.clear();
        // Keep a flag too (survives the same-tab reload) so the login page can
        // show the expiry message even without reading the query param.
        sessionStorage.setItem("sessionExpired", "1");
        document.cookie.split(";").forEach((c) => {
            const name = c.split("=")[0].trim();
            if (name) {
                document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
            }
        });
    } catch (e) {
        /* ignore storage errors */
    }
    if (!window.location.pathname.includes("/login")) {
        window.location.replace(`/login?reason=${reason}`);
    }
}

const api = async (endpoint, options = {}) => {
    const token = localStorage.getItem("token");

    // Auth screens keep their own error handling (e.g. a wrong-password 401 must
    // show "Invalid username or password", not force a redirect loop). We never
    // auto-logout from these.
    const onAuthScreen = ["/login", "/forgot-password"].some((p) =>
        window.location.pathname.startsWith(p)
    );

    const headers = {
        ...options.headers,
    };

    if (!(options.body instanceof FormData)) {
        headers["Content-Type"] = "application/json";
    }

    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const config = {
        ...options,
        headers,
    };

    // If it's a relative path, prepend BASE_URL
    const url = endpoint.startsWith("http") ? endpoint : `${BASE_URL}${endpoint}`;

    let response;
    try {
        response = await fetch(url, config);
    } catch (err) {
        // Network error / server unreachable. On an authenticated screen this means
        // the session can no longer be used — log out and redirect to login instead
        // of letting the caller surface a "Failed to connect to server" message.
        if (!onAuthScreen) {
            forceLogout("session_expired");
            // Halt the caller's promise chain so no error UI flashes before redirect.
            return new Promise(() => {});
        }
        throw err;
    }

    // Token expired (401) or forbidden (403) → the session is over. Clear all auth
    // state and redirect to login; do not bubble the error up to the dashboard.
    if (!onAuthScreen && (response.status === 401 || response.status === 403)) {
        forceLogout("session_expired");
        return new Promise(() => {});
    }

    return response;
};

export default api;
