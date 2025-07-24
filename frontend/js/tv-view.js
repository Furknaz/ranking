// ranking backup/frontend/js/tv-view.js

document.addEventListener('DOMContentLoaded', () => {
    // Importa funções auxiliares do api.js (assumindo que api.js é carregado antes no HTML)
    // const { apiRequest } = window; // apiRequest não é usado diretamente aqui, mas as constantes sim.

    const API_URL = '/api'; // Este é o URL do Node.js backend para dados.
    const SOCKET_URL = 'http://localhost:3000'; // Este URL aponta para o servidor Node.js diretamente para WebSockets
    
    const podiumSection = document.getElementById('podium-section');
    const podium1Card = document.getElementById('podium-1-card');
    const podium2Card = document.getElementById('podium-2-card');
    const podium3Card = document.getElementById('podium-3-card');
    const rankingList = document.getElementById('ranking-list');
    const emptyState = document.getElementById('empty-state');
    // imagePlaceholder é globalmente disponível via api.js
    // const imagePlaceholder = 'data:image/svg+xml;base64,...'; 

    let lastTotalSales = 0; // Para o confete

    // Listener para mudanças de tema no localStorage (sincronização com a página admin)
    window.addEventListener('storage', (event) => {
        if (event.key === 'theme') {
            if (event.newValue === 'dark') {
                document.documentElement.classList.add('dark');
                document.documentElement.classList.remove('light');
            } else {
                document.documentElement.classList.remove('dark');
                document.documentElement.classList.add('light');
            }
        }
    });

    const formatCurrency = (value) => {
        return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    const launchConfetti = () => {
        confetti({
            particleCount: 150,
            spread: 90,
            origin: { y: 0.6 }
        });
    };

    const renderRanking = (sellers) => {
        podium1Card.innerHTML = '';
        podium2Card.innerHTML = '';
        podium3Card.innerHTML = '';
        rankingList.innerHTML = '';

        if (!sellers || sellers.length === 0) {
            emptyState.classList.remove('hidden');
            podiumSection.classList.add('hidden');
            rankingList.classList.add('hidden');
            return;
        }

        emptyState.classList.add('hidden');
        podiumSection.classList.remove('hidden');
        rankingList.classList.remove('hidden');

        const currentTotalSales = sellers.reduce((sum, seller) => sum + seller.totalSales, 0);

        if (currentTotalSales > lastTotalSales && lastTotalSales !== 0) {
            launchConfetti();
        }
        lastTotalSales = currentTotalSales;

        sellers.slice(0, 3).forEach((seller, index) => {
            const rank = index + 1;
            let card;
            let heightClass;
            let medal;

            if (rank === 1) {
                card = podium1Card;
                heightClass = 'min-h-[300px]';
                medal = '🥇';
            } else if (rank === 2) {
                card = podium2Card;
                heightClass = 'min-h-[250px]';
                medal = '🥈';
            } else {
                card = podium3Card;
                heightClass = 'min-h-[200px]';
                medal = '🥉';
            }

            card.className = "podium-card bg-gray-800 p-6 rounded-t-2xl text-center h-full shadow-2xl podium-" + rank + " " + heightClass;
            card.innerHTML = `
                <div class="flex flex-col justify-center items-center h-full">
                    <div class="text-6xl">${medal}</div>
                    <img src="${seller.image || imagePlaceholder}" alt="${seller.name}" class="w-24 h-24 lg:w-32 lg:h-32 object-cover rounded-full my-4 border-4 border-gray-600">
                    <h2 class="text-4xl lg:text-5xl font-bold uppercase text-white">${seller.name}</h2>
                    <p class="text-4xl lg:text-6xl font-semibold text-yellow-400">${formatCurrency(seller.totalSales)}</p>
                </div>
            `;
        });

        sellers.slice(3).forEach((seller, index) => {
            const rank = index + 4;
            const listItem = document.createElement('div');
            listItem.className = 'rank-item bg-gray-800 rounded-lg p-4 flex items-center justify-between shadow-lg';
            listItem.style.animationDelay = `${index * 0.1}s`;
            listItem.innerHTML = `
                <div class="flex items-center">
                    <span class="text-4xl font-bold text-gray-500 w-12">${rank}</span>
                    <img src="${seller.image || imagePlaceholder}" alt="${seller.name}" class="w-12 h-12 object-cover rounded-full mx-4">
                    <span class="text-4xl font-semibold uppercase">${seller.name}</span>
                </div>
                <span class="text-4xl font-bold text-green-400">${formatCurrency(seller.totalSales)}</span>
            `;
            rankingList.appendChild(listItem);
        });
    };

    const fetchData = async () => {
        try {
            // A chamada agora usa o URL direto para o Node.js, pois o Flask não proxy o ranking para a TV View
            const response = await fetch(`${API_URL}/ranking`); 
            if (!response.ok) {
                throw new Error('Falha ao buscar dados da API');
            }
            const sellers = await response.json();
            renderRanking(sellers);
        } catch (error) {
            console.error(error);
            emptyState.classList.remove('hidden');
            podiumSection.classList.add('hidden');
            rankingList.classList.add('hidden');
        }
    };

    // Conexão direta com o servidor Socket.IO do Node.js
    const socket = io(SOCKET_URL, { path: '/socket.io/' }); 

    socket.on('connect', () => {
        console.log('✅ Conectado ao servidor de atualizações em tempo real!');
    });

    socket.on('update', () => {
        console.log('🔄 Recebida notificação de atualização. Buscando novos dados...');
        fetchData();
    });

    socket.on('disconnect', () => {
        console.log('❌ Desconectado do servidor de atualizações.');
    });
    
    fetchData();
});