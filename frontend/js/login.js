// ranking backup/frontend/js/login.js

document.addEventListener('DOMContentLoaded', () => {
    // Importa funções auxiliares do api.js (assumindo que api.js é carregado antes no HTML)
    // const { apiRequest, showToast } = window; // Exemplo para modules

    const loginForm = document.getElementById('login-form');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = loginForm.username.value;
        const password = loginForm.password.value;

        try {
            // apiRequest já inclui o tratamento de erro e showToast
            const data = await apiRequest('/auth/login', 'POST', { username, password });

            // Se o login for bem-sucedido, redireciona para o painel principal
            window.location.href = '/frontend/ranking.html'; // Ajustado caminho

        } catch (error) {
            // showToast já é chamado dentro de apiRequest
        }
    });
});