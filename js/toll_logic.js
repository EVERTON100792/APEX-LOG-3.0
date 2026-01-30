
// ================================================================================================
//  MODULO DE PEDÁGIOS (Overpass API)
// ================================================================================================

/**
 * Busca praças de pedágio dentro do bounding box da rota e filtra as que estão próximas à linha da rota.
 * @param {L.LatLngBounds} bounds - Limites visuais do mapa.
 * @param {Array<L.LatLng>} routePoints - Pontos da polilinha da rota.
 * @returns {Promise<Array>} Lista de pedágios encontrados.
 */
async function fetchTollBooths(bounds, routePoints) {
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
        const proximityThreshold = 0.001; // ~100 metros (graus decimais aprox)
        // Nota: Cálculo geodésico preciso seria melhor, mas para UI rápida isso basta.
        // Vamos usar TurfeJS se tivéssemos, mas aqui vamos de geometria simples.

        if (data.elements) {
            data.elements.forEach(node => {
                const nodeLat = node.lat;
                const nodeLon = node.lon;

                // 2. Filtra: Verifica se o ponto está próximo de ALGUM segmento da rota
                // Otimização: Checa primeiro box simples antes de cálculo detalhado
                if (isCloseToPolyline(nodeLat, nodeLon, routePoints, 200)) { // 200 metros
                    booths.push({
                        lat: nodeLat,
                        lng: nodeLon,
                        id: node.id,
                        name: node.tags.name || "Pedágio"
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

    // Amostragem: não testar TODOS os pontos se a rota for gigante (+10k points).
    // Mas Valhalla decodePolyline já simplifica.

    // Check simples: Distancia para o PONTO mais próximo da linha (vertex)
    // Refinamento: Deveriamos checar distancia para o SEGMENTO, mas vertex-check costuma funcionar para pedágios 
    // pois a rota passa "em cima".

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
