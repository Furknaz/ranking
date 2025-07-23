// ranking backup/frontend/js/ranking.js

document.addEventListener('DOMContentLoaded', () => {
    // Importa funções auxiliares do api.js (assumindo que api.js é carregado antes no HTML)
    // No ambiente do navegador, essas funções estarão disponíveis globalmente se api.js for um script normal.
    // const { apiRequest, fileToBase64, showToast, openModal, closeModal } = window; // Exemplo para modules, mas não necessário aqui.

    // --- ELEMENTOS DO DOM ---
    const addSellerForm = document.getElementById('add-seller-form');
    const rankingTableBody = document.getElementById('ranking-table-body');
    const emptyState = document.getElementById('empty-state');
    const saleSellerSelect = document.getElementById('sale-seller');
    const editModal = document.getElementById('edit-modal');
    const deleteModal = document.getElementById('delete-modal');
    const salesDetailModal = document.getElementById('sales-detail-modal');
    const editSaleValueModal = document.getElementById('edit-sale-value-modal');
    const addSaleForm = document.getElementById('add-sale-form');
    const editSellerForm = document.getElementById('edit-seller-form');
    const editSaleValueForm = document.getElementById('edit-sale-value-form');
    const castModal = document.getElementById('cast-modal');
    const openCastModalButton = document.getElementById('open-cast-modal-button');
    const cancelCastButton = document.getElementById('cancel-cast-button');
    const confirmCastButton = document.getElementById('confirm-cast-button');
    const castDeviceListContainer = document.getElementById('cast-device-list-container');
    const castLoadingState = document.getElementById('cast-loading-state');
    const castEmptyState = document.getElementById('cast-empty-state');
    const filtersContainer = document.getElementById('filters');
    const logoutButton = document.getElementById('logout-button');
    const logoutConfirmModal = document.getElementById('logout-confirm-modal');
    const confirmLogoutButton = document.getElementById('confirm-logout-button');
    const openTvViewButton = document.getElementById('open-tv-view-button');
    const profileButton = document.getElementById('profile-button');
    const themeToggleBtn = document.getElementById('theme-toggle');
    const exportConfirmModal = document.getElementById('export-confirm-modal');
    const confirmExportButton = document.getElementById('confirm-export-button');
    const exportRankingButton = document.getElementById('export-ranking-button');
    const profileUsernameText = document.getElementById('profile-username-text'); // Para correção

    // --- VARIÁVEIS DE ESTADO ---
    let sellers = [];
    let itemToDelete = { id: null, type: null, sellerId: null };
    let currentSellerForDetails = null;
    let currentPeriod = 'all'; // Período de filtro inicial para o ranking
    let lastTotalSales = 0; // Para o confete no tv-view, mas pode ser útil aqui para outras lógicas

    // --- INÍCIO DA CORREÇÃO: VERIFICAÇÃO DE AUTENTICAÇÃO AO CARREGAR A PÁGINA (DevRank AI) ---
    // A lógica de verificação de autenticação é movida para dentro do DOMContentLoaded
    // para garantir que os elementos do DOM estejam prontos antes de serem acessados.
    (async () => {
        try {
            const response = await fetch('/api/auth/status', {
                cache: 'no-store' 
            });
            
            if (!response.ok) { 
                window.location.replace('/frontend/login.html'); // Ajustado caminho
                return;
            }

            const data = await response.json();
            if (!data.isLoggedIn) {
                window.location.replace('/frontend/login.html'); // Ajustado caminho
            } else {
                if (profileUsernameText && data.user && data.user.username) {
                    profileUsernameText.textContent = data.user.username;
                }
            }
        } catch (error) {
            console.error('Falha ao verificar status de autenticação:', error);
            window.location.replace('/frontend/login.html'); // Ajustado caminho
        }
    })();
    // --- FIM DA CORREÇÃO ---

    // --- LÓGICA DE CASTING ---
    const openCastModal = async () => {
        openModal(castModal); // Usa a função global openModal
        castLoadingState.classList.remove('hidden');
        castEmptyState.classList.add('hidden');
        castDeviceListContainer.innerHTML = '';
        confirmCastButton.disabled = true;

        try {
            // CAST_API_URL é definida em api.js
            const response = await fetch(`${CAST_API_URL}/devices`); 
            if (!response.ok) throw new Error('Falha ao buscar dispositivos. O servidor de casting está rodando?');
            const devices = await response.json();

            castLoadingState.classList.add('hidden');

            if (devices.length === 0) {
                castEmptyState.classList.remove('hidden');
            } else {
                devices.forEach(device => {
                    const deviceElement = document.createElement('label');
                    deviceElement.className = 'flex items-center p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer';
                    deviceElement.innerHTML = `
                        <input type="checkbox" value="${device.uuid}" class="form-checkbox h-5 w-5 text-indigo-600 rounded focus:ring-indigo-500">
                        <span class="ml-3 text-lg dark:text-gray-300">${device.name}</span>
                    `;
                    castDeviceListContainer.appendChild(deviceElement);
                });
                confirmCastButton.disabled = false;
            }
        } catch (error) {
            console.error('Erro ao buscar dispositivos de cast:', error);
            castLoadingState.classList.add('hidden');
            castEmptyState.classList.remove('hidden');
            showToast(error.message, true); // Usa a função global showToast
        }
    };

    const closeCastModal = () => {
        closeModal(castModal); // Usa a função global closeModal
    };

    const handleConfirmCast = async () => {
        const selectedCheckboxes = castDeviceListContainer.querySelectorAll('input[type="checkbox"]:checked');
        const selectedDeviceUUIDs = Array.from(selectedCheckboxes).map(cb => cb.value);

        if (selectedDeviceUUIDs.length === 0) {
            showToast('Selecione pelo menos um dispositivo.', true); // Usa a função global showToast
            return;
        }

        try {
            // CAST_API_URL é definida em api.js
            const response = await fetch(`${CAST_API_URL}/connect`, { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ devices: selectedDeviceUUIDs }),
            });

            const result = await response.json();
            if (response.ok) {
                showToast('Comando de transmissão enviado com sucesso!'); // Usa a função global showToast
            } else {
                throw new Error(result.message || 'Falha ao enviar comando.');
            }
        } catch (error) {
            console.error('Erro ao transmitir:', error);
            showToast(error.message, true); // Usa a função global showToast
        } finally {
            closeCastModal();
        }
    };

    // --- LÓGICA DE FILTROS ---
    const fetchRanking = async (period = 'all') => {
        try {
            const sellerList = await apiRequest(`/ranking?period=${period}`); // Usa a função global apiRequest
            renderRanking(sellerList);
            updateActiveFilterButton(period);
        } catch (error) {
            renderRanking([]);
            // showToast já é chamado dentro de apiRequest, não precisa chamar aqui novamente
        }
    };

    const updateActiveFilterButton = (activePeriod) => {
        const buttons = filtersContainer.querySelectorAll('.filter-btn');
        buttons.forEach(button => {
            if (button.dataset.period === activePeriod) {
                button.classList.remove('bg-gray-200', 'dark:bg-gray-700', 'text-gray-800', 'dark:text-gray-200');
                button.classList.add('bg-indigo-600', 'text-white');
            } else {
                button.classList.remove('bg-indigo-600', 'text-white');
                button.classList.add('bg-gray-200', 'dark:bg-gray-700', 'text-gray-800', 'dark:text-gray-200');
            }
        });
    };

    // --- LÓGICA DE RENDERIZAÇÃO ---
    const populateSellersSelect = () => {
        const currentSelection = saleSellerSelect.value;
        saleSellerSelect.innerHTML = '<option value="">Selecione um vendedor</option>';
        sellers.forEach(seller => {
            const option = document.createElement('option');
            option.value = seller.id;
            option.textContent = seller.name;
            saleSellerSelect.appendChild(option);
        });
        saleSellerSelect.value = currentSelection;
    };

    const updateRanksInDOM = () => {
        const rows = rankingTableBody.querySelectorAll('tr');
        rows.forEach((row, index) => {
            const rank = index + 1;
            let medal = '';
            if (rank === 1) medal = '🥇';
            else if (rank === 2) medal = '🥈';
            else if (rank === 3) medal = '🥉';
            
            const rankCell = row.querySelector('td:first-child div');
            if (rankCell) {
                rankCell.innerHTML = `${rank} ${medal}`;
            }
        });
    };

    const renderRanking = (sellerList) => {
        sellers = sellerList.sort((a, b) => b.totalSales - a.totalSales);
        rankingTableBody.innerHTML = ''; 

        if (sellers.length === 0) {
            emptyState.classList.remove('hidden');
            rankingTableBody.parentElement.parentElement.classList.add('hidden');
        } else {
            emptyState.classList.add('hidden');
            rankingTableBody.parentElement.parentElement.classList.remove('hidden');
            sellers.forEach((seller, index) => {
                const rank = index + 1;
                let medal = '';
                if (rank === 1) medal = '🥇';
                if (rank === 2) medal = '🥈';
                if (rank === 3) medal = '🥉';
                const row = document.createElement('tr');
                row.className = 'fade-in';
                row.dataset.sellerId = seller.id;
                row.innerHTML = `
                    <td class="px-6 py-4"><div class="text-lg font-bold">${rank} ${medal}</div></td>
                    <td class="px-6 py-4"><div class="flex items-center"><img src="${seller.image || imagePlaceholder}" alt="${seller.name}" class="seller-image"><span class="font-medium">${seller.name}</span></div></td>
                    <td class="px-6 py-4 font-semibold">${seller.totalSales.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    <td class="px-6 py-4 text-right">
                        <button data-id="${seller.id}" class="view-sales-btn text-blue-600 hover:text-blue-900 dark:text-blue-400 p-1" title="Ver Vendas">Vendas</button>
                        <button data-id="${seller.id}" class="edit-btn text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 p-1 ml-2" title="Editar">Editar</button>
                        <button data-id="${seller.id}" class="delete-btn text-red-600 hover:text-red-900 dark:text-red-400 p-1 ml-2" title="Excluir">Excluir</button>
                    </td>`;
                rankingTableBody.appendChild(row);
            });
        }
        populateSellersSelect();
    };

    const renderSellerSales = (sales) => {
        const tableBody = document.getElementById('sales-detail-table-body');
        tableBody.innerHTML = '';
        if (sales.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="3" class="text-center py-4 text-gray-500">Nenhuma venda registrada.</td></tr>`;
            return;
        }
        sales.sort((a,b) => new Date(b.date) - new Date(a.date)).forEach(sale => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="px-6 py-4">${new Date(sale.date).toLocaleString('pt-BR')}</td>
                <td class="px-6 py-4 font-medium">${sale.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                <td class="px-6 py-4 text-right">
                    <button data-id="${sale.id}" data-seller-id="${sale.sellerId}" class="edit-sale-btn text-indigo-600 hover:text-indigo-900 p-1">Editar</button>
                    <button data-id="${sale.id}" data-seller-id="${sale.sellerId}" class="delete-sale-btn text-red-600 hover:text-red-900 p-1 ml-2">Excluir</button>
                </td>`;
            tableBody.appendChild(row);
        });
    };

    // --- LÓGICA DOS MODALS ---
    const openEditSellerModal = (sellerId) => {
        const seller = sellers.find(s => s.id === sellerId);
        if (seller) {
            document.getElementById('edit-seller-id').value = seller.id;
            document.getElementById('edit-seller-name').value = seller.name;
            document.getElementById('edit-seller-img-preview').src = seller.image || imagePlaceholder;
            document.getElementById('edit-seller-original-image').value = seller.image || '';
            document.getElementById('edit-seller-image-upload').value = '';
            openModal(editModal); // Usa a função global openModal
        }
    };

    const openDeleteModal = (id, type, sellerId = null) => {
        itemToDelete = { id, type, sellerId };
        const modalText = document.getElementById('delete-modal-text');
        if (type === 'seller') {
            const seller = sellers.find(s => s.id === id);
            modalText.textContent = seller ? `Deseja excluir "${seller.name}"? Todas as suas vendas também serão removidas.` : 'Deseja excluir este vendedor?';
        } else {
            modalText.textContent = `Deseja excluir esta venda? Esta ação não pode ser desfeita.`;
        }
        openModal(deleteModal); // Usa a função global openModal
    };

    // --- MANIPULADORES DE EVENTOS (HANDLERS) ---
    const handleAddSeller = async (e) => { 
        e.preventDefault(); 
        const name = document.getElementById('seller-name').value.trim(); 
        const imageFile = document.getElementById('seller-image-upload').files[0]; 
        if (!name) return showToast('O nome é obrigatório.', true); // Usa a função global showToast
        let imageBase64 = null; 
        if (imageFile) imageBase64 = await fileToBase64(imageFile); // Usa a função global fileToBase64
        try { 
            await apiRequest('/vendedores', 'POST', { name, image: imageBase64 }); // Usa a função global apiRequest
            showToast('Vendedor cadastrado!'); // Usa a função global showToast
            addSellerForm.reset(); 
            init(); 
        } catch (error) {
            // showToast já é chamado dentro de apiRequest
        } 
    };
    
    const handleAddSale = async (e) => { 
        e.preventDefault(); 
        const sellerId = parseInt(document.getElementById('sale-seller').value, 10); 
        const saleValueInput = document.getElementById('sale-value').value; 
        const value = parseFloat(saleValueInput.replace(/\./g, '').replace(',', '.')); 
        if (!sellerId || !value || value <= 0) { 
            return showToast('Preencha os campos corretamente.', true); // Usa a função global showToast
        } 
        try { 
            await apiRequest('/vendas', 'POST', { sellerId, value }); // Usa a função global apiRequest
            showToast('Venda registrada com sucesso!'); // Usa a função global showToast
            addSaleForm.reset(); 
            await fetchRanking(currentPeriod);
        } catch (error) {
            // showToast já é chamado dentro de apiRequest
        } 
    };

    const handleEditSeller = async (e) => { 
        e.preventDefault(); 
        const id = parseInt(document.getElementById('edit-seller-id').value, 10); 
        const name = document.getElementById('edit-seller-name').value.trim(); 
        const imageFile = document.getElementById('edit-seller-image-upload').files[0]; 
        let image = document.getElementById('edit-seller-original-image').value; 
        if (imageFile) { 
            image = await fileToBase64(imageFile); // Usa a função global fileToBase64
        } 
        try { 
            await apiRequest(`/vendedores/${id}`, 'PUT', { name, image }); // Usa a função global apiRequest
            showToast('Vendedor atualizado!'); // Usa a função global showToast
            closeModal(editModal); // Usa a função global closeModal
            init(); 
        } catch(error) {
            // showToast já é chamado dentro de apiRequest
        } 
    };
    
    const handleConfirmDelete = async () => {
        const { id, type, sellerId } = itemToDelete;
        closeModal(deleteModal); // Usa a função global closeModal

        if (type === 'seller') {
            const rowToDelete = rankingTableBody.querySelector(`tr[data-seller-id="${id}"]`);
            if (rowToDelete) rowToDelete.classList.add('fade-out-row');
            try {
                await apiRequest(`/vendedores/${id}`, 'DELETE'); // Usa a função global apiRequest
                setTimeout(() => {
                    if (rowToDelete) rowToDelete.remove();
                    sellers = sellers.filter(s => s.id !== id);
                    updateRanksInDOM();
                    populateSellersSelect();
                    showToast('Vendedor excluído com sucesso!'); // Usa a função global showToast
                    if (sellers.length === 0) {
                       emptyState.classList.remove('hidden');
                       rankingTableBody.parentElement.parentElement.classList.add('hidden');
                    }
                }, 400);
            } catch (error) {
                if (rowToDelete) rowToDelete.classList.remove('fade-out-row');
                // showToast já é chamado dentro de apiRequest
            }
        } else if (type === 'sale') {
            try {
                await apiRequest(`/vendas/${id}`, 'DELETE'); // Usa a função global apiRequest
                showToast('Venda excluída.'); // Usa a função global showToast
                if (salesDetailModal.classList.contains('hidden') === false && currentSellerForDetails === sellerId) {
                   const sales = await apiRequest(`/vendedores/${sellerId}/vendas`); // Usa a função global apiRequest
                   renderSellerSales(sales);
                }
                init();
            } catch (error) {
                // showToast já é chamado dentro de apiRequest
            }
        }
    };

    const handleEditSaleValue = async (e) => { 
        e.preventDefault(); 
        const id = parseInt(document.getElementById('edit-sale-value-id').value, 10); 
        const newSaleValueInput = document.getElementById('new-sale-value').value; 
        const value = parseFloat(newSaleValueInput.replace(/\./g, '').replace(',', '.')); 
        if (!id || !value || value <= 0) return showToast('Valor inválido.', true); // Usa a função global showToast
        try { 
            await apiRequest(`/vendas/${id}`, 'PUT', { value }); // Usa a função global apiRequest
            showToast('Venda atualizada!'); // Usa a função global showToast
            closeModal(editSaleValueModal); // Usa a função global closeModal
            if (currentSellerForDetails) { 
                const sales = await apiRequest(`/vendedores/${currentSellerForDetails}/vendas`); // Usa a função global apiRequest
                renderSellerSales(sales); 
            } 
            init(); 
        } catch(error) {
            // showToast já é chamado dentro de apiRequest
        } 
    };
    
    // --- LÓGICA DE LOGOUT COM MODAL CUSTOMIZADO ---
    const cancelLogoutButtons = document.querySelectorAll('.btn-cancel-logout');

    // --- LÓGICA DE EXPORTAÇÃO ---
    const cancelExportButtons_export = document.querySelectorAll('.btn-cancel-export');

    const executeExportRanking = async () => {
        try {
            // INÍCIO DA CORREÇÃO JOTAMAKER AI: Alteração do endpoint de exportação para XLSX
            const response = await fetch(`${API_URL}/ranking/export-xlsx?period=${currentPeriod}`); // Usa a constante global API_URL
            // FIM DA CORREÇÃO JOTAMAKER AI
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: response.statusText }));
                throw new Error(errorData.message || 'Falha ao exportar o ranking.');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            // INÍCIO DA CORREÇÃO JOTAMAKER AI: Alteração da extensão do arquivo para XLSX
            const filename = `ranking_vendas_${currentPeriod}.xlsx`;
            // FIM DA CORREÇÃO JOTAMAKER AI
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            showToast('Ranking exportado com sucesso!'); // Usa a função global showToast

        } catch (error) {
            console.error('Erro ao exportar ranking:', error);
            showToast(error.message, true); // Usa a função global showToast
        } finally {
            closeModal(exportConfirmModal); // Usa a função global closeModal
        }
    };
    
    // --- TEMA E SINCRONIZAÇÃO ---
    const syncThemeIcons = () => { 
        const isDark = document.documentElement.classList.contains('dark'); 
        document.getElementById('theme-toggle-dark-icon').classList.toggle('hidden', isDark); 
        document.getElementById('theme-toggle-light-icon').classList.toggle('hidden', !isDark); 
    };

    // --- NAVEGAÇÃO ---

    // --- INICIALIZAÇÃO ---
    const init = async () => {
        await fetchRanking(currentPeriod);
    };

    // --- ADICIONA OS EVENT LISTENERS ---
    addSellerForm.addEventListener('submit', handleAddSeller);
    addSaleForm.addEventListener('submit', handleAddSale);
    editSellerForm.addEventListener('submit', handleEditSeller);
    editSaleValueForm.addEventListener('submit', handleEditSaleValue);
    document.getElementById('confirm-delete').addEventListener('click', handleConfirmDelete);
    
    openCastModalButton.addEventListener('click', openCastModal);
    cancelCastButton.addEventListener('click', closeCastModal);
    confirmCastButton.addEventListener('click', handleConfirmCast);

    filtersContainer.addEventListener('click', (e) => {
        const button = e.target.closest('.filter-btn');
        if (button) {
            const period = button.dataset.period;
            if (period !== currentPeriod) {
                currentPeriod = period;
                fetchRanking(period);
            }
        }
    });

    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            openModal(logoutConfirmModal); // Usa a função global openModal
        });
    }

    cancelLogoutButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            closeModal(logoutConfirmModal); // Usa a função global closeModal
        });
    });
    
    if (confirmLogoutButton) {
        confirmLogoutButton.addEventListener('click', async () => {
            closeModal(logoutConfirmModal); // Usa a função global closeModal
            localStorage.setItem('logout_event', Date.now()); // Sinal para o tv-view
            try {
                // Requisição direta para o proxy Flask
                const response = await fetch('/api/auth/logout', { method: 'POST' }); 
                if (response.ok) {
                    window.location.replace('/frontend/login.html'); // Ajustado caminho
                } else {
                    const data = await response.json();
                    showToast(data.message || 'Falha ao tentar sair.', true); // Usa a função global showToast
                }
            } catch (error) {
                console.error('Erro no logout:', error);
                showToast('Erro de conexão ao tentar sair.', true); // Usa a função global showToast
            }
        });
    }
    
    rankingTableBody.addEventListener('click', async (e) => { 
        const button = e.target.closest('button'); 
        if (!button) return; 
        const id = parseInt(button.dataset.id, 10); 
        if (button.classList.contains('edit-btn')) openEditSellerModal(id); 
        if (button.classList.contains('delete-btn')) openDeleteModal(id, 'seller'); 
        if (button.classList.contains('view-sales-btn')) { 
            const seller = sellers.find(s => s.id === id); 
            document.getElementById('sales-detail-seller-name').textContent = `Vendas de ${seller.name}`; 
            currentSellerForDetails = id; 
            try { 
                const sales = await apiRequest(`/vendedores/${id}/vendas`); // Usa a função global apiRequest
                renderSellerSales(sales); 
                openModal(salesDetailModal); // Usa a função global openModal
            } catch(error) {
                // showToast já é chamado dentro de apiRequest
            } 
        } 
    });
    
    document.getElementById('sales-detail-table-body').addEventListener('click', (e) => { 
        const button = e.target.closest('button'); 
        if (!button) return; 
        const id = parseInt(button.dataset.id, 10); 
        const sellerId = parseInt(button.dataset.sellerId, 10); 
        if (button.classList.contains('edit-sale-btn')) { 
            const value = parseFloat(e.target.closest('tr').children[1].textContent.replace(/[^\d,]/g, '').replace(',', '.')); 
            document.getElementById('edit-sale-value-id').value = id; 
            document.getElementById('new-sale-value').value = value; 
            openModal(editSaleValueModal); // Usa a função global openModal
        } 
        if (button.classList.contains('delete-sale-btn')) { 
            openDeleteModal(id, 'sale', sellerId); 
        } 
    });
    
    exportRankingButton.addEventListener('click', () => {
        openModal(exportConfirmModal); // Usa a função global openModal
    });

    confirmExportButton.addEventListener('click', executeExportRanking);

    cancelExportButtons_export.forEach(btn => {
        btn.addEventListener('click', () => {
            closeModal(exportConfirmModal); // Usa a função global closeModal
        });
    });
        
    document.querySelectorAll('.btn-cancel, .btn-cancel-logout, .btn-cancel-export').forEach(btn => {
        btn.addEventListener('click', (e) => {
            closeModal(e.target.closest('.modal-backdrop')); // Usa a função global closeModal
        });
    });
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) {
                closeModal(backdrop); // Usa a função global closeModal
            }
        });
    });
        
    themeToggleBtn.addEventListener('click', () => { 
        const isDark = document.documentElement.classList.toggle('dark');
        localStorage.setItem('theme', isDark ? 'dark' : 'light'); 
        syncThemeIcons(); 
    });
    window.addEventListener('storage', (event) => {
        if (event.key === 'theme') {
            if (event.newValue === 'dark') {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
            syncThemeIcons();
        }
    });

    openTvViewButton.addEventListener('click', () => {
        window.open('tv-view.html', '_blank');
    });

    if (profileButton) {
        profileButton.addEventListener('click', () => {
            window.location.href = '/frontend/profile.html'; // Ajustado caminho
        });
    }

    // --- INICIALIZAÇÃO ---
    syncThemeIcons();
    init();
});