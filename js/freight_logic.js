
// --- FREIGHT SYSTEM LOGIC ---

const defaultFreightConfig = {
    fiorino: { limit: 300, fixed: 225.00, rate: 1.80 },
    van: { limit: 500, tableValue: 0.00, rate: 1.80 },
    tresQuartos: { limit: 500, tableValue: 0.00, rate: 2.85 },
    toco: { limit: 500, tableValue: 0.00, rate: 3.45 }
};

function getFreightConfig() {
    const stored = localStorage.getItem('apexFreightConfig');
    let config = { ...defaultFreightConfig };

    if (stored) {
        try {
            const parsed = JSON.parse(stored);
            // Merge robusto: garante que cada tipo de veículo tenha todas as propriedades
            Object.keys(defaultFreightConfig).forEach(vType => {
                if (parsed[vType]) {
                    config[vType] = { ...defaultFreightConfig[vType], ...parsed[vType] };
                }
            });
        } catch (e) {
            console.error("Erro ao ler configuração de frete:", e);
        }
    }
    return config;
}

function saveFreightConfig() {
    try {
        const config = {
            fiorino: {
                limit: parseFloat(document.getElementById('fiorinoLimit').value) || 0,
                fixed: parseFloat(document.getElementById('fiorinoFixed').value) || 0,
                rate: parseFloat(document.getElementById('fiorinoRate').value) || 0
            },
            van: {
                limit: parseFloat(document.getElementById('vanLimit').value) || 0,
                tableValue: parseFloat(document.getElementById('vanTableValue').value) || 0,
                rate: parseFloat(document.getElementById('vanRate').value) || 0
            },
            tresQuartos: {
                limit: parseFloat(document.getElementById('truck34Limit').value) || 0,
                tableValue: parseFloat(document.getElementById('truck34TableValue').value) || 0,
                rate: parseFloat(document.getElementById('truck34Rate').value) || 0
            },
            toco: {
                limit: parseFloat(document.getElementById('tocoLimit').value) || 0,
                tableValue: parseFloat(document.getElementById('tocoTableValue').value) || 0,
                rate: parseFloat(document.getElementById('tocoRate').value) || 0
            }
        };
        localStorage.setItem('apexFreightConfig', JSON.stringify(config));

        // Atualiza a tabela visual
        updateFreightTableUI();

        // Recalcula fretes de todas as cargas ativas se tiverem distância
        recalcAllFreights();

        if (typeof showToast === 'function') {
            showToast("Configurações de frete salvas com sucesso!", "success");
        }
    } catch (e) {
        console.error("Erro ao salvar configuração de frete:", e);
        if (typeof showToast === 'function') {
            showToast("Erro ao salvar configurações.", "error");
        }
    }
}

function updateFreightTableUI() {
    try {
        const config = getFreightConfig();

        // Popula Inputs (se existirem na página/modal atual)
        const inputs = [
            { id: 'fiorinoLimit', val: config.fiorino.limit },
            { id: 'fiorinoFixed', val: config.fiorino.fixed },
            { id: 'fiorinoRate', val: config.fiorino.rate },
            { id: 'vanLimit', val: config.van.limit },
            { id: 'vanTableValue', val: config.van.tableValue },
            { id: 'vanRate', val: config.van.rate },
            { id: 'truck34Limit', val: config.tresQuartos.limit },
            { id: 'truck34TableValue', val: config.tresQuartos.tableValue },
            { id: 'truck34Rate', val: config.tresQuartos.rate },
            { id: 'tocoLimit', val: config.toco.limit },
            { id: 'tocoTableValue', val: config.toco.tableValue },
            { id: 'tocoRate', val: config.toco.rate }
        ];

        console.log("Atualizando UI da Tabela de Fretes com config:", config);

        inputs.forEach(item => {

            const el = document.getElementById(item.id);
            if (el) {
                el.value = typeof item.val === 'number' ? item.val.toFixed(2).replace('.00', '') : item.val;
            }
        });

        // Popula Tabela Visual
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
                    <td>Até ${config.van.limit}km: Tabela<br>Acima: R$ ${config.van.rate}/km</td>
                    <td><strong>${config.van.tableValue > 0 ? 'R$ ' + config.van.tableValue.toFixed(2) : 'A definir'}</strong> (Tabela)<br><span class="text-muted">Excedente: R$ ${config.van.rate} / km</span></td>
                </tr>
                <tr>
                    <td><i class="bi bi-truck-flatbed me-2 text-warning"></i>3/4</td>
                    <td>Até ${config.tresQuartos.limit}km: Tabela<br>Acima: R$ ${config.tresQuartos.rate}/km</td>
                    <td><strong>${config.tresQuartos.tableValue > 0 ? 'R$ ' + config.tresQuartos.tableValue.toFixed(2) : 'A definir'}</strong> (Tabela)<br><span class="text-muted">Excedente: R$ ${config.tresQuartos.rate} / km</span></td>
                </tr>
                <tr>
                    <td><i class="bi bi-inboxes-fill me-2 text-secondary"></i>Toco</td>
                    <td>Até ${config.toco.limit}km: Tabela<br>Acima: R$ ${config.toco.rate}/km</td>
                    <td><strong>${config.toco.tableValue > 0 ? 'R$ ' + config.toco.tableValue.toFixed(2) : 'A definir'}</strong> (Tabela)<br><span class="text-muted">Excedente: R$ ${config.toco.rate} / km</span></td>
                </tr>
            `;
        }
    } catch (e) {
        console.error("Erro ao atualizar UI de frete:", e);
    }
}

function calculateFreightValue(vehicleType, distanceKm) {
    if (!distanceKm || distanceKm <= 0) return 0;
    const config = getFreightConfig()[vehicleType];
    if (!config) return 0;

    let freight = 0;

    if (vehicleType === 'fiorino') {
        if (distanceKm <= config.limit) {
            freight = config.fixed;
        } else {
            // Regra: "Passar de 300km eles ganham 1,80 o rodado". 
            // Interpretação: O valor TOTAL é (distância * taxa) ou (fixo + excedente)?
            // Geralmente "ganham X o rodado" significa X * KM TOTAL.
            // Se fosse excedente, diria "X por km excedente".
            // Vou assumir X * KM TOTAL se passar do limite, mas se for menor, paga o fixo.
            // Mas se 301km * 1.80 = 541, e 300km = 225. É um salto grande?
            // 300 * 1.80 = 540.
            // Então 225 é um valor MÍNIMO garantido ou tabela específica?
            // O prompt diz: "se passar de 300 ganham 1,80 o rodado, se for ate 300 ganham 225 fixo".
            // Isso implica logicamente: Distância <= 300 -> 225. Distância > 300 -> Distância * 1.80.
            freight = distanceKm * config.rate;
        }
    } else {
        // Vans, 3/4, Toco: "se passar de X ganham Y o rodado".
        // Mesma lógica. Se <= X, ganham "Tabela".
        if (distanceKm <= config.limit) {
            freight = config.tableValue;
        } else {
            freight = distanceKm * config.rate;
        }
    }

    return freight;
}

function updateLoadFreightDisplay(loadId, distanceKm = null) {
    const load = activeLoads[loadId];
    const freightEl = document.getElementById(`freight-${loadId}`);
    if (!load || !freightEl) return;

    // Atualiza a distância no objeto load se fornecida
    if (distanceKm !== null) {
        console.log(`UpdateFreight: Recebido ${distanceKm}km para carga ${loadId} (${load.vehicleType})`);
        load.distanceKm = parseFloat(distanceKm);
        saveStateToLocalStorage();
    }


    if (load.distanceKm) {
        const freightValue = calculateFreightValue(load.vehicleType, load.distanceKm);
        load.freightValue = freightValue; // Salva valor calculado
        saveStateToLocalStorage();

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


