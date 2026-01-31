
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
    // [out:json];node["barrier"="toll_booth"](south,west,north,east);out;
    const s = bounds.getSouth();
    const w = bounds.getWest();
    const n = bounds.getNorth();
    const e = bounds.getEast();

    // Query otimizada: busca no bbox
    const query = `[out:json][timeout:10];node["barrier"="toll_booth"](${s},${w},${n},${e});out;`;
    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Overpass API Error');
        const data = await response.json();

        const booths = [];
        // Nota: Cálculo geodésico preciso seria melhor, mas para UI rápida isso basta.

        if (data.elements) {
            data.elements.forEach(node => {
                const nodeLat = node.lat;
                const nodeLon = node.lon;

                // 2. Filtra: Verifica se o ponto está próximo de ALGUM segmento da rota
                if (isCloseToPolyline(nodeLat, nodeLon, routePoints, 200)) { // 200 metros

                    // 3. Encontra a cidade/parada mais próxima para referência
                    let nearestStopName = "Desconhecido";
                    let minStopDist = Infinity;

                    if (stops && stops.length > 0) {
                        stops.forEach(stop => {
                            if (stop.coords) {
                                const d = (stop.coords.lat - nodeLat) ** 2 + (stop.coords.lng - nodeLon) ** 2;
                                if (d < minStopDist) {
                                    minStopDist = d;
                                    nearestStopName = stop.name ? stop.name.split(',')[0].trim() : "Local";
                                }
                            }
                        });
                    }

                    // Nome da praça (tag name ou operator ou ref)
                    let boothName = node.tags.name || node.tags.operator || `Pedágio`;
                    if (node.tags.ref) boothName += ` (${node.tags.ref})`;

                    booths.push({
                        lat: nodeLat,
                        lng: nodeLon,
                        id: node.id,
                        name: boothName,
                        context: `Próx. a ${nearestStopName}`,
                        full_tags: node.tags
                    });
                }
            });
        }

        // Remove duplicatas muito próximas (praças grandes têm várias cabines)
        const uniqueBooths = combineCloseBooths(booths);
        return uniqueBooths;

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

    booths.forEach(b => {
        // Tenta achar um grupo existente perto
        const existing = combined.find(c => {
            const dLat = c.lat - b.lat;
            const dLng = c.lng - b.lng;
            return (dLat * dLat + dLng * dLng) < (threshold * threshold);
        });

        if (!existing) {
            combined.push(b);
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
