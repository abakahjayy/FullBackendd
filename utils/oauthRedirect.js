// Shared helpers so any frontend app can drive Google OAuth against this
// single backend and land back on its own domain, without each app having
// to be pre-registered anywhere.
//
// ALLOWED_REDIRECT_DOMAINS (.env) is a comma-separated allowlist checked
// against the hostname of any app-supplied redirect_uri, e.g.:
//   ALLOWED_REDIRECT_DOMAINS=localhost,127.0.0.1,.openlabs.app,myotherapp.com
// An entry starting with "." matches that domain and any subdomain of it.
// This exists purely to stop /auth/google?redirect_uri=https://evil.com
// from being used to steal a login token via open redirect - it is not a
// per-app registration step, any host on the list works automatically.
// Exact hostnames only by default (no wildcard like ".onrender.com") -
// that's a shared hosting domain anyone can get a free subdomain on, so
// wildcarding it here would let any of them receive a stolen login token
// via this route's redirect_uri. Add each real frontend hostname you
// control to ALLOWED_REDIRECT_DOMAINS instead.
const getAllowedDomains = () =>
    (process.env.ALLOWED_REDIRECT_DOMAINS || 'localhost,127.0.0.1')
        .split(',')
        .map((domain) => domain.trim())
        .filter(Boolean);

const isAllowedRedirectUri = (redirectUri) => {
    if (!redirectUri) return false;

    let parsed;
    try {
        parsed = new URL(redirectUri);
    } catch {
        return false;
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) return false;

    return getAllowedDomains().some((domain) => {
        if (domain.startsWith('.')) {
            const suffix = domain.slice(1);
            return parsed.hostname === suffix || parsed.hostname.endsWith(domain);
        }
        return parsed.hostname === domain;
    });
};

const appendQueryParam = (url, key, value) => {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}${key}=${encodeURIComponent(value)}`;
};

// The OAuth "state" param round-trips through Google untouched, so we use
// it to carry the requesting app's redirect_uri across the /google ->
// /google/callback hop.
const encodeOAuthState = (payload) =>
    Buffer.from(JSON.stringify(payload)).toString('base64url');

const decodeOAuthState = (state) => {
    if (!state) return null;
    try {
        return JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
    } catch {
        return null;
    }
};

module.exports = {
    isAllowedRedirectUri,
    appendQueryParam,
    encodeOAuthState,
    decodeOAuthState,
};
