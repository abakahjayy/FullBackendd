const navToggle = document.querySelector('.nav-toggle');
const navLinks = document.querySelector('.nav-links');
const logins = document.querySelector('.logins');

navToggle.addEventListener('click', () => {
    navLinks.classList.toggle('active');
    navToggle.classList.toggle('active');
    logins?.classList.toggle('active');
});

// ---------------------------------------------------------------------
// If a valid session exists (same localStorage/sessionStorage keys that
// login.js/signup.js/dashboard.js use: userId + token-<userId>), swap the
// Log in / Get started buttons for the same profile chip shown on the
// dashboard instead - re-verified against the API on every load, not just
// trusted from storage, so a stale/expired token falls back to logged-out.
// ---------------------------------------------------------------------

const isRealPhoto = (url) => /^https?:\/\//i.test(url || '');

function renderLoggedOut() {
    if (!logins) return;
    logins.innerHTML = '';

    const loginLink = document.createElement('a');
    loginLink.href = '../login/login.html';
    loginLink.textContent = 'Log in';

    const signupLink = document.createElement('a');
    signupLink.href = '../signup/signup.html';
    const signupBtn = document.createElement('button');
    signupBtn.className = 'start';
    signupBtn.textContent = 'Get started';
    signupLink.appendChild(signupBtn);

    logins.append(loginLink, signupLink);
}

function clearSession(userId) {
    if (userId) {
        localStorage.removeItem(`token-${userId}`);
        sessionStorage.removeItem(`token-${userId}`);
    }
    localStorage.removeItem('userId');
    sessionStorage.removeItem('userId');
}

function renderLoggedIn(user) {
    if (!logins) return;
    logins.innerHTML = '';

    const profileLink = document.createElement('a');
    profileLink.href = '../dashboard/dashboard.html';
    profileLink.className = 'nav-profile-link';

    if (isRealPhoto(user.profile_picture)) {
        const img = document.createElement('img');
        img.src = user.profile_picture;
        img.alt = '';
        img.className = 'nav-avatar';
        profileLink.appendChild(img);
    } else {
        const fallback = document.createElement('span');
        fallback.className = 'nav-avatar nav-avatar-fallback';
        fallback.textContent = (user.firstName || user.username || '?').charAt(0).toUpperCase();
        profileLink.appendChild(fallback);
    }

    const nameSpan = document.createElement('span');
    nameSpan.className = 'nav-username';
    nameSpan.textContent = user.firstName || user.username || 'Account';
    profileLink.appendChild(nameSpan);

    const logoutBtn = document.createElement('button');
    logoutBtn.type = 'button';
    logoutBtn.className = 'nav-logout';
    logoutBtn.title = 'Log out';
    logoutBtn.setAttribute('aria-label', 'Log out');
    logoutBtn.innerHTML = '<i class="fas fa-arrow-right-from-bracket"></i>';
    logoutBtn.addEventListener('click', () => {
        clearSession(user._id);
        renderLoggedOut();
    });

    logins.append(profileLink, logoutBtn);
}

async function checkAuth() {
    const userId = localStorage.getItem('userId') || sessionStorage.getItem('userId');
    const token = userId
        ? (localStorage.getItem(`token-${userId}`) || sessionStorage.getItem(`token-${userId}`))
        : null;

    if (!token) {
        renderLoggedOut();
        return;
    }

    try {
        const res = await fetch('/api/v1/auth/dashboard', {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Session is no longer valid');
        const data = await res.json();
        renderLoggedIn(data.user);
    } catch {
        clearSession(userId);
        renderLoggedOut();
    }
}

checkAuth();
