import { requireAuth, logout } from './auth.js';
import { logActivity, subscribeToActivities } from './realtime.js';
import { saveSessionToCloud, getMySessions, getSharedWithMe, loadSessionFromCloud, shareSession, deleteSession } from './sharing.js';
import { supabase } from './supabase-client.js'; // FIX: Explicit import for initApp

// 1. Check Session & Init
window.addEventListener('unhandledrejection', (event) => {
    // Supabase AbortError suppression
    if (event.reason && (event.reason.name === 'AbortError' || event.reason.message?.includes('signal is aborted'))) {
        console.warn('Supabase fetch aborted (ignoring):', event.reason);
        event.preventDefault(); // Prevent console error
    }
});

async function initApp() {
    const session = await requireAuth();
    if (!session) return; // redirect handled in auth.js

    // 2. Realtime Subscription
    subscribeToActivities((activity) => {
        const container = document.getElementById('realtime-toast-container');
        if (!container) return;

        // Don't show toast for own actions if desired, or show different style
        // For now, show all

        const toastId = 'toast-' + Math.random().toString(36).substr(2, 9);
        const toastHtml = `
                    <div id="${toastId}" class="toast align-items-center text-bg-info border-0 show" role="alert" aria-live="assertive" aria-atomic="true">
                        <div class="d-flex">
                            <div class="toast-body">
                                <i class="bi bi-info-circle-fill me-2"></i>
                                <strong>${activity.user_name || 'Usuário'}</strong>: ${activity.action_type.replace('_', ' ')}
                            </div>
                            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
                        </div>
                    </div>`;
        container.insertAdjacentHTML('beforeend', toastHtml);

        // Auto remove after 5s
        setTimeout(() => {
            const toast = document.getElementById(toastId);
            if (toast) {
                toast.classList.remove('show');
                setTimeout(() => toast.remove(), 500);
            }
        }, 5000);
    });

    // 3. Hook Process Button & Global Log Helper
    window.triggerLogActivity = (action, details) => {
        logActivity(action, details);
        // Also show a local toast immediately for responsiveness
        showLocalToast('Você', action.replace('_', ' '), 'success');
    };

    const processBtn = document.getElementById('processarBtn');
    if (processBtn) {
        // The actual processing logic is in the global scope `processar()`. 
        // We will add the logging inside the `processar()` function logic via the bridge.
    }

    function showLocalToast(user, action, type = 'info') {
        const container = document.getElementById('realtime-toast-container');
        if (!container) return;

        // Prevent duplicate toasts if realtime comes back fast
        // (Simple heuristic: check if last child text content matches, or just let it stack)

        const toastId = 'toast-local-' + Math.random().toString(36).substr(2, 9);
        const bgClass = type === 'success' ? 'text-bg-success' : (type === 'error' ? 'text-bg-danger' : 'text-bg-info');

        const toastHtml = `
                    <div id="${toastId}" class="toast align-items-center ${bgClass} border-0 show" role="alert" aria-live="assertive" aria-atomic="true">
                        <div class="d-flex">
                            <div class="toast-body">
                                <i class="bi bi-info-circle-fill me-2"></i>
                                <strong>${user}</strong>: ${action}
                            </div>
                            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
                        </div>
                    </div>`;
        container.insertAdjacentHTML('beforeend', toastHtml);
        setTimeout(() => {
            const toast = document.getElementById(toastId);
            if (toast) {
                toast.classList.remove('show');
                setTimeout(() => toast.remove(), 500);
            }
        }, 4000);
    }

    // 4. Logout is now handled in the Top Navbar dropdown

    // --- 4.1 Update User Greeting & Profile ---
    async function updateUserDisplay() {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                // Try to get name from metadata or email
                const name = user.user_metadata?.full_name || user.user_metadata?.name || user.email.split('@')[0];

                // Update Sidebar Profile
                const userNameDisplay = document.getElementById('user-name-display');
                if (userNameDisplay) userNameDisplay.textContent = name;

                // Basic greeting if element exists
                const greetingEl = document.getElementById('user-greeting');
                if (greetingEl) greetingEl.innerHTML = `<i class="bi bi-person-circle me-2"></i>Bem-vindo, ${name}!`;
            }
        } catch (e) { console.error('Error fetching user for greeting:', e); }
    }
    await updateUserDisplay();

    // 5. Check for Shared Sessions (Notifications)
    try {
        const sharedSessions = await getSharedWithMe();
        if (sharedSessions && sharedSessions.length > 0) {
            const count = sharedSessions.length;
            // Use a FIXED ID so we can remove it later
            const toastId = 'shared-sessions-alert-toast';

            // Remove if already exists to avoid duplicates
            const existing = document.getElementById(toastId);
            if (existing) existing.remove();

            const toastHtml = `
                        <div id="${toastId}" class="toast align-items-center text-bg-warning border-0 show" role="alert" aria-live="assertive" aria-atomic="true" data-bs-autohide="false">
                            <div class="d-flex">
                                <div class="toast-body">
                                    <i class="bi bi-cloud-arrow-down-fill me-2"></i>
                                    <strong>Você tem ${count} sessões compartilhadas!</strong><br>
                                    Acesse o menu "Nuvem" para vê-las.
                                </div>
                                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
                            </div>
                        </div>`;

            const container = document.getElementById('realtime-toast-container');
            if (container) container.insertAdjacentHTML('afterbegin', toastHtml);
        }
    } catch (err) {
        console.error("Erro ao verificar compartilhamentos:", err);
    }

    // 6. Audit Log: Config Changes
    const saveConfigBtn = document.getElementById('saveConfig');
    if (saveConfigBtn) {
        saveConfigBtn.addEventListener('click', () => {
            logActivity('ALTERACAO_CONFIG', { detalhe: 'Capacidades de veículos atualizadas' });
        });
    }
}


// 5. Cloud Integration Logic
window.openCloudManager = async () => {
    const modal = new bootstrap.Modal(document.getElementById('cloudModal'));
    modal.show();
    await window.renderSessionLists();
};

window.renderSessionLists = async () => {
    const mySessionsEl = document.getElementById('my-sessions-list');
    const sharedSessionsEl = document.getElementById('shared-sessions-list');

    mySessionsEl.innerHTML = '<div class="text-center p-3 text-muted"><div class="spinner-border spinner-border-sm" role="status"></div> Carregando...</div>';
    sharedSessionsEl.innerHTML = '<div class="text-center p-3 text-muted"><div class="spinner-border spinner-border-sm" role="status"></div> Carregando...</div>';

    // Helper para formatar data BR (Garante que o timezone seja respeitado)
    const formatDateBR = (dateString) => {
        if (!dateString) return 'Data desconhecida';
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('pt-BR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        }).format(date);
    };

    try {
        const [mySessions, sharedSessions] = await Promise.all([
            getMySessions(),
            getSharedWithMe()
        ]);

        // Render My Sessions
        if (mySessions.length === 0) {
            mySessionsEl.innerHTML = '<div class="empty-state-premium py-4"><i class="bi bi-cloud-slash empty-state-icon fs-2 mb-2"></i><p class="text-muted mb-0 small">Nenhuma sessão salva.</p></div>';
        } else {
            mySessionsEl.innerHTML = mySessions.map(s => {
                // Tenta extrair metadados se disponíveis (retrocompatibilidade)
                const veiculosCount = s.data?.appState?.activeLoads ? Object.keys(s.data.appState.activeLoads).length : 0;
                const pesoTotal = s.data?.appState?.activeLoads ? Object.values(s.data.appState.activeLoads).reduce((acc, l) => acc + (l.totalKg || 0), 0) : 0;
                const details = veiculosCount > 0 ? ` &bull; <small class="text-info">${veiculosCount} Veículos (${(pesoTotal / 1000).toFixed(1)}t)</small>` : '';

                return `
                <div class="list-group-item list-group-item-action bg-transparent text-light border-secondary d-flex justify-content-between align-items-center">
                    <div>
                        <div class="fw-bold">${s.name} ${details}</div>
                        <small class="text-muted"><i class="bi bi-clock me-1"></i>${formatDateBR(s.created_at)}</small>
                    </div>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-info" onclick="window.openShareModal('${s.id}', '${s.name.replace(/'/g, "\\'")}')" title="Compartilhar"><i class="bi bi-share-fill"></i></button>
                        <button class="btn btn-outline-primary" onclick="window.performLoadSession('${s.id}')" title="Carregar"><i class="bi bi-upload"></i></button>
                        <button class="btn btn-outline-danger" onclick="window.performDeleteSession('${s.id}')" title="Excluir"><i class="bi bi-trash-fill"></i></button>
                    </div>
                </div>
            `}).join('');
        }

        // Render Shared Sessions
        if (sharedSessions.length === 0) {
            sharedSessionsEl.innerHTML = '<div class="empty-state-premium py-4"><i class="bi bi-inbox empty-state-icon fs-2 mb-2"></i><p class="text-muted mb-0 small">Nenhum compartilhamento recebido.</p></div>';
        } else {
            sharedSessionsEl.innerHTML = sharedSessions.map(s => {
                const veiculosCount = s.data?.appState?.activeLoads ? Object.keys(s.data.appState.activeLoads).length : 0;
                const details = veiculosCount > 0 ? ` &bull; <small class="text-info">${veiculosCount} Veículos</small>` : '';

                return `
                <div class="list-group-item list-group-item-action bg-transparent text-light border-secondary d-flex justify-content-between align-items-center">
                    <div>
                        <div class="fw-bold text-info">${s.name} ${details}</div>
                        <small class="text-muted">De: ${s.owner?.email || 'Desconhecido'}</small><br>
                        <small class="text-muted"><i class="bi bi-clock me-1"></i>${formatDateBR(s.created_at)}</small>
                    </div>
                    <button class="btn btn-sm btn-primary" onclick="window.performLoadSession('${s.id}')"><i class="bi bi-upload me-1"></i>Carregar</button>
                </div>
            `}).join('');
        }

    } catch (error) {
        console.error(error);
        const errMsg = '<div class="empty-state-premium py-4 border-danger"><i class="bi bi-exclamation-triangle text-danger empty-state-icon fs-2 mb-2"></i><p class="text-danger mb-0 small">Erro ao carregar sessões.</p></div>';
        mySessionsEl.innerHTML = errMsg;
        sharedSessionsEl.innerHTML = errMsg;
    }
};

window.openSaveSessionModal = () => {
    const currentName = localStorage.getItem('currentSessionName') || '';
    document.getElementById('sessionNameInput').value = currentName;
    const modal = new bootstrap.Modal(document.getElementById('saveSessionModal'));
    modal.show();
};

window.performSaveSession = async () => {
    const nameInput = document.getElementById('sessionNameInput');
    const name = nameInput.value.trim();
    if (!name) return alert('Por favor, digite um nome para a sessão.');

    // Trigger the app's save logic to ensure localStorage is up to date
    await saveStateToLocalStorage();
    const stateData = JSON.parse(localStorage.getItem('logisticsAppState'));

    if (!stateData) return alert('Erro: Não há dados para salvar.');

    try {
        // NOVO: Inclui também os dados brutos da planilha do IndexedDB
        const planilhaData = await loadPlanilhaFromDb();

        // Cria objeto completo com estado + planilha
        const fullSessionData = {
            appState: stateData,
            planilhaRawData: planilhaData,
            lastFileName: localStorage.getItem('lastFileName')
        };

        await saveSessionToCloud(name, fullSessionData);
        alert('Sessão salva na nuvem com sucesso!');
        bootstrap.Modal.getInstance(document.getElementById('saveSessionModal')).hide();
        window.renderSessionLists(); // Refresh list
    } catch (error) {
        console.error(error);
        alert('Erro ao salvar sessão: ' + error.message);
    }
};

window.openShareModal = (id, name) => {
    document.getElementById('shareSessionId').value = id;
    document.getElementById('shareSessionName').textContent = name;
    document.getElementById('shareEmailInput').value = '';
    new bootstrap.Modal(document.getElementById('shareSessionModal')).show();
};

window.performShareSession = async () => {
    const id = document.getElementById('shareSessionId').value;
    const email = document.getElementById('shareEmailInput').value.trim();
    if (!email) return alert('Digite um e-mail.');

    try {
        await shareSession(id, email);
        alert('Compartilhado com sucesso!');
        bootstrap.Modal.getInstance(document.getElementById('shareSessionModal')).hide();
    } catch (error) {
        console.error(error);
        alert('Erro ao compartilhar: ' + error.message);
    }
};

window.performDeleteSession = async (id) => {
    if (!confirm('Tem certeza que deseja excluir esta sessão da nuvem?')) return;
    try {
        await deleteSession(id);
        window.renderSessionLists();
    } catch (error) {
        alert('Erro ao excluir: ' + error.message);
    }
};

window.performLoadSession = async (id) => {
    if (!confirm('Carregar esta sessão irá SUBSTITUIR todo o seu trabalho atual. Deseja continuar?')) return;

    try {
        const session = await loadSessionFromCloud(id);
        if (!session || !session.data) throw new Error("Dados da sessão inválidos.");

        // Verifica se é o formato novo (com planilhaRawData) ou antigo (só appState)
        const isNewFormat = session.data.appState !== undefined;

        if (isNewFormat) {
            // Formato novo: restaura appState e planilhaRawData
            localStorage.setItem('logisticsAppState', JSON.stringify(session.data.appState));

            // Restaura os dados brutos da planilha no IndexedDB
            if (session.data.planilhaRawData) {
                await savePlanilhaToDb(session.data.planilhaRawData);
                planilhaData = session.data.planilhaRawData; // Atualiza variável global
                console.log("Dados da planilha restaurados do IndexedDB da sessão.");
            }

            // Restaura o nome do arquivo
            if (session.data.lastFileName) {
                localStorage.setItem('lastFileName', session.data.lastFileName);
            }
        } else {
            // Formato antigo (retrocompatibilidade): só o appState
            localStorage.setItem('logisticsAppState', JSON.stringify(session.data));
            console.warn("Sessão no formato antigo - dados da planilha não incluídos.");
        }

        localStorage.setItem('currentSessionName', session.name); // Salva o nome da sessão carregada

        // Dismiss Shared Session Alert/Toast
        const sharedToast = document.getElementById('shared-sessions-alert-toast');
        if (sharedToast) {
            sharedToast.classList.remove('show');
            setTimeout(() => sharedToast.remove(), 300);
        }

        // Close Modals
        const cloudModal = bootstrap.Modal.getInstance(document.getElementById('cloudModal'));
        if (cloudModal) cloudModal.hide();

        // Trigger restore logic
        await loadStateFromLocalStorage();

        alert('Sessão carregada com sucesso!');

    } catch (error) {
        console.error(error);
        alert('Erro ao carregar sessão: ' + error.message);
    }
};

initApp();

