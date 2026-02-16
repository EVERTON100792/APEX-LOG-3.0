
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

// CONFIGURAÇÃO GLOBAL: Mudar para 'true' em 2026 para ATIVAR todos os pedágios do PR novamente
const REACTIVATE_ALL_PR_TOLLS = false; // "Master Switch"

// LISTA DE EXCESSÕES: Pedágios conhecidos que devem ser forçados como DESATIVADOS
const KNOWN_INACTIVE_TOLLS = [
    { name: 'Arapongas', lat: -23.41, lng: -51.46, radius: 5000 }, // Arapongas - BR-369 (aprox)
    { name: 'Mandaguari', lat: -23.50, lng: -51.68, radius: 5000 }, // Mandaguari
    { name: 'Presidente Castelo Branco', lat: -23.28, lng: -52.14, radius: 5000 },
    { name: 'Cambará', lat: -23.05, lng: -50.05, radius: 5000 },
    { name: 'Jataizinho', lat: -23.25, lng: -50.98, radius: 5000 },
    { name: 'Sertaneja', lat: -23.04, lng: -50.84, radius: 5000 },
    // Floresta - PR-317 (Lote 4/5) - Desativado até Q1 2026 - Aumentado raio para 15km
    { name: 'Floresta', lat: -23.59, lng: -52.08, radius: 15000 },
    // Outros pedágios da região (Rolândia/Marialva) - Lotes antigos desativados
    { name: 'Rolândia', lat: -23.31, lng: -51.38, radius: 8000 },
    { name: 'Marialva', lat: -23.48, lng: -51.79, radius: 8000 }
];

async function fetchTollBooths(bounds, routePoints, stops = []) {
    // 1. Constrói query Overpass
    const s = bounds.getSouth();
    const w = bounds.getWest();
    const n = bounds.getNorth();
    const e = bounds.getEast();

    // --- QUERY OTIMIZADA V6.1 (NO REGEX) ---
    // Removemos o regex (~"city|town") que causa timeout no Overpass.
    // Usamos node["place"="city"] e node["place"="town"] explicitamente.
    // Timeout ajustado para 90s (Servidor) para áreas grandes (Sul do Brasil)
    const query = `
        [out:json][timeout:90];
        (
            node["barrier"="toll_booth"](${s},${w},${n},${e});
            node["highway"="toll_gantry"](${s},${w},${n},${e});
            node["man_made"="toll_gantry"](${s},${w},${n},${e});
        )->.tolls;
        .tolls out body;
        (
            node(around.tolls:20000)["place"="city"];
            node(around.tolls:20000)["place"="town"];
        );
        out body;
    `;

    // Lista de servidores Overpass para fallback (Otimizada para 2026)
    // Priorizando a Main API e Mirrors estáveis, evitando timeouts.
    const servers = [
        "https://overpass-api.de/api/interpreter", // Main: Mais estável e previsível
        "https://lz4.overpass-api.de/api/interpreter", // LZ4: Compressão rápida (Backup imediato)
        "https://maps.mail.ru/osm/tools/overpass/api/interpreter", // RU: Muito rápido para queries grandes
        "https://overpass.kumi.systems/api/interpreter" // Kumi: Backup final
    ];

    let data = null;
    let lastError = null;

    // Tenta cada servidor até ter sucesso
    for (const server of servers) {
        try {
            // console.debug(`Tentando buscar pedágios em: ${server}`);
            const url = `${server}?data=${encodeURIComponent(query)}`;

            // Timeout de 95s por tentativa (aumentado de 30s) para coincidir com o query timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 95000);

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
            // console.debug(`Falha ao buscar em ${server} (tentando próximo...):`, err.message);
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
                            type: 'city', // Mantemos 'city' como identificador genérico de tipo de objeto
                            placeType: node.tags.place // 'city', 'town', 'village', etc.
                        });
                    }
                } else if (node.tags.barrier === 'toll_booth' || node.tags.highway === 'toll_gantry' || node.tags.man_made === 'toll_gantry') {
                    // É um pedágio (Cabine ou Pórtico)
                    // Raio aumentado para 500m para maior precisão (Feedback user)
                    if (isCloseToPolyline(nodeLat, nodeLon, routePoints, 500)) {
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

            // NOVA LÓGICA V2 (MULTI-PASS): Detectar MÚLTIPLAS passagens (Ida/Volta)
            const DETECT_RADIUS_SQ = 0.003 * 0.003; // ~300m (ao quadrado para evitar sqrt)
            const detectedBooths = [];

            booths.forEach(booth => {
                // Para cada pedágio, varre TODA a rota buscando interseções
                // Uma "interseção" é definida como entrar no raio de detecção
                let insideZone = false;
                let currentPass = null;

                for (let i = 0; i < routePoints.length; i++) {
                    const rp = routePoints[i];
                    const d = (rp.lat - booth.lat) ** 2 + (rp.lng - booth.lng) ** 2;

                    if (d < DETECT_RADIUS_SQ) {
                        if (!insideZone) {
                            // Entrou na zona: Começa nova detecção
                            insideZone = true;
                            currentPass = {
                                minDist: d,
                                closestIndex: i,
                                booth: booth
                            };
                        } else {
                            // Já está dentro: Atualiza se for mais perto
                            if (d < currentPass.minDist) {
                                currentPass.minDist = d;
                                currentPass.closestIndex = i;
                            }
                        }
                    } else {
                        if (insideZone) {
                            // Saiu da zona: Fecha a passagem anterior e salva
                            insideZone = false;
                            if (currentPass) {
                                detectedBooths.push(createDetailedBooth(currentPass.booth, currentPass.closestIndex, routePoints, allReferences));
                                currentPass = null;
                            }
                        }
                    }
                }

                // Se terminou a rota dentro da zona, salva o último
                if (insideZone && currentPass) {
                    detectedBooths.push(createDetailedBooth(currentPass.booth, currentPass.closestIndex, routePoints, allReferences));
                }
            });

            // Replaces the old map loop
            const detailedBooths = detectedBooths;

            // Função Helper para criar o objeto detalhado (Extraída da lógica antiga)
            function createDetailedBooth(booth, activeIndex, routePoints, allReferences) {
                // Encontra a referência mais próxima (Repetido da lógica v1)
                let nearestName = "Local Desconhecido";
                let minDist = Infinity;

                // 2. Achar contexto (Cidade ou Parada) - Busca Global
                // 2. Achar contexto (Cidade ou Parada) - Busca Global OTIMIZADA V9
                // Tenta primeiro usar tags do próprio nó (addr:city)
                let directCity = booth.tags['addr:city'] || booth.tags['is_in:city'] || booth.tags['city'];

                if (directCity) {
                    nearestName = directCity;
                    // Ainda calculamos minDist para fins de log, mas o nome é forçado
                }

                if (allReferences.length > 0) {
                    allReferences.forEach(ref => {
                        if (ref.coords || (ref.lat && ref.lng)) {
                            const rLat = ref.coords ? ref.coords.lat : ref.lat;
                            const rLng = ref.coords ? ref.coords.lng : ref.lng;

                            // Distância ao quadrado
                            let d = (rLat - booth.lat) ** 2 + (rLng - booth.lng) ** 2;

                            // LOGICA DE PESO: Se for uma cidade GRANDE (place=city), 
                            // reduzimos a distância "virtual" para ela e 'puxa' a referência.
                            // Isso ajuda a preferir "Ortigueira" (city) a "Imbaú" (town) se estiverem próximas.
                            if (ref.placeType === 'city') {
                                d = d * 0.4; // Dá um "desconto" de 60% na distância para cidades grandes
                            }

                            // Se já temos um nome fixo via tags, só atualizamos se for uma parada de rota (stop)
                            // pois paradas de rota são definitivas (ex: "Entrega Tintas")
                            if (directCity && ref.type !== 'stop') {
                                return;
                            }

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

                // CHECK FORCE INACTIVE (Por Lista Conhecida), mas RESPEITANDO O MASTER SWITCH
                // Se REACTIVATE_ALL_PR_TOLLS for true, ignoramos essa lista e deixamos como 'active'
                if (status === 'active' && !REACTIVATE_ALL_PR_TOLLS) { // <--- AQUI ESTÁ A CHAVE DE ATIVAÇÃO
                    const isKnownInactive = KNOWN_INACTIVE_TOLLS.some(known => {
                        // Check Name (fuzzy) - Now also checking nearestName (Context)
                        const nameMatch = boothName.toLowerCase().includes(known.name.toLowerCase()) ||
                            nearestName.toLowerCase().includes(known.name.toLowerCase());

                        // Check Distance (if verify coordinates)
                        // console.log(`🔍 Checking ${boothName} near ${nearestName} against ${known.name}`);
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

                // --- NOVO: Extração de Metadados Otimizada V8 ---
                let ref = tags.ref || '';
                if (!ref) {
                    const match = boothName.match(/(BR|PR|SP|SC|RS|MG|RJ)-\d{3}/i);
                    if (match) ref = match[0].toUpperCase();
                }

                let state = tags['addr:state'] || tags['is_in:state_code'] || '';

                // Cálculo de Direção (Azimute) baseada na rota (No ponto específico da passagem)
                let bearing = 0;
                let directionFull = 'Norte';
                let directionCard = 'N';

                if (activeIndex >= 0 && routePoints.length > 1) {
                    // Check index boundaries
                    const p1 = routePoints[activeIndex];
                    const p2 = (activeIndex < routePoints.length - 1)
                        ? routePoints[activeIndex + 1]
                        : routePoints[activeIndex - 1]; // Fallback if last point

                    if (activeIndex < routePoints.length - 1) {
                        bearing = getBearing(p1.lat, p1.lng, p2.lat, p2.lng);
                    } else {
                        // Se for o último ponto, pega o anterior
                        const pPrev = routePoints[activeIndex - 1];
                        bearing = getBearing(pPrev.lat, pPrev.lng, p1.lat, p1.lng);
                    }

                    directionCard = getCardinalDirection(bearing);
                    const dirMap = {
                        'N': 'Norte', 'NE': 'Nordeste', 'L': 'Leste', 'SE': 'Sudeste',
                        'S': 'Sul', 'SO': 'Sudoeste', 'O': 'Oeste', 'NO': 'Noroeste'
                    };
                    directionFull = dirMap[directionCard] || directionCard;
                }

                return {
                    lat: booth.lat,
                    lng: booth.lng,
                    id: booth.id,
                    name: boothName,
                    cleanedName: nearestName,
                    context: `Próximo a ${nearestName}`,
                    full_tags: booth.tags,
                    routeIndex: activeIndex, // The specific index of this pass
                    status: status,

                    // Campos V8 Detalhados
                    ref: ref || 'Rodovia',
                    state: state || 'UF',
                    heading: bearing,
                    direction: directionCard,
                    directionFull: directionFull
                };
            }

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
    const threshold = 0.003; // ~300m de raio
    const indexThreshold = 50; // Reduzido (era 500) para evitar merge em entregas curtas (ex: Andira <-> Cambará)

    booths.forEach(b => {
        // Tenta achar um grupo existente perto GEOGRAFICAMENTE
        // MAS TAMBÉM PERTO NA ROTA (senão é ida e volta) e MESMO SENTIDO
        const existing = combined.find(c => {
            const dLat = c.lat - b.lat;
            const dLng = c.lng - b.lng;
            const geoClose = (dLat * dLat + dLng * dLng) < (threshold * threshold);

            // Só combina se for geográficamente perto E temporalmente perto (route index)
            const indexDiff = Math.abs(c.routeIndex - b.routeIndex);

            // Verificação de Sentido (Heading)
            // Se o sentido for muito diferente (> 80 graus), considera PASSAGEM DISTINTA (ex: Ida vs Volta)
            // O heading vai de 0 a 360. Diferença menor = mesmo sentido.
            let angleDiff = Math.abs(c.heading - b.heading);
            if (angleDiff > 180) angleDiff = 360 - angleDiff; // Normaliza para 0-180

            const sameDirection = angleDiff < 80; // Se dif > 80, tratamos como oposto/outro sentido

            // Combine APENAS se: Perto Geo + Perto Index + Mesmo Sentido
            // OU: Perto Geo + Perto Index (mas sentido oposto IMPEDE merge se index for maior que um mínimo, mas aqui index é principal)

            // Na verdade, se o sentido for oposto, NUNCA deve mergear, mesmo se index for perto (ex: caminhão manobrando?)
            // Mas indexThreshold já deve cuidar disso. O problema é Andira (Ida) e Andira (Volta) separados por 15km.
            // Com indexThreshold = 500, mergeava. Com 50, deve separar.
            // Mas para garantir, adicionamos check de direção.

            return geoClose && (indexDiff < indexThreshold) && sameDirection;
        });

        if (!existing) {
            combined.push(b);
        } else {
            // Se já existe (mesma passagem), mantém o com menor index (primeira detecção do grupo)
            // ou atualiza se achar algo melhor? Geralmente mantemos o primeiro.
            if (b.routeIndex < existing.routeIndex) {
                existing.routeIndex = b.routeIndex;
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


// --- FUNÇÕES AUXILIARES DE DIREÇÃO ---

function toRad(deg) {
    return deg * Math.PI / 180;
}

function toDeg(rad) {
    return rad * 180 / Math.PI;
}

/**
 * Calcula o azimute (bearing) entre dois pontos.
 * Retorna graus (0-360).
 */
function getBearing(lat1, lon1, lat2, lon2) {
    const dLon = toRad(lon2 - lon1);
    const y = Math.sin(dLon) * Math.cos(toRad(lat2));
    const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
        Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
    let brng = toDeg(Math.atan2(y, x));
    return (brng + 360) % 360;
}

/**
 * Converte graus (0-360) em direção cardeal (N, NE, E, etc).
 */
function getCardinalDirection(angle) {
    const directions = ['N', 'NE', 'L', 'SE', 'S', 'SO', 'O', 'NO']; // L=Leste, O=Oeste
    const index = Math.round(((angle %= 360) < 0 ? angle + 360 : angle) / 45) % 8;
    return directions[index];
}
