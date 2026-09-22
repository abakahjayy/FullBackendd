const navToggle = document.querySelector('.nav-toggle');
const navLinks = document.querySelector('.nav-links');

navToggle.addEventListener('click', () => {
    navLinks.classList.toggle('active');
    navToggle.classList.toggle('active');
});

// Sends the user to Google, telling the backend to send them back to this
// site's own dashboard afterwards (see utils/oauthRedirect.js server-side -
// any redirect_uri whose host is on ALLOWED_REDIRECT_DOMAINS is accepted).
document.querySelector('.google-login').addEventListener('click', () => {
    const redirectUri = `${window.location.origin}/dashboard/dashboard.html`;
    window.location.href = `/api/v1/auth/google?redirect_uri=${encodeURIComponent(redirectUri)}`;
});

document.querySelector(".form").addEventListener("submit", async (event) => {
    event.preventDefault();

    const firstName = document.querySelector(".first-name-input").value;
    const lastName = document.querySelector(".last-name-input").value;
    const username = document.querySelector(".user-name-input").value;
    const email = document.querySelector(".email-input").value;
    const password = document.querySelector(".password-input").value;

    const response = await fetch("/api/v1/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, username, email, password }),
    });

    const data = await response.json();
    if (!response.ok) {
        alert(data.error || data.msg || "Something went wrong");
        return;
    }
    if (data.token) {
        localStorage.setItem(`token-${data.userId}`, data.token);
        localStorage.setItem(`userId`, data.userId);
        sessionStorage.setItem(`token-${data.userId}`, data.token);
        sessionStorage.setItem(`userId`, data.userId);
        window.location.href = `../dashboard/dashboard.html?oven=${data.token}&id=${data.userId}`;
    } else {
        alert(data.error || "No Token found");
    }
});
