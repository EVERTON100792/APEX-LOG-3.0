
import { supabase } from './supabase-client.js';

export async function getSession() {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
}

export async function requireAuth() {
    const session = await getSession();
    if (!session) {
        window.location.href = 'login.html';
        return null;
    }
    return session;
}

export async function login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });
    return { data, error };
}

export async function logout() {
    // Clear application state to prevent data leaking between users
    // MODIFICADO: Limpeza agressiva conforme solicitado para evitar persistência indesejada.
    localStorage.removeItem('logisticsAppState');
    localStorage.removeItem('processamentoData');
    localStorage.removeItem('currentSessionName');
    localStorage.removeItem('lastActiveView');
    localStorage.removeItem('lastActiveTab');
    localStorage.removeItem('sidebarCollapsed');
    localStorage.removeItem('apexFreightConfig'); // Limpa config de frete também se necessário
    localStorage.removeItem('lastFileName');

    // NOVO: Limpa sessionStorage para forçar a detecção de "nova sessão" no próximo login
    sessionStorage.clear();


    const { error } = await supabase.auth.signOut();
    if (!error) {
        window.location.href = 'login.html';
    }
    return error;
}

export async function getUserProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    return data;
}

export async function signUp(email, password, fullName) {
    // Restrição de domínio de segurança
    if (!email.trim().toLowerCase().endsWith('@selmi.com.br')) {
        return { error: { message: 'Email não permitido.' } };
    }

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                full_name: fullName
            }
        }
    });

    return { data, error };
}

