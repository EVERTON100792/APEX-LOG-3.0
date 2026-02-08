
import { supabase } from './supabase-client.js';

/**
 * Salva a sessão atual na nuvem.
 * @param {string} name - Nome da sessão.
 * @param {object} stateData - Dados da sessão (JSON).
 */
export async function saveSessionToCloud(name, stateData) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Usuário não autenticado.");

    // Verifica se já existe uma sessão com mesmo nome (opcional, ou cria nova)
    const { data, error } = await supabase
        .from('saved_sessions')
        .insert([
            { name: name, data: stateData, user_id: user.id }
        ])
        .select();

    if (error) throw error;
    return data[0];
}

/**
 * Compartilha uma sessão com um e-mail.
 * @param {string} sessionId - ID da sessão.
 * @param {string} targetEmail - E-mail do destinatário.
 */
export async function shareSession(sessionId, targetEmail) {
    // Validação básica de e-mail
    if (!targetEmail || !targetEmail.includes('@')) {
        throw new Error("E-mail inválido.");
    }

    const { error } = await supabase
        .from('session_shares')
        .insert([
            { session_id: sessionId, shared_with_email: targetEmail.trim() }
        ]);

    if (error) throw error;
}

/**
 * Retorna as sessões do próprio usuário.
 */
export async function getMySessions() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
        .from('saved_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
}

/**
 * Retorna TODAS as sessões (Histórico Global) com filtro opcional de data.
 * @param {string|null} dateFilter - Data (YYYY-MM-DD) ou null para todas (limitado).
 */
export async function getAllSessions(dateFilter = null) {
    let query = supabase
        .from('saved_sessions')
        .select('*')
        .order('created_at', { ascending: false });

    if (dateFilter) {
        // Filtrar pelo dia específico (Do início ao fim do dia em UTC ou local? Supabase guarda UTC)
        // Simplificação: casting date
        // O ideal é gte T00:00:00 e lte T23:59:59
        const start = `${dateFilter}T00:00:00`;
        const end = `${dateFilter}T23:59:59`;
        query = query.gte('created_at', start).lte('created_at', end);
    } else {
        // Se não tem filtro, limita a 50 para não pesar
        query = query.limit(50);
    }

    const { data: sessions, error } = await query;

    if (error) throw error;
    if (!sessions || sessions.length === 0) return [];

    // Busca e-mails dos donos para exibir "Criado por..."
    // (Poderia ser um join se tivesse foreign key relation configurada na query, mas map resolve)
    const userIds = [...new Set(sessions.map(s => s.user_id))];
    const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email')
        .in('id', userIds);

    const profileMap = {};
    if (profiles) {
        profiles.forEach(p => profileMap[p.id] = p.email);
    }

    return sessions.map(s => ({
        ...s,
        owner: { email: profileMap[s.user_id] || 'Desconhecido' }
    }));
}

/**
 * Retorna as sessões compartilhadas com o usuário.
 * (Mantido para compatibilidade, mas a UI vai usar getAllSessions)
 */
/**
 * Retorna as sessões compartilhadas com o usuário.
 * (A query é simplificada pois o RLS já filtra)
 */
export async function getSharedWithMe() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    // O RLS garante que eu só veja:
    // 1. Minhas sessões (user_id = me) -> Filtrar fora no client side se quiser
    // 2. Sessões compartilhadas comigo
    // Para pegar SÓ as compartilhadas, filtramos user_id != me.

    // 1. Fetch sessions shared with me
    const { data: sessions, error } = await supabase
        .from('saved_sessions')
        .select('*')
        .neq('user_id', user.id) // Exclui as minhas
        .order('created_at', { ascending: false });

    if (error) throw error;
    if (!sessions || sessions.length === 0) return [];

    // 2. Fetch owner emails manually (safer than relying on FKs)
    const userIds = [...new Set(sessions.map(s => s.user_id))];
    const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, email')
        .in('id', userIds);

    // Map profiles for O(1) lookup
    const profileMap = {};
    if (profiles) {
        profiles.forEach(p => profileMap[p.id] = p.email);
    }

    // 3. Attach owner info
    return sessions.map(s => ({
        ...s,
        owner: { email: profileMap[s.user_id] || 'Desconhecido' }
    }));
}

/**
 * Busca detalhes completos de uma sessão (para carregamento).
 */
export async function loadSessionFromCloud(sessionId) {
    const { data, error } = await supabase
        .from('saved_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

    if (error) throw error;
    return data;
}

/**
 * Exclui uma sessão.
 */
export async function deleteSession(sessionId) {
    const { error } = await supabase
        .from('saved_sessions')
        .delete()
        .eq('id', sessionId);

    if (error) throw error;
}

