// ================================================================================================
//  WEB WORKER - LÓGICA DE OTIMIZAÇÃO EM SEGUNDO PLANO
// ================================================================================================
// Este script é executado em uma thread separada para não travar a interface do usuário.

self.onmessage = async function(e) {
    const { 
        command, 
        packableGroups, 
        vehicleType, 
        optimizationLevel, 
        configs, 
        pedidosPrioritarios, 
        pedidosRecall 
    } = e.data;

    if (command === 'start-optimization') {
        try {
            let optimizationResult;
            switch (optimizationLevel) {
                case '1':
                    console.log(`WORKER: Executando Nível 1: Heurística Rápida para ${vehicleType}...`);
                    optimizationResult = runHeuristicOptimization(packableGroups, vehicleType, configs, pedidosPrioritarios, pedidosRecall);
                    break;
                case '2':
                default:
                    console.log(`WORKER: Executando Nível 2: Otimização Avançada (SA) para ${vehicleType}...`);
                    optimizationResult = await runSimulatedAnnealing(packableGroups, vehicleType, configs, pedidosPrioritarios, pedidosRecall);
                    break;
            }
            self.postMessage({ status: 'complete', result: optimizationResult });
        } catch (error) {
            console.error('WORKER: Erro durante a otimização:', error);
            self.postMessage({ status: 'error', message: error.message, stack: error.stack });
        }
    }

    if (command === 'roteirizar-e-montar') {
        try {
            const { pedidosEncontrados, vehicleType, useGeo, apiKey, configs, initialCityCoordsCache } = e.data;
            cityCoordsCache = initialCityCoordsCache || {}; // Initialize cache
            const result = await processarRoteirizacaoNoWorker(pedidosEncontrados, vehicleType, useGeo, apiKey, configs);
            self.postMessage({ status: 'complete', result: result });
        } catch (error) {
            console.error('WORKER: Erro durante a roteirização e montagem:', error);
            self.postMessage({ status: 'error', message: error.message, stack: error.stack });
        }
    }
    
    if (command === 'optimize-route-sequence') {
        try {
            const result = runSequenceOptimization(packableGroups, vehicleType, configs);
            self.postMessage({ status: 'complete', result: result });
        } catch (error) {
            self.postMessage({ status: 'error', message: error.message, stack: error.stack });
        }
    }
};

let cityCoordsCache = {};

async function getCityCoordinates(cidade, uf, apiKey) {
    const key = `${cidade.trim().toUpperCase()}-${uf.trim().toUpperCase()}`;
    if (cityCoordsCache[key]) return cityCoordsCache[key];
    if (!apiKey) return null;
    try {
        const query = `${cidade}, ${uf}, Brasil`;
        const response = await fetch(`https://graphhopper.com/api/1/geocode?q=${encodeURIComponent(query)}&key=${apiKey}`);
        if (!response.ok) return null;
        const data = await response.json();
        if (data.hits && data.hits.length > 0) {
            const point = data.hits[0].point;
            const coords = { lat: point.lat, lng: point.lng };
            cityCoordsCache[key] = coords;
            return coords;
        }
    } catch (e) {
        console.error(`WORKER: Erro ao buscar coordenadas para ${key}:`, e);
    }
    return null;
}

const specialClientNames = ['IRMAOS MUFFATO S.A', 'IRMAOS MUFFATO & CIA LTDA', 'FINCO & FINCO', 'BOM DIA', 'CASA VISCARD S/A COM. E IMPORTACAO', 'PRIMATO COOPERATIVA AGROINDUSTRIAL'];

const rotaVeiculoMap = {
    // Novas rotas de São Paulo (Varejo - Van/3/4)
    '2555': { type: 'van', title: 'Van / 3/4 São Paulo - Rota 2555' }, '2560': { type: 'van', title: 'Van / 3/4 São Paulo - Rota 2560' }, '2561': { type: 'van', title: 'Van / 3/4 São Paulo - Rota 2561' }, '2571': { type: 'van', title: 'Van / 3/4 São Paulo - Rota 2571' }, '2575': { type: 'van', title: 'Van / 3/4 São Paulo - Rota 2575' }, '2705': { type: 'van', title: 'Van / 3/4 São Paulo - Rota 2705' }, '2735': { type: 'van', title: 'Van / 3/4 São Paulo - Rota 2735' }, '2745': { type: 'van', title: 'Van / 3/4 São Paulo - Rota 2745' },
    // Rotas do Paraná (Varejo)
    '11101': { type: 'fiorino', title: 'Rota 11101' }, '11301': { type: 'fiorino', title: 'Rota 11301' }, '11311': { type: 'fiorino', title: 'Rota 11311' }, '11561': { type: 'fiorino', title: 'Rota 11561' }, '11721': { type: 'fiorino', title: 'Rotas 11721 & 11731', combined: ['11731'] }, '11731': { type: 'fiorino', title: 'Rotas 11721 & 11731', combined: ['11721'] },
    '11102': { type: 'fiorino', title: 'Rota 11102' }, '11331': { type: 'fiorino', title: 'Rota 11331' }, '11341': { type: 'van', title: 'Rota 11341' }, '11342': { type: 'van', title: 'Rota 11342' }, '11351': { type: 'van', title: 'Rota 11351' }, '11521': { type: 'van', title: 'Rota 11521' }, '11531': { type: 'van', title: 'Rota 11531' }, '11551': { type: 'fiorino', title: 'Rota 11551' }, '11571': { type: 'fiorino', title: 'Rota 11571' }, '11701': { type: 'van', title: 'Rota 11701' }, '11711': { type: 'fiorino', title: 'Rota 11711' },
    '11361': { type: 'tresQuartos', title: 'Rota 11361' }, '11501': { type: 'tresQuartos', title: 'Rotas 11501, 11502 & 11511', combined: ['11502', '11511'] }, '11502': { type: 'tresQuartos', title: 'Rotas 11501, 11502 & 11511', combined: ['11501', '11511'] }, '11511': { type: 'tresQuartos', title: 'Rotas 11501, 11502 & 11511', combined: ['11501', '11502'] }, '11541': { type: 'tresQuartos', title: 'Rota 11541' }
};

const isNumeric = (str) => str && /^\d+$/.test(String(str).trim());

function normalizeClientId(id) {
    if (id === null || typeof id === 'undefined') return '';
    return String(id).trim().replace(/^0+/, '');
}

function checkAgendamento(pedido) {
    if (!pedido) return;
    const normalizedCode = normalizeClientId(pedido.Cliente);
    pedido.Agendamento = agendamentoClientCodes.has(normalizedCode) ? 'Sim' : 'Não';
}

const isSpecialClient = (p) => p.Nome_Cliente && specialClientNames.includes(p.Nome_Cliente.toUpperCase().trim());

function getVehicleConfig(vehicleType, configs) {
    const typeMap = {
        fiorino: 'fiorino',
        van: 'van',
        tresQuartos: 'tresQuartos',
        '3/4': 'tresQuartos',
        toco: 'toco',
        truck: 'toco'
    };
    const configType = typeMap[vehicleType];
    if (!configType) return null;

    return {
        minKg: configs[`${configType}MinCapacity`],
        softMaxKg: configs[`${configType}MaxCapacity`],
        softMaxCubagem: configs[`${configType}Cubage`],
        hardMaxKg: configs[`${configType}HardMaxCapacity`] || configs[`${configType}MaxCapacity`],
        hardMaxCubage: configs[`${configType}HardCubage`] || configs[`${configType}Cubage`]
    };
}

function isMoveValid(load, groupToAdd, vehicleType, configs) {
    // CORREÇÃO: Usa o tipo de veículo da carga ('load.vehicleType') se ele existir,
    // caso contrário, usa o tipo de veículo padrão passado para a função.
    // Isso garante que a validação use o tipo correto após uma transformação manual (ex: Fiorino -> Van).
    const effectiveVehicleType = load.vehicleType || vehicleType;
    const config = getVehicleConfig(effectiveVehicleType, configs);
    if (!config) return false;

    if ((load.totalKg + groupToAdd.totalKg) > config.hardMaxKg) return false;
    if ((load.totalCubagem + groupToAdd.totalCubagem) > config.hardMaxCubage) return false;

    if (groupToAdd.isSpecial) {
        const specialClientIdsInLoad = new Set(
            load.pedidos
                .filter(isSpecialClient)
                .map(p => normalizeClientId(p.Cliente))
        );
        const groupToAddClientId = normalizeClientId(groupToAdd.pedidos[0].Cliente);
        // REGRA: Permite no máximo 2 clientes especiais por carga (Volta ao padrão anterior, mas com validação rigorosa).
        if (!specialClientIdsInLoad.has(groupToAddClientId) && specialClientIdsInLoad.size >= 2) {
            return false;
        }
    }

    if (groupToAdd.pedidos.some(p => p.Agendamento === 'Sim') && load.pedidos.some(p => p.Agendamento === 'Sim')) return false;

    return true;
}

function createSolutionFromHeuristic(itemsParaEmpacotar, vehicleType, configs, pedidosPrioritarios, pedidosRecall) {
    const config = getVehicleConfig(vehicleType, configs);
    let loads = [];
    let leftoverItems = [];

    itemsParaEmpacotar.forEach(item => {
        if (item.totalKg > config.hardMaxKg || item.totalCubagem > config.hardMaxCubage) {
            leftoverItems.push(item); return;
        }
        
        let bestFit = null;
        for (const load of loads) {
            if (isMoveValid(load, item, vehicleType, configs)) {
                const remainingCapacity = config.hardMaxKg - (load.totalKg + item.totalKg);
                if (bestFit === null || remainingCapacity < bestFit.remainingCapacity) {
                    bestFit = { load: load, remainingCapacity: remainingCapacity };
                }
            }
        }

        if (bestFit) {
            bestFit.load.pedidos.push(...item.pedidos);
            bestFit.load.totalKg += item.totalKg;
            bestFit.load.totalCubagem += item.totalCubagem;
            bestFit.load.usedHardLimit = bestFit.load.totalKg > config.softMaxKg || bestFit.load.totalCubagem > config.softMaxCubage;
        } else {
            loads.push({
                pedidos: [...item.pedidos],
                totalKg: item.totalKg,
                totalCubagem: item.totalCubagem,
                isSpecial: item.isSpecial,
                usedHardLimit: (item.totalKg > config.softMaxKg || item.totalCubagem > config.softMaxCubage)
            });
        }
    });
    
    let finalLoads = [];
    let unplacedGroups = [];

    loads.forEach(load => {
        // A validação da carga agora depende apenas de atingir o peso mínimo.
        // A prioridade de um pedido é usada para ordenar e tentar encaixá-lo primeiro, mas não para forçar uma carga sub-mínima.
        if (load.pedidos.length > 0 && load.totalKg >= config.minKg) { 
            finalLoads.push(load);
        } else if (load.pedidos.length > 0) {
            const clientGroupsInFailedLoad = Object.values(load.pedidos.reduce((acc, p) => {
                const clienteId = normalizeClientId(p.Cliente);
                if (!acc[clienteId]) { acc[clienteId] = { pedidos: [], totalKg: 0, totalCubagem: 0, isSpecial: isSpecialClient(p) }; }
                acc[clienteId].pedidos.push(p);
                acc[clienteId].totalKg += p.Quilos_Saldo;
                acc[clienteId].totalCubagem += p.Cubagem;
                return acc;
            }, {}));
            unplacedGroups.push(...clientGroupsInFailedLoad);
        }
    });
    
    const leftovers = [...leftoverItems, ...unplacedGroups];
    return { loads: finalLoads, leftovers };
}

function runHeuristicOptimization(packableGroups, vehicleType, configs, pedidosPrioritarios, pedidosRecall) {
    // Função de ordenação principal que prioriza a data mais antiga.
    const dateSorter = (a, b) => { // prettier-ignore
        if (a.oldestDate && b.oldestDate) {
            if (a.oldestDate < b.oldestDate) return -1;
            if (a.oldestDate > b.oldestDate) return 1;
        } else if (a.oldestDate) {
            return -1;
        } else if (b.oldestDate) {
            return 1;
        }
        return 0; // Se as datas forem iguais ou ambas nulas, não há preferência.
    };

    const strategies = [
        { name: 'priority-weight-desc', sorter: (a, b) => { // prettier-ignore
            const dateCompare = dateSorter(a, b); if (dateCompare !== 0) return dateCompare;
            const aHasPrio = a.pedidos.some(p => pedidosPrioritarios.includes(String(p.Num_Pedido))); const bHasPrio = b.pedidos.some(p => pedidosPrioritarios.includes(String(p.Num_Pedido)));
            if (aHasPrio && !bHasPrio) return -1; if (!aHasPrio && bHasPrio) return 1;
            return b.totalKg - a.totalKg; }
        },
        { name: 'scheduled-weight-desc', sorter: (a, b) => { // prettier-ignore
            const dateCompare = dateSorter(a, b); if (dateCompare !== 0) return dateCompare;
            const aHasSched = a.pedidos.some(p => p.Agendamento === 'Sim'); const bHasSched = b.pedidos.some(p => p.Agendamento === 'Sim');
            if (aHasSched && !bHasSched) return -1; if (!aHasSched && bHasSched) return 1;
            return b.totalKg - a.totalKg; }
        },
        { name: 'weight-desc', sorter: (a, b) => { // prettier-ignore
            const dateCompare = dateSorter(a, b); if (dateCompare !== 0) return dateCompare;
            return b.totalKg - a.totalKg; }
        },
        { name: 'weight-asc', sorter: (a, b) => { // prettier-ignore
            const dateCompare = dateSorter(a, b); if (dateCompare !== 0) return dateCompare;
            return a.totalKg - b.totalKg; }
        }
    ];

    let bestResult = null;

    for (const strategy of strategies) {
        const sortedGroups = [...packableGroups].sort(strategy.sorter);
        const result = createSolutionFromHeuristic(sortedGroups, vehicleType, configs, pedidosPrioritarios, pedidosRecall);
        
        const leftoverWeight = result.leftovers.reduce((sum, g) => sum + g.totalKg, 0);

        if (bestResult === null || leftoverWeight < bestResult.leftoverWeight) {
            bestResult = { ...result, leftoverWeight: leftoverWeight, strategy: strategy.name };
        }
    }
    
    return bestResult;
}

function getSolutionEnergy(solution, vehicleType, configs) {
    const config = getVehicleConfig(vehicleType, configs);
    const balancingFactor = 0.01;

    // MODIFICAÇÃO: Penalidade por idade para garantir prioridade aos pedidos antigos.
    // Quanto mais antigo o pedido, maior o "peso" dele na sobra, incentivando o algoritmo a encaixá-lo.
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    const leftoverWeight = solution.leftovers.reduce((sum, group) => {
        let weightMultiplier = 1;
        if (group.oldestDate) {
            const date = new Date(group.oldestDate);
            if (!isNaN(date.getTime())) {
                const ageInMillis = Math.max(0, now - date.getTime());
                const ageInDays = ageInMillis / oneDay;
                weightMultiplier = 1 + (ageInDays * 0.1); // 10% de penalidade extra por dia de atraso
            }
        }
        return sum + (group.totalKg * weightMultiplier);
    }, 0);
    
    const loadPenalty = solution.loads.reduce((sum, load) => {
        if (load.totalKg > 0 && load.totalKg < config.minKg) {
            return sum + 1000 + (config.minKg - load.totalKg);
        }
        return sum;
    }, 0);

    let balancePenalty = 0;
    if (solution.loads.length > 1) {
        const weights = solution.loads.map(l => l.totalKg);
        const averageWeight = weights.reduce((sum, w) => sum + w, 0) / weights.length;
        const variance = weights.reduce((sum, w) => sum + Math.pow(w - averageWeight, 2), 0) / weights.length;
        balancePenalty = variance * balancingFactor;
    }

    return leftoverWeight + loadPenalty + balancePenalty;
}

async function runSimulatedAnnealing(packableGroups, vehicleType, configs, pedidosPrioritarios, pedidosRecall) {
    return new Promise(async (resolve) => {
        const initialTemp = 1000;
        const coolingRate = 0.993;
        const iterationsPerTemp = 200;

        // A ordenação inicial agora também prioriza a data mais antiga como critério principal,
        // seguido por prioridade manual e depois peso.
        const initialSortedGroups = [...packableGroups].sort((a, b) => { // prettier-ignore
            if (a.oldestDate && b.oldestDate) {
                if (a.oldestDate < b.oldestDate) return -1;
                if (a.oldestDate > b.oldestDate) return 1;
            } else if (a.oldestDate) { return -1; } 
              else if (b.oldestDate) { return 1; }
            const aHasPrio = a.pedidos.some(p => pedidosPrioritarios.includes(String(p.Num_Pedido))); const bHasPrio = b.pedidos.some(p => pedidosPrioritarios.includes(String(p.Num_Pedido)));
            if (aHasPrio && !bHasPrio) return -1; if (!aHasPrio && bHasPrio) return 1;
            return b.totalKg - a.totalKg;
        });

        let bestSolution = createSolutionFromHeuristic(initialSortedGroups, vehicleType, configs, pedidosPrioritarios, pedidosRecall);
        let currentSolution = JSON.parse(JSON.stringify(bestSolution));

        let currentTemp = initialTemp;
        
        while (currentTemp > 1) {
             for (let i = 0; i < iterationsPerTemp; i++) {
                 let neighborSolution = JSON.parse(JSON.stringify(currentSolution));
                 let moveMade = false;

                 const moveType = Math.random();
                 if (moveType < 0.7 && neighborSolution.leftovers.length > 0) {
                     const leftoverIndex = Math.floor(Math.random() * neighborSolution.leftovers.length);
                     const groupToPlace = neighborSolution.leftovers[leftoverIndex];
                     const targetLoadIndex = neighborSolution.loads.length > 0 ? Math.floor(Math.random() * (neighborSolution.loads.length + 1)) : 0;

                     if (targetLoadIndex < neighborSolution.loads.length) {
                         const targetLoad = neighborSolution.loads[targetLoadIndex];
                         if(isMoveValid(targetLoad, groupToPlace, vehicleType, configs)) {
                             targetLoad.pedidos.push(...groupToPlace.pedidos);
                             targetLoad.totalKg += groupToPlace.totalKg;
                             targetLoad.totalCubagem += groupToPlace.totalCubagem;
                             neighborSolution.leftovers.splice(leftoverIndex, 1);
                             moveMade = true;
                         }
                     } else if (isMoveValid({pedidos:[], totalKg:0, totalCubagem:0}, groupToPlace, vehicleType, configs)) { 
                         neighborSolution.loads.push(groupToPlace);
                         neighborSolution.leftovers.splice(leftoverIndex, 1);
                         moveMade = true;
                     }
                 } else if (neighborSolution.loads.length > 0) {
                     const loadIndex = Math.floor(Math.random() * neighborSolution.loads.length);
                     const load = neighborSolution.loads[loadIndex];
                     
                     if (load.pedidos.length > 0) {
                         const clientGroupsInLoad = Object.values(load.pedidos.reduce((acc, p) => {
                             const cId = normalizeClientId(p.Cliente);
                             if (!acc[cId]) acc[cId] = { pedidos: [], totalKg: 0, totalCubagem: 0, isSpecial: isSpecialClient(p) };
                             acc[cId].pedidos.push(p); acc[cId].totalKg += p.Quilos_Saldo; acc[cId].totalCubagem += p.Cubagem;
                             return acc;
                         }, {}));

                         if(clientGroupsInLoad.length > 0) {
                             const groupIndexToRemove = Math.floor(Math.random() * clientGroupsInLoad.length);
                             const groupToMove = clientGroupsInLoad[groupIndexToRemove];
                             
                             const idsToRemove = new Set(groupToMove.pedidos.map(p => p.Num_Pedido));
                             load.pedidos = load.pedidos.filter(p => !idsToRemove.has(p.Num_Pedido));
                             load.totalKg -= groupToMove.totalKg;
                             load.totalCubagem -= groupToMove.totalCubagem;
                             if(load.pedidos.length === 0) neighborSolution.loads.splice(loadIndex,1);

                             neighborSolution.leftovers.push(groupToMove);
                             moveMade = true;
                         }
                     }
                 }
                 
                 if(moveMade){
                     const currentEnergy = getSolutionEnergy(currentSolution, vehicleType, configs);
                     const neighborEnergy = getSolutionEnergy(neighborSolution, vehicleType, configs);

                     if (neighborEnergy < currentEnergy || Math.random() < Math.exp((currentEnergy - neighborEnergy) / currentTemp)) {
                         currentSolution = neighborSolution;
                         if (getSolutionEnergy(currentSolution, vehicleType, configs) < getSolutionEnergy(bestSolution, vehicleType, configs)) {
                             bestSolution = JSON.parse(JSON.stringify(currentSolution));
                         }
                     }
                 }
             }

             currentTemp *= coolingRate;
             const progress = Math.min(100, 100 * (1 - Math.log(currentTemp) / Math.log(initialTemp)));
             self.postMessage({ status: 'progress', progress: progress });
             
             // Pausa brevemente para permitir que a thread do worker envie mensagens e não trave.
             await new Promise(r => setTimeout(r, 0));
        }

        let finalLoads = [];
        let finalLeftovers = [...bestSolution.leftovers];
        bestSolution.loads.forEach(load => {
            const effectiveVehicleType = load.vehicleType || vehicleType;
            const config = getVehicleConfig(effectiveVehicleType, configs);

            if (!config) {
                if (load.pedidos.length > 0) {
                    const groups = Object.values(load.pedidos.reduce((acc, p) => { 
                        const cId = normalizeClientId(p.Cliente);
                        if (!acc[cId]) acc[cId] = { pedidos: [], totalKg: 0, totalCubagem: 0, isSpecial: isSpecialClient(p) };
                        acc[cId].pedidos.push(p); acc[cId].totalKg += p.Quilos_Saldo; acc[cId].totalCubagem += p.Cubagem;
                        return acc; 
                    }, {}));
                    finalLeftovers.push(...groups);
                }
                return;
            }

        // A validação da carga agora depende apenas de atingir o peso mínimo.
        if (load.pedidos.length > 0 && load.totalKg >= config.minKg) {
                finalLoads.push(load);
            } else if (load.pedidos.length > 0) {
                const groups = Object.values(load.pedidos.reduce((acc, p) => { 
                    const cId = normalizeClientId(p.Cliente);
                    if (!acc[cId]) acc[cId] = { pedidos: [], totalKg: 0, totalCubagem: 0, isSpecial: isSpecialClient(p) };
                    acc[cId].pedidos.push(p); acc[cId].totalKg += p.Quilos_Saldo; acc[cId].totalCubagem += p.Cubagem;
                    return acc; 
                }, {}));
                finalLeftovers.push(...groups);
            }
        });
        resolve({ loads: finalLoads, leftovers: finalLeftovers });
    });
}

function runSequenceOptimization(orderedGroups, vehicleType, configs) {
    const config = getVehicleConfig(vehicleType, configs);
    let loads = [];
    let currentLoad = { pedidos: [], totalKg: 0, totalCubagem: 0, vehicleType: vehicleType };
    let leftovers = [];

    orderedGroups.forEach(group => {
        // Verifica limites absolutos do grupo
        if (group.totalKg > config.hardMaxKg || group.totalCubagem > config.hardMaxCubage) {
            leftovers.push(group);
            return;
        }

        // Tenta adicionar à carga atual respeitando TODAS as regras (peso, cubagem, mix de clientes, agendamento)
        if (isMoveValid(currentLoad, group, vehicleType, configs)) {
            currentLoad.pedidos.push(...group.pedidos);
            currentLoad.totalKg += group.totalKg;
            currentLoad.totalCubagem += group.totalCubagem;
            currentLoad.usedHardLimit = (currentLoad.totalKg > config.softMaxKg || currentLoad.totalCubagem > config.softMaxCubage);
        } else {
            // Se não couber, fecha a carga atual (se tiver itens) e abre uma nova
            if (currentLoad.pedidos.length > 0) {
                loads.push(currentLoad);
            }
            // Inicia nova carga com o grupo atual
            currentLoad = { 
                pedidos: [...group.pedidos], 
                totalKg: group.totalKg, 
                totalCubagem: group.totalCubagem, 
                vehicleType: vehicleType,
                usedHardLimit: (group.totalKg > config.softMaxKg || group.totalCubagem > config.softMaxCubage)
            };
        }
    });
    
    // Adiciona a última carga se não estiver vazia
    if (currentLoad.pedidos.length > 0) {
        loads.push(currentLoad);
    }

    // Filtra cargas que não atingem o peso mínimo
    let finalLoads = [];
    let unplacedGroups = [];

    loads.forEach(load => {
        if (load.totalKg >= config.minKg) {
            finalLoads.push(load);
        } else {
            const clientGroupsInFailedLoad = Object.values(load.pedidos.reduce((acc, p) => {
                const clienteId = normalizeClientId(p.Cliente);
                if (!acc[clienteId]) { acc[clienteId] = { pedidos: [], totalKg: 0, totalCubagem: 0, isSpecial: isSpecialClient(p) }; }
                acc[clienteId].pedidos.push(p);
                acc[clienteId].totalKg += p.Quilos_Saldo;
                acc[clienteId].totalCubagem += p.Cubagem;
                return acc;
            }, {}));
            unplacedGroups.push(...clientGroupsInFailedLoad);
        }
    });

    return { loads: finalLoads, leftovers: [...leftovers, ...unplacedGroups] };
}

function deg2rad(deg) { return deg * (Math.PI / 180); }

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Raio da Terra em km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

async function processarRoteirizacaoNoWorker(pedidosEncontrados, vehicleType, useGeo, apiKey, configs) {
    // 1. Group by city
    self.postMessage({ status: 'progress-update', text: 'Agrupando pedidos por cidade...' });
    const cityGroups = {};
    pedidosEncontrados.forEach(p => {
        const key = `${(p.Cidade || '').trim().toUpperCase()} - ${(p.UF || '').trim().toUpperCase()}`;
        if (!cityGroups[key]) cityGroups[key] = [];
        cityGroups[key].push(p);
    });

    let sortedCities = Object.keys(cityGroups);

    // 2. Geocode and sort cities
    if (useGeo && apiKey) {
        self.postMessage({ status: 'progress-update', text: 'Otimizando sequência de entrega...' });
        const cityCoords = [];
        for (let i = 0; i < sortedCities.length; i++) {
            const cityKey = sortedCities[i];
            const [cidade, uf] = cityKey.split(' - ');
            const coords = await getCityCoordinates(cidade, uf, apiKey);
            if (coords) cityCoords.push({ key: cityKey, ...coords });
            else cityCoords.push({ key: cityKey, lat: 0, lng: 0 });
            self.postMessage({ status: 'progress', progress: 30 + (i / sortedCities.length) * 40 });
        }
        
        const depot = { lat: -23.31461, lng: -51.36963 };
        let current = depot;
        const unvisited = [...cityCoords];
        const path = [];
        
        while (unvisited.length > 0) {
            let nearestIdx = -1;
            let minDist = Infinity;
            for (let i = 0; i < unvisited.length; i++) {
                const d = calculateDistance(current.lat, current.lng, unvisited[i].lat, unvisited[i].lng);
                if (d < minDist) { minDist = d; nearestIdx = i; }
            }
            if (nearestIdx !== -1) {
                path.push(unvisited[nearestIdx].key);
                current = unvisited[nearestIdx];
                unvisited.splice(nearestIdx, 1);
            } else { 
                path.push(unvisited[0].key); 
                unvisited.splice(0, 1); 
            }
        }
        sortedCities = path;
    } else {
        sortedCities.sort();
    }

    // 3. Create sorted order list and group by client
    self.postMessage({ status: 'progress-update', text: 'Preparando dados para o otimizador...' });
    const sortedOrders = [];
    sortedCities.forEach(cityKey => {
        const ordersInCity = cityGroups[cityKey].sort((a, b) => (a.Nome_Cliente || '').localeCompare(b.Nome_Cliente || ''));
        sortedOrders.push(...ordersInCity);
    });
    
    const packableGroups = [];
    const clientMap = new Map();
    
    sortedOrders.forEach(p => {
        const cId = normalizeClientId(p.Cliente);
        if (!clientMap.has(cId)) {
            const group = { pedidos: [], totalKg: 0, totalCubagem: 0, isSpecial: isSpecialClient(p) };
            clientMap.set(cId, group);
            packableGroups.push(group);
        }
        const group = clientMap.get(cId);
        group.pedidos.push(p);
        group.totalKg += p.Quilos_Saldo;
        group.totalCubagem += p.Cubagem;
    });

    // 4. Run packing optimization
    self.postMessage({ status: 'progress-update', text: 'Montando cargas com algoritmo avançado...' });
    self.postMessage({ status: 'progress', progress: 80 });
    const packingResult = runSequenceOptimization(packableGroups, vehicleType, configs);
    let loads = packingResult.loads;
    packingResult.discardedMessages = [];

    // 5. Distance check for Fiorino/Van
    if ((vehicleType === 'fiorino' || vehicleType === 'van') && useGeo && apiKey) {
        const distanceLimit = vehicleType === 'fiorino' ? 500 : 1000;
        const validLoads = [];
        const depot = { lat: -23.31461, lng: -51.36963 };
        
        for (const load of loads) {
            const citiesInLoad = [...new Set(load.pedidos.map(p => `${(p.Cidade || '').trim().toUpperCase()} - ${(p.UF || '').trim().toUpperCase()}`))];
            let totalDistKm = 0;
            let currentPos = depot;
            for (const cityKey of citiesInLoad) {
                const [cidade, uf] = cityKey.split(' - ');
                const coords = await getCityCoordinates(cidade, uf, apiKey);
                if (coords) { totalDistKm += calculateDistance(currentPos.lat, currentPos.lng, coords.lat, coords.lng); currentPos = coords; }
            }
            totalDistKm += calculateDistance(currentPos.lat, currentPos.lng, depot.lat, depot.lng);
            const estimatedRoadDist = totalDistKm * 1.3;
            if (estimatedRoadDist <= distanceLimit) { validLoads.push(load); } 
            else { packingResult.discardedMessages.push(`Carga ${vehicleType} descartada: Rota estimada em ${estimatedRoadDist.toFixed(0)}km (>${distanceLimit}km).`); }
        }
        loads = validLoads;
    }
    
    self.postMessage({ status: 'progress', progress: 100 });
    packingResult.loads = loads;
    packingResult.sortedCities = sortedCities;
    return packingResult;
}

