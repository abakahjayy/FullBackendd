const navToggle = document.querySelector('.nav-toggle');
const navLinks = document.querySelector('.nav-links');
const logins = document.querySelector('.logins');

navToggle.addEventListener('click', () => {
    navLinks.classList.toggle('active');
    navToggle.classList.toggle('active');
    logins?.classList.toggle('active');
});
