// ranking backup/frontend/js/profile.js

document.addEventListener('DOMContentLoaded', () => {
    // Importa funções auxiliares do api.js (assumindo que api.js é carregado antes no HTML)
    // const { apiRequest, fileToBase64, showToast, openModal, closeModal } = window; // Exemplo para modules

    // --- ELEMENTOS DO DOM ---
    // Seletores do Header (idênticos aos do ranking.html)
    const backToRankingButton = document.getElementById('back-to-ranking-button'); // Botão para voltar ao ranking
    const openCastModalButton = document.getElementById('open-cast-modal-button');
    const openTvViewButton = document.getElementById('open-tv-view-button');
    const themeToggleBtn = document.getElementById('theme-toggle');
    const logoutButton = document.getElementById('logout-button');
    const profileButton = document.getElementById('profile-button'); // Este continua sendo o botão que antes mostrava o username

    // Botões para abrir os modais (Métricas removido)
    // const openMetricsModalButton = document.getElementById('open-metrics-modal-button'); // Removido
    const openProfileModalButton = document.getElementById('open-profile-modal-button');
    const openSecurityModalButton = document.getElementById('open-security-modal-button');

    // Modais e seus elementos internos (Métricas removido)
    // const metricsModal = document.getElementById('metrics-modal'); // Removido
    // const modalTotalSellersDisplay = document.getElementById('modal-total-sellers'); // Removido
    // const modalTotalSalesValueDisplay = document.getElementById('modal-total-sales-value'); // Removido
    // const modalTotalRegisteredSalesDisplay = document.getElementById('modal-new-customers'); // Removido

    const profileInfoModal = document.getElementById('profile-info-modal');
    const editProfileFormModal = document.getElementById('edit-profile-form-modal');
    const modalUsernameField = document.getElementById('modal-username-field');
    const modalFullNameField = document.getElementById('modal-full-name');
    const modalEmailField = document.getElementById('modal-email-field');
    const modalPhoneField = document.getElementById('modal-phone-field');
    const modalProfilePicUpload = document.getElementById('modal-profile-pic-upload');
    const modalProfilePicPreview = document.getElementById('modal-profile-pic-preview');

    const securityModal = document.getElementById('security-modal');
    const changePasswordFormModal = document.getElementById('change-password-form-modal');
    const modalCurrentPasswordField = document.getElementById('modal-current-password');
    const modalNewPasswordField = document.getElementById('modal-new-password');
    const modalConfirmNewPasswordField = document.getElementById('modal-confirm-new-password');
    const deleteAccountButton = document.getElementById('delete-account-button'); // Botão de excluir conta dentro do modal de segurança

    // Elementos de Atividades Recentes (permanecem na página)
    const recentActivitiesList = document.getElementById('recent-activities-list'); 
    const noRecentActivitiesMessage = document.getElementById('no-recent-activities'); 

    // Métricas Principais (agora visíveis diretamente na página)
    const totalSellersDisplay = document.getElementById('total-sellers'); 
    const totalSalesValueDisplay = document.getElementById('total-sales-value'); 
    const totalRegisteredSalesDisplay = document.getElementById('new-customers'); 

    // Modais de Confirmação (originais)
    const logoutConfirmModal = document.getElementById('logout-confirm-modal');
    const confirmLogoutButton = document.getElementById('confirm-logout-button');
    const deleteAccountConfirmModal = document.getElementById('delete-account-confirm-modal');
    
    // --- VARIÁVEIS DE ESTADO ---
    let currentProfileData = {}; // Para armazenar os dados do perfil carregados

    // --- LÓGICA DE NAVEGAÇÃO DA BARRA LATERAL (mantida) ---
    const navItems = document.querySelectorAll('.nav-item'); 
    
    const activateCurrentNavItem = () => {
        const path = window.location.pathname.split('/').pop(); 
        navItems.forEach(item => {
            const href = item.getAttribute('href');
            if (href === path) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    };

    // --- Carregar Dados do Perfil e Dashboard ---
    const fetchProfileAndDashboardData = async () => {
        try {
            const authResponse = await apiRequest('/auth/status'); 
            if (!authResponse.isLoggedIn) {
                window.location.replace('/frontend/login.html'); 
                return; 
            }
            currentProfileData = authResponse.user;
            
            // Preenche os campos dos modais de Informações Pessoais
            if (modalUsernameField) modalUsernameField.value = currentProfileData.username;
            if (modalFullNameField) modalFullNameField.value = currentProfileData.fullName || '';
            if (modalEmailField) modalEmailField.value = currentProfileData.email || '';
            if (modalPhoneField) modalPhoneField.value = currentProfileData.phone || '';
            if (modalProfilePicPreview) modalProfilePicPreview.src = currentProfileData.profilePic || 'https://placehold.co/120x120/374151/ffffff?text=Admin';
            
            const dashboardResponse = await apiRequest('/dashboard-metrics'); 
            // Preenche os displays de métricas DIRETAMENTE NA PÁGINA
            if (totalSellersDisplay) totalSellersDisplay.textContent = dashboardResponse.totalSellers || 0; 
            if (totalSalesValueDisplay) totalSalesValueDisplay.textContent = dashboardResponse.totalSales.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            if (totalRegisteredSalesDisplay) totalRegisteredSalesDisplay.textContent = dashboardResponse.totalRegisteredSales || dashboardResponse.newCustomers || 0; 
            
            renderRecentActivities(dashboardResponse.recentActivities || []);

        } catch (error) {
            console.error('Erro ao buscar dados do perfil ou dashboard:', error);
            showToast(error.message, true); 
            setTimeout(() => {
                window.location.replace('/frontend/login.html'); 
            }, 2000);
        }
    };

    // Render Recent Activities
    const renderRecentActivities = (activities) => {
        if (recentActivitiesList) recentActivitiesList.innerHTML = ''; 
        if (!recentActivitiesList) return;

        if (activities.length === 0) {
            if (noRecentActivitiesMessage) noRecentActivitiesMessage.classList.remove('hidden');
            return;
        }
        if (noRecentActivitiesMessage) noRecentActivitiesMessage.classList.add('hidden');

        activities.forEach(activity => {
            const statusClass = {
                'In Progress': 'status-inprogress',
                'Submitted': 'status-submitted',
                'On Hold': 'status-onhold',
                'Completed': 'status-completed'
            }[activity.status] || '';

            const activityItem = `
                <div class="activity-item bg-gray-100 dark:bg-gray-700 p-3 rounded-lg flex items-center justify-between"> <div class="flex-1">
                        <p class="text-gray-900 dark:text-white font-medium">${activity.name}</p> <p class="text-gray-600 dark:text-gray-400 text-sm">${activity.description}</p> </div>
                    <span class="activity-status ${statusClass}">${activity.status}</span>
                    <span class="text-gray-600 dark:text-gray-400 text-sm ml-4">${activity.dateTime}</span> </div>
            `;
            recentActivitiesList.insertAdjacentHTML('beforeend', activityItem);
        });
    };


    // --- Event Listeners ---

    // Event listener para o botão "Voltar ao Ranking"
    if (backToRankingButton) {
        backToRankingButton.addEventListener('click', () => {
            window.location.href = '/frontend/ranking.html';
        });
    }

    // Event listeners para abrir os modais (Métricas removido)
    if (openProfileModalButton) {
        openProfileModalButton.addEventListener('click', () => {
            openModal(profileInfoModal);
        });
    }
    if (openSecurityModalButton) {
        openSecurityModalButton.addEventListener('click', () => {
            openModal(securityModal);
        });
    }

    // Lógica de envio do formulário de Alterar Senha (dentro do modal)
    if (changePasswordFormModal) {
        changePasswordFormModal.addEventListener('submit', async (e) => {
            e.preventDefault();
            const currentPassword = modalCurrentPasswordField.value;
            const newPassword = modalNewPasswordField.value;
            const confirmNewPassword = modalConfirmNewPasswordField.value;

            if (!currentPassword || !newPassword || !confirmNewPassword) {
                showToast('Todos os campos são obrigatórios.', true); 
                return;
            }
            if (newPassword.length < 6) {
                showToast('A nova senha deve ter no mínimo 6 caracteres.', true); 
                return;
            }
            if (newPassword !== confirmNewPassword) {
                showToast('A nova senha e a confirmação não coincidem.', true); 
                return;
            }

            try {
                await apiRequest('/auth/change-password', 'POST', { currentPassword, newPassword, confirmNewPassword }); 
                showToast('Senha alterada com sucesso!'); 
                changePasswordFormModal.reset();
                closeModal(securityModal); 
            } catch (error) {
                // showToast já é chamado dentro de apiRequest
            }
        });
    }

    // Lógica de envio do formulário de Editar Perfil (dentro do modal)
    if (editProfileFormModal) {
        editProfileFormModal.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fullName = modalFullNameField.value.trim();
            const email = modalEmailField.value.trim();
            const phone = modalPhoneField.value.trim();
            let profilePicBase64 = currentProfileData.profilePic || null; 

            if (modalProfilePicUpload && modalProfilePicUpload.files.length > 0) {
                profilePicBase64 = await fileToBase64(modalProfilePicUpload.files[0]); 
            }

            try {
                await apiRequest('/auth/update-profile', 'PUT', { 
                    fullName, 
                    email, 
                    phone, 
                    profilePic: profilePicBase64 
                }); 
                showToast('Informações do perfil atualizadas com sucesso!'); 
                fetchProfileAndDashboardData(); 
                closeModal(profileInfoModal); 
            } catch (error) {
                // showToast já é chamado dentro de apiRequest
            }
        });
    }

    // Lógica de pré-visualização da imagem no modal de perfil
    if (modalProfilePicUpload) {
        modalProfilePicUpload.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    if (modalProfilePicPreview) modalProfilePicPreview.src = e.target.result;
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // Event listeners para modais de logout
    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            openModal(logoutConfirmModal); 
        });
    }

    if (confirmLogoutButton) {
        confirmLogoutButton.addEventListener('click', async () => {
            closeModal(logoutConfirmModal); 
            localStorage.setItem('logout_event', Date.now()); 
            try {
                const response = await fetch('/api/auth/logout', { method: 'POST' }); 
                if (response.ok) {
                    window.location.replace('/frontend/login.html'); 
                } else {
                    const data = await response.json();
                    showToast(data.message || 'Falha ao tentar sair.', true); 
                }
            } catch (error) {
                console.error('Erro no logout:', error);
                showToast('Erro de conexão ao tentar sair.', true); 
            }
        });
    }

    document.querySelectorAll('.btn-cancel-logout').forEach(btn => {
        btn.addEventListener('click', () => closeModal(logoutConfirmModal)); 
    });

    // Event listener para o botão de exclusão de conta (dentro do modal de segurança)
    if (deleteAccountButton) {
        deleteAccountButton.addEventListener('click', () => {
            closeModal(securityModal); 
            openModal(deleteAccountConfirmModal);
        });
    }

    if (document.getElementById('confirm-delete-account-button')) {
        document.getElementById('confirm-delete-account-button').addEventListener('click', async () => {
            closeModal(deleteAccountConfirmModal);
            try {
                await apiRequest('/auth/delete-account', 'DELETE');
                showToast('Sua conta foi excluída com sucesso. Redirecionando para o login...', false);
                setTimeout(() => {
                    window.location.replace('/frontend/login.html');
                }, 3000);
            } catch (error) {
                // showToast já é chamado dentro de apiRequest
            }
        });
    }

    document.querySelectorAll('.btn-cancel-delete-account').forEach(btn => {
        btn.addEventListener('click', () => closeModal(deleteAccountConfirmModal));
    });

    // Event listeners para fechar modais usando data-close-modal
    document.querySelectorAll('[data-close-modal]').forEach(button => {
        button.addEventListener('click', (e) => {
            const modalId = e.target.dataset.closeModal;
            const modalElement = document.getElementById(modalId);
            if (modalElement) {
                closeModal(modalElement);
            }
        });
    });

    // INÍCIO DA ADIÇÃO JOTAMAKER AI: Fechar modais ao clicar fora do conteúdo
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
        backdrop.addEventListener('click', (e) => {
            // Verifica se o clique foi diretamente no backdrop (e não em um elemento filho dentro do modal)
            if (e.target === backdrop) {
                closeModal(backdrop); // Usa a função global closeModal
            }
        });
    });
    // FIM DA ADIÇÃO JOTAMAKER AI

    // Lógica de tema e navegação
    const syncThemeIcons = () => { 
        const isDark = document.documentElement.classList.contains('dark'); 
        const darkIcon = document.getElementById('theme-toggle-dark-icon');
        const lightIcon = document.getElementById('theme-toggle-light-icon');
        if (darkIcon) darkIcon.classList.toggle('hidden', isDark); 
        if (lightIcon) lightIcon.classList.toggle('hidden', !isDark); 
    };

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => { 
            const isDark = document.documentElement.classList.toggle('dark');
            // INÍCIO DA CORREÇÃO JOTAMAKER AI: Adiciona/remove a classe 'light' explicitamente
            if (isDark) { // Se agora é dark
                document.documentElement.classList.remove('light');
            } else { // Se agora é light
                document.documentElement.classList.add('light');
            }
            // FIM DA CORREÇÃO JOTAMAKER AI
            localStorage.setItem('theme', isDark ? 'dark' : 'light'); 
            syncThemeIcons(); 
        });
    }

    window.addEventListener('storage', (event) => {
        if (event.key === 'theme') {
            if (event.newValue === 'dark') {
                document.documentElement.classList.add('dark');
                document.documentElement.classList.remove('light'); // ADIÇÃO JOTAMAKER AI
            } else {
                document.documentElement.classList.remove('dark');
                document.documentElement.classList.add('light'); // ADIÇÃO JOTAMAKER AI
            }
            syncThemeIcons();
        }
    });

    if (openTvViewButton) {
        openTvViewButton.addEventListener('click', () => {
            window.open('tv-view.html', '_blank');
        });
    }
    
    // --- INICIALIZAÇÃO ---
    const initProfilePage = async () => {
        activateCurrentNavItem(); 
        await fetchProfileAndDashboardData(); 
    };

    syncThemeIcons();
    initProfilePage();
});