
import { supabase } from './supabase-client.js';

/**
 * Insere uma nova atividade no banco de dados.
 * @param {string} actionType - Tipo da ação (ex: 'PROCESSANDO_PLANILHA')
 * @param {object} details - Detalhes adicionais (ex: { arquivo: 'dados.xlsx' })
 */
export async function logActivity(actionType, details = {}) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Busca o nome do perfil
    const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();

    const userName = profile?.full_name || user.email;

    await supabase.from('activities').insert({
        user_id: user.id,
        user_name: userName,
        action_type: actionType,
        details: details,
        active: true
    });
}

/**
 * Inscreve-se para receber atualizações de atividades em tempo real.
 * @param {function} onActivity - Callback executado quando uma nova atividade ocorre.
 */
export function subscribeToActivities(onActivity) {
    const channel = supabase
        .channel('public:activities')
        .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'activities' },
            (payload) => {
                onActivity(payload.new);
            }
        )
        .subscribe();

    return channel;
}

