// ranking backup/frontend/js/login.js

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');

    // Removed theme application logic from here
    // as it's now handled by the inline script in login.html

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = loginForm.username.value;
        const password = loginForm.password.value;

        try {
            const data = await apiRequest('/auth/login', 'POST', { username, password });
            window.location.href = '/frontend/ranking.html';

        } catch (error) {
            // showToast already called within apiRequest
        }
    });
});