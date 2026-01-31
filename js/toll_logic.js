
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
async function fetchTollBooths(bounds, routePoints, stops = []) {
    // 1. Constrói query Overpass
    // Busca Toll Booths E Cidades/Vilas no bounding box
    const s = bounds.getSouth();
    const w = bounds.getWest();
    const n = bounds.getNorth();
    const e = bounds.getEast();

    // Query otimizada: busca no bbox
    // node["place"~"city|town"] busca cidades e vilas importantes
    const query = `
        [out:json][timeout:25];
        (
            node["barrier"="toll_booth"](${s},${w},${n},${e});
            node["place"~"city|town"](${s},${w},${n},${e});
        );
        out;
    `;
    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Overpass API Error');
        const data = await response.json();

        const booths = [];
        const cities = [];

        if (data.elements) {
            // Fase 1: Separar Pedágios e Cidades
            data.elements.forEach(node => {
                const nodeLat = node.lat;
                const nodeLon = node.lon;

                if (node.tags.place) {
                    // É uma cidade/vila
                    // Raio maior para cidades (5km) pois o centro pode estar longe da rodovia
                    if (isCloseToPolyline(nodeLat, nodeLon, routePoints, 10000)) {
                        cities.push({
                            lat: nodeLat,
                            lng: nodeLon,
                            name: node.tags.name || "Cidade Desconhecida",
                            type: 'city'
                        });
                    }
                } else if (node.tags.barrier === 'toll_booth') {
                    // É um pedágio
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
            // Combinar stops e cities para busca de referência
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
                // Otimização: Não precisamos iterar TUDO se a rota for gigante, mas para precisão de ordem, é bom.
                // Como já filtramos por bounding box, não deve ser tão lento.
                for (let i = 0; i < routePoints.length; i++) {
                    const rp = routePoints[i];
                    // Distancia aprox (quadrado)
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

                            // Distância Euclidiana simplificada
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

                return {
                    lat: booth.lat,
                    lng: booth.lng,
                    id: booth.id,
                    name: boothName,
                    context: `Próximo a ${nearestName}`,
                    full_tags: booth.tags,
                    routeIndex: closestRouteIndex // Propriedade para ordenação
                };
            });

            // Remove duplicatas muito próximas (praças grandes têm várias cabines)
            const uniqueBooths = combineCloseBooths(detailedBooths);

            // ORDENAR POR PROXIMIDADE NA ROTA (Indice menor = mais perto da origem)
            uniqueBooths.sort((a, b) => a.routeIndex - b.routeIndex);

            return uniqueBooths;
        }

        return [];

    } catch (err) {
        console.warn("Erro ao buscar pedágios:", err);
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
