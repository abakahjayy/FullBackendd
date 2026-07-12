document.querySelector(".form").addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.querySelector(".email-input").value;
    const password = document.querySelector(".password-input").value;

    const response = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
    });

    const data = await response.json();
    console.log(data.userId);
    // if (response.ok) {
    //     alert("Login successful!");
    // } else {
    //     alert(data.error || "Something went wrong");
    // }
    if (data.token) {
        alert("Login successful!");
        localStorage.setItem(`token-${data.userId}`, data.token);
        localStorage.setItem(`userId`,data.userId)
        sessionStorage.setItem(`token-${data.userId}`, data.token);
        sessionStorage.setItem(`userId`,data.userId)
        window.location.href = `../dashboard/dashboard.html?oven=${data.token}&id=${data.userId}`;
    } else {
        alert(data.error || "No Token found");
    }

});
const navToggle = document.querySelector('.nav-toggle');
const navLinks = document.querySelector('.nav-links');

navToggle.addEventListener('click', () => {
    navLinks.classList.toggle('active');
    navToggle.classList.toggle('active');
});

