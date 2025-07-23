// ranking backup/frontend/js/register.js

document.addEventListener('DOMContentLoaded', () => {
    // Importa funções auxiliares do api.js (assumindo que api.js é carregado antes no HTML)
    // const { apiRequest, showToast } = window; // Exemplo para modules

    const registerForm = document.getElementById('register-form');

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = registerForm.username.value;
        const password = registerForm.password.value;
        const confirmPassword = registerForm['confirm-password'].value;
        
        // O toast agora é controlado pela função global showToast
        // toast.classList.add('hidden'); // Isso não é mais necessário aqui

        if (password !== confirmPassword) {
            showToast('As senhas não coincidem.', true); // Usa a função global showToast
            return;
        }

        try {
            // apiRequest já inclui o tratamento de erro e showToast
            await apiRequest('/auth/register', 'POST', { username, password });

            alert('Conta criada com sucesso! Você será redirecionado para a página de login.');
            window.location.href = '/frontend/login.html'; // Ajustado caminho

        } catch (error) {
            // showToast já é chamado dentro de apiRequest
        }
    });
});