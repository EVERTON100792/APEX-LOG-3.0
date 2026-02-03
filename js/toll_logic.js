
// ================================================================================================
//  MODULO DE PEDÁGIOS (Overpass API)
// ================================================================================================

/**
 * Busca praças de pedágio dentro do bounding box da rota e filtra as que estão próximas à linha da rota.
 * @param {L.LatLngBounds} bounds - Limites visuais do mapa.
 * @param {Array<L.LatLng>} routePoints - Pontos da polilinha da rota.
 * @param {Array<Object>} stops - Lista de paradas (locations) com coordenadas e nomes.
 * @returns {Promise<Array>} Lista de pedágios encontrados.
 */
/**
 * Busca praças de pedágio dentro do bounding box da rota e filtra as que estão próximas à linha da rota.
 * Implementa fallback para múltiplos servidores Overpass em caso de erro 504/Too Many Requests.
 * @param {L.LatLngBounds} bounds - Limites visuais do mapa.
 * @param {Array<L.LatLng>} routePoints - Pontos da polilinha da rota.
 * @param {Array<Object>} stops - Lista de paradas (locations) com coordenadas e nomes.
 * @returns {Promise<Array>} Lista de pedágios encontrados.
 */

// LISTA DE EXCESSÕES: Pedágios conhecidos que devem ser forçados como DESATIVADOS
const KNOWN_INACTIVE_TOLLS = [
    { name: 'Arapongas', lat: -23.41, lng: -51.46, radius: 5000 }, // Arapongas - BR-369 (aprox)
    { name: 'Mandaguari', lat: -23.50, lng: -51.68, radius: 5000 }, // Mandaguari
    { name: 'Presidente Castelo Branco', lat: -23.28, lng: -52.14, radius: 5000 },
    { name: 'Cambará', lat: -23.05, lng: -50.05, radius: 5000 },
    { name: 'Jataizinho', lat: -23.25, lng: -50.98, radius: 5000 },
    { name: 'Sertaneja', lat: -23.04, lng: -50.84, radius: 5000 }
];

async function fetchTollBooths(bounds, routePoints, stops = []) {
    // 1. Constrói query Overpass
    const s = bounds.getSouth();
    const w = bounds.getWest();
    const n = bounds.getNorth();
    const e = bounds.getEast();

    // Query otimizada: busca no bbox com timeout maior (90s)
    // node["place"~"city|town"] busca cidades e vilas importantes
    // Adicionado: highway=toll_gantry e man_made=toll_gantry para pegar Free Flow e pórticos
    const query = `
        [out:json][timeout:90];
        (
            node["barrier"="toll_booth"](${s},${w},${n},${e});
            node["highway"="toll_gantry"](${s},${w},${n},${e});
            node["man_made"="toll_gantry"](${s},${w},${n},${e});
            node["place"~"city|town"](${s},${w},${n},${e});
        );
        out body;
    `;

    // Lista de servidores Overpass para fallback (Redundância em caso de falha/timeout)
    const servers = [
        "https://overpass-api.de/api/interpreter",
        "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
        "https://overpass.kumi.systems/api/interpreter"
    ];

    let data = null;
    let lastError = null;

    // Tenta cada servidor até ter sucesso
    for (const server of servers) {
        try {
            console.log(`Tentando buscar pedágios em: ${server}`);
            const url = `${server}?data=${encodeURIComponent(query)}`;

            // Controller para abortar fetch se demorar muito (client-side timeout de 50s)
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s limite rigoroso

            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (!response.ok) {
                if (response.status === 429) throw new Error('Overpass Rate Limit Exceeded');
                if (response.status === 504) throw new Error('Overpass Gateway Timeout');
                throw new Error(`Overpass API Error: ${response.status}`);
            }

            // Tenta parsear JSON
            data = await response.json();

            // Se chegou aqui, sucesso!
            break;

        } catch (err) {
            console.warn(`Falha ao buscar em ${server}:`, err.message);
            lastError = err;
            // Continua para o próximo servidor...
        }
    }

    // Se nenhum servidor funcionou
    if (!data || !data.elements) {
        console.error("Todas as tentativas de buscar pedágios falharam.", lastError);
        // Opcional: Mostrar aviso ao usuário via Toast se existisse essa função global acessível aqui
        return [];
    }

    // --- Processamento dos Dados (igual ao anterior) ---
    try {
        const booths = [];
        const cities = [];

        if (data.elements) {
            // Fase 1: Separar Pedágios e Cidades
            data.elements.forEach(node => {
                const nodeLat = node.lat;
                const nodeLon = node.lon;

                if (node.tags.place) {
                    // É uma cidade/vila
                    // Raio maior para cidades (10km)
                    if (isCloseToPolyline(nodeLat, nodeLon, routePoints, 10000)) {
                        cities.push({
                            lat: nodeLat,
                            lng: nodeLon,
                            name: node.tags.name || "Cidade Desconhecida",
                            type: 'city'
                        });
                    }
                } else if (node.tags.barrier === 'toll_booth' || node.tags.highway === 'toll_gantry' || node.tags.man_made === 'toll_gantry') {
                    // É um pedágio (Cabine ou Pórtico)
                    // Raio curto (200m)
                    if (isCloseToPolyline(nodeLat, nodeLon, routePoints, 200)) {
                        booths.push({
                            lat: nodeLat,
                            lng: nodeLon,
                            id: node.id,
                            tags: node.tags
                        });
                    }
                }
            });

            // Fase 2: Processar Pedágios e encontrar referência mais próxima (Cidade ou Entrega)
            const allReferences = [
                ...stops.map(s => ({ ...s, type: 'stop' })),
                ...cities
            ];

            const detailedBooths = booths.map(booth => {
                // Encontra a referência mais próxima
                let nearestName = "Local Desconhecido";
                let minDist = Infinity;

                // Encontra o índice do ponto da rota mais próximo para ordenação
                let closestRouteIndex = -1;
                let minRouteDist = Infinity;

                // 1. Achar índice na rota (para ordenação)
                for (let i = 0; i < routePoints.length; i++) {
                    const rp = routePoints[i];
                    const d = (rp.lat - booth.lat) ** 2 + (rp.lng - booth.lng) ** 2;
                    if (d < minRouteDist) {
                        minRouteDist = d;
                        closestRouteIndex = i;
                    }
                }

                // 2. Achar contexto (Cidade ou Parada)
                if (allReferences.length > 0) {
                    allReferences.forEach(ref => {
                        if (ref.coords || (ref.lat && ref.lng)) {
                            const rLat = ref.coords ? ref.coords.lat : ref.lat;
                            const rLng = ref.coords ? ref.coords.lng : ref.lng;
                            const d = (rLat - booth.lat) ** 2 + (rLng - booth.lng) ** 2;
                            if (d < minDist) {
                                minDist = d;
                                nearestName = ref.name ? ref.name.split(',')[0].trim() : "Local";
                            }
                        }
                    });
                }

                // Nome da praça
                let boothName = booth.tags.name || booth.tags.operator || `Pedágio`;
                if (booth.tags.ref) boothName += ` (${booth.tags.ref})`;

                // VERIFICAÇÃO DE STATUS (Ativo/Inativo)
                let status = 'active';
                const tags = booth.tags;
                if (
                    tags.fee === 'no' ||
                    tags.access === 'no' ||
                    tags.disused === 'yes' ||
                    tags.abandoned === 'yes' ||
                    tags.operational_status === 'closed' ||
                    tags.barrier === 'disused_toll_booth'
                ) {
                    status = 'inactive';
                    if (!boothName.toUpperCase().includes('DESATIVADO')) {
                        boothName += ' (DESATIVADO)';
                    }
                }

                // CHECK FORCE INACTIVE (Por Lista Conhecida)
                if (status === 'active') {
                    const isKnownInactive = KNOWN_INACTIVE_TOLLS.some(known => {
                        // Check Name (fuzzy)
                        const nameMatch = boothName.toLowerCase().includes(known.name.toLowerCase());

                        // Check Distance (if verify coordinates)
                        let distMatch = false;
                        if (known.lat && known.lng) {
                            const dLat = known.lat - booth.lat;
                            const dLng = known.lng - booth.lng;
                            const dist = Math.sqrt(dLat * dLat + dLng * dLng) * 111000; // metros
                            if (dist < known.radius) distMatch = true;
                        }

                        return nameMatch || distMatch;
                    });

                    if (isKnownInactive) {
                        status = 'inactive';
                        if (!boothName.toUpperCase().includes('DESATIVADO')) {
                            boothName += ' (DESATIVADO - VIAPAR/ECONORTE)';
                        }
                    }
                }

                return {
                    lat: booth.lat,
                    lng: booth.lng,
                    id: booth.id,
                    name: boothName,
                    context: `Próximo a ${nearestName}`,
                    full_tags: booth.tags,
                    routeIndex: closestRouteIndex,
                    status: status // NOVO CAMPO
                };
            });

            // Remove duplicatas muito próximas
            const uniqueBooths = combineCloseBooths(detailedBooths);

            // ORDENAR POR PROXIMIDADE NA ROTA
            uniqueBooths.sort((a, b) => a.routeIndex - b.routeIndex);

            // DEBUG LOGGING
            console.groupCollapsed("🔍 Pedágios Identificados (Debug)");
            console.table(uniqueBooths.map(b => ({
                Nome: b.name,
                Status: b.status,
                Contexto: b.context,
                Tags: JSON.stringify(b.full_tags)
            })));
            console.groupEnd();

            return uniqueBooths;
        }

        return [];

    } catch (err) {
        console.warn("Erro ao processar dados de pedágios:", err);
        return [];
    }
}

/**
 * Verifica se um ponto está próximo (em metros) de uma polilinha.
 */
function isCloseToPolyline(lat, lng, polylinePoints, maxMeters) {
    // Conversão tosca: 1 grau de lat/lon ~= 111km -> 1km ~= 0.009 graus
    // 200m ~= 0.0018 graus. 
    // Vamos usar squared euclidean distance para "fase ampla" para performance
    const maxDeg = (maxMeters / 111000);
    const maxDegSq = maxDeg * maxDeg;

    // Check simples: Distancia para o PONTO mais próximo da linha (vertex)

    for (let i = 0; i < polylinePoints.length; i++) {
        const p = polylinePoints[i];
        // Distancia euclidiana rapida
        const dLat = p.lat - lat;
        const dLng = p.lng - lng;
        if ((dLat * dLat + dLng * dLng) < maxDegSq) {
            return true;
        }
    }
    return false;
}

/**
 * Agrupa cabines de pedágio que estão muito próximas (mesma praça).
 */
function combineCloseBooths(booths) {
    if (booths.length === 0) return [];

    const combined = [];
    const threshold = 0.003; // ~300m de raio para agrupar

    // Ordenar por indice antes de combinar para garantir que pegamos o "primeiro" na rota como referência?
    // Ou apenas manter. Se a lista já vier sortida, ok. Mas ela ta sendo sortida DEPOIS lá em cima.
    // O ideal é que aqui a gente preserve min(routeIndex).

    booths.forEach(b => {
        // Tenta achar um grupo existente perto
        const existing = combined.find(c => {
            const dLat = c.lat - b.lat;
            const dLng = c.lng - b.lng;
            return (dLat * dLat + dLng * dLng) < (threshold * threshold);
        });

        if (!existing) {
            combined.push(b);
        } else {
            // Se já existe, vamos ver se o atual (b) aparece "antes" na rota (menor index).
            // Se sim, atualizamos o existing para ter o index menor.
            if (b.routeIndex < existing.routeIndex) {
                existing.routeIndex = b.routeIndex;
                // Talvez atualizar coordenadas também?
                // Vamos manter o 'existing' como representativo visual, mas atualizar ordem.
            }
        }
    });

    return combined;
}

/**
 * Gera relatório formatado para o clipboard
 */
function copyTollReport() {
    if (!window.currentTollBooths || window.currentTollBooths.length === 0) {
        showToast("Sem informações de pedágio para copiar.", "warning");
        return;
    }

    let report = `RELATÓRIO DE PEDÁGIOS - ROTA AUTOMÁTICA\n`;
    report += `Data: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}\n`;
    report += `Total Identificado: ${window.currentTollBooths.length} praças\n\n`;

    window.currentTollBooths.forEach((b, i) => {
        report += `${i + 1}. ${b.name.toUpperCase()}\n`;
        report += `   Local: ${b.context}\n`;
        report += `   Coords: ${b.lat.toFixed(5)}, ${b.lng.toFixed(5)}\n`;
        report += `   --------------\n`;
    });

    report += `\n*Valores e tarifas devem ser consultados no Sem Parar/ConectCar.`;

    navigator.clipboard.writeText(report).then(() => {
        showToast("Relatório copiado para a área de transferência!", "success");
    }).catch(err => {
        console.error("Erro ao copiar: ", err);
        showToast("Erro ao copiar relatório.", "error");
    });
}
