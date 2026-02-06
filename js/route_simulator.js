// ================================================================================================
//  MODULO DE SIMULADOR DE ROTAS (PREMIUM)
//  Objetivo: Permitir simulação de rotas ponto a ponto sem carga, calculando pedágios.
// ================================================================================================

let simulatorMap = null;
let simulatorRouteLayer = null;
let simulatorTollMarkers = [];
let simulatorRouteMarkers = []; // Array para armazenar marcadores de rota

// Debounce timer para evitar chamadas excessivas na API
let calculationDebounceTimer = null;

// Autocomplete State
let autocompleteDebounceTimer = null;

// DRAG AND DROP STATE
let draggedRow = null;


/**
 * Inicializa o mapa do simulador (chamado ao abrir a view)
 */
function initSimulatorMap() {
    if (simulatorMap) {
        simulatorMap.invalidateSize();
        return;
    }

    // Inicializa o mapa focado no Paraná/Brasil
    simulatorMap = L.map('simulator-map-container', {
        zoomControl: false, // Controle de zoom customizado
        attributionControl: false
    }).setView([-24.95, -53.46], 7); // Centro PR aprox

    // Camada CartoDB Voyager (Visual V5 solicitado)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; CartoDB',
        maxZoom: 19,
        subdomains: 'abcd'
    }).addTo(simulatorMap);
}

/**
 * Exibe/Oculta Overlay de Carregamento Épico
 */
function toggleEpicLoading(show, message = "Calculando...") {
    const overlay = document.getElementById('epic-loading-overlay');
    const textEl = document.getElementById('epic-loading-text');

    if (overlay) {
        if (show) {
            if (textEl) textEl.innerText = message;
            overlay.style.display = 'flex';
        } else {
            overlay.style.display = 'none';
        }
    }
}

/**
 * Adiciona um novo campo de parada na UI
 * @param {string} [value=''] - Valor inicial opcional
 */
function addStopInput(value = '') {
    const container = document.getElementById('sim-stops-container');

    const div = document.createElement('div');
    div.className = 'd-flex align-items-center mb-2 position-relative stop-row';
    // Habilita Drag and Drop
    div.draggable = true;
    div.style.cursor = 'grab';

    // Eventos de Drag N Drop
    div.addEventListener('dragstart', handleDragStart);
    div.addEventListener('dragover', handleDragOver);
    div.addEventListener('drop', handleDrop);
    div.addEventListener('dragend', handleDragEnd);

    div.innerHTML = `
        <div class="me-3 bg-dark z-1 d-flex flex-column align-items-center handle-drag" style="width: 24px; cursor: grab;">
            <i class="bi bi-grip-vertical text-muted mb-1" style="font-size: 12px;"></i>
            <i class="bi bi-circle-fill text-secondary stop-icon" style="font-size: 8px;"></i>
        </div>
        <div class="input-group position-relative">
            <input type="text" class="form-control bg-dark text-light border-secondary hover-border-primary sim-input" 
                placeholder="Cidade de parada..." value="${value}" oninput="window.handleAutocomplete(this)" onchange="window.handleStopChange()">
            <button class="btn btn-outline-secondary border-start-0" type="button" onclick="window.removeStop(this)">
                <i class="bi bi-x"></i>
            </button>
            <div class="autocomplete-suggestions" style="display: none;"></div>
        </div>
    `;

    container.appendChild(div);
    updateStopIcons();
}

// ------ DRAG AND DROP HANDLERS ------
function handleDragStart(e) {
    draggedRow = this;
    this.style.opacity = '0.4';
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragOver(e) {
    if (e.preventDefault) e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleDrop(e) {
    if (e.stopPropagation) e.stopPropagation();

    if (draggedRow !== this) {
        const container = document.getElementById('sim-stops-container');
        const allRows = Array.from(container.querySelectorAll('.stop-row'));
        const draggedIdx = allRows.indexOf(draggedRow);
        const thisIdx = allRows.indexOf(this);

        if (draggedIdx < thisIdx) {
            this.after(draggedRow);
        } else {
            this.before(draggedRow);
        }

        updateStopIcons();
        window.handleStopChange(); // Recalcula (sem otimizar, respeita ordem manual)
    }
    return false;
}

function handleDragEnd(e) {
    this.style.opacity = '1';
    draggedRow = null;
}
// ------------------------------------

/**
 * Remove uma parada específica
 */
function removeStop(btn) {
    const row = btn.closest('.stop-row');
    row.remove();
    updateStopIcons();
    window.handleStopChange();
}

/**
 * Atualiza os ícones da timeline visualmente E atualiza placeholders
 */
function updateStopIcons() {
    const rows = document.querySelectorAll('.stop-row');
    const total = rows.length;

    rows.forEach((row, index) => {
        const icon = row.querySelector('.stop-icon');
        const input = row.querySelector('input');

        // Garante listener de autocomplete
        if (!input.hasAttribute('oninput')) {
            input.setAttribute('oninput', 'window.handleAutocomplete(this)');
        }

        // Garante container de sugestões
        if (!row.querySelector('.autocomplete-suggestions')) {
            const suggestionsDiv = document.createElement('div');
            suggestionsDiv.className = 'autocomplete-suggestions';
            suggestionsDiv.style.display = 'none';
            input.parentElement.appendChild(suggestionsDiv);
        }

        // Reset classes
        if (icon) icon.className = '';

        if (index === 0) {
            // Origem
            if (icon) {
                icon.className = 'bi bi-geo-alt-fill text-primary stop-icon';
                icon.style.fontSize = '12px';
            }
            input.placeholder = "Origem (Fixa)";
        } else if (index === total - 1) {
            // Destino Final
            if (icon) {
                icon.className = 'bi bi-flag-fill text-danger stop-icon';
                icon.style.fontSize = '12px';
            }
            input.placeholder = "Destino (Fixo)";
        } else {
            // Waypoint
            if (icon) {
                icon.className = 'bi bi-circle-fill text-secondary stop-icon';
                icon.style.fontSize = '8px';
            }
            input.placeholder = "Cidade intermediária...";
        }
    });

    const container = document.getElementById('sim-stops-container');
    if (!container.querySelector('.timeline-line')) {
        const line = document.createElement('div');
        line.className = 'position-absolute timeline-line border-start border-2 border-secondary';
        line.style.top = '15px';
        line.style.bottom = '15px';
        line.style.left = '27px';
        line.style.zIndex = '0';
        line.style.opacity = '0.3';
        line.style.pointerEvents = 'none';

        if (!container.querySelector('.border-start')) {
            container.prepend(line);
        }
    }
}

/**
 * Lida com o Autocomplete (V6: Filtrar Ruas)
 */
function handleAutocomplete(input) {
    const suggestionsBox = input.parentElement.querySelector('.autocomplete-suggestions');
    if (!suggestionsBox) return;

    const query = input.value.trim();

    if (query.length < 3) {
        suggestionsBox.style.display = 'none';
        return;
    }

    clearTimeout(autocompleteDebounceTimer);
    autocompleteDebounceTimer = setTimeout(async () => {
        // V6: Usar featuretype=settlement (cidades, vilas) se possível ou filtrar no client
        // addressdetails=1 ajuda a ver o tipo
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=8&countrycodes=br&addressdetails=1`;

        try {
            const response = await fetch(url, { headers: { 'User-Agent': 'ApexLogSimulator/3.0' } });
            const data = await response.json();

            suggestionsBox.innerHTML = '';

            // FIltrar resultados
            const filteredData = data.filter(item => {
                // Remove ruas especificas se não forem relevantes para "Cidade"
                // Queremos cidades, estados, municipios.
                // class=place ou class=boundary (administrative) costumam ser cidades
                // class=highway (ruas) removemos
                return item.class === 'place' || item.class === 'boundary';
            });

            // Se filtro for muito agressivo e remover tudo (ex: usuario digitou nome de rua querendo a cidade), 
            // fallback para exibir tudo mas tentar formatar o nome
            const displayData = filteredData.length > 0 ? filteredData : data.slice(0, 3);

            if (displayData.length > 0) {
                displayData.forEach(item => {
                    const div = document.createElement('div');
                    div.className = 'autocomplete-suggestion';

                    // Formatação V6: Revertido para nome completo ("Endereços Grandes") a pedido do usuário
                    const cleanName = item.display_name;

                    div.innerHTML = `<i class="bi bi-geo-alt"></i> ${cleanName} <small class="text-muted ms-2" style="font-size: 0.7em;">${item.type}</small>`;
                    div.onclick = () => {
                        input.value = cleanName;
                        suggestionsBox.style.display = 'none';
                        window.handleStopChange();
                    };
                    suggestionsBox.appendChild(div);
                });
                suggestionsBox.style.display = 'block';
            } else {
                suggestionsBox.style.display = 'none';
            }
        } catch (err) {
            console.error('Erro autocomplete:', err);
        }
    }, 300);
}

// Fecha autocomplete ao clicar fora
document.addEventListener('click', function (e) {
    if (!e.target.closest('.input-group')) {
        document.querySelectorAll('.autocomplete-suggestions').forEach(el => el.style.display = 'none');
    }
});


/**
 * Handler chamado quando um input muda (blur ou enter)
 */
function handleStopChange() {
    setTimeout(() => {
        document.querySelectorAll('.autocomplete-suggestions').forEach(el => el.style.display = 'none');
    }, 200);

    // Debounce
    clearTimeout(calculationDebounceTimer);
    calculationDebounceTimer = setTimeout(() => {
        const inputs = document.querySelectorAll('.sim-input');
        const filledInputs = Array.from(inputs).filter(input => input.value.trim().length > 3);

        if (filledInputs.length >= 2) {
            // Auto-calc não bloqueia tela nem otimiza, apenas projeta
            runRouteSimulation(true, false);
        }
    }, 800);
}

/**
 * Busca coordenadas de uma cidade
 */
async function geocodeCity(query) {
    if (!query || query.length < 3) return null;

    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&countrycodes=br`;

    try {
        const response = await fetch(url, { headers: { 'User-Agent': 'ApexLogSimulator/3.0' } });
        const data = await response.json();

        if (data && data.length > 0) {
            const item = data[0];
            // Mesmo tratamento de nome limpo se possível
            return {
                lat: parseFloat(item.lat),
                lng: parseFloat(item.lon),
                name: item.display_name, // Nome completo restaurado
                originalQuery: query
            };
        }
        return null;
    } catch (error) {
        console.error("Erro na geocodificação:", error);
        return null;
    }
}

/**
 * Algoritmo Nearest Neighbor para otimizar rota (FIXED ORIGIN & DESTINATION)
 * V6: Otimiza apenas os pontos intermediários!
 * @param {Array} points - Lista completa [Origem, ...meio, Destino]
 * @returns {Array} - Lista reordenada [Origem, ...meioOtimizado, Destino]
 */
function optimizeRoutePoints(points) {
    // Se tiver 3 ou menos pontos (Origem, Meio, Destino) ou (Origem, Destino), 
    // não há o que reordenar entre as extremidades (só existe 0 ou 1 ponto no meio).
    if (points.length <= 3) return points;

    const origin = points[0];
    const destination = points[points.length - 1];

    // Pontos intermediários para otimizar
    let middlePoints = points.slice(1, -1);

    const optimizedMiddle = [];
    let currentReference = origin; // Começa referenciando a origem

    while (middlePoints.length > 0) {
        let nearestIndex = -1;
        let minDistance = Infinity;

        for (let i = 0; i < middlePoints.length; i++) {
            const dist = Math.sqrt(
                Math.pow(middlePoints[i].lat - currentReference.lat, 2) +
                Math.pow(middlePoints[i].lng - currentReference.lng, 2)
            );

            // Heurística V6: Considerar também a distância para o destino final?
            // Nearest Neighbor puro olha apenas para o próximo passo. A* olharia para o destino.
            // Para "organizar tudo", NN geralmente funciona bem para rotas lineares.
            // Vamos testar NN simples a partir do anterior.

            if (dist < minDistance) {
                minDistance = dist;
                nearestIndex = i;
            }
        }

        const nextPoint = middlePoints[nearestIndex];
        optimizedMiddle.push(nextPoint);
        currentReference = nextPoint; // O próximo será buscado a partir deste
        middlePoints.splice(nearestIndex, 1);
    }

    // Reconstrói: [Origem, ...MeioOtimizado, Destino]
    return [origin, ...optimizedMiddle, destination];
}


/**
 * Atualiza os inputs da UI com a ordem otimizada
 */
function updateUIInputs(optimizedPoints) {
    const container = document.getElementById('sim-stops-container');

    container.innerHTML = `
        <div class="position-absolute top-0 bottom-0 start-0 ms-3 border-start border-2 border-secondary"
            style="height: 100%; z-index: 0; opacity: 0.3;"></div>
    `;

    optimizedPoints.forEach((p, index) => {
        addStopInput(p.originalQuery || p.name);
    });
}

/**
 * Executa a simulação
 * @param {boolean} silent 
 * @param {boolean} optimize 
 */
async function runRouteSimulation(silent = false, optimize = true) {
    const inputs = document.querySelectorAll('.sim-input');
    const rawValues = Array.from(inputs).map(i => i.value.trim()).filter(v => v !== '');

    if (rawValues.length < 2) {
        if (!silent) showToast("Preencha pelo menos Origem e Destino.", "warning");
        return;
    }

    if (!silent) {
        toggleEpicLoading(true, optimize ? "Otimizando Rota..." : "Calculando Rota...");
    }

    try {
        // Delay estético para o loading épico ser visto (V6 pedido do user)
        if (!silent) await new Promise(r => setTimeout(r, 1500));

        // 1. Geocodificação
        const points = [];
        for (const city of rawValues) {
            const coords = await geocodeCity(city);
            if (!coords) {
                if (!silent) throw new Error(`Cidade não encontrada: ${city}`);
                return;
            }
            points.push(coords);
        }

        // 2. Otimização (Segura V6)
        let finalPoints = points;
        if (optimize && points.length > 2) {
            finalPoints = optimizeRoutePoints(points);
            updateUIInputs(finalPoints);
        }

        // 3. Traçar Rota
        await drawSimulationRoute(finalPoints);

    } catch (error) {
        if (!silent) showToast(error.message, "danger");
        console.error(error);
    } finally {
        if (!silent) toggleEpicLoading(false);
    }
}

/**
 * Traça a rota e calcula pedágios
 */
async function drawSimulationRoute(points) {
    const apiKey = localStorage.getItem('graphhopperApiKey') || '6aaa58ba-e39d-447e-86b4-34cc7eb03d85';

    // Constrói URL
    let url = `https://graphhopper.com/api/1/route?vehicle=car&locale=pt_BR&key=${apiKey}&points_encoded=false`;
    points.forEach(p => {
        url += `&point=${p.lat},${p.lng}`;
    });

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.paths && data.paths.length > 0) {
            const path = data.paths[0];
            const coordinates = path.points.coordinates.map(c => [c[1], c[0]]);

            // Limpa mapa
            if (simulatorRouteLayer) simulatorMap.removeLayer(simulatorRouteLayer);
            simulatorTollMarkers.forEach(m => simulatorMap.removeLayer(m));
            simulatorTollMarkers = [];

            if (window.simulatorRouteMarkers) {
                window.simulatorRouteMarkers.forEach(m => simulatorMap.removeLayer(m));
            }
            window.simulatorRouteMarkers = [];

            // Adiciona marcadores (Icons V4/V5)
            points.forEach((p, index) => {
                const isOrigin = index === 0;
                const isDest = index === points.length - 1;
                let markerIcon;
                let zIndex = 1000;

                if (isOrigin) {
                    markerIcon = L.divIcon({
                        className: 'custom-route-marker',
                        html: `
                            <div style="background-color: #10b981; width: 32px; height: 32px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 8px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white;">
                                <i class="bi bi-geo-alt-fill" style="font-size: 16px;"></i>
                            </div>`,
                        iconSize: [32, 32],
                        iconAnchor: [16, 30]
                    });
                    zIndex = 1020;
                } else if (isDest) {
                    markerIcon = L.divIcon({
                        className: 'custom-route-marker',
                        html: `
                            <div style="background-color: #ef4444; width: 32px; height: 32px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 8px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white;">
                                <i class="bi bi-flag-fill" style="font-size: 16px;"></i>
                            </div>`,
                        iconSize: [32, 32],
                        iconAnchor: [16, 30]
                    });
                    zIndex = 1020;
                } else {
                    markerIcon = L.divIcon({
                        className: 'custom-route-marker',
                        html: `
                            <div style="background-color: #3b82f6; width: 26px; height: 26px; border-radius: 50%; border: 2px solid white; box-shadow: 0 3px 6px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-family: sans-serif;">
                                ${index} 
                            </div>`,
                        iconSize: [26, 26],
                        iconAnchor: [13, 13]
                    });
                }

                const marker = L.marker([p.lat, p.lng], { icon: markerIcon, zIndexOffset: zIndex })
                    .bindPopup(`<b>${p.name}</b>`)
                    .addTo(simulatorMap);

                window.simulatorRouteMarkers.push(marker);
            });

            // Rota Azul
            simulatorRouteLayer = L.polyline(coordinates, {
                color: '#3b82f6',
                weight: 6,
                opacity: 0.9,
            }).addTo(simulatorMap);

            simulatorMap.fitBounds(simulatorRouteLayer.getBounds(), { padding: [50, 50] });

            // KPI Update
            document.getElementById('sim-distance').innerText = (path.distance / 1000).toFixed(1) + ' km';
            document.getElementById('sim-time').innerText = formatTime(path.time);

            // Tolls
            const routePointsPolyline = coordinates.map(c => ({ lat: c[0], lng: c[1] }));
            await calculateSimulatedTolls(simulatorRouteLayer.getBounds(), routePointsPolyline);

        } else {
            throw new Error("Não foi possível calcular a rota.");
        }
    } catch (err) {
        throw err;
    }
}

function formatTime(ms) {
    const totalMinutes = Math.floor(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${minutes}min`;
}

/**
 * Busca e exibe pedágios
 */
async function calculateSimulatedTolls(bounds, routePoints) {
    if (typeof fetchTollBooths !== 'function') return;

    const tolls = await fetchTollBooths(bounds, routePoints, []); // array vazio de stops
    const tollListEl = document.getElementById('sim-toll-list');
    tollListEl.innerHTML = '';
    let activeCount = 0;

    if (tolls.length === 0) {
        tollListEl.innerHTML = '<div class="text-center text-muted py-3">Nenhum pedágio encontrado nesta rota.</div>';
    } else {
        tolls.forEach(toll => {
            const isInactive = toll.status === 'inactive';
            const iconColor = isInactive ? 'text-secondary' : 'text-warning';
            if (!isInactive) activeCount++;

            // V8: UI Detalhada (Estilo Foto Usuário - Setas Coloridas)
            const listId = activeCount + 1000;

            // Lógica de Direção Unificada com script.js e PDF
            // Green=Up/N/E, Red=Down/S/W
            // script.js usa: isUp = (h >= 315 || h < 135);

            const h = toll.heading || 0;
            const isUp = (h >= 315 || h < 135);

            const directionIcon = isUp ? 'bi-arrow-up-circle-fill' : 'bi-arrow-down-circle-fill';
            const directionColor = isUp ? 'text-success' : 'text-danger';

            const card = document.createElement('div');
            card.className = 'sim-toll-item d-flex align-items-center p-2 mb-2 bg-dark border border-secondary rounded';
            card.innerHTML = `
                <div class="me-3">
                    <i class="bi ${directionIcon} fs-4 ${directionColor}"></i>
                </div>
                <div class="flex-grow-1">
                    <div class="text-white fw-bold" style="font-size: 0.85rem;">
                        ${listId} - ${toll.ref}/${toll.state}, ${toll.directionFull.toUpperCase()}, ${toll.cleanedName.toUpperCase()}
                    </div>
                </div>
                <div class="ms-2">
                     <i class="bi bi-arrow-down-circle text-muted" style="opacity: 0.5;"></i>
                </div>
            `;
            // Removed price/context detailed lines to match the "Photo 2" compact single-line look (roughly) 
            // The user photo has: [Icon] [Text....] [Collapse Icons]

            tollListEl.appendChild(card);

            const markerIcon = L.divIcon({
                className: 'custom-div-icon',
                html: `<div style="background-color: ${isInactive ? '#6c757d' : '#f59e0b'}; width: 10px; height: 10px; border-radius: 50%; border: 1px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.3);"></div>`,
                iconSize: [10, 10],
                iconAnchor: [5, 5]
            });

            const marker = L.marker([toll.lat, toll.lng], { icon: markerIcon }).addTo(simulatorMap);
            simulatorTollMarkers.push(marker);
        });
    }

    document.getElementById('sim-toll-count').innerText = activeCount;
}

window.runRouteSimulation = runRouteSimulation;
window.initSimulatorMap = initSimulatorMap;
window.addStopInput = addStopInput;
window.removeStop = removeStop;
window.handleStopChange = handleStopChange;
window.handleAutocomplete = handleAutocomplete;
window.toggleEpicLoading = toggleEpicLoading;
