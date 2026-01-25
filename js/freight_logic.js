
// --- FREIGHT SYSTEM LOGIC ---

const defaultFreightConfig = {
    fiorino: { limit: 300, fixed: 225.00, rate: 1.80 },
    van: { limit: 500, tableValue: 0.00, rate: 1.80 },
    tresQuartos: { limit: 500, tableValue: 0.00, rate: 2.85 },
    toco: { limit: 500, tableValue: 0.00, rate: 3.45 }
};

function getFreightConfig() {
    const stored = localStorage.getItem('apexFreightConfig');
    if (stored) return { ...defaultFreightConfig, ...JSON.parse(stored) };
    return defaultFreightConfig;
}

function saveFreightConfig() {
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

    showToast("Configurações de frete salvas com sucesso!", "success");
}

function updateFreightTableUI() {
    const config = getFreightConfig();

    // Popula Inputs
    document.getElementById('fiorinoLimit').value = config.fiorino.limit;
    document.getElementById('fiorinoFixed').value = config.fiorino.fixed.toFixed(2);
    document.getElementById('fiorinoRate').value = config.fiorino.rate.toFixed(2);

    document.getElementById('vanLimit').value = config.van.limit;
    document.getElementById('vanTableValue').value = config.van.tableValue.toFixed(2);
    document.getElementById('vanRate').value = config.van.rate.toFixed(2);

    document.getElementById('truck34Limit').value = config.tresQuartos.limit;
    document.getElementById('truck34TableValue').value = config.tresQuartos.tableValue.toFixed(2);
    document.getElementById('truck34Rate').value = config.tresQuartos.rate.toFixed(2);

    document.getElementById('tocoLimit').value = config.toco.limit;
    document.getElementById('tocoTableValue').value = config.toco.tableValue.toFixed(2);
    document.getElementById('tocoRate').value = config.toco.rate.toFixed(2);

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

function updateLoadFreightDisplay(loadId, distanceKm) {
    const load = activeLoads[loadId];
    if (!load) return;

    // Atualiza a distância no objeto load se fornecida
    if (distanceKm) {
        load.distanceKm = parseFloat(distanceKm);
        saveStateToLocalStorage();
    }

    // Se não tem distância salva, não calcula
    if (!load.distanceKm) return;

    const freightValue = calculateFreightValue(load.vehicleType, load.distanceKm);
    load.freightValue = freightValue; // Salva valor calculado
    saveStateToLocalStorage();

    const freightEl = document.getElementById(`freight-${loadId}`);
    if (freightEl) {
        if (freightValue > 0) {
            freightEl.innerHTML = `<i class="bi bi-cash-stack me-1"></i>R$ ${freightValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
            freightEl.classList.remove('d-none');
        } else {
            // Se valor for 0 (ex: tabela não definida), mostra aviso?
            if (load.distanceKm <= (getFreightConfig()[load.vehicleType]?.limit || 0)) {
                freightEl.innerHTML = `<i class="bi bi-cash-stack me-1"></i>A Definir (Tab)`;
                freightEl.classList.remove('d-none');
            } else {
                freightEl.classList.add('d-none');
            }
        }
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

