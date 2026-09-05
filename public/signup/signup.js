// const loginFormDOM = document.querySelector(".form");
// const firstNameInput = document.querySelector(".first-name-input");
// const lastNameInput = document.querySelector(".last-name-input");
// const userNameInput = document.querySelector(".user-name-input");
// const emailInput = document.querySelector(".email-input");
// const passwordInput = document.querySelector(".password-input");
// const testingBtn = document.querySelector(".testing-btn");
// const logoutBtn = document.querySelector(".logout-btn");

// loginFormDOM.addEventListener("submit", async (e) => {
//     e.preventDefault();
//     if (!emailInput.value || !passwordInput.value) return;
//     const email = emailInput.value;
//     const password = passwordInput.value;
//     const user = { email, password };
//     try {
//         const response = await fetch("/api/v1/auth/login", {
//             method: "POST",
//             headers: {
//                 "Content-type": "application/json",
//             },
//             body: JSON.stringify(user),
//         });

//         if (response.status === 200) {
//             emailInput.value = "";
//             passwordInput.value = "";
//         }
//     } catch (error) {
//         console.log(error);
//     }
// });

// testingBtn.addEventListener("click", async () => {
//     try {
//         const response = await fetch("/api/v1");
//     } catch (error) {
//         console.log(error);
//     }
// });
// logoutBtn.addEventListener("click", async () => {
//     try {
//         const response = await fetch("/api/v1/auth/logout");
//     } catch (error) {
//         console.log(error);
//     }
// });
//My own code here
const navToggle = document.querySelector('.nav-toggle');
const navLinks = document.querySelector('.nav-links');

navToggle.addEventListener('click', () => {
    navLinks.classList.toggle('active');
    navToggle.classList.toggle('active');
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
    if (response.ok) {
        alert("Signup successful!");
    } else {
        alert(data.error || "Something went wrong");
    }
    if (data.token) {
        localStorage.setItem(`token-${data.userId}`, data.token);
        localStorage.setItem(`userId`,data.userId)
        sessionStorage.setItem(`token-${data.userId}`, data.token);
        sessionStorage.setItem(`userId`,data.userId)
        window.location.href = `../dashboard/dashboard.html?oven=${data.token}&id=${data.userId}`;
    } else {
        alert(data.error || "No Token found");
    }
});

