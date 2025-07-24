// ranking backup/frontend/js/api.js

// --- CONSTANTES ---
// A API_URL deve apontar para o Flask, que irá proxy para o Node.js
const API_URL = '/api'; 
const CAST_API_URL = '/api/cast'; 
const imagePlaceholder = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2QxZDVmYiI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTAgM2MxLjY2IDAgMyAxLjM0IDMgM3MtMS4zNCAzLTMgMy0zLTEuMzQtMy0zIDEuMzQtMyAzLTN6bTAgMTRjLTIuNjcgMC01LTEuMjktNi42Ny0zLjIyLjgxLTEuMzEgMi42OC0yLjI4IDQuNjctMi4yOCAxLjk5IDAgMy44Ni45NyA0LjY3IDIuMjgtMS42NyAxLjkzLTMuOTkgMy4yMi02LjY3IDMuMjJ6Ii8+PC9zdmc+';

// --- FUNÇÕES AUXILIARES GLOBAIS ---

/**
 * Realiza uma requisição HTTP para a API.
 * @param {string} endpoint - O caminho da API (ex: '/vendedores').
 * @param {string} method - O método HTTP (GET, POST, PUT, DELETE).
 * @param {object|null} body - O corpo da requisição para POST/PUT.
 * @returns {Promise<object|null>} Os dados da resposta ou null para 204.
 * @throws {Error} Se a requisição não for bem-sucedida.
 */
const apiRequest = async (endpoint, method = 'GET', body = null) => {
    try {
        const options = { method, headers: { 'Content-Type': 'application/json' }};
        if (body) { options.body = JSON.stringify(body); }
        const response = await fetch(`${API_URL}${endpoint}`, options);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: response.statusText }));
            throw new Error(errorData.message || 'Erro na comunicação com o servidor.');
        }
        if (response.status === 204) { return null; }
        return response.json();
    } catch (error) {
        // showToast já é chamado na função principal para erros de API
        console.error(`API Error on ${method} ${endpoint}:`, error);
        throw error; // Propaga o erro para ser tratado pelo handler específico da página
    }
};

/**
 * Converte um objeto File em uma Data URL (Base64).
 * @param {File} file - O arquivo a ser convertido.
 * @returns {Promise<string>} A Data URL Base64 do arquivo.
 */
const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
});

/**
 * Exibe uma mensagem de toast na tela.
 * @param {string} message - A mensagem a ser exibida.
 * @param {boolean} isError - Se true, exibe o toast como erro (vermelho).
 */
const showToast = (message, isError = false) => {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');
    toastMessage.textContent = message;
    toast.className = 'fixed bottom-5 right-5 py-3 px-5 rounded-lg shadow-xl transform transition-all duration-300 z-50';
    toast.classList.remove('bg-gray-900', 'text-white', 'bg-red-600', 'text-gray-900', 'text-gray-100'); // Adicione mais classes se notar que outras cores estão sendo aplicadas
toast.classList.add('opacity-100', 'translate-y-0');

if (isError) {
    toast.classList.add('bg-red-600', 'text-white'); // Cor de fundo vermelha e texto branco para erros
} else {
    if (document.documentElement.classList.contains('dark')) {
        toast.classList.add('bg-gray-800', 'text-gray-100'); // Use as classes do dark mode se ele estiver ativo
    } else {
        toast.classList.add('bg-white', 'text-gray-800'); // Use as classes do light mode se ele estiver ativo
    }
}
    setTimeout(() => {
        toast.classList.remove('opacity-100', 'translate-y-0');
        toast.classList.add('opacity-0', 'translate-y-20');
    }, 3000);
};

/**
 * Abre um modal.
 * @param {HTMLElement} modalElement - O elemento modal a ser aberto.
 */
const openModal = (modalElement) => modalElement.classList.remove('hidden');

/**
 * Fecha um modal.
 * @param {HTMLElement} modalElement - O elemento modal a ser fechado.
 */
const closeModal = (modalElement) => modalElement.classList.add('hidden');