
// --- FREIGHT SYSTEM LOGIC ---

// --- FREIGHT SYSTEM LOGIC ---

// DEFINIÇÃO DAS TABELAS DE FRETE (Fonte: Imagens do Usuário)
// --- FREIGHT SYSTEM LOGIC ---

// DEFINIÇÃO DAS TABELAS DE FRETE (Fonte: Imagens do Usuário)
// Agora é um 'let' para permitir personalização via UI
let freightTables = {
    fiorino: {
        ranges: [
            { max: 150, value: 207.80 }
        ],
        exceedingRate: 1.40 // Valor por KM rodado se passar do limite máximo das faixas
    },
    van: {
        ranges: [
            { max: 100, value: 305.40 },
            { max: 150, value: 375.54 },
            { max: 200, value: 434.86 },
            { max: 300, value: 524.09 },
            { max: 400, value: 624.14 },
            { max: 500, value: 753.30 }
        ],
        exceedingRate: 1.80
    },
    tresQuartos: {
        ranges: [
            { max: 100, value: 516.59 },
            { max: 150, value: 583.27 },
            { max: 200, value: 665.52 },
            { max: 300, value: 753.73 },
            { max: 400, value: 887.63 },
            { max: 500, value: 1050.29 }
        ],
        exceedingRate: 2.85
    },
    toco: {
        ranges: [
            { max: 100, value: 636.00 },
            { max: 150, value: 732.38 },
            { max: 200, value: 828.74 },
            { max: 300, value: 963.65 },
            { max: 400, value: 1117.84 },
            { max: 500, value: 1310.58 }
        ],
        exceedingRate: 3.53
    }
};

// Carrega configurações ao iniciar
loadFreightConfig();

async function getFreightConfigFromSupabase() {
    try {
        const sb = window.supabaseClient || window.supabase; // Fallback ou uso do client correto
        if (!sb || !sb.auth) return null; // Verifica se tem .auth (é o client inicializado)

        const user = await sb.auth.getUser();
        if (!user || !user.data || !user.data.user) return null;

        // Tenta buscar a configuração mais recente (assumindo uma global ou por usuário)
        // Por simplicidade, pega a última criada/atualizada
        const { data, error } = await sb
            .from('freight_configs')
            .select('config_json')
            .order('updated_at', { ascending: false })
            .limit(1)
            .single();

        if (error) {
            // Se o erro for "zero rows", é normal na primeira vez
            if (error.code !== 'PGRST116') console.warn("Supabase load error:", error);
            return null;
        }
        return data?.config_json;
    } catch (e) {
        console.error("Erro ao conectar Supabase:", e);
        return null;
    }
}

async function loadFreightConfig() {
    try {
        // 1. Tenta carregar do Supabase (prioridade)
        const cloudConfig = await getFreightConfigFromSupabase();

        if (cloudConfig) {
            freightTables = cloudConfig;
            console.log("Configuração de fretes carregada do Supabase.");
            // Atualiza localStorage para manter sincronia offline
            localStorage.setItem('apexFreightTables', JSON.stringify(freightTables));
        } else {
            // 2. Fallback para LocalStorage
            const stored = localStorage.getItem('apexFreightTables');
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed && parsed.fiorino && parsed.van) {
                    freightTables = parsed;
                    console.log("Configuração de fretes carregada do armazenamento local.");
                }
            }
        }
    } catch (e) {
        console.error("Erro ao carregar fretes:", e);
    }
}

function getFreightConfig() {
    // Retorna a estrutura adaptada para a UI antiga, mas baseada nos dados reais de 'freightTables'
    // Isso garante que os inputs mostrem os valores reais de taxa excedente
    return {
        fiorino: {
            limit: freightTables.fiorino.ranges[0].max,
            fixed: freightTables.fiorino.ranges[0].value,
            rate: freightTables.fiorino.exceedingRate
        },
        van: {
            limit: 500, // Fixo conforme tabela imagem
            tableValue: 0, // Não usado na edição simples
            rate: freightTables.van.exceedingRate
        },
        tresQuartos: {
            limit: 500,
            tableValue: 0,
            rate: freightTables.tresQuartos.exceedingRate
        },
        toco: {
            limit: 500,
            tableValue: 0,
            rate: freightTables.toco.exceedingRate
        }
    };
}

async function saveFreightConfig() {
    try {
        // 1. Atualiza Fiorino (Simples)
        const fiorinoLimit = parseFloat(document.getElementById('fiorinoLimit').value);
        const fiorinoFixed = parseFloat(document.getElementById('fiorinoFixed').value);
        const fiorinoRate = parseFloat(document.getElementById('fiorinoRate').value);

        if (!isNaN(fiorinoLimit)) freightTables.fiorino.ranges[0].max = fiorinoLimit;
        if (!isNaN(fiorinoFixed)) freightTables.fiorino.ranges[0].value = fiorinoFixed;
        if (!isNaN(fiorinoRate)) freightTables.fiorino.exceedingRate = fiorinoRate;

        // 2. Atualiza Outros (Apenas Taxa Excedente por enquanto, pois a tabela é complexa)
        const updateComplexVehicle = (idRate, type) => {
            const valRate = parseFloat(document.getElementById(idRate).value);
            if (!isNaN(valRate)) freightTables[type].exceedingRate = valRate;
        };

        updateComplexVehicle('vanRate', 'van');
        updateComplexVehicle('truck34Rate', 'tresQuartos');
        updateComplexVehicle('tocoRate', 'toco');

        // 3. Salva no LocalStorage
        localStorage.setItem('apexFreightTables', JSON.stringify(freightTables));

        // 4. Salva no Supabase
        const sb = window.supabaseClient || window.supabase;
        if (sb && sb.auth) {
            const user = await sb.auth.getUser();
            if (user && user.data && user.data.user) {
                const { error } = await sb
                    .from('freight_configs')
                    .insert([
                        {
                            config_json: freightTables,
                            updated_by: user.data.user.id
                        }
                    ]);
                // Nota: Idealmente seria um UPSERT ou Update do ID existente, 
                // mas Insert com Order By desc no Load funciona como log de histórico.

                if (error) console.error("Erro ao salvar no Supabase:", error);
                else console.log("Configuração salva no Supabase.");
            }
        }

        // Atualiza UI e Recalcula
        updateFreightTableUI();
        recalcAllFreights();

        if (typeof showToast === 'function') {
            showToast("Valores de frete atualizados e salvos (Nuvem + Local)!", "success");
        }
    } catch (e) {
        console.error("Erro ao salvar valores:", e);
        if (typeof showToast === 'function') showToast("Erro ao salvar valores.", "error");
    }
}

function updateFreightTableUI() {
    try {
        const config = getFreightConfig();

        // Popula Inputs
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = typeof val === 'number' ? val.toFixed(2).replace('.00', '') : val;
        };

        setVal('fiorinoLimit', config.fiorino.limit);
        setVal('fiorinoFixed', config.fiorino.fixed);
        setVal('fiorinoRate', config.fiorino.rate);

        // Para os complexos, mostramos apenas a taxa e limitamos a edição da 'tableValue'
        setVal('vanLimit', 500);
        setVal('vanRate', config.van.rate);
        const vanTableInput = document.getElementById('vanTableValue');
        if (vanTableInput) { vanTableInput.value = ''; vanTableInput.placeholder = 'Ver Tabela (Fixo)'; vanTableInput.disabled = true; }

        setVal('truck34Limit', 500);
        setVal('truck34Rate', config.tresQuartos.rate);
        const t34TableInput = document.getElementById('truck34TableValue');
        if (t34TableInput) { t34TableInput.value = ''; t34TableInput.placeholder = 'Ver Tabela (Fixo)'; t34TableInput.disabled = true; }

        setVal('tocoLimit', 500);
        setVal('tocoRate', config.toco.rate);
        const tocoTableInput = document.getElementById('tocoTableValue');
        if (tocoTableInput) { tocoTableInput.value = ''; tocoTableInput.placeholder = 'Ver Tabela (Fixo)'; tocoTableInput.disabled = true; }


        // Popula Tabela Visual (Resumo)
        const tbody = document.getElementById('freight-table-body');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td><i class="bi bi-truck me-2 text-success"></i>Fiorino</td>
                    <td>Até ${config.fiorino.limit}km: Fixo<br>Acima: R$ ${config.fiorino.rate}/km</td>
                    <td><strong>R$ ${config.fiorino.fixed.toFixed(2)}</strong> (Fixo)<br><span class="text-muted">Excedente: R$ ${config.fiorino.rate} / km</span></td>
                </tr>
                <tr>
                    <td><i class="bi bi-truck-front me-2 text-primary"></i>Van</td>
                    <td>Até 500km (Tabela Progressiva)</td>
                    <td><strong>Ver Tabela Detalhada</strong><br><span class="text-muted">Acima 500km: R$ ${config.van.rate} / km</span></td>
                </tr>
                <tr>
                    <td><i class="bi bi-truck-flatbed me-2 text-warning"></i>3/4</td>
                    <td>Até 500km (Tabela Progressiva)</td>
                    <td><strong>Ver Tabela Detalhada</strong><br><span class="text-muted">Acima 500km: R$ ${config.tresQuartos.rate} / km</span></td>
                </tr>
                <tr>
                    <td><i class="bi bi-inboxes-fill me-2 text-secondary"></i>Toco</td>
                    <td>Até 500km (Tabela Progressiva)</td>
                    <td><strong>Ver Tabela Detalhada</strong><br><span class="text-muted">Acima 500km: R$ ${config.toco.rate} / km</span></td>
                </tr>
            `;
        }
    } catch (e) {
        console.error("Erro ao atualizar UI de frete:", e);
    }
}

function calculateFreightValue(vehicleType, distanceKm) {
    if (!distanceKm || distanceKm <= 0) return 0;

    // Normaliza o tipo de veículo para chave da tabela
    // Ex: 'fiorino' -> 'fiorino', 'toco' -> 'toco'
    const table = freightTables[vehicleType];

    if (!table) {
        console.warn(`Tabela de frete não encontrada para: ${vehicleType}`);
        return 0;
    }

    // 1. Verificar se está dentro das faixas
    // As faixas devem estar ordenadas por 'max'
    for (const range of table.ranges) {
        if (distanceKm <= range.max) {
            return range.value;
        }
    }

    // 2. Se passou de todas as faixas, regra de excedente
    // Regra: "Acima X KM será pago Y o KM Rodado" -> Valor Total = Distância * Taxa
    // Isso foi confirmado pela interpretação das imagens (ex: Van > 500km = R$ 1,80 KM Rodado)
    return distanceKm * table.exceedingRate;
}

function updateLoadFreightDisplay(loadId, distanceKm = null) {
    const load = activeLoads[loadId];
    const freightEl = document.getElementById(`freight-${loadId}`);
    if (!load || !freightEl) return;

    // Atualiza a distância no objeto load se fornecida
    if (distanceKm !== null) {
        console.log(`UpdateFreight: Recebido ${distanceKm}km para carga ${loadId} (${load.vehicleType})`);
        load.distanceKm = parseFloat(distanceKm);
        if (typeof debouncedSaveState === 'function') debouncedSaveState();
        else saveStateToLocalStorage();
    }


    if (load.distanceKm) {
        const freightValue = calculateFreightValue(load.vehicleType, load.distanceKm);
        load.freightValue = freightValue; // Salva valor calculado
        if (typeof debouncedSaveState === 'function') debouncedSaveState();
        else saveStateToLocalStorage();


        if (freightValue > 0) {
            freightEl.innerHTML = `<i class="bi bi-cash-stack me-1"></i>R$ ${freightValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} <small>(${load.distanceKm}km)</small>`;
            freightEl.className = "load-meta-item badge bg-success text-white border border-success fw-bold ms-2";
        } else {
            // Se valor for 0 (ex: Van 'A combinar'), mostra texto informativo com KM
            freightEl.innerHTML = `<i class="bi bi-cash-stack me-1"></i>A Definir <small>(${load.distanceKm}km)</small>`;
            freightEl.className = "load-meta-item badge bg-secondary text-white border border-secondary fw-bold ms-2";
        }
        freightEl.classList.remove('d-none');
    } else {
        // Se não tem distância e está calculando, mostra spinner
        if (load.isCalculatingFreight) {
            freightEl.innerHTML = `<i class="spinner-border spinner-border-sm me-1" role="status"></i>Calculando KM...`;
            freightEl.className = "load-meta-item badge bg-info text-white border border-info fw-normal ms-2";
        } else {
            // Se não tem distância, mostra placeholder informativo amigável
            freightEl.innerHTML = `<i class="bi bi-calculator me-1"></i>Calc. KM p/ Frete`;
            freightEl.className = "load-meta-item badge bg-dark text-muted border border-secondary fw-normal ms-2";
        }
        freightEl.classList.remove('d-none');
    }
}



function recalcAllFreights() {
    Object.keys(activeLoads).forEach(loadId => {
        const load = activeLoads[loadId];
        if (load.distanceKm) {
            updateLoadFreightDisplay(loadId);
        }
    });
}


