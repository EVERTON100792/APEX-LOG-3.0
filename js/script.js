function toggleMobileSidebar() {
    const sidebar = document.getElementById('sidebar-modern');
    const overlay = document.getElementById('sidebar-overlay');
    sidebar.classList.toggle('mobile-open');
    overlay.style.display = sidebar.classList.contains('mobile-open') ? 'block' : 'none';
}

function activateView(viewId, linkElement) {
    // Hide all views
    document.querySelectorAll('.main-view').forEach(el => {
        el.classList.remove('active-view');
        el.style.display = 'none'; // Force hide
    });

    // Show target view
    const target = document.getElementById(viewId);
    if (target) {
        target.classList.add('active-view');
        target.style.display = 'block'; // Or flex/whatever depending on CSS, but active-view handles it usually

        // Special fix for some views needing flex
        if (viewId === 'summary-view' || viewId === 'workspace-view') {
            // target.style.display = 'block'; // active-view css handles this
        }
    }

    // Update Active Link State
    document.querySelectorAll('.sidebar-link').forEach(el => el.classList.remove('active'));
    if (linkElement) linkElement.classList.add('active');

    // Close sidebar on mobile if open
    if (window.innerWidth < 992) {
        toggleMobileSidebar();
    }

    // CRITICAL FIX: Reset scroll position to top when switching views
    window.scrollTo({ top: 0, behavior: 'instant' });

    // NOVO: Salva a view ativa para restaurar depois
    localStorage.setItem('lastActiveView', viewId);
}
// --- NOVO: LÃ³gica de Tema (movida para o escopo global) ---
function applyInitialTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark'; // PadrÃ£o para escuro
    document.documentElement.setAttribute('data-bs-theme', savedTheme);
    const themeSwitcher = document.getElementById('theme-switcher');
    if (themeSwitcher) {
        themeSwitcher.checked = savedTheme === 'light';
    }
}
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-bs-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-bs-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    // Redesenha o grÃ¡fico para se adaptar ao novo tema
    if (resumoChart) {
        // Adiciona um pequeno delay para garantir que as variÃ¡veis CSS do tema foram aplicadas
        setTimeout(() => { if (resumoChart) { resumoChart.destroy(); resumoChart = null; updateAndRenderChart(); } }, 100);
    }
}

// Chama a funÃ§Ã£o para aplicar o tema salvo assim que a pÃ¡gina carrega.
applyInitialTheme();
// ================================================================================================
//  NOVO: LÃ“GICA DE PERSISTÃŠNCIA DE DADOS DA PLANILHA COM IndexedDB
//  Isso garante que os dados brutos da planilha nÃ£o se percam ao recarregar a pÃ¡gina.
// ================================================================================================
const dbName = "ApexLogDB";
const storeName = "planilhaStore";

function openDb() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);
        request.onerror = (event) => reject("Erro ao abrir o IndexedDB.");
        request.onsuccess = (event) => resolve(event.target.result);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(storeName)) {
                db.createObjectStore(storeName, { keyPath: "id" });
            }
        };
    });
}

async function savePlanilhaToDb(data) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], "readwrite");
        const store = transaction.objectStore(storeName);
        const request = store.put({ id: "lastPlanilha", data: data });
        request.onsuccess = () => resolve();
        request.onerror = (event) => reject("Erro ao salvar a planilha no DB: " + event.target.error);
    });
}

async function loadPlanilhaFromDb() {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], "readonly");
        const store = transaction.objectStore(storeName);
        const request = store.get("lastPlanilha");
        request.onsuccess = (event) => resolve(event.target.result ? event.target.result.data : null);
        request.onerror = (event) => reject("Erro ao carregar a planilha do DB: " + event.target.error);
    });
}
// ================================================================================================
//  A LÃ“GICA DO GRÃFICO FOI ATUALIZADA PARA MELHORAR A VISUALIZAÃ‡ÃƒO DOS NÃšMEROS E A ESTÃ‰TICA.
//  O RESTANTE DO CÃ“DIGO JAVASCRIPT PERMANECE IDÃŠNTICO E TOTALMENTE FUNCIONAL.
// ================================================================================================
let resumoChart = null;

function updateAndRenderChart() {
    const vehicleCounts = { fiorino: 0, van: 0, tresQuartos: 0, toco: 0 };
    const vehicleWeights = { fiorino: 0, van: 0, tresQuartos: 0, toco: 0 };

    for (const loadId in activeLoads) {
        const load = activeLoads[loadId];
        if (vehicleCounts.hasOwnProperty(load.vehicleType)) {
            vehicleCounts[load.vehicleType]++;
            vehicleWeights[load.vehicleType] += load.totalKg;
        }
    }

    vehicleCounts.toco = Object.keys(gruposToco).length;
    for (const cf in gruposToco) {
        vehicleWeights.toco += gruposToco[cf].totalKg;
    }

    const totalCount = vehicleCounts.fiorino + vehicleCounts.van + vehicleCounts.tresQuartos + vehicleCounts.toco;
    const totalWeight = vehicleWeights.fiorino + vehicleWeights.van + vehicleWeights.tresQuartos + vehicleWeights.toco;

    const countSeriesData = [vehicleCounts.fiorino, vehicleCounts.van, vehicleCounts.tresQuartos, vehicleCounts.toco, totalCount];
    const weightSeriesData = [vehicleWeights.fiorino, vehicleWeights.van, vehicleWeights.tresQuartos, vehicleWeights.toco, totalWeight];
    const categories = ['Fiorino', 'Van', '3/4', 'Toco', 'Total'];

    if (resumoChart) {
        resumoChart.updateSeries([
            { name: 'Quantidade', type: 'column', data: countSeriesData },
            { name: 'Peso (kg)', type: 'area', data: weightSeriesData }
        ]);
    } else {
        const options = {
            series: [
                { name: 'Quantidade', type: 'column', data: countSeriesData },
                { name: 'Peso (kg)', type: 'area', data: weightSeriesData }
            ],
            chart: {
                height: 380,
                type: 'line', // Base type for mixed chart
                stacked: false,
                toolbar: { show: false },
                fontFamily: 'Inter, sans-serif',
                foreColor: 'var(--dark-text-secondary)',
                background: 'transparent',
                animations: {
                    enabled: true,
                    easing: 'easeinout',
                    speed: 800,
                    animateGradually: { enabled: true, delay: 150 },
                    dynamicAnimation: { enabled: true, speed: 350 }
                },
                dropShadow: {
                    enabled: true,
                    enabledOnSeries: [1], // Sombra apenas na linha de peso
                    top: 5,
                    left: 0,
                    blur: 3,
                    color: '#000',
                    opacity: 0.2
                }
            },
            colors: ['var(--dark-primary)', 'var(--dark-accent)'],
            stroke: {
                width: [0, 4], // 0 para barra, 4 para a linha da Ã¡rea
                curve: 'smooth'
            },
            plotOptions: {
                bar: {
                    columnWidth: '50%',
                    borderRadius: 6,
                    borderRadiusApplication: 'end', // Arredonda apenas o topo
                }
            },
            fill: {
                type: ['gradient', 'gradient'],
                gradient: {
                    shade: 'dark',
                    type: "vertical",
                    shadeIntensity: 0.5,
                    inverseColors: false,
                    opacityFrom: [0.85, 0.4], // Opacidade alta para barra, mÃ©dia para Ã¡rea
                    opacityTo: [0.95, 0.05],  // Opacidade alta para barra, transparente para Ã¡rea
                    stops: [0, 100]
                }
            },
            dataLabels: {
                enabled: true,
                enabledOnSeries: [0], // Apenas nas barras
                formatter: function (val, { seriesIndex }) {
                    return val.toFixed(0);
                },
                offsetY: -20,
                style: {
                    fontSize: '12px',
                    fontWeight: 'bold',
                    colors: ['var(--dark-text-primary)']
                },
                background: { enabled: false }
            },
            grid: {
                borderColor: 'var(--dark-border)',
                strokeDashArray: 5,
                xaxis: { lines: { show: false } },
                yaxis: { lines: { show: true } },
                padding: { top: 0, right: 0, bottom: 0, left: 10 }
            },
            xaxis: {
                categories: categories,
                axisBorder: { show: false },
                axisTicks: { show: false },
                labels: {
                    style: {
                        colors: 'var(--dark-text-secondary)',
                        fontSize: '12px',
                        fontWeight: 600,
                    }
                }
            },
            yaxis: [
                {
                    seriesName: 'Quantidade',
                    show: false, // Oculta eixo Y da esquerda para limpar o visual (jÃ¡ tem dataLabels)
                    labels: { style: { colors: 'var(--dark-text-secondary)' } },
                    title: {
                        text: "Quantidade de VeÃ­culos",
                        style: { color: 'var(--dark-primary)', fontWeight: 600 }
                    },
                },
                {
                    seriesName: 'Peso (kg)',
                    opposite: true,
                    labels: {
                        style: { colors: 'var(--dark-text-secondary)' },
                        formatter: function (val) {
                            return (val / 1000).toFixed(1) + "k";
                        }
                    },
                    title: {
                        text: "Peso Total (kg)",
                        style: { color: 'var(--dark-accent)', fontWeight: 600 }
                    }
                }
            ],
            tooltip: {
                theme: document.documentElement.getAttribute('data-bs-theme') || 'dark',
                shared: true,
                intersect: false,
                style: { fontSize: '12px' },
                y: {
                    formatter: function (val, { seriesIndex }) {
                        if (seriesIndex === 0) { // Quantidade
                            return val.toFixed(0) + " veÃ­culos";
                        } else { // Peso
                            return val.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) + " kg";
                        }
                    }
                }
            },
            legend: {
                show: true,
                position: 'top',
                horizontalAlign: 'right',
                floating: true,
                offsetY: -20,
                offsetX: -5,
                itemMargin: { horizontal: 10, vertical: 0 }
            },
            markers: {
                size: 5,
                colors: ['var(--dark-accent)'],
                strokeColors: '#fff',
                strokeWidth: 2,
                hover: { size: 7 }
            }
        };

        const chartContainer = document.querySelector("#chart-resumo-veiculos");
        if (chartContainer) {
            chartContainer.innerHTML = '';
            resumoChart = new ApexCharts(chartContainer, options);
            resumoChart.render();
        }
    }

    const container = document.getElementById('dashboard-content-container');
    const emptyState = document.getElementById('summary-empty-state');
    if (container) container.style.display = 'block';
    if (emptyState) emptyState.style.display = 'none';
}

const agendamentoClientCodes = new Set([
    '1398', '1494', '4639', '4872', '5546', '6896', 'D11238', '17163', '19622', '20350', '22545', '23556', '23761', '24465', '29302', '32462', '32831', '32851', '32869', '32905', '33039', '33046', '33047', '33107', '33388', '33392', '33400', '33401', '33403', '33406', '33420', '33494', '33676', '33762', '33818', '33859', '33907', '33971', '34011', '34096', '34167', '34425', '34511', '34810', '34981', '35050', '35054', '35798', '36025', '36580', '36792', '36853', '36945', '37101', '37589', '37634', '38207', '38448', '38482', '38564', '38681', '38735', 'D38896', '39081', '39177', '39620', '40144', '40442', '40702', '40844', '41233', '42200', '42765', '47244', '47253', '47349', '50151', '50816', '51993', '52780', '53134', '58645', '60900', '61182', '61315', '61316', '61317', '61318', '61324', '63080', '63500', '63705', '64288', '66590', '67660', '67884', '69281', '69286', '69318', '70968', '71659', '73847', '76019', '76580', '77475', '77520', '78895', '79838', '80727', '81353', 'DB3183', '83184', '83634', '85534', 'DB6159', '86350', '86641', '89073', '89151', '90373', '92017', '95092', '95660', '96758', '98227', '99268', '100087', '101246', '101253', '101346', '103518', '105394', '106198', '109288', '110023', '110894', '111145', '111154', '111302', '112207', '112670', '117028', '117123', '120423', '120455', '120473', '120533', '121747', '122155', '122785', '123815', '124320', '125228', '126430', '131476', '132397', '133916', '135395', '135928', '136086', '136260', '137919', '138825', '139013', '139329', '139611', '143102', '44192', '144457', '145014', '145237', '145322', '146644', '146988', '148071', '149598', '150503', '151981', '152601', '152835', '152925', '153289', '154423', '154778', '154808', '155177', '155313', '155368', '155419', '155475', '155823', '155888', '156009', '156585', '156696', '157403', '158235', '159168', '160382', '160982', '161737', '162499', '162789', '163234', '163382', '163458', '164721', '164779', '164780', '164924', '165512', '166195', '166337', '166353', '166468', '166469', '167353', '167810', '167819', '168464', '169863', '169971', '170219', '170220', '170516', '171147', '171160', '171191', '171200', '171320', '171529', '171642', '171863', '172270', '172490', '172656', '172859', '173621', '173964', '173977', '174249', '174593', '174662', '174901', '175365', '175425', '175762', '175767', '175783', '176166', '176278', '176453', '176747', '177327', '177488', '177529', '177883', '177951', '177995', '178255', '178377', '178666', '179104', '179510', '179542', '179690', '180028', '180269', '180342', '180427', '180472', '180494', '180594', '180772', '181012', '181052', '181179', '182349', '182885', '182901', '183011', '183016', '183046', '183048', '183069', '183070', '183091', '183093', '183477', '183676', '183787', '184011', '184038', '189677', '190163', '190241', '190687', '190733', '191148', '191149', '191191', '191902', '191972', '192138', '192369', '192638', '192713', '193211', '193445', '193509', '194432', '194508', '194750', '194751', '194821', '194831', '195287', '195338', '195446', '196118', '196405', '196446', '196784', '197168', '197249', '197983', '198187', '198438', '198747', '198796', '198895', '198907', '198908', '199172', '199615', '199625', '199650', '199651', '199713', '199733', '199927', '199991', '200091', '200194', '200239', '200253', '200382', '200404', '200597', '200917', '201294', '201754', '201853', '201936', '201948', '201956', '201958', '201961', '201974', '202022', '202187', '202199', '202714', '203072', '203093', '203201', '203435', '203436', '203451', '203512', '203769', '204895', '204910', '204911', '204913', '204914', '204915', '204917', '204971', '204979', '205108', '205220', '205744', '205803', '206116', '206163', '206208', '206294', '206380', '206628', '206730', '206731', '206994', '207024', '207029', '207403', '207689', '207902', '208489', '208613', '208622', '208741', '208822', '208844', '208853', '208922', '209002', '209004', '209248', '209281', '209321', '209322', '209684', '210124', '210230', '210490', '210747', '210759', '210819', '210852', '211059', '211110', '211276', '211277', '211279', '211332', '211411', '212401', '212417', '212573', '212900', '213188', '213189', '213190', '213202', '213203', '213242', '213442', '213454', '213855', '213909', '213910', '213967', '214046', '214150', '214387', '214433', '214442', '214594', '214746', '215022', '215116', '215160', '215161', '215493', '215494', '215651', '215687', '215733', '215777', '215942', '216112', '216393', '216400', '216630', '216684', '217190', '217283', '217310', '217343', '217545', '217605', '217828', '217871', '217872', '217877', '217949', '217965', '218169', '218196', '218383', '218486', '218578', '218580', '218640', '218820', '218845', '219539', '219698', '219715', '219884', '220158', '220183', '220645', '220950', '221023', '221248', '221251', '222164', '222165', '223025', '223379', '223525', '223703', '223727', '223877', '223899', '223900', '223954', '224956', '224957', '224958', '224959', '224961', '224962', '225112', '225408', '225449', '225904', '226903', '226939', '227190', '227387', '228589', '228693', '228695'
]);

const specialClientNames = ['IRMAOS MUFFATO S.A', 'IRMAOS MUFFATO & CIA LTDA', 'FINCO & FINCO', 'BOM DIA', 'CASA VISCARD S/A COM. E IMPORTACAO', 'PRIMATO COOPERATIVA AGROINDUSTRIAL'];

// ================================================================================================
//  INÃCIO DO SEU CÃ“DIGO JAVASCRIPT ORIGINAL (SEM MODIFICAÃ‡Ã•ES NA LÃ“GICA)
// ================================================================================================

// FunÃ§Ã£o para busca em tempo real que chama a funÃ§Ã£o principal de busca
function liveSearch() {
    buscarPedido();
}

function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    if (obj instanceof Date) {
        return new Date(obj.getTime());
    }
    if (Array.isArray(obj)) {
        const arrCopy = [];
        for (let i = 0; i < obj.length; i++) {
            arrCopy[i] = deepClone(obj[i]);
        }
        return arrCopy;
    }
    const objCopy = {};
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            objCopy[key] = deepClone(obj[key]);
        }
    }
    return objCopy;
}

/**
 * NOVA FUNÃ‡ÃƒO CENTRALIZADA: Verifica todos os tipos de bloqueio para um pedido.
 * Isso garante que a lÃ³gica seja a mesma em todos os lugares (KPIs, impressÃ£o, etc.).
 * @param {object} pedido O objeto do pedido a ser verificado.
 * @returns {boolean} Retorna true se o pedido estiver bloqueado, caso contrÃ¡rio false.
 */
function isPedidoBloqueado(pedido) {
    if (!pedido) return false;

    // 1. Bloqueio manual pelo usuÃ¡rio
    if (pedidosBloqueados.has(String(pedido.Num_Pedido))) return true;

    // 2. Bloqueio financeiro (C) ou comercial (V) direto na planilha
    const bloqueioPlanilha = String(pedido['BLOQ.'] || '').trim().toUpperCase();
    if (bloqueioPlanilha === 'C' || bloqueioPlanilha === 'V') return true;

    // 3. Bloqueio por regra de negÃ³cio (cliente tem outro pedido com CF numÃ©rico e bloqueio)
    const clientesComBloqueioRegra = new Set(pedidosComCFNumericoIsolado.map(p => normalizeClientId(p.Cliente)));
    const clienteId = normalizeClientId(pedido.Cliente);
    return clienteId && clientesComBloqueioRegra.has(clienteId);
}

// FunÃ§Ã£o centralizada para ordenar rotas de forma consistente
function getSortedVarejoRoutes(rotas) {
    const vehicleOrder = { 'fiorino': 1, 'van': 2, 'tresQuartos': 3 };
    const numericSort = (a, b) => a.localeCompare(b, undefined, { numeric: true });

    return rotas.sort((a, b) => {
        // Prioriza a Rota "0" para aparecer sempre em primeiro.
        if (a === '0' && b !== '0') return -1;
        if (b === '0' && a !== '0') return 1;

        const typeA = rotaVeiculoMap[a]?.type || 'van';
        const typeB = rotaVeiculoMap[b]?.type || 'van';

        const orderA = vehicleOrder[typeA] || 99; // 99 para tipos nÃ£o definidos
        const orderB = vehicleOrder[typeB] || 99;

        if (orderA !== orderB) {
            return orderA - orderB;
        }

        // Se ambos sÃ£o 'van', ordena as do ParanÃ¡ primeiro
        if (typeA === 'van' && typeB === 'van') {
            const isParanaA = rotaVeiculoMap[a]?.title.startsWith('Rota 1');
            const isParanaB = rotaVeiculoMap[b]?.title.startsWith('Rota 1');
            if (isParanaA && !isParanaB) return -1;
            if (!isParanaA && isParanaB) return 1;
        }

        // Se os tipos sÃ£o iguais, ordena numericamente pela rota
        return numericSort(a, b);
    });
}

function normalizeClientId(id) {
    if (id === null || typeof id === 'undefined') return '';
    return String(id).trim().replace(/^0+/, '');
}

function checkAgendamento(pedido) {
    if (!pedido) return;
    const normalizedCode = normalizeClientId(pedido.Cliente);
    const nomeCliente = pedido.Nome_Cliente ? String(pedido.Nome_Cliente).trim().toUpperCase() : '';
    if (nomeCliente === 'SUPERMERCADO O KILAO LTDA') {
        pedido.Agendamento = 'NÃ£o';
    } else {
        pedido.Agendamento = (agendamentoClientCodes.has(normalizedCode) || nomeCliente === 'PRIMATO COOPERATIVA AGROINDUSTRIAL') ? 'Sim' : 'NÃ£o';
    }
}

const isSpecialClient = (p) => p.Nome_Cliente && specialClientNames.includes(p.Nome_Cliente.toUpperCase().trim());

function getVehicleConfig(vehicleType) {
    const configs = {
        minKg: parseFloat(document.getElementById(`${vehicleType}MinCapacity`).value) || 0,
        softMaxKg: parseFloat(document.getElementById(`${vehicleType}MaxCapacity`).value) || 0,
        softMaxCubage: parseFloat(document.getElementById(`${vehicleType}Cubage`).value) || 0,
        hardMaxKg: parseFloat(document.getElementById(`${vehicleType}HardMaxCapacity`)?.value || document.getElementById(`${vehicleType}MaxCapacity`).value) || 0,
        hardMaxCubage: parseFloat(document.getElementById(`${vehicleType}HardCubage`)?.value || document.getElementById(`${vehicleType}Cubage`).value) || 0,
    };
    return configs;
}

function changeLoadVehicleType(loadId, newVehicleType) {
    if (!activeLoads || !activeLoads[loadId]) {
        console.error('Carga nÃ£o encontrada para alterar o tipo de veÃ­culo:', loadId);
        return;
    }

    const load = activeLoads[loadId];
    load.vehicleType = newVehicleType;

    // Recalcula o frete para o novo tipo de veÃ­culo se possÃ­vel
    if (typeof updateLoadFreightDisplay === 'function') {
        updateLoadFreightDisplay(loadId);
    }

    const cardElement = document.getElementById(loadId);
    if (cardElement) {
        const vehicleInfo = {
            fiorino: { name: 'Fiorino', colorClass: 'bg-success', textColor: 'text-white', icon: 'bi-box-seam-fill' },
            van: { name: 'Van', colorClass: 'bg-primary', textColor: 'text-white', icon: 'bi-truck-front-fill' },
            tresQuartos: { name: '3/4', colorClass: 'bg-warning', textColor: 'text-dark', icon: 'bi-truck-flatbed' },
            toco: { name: 'Toco', colorClass: 'bg-secondary', textColor: 'text-white', icon: 'bi-inboxes-fill' }
        };

        const newCardHTML = renderLoadCard(load, newVehicleType, vehicleInfo[newVehicleType]);
        cardElement.outerHTML = newCardHTML;

        const newCardElement = document.getElementById(loadId);
        if (newCardElement) {
            newCardElement.classList.add('highlight-change-animation');
            setTimeout(() => newCardElement.classList.remove('highlight-change-animation'), 1200);
        }
    }

    updateAndRenderKPIs();
    updateAndRenderChart();
    saveStateToLocalStorage();
}

let planilhaData = [];
let originalColumnHeaders = [];
let pedidosGeraisAtuais = [];
let gruposToco = {};
let gruposPorCFGlobais = {};
let pedidosComCFNumericoIsolado = [];
let pedidosManualmenteBloqueadosAtuais = [];
let pedidosPrioritarios = [];
let pedidosRecall = [];
let pedidosBloqueados = new Set();
let pedidosEspeciaisProcessados = new Set();
let pedidosSemCorte = new Set();
let pedidosVendaAntecipadaProcessados = new Set();
let rota1SemCarga = [];
let pedidosFuncionarios = [];
let pedidosCarretaSemCF = [];
let pedidosTransferencias = [];
let pedidosExportacao = [];
let cargasFechadasPR = [];
let pedidosMoinho = [];
let pedidosMarcaPropria = [];
let cargasFechadasRestBrasil = [];
let allSaoPauloLeftovers = []; // NOVO: Acumulador para sobras de SP
let pedidosCondorTruck = [];

let tocoPedidoIds = new Set();
let currentLeftoversForPrinting = [];
let activeLoads = {};
let kpiData = {}; // Objeto para armazenar dados dos KPIs
let processedRoutes = new Set();
let processedRouteContexts = {};
let specialLoadClipboard = []; // NOVO: Clipboard interno para montagem especial
let currentRouteInfo = {}; // NOVO: Armazena informaÃ§Ãµes da rota atual para compartilhamento
let origemCoords = null; // NOVO: VariÃ¡vel para armazenar as coordenadas da origem em cache
let manualLoadInProgress = null;

const defaultConfigs = {
    fiorinoMinCapacity: 300, fiorinoMaxCapacity: 500, fiorinoCubage: 1.5, fiorinoHardMaxCapacity: 560, fiorinoHardCubage: 1.7,
    vanMinCapacity: 1100, vanMaxCapacity: 1560, vanCubage: 5.0, vanHardMaxCapacity: 1600, vanHardCubage: 5.6,
    tresQuartosMinCapacity: 2300, tresQuartosMaxCapacity: 4100, tresQuartosCubage: 15.0, tresQuartosHardMaxCapacity: 4100, tresQuartosHardCubage: 15.0,
    tocoMinCapacity: 5000, tocoMaxCapacity: 8500, tocoCubage: 30.0
};

// --- NOVO: FunÃ§Ã£o de NotificaÃ§Ã£o (Toast) ---
// Movida para um escopo global para ser acessÃ­vel por outras funÃ§Ãµes como saveConfigurations.
function showToast(message, type = 'info') {
    const toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) return;

    const icons = { success: 'check-circle-fill', danger: 'exclamation-triangle-fill', warning: 'exclamation-triangle-fill', info: 'info-circle-fill' };
    const toastId = `toast-${Date.now()}`;

    const toastHtml = `
                <div id="${toastId}" class="toast align-items-center text-bg-${type} border-0" role="alert" aria-live="assertive" aria-atomic="true">
                    <div class="d-flex">
                        <div class="toast-body"><i class="bi bi-${icons[type]} me-2"></i>${message}</div>
                        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
                    </div>
                </div>`;
    toastContainer.insertAdjacentHTML('beforeend', toastHtml);
    const toastEl = document.getElementById(toastId);
    const toast = new bootstrap.Toast(toastEl, { delay: 5000 });
    toast.show();
}
function saveConfigurations() {
    const configStatus = document.getElementById('configStatus');
    configStatus.innerHTML = '<p class="text-info">Salvando configuraÃ§Ãµes no armazenamento local...</p>';
    try {
        const configs = {};
        Object.keys(defaultConfigs).forEach(key => {
            const element = document.getElementById(key);
            if (element) {
                configs[key] = parseFloat(element.value);
            }
        });
        // NOVO: Salva a chave da API do GraphHopper
        const apiKey = document.getElementById('graphhopperApiKey').value;
        localStorage.setItem('graphhopperApiKey', apiKey);

        localStorage.setItem('vehicleConfigs', JSON.stringify(configs));
        configStatus.innerHTML = '<p class="text-success">ConfiguraÃ§Ãµes salvas com sucesso!</p>';
        setTimeout(() => { configStatus.innerHTML = ''; }, 3000);
        showToast('ConfiguraÃ§Ãµes salvas com sucesso!', 'success');
    } catch (error) {
        console.error("Erro ao salvar no localStorage:", error);
        configStatus.innerHTML = `<p class="text-danger">Erro ao salvar as configuraÃ§Ãµes: ${error.message}</p>`;
    }
}

function loadConfigurations() { // prettier-ignore
    const configStatus = document.getElementById('configStatus');
    configStatus.innerHTML = '<p class="text-info">Carregando configuraÃ§Ãµes...</p>';
    try { // prettier-ignore
        const savedConfigs = localStorage.getItem('vehicleConfigs');
        const configs = savedConfigs ? JSON.parse(savedConfigs) : defaultConfigs;

        // NOVO: Carrega a chave da API do GraphHopper
        const defaultApiKey = '6aaa58ba-e39d-447e-86b4-34cc7eb03d85';
        const savedApiKey = localStorage.getItem('graphhopperApiKey');
        document.getElementById('graphhopperApiKey').value = savedApiKey || defaultApiKey;

        Object.keys(defaultConfigs).forEach(key => {
            const element = document.getElementById(key);
            if (element) {
                element.value = configs[key] !== undefined ? configs[key] : defaultConfigs[key];
            }
        });
        configStatus.innerHTML = '<p class="text-success">ConfiguraÃ§Ãµes carregadas!</p>';
        setTimeout(() => { configStatus.innerHTML = ''; }, 2000);
    } catch (error) {
        console.error("Erro ao carregar do localStorage:", error);
        configStatus.innerHTML = `<p class="text-warning">NÃ£o foi possÃ­vel carregar configuraÃ§Ãµes. Usando valores padrÃ£o.</p>`;
        Object.keys(defaultConfigs).forEach(key => {
            const element = document.getElementById(key);
            if (element) { element.value = defaultConfigs[key]; }
        });
    }
}

function resetFiorino() {
    document.getElementById('fiorinoMinCapacity').value = defaultConfigs.fiorinoMinCapacity;
    document.getElementById('fiorinoMaxCapacity').value = defaultConfigs.fiorinoMaxCapacity;
    document.getElementById('fiorinoCubage').value = defaultConfigs.fiorinoCubage;
    document.getElementById('fiorinoHardMaxCapacity').value = defaultConfigs.fiorinoHardMaxCapacity;
    document.getElementById('fiorinoHardCubage').value = defaultConfigs.fiorinoHardCubage;
    saveConfigurations();
}
function resetVan() {
    document.getElementById('vanMinCapacity').value = defaultConfigs.vanMinCapacity;
    document.getElementById('vanMaxCapacity').value = defaultConfigs.vanMaxCapacity;
    document.getElementById('vanCubage').value = defaultConfigs.vanCubage;
    document.getElementById('vanHardMaxCapacity').value = defaultConfigs.vanHardMaxCapacity;
    document.getElementById('vanHardCubage').value = defaultConfigs.vanHardCubage;
    saveConfigurations();
}
function resetTresQuartos() {
    document.getElementById('tresQuartosMinCapacity').value = defaultConfigs.tresQuartosMinCapacity;
    document.getElementById('tresQuartosMaxCapacity').value = defaultConfigs.tresQuartosMaxCapacity;
    document.getElementById('tresQuartosCubage').value = defaultConfigs.tresQuartosCubage;
    document.getElementById('tresQuartosHardMaxCapacity').value = defaultConfigs.tresQuartosHardMaxCapacity;
    document.getElementById('tresQuartosHardCubage').value = defaultConfigs.tresQuartosHardCubage;
    saveConfigurations();
}
function resetToco() {
    document.getElementById('tocoMinCapacity').value = defaultConfigs.tocoMinCapacity;
    document.getElementById('tocoMaxCapacity').value = defaultConfigs.tocoMaxCapacity;
    document.getElementById('tocoCubage').value = defaultConfigs.tocoCubage;
    // Adiciona os campos de peso e cubagem mÃ¡ximos absolutos para o Toco
    const tocoHardMaxCapacity = document.getElementById('tocoHardMaxCapacity');
    const tocoHardCubage = document.getElementById('tocoHardCubage');
    if (tocoHardMaxCapacity) tocoHardMaxCapacity.value = defaultConfigs.tocoHardMaxCapacity;
    if (tocoHardCubage) tocoHardCubage.value = defaultConfigs.tocoHardCubage;
    saveConfigurations();
}
function resetAll() {
    Object.keys(defaultConfigs).forEach(key => {
        const element = document.getElementById(key);
        if (element) element.value = defaultConfigs[key];
    });
    saveConfigurations();
}

/**
 * Limpa o estado atual da aplicaÃ§Ã£o, resetando variÃ¡veis e a interface do usuÃ¡rio.
 */
function limparEstadoAtual() {
    try {
        // 1. Resetar variÃ¡veis globais
        planilhaData = [];
        originalColumnHeaders = [];
        pedidosGeraisAtuais = [];
        gruposToco = {};
        gruposPorCFGlobais = {};
        pedidosComCFNumericoIsolado = [];
        pedidosManualmenteBloqueadosAtuais = [];
        pedidosPrioritarios = [];
        pedidosRecall = [];
        pedidosBloqueados = new Set();
        pedidosEspeciaisProcessados = new Set();
        pedidosSemCorte = new Set();
        pedidosVendaAntecipadaProcessados = new Set();
        rota1SemCarga = [];
        pedidosFuncionarios = [];
        pedidosCarretaSemCF = [];
        pedidosTransferencias = [];
        pedidosExportacao = [];
        cargasFechadasPR = [];
        pedidosMoinho = [];
        pedidosMarcaPropria = [];
        cargasFechadasRestBrasil = [];
        allSaoPauloLeftovers = []; // NOVO: Limpa o acumulador
        pedidosCondorTruck = [];
        tocoPedidoIds = new Set();
        currentLeftoversForPrinting = [];
        activeLoads = {};
        kpiData = {};
        processedRoutes = new Set();
        processedRouteContexts = {};
        specialLoadClipboard = [];
        origemCoords = null;
        manualLoadInProgress = null;
        localStorage.removeItem('currentSessionName'); // Remove o nome da sessÃ£o ao limpar estado
        console.log('VariÃ¡veis globais resetadas.');

        // 2. Resetar estado da UI (com verificaÃ§Ãµes)
        const resetElement = (id, content = '') => {
            const el = document.getElementById(id);
            if (el) {
                el.innerHTML = content;
            } else {
                console.warn(`Elemento com ID "${id}" nÃ£o encontrado para resetar.`);
            }
        };

        const resetValue = (id, value = '') => {
            const el = document.getElementById(id);
            if (el) {
                el.value = value;
            }
        };

        const hideElement = (id) => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        };

        const showElement = (id, display = 'block') => {
            const el = document.getElementById(id);
            if (el) el.style.display = display;
        };

        const emptyStateHTML = (icon, text) => `<div class="empty-state"><i class="bi bi-${icon}"></i><p>${text}</p></div>`;

        // Resetar inputs e controles principais
        resetValue('fileInput');
        const processarBtn = document.getElementById('processarBtn');
        if (processarBtn) processarBtn.disabled = true;
        const startManualLoadBtn = document.getElementById('start-manual-load-btn');
        if (startManualLoadBtn) startManualLoadBtn.disabled = true;
        resetElement('status');
        hideElement('filtro-rota-container');
        resetElement('rotaInicioSelect', '<option value="">Rota de InÃ­cio...</option>');
        resetElement('rotaFimSelect', '<option value="">Rota de Fim...</option>');

        // Resetar Dashboard
        if (resumoChart) {
            resumoChart.destroy();
            resumoChart = null;
        }
        hideElement('dashboard-content-container');
        showElement('summary-empty-state');
        resetElement('kpi-main-container');
        resetElement('kpi-other-container');
        resetElement('chart-subtitle');

        // Resetar Mesas de Trabalho
        resetElement('botoes-fiorino', emptyStateHTML('box', 'Nenhuma rota de Fiorino disponÃ­vel.'));
        resetElement('resultado-fiorino-geral');
        resetElement('botoes-van', emptyStateHTML('truck-front-fill', 'Nenhuma rota de Van disponÃ­vel.'));
        resetElement('resultado-van-geral');
        resetElement('botoes-34', emptyStateHTML('truck-flatbed', 'Nenhuma rota de 3/4 disponÃ­vel.'));
        resetElement('resultado-34-geral');
        resetElement('resultado-toco', emptyStateHTML('inboxes-fill', 'Nenhuma carga "Toco" encontrada.'));
        resetElement('resultado-cargas-fechadas-pr', emptyStateHTML('building-fill-check', 'Nenhuma Carga Fechada do ParanÃ¡ encontrada.'));
        resetElement('resultado-cargas-fechadas-rest-br', emptyStateHTML('globe-americas', 'Nenhuma Carga Fechada (Resto do Brasil) encontrada.'));
        resetElement('resultado-moinho', emptyStateHTML('gear-wide-connected', 'Nenhum pedido "Moinho" encontrado.'));
        resetElement('resultado-roteirizados', emptyStateHTML('map', 'Nenhuma carga roteirizada por lista.'));
        resetElement('resultado-funcionarios', emptyStateHTML('people-fill', 'Nenhum pedido de funcionÃ¡rio encontrado.'));
        resetElement('resultado-transferencias', emptyStateHTML('arrow-left-right', 'Nenhum pedido de transferÃªncia encontrado.'));
        document.getElementById('export-sobras-sp-btn').disabled = true; // NOVO: Desabilita o botÃ£o de exportar sobras
        resetElement('resultado-exportacao', emptyStateHTML('box-arrow-up-right', 'Nenhum pedido de exportaÃ§Ã£o encontrado.'));
        resetElement('resultado-marca-propria', emptyStateHTML('tags-fill', 'Nenhum pedido de Marca PrÃ³pria encontrado.'));

        // Adicionado: Resetar a aba "Outros Pedidos" para o estado inicial
        const outrosPedidosTab = document.getElementById('outros-pedidos-tab-pane');
        if (outrosPedidosTab) {
            outrosPedidosTab.innerHTML = `<div id="resultado-moinho" class="mb-3"><div class="empty-state"><i class="bi bi-gear-wide-connected"></i><p>Nenhum pedido "Moinho" encontrado.</p></div></div><hr><div id="resultado-funcionarios" class="mb-3"><div class="empty-state"><i class="bi bi-people-fill"></i><p>Nenhum pedido de funcionÃ¡rio encontrado.</p></div></div><hr><div id="resultado-transferencias" class="mb-3"><div class="empty-state"><i class="bi bi-arrow-left-right"></i><p>Nenhum pedido de transferÃªncia encontrado.</p></div></div><hr><div id="resultado-exportacao" class="mb-3"><div class="empty-state"><i class="bi bi-box-arrow-up-right"></i><p>Nenhum pedido de exportaÃ§Ã£o encontrado.</p></div></div><hr><div id="resultado-marca-propria"><div class="empty-state"><i class="bi bi-tags-fill"></i><p>Nenhum pedido de Marca PrÃ³pria encontrado.</p></div></div>`;
        }

        // Resetar Pedidos & Consultas
        resetValue('pedidoSearchInput');
        resetElement('search-result');
        resetElement('resultado-geral', emptyStateHTML('file-earmark-excel', 'Nenhum pedido de varejo disponÃ­vel.'));
        resetElement('resultado-cf-numerico', emptyStateHTML('funnel', 'Nenhum pedido bloqueado por regra.'));

        // Resetar Montagens Especiais
        resetValue('vendaAntecipadaInput');
        resetElement('resultado-venda-antecipada');
        resetValue('pedidosEspeciaisInput');
        resetElement('resultado-carga-especial');

        // Resetar AnÃ¡lises
        resetElement('resultado-bloqueados');
        resetElement('resultado-rota1');

        // Resetar Modal de Configs
        resetValue('bloquearPedidoInput');
        resetElement('lista-pedidos-bloqueados', emptyStateHTML('shield-slash', 'Nenhum pedido bloqueado.'));
        resetValue('semCorteInput');
        resetElement('lista-pedidos-sem-corte', emptyStateHTML('scissors', 'Nenhum pedido marcado.'));

        // Limpar estado de persistÃªncia
        localStorage.removeItem('logisticsAppState');
        localStorage.removeItem('logisticsRouteContexts');
        localStorage.removeItem('sidebarCollapsed');
        localStorage.removeItem('lastActiveView');
        localStorage.removeItem('lastActiveTab');
        console.log('Estado do LocalStorage limpo.');

        // Navegar para a view de resumo
        const summaryLink = document.querySelector('a[href="#summary-view"]');
        if (summaryLink) summaryLink.click();

    } catch (e) {
        console.error('Erro durante a execuÃ§Ã£o de limparTudo:', e);
        showToast('Ocorreu um erro ao tentar limpar os dados. Verifique o console.', 'error');
    }
}

/**
 * FunÃ§Ã£o principal de limpeza chamada pelo botÃ£o "Limpar Sistema".
 * Limpa o estado e recarrega a pÃ¡gina para um reset completo.
 */
async function limparTudoCompletamente() {
    limparEstadoAtual(); // Limpa variÃ¡veis e localStorage
    const db = await openDb(); // Limpa o IndexedDB
    const transaction = db.transaction([storeName], "readwrite");
    transaction.objectStore(storeName).clear();
}
function limparTudo() {
    console.log('FunÃ§Ã£o "limparTudo" iniciada para reset completo.');
    limparEstadoAtual(); // Limpa o estado atual
    limparEstadoAtual(); // Limpa o estado atual
    location.reload(); // Recarrega a pÃ¡gina
    if (window.triggerLogActivity) window.triggerLogActivity('LIMPEZA_SISTEMA', { tipo: 'completa' });
}


document.addEventListener('DOMContentLoaded', () => {
    try {
        loadConfigurations();
    } catch (e) {
        console.error("Falha crÃ­tica ao carregar configuraÃ§Ãµes, listeners ainda serÃ£o ativados.", e);
    }

    // NOVO: Restaura o estado da aplicaÃ§Ã£o ao iniciar
    loadStateFromLocalStorage();

    document.getElementById('saveConfig').addEventListener('click', saveConfigurations);
    document.getElementById('pedidoSearchInput')?.addEventListener('keyup', (event) => {
        // A busca em tempo real jÃ¡ Ã© feita pelo onkeyup no HTML.
        // Esta parte pode ser usada para aÃ§Ãµes especÃ­ficas do Enter, se necessÃ¡rio,
        // mas com a busca em tempo real, geralmente nÃ£o Ã© preciso.
        // if (event.key === 'Enter') {
        //     buscarPedido();
        // }
    });

    // Inicializa os tooltips do Bootstrap
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    const tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));

    // LÃ³gica de navegaÃ§Ã£o por abas/views no Top Navbar
    document.querySelectorAll('a[href^="#"].nav-link, .dropdown-item[href^="#"]')?.forEach(link => {
        link.addEventListener('click', function (e) {
            // Se o link clicado for um submenu toggle, nÃ£o faz nada
            if (this.classList.contains('dropdown-toggle')) return;

            const targetViewId = this.getAttribute('href');
            if (!targetViewId.startsWith('#')) return;

            e.preventDefault();

            // Remove 'active' de TODOS os links de navegaÃ§Ã£o
            document.querySelectorAll('.nav-modern-top .nav-link, .dropdown-item').forEach(el => {
                el.classList.remove('active');
            });

            // Adiciona 'active' no link clicado
            this.classList.add('active');

            // Se for um item de dropdown, marca o pai como ativo
            const parentDropdown = this.closest('.dropdown');
            if (parentDropdown) {
                parentDropdown.querySelector('.nav-link').classList.add('active');
            }

            // Esconde a view ativa atualmente
            document.querySelectorAll('.main-view').forEach(view => {
                view.classList.remove('active-view');
            });

            // Mostra a nova view
            const targetView = document.querySelector(targetViewId);
            if (targetView) {
                targetView.classList.add('active-view');
            }

            // Salva a Ãºltima view ativa
            localStorage.setItem('lastActiveView', targetViewId);

            if (targetViewId === '#summary-view' && resumoChart) {
                setTimeout(() => updateAndRenderChart(), 50);
            }
        });
    });

    document.getElementById('optimizationLevelSelect')?.addEventListener('change', updateOptimizationDescription);
    updateOptimizationDescription();

    // --- LÃ³gica para Sidebar RecolhÃ­vel (REMOVIDA - Agora via CSS puro) ---
    const body = document.body;
    // Removed listener logic

    // Verifica o estado salvo ao carregar a pÃ¡gina (opcional, pode manter ou remover)
    if (localStorage.getItem('sidebarCollapsed') === 'true') {
        body.classList.add('sidebar-collapsed');
    }

    // LÃ³gica para salvar a aba ativa da Mesa de Trabalho
    const vehicleTabs = document.querySelectorAll('#vehicleTabs button[data-bs-toggle="tab"]'); // prettier-ignore
    vehicleTabs.forEach(tab => {
        tab.addEventListener('shown.bs.tab', event => {
            localStorage.setItem('lastActiveTab', event.target.getAttribute('data-bs-target'));
        });
    });

    // Restaura o estado da aplicaÃ§Ã£o a partir do localStorage ao carregar a pÃ¡gina.
    // REATIVADO: Garante persistÃªncia em F5
    loadStateFromLocalStorage();

    // Restaura a Ãºltima view e aba ativas
    const lastView = localStorage.getItem('lastActiveView');
    if (lastView) {
        document.querySelector(`a[href="${lastView}"]`)?.click();
    }
    const lastTab = localStorage.getItem('lastActiveTab');
    if (lastTab) {
        document.querySelector(`button[data-bs-target="${lastTab}"]`)?.click();
    }

    document.addEventListener('shown.bs.collapse', function (event) { // prettier-ignore
        const accordionCollapse = event.target;
        const accordionHeader = accordionCollapse.previousElementSibling;

        if (!accordionHeader) return; // Sai se nÃ£o encontrar o cabeÃ§alho

        setTimeout(() => {
            // Procura pelo container de rolagem mais prÃ³ximo. Pode ser um .card-body ou o #vehicleTabsContent.
            const scrollableContainer = accordionCollapse.closest('.card-body[style*="overflow-y: auto"], #vehicleTabsContent');

            if (scrollableContainer) {
                // --- NOVO: LÃ³gica para rolagem interna ---
                // Calcula a posiÃ§Ã£o do cabeÃ§alho do acordeÃ£o em relaÃ§Ã£o ao topo do container de rolagem.
                const headerTop = accordionHeader.offsetTop;
                // A posiÃ§Ã£o de rolagem do container Ã© a posiÃ§Ã£o do cabeÃ§alho menos a posiÃ§Ã£o inicial do prÃ³prio container.
                const containerScrollTop = scrollableContainer.offsetTop;

                scrollableContainer.scrollTo({
                    // Rola para a posiÃ§Ã£o do cabeÃ§alho, subtraindo a posiÃ§Ã£o do container e um pequeno offset para margem.
                    top: headerTop - containerScrollTop - 10,
                    behavior: 'smooth'
                });
            } else {
                // --- Comportamento antigo (padrÃ£o) ---
                // Se nÃ£o estiver dentro de um container com rolagem, usa a rolagem da pÃ¡gina principal.
                accordionHeader.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }, 150); // Delay para garantir que a animaÃ§Ã£o de abertura nÃ£o interfira na rolagem.
    });

    // --- LÃ³gica para Menu de Contexto ---
    const contextMenu = document.getElementById('context-menu');

    document.addEventListener('contextmenu', function (e) { // prettier-ignore
        const targetRow = e.target.closest('tr[data-pedido-id]');
        if (!targetRow) {
            contextMenu.style.display = 'none';
            return;
        }

        e.preventDefault();

        // Verifica se hÃ¡ mÃºltiplos pedidos selecionados (via checkbox)
        const selectedCheckboxes = Array.from(document.querySelectorAll('.row-checkbox:checked'));
        const isMultiSelect = selectedCheckboxes.length > 0;
        const pedidoId = targetRow.dataset.pedidoId; // Pega o ID da linha clicada

        contextMenu.innerHTML = `
                    ${isMultiSelect ?
                `<a class="dropdown-item" href="#" onclick="copyForSpecialLoad()"><i class="bi bi-clipboard-plus-fill text-info me-2"></i>Copiar ${selectedCheckboxes.length} Pedido(s) para Montagem</a>` :
                `<a class="dropdown-item" href="#" onclick="copyForSpecialLoad('${pedidoId}')"><i class="bi bi-clipboard-plus-fill text-info me-2"></i>Copiar para Montagem</a>`
            }
                    <div class="dropdown-divider"></div>
                    <a class="dropdown-item" href="#" onclick="priorizarPedido('${pedidoId}')"><i class="bi bi-star-fill text-warning me-2"></i>Priorizar este Pedido</a>
                    <a class="dropdown-item" href="#" onclick="priorizarRecall('${pedidoId}')"><i class="bi bi-arrow-repeat text-info me-2"></i>Marcar este para Recall</a>
                    <a class="dropdown-item" href="#" onclick="bloquearPedido('${pedidoId}')"><i class="bi bi-slash-circle-fill text-danger me-2"></i>Bloquear este Pedido</a>
                    <div class="dropdown-divider"></div>
                    <a class="dropdown-item" href="#" onclick="copiarParaClipboard('${pedidoId}')"><i class="bi bi-clipboard-check me-2"></i>Copiar NÂº deste Pedido</a>
                `;

        contextMenu.style.display = 'block';
        contextMenu.style.left = `${e.pageX}px`;
        contextMenu.style.top = `${e.pageY}px`;
    });

    document.addEventListener('click', function () { // prettier-ignore
        contextMenu.style.display = 'none';
    });

    // NOVO: Adiciona os event listeners para os botÃµes do modal do mapa
    const printMapBtn = document.getElementById('printMapBtn');
    const shareWhatsAppBtn = document.getElementById('shareWhatsAppBtn');
    if (printMapBtn) printMapBtn.addEventListener('click', printMap);
    if (shareWhatsAppBtn) shareWhatsAppBtn.addEventListener('click', shareRouteOnWhatsApp);
});

/**
 * NOVO: Copia os nÃºmeros de pedido selecionados para o clipboard de montagem especial.
 * @param {string|null} singlePedidoId - Se fornecido, copia apenas este pedido.
 */
function copyForSpecialLoad(singlePedidoId = null) {
    let pedidosACopiar = [];
    if (singlePedidoId) {
        pedidosACopiar = [singlePedidoId];
    } else {
        pedidosACopiar = Array.from(document.querySelectorAll('.row-checkbox:checked')).map(cb => cb.value);
    }

    if (pedidosACopiar.length === 0) return;

    specialLoadClipboard = [...pedidosACopiar]; // Substitui o clipboard com a nova seleÃ§Ã£o
    showToast(`${specialLoadClipboard.length} pedido(s) copiado(s) para a montagem especial.`, 'success');
}

function pasteToSpecialLoad(inputId) {
    if (specialLoadClipboard.length === 0) { showToast("Nenhum pedido na Ã¡rea de transferÃªncia especial.", 'warning'); return; }
    document.getElementById(inputId).value = specialLoadClipboard.join('\n');
};

function copiarParaClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        // Opcional: mostrar uma notificaÃ§Ã£o de sucesso
        // alert(`'${text}' copiado para a Ã¡rea de transferÃªncia!`);
    }).catch(err => {
        console.error('Erro ao copiar texto: ', err);
    });
};

function updateOptimizationDescription() {
    const level = document.getElementById('optimizationLevelSelect').value;
    const descriptionDiv = document.getElementById('optimization-description');
    if (level === '1') {
        descriptionDiv.innerHTML = `<p class="mb-1"><strong>RÃ¡pido:</strong> Usa uma abordagem direta para agrupar pedidos. Ideal para resultados imediatos com boa qualidade.</p>`;
    } else {
        descriptionDiv.innerHTML = `<p class="mb-1"><strong>Especialista (Recomendado):</strong> Simula um profissional experiente. Utiliza mÃºltiplas estratÃ©gias, otimizaÃ§Ã£o profunda e reconstruÃ§Ã£o inteligente para minimizar as sobras ao mÃ¡ximo, respeitando todas as regras.</p>`;
    }
}


const rotaVeiculoMap = {
    // Novas rotas de SÃ£o Paulo (Varejo - Van/3/4)
    '2555': { type: 'van', title: 'Van / 3/4 SÃ£o Paulo - Rota 2555' }, '2560': { type: 'van', title: 'Van / 3/4 SÃ£o Paulo - Rota 2560' }, '2561': { type: 'van', title: 'Van / 3/4 SÃ£o Paulo - Rota 2561' },
    '2565': { type: 'van', title: 'Van / 3/4 SÃ£o Paulo - Rota 2565' }, '2566': { type: 'van', title: 'Van / 3/4 SÃ£o Paulo - Rota 2566' },
    '2571': { type: 'van', title: 'Van / 3/4 SÃ£o Paulo - Rota 2571' }, '2575': { type: 'van', title: 'Van / 3/4 SÃ£o Paulo - Rota 2575' },
    '2705': { type: 'van', title: 'Van / 3/4 SÃ£o Paulo - Rota 2705' }, '2735': { type: 'van', title: 'Van / 3/4 SÃ£o Paulo - Rota 2735' }, '2745': { type: 'van', title: 'Van / 3/4 SÃ£o Paulo - Rota 2745' },
    // Rotas do ParanÃ¡ (Varejo)
    '11101': { type: 'fiorino', title: 'Rota 11101' }, '11301': { type: 'fiorino', title: 'Rota 11301' }, '11311': { type: 'fiorino', title: 'Rota 11311' }, '11561': { type: 'fiorino', title: 'Rota 11561' }, '11721': { type: 'fiorino', title: 'Rotas 11721 & 11731', combined: ['11731'] }, '11731': { type: 'fiorino', title: 'Rotas 11721 & 11731', combined: ['11721'] },
    '11102': { type: 'fiorino', title: 'Rota 11102' }, '11331': { type: 'fiorino', title: 'Rota 11331' }, '11341': { type: 'van', title: 'Rota 11341' }, '11342': { type: 'van', title: 'Rota 11342' }, '11351': { type: 'van', title: 'Rota 11351' }, '11521': { type: 'van', title: 'Rota 11521' }, '11531': { type: 'van', title: 'Rota 11531' }, '11551': { type: 'fiorino', title: 'Rota 11551' }, '11571': { type: 'fiorino', title: 'Rota 11571' }, '11701': { type: 'van', title: 'Rota 11701' }, '11711': { type: 'fiorino', title: 'Rota 11711' },
    '11361': { type: 'tresQuartos', title: 'Rota 11361' }, '11501': { type: 'tresQuartos', title: 'Rotas 11501, 11502 & 11511', combined: ['11502', '11511'] }, '11502': { type: 'tresQuartos', title: 'Rotas 11501, 11502 & 11511', combined: ['11501', '11511'] }, '11511': { type: 'tresQuartos', title: 'Rotas 11501, 11502 & 11511', combined: ['11501', '11502'] }, '11541': { type: 'tresQuartos', title: 'Rota 11541' }
};

// Mapa de rotas e suas cidades permitidas para Fiorino (Global)
const rotasEspeciaisFiorino = {
    '11711': [
        'MANDAGUACU', 'SAO JORGE DO IVAI', 'TAMBOARA', 'GUAIRACA',
        'PARANAVAI', 'NOVA ESPERANCA', 'FLORAI',
        'PRESIDENTE CASTELO BRANCO'
    ],
    '11102': [
        'IBAITI', 'FIGUEIRA', 'NOVA SANTA BARBARA',
        'PINHALAO', 'CURTIUVA'
    ],
    '11331': [
        'TERRA BOA', 'ENGENHEIRO BELTRAO', 'PEABIRU', 'CAMPO MOURAO',
        'BARBOSA FERRAZ', 'FENIX', 'ARARUNA',
        'ITAMBE', 'FLORESTA', 'IVATUBA'
    ],
    '11551': [
        'IVAIPORA', 'JARDIM ALEGRE', 'SAO JOAO DO IVAI',
        'NOVA TEBAS'
    ],
    '11571': [
        'ORTIGUEIRA', 'IMBAU', 'TELEMACO BORBA'
    ]
};

const fileInput = document.getElementById('fileInput');
const processarBtn = document.getElementById('processarBtn');
const statusDiv = document.getElementById('status');
const isNumeric = (str) => str && /^\d+$/.test(String(str).trim());

fileInput.addEventListener('change', (event) => { handleFile(event.target.files[0]); });

function handleFile(file, isReload = false) {
    if (!file) return;

    // Se for recarregamento e jÃ¡ tivermos dados (do IndexedDB/LocalStorage),
    // apenas atualizamos a UI e saÃ­mos para evitar ler o arquivo vazio simulado.
    if (isReload && typeof planilhaData !== 'undefined' && planilhaData.length > 0) {
        statusDiv.innerHTML = `<p class="text-success">Planilha "${file.name}" restaurada.</p>`;
        processarBtn.disabled = false;
        popularFiltrosDeRota();
        return;
    }

    // CORREÃ‡ÃƒO: A limpeza agora sÃ³ ocorre se um arquivo for selecionado manualmente,
    // e nÃ£o durante um recarregamento de pÃ¡gina (isReload = false).
    if (!isReload) {
        console.log("Novo arquivo selecionado. Limpando estado anterior.");
        limparEstadoAtual();
        openDb().then(db => {
            const transaction = db.transaction([storeName], "readwrite");
            transaction.objectStore(storeName).clear();
        });
    }

    statusDiv.innerHTML = '<p class="text-info">Carregando planilha...</p>';
    processarBtn.disabled = true;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array', cellDates: true });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            let headerRowIndex = -1;
            for (let i = 0; i < rawData.length; i++) {
                const row = rawData[i];
                if (row && row.some(cell => String(cell).trim().toLowerCase() === 'cod_rota')) {
                    headerRowIndex = i;
                    originalColumnHeaders = row.map(h => h ? String(h).trim() : '');
                    break;
                }
            }

            if (headerRowIndex === -1) throw new Error("NÃ£o foi possÃ­vel encontrar a linha de cabeÃ§alho com 'Cod_Rota'. Verifique o arquivo.");

            const dataRows = rawData.slice(headerRowIndex + 1);
            planilhaData = dataRows.map(row => {
                const pedido = {};
                originalColumnHeaders.forEach((header, i) => {
                    if (header) {
                        if ((header.toLowerCase() === 'predat' || header.toLowerCase() === 'dat_ped')) {
                            let cellValue = row[i];
                            if (typeof cellValue === 'number') {
                                const date = new Date(Math.round((cellValue - 25569) * 86400 * 1000));
                                if (date instanceof Date && !isNaN(date.getTime())) {
                                    pedido[header] = date;
                                } else {
                                    pedido[header] = '';
                                }
                            } else if (cellValue instanceof Date) {
                                if (cellValue instanceof Date && !isNaN(cellValue.getTime())) {
                                    pedido[header] = cellValue;
                                } else {
                                    pedido[header] = '';
                                }
                            } else {
                                pedido[header] = cellValue !== undefined ? cellValue : '';
                            }
                        } else if (header === 'Num_Pedido') {
                            pedido[header] = String(row[i] !== undefined ? row[i] : '').trim();
                        } else {
                            pedido[header] = row[i] !== undefined ? row[i] : '';
                        }
                    }
                });
                pedido.Quilos_Saldo = parseFloat(String(pedido.Quilos_Saldo).replace(',', '.')) || 0;
                pedido.Cubagem = parseFloat(String(pedido.Cubagem).replace(',', '.')) || 0;
                return pedido;
            });
            planilhaData.forEach(checkAgendamento);

            // NOVO: Salva os dados da planilha no IndexedDB para persistÃªncia
            savePlanilhaToDb(planilhaData).then(() => {
                console.log("Dados da planilha salvos no IndexedDB com sucesso.");
            }).catch(err => {
                console.error(err);
            });

            statusDiv.innerHTML = `<p class="text-success">Planilha "${file.name}" carregada.</p>`;
            if (isReload) statusDiv.innerHTML = `<p class="text-success">Planilha "${file.name}" restaurada.</p>`;
            processarBtn.disabled = false;

            popularFiltrosDeRota();

            if (isReload) return;

            const autoProcessCheckbox = document.getElementById('autoProcessCheckbox');
            if (autoProcessCheckbox && autoProcessCheckbox.checked) {
                processar();
                // Log activity via Exposed Global or module imports if accessible. 
                // Since this is inside a script tag not module, we might need a bridge.
                // We'll rely on the processar() function to trigger the log if updated, 
                // OR dispatch an event.
            }

        } catch (error) {
            statusDiv.innerHTML = `<p class="text-danger"><strong>Erro:</strong> ${error.message}</p>`;
            console.error(error);
        }
    };
    reader.readAsArrayBuffer(file);
}

function popularFiltrosDeRota() {
    const container = document.getElementById('filtro-rota-container');
    const rotaInicioSelect = document.getElementById('rotaInicioSelect');
    const rotaFimSelect = document.getElementById('rotaFimSelect');

    // VerificaÃ§Ã£o de seguranÃ§a: se os elementos nÃ£o existem, retorna silenciosamente
    if (!rotaInicioSelect || !rotaFimSelect) {
        console.warn('Elementos de filtro de rota nÃ£o encontrados no DOM. Funcionalidade desabilitada.');
        if (container) container.style.display = 'none';
        return;
    }

    rotaInicioSelect.innerHTML = '<option value="">Rota de InÃ­cio...</option>';
    rotaFimSelect.innerHTML = '<option value="">Rota de Fim...</option>';

    if (planilhaData.length === 0) {
        if (container) container.style.display = 'none';
        return;
    }

    const rotas = [...new Set(planilhaData.map(p => String(p.Cod_Rota || '')))].filter(Boolean);
    rotas.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    rotas.forEach(rota => {
        const option = new Option(rota, rota);
        rotaInicioSelect.add(option.cloneNode(true));
        rotaFimSelect.add(option);
    });

    if (container) container.style.display = 'block';
}

function limparFiltroDeRota() {
    const rotaInicioSelect = document.getElementById('rotaInicioSelect');
    const rotaFimSelect = document.getElementById('rotaFimSelect');

    if (rotaInicioSelect) rotaInicioSelect.value = '';
    if (rotaFimSelect) rotaFimSelect.value = '';
}

function buscarPedido() {
    const searchInput = document.getElementById('pedidoSearchInput');
    const searchResultDiv = document.getElementById('search-result');

    // VerificaÃ§Ã£o de seguranÃ§a
    if (!searchInput || !searchResultDiv) {
        console.warn('Elementos de busca de pedido nÃ£o encontrados no DOM.');
        return;
    }

    const searchTerm = searchInput.value.trim().toLowerCase();
    searchResultDiv.innerHTML = '';

    if (!searchTerm) return;

    if (planilhaData.length === 0) {
        searchResultDiv.innerHTML = '<p class="text-warning">Por favor, carregue e processe a planilha primeiro.</p>';
        return;
    }

    // --- LÃ“GICA DE BUSCA REFEITA ---
    const searchPredicate = p => p && (String(p.Num_Pedido).toLowerCase().includes(searchTerm) || String(p.Nome_Cliente).toLowerCase().includes(searchTerm) || String(p.Cidade).toLowerCase().includes(searchTerm) || String(p.CF).toLowerCase().includes(searchTerm));
    const foundInPlanilha = planilhaData.filter(searchPredicate);

    if (foundInPlanilha.length === 0) {
        searchResultDiv.innerHTML = '<div class="alert alert-warning">Nenhum pedido encontrado para o termo buscado.</div>';
        return;
    }

    const resultados = foundInPlanilha.map(pedido => {
        const numPedido = String(pedido.Num_Pedido);
        let local = "NÃ£o processado / Planilha Original";
        let viewId = null, tabId = null, accordionId = null, cardId = null;

        // 1. Verificar em Cargas Ativas (Varejo, Toco, Manuais)
        for (const loadId in activeLoads) { // prettier-ignore
            const load = activeLoads[loadId];
            if (load.pedidos.some(p => String(p.Num_Pedido) === numPedido)) {
                local = `Carga ${load.numero || load.id.split('-')[1]} (${load.vehicleType})`;
                viewId = 'workspace-view';
                cardId = load.id;
                if (['fiorino', 'van', 'tresQuartos'].includes(load.vehicleType)) {
                    tabId = `${load.vehicleType === 'tresQuartos' ? 'tres-quartos' : load.vehicleType}-tab-pane`;
                } else if (load.vehicleType === 'toco') {
                    tabId = 'toco-tab-pane';
                    const cf = load.pedidos[0]?.CF;
                    const index = Object.keys(gruposToco).sort().indexOf(String(cf));
                    if (index !== -1) accordionId = `collapseToco${index}`;
                } else if (load.id.startsWith('venda-antecipada') || load.id.startsWith('especial')) {
                    viewId = 'workspace-view';
                }
                return { pedido, local, viewId, tabId, accordionId, cardId };
            }
        }

        // 2. Verificar em Pedidos DisponÃ­veis (Varejo)
        if (pedidosGeraisAtuais.some(p => String(p.Num_Pedido) === numPedido)) {
            local = `Pedidos DisponÃ­veis (Rota ${pedido.Cod_Rota})`;
            viewId = 'workspace-view';
            tabId = 'disponiveis-tab-pane'; // Aba correta
            accordionId = `collapseGeral-${pedido.Cod_Rota}`; // ID correto e estÃ¡vel do acordeÃ£o
            return { pedido, local, viewId, tabId, accordionId, cardId };
        }

        // 3. Verificar em Sobras
        if (currentLeftoversForPrinting.some(p => String(p.Num_Pedido) === numPedido)) {
            local = 'Sobras Finais';
            viewId = 'workspace-view';
            const activeTabPane = document.querySelector('.workspace-tab-pane.active');
            tabId = activeTabPane ? activeTabPane.id : null;
            cardId = activeTabPane ? `leftovers-card-${activeTabPane.id}` : null;
            return { pedido, local, viewId, tabId, accordionId, cardId };
        }

        // 4. Verificar em outras seÃ§Ãµes
        const otherSectionsMap = {
            'Bloqueado Manualmente': { list: pedidosManualmenteBloqueadosAtuais, viewId: 'pedidos-bloqueados-view', cardId: 'card-bloqueados', accordionId: 'collapseBloqueados' },
            'Pedidos da Rota 1 para AlteraÃ§Ã£o': { list: rota1SemCarga, viewId: 'alteracao-rota-view', cardId: 'resultado-rota1' }, 'Bloqueados Varejo (Regra)': { list: pedidosComCFNumericoIsolado, viewId: 'workspace-view', tabId: 'bloqueados-regra-tab-pane', accordionId: `collapseCF-${pedido.Cod_Rota}` },
            'Outros Pedidos (Moinho)': { list: pedidosMoinho, viewId: 'workspace-view', tabId: 'outros-pedidos-tab-pane', accordionId: 'collapseMoinho' },
            'Outros Pedidos (FuncionÃ¡rios)': { list: pedidosFuncionarios, viewId: 'workspace-view', tabId: 'outros-pedidos-tab-pane', accordionId: 'collapseFuncionarios' },
            'Outros Pedidos (TransferÃªncia)': { list: pedidosTransferencias, viewId: 'workspace-view', tabId: 'outros-pedidos-tab-pane', accordionId: 'collapseTransferencias' },
            'Outros Pedidos (ExportaÃ§Ã£o)': { list: pedidosExportacao, viewId: 'workspace-view', tabId: 'outros-pedidos-tab-pane', accordionId: 'collapseExportacao' },
            'Outros Pedidos (Marca PrÃ³pria)': { list: pedidosMarcaPropria, viewId: 'workspace-view', tabId: 'outros-pedidos-tab-pane', accordionId: 'collapseMarcaPropria' },
        };

        for (const [sectionName, sectionData] of Object.entries(otherSectionsMap)) {
            if (sectionData.list.some(p => String(p.Num_Pedido) === numPedido)) {
                return { pedido, local: sectionName, ...sectionData };
            }
        }

        // 5. Verificar Cargas Fechadas (PR e Resto BR)
        for (const cf in gruposPorCFGlobais) {
            if (gruposPorCFGlobais[cf].pedidos.some(p => String(p.Num_Pedido) === numPedido)) {
                local = `Carga Resto BR (${cf})`;
                viewId = 'workspace-view';
                tabId = 'cargas-fechadas-rest-br-tab-pane';
                const sortedKeys = Object.keys(gruposPorCFGlobais).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
                const index = sortedKeys.indexOf(cf);
                if (index !== -1) accordionId = `collapseCargasFechadasRestBr-${index}`;
                return { pedido, local, viewId, tabId, accordionId, cardId };
            }
        }
        const gruposPR = cargasFechadasPR.reduce((acc, p) => { const key = (String(p.Coluna5 || '').toUpperCase().includes('CONDOR')) ? 'Condor Truck' : `CF: ${p.CF}`; if (!acc[key]) acc[key] = []; acc[key].push(p); return acc; }, {});
        for (const key in gruposPR) {
            if (gruposPR[key].some(p => String(p.Num_Pedido) === numPedido)) {
                local = `Carga Fechada PR (${key})`;
                viewId = 'workspace-view';
                tabId = 'cargas-fechadas-pr-tab-pane';
                const sortedKeys = Object.keys(gruposPR).sort((a, b) => (a === 'Condor Truck') ? -1 : (b === 'Condor Truck') ? 1 : a.localeCompare(b, undefined, { numeric: true }));
                const index = sortedKeys.indexOf(key);
                if (index !== -1) accordionId = `collapseCargasFechadasPR-${index}`;
                return { pedido, local, viewId, tabId, accordionId, cardId };
            }
        }

        // Se nÃ£o encontrou em nenhuma categoria processada, retorna o status padrÃ£o
        return { pedido, local, viewId, tabId, accordionId, cardId };
    });

    if (resultados.length === 0) {
        searchResultDiv.innerHTML = '<div class="alert alert-warning">Nenhum pedido encontrado para o termo buscado.</div>';
    } else {
        let html = `<div class="alert alert-info d-flex justify-content-between align-items-center">
                                <h5 class="mb-0">${resultados.length} resultado(s) encontrado(s):</h5>
                                <button type="button" class="btn-close" aria-label="Fechar Busca" onclick="recolherBusca()"></button>
                            </div>`;
        html += '<ul class="list-group">';
        resultados.forEach((res, index) => {
            const { pedido, local, viewId, tabId, accordionId, cardId } = res;
            const isPriority = pedidosPrioritarios.includes(String(pedido.Num_Pedido));
            const isRecall = pedidosRecall.includes(String(pedido.Num_Pedido));
            const isInLoad = Object.values(activeLoads).some(load => load.pedidos.some(p => p.Num_Pedido === pedido.Num_Pedido));

            const priorityButtonHtml = isPriority
                ? `<button class="btn btn-sm btn-outline-secondary" onclick="despriorizarPedido('${res.pedido.Num_Pedido}')"><i class="bi bi-star-slash-fill me-1"></i>Remover Prioridade</button>`
                : `<button class="btn btn-sm btn-outline-warning" onclick="priorizarPedido('${res.pedido.Num_Pedido}')"><i class="bi bi-star-fill me-1"></i>Priorizar</button>`;

            const recallButtonHtml = isRecall
                ? `<button class="btn btn-sm btn-outline-secondary" onclick="despriorizarRecall('${res.pedido.Num_Pedido}')"><i class="bi bi-arrow-repeat me-1"></i>Remover Recall</button>`
                : `<button class="btn btn-sm btn-outline-info" onclick="priorizarRecall('${res.pedido.Num_Pedido}')"><i class="bi bi-arrow-repeat me-1"></i>Priorizar Recall</button>`;

            let blockInfoHtml = '';
            const blockType = String(pedido['BLOQ.'] || '').trim().toUpperCase();
            if (blockType === 'C') blockInfoHtml = '<span class="badge bg-danger ms-2">Bloqueado: Financeiro</span>';
            else if (blockType === 'V') blockInfoHtml = '<span class="badge bg-danger ms-2">Bloqueado: Comercial</span>';

            const params = `\'${pedido.Num_Pedido}\', \'${viewId}\', ${tabId ? `'${tabId}'` : 'null'}, ${accordionId ? `'${accordionId}'` : 'null'}, ${cardId ? `'${cardId}'` : 'null'}`;
            // A Ã¡rea sÃ³ Ã© clicÃ¡vel se houver um viewId para navegar
            const clickableAreaStyle = viewId ? 'cursor: pointer;' : '';
            const onClickHandler = viewId ? `onclick="highlightPedido(${params})"` : '';

            html += `
                        <li class="list-group-item d-flex justify-content-between align-items-center">
                            <div ${onClickHandler} style="${clickableAreaStyle}" class="flex-grow-1 me-3">
                                <strong>Pedido:</strong> ${pedido.Num_Pedido} 
                                ${isInLoad ? '<span class="badge bg-success ms-2">Em Carga Montada</span>' : ''}
                                ${isPriority ? '<span class="badge bg-warning text-dark ms-2">Prioridade</span>' : ''}
                                ${isRecall ? '<span class="badge bg-info ms-2">Recall</span>' : ''}<br>
                                ${blockInfoHtml}
                                <small class="d-block"><strong>Rota:</strong> ${pedido.Cod_Rota || 'N/A'}</small><br>
                                <small><strong>Cliente:</strong> ${pedido.Nome_Cliente} (${pedido.Cidade})</small><br>
                                <small class="text-muted"><strong>Local:</strong> ${local}</small>
                            </div>
                            <div class="btn-group">
                                ${!isInLoad ? priorityButtonHtml : ''}
                                ${!isInLoad ? recallButtonHtml : ''}
                            </div>
                        </li>`;
        });
        html += '</ul>';
        searchResultDiv.innerHTML = html;
    }
}

// ... (resto do cÃ³digo)



function recolherBusca() {
    document.getElementById('search-result').innerHTML = '';
}

function priorizarPedido(numPedido) {
    numPedido = String(numPedido).trim();
    if (!pedidosPrioritarios.includes(numPedido)) {
        console.log(`Priorizando pedido: ${numPedido}`);
        pedidosPrioritarios.push(numPedido);
        saveStateToLocalStorage();
        atualizarUIAposAcao(`Pedido ${numPedido} priorizado.`);
    }
}

function priorizarRecall(numPedido) {
    numPedido = String(numPedido);
    if (!pedidosRecall.includes(numPedido)) {
        console.log(`Priorizando para Recall: ${numPedido}`);
        pedidosRecall.push(numPedido);
        saveStateToLocalStorage();
        atualizarUIAposAcao(`Pedido ${numPedido} marcado para Recall.`);
    }
}

function despriorizarRecall(numPedido) {
    numPedido = String(numPedido);
    const index = pedidosRecall.indexOf(numPedido);
    if (index > -1) {
        console.log(`Removendo prioridade de Recall: ${numPedido}`);
        pedidosRecall.splice(index, 1);
        saveStateToLocalStorage();
        atualizarUIAposAcao(`MarcaÃ§Ã£o de Recall removida do pedido ${numPedido}.`);
    }
}

function despriorizarPedido(numPedido) {
    numPedido = String(numPedido);
    const index = pedidosPrioritarios.indexOf(numPedido);
    if (index > -1) {
        console.log(`Removendo prioridade do pedido: ${numPedido}`);
        pedidosPrioritarios.splice(index, 1);
        saveStateToLocalStorage();
        atualizarUIAposAcao(`Prioridade removida do pedido ${numPedido}.`);
    }
}

function highlightPedido(numPedido, viewId, tabId, collapseId, cardId = null) {
    // FunÃ§Ã£o interna para executar o scroll e o destaque final
    const executeScrollAndHighlight = () => {
        setTimeout(() => {
            let targetElement = document.getElementById(`pedido-${numPedido}`);

            // Se nÃ£o achou na tabela (tr), tenta achar o card da carga
            if (!targetElement && cardId) {
                targetElement = document.getElementById(cardId);
            }
            // Se nÃ£o achou, tenta achar o acordeÃ£o (caso de carga fechada ou agrupamento)
            if (!targetElement && collapseId) {
                // Tenta achar o botÃ£o do acordeÃ£o ou o container
                targetElement = document.querySelector(`[data-bs-target="#${collapseId}"]`) || document.getElementById(collapseId);
            }

            if (targetElement) {
                // Remove highlights anteriores
                document.querySelectorAll('.search-highlight').forEach(el => el.classList.remove('search-highlight'));

                // Adiciona classes de destaque
                targetElement.classList.add('search-highlight');
                if (targetElement.tagName === 'TR') {
                    const originalClass = targetElement.className;
                    targetElement.classList.add('table-info'); // Destaque extra para tabelas
                    setTimeout(() => targetElement.className = originalClass, 3000); // Remove apÃ³s 3s
                } else {
                    setTimeout(() => targetElement.classList.remove('search-highlight'), 3000);
                }

                // Scroll suave e centralizado
                targetElement.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
            } else {
                console.warn(`Elemento alvo nÃ£o encontrado para destaque: Pedido ${numPedido}, Card ${cardId}, Collapse ${collapseId}`);
            }
        }, 400); // Delay aumentado para garantir renderizaÃ§Ã£o de abas/acordeÃµes
    };

    // 1. Mudar de View (Se necessÃ¡rio)
    if (viewId) {
        const targetViewLink = document.querySelector(`#sidebar-nav a.nav-link[href="#${viewId}"]`) ||
            document.querySelector(`.sidebar-link[href="#${viewId}"]`); // Suporte Ã  sidebar antiga e nova

        if (targetViewLink && !targetViewLink.classList.contains('active')) {
            targetViewLink.click(); // Usa o click nativo para acionar toda a lÃ³gica de view existente
        }
    }

    // 2. Mudar de Aba Interna (Se necessÃ¡rio)
    // Envolvemos em um setTimeout para garantir que a View jÃ¡ trocou
    setTimeout(() => {
        if (tabId) {
            const tabButton = document.querySelector(`button[data-bs-target="#${tabId}"]`) ||
                document.querySelector(`a[data-bs-target="#${tabId}"]`);

            if (tabButton) {
                const tabInstance = bootstrap.Tab.getOrCreateInstance(tabButton);
                tabInstance.show();

                // 3. Expandir AcordeÃ£o (Se necessÃ¡rio) - Dentro do contexto da aba
                if (collapseId) {
                    // Espera a aba terminar de mostrar
                    setTimeout(() => {
                        const collapseElement = document.getElementById(collapseId);
                        if (collapseElement) {
                            const collapseInstance = bootstrap.Collapse.getOrCreateInstance(collapseElement);
                            if (!collapseElement.classList.contains('show')) {
                                collapseInstance.show();
                                // Aguarda a animaÃ§Ã£o do collapse (padrÃ£o Bootstrap 350ms)
                                setTimeout(executeScrollAndHighlight, 350);
                            } else {
                                executeScrollAndHighlight();
                            }
                        } else {
                            executeScrollAndHighlight();
                        }
                    }, 150);
                } else {
                    executeScrollAndHighlight();
                }
            } else {
                // Se nÃ£o tem botÃ£o de aba (ex: view Ãºnica), segue para acordeÃ£o direto
                if (collapseId) {
                    const collapseElement = document.getElementById(collapseId);
                    if (collapseElement) {
                        const collapseInstance = bootstrap.Collapse.getOrCreateInstance(collapseElement);
                        if (!collapseElement.classList.contains('show')) {
                            collapseInstance.show();
                            setTimeout(executeScrollAndHighlight, 350);
                        } else {
                            executeScrollAndHighlight();
                        }
                    } else {
                        executeScrollAndHighlight();
                    }
                } else {
                    executeScrollAndHighlight();
                }
            }
        } else {
            // Sem aba especÃ­fica, verifica apenas acordeÃ£o ou vai direto
            if (collapseId) {
                const collapseElement = document.getElementById(collapseId);
                if (collapseElement) {
                    const collapseInstance = bootstrap.Collapse.getOrCreateInstance(collapseElement);
                    if (!collapseElement.classList.contains('show')) {
                        collapseInstance.show();
                        setTimeout(executeScrollAndHighlight, 350);
                    } else {
                        executeScrollAndHighlight();
                    }
                } else {
                    executeScrollAndHighlight();
                }
            } else {
                executeScrollAndHighlight();
            }
        }
    }, 100);
}

document.head.insertAdjacentHTML('beforeend', `<style>
            .search-highlight { 
                box-shadow: 0 0 12px 4px var(--dark-accent) !important;
                border-color: var(--dark-accent) !important;
            }
            @keyframes highlight-animation { 0% { box-shadow: 0 0 0 0px var(--dark-accent-glow); } 50% { box-shadow: 0 0 12px 4px var(--dark-accent); } 100% { box-shadow: 0 0 0 0px var(--dark-accent-glow); } }
        </style>`);

function atualizarListaBloqueados() {
    const divLista = document.getElementById('lista-pedidos-bloqueados');
    divLista.innerHTML = '';
    if (pedidosBloqueados.size === 0) {
        divLista.innerHTML = '<div class="empty-state"><i class="bi bi-shield-slash"></i><p>Nenhum pedido bloqueado.</p></div>';
        return;
    }

    const list = document.createElement('ul');
    list.className = 'list-group list-group-flush';
    pedidosBloqueados.forEach(numPedido => {
        const item = document.createElement('li');
        item.className = 'list-group-item d-flex justify-content-between align-items-center py-1 bg-transparent';
        item.innerHTML = `<span>${numPedido}</span> <button class="btn btn-sm btn-outline-secondary" onclick="desbloquearPedido('${numPedido}')">Desbloquear</button>`;
        list.appendChild(item);
    });
    divLista.appendChild(list);
}

function bloquearPedido(numPedido) {
    let pedidoParaBloquear = numPedido;
    if (!pedidoParaBloquear) { // Se nenhum pedido for passado, pega do input (comportamento antigo)
        const input = document.getElementById('bloquearPedidoInput');
        pedidoParaBloquear = input.value.trim();
        input.value = ''; // Limpa o input
    }

    if (pedidoParaBloquear) {
        pedidosBloqueados.add(String(pedidoParaBloquear));

        // NOVO: Move o pedido da sua lista atual para a lista de bloqueados manualmente.
        // Isso garante que ele suma da lista de disponÃ­veis/cargas e apareÃ§a na tela de anÃ¡lise.
        let pedidoMovido = false;
        let affectedLoadId = null; // NOVO: Rastreia a carga afetada

        // FunÃ§Ã£o auxiliar para encontrar e mover o pedido de uma lista
        const moverDeLista = (lista) => {
            const index = lista.findIndex(p => String(p.Num_Pedido) === pedidoParaBloquear);
            if (index > -1) {
                const [pedido] = lista.splice(index, 1);
                pedidosManualmenteBloqueadosAtuais.push(pedido);
                pedidoMovido = true;
            }
        };

        // Procura em todas as listas possÃ­veis
        moverDeLista(pedidosGeraisAtuais);

        if (!pedidoMovido) {
            moverDeLista(pedidosComCFNumericoIsolado);
        }
        if (!pedidoMovido) {
            moverDeLista(rota1SemCarga);
        }
        // Procura dentro das cargas ativas
        if (!pedidoMovido) {
            for (const loadId in activeLoads) {
                const load = activeLoads[loadId];
                const indexCarga = load.pedidos.findIndex(p => String(p.Num_Pedido) === pedidoParaBloquear);
                if (indexCarga > -1) {
                    const [pedido] = load.pedidos.splice(indexCarga, 1);
                    load.totalKg -= pedido.Quilos_Saldo;
                    load.totalCubagem -= pedido.Cubagem;
                    pedidosManualmenteBloqueadosAtuais.push(pedido);
                    pedidoMovido = true;
                    affectedLoadId = loadId; // MODIFICADO: Captura o ID da carga afetada
                    if (load.pedidos.length === 0) {
                        delete activeLoads[loadId];
                    }
                    break; // Sai do loop de cargas
                }
            }
        }

        // Se o pedido nÃ£o foi encontrado em nenhuma lista, mas existe na planilha original,
        // adiciona-o Ã  lista de bloqueados (caso de um pedido que ainda nÃ£o foi processado/exibido).
        if (!pedidoMovido) {
            const pedidoOriginal = planilhaData.find(p => String(p.Num_Pedido) === pedidoParaBloquear);
            if (pedidoOriginal) {
                pedidosManualmenteBloqueadosAtuais.push(pedidoOriginal);
            }
        }

        // MODIFICADO: Chama a funÃ§Ã£o de atualizaÃ§Ã£o com o ID da carga afetada
        atualizarUIAposAcao(`Pedido ${pedidoParaBloquear} bloqueado.`, affectedLoadId);
    }
}

function desbloquearPedido(numPedido) {
    pedidosBloqueados.delete(numPedido);

    // NOVO: Move o pedido da lista de bloqueados de volta para a lista de disponÃ­veis.
    const indexBloqueado = pedidosManualmenteBloqueadosAtuais.findIndex(p => String(p.Num_Pedido) === numPedido);
    if (indexBloqueado > -1) {
        const pedidoDesbloqueado = pedidosManualmenteBloqueadosAtuais.splice(indexBloqueado, 1)[0];
        // Adiciona de volta Ã  lista principal de pedidos de varejo disponÃ­veis.
        // O sistema o colocarÃ¡ no grupo de rota correto na prÃ³xima renderizaÃ§Ã£o.
        if (pedidoDesbloqueado) {
            pedidosGeraisAtuais.push(pedidoDesbloqueado);
        }
    }

    saveStateToLocalStorage();
    atualizarUIAposAcao(`Pedido ${numPedido} desbloqueado.`);
}

function atualizarListaSemCorte() {
    const divLista = document.getElementById('lista-pedidos-sem-corte');
    divLista.innerHTML = '';
    if (pedidosSemCorte.size === 0) {
        divLista.innerHTML = '<div class="empty-state"><i class="bi bi-scissors"></i><p>Nenhum pedido marcado.</p></div>';
        return;
    }
    const list = document.createElement('ul');
    list.className = 'list-group list-group-flush';
    pedidosSemCorte.forEach(numPedido => {
        const item = document.createElement('li');
        item.className = 'list-group-item d-flex justify-content-between align-items-center py-1 bg-transparent';
        item.innerHTML = `<span>${numPedido}</span> <button class="btn btn-sm btn-outline-secondary" onclick="removerMarcacaoSemCorte('${numPedido}')">Remover</button>`;
        list.appendChild(item);
    });
    divLista.appendChild(list);
}

function marcarPedidosSemCorte() {
    const input = document.getElementById('semCorteInput');
    const numeros = input.value.split('\n').map(n => n.trim()).filter(Boolean);
    numeros.forEach(num => pedidosSemCorte.add(num));
    saveStateToLocalStorage();
    input.value = '';
    atualizarUIAposAcao(`${numeros.length} pedido(s) marcado(s) como 'Sem Corte'.`);
}

function removerMarcacaoSemCorte(numPedido) {
    pedidosSemCorte.delete(numPedido);
    saveStateToLocalStorage();
    atualizarUIAposAcao(`MarcaÃ§Ã£o 'Sem Corte' removida do pedido ${numPedido}.`);
}

/**
 * NOVO: Atualiza a UI de forma inteligente apÃ³s uma aÃ§Ã£o (bloquear, priorizar, etc.)
 * sem reprocessar tudo. Apenas redesenha as seÃ§Ãµes afetadas.
 */
function atualizarUIAposAcao(mensagemToast, affectedLoadId = null) {
    // Se nÃ£o houver dados carregados, nÃ£o faz nada.
    if (planilhaData.length === 0) {
        // Apenas atualiza as listas nos modais, se aplicÃ¡vel
        atualizarListaBloqueados();
        atualizarListaSemCorte();
        return;
    }

    // 1. Atualiza a lista de pedidos disponÃ­veis (de onde o pedido bloqueado pode ter vindo)
    // Isso tambÃ©m redesenha os botÃµes de rota, o que Ã© aceitÃ¡vel.
    const gruposGerais = pedidosGeraisAtuais.reduce((acc, p) => { const rota = p.Cod_Rota; if (!acc[rota]) { acc[rota] = { pedidos: [], totalKg: 0 }; } acc[rota].pedidos.push(p); acc[rota].totalKg += p.Quilos_Saldo; return acc; }, {});
    displayGerais(document.getElementById('resultado-geral'), gruposGerais);

    // 2. Atualiza as listas de pedidos bloqueados (na view de anÃ¡lise e no modal)
    displayPedidosBloqueados(document.getElementById('resultado-bloqueados'), pedidosManualmenteBloqueadosAtuais);
    atualizarListaBloqueados();

    // 3. Se uma carga foi afetada, renderiza novamente apenas aquele card
    if (affectedLoadId) {
        const load = activeLoads[affectedLoadId];
        const cardElement = document.getElementById(affectedLoadId);
        if (load && cardElement) { // A carga ainda existe, renderiza novamente
            const vehicleInfo = {
                fiorino: { name: 'Fiorino', colorClass: 'bg-success', textColor: 'text-white', icon: 'bi-box-seam-fill' },
                van: { name: 'Van', colorClass: 'bg-primary', textColor: 'text-white', icon: 'bi-truck-front-fill' },
                tresQuartos: { name: '3/4', colorClass: 'bg-warning', textColor: 'text-dark', icon: 'bi-truck-flatbed' },
                toco: { name: 'Toco', colorClass: 'bg-secondary', textColor: 'text-white', icon: 'bi-inboxes-fill' }
            };
            const vInfo = vehicleInfo[load.vehicleType];
            if (vInfo) {
                const newCardHTML = renderLoadCard(load, load.vehicleType, vInfo);
                cardElement.outerHTML = newCardHTML;
            }
        } else if (cardElement) { // A carga foi deletada (ficou vazia), remove o card
            cardElement.remove();
        }
    }

    // 4. Atualiza os KPIs e o grÃ¡fico
    updateAndRenderKPIs();
    updateAndRenderChart();

    // 5. Salva o estado atual
    saveStateToLocalStorage();

    // 6. Mostra a notificaÃ§Ã£o para o usuÃ¡rio
    showToast(mensagemToast, 'info');
}

function resetarEstadoGlobal() {
    pedidosGeraisAtuais = [];
    gruposToco = {};
    gruposPorCFGlobais = {};
    pedidosComCFNumericoIsolado = [];
    rota1SemCarga = [];
    pedidosFuncionarios = [];
    pedidosCarretaSemCF = [];
    pedidosTransferencias = [];
    pedidosExportacao = [];
    cargasFechadasPR = [];
    pedidosMoinho = [];
    pedidosMarcaPropria = [];
    pedidosManualmenteBloqueadosAtuais = [];
    tocoPedidoIds.clear();
    currentLeftoversForPrinting = [];
    activeLoads = {};
    kpiData = {};
    processedRoutes.clear();
}

function processar() {
    statusDiv.innerHTML = '<div class="d-flex align-items-center justify-content-center"><div class="spinner-border spinner-border-sm text-primary me-2" role="status"></div><span class="text-primary">Processando...</span></div>';
    processarBtn.disabled = true;

    setTimeout(() => {
        const resultadoGeralDiv = document.getElementById('resultado-geral');
        const resultadoTocoDiv = document.getElementById('resultado-toco');
        const resultadoCfNumericoDiv = document.getElementById('resultado-cf-numerico');
        const resultadoRota1Div = document.getElementById('resultado-rota1');
        const resultadoBloqueadosDiv = document.getElementById('resultado-bloqueados');
        const resultadoFuncionariosDiv = document.getElementById('resultado-funcionarios');
        const resultadoTransferenciasDiv = document.getElementById('resultado-transferencias');
        const resultadoExportacaoDiv = document.getElementById('resultado-exportacao');
        const resultadoCargasFechadasPRDiv = document.getElementById('resultado-cargas-fechadas-pr');
        const resultadoMoinhoDiv = document.getElementById('resultado-moinho');
        const resultadoMarcaPropriaDiv = document.getElementById('resultado-marca-propria');
        const resultadoCargasFechadasRestBrDiv = document.getElementById('resultado-cargas-fechadas-rest-br');

        try {
            if (planilhaData.length === 0) { throw new Error("Nenhum dado de planilha carregado."); }

            resetarEstadoGlobal();

            // VerificaÃ§Ã£o de seguranÃ§a para elementos de filtro de rota
            const rotaInicioSelect = document.getElementById('rotaInicioSelect');
            const rotaFimSelect = document.getElementById('rotaFimSelect');
            const rotaInicio = rotaInicioSelect ? rotaInicioSelect.value : '';
            const rotaFim = rotaFimSelect ? rotaFimSelect.value : '';
            let dadosParaProcessar = [...planilhaData];

            if (rotaInicio && rotaFim) {
                dadosParaProcessar = planilhaData.filter(p => {
                    const rotaPedido = String(p.Cod_Rota || ''); // prettier-ignore
                    return rotaPedido.localeCompare(rotaInicio, undefined, { numeric: true }) >= 0 && // prettier-ignore
                        rotaPedido.localeCompare(rotaFim, undefined, { numeric: true }) <= 0; // prettier-ignore
                });
                statusDiv.innerHTML = `<p class="text-info">Processando ${dadosParaProcessar.length} pedidos entre as rotas ${rotaInicio} e ${rotaFim}...</p>`;
            }

            [
                'resultado-fiorino-geral', 'resultado-van-geral', 'resultado-34-geral', 'resultado-geral',
                'resultado-toco', 'resultado-cf-accordion-container', 'resultado-cf-numerico',
                'resultado-rota1', 'resultado-bloqueados', 'resultado-cargas-fechadas-pr', 'resultado-moinho', 'resultado-marca-propria',
                'resultado-cargas-fechadas-rest-br', 'resultado-funcionarios', 'resultado-transferencias', 'resultado-exportacao'
            ].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.innerHTML = '';
            });

            const pedidosExcluidos = new Set();
            dadosParaProcessar.forEach(p => {
                const coluna5 = String(p.Coluna5 || '').toUpperCase();
                if (coluna5.includes('TBL FUNCIONARIO')) {
                    pedidosFuncionarios.push(p);
                    pedidosExcluidos.add(p.Num_Pedido);
                } else if (coluna5.includes('TABELA TRANSFER') || coluna5.includes('TRANSF. TODESCH') || coluna5.includes('INSTITUCIONAL')) {
                    pedidosTransferencias.push(p);
                    pedidosExcluidos.add(p.Num_Pedido);
                } else if (coluna5.includes('TBL EXPORTACAO')) {
                    pedidosExportacao.push(p);
                    pedidosExcluidos.add(p.Num_Pedido);
                } else if (coluna5.includes('MOINHO')) {
                    pedidosMoinho.push(p);
                    pedidosExcluidos.add(p.Num_Pedido);
                } else if (coluna5.includes('MARCA PROPRIA')) {
                    pedidosMarcaPropria.push(p);
                    pedidosExcluidos.add(p.Num_Pedido);
                }
            });

            const hasMoinho = displayPedidosMoinho(resultadoMoinhoDiv, pedidosMoinho); // prettier-ignore
            const hasFuncionarios = displayPedidosFuncionarios(resultadoFuncionariosDiv, pedidosFuncionarios); // prettier-ignore
            const hasTransferencias = displayPedidosTransferencias(resultadoTransferenciasDiv, pedidosTransferencias); // prettier-ignore
            const hasExportacao = displayPedidosExportacao(resultadoExportacaoDiv, pedidosExportacao); // prettier-ignore
            const hasMarcaPropria = displayPedidosMarcaPropria(resultadoMarcaPropriaDiv, pedidosMarcaPropria); // prettier-ignore

            // Se nenhuma das categorias especiais tiver pedidos, mostra um estado vazio unificado.
            if (!hasMoinho && !hasFuncionarios && !hasTransferencias && !hasExportacao && !hasMarcaPropria) {
                const outrosPedidosTab = document.getElementById('outros-pedidos-tab-pane');
                if (outrosPedidosTab) {
                    outrosPedidosTab.innerHTML = '<div class="empty-state"><i class="bi bi-collection"></i><p>Nenhum pedido para as categorias especiais foi encontrado.</p></div>';
                }
            }


            let dadosFiltrados = dadosParaProcessar.filter(p => !pedidosExcluidos.has(p.Num_Pedido));

            let pedidosAindaNaoProcessados = [];
            dadosFiltrados.filter(p => p.Num_Pedido).forEach(p => {
                if (pedidosBloqueados.has(String(p.Num_Pedido))) {
                    pedidosManualmenteBloqueadosAtuais.push(p);
                } else {
                    pedidosAindaNaoProcessados.push(p);
                }
            });

            pedidosAindaNaoProcessados = pedidosAindaNaoProcessados.filter(p =>
                !pedidosEspeciaisProcessados.has(String(p.Num_Pedido)) &&
                !pedidosVendaAntecipadaProcessados.has(String(p.Num_Pedido))
            );
            pedidosAindaNaoProcessados = pedidosAindaNaoProcessados.filter(p => !pedidosEspeciaisProcessados.has(String(p.Num_Pedido)) && !pedidosVendaAntecipadaProcessados.has(String(p.Num_Pedido)));

            rota1SemCarga = pedidosAindaNaoProcessados.filter(p => {
                const codRota = String(p.Cod_Rota || '').trim();
                const cfValue = p.CF;
                const coluna5Value = String(p.Coluna5 || '').trim().toUpperCase();

                if (codRota !== '1') { return false; }
                if (isNumeric(cfValue)) { return false; }

                const filtroDescricoes = ['TBL 08', 'TBL TODESCHINI', 'PROMO BOLINHO'];
                return filtroDescricoes.some(termo => coluna5Value.includes(termo));
            });

            const rota1PedidoIds = new Set(rota1SemCarga.map(p => p.Num_Pedido));
            displayRota1(resultadoRota1Div, rota1SemCarga);

            // Remove os pedidos da Rota 1 da lista principal
            pedidosAindaNaoProcessados = pedidosAindaNaoProcessados.filter(p => !rota1PedidoIds.has(p.Num_Pedido));

            let pedidosParaProcessamentoGeral = pedidosAindaNaoProcessados;

            // CORRIGIDO: Separa Cargas Toco por peso (>= 4500 kg por cliente) APENAS de pedidos de VAREJO.
            // Um pedido de varejo Ã© aquele que NÃƒO tem um CF numÃ©rico.
            const pedidosDeVarejo = pedidosParaProcessamentoGeral.filter(p => !isNumeric(p.CF));
            const outrosPedidos = pedidosParaProcessamentoGeral.filter(p => isNumeric(p.CF));

            const gruposDeClientesVarejo = pedidosDeVarejo.reduce((acc, p) => {
                const clienteId = normalizeClientId(p.Cliente);
                if (!acc[clienteId]) {
                    // Inicializa o grupo para este cliente
                    acc[clienteId] = { pedidos: [], totalKg: 0, totalCubagem: 0 };
                }
                acc[clienteId].pedidos.push(p);
                acc[clienteId].totalKg += p.Quilos_Saldo;
                acc[clienteId].totalCubagem += p.Cubagem;
                return acc;
            }, {});

            gruposToco = {};
            tocoPedidoIds = new Set();

            Object.entries(gruposDeClientesVarejo).forEach(([clienteId, grupo]) => {
                // CONDIÃ‡ÃƒO ATUALIZADA: Verifica se o grupo de cliente tem o peso necessÃ¡rio E se NENHUM de seus pedidos
                // contÃ©m as palavras-chave de exclusÃ£o na Coluna5.
                const deveSerExcluido = grupo.pedidos.some(p => {
                    const coluna5Upper = String(p.Coluna5 || '').toUpperCase();
                    return coluna5Upper.includes('TBL ESP CARRETA') || coluna5Upper.includes('TRUCK') || coluna5Upper.includes('CARRETA');
                });

                if (grupo.totalKg >= 4500 && !deveSerExcluido) {
                    const cf = grupo.pedidos[0]?.CF || `CLI-${clienteId}`; // Usa CF ou um ID de cliente
                    gruposToco[cf] = grupo;
                    grupo.pedidos.forEach(p => tocoPedidoIds.add(p.Num_Pedido));
                }
            });

            // Remonta a lista de processamento geral com os pedidos que nÃ£o viraram Toco por peso.
            pedidosParaProcessamentoGeral = [...outrosPedidos, ...pedidosDeVarejo.filter(p => !tocoPedidoIds.has(p.Num_Pedido))];

            // Adiciona os grupos toco antigos (baseados em flag) se existirem
            const pedidosTocoPorFlag = pedidosParaProcessamentoGeral.filter(p => (p.Coluna4 && String(p.Coluna4).toUpperCase().includes('TOCO')) || (p.Coluna5 && String(p.Coluna5).toUpperCase().includes('TOCO')));
            const pedidosTocoPorFlagIds = new Set(pedidosTocoPorFlag.map(p => String(p.Num_Pedido)));

            gruposToco = pedidosTocoPorFlag.reduce((acc, p) => {
                const cf = p.CF || `FLAG-${p.Num_Pedido}`;
                if (!acc[cf]) { acc[cf] = { pedidos: [], totalKg: 0, totalCubagem: 0 }; }
                acc[cf].pedidos.push(p);
                acc[cf].totalKg += p.Quilos_Saldo;
                acc[cf].totalCubagem += p.Cubagem;
                return acc;
            }, gruposToco); // Inicia o reduce com os gruposToco jÃ¡ existentes (do peso >= 4500kg)

            pedidosParaProcessamentoGeral = pedidosParaProcessamentoGeral.filter(p => !pedidosTocoPorFlagIds.has(String(p.Num_Pedido)));
            displayToco(resultadoTocoDiv, gruposToco);

            // Identifica clientes com qualquer tipo de bloqueio na planilha
            const clientesComBloqueio = new Set();
            pedidosParaProcessamentoGeral.forEach(p => {
                if (String(p['BLOQ.']).trim()) {
                    clientesComBloqueio.add(normalizeClientId(p.Cliente));
                }
            });

            // Separa Cargas Fechadas PR (Condor e CFs numÃ©ricos do PR)
            cargasFechadasPR = pedidosParaProcessamentoGeral.filter(p => {
                const coluna5 = String(p.Coluna5 || '').toUpperCase();
                const isCondor = coluna5.includes('CONDOR (TRUCK)') || coluna5.includes('CONDOR TOD TRUC');
                const isPR = String(p.UF).trim().toUpperCase() === 'PR';
                return isCondor || (isPR && isNumeric(p.CF));
            });
            const cargasFechadasPRIds = new Set(cargasFechadasPR.map(p => p.Num_Pedido));
            pedidosParaProcessamentoGeral = pedidosParaProcessamentoGeral.filter(p => !cargasFechadasPRIds.has(p.Num_Pedido));
            displayCargasFechadasPR(resultadoCargasFechadasPRDiv, cargasFechadasPR);

            // Separa Cargas Fechadas (Resto do Brasil) e Pedidos de Varejo
            let pedidosParaProcessamentoVarejo = [];
            gruposPorCFGlobais = {};
            pedidosComCFNumericoIsolado = [];

            // Adiciona os pedidos TBL ESPECIAL SEM CF ao grupo de cargas fechadas globais
            pedidosCarretaSemCF = pedidosParaProcessamentoGeral.filter(p => {
                const coluna5Upper = String(p.Coluna5 || '').toUpperCase();
                return (coluna5Upper.includes('TBL ESPECIAL') || coluna5Upper.includes('TBL ESP CARRETA')) && !isNumeric(p.CF);
            });
            const pedidosCarretaSemCFIds = new Set(pedidosCarretaSemCF.map(p => p.Num_Pedido));
            pedidosParaProcessamentoGeral = pedidosParaProcessamentoGeral.filter(p => !pedidosCarretaSemCFIds.has(p.Num_Pedido));


            pedidosParaProcessamentoGeral.forEach(p => {
                if (isNumeric(p.CF)) { // CF numÃ©rico (fora do PR) -> Carga Fechada Resto BR
                    const cf = String(p.CF).trim();
                    if (!gruposPorCFGlobais[cf]) gruposPorCFGlobais[cf] = { pedidos: [], totalKg: 0, totalCubagem: 0 };
                    gruposPorCFGlobais[cf].pedidos.push(p);
                    gruposPorCFGlobais[cf].totalKg += p.Quilos_Saldo;
                    gruposPorCFGlobais[cf].totalCubagem += p.Cubagem;
                } else {
                    if (clientesComBloqueio.has(normalizeClientId(p.Cliente))) { // Cliente com bloqueio -> Bloqueados por Regra
                        pedidosComCFNumericoIsolado.push(p);
                    } else { // O que sobra Ã© Varejo
                        pedidosParaProcessamentoVarejo.push(p);
                    }
                }
            });

            displayPedidosCFNumerico(resultadoCfNumericoDiv, pedidosComCFNumericoIsolado);
            displayCargasFechadasRestBrasil(resultadoCargasFechadasRestBrDiv, gruposPorCFGlobais, pedidosCarretaSemCF);

            pedidosGeraisAtuais = [...pedidosParaProcessamentoVarejo];
            renderAllUI(); // NOVO: Chama a funÃ§Ã£o de renderizaÃ§Ã£o centralizada

            statusDiv.innerHTML = `<p class="text-success">Processamento concluÃ­do!</p>`;
        } catch (error) {
            // Garante que a lista de bloqueados seja exibida mesmo em caso de erro parcial
            const resultadoBloqueadosDiv = document.getElementById('resultado-bloqueados');
            displayPedidosBloqueados(resultadoBloqueadosDiv, pedidosManualmenteBloqueadosAtuais);
            statusDiv.innerHTML = `<p class="text-danger"><strong>Ocorreu um erro:</strong></p><pre>${error.stack}</pre>`;
            console.error(error);
        } finally {
            processarBtn.disabled = false;
        }
    }, 50);
}

/**
 * NOVO: Renderiza os cards para todas as cargas ativas (Fiorino, Van, 3/4, Manuais).
 * Esta funÃ§Ã£o Ã© crucial para manter a UI sincronizada apÃ³s operaÃ§Ãµes de arrastar e soltar.
 */
function renderActiveLoadCards() {
    const vehicleInfo = {
        fiorino: { name: 'Fiorino', colorClass: 'bg-success', textColor: 'text-white', icon: 'bi-box-seam-fill' },
        van: { name: 'Van', colorClass: 'bg-primary', textColor: 'text-white', icon: 'bi-truck-front-fill' },
        tresQuartos: { name: '3/4', colorClass: 'bg-warning', textColor: 'text-dark', icon: 'bi-truck-flatbed' }
    };

    // Limpa os containers de resultado antes de redesenhar para evitar duplicatas.
    document.getElementById('resultado-fiorino-geral').innerHTML = '';
    document.getElementById('resultado-van-geral').innerHTML = '';
    document.getElementById('resultado-34-geral').innerHTML = '';

    for (const loadId in activeLoads) {
        const load = activeLoads[loadId];
        // Ignora cargas 'Toco', pois sÃ£o tratadas por displayToco()
        if (load.vehicleType === 'toco' || load.id.startsWith('roteiro-')) continue;

        const vInfo = vehicleInfo[load.vehicleType];
        if (vInfo) {
            const cardHtml = renderLoadCard(load, load.vehicleType, vInfo);
            let containerId;
            if (load.vehicleType === 'fiorino') containerId = 'resultado-fiorino-geral';
            else if (load.vehicleType === 'van') containerId = 'resultado-van-geral';
            else if (load.vehicleType === 'tresQuartos') containerId = 'resultado-34-geral';

            const container = document.getElementById(containerId);
            if (container) {
                container.insertAdjacentHTML('beforeend', cardHtml);
            }
        }
    }
}

function renderRoteiroLoads() {
    const vehicleInfo = {
        fiorino: { name: 'Fiorino', colorClass: 'bg-success', textColor: 'text-white', icon: 'bi-box-seam-fill' },
        van: { name: 'Van', colorClass: 'bg-primary', textColor: 'text-white', icon: 'bi-truck-front-fill' },
        tresQuartos: { name: '3/4', colorClass: 'bg-warning', textColor: 'text-dark', icon: 'bi-truck-flatbed' },
        toco: { name: 'Toco', colorClass: 'bg-secondary', textColor: 'text-white', icon: 'bi-inboxes-fill' }
    };

    const container = document.getElementById('resultado-roteirizados');
    if (!container) return;
    container.innerHTML = '';

    const roteiroLoads = Object.values(activeLoads).filter(l => l.id.startsWith('roteiro-'));
    if (roteiroLoads.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="bi bi-map"></i><p>Nenhuma carga roteirizada por lista.</p></div>';
        return;
    }

    roteiroLoads.forEach(load => {
        const vInfo = vehicleInfo[load.vehicleType] || vehicleInfo['van'];
        container.insertAdjacentHTML('beforeend', renderLoadCard(load, load.vehicleType, vInfo));
    });
}

/**
 * NOVO: FunÃ§Ã£o central para renderizar toda a interface do usuÃ¡rio.
 * Garante que todas as partes da tela estejam sempre sincronizadas com o estado atual dos dados.
 * Esta Ã© a "fonte Ãºnica da verdade" para a renderizaÃ§Ã£o, eliminando bugs de inconsistÃªncia.
 */
function renderAllUI() {
    console.log("Central UI Render Triggered: Redesenhando a interface...");

    // 1. Renderiza a lista de Pedidos DisponÃ­veis e os botÃµes de rota
    const gruposGerais = pedidosGeraisAtuais.reduce((acc, p) => { const rota = p.Cod_Rota; if (!acc[rota]) { acc[rota] = { pedidos: [], totalKg: 0 }; } acc[rota].pedidos.push(p); acc[rota].totalKg += p.Quilos_Saldo; return acc; }, {});
    displayGerais(document.getElementById('resultado-geral'), gruposGerais);

    renderActiveLoadCards(); // NOVO: Renderiza os cards de cargas ativas (Fiorino, Van, 3/4)
    renderRoteiroLoads(); // Renderiza cargas da aba Roteirizados
    // 2. Renderiza as outras seÃ§Ãµes da Mesa de Trabalho
    displayToco(document.getElementById('resultado-toco'), gruposToco);
    displayCargasFechadasPR(document.getElementById('resultado-cargas-fechadas-pr'), cargasFechadasPR);
    displayCargasFechadasRestBrasil(document.getElementById('resultado-cargas-fechadas-rest-br'), gruposPorCFGlobais, pedidosCarretaSemCF);

    // 3. Renderiza as seÃ§Ãµes de AnÃ¡lise
    displayPedidosBloqueados(document.getElementById('resultado-bloqueados'), pedidosManualmenteBloqueadosAtuais);
    displayRota1(document.getElementById('resultado-rota1'), rota1SemCarga);
    displayPedidosCFNumerico(document.getElementById('resultado-cf-numerico'), pedidosComCFNumericoIsolado);

    // 4. Atualiza os KPIs e o GrÃ¡fico no Dashboard de Resumo
    const hasData = planilhaData && planilhaData.length > 0;
    if (!hasData) {
        return; // NÃ£o renderiza KPIs se nÃ£o houver dados
    }

    updateAndRenderKPIs();
    updateAndRenderChart();
    updateTabCounts(); // Atualiza os contadores das abas

    // 5. Salva o estado consistente no Local Storage
    saveStateToLocalStorage();
}

function updateTabCounts() {
    // Calcula os totais para cada aba
    const counts = {
        fiorino: Object.values(activeLoads).filter(l => l.vehicleType === 'fiorino' && !l.id.startsWith('roteiro-')).length,
        van: Object.values(activeLoads).filter(l => l.vehicleType === 'van' && !l.id.startsWith('roteiro-')).length,
        tresQuartos: Object.values(activeLoads).filter(l => l.vehicleType === 'tresQuartos' && !l.id.startsWith('roteiro-')).length,
        toco: Object.keys(gruposToco).length,
        pr: new Set(cargasFechadasPR.map(p => {
            const col5 = String(p.Coluna5 || '').toUpperCase();
            return (col5.includes('CONDOR') ? 'CONDOR' : p.CF);
        })).size,
        br: Object.keys(gruposPorCFGlobais).length,
        roteirizados: Object.values(activeLoads).filter(l => l.id.startsWith('roteiro-')).length,
        outros: pedidosMoinho.length + pedidosFuncionarios.length + pedidosTransferencias.length + pedidosExportacao.length + pedidosMarcaPropria.length
    };

    // Atualiza os badges na interface
    const updateBadge = (id, count) => {
        const badge = document.getElementById(id);
        if (badge) {
            badge.textContent = count;
            if (count > 0) badge.classList.remove('d-none');
            else badge.classList.add('d-none');
        }
    };

    updateBadge('badge-fiorino', counts.fiorino);
    updateBadge('badge-van', counts.van);
    updateBadge('badge-tres-quartos', counts.tresQuartos);
    updateBadge('badge-toco', counts.toco);
    updateBadge('badge-pr', counts.pr);
    updateBadge('badge-br', counts.br);
    updateBadge('badge-roteirizados', counts.roteirizados);
    updateBadge('badge-outros', counts.outros);
}

function navigateToSection(viewId, tabId, elementId) {
    // 1. Navegar para a View principal
    const targetLink = document.querySelector(`#sidebar-nav a.nav-link[href="#${viewId}"]`);
    if (targetLink) targetLink.click();

    // 2. Navegar para a aba interna (se houver)
    if (tabId) {
        setTimeout(() => {
            const tabEl = document.querySelector(`button[data-bs-target="#${tabId}"]`);
            if (tabEl) {
                const tabInstance = bootstrap.Tab.getOrCreateInstance(tabEl);
                tabInstance.show();
            }
        }, 100);
    }

    // 3. Rolar para o elemento especÃ­fico (se houver)
    if (elementId) {
        setTimeout(() => {
            const element = document.getElementById(elementId);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                element.classList.add('highlight-change-animation');
                setTimeout(() => element.classList.remove('highlight-change-animation'), 2000);
            }
        }, 300);
    }
}

function updateAndRenderKPIs() {
    // 1. Calcula os pedidos que precisam ser predatados (atrasados e sem bloqueio restritivo)
    const pedidosToco = Object.values(gruposToco).flatMap(g => g.pedidos);
    const todosPedidosParaAnalise = [...pedidosGeraisAtuais, ...pedidosComCFNumericoIsolado, ...pedidosManualmenteBloqueadosAtuais, ...rota1SemCarga, ...pedidosToco];
    const pedidosAPredatar = todosPedidosParaAnalise.filter(p => {
        const bloqueio = String(p['BLOQ.'] || '').trim().toUpperCase(); return isOverdue(p.Predat) && (bloqueio === '' || bloqueio === 'C');
    });

    // 2. Separa os grupos de Toco em disponÃ­veis e bloqueados
    const { pesoTocoDisponivel, pedidosTocoDisponiveis, pesoTocoBloqueado, pedidosTocoBloqueados } = Object.values(gruposToco).reduce((acc, grupo) => { const isGrupoBloqueado = grupo.pedidos.some(p => isPedidoBloqueado(p)); if (isGrupoBloqueado) { acc.pesoTocoBloqueado += grupo.totalKg; acc.pedidosTocoBloqueados += grupo.pedidos.length; } else { acc.pesoTocoDisponivel += grupo.totalKg; acc.pedidosTocoDisponiveis += grupo.pedidos.length; } return acc; }, { pesoTocoDisponivel: 0, pedidosTocoDisponiveis: 0, pesoTocoBloqueado: 0, pedidosTocoBloqueados: 0 });
    // 3. Consolida os dados para os novos KPIs
    const kpis = {
        varejoDisponivel: {
            // CORREÃ‡ÃƒO: A lÃ³gica agora soma os pedidos de varejo gerais (Fiorino, Van, 3/4)
            // com os pedidos dos grupos de Toco que estÃ£o totalmente desbloqueados.
            pedidos: pedidosGeraisAtuais.length + pedidosTocoDisponiveis, // Usa o valor jÃ¡ calculado
            peso: pedidosGeraisAtuais.reduce((s, p) => s + p.Quilos_Saldo, 0) + pesoTocoDisponivel // Usa o valor jÃ¡ calculado
        },
        varejoBloqueado: {
            // CORREÃ‡ÃƒO: A lÃ³gica agora soma os bloqueios de varejo com os pedidos
            // dos grupos de Toco que contÃªm pelo menos um pedido bloqueado.
            pedidos: pedidosComCFNumericoIsolado.length +
                pedidosManualmenteBloqueadosAtuais.length +
                pedidosTocoBloqueados, // Usa o valor jÃ¡ calculado
            peso: pedidosComCFNumericoIsolado.reduce((s, p) => s + p.Quilos_Saldo, 0) +
                pedidosManualmenteBloqueadosAtuais.reduce((s, p) => s + p.Quilos_Saldo, 0) +
                pesoTocoBloqueado // Usa o valor jÃ¡ calculado
        },
        cargasFechadasPR: {
            pedidos: cargasFechadasPR.length,
            peso: cargasFechadasPR.reduce((s, p) => s + p.Quilos_Saldo, 0)
        },
        cargasFechadasRestBR: {
            pedidos: Object.values(gruposPorCFGlobais).reduce((s, g) => s + g.pedidos.length, 0),
            peso: Object.values(gruposPorCFGlobais).reduce((s, g) => s + g.totalKg, 0)
        },
        transferencias: {
            pedidos: pedidosTransferencias.length,
            peso: pedidosTransferencias.reduce((s, p) => s + p.Quilos_Saldo, 0)
        },
        exportacao: {
            pedidos: pedidosExportacao.length,
            peso: pedidosExportacao.reduce((s, p) => s + p.Quilos_Saldo, 0)
        },
        funcionarios: {
            pedidos: pedidosFuncionarios.length,
            peso: pedidosFuncionarios.reduce((s, p) => s + p.Quilos_Saldo, 0)
        }
    };

    kpiData.pedidosAPredatar = pedidosAPredatar; // Armazena a lista completa

    // 4. Renderiza os KPIs no HTML
    const kpiMainContainer = document.getElementById('kpi-main-container');
    if (kpiMainContainer) {
        kpiMainContainer.innerHTML = `
                    <!-- Alerta (Se houver) -->
                    ${kpiData.pedidosAPredatar.length > 0 ? `<div class="col-12 animated-entry">${renderKpiCard('Pedidos a Predatar', null, kpiData.pedidosAPredatar.length, 'bi-calendar-x', 'danger', true)}</div>` : ''}
                    <!-- KPIs Principais -->
                    <div class="col-12 animated-entry">${renderMainKpiCard('Varejo DisponÃ­vel', kpis.varejoDisponivel.peso, kpis.varejoDisponivel.pedidos, 'available', 'bi-check-circle-fill', "navigateToSection('workspace-view', 'disponiveis-tab-pane')")}</div>
                    <div class="col-12 animated-entry">${renderMainKpiCard('Varejo Bloqueado', kpis.varejoBloqueado.peso, kpis.varejoBloqueado.pedidos, 'blocked', 'bi-shield-lock-fill', "navigateToSection('workspace-view', 'bloqueados-regra-tab-pane')")}</div>
                `;
    }

    const kpiOtherContainer = document.getElementById('kpi-other-container');
    if (kpiOtherContainer) {
        const categories = [
            { label: 'Cargas Fechadas PR', data: kpis.cargasFechadasPR, icon: 'bi-building-fill-check', action: "navigateToSection('workspace-view', 'cargas-fechadas-pr-tab-pane')" },
            { label: 'Cargas Fechadas Resto BR', data: kpis.cargasFechadasRestBR, icon: 'bi-globe-americas', action: "navigateToSection('workspace-view', 'cargas-fechadas-rest-br-tab-pane')" },
            { label: 'TransferÃªncias', data: kpis.transferencias, icon: 'bi-arrow-left-right', action: "navigateToSection('workspace-view', 'outros-pedidos-tab-pane', 'resultado-transferencias')" },
            { label: 'ExportaÃ§Ã£o', data: kpis.exportacao, icon: 'bi-box-arrow-up-right', action: "navigateToSection('workspace-view', 'outros-pedidos-tab-pane', 'resultado-exportacao')" },
            { label: 'FuncionÃ¡rios', data: kpis.funcionarios, icon: 'bi-people-fill', action: "navigateToSection('workspace-view', 'outros-pedidos-tab-pane', 'resultado-funcionarios')" }
        ];

        kpiOtherContainer.innerHTML = categories.map(cat => `
                    <div class="col-sm-6 col-md-4 col-xl">
                        <div class="modern-list-item h-100 flex-column align-items-center justify-content-center text-center p-3" style="cursor: pointer;" onclick="${cat.action}">
                            <div class="modern-list-icon mb-3 mx-auto" style="width: 48px; height: 48px; font-size: 1.5rem;"><i class="bi ${cat.icon}"></i></div>
                            <div class="modern-list-content w-100">
                                <div class="modern-list-title mb-1 text-uppercase text-secondary small">${cat.label}</div>
                                <div class="modern-list-value fs-4 mb-1">${(cat.data.peso / 1000).toFixed(2)} <small class="fs-6 text-muted">t</small></div>
                                <div class="badge bg-dark border border-secondary text-secondary rounded-pill">${cat.data.pedidos} pedidos</div>
                            </div>
                        </div>
                    </div>`).join('');
    }

    // Renderiza o subtÃ­tulo do grÃ¡fico
    const totalVeiculosMontados = Object.keys(activeLoads).length;
    const pesoTotalMontado = Object.values(activeLoads).reduce((s, l) => s + (l.totalKg || 0), 0);
    document.getElementById('chart-subtitle').innerHTML = `<i class="bi bi-truck me-1"></i> ${totalVeiculosMontados} veÃ­culos &nbsp;|&nbsp; <i class="bi bi-database me-1"></i> ${(pesoTotalMontado / 1000).toFixed(2)} ton`;

}

function renderMainKpiCard(title, weight, count, type, icon, onClickAction) {
    const weightText = (weight / 1000).toFixed(2);
    const cursorStyle = onClickAction ? 'cursor: pointer;' : '';
    const clickAttr = onClickAction ? `onclick="${onClickAction}"` : '';
    return `
                <div class="kpi-card-modern ${type}" style="${cursorStyle}" ${clickAttr}>
                    <i class="bi ${icon} kpi-icon-watermark"></i>
                    <div class="kpi-label"><i class="bi ${icon}"></i> ${title}</div>
                    <div class="kpi-metric-group">
                        <span class="kpi-metric-value">${weightText}</span>
                        <span class="kpi-metric-unit">toneladas</span>
                    </div>
                    <div class="kpi-footer">
                        <span><i class="bi bi-box-seam me-1"></i> ${count} pedidos</span>
                        <span class="badge bg-dark border border-secondary text-secondary">Atualizado</span>
                    </div>
                </div>
            `;
}

function renderKpiCard(title, weight, count, icon, colorClass, isClickable = false) {
    const weightText = weight !== null ? `${(weight / 1000).toFixed(2)}` : `${count}`;
    const unitText = weight !== null ? 'ton' : 'pedidos';
    const subText = weight !== null ? `${count} pedidos` : 'AÃ§Ã£o NecessÃ¡ria';
    const clickableClass = isClickable ? 'stat-card-clickable' : '';
    const onClickAction = isClickable ? 'onclick="exportarPedidosAtrasados()"' : '';
    const titleAttr = isClickable ? 'title="Clique para exportar a lista"' : '';

    return `
                <div class="kpi-card-modern alert ${clickableClass}" ${onClickAction} ${titleAttr} style="border-color: #dc3545;">
                    <i class="bi ${icon} kpi-icon-watermark" style="color: #dc3545;"></i>
                    <div class="kpi-label" style="color: #dc3545;"><i class="bi ${icon}"></i> ${title}</div>
                    <div class="kpi-metric-group">
                        <span class="kpi-metric-value" style="color: #dc3545;">${weightText}</span>
                        <span class="kpi-metric-unit" style="color: #dc3545;">${unitText}</span>
                    </div>
                    <div class="kpi-footer" style="border-top-color: rgba(220, 53, 69, 0.3); color: #dc3545;">
                        <span>${subText}</span>
                        <i class="bi bi-arrow-right-circle-fill"></i>
                    </div>
                </div>
            `;
}

function isOverdue(predat) {
    if (!predat) { return false; }
    const date = predat instanceof Date ? predat : new Date(predat);
    if (isNaN(date)) { return false; }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
}

function exportarPedidosAtrasados() {
    // Usa a lista de pedidos a predatar jÃ¡ calculada para o KPI do dashboard
    const pedidosAtrasados = kpiData.pedidosAPredatar || [];

    if (planilhaData.length === 0) {
        showToast("Por favor, carregue e processe a planilha primeiro.", 'warning');
        return;
    }

    if (pedidosAtrasados.length === 0) {
        showToast("Nenhum pedido em atraso foi encontrado para exportar.", 'info');
        return;
    }

    alert(`${pedidosAtrasados.length} pedidos em atraso serÃ£o exportados.`);

    const header = ['Cliente', 'Nome_Cliente', 'Cidade', 'UF', 'Num_Pedido', 'Quilos_Saldo', 'Predat', 'Dat_Ped', 'Coluna5'];

    const dataToExport = pedidosAtrasados.map(p => {
        let filteredP = {};
        header.forEach(col => {
            // Passa o objeto Date diretamente para a biblioteca, sem converter para string.
            // A biblioteca se encarregarÃ¡ de formatar como data no Excel.
            filteredP[col] = p[col];
        });
        return filteredP;
    });

    // A opÃ§Ã£o cellDates:true informa Ã  biblioteca para tratar objetos Date como datas.
    const worksheet = XLSX.utils.json_to_sheet(dataToExport, { header: header, cellDates: true });

    // Aplica o formato de data 'dd/mm/yyyy' Ã s colunas de data
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    const predatColIndex = header.indexOf('Predat');
    const datPedColIndex = header.indexOf('Dat_Ped');

    for (let R = range.s.r + 1; R <= range.e.r; ++R) { // Pula o cabeÃ§alho (r + 1)
        [predatColIndex, datPedColIndex].forEach(colIndex => {
            if (colIndex === -1) return;
            const cell_address = { c: colIndex, r: R };
            const cell_ref = XLSX.utils.encode_cell(cell_address);
            if (worksheet[cell_ref] && worksheet[cell_ref].t === 'd') { // Verifica se a cÃ©lula Ã© do tipo data
                worksheet[cell_ref].z = 'dd/mm/yyyy'; // Define o formato
            }
        });
    }

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Pedidos Atrasados");
    XLSX.writeFile(workbook, "pedidos_atrasados.xlsx");
}

function createTable(pedidos, columnsToDisplay, sourceId = '') {
    if (!pedidos || pedidos.length === 0) return '';

    const colunasExibir = columnsToDisplay || ['Cod_Rota', 'Cliente', 'Nome_Cliente', 'Agendamento', 'Num_Pedido', 'Quilos_Saldo', 'Cubagem', 'Cidade', 'UF', 'Predat', 'Dat_Ped', 'BLOQ.', 'Coluna4', 'Coluna5', 'CF'];
    let table = '<div class="table-responsive"><table class="table table-sm table-bordered table-striped table-hover"><thead><tr><th><input type="checkbox" class="form-check-input" onclick="toggleAllCheckboxes(this)"></th>';
    colunasExibir.forEach(c => table += `<th>${c.replace('_', ' ')}</th>`);
    table += '</tr></thead><tbody>';
    pedidos.forEach(p => {
        // LÃ³gica para aplicar a cor da rota
        const isPriorityRow = pedidosPrioritarios.includes(String(p.Num_Pedido));
        const isRecallRow = pedidosRecall.includes(String(p.Num_Pedido));
        let rowClass = '';
        if (isPriorityRow) rowClass = 'table-warning'; else if (isRecallRow) rowClass = 'table-info';
        else if (sourceId === 'geral') {
            const vehicleType = rotaVeiculoMap[p.Cod_Rota]?.type;
            if (vehicleType === 'fiorino') rowClass = 'route-fiorino';
            else if (vehicleType === 'van') rowClass = 'route-van';
            else if (vehicleType === 'tresQuartos') rowClass = 'route-tresQuartos';
        }

        const isDraggable = sourceId !== ''; // SÃ³ permite arrastar se tiver um sourceId
        const clienteIdNormalizado = normalizeClientId(p.Cliente);
        table += `<tr id="pedido-${p.Num_Pedido}"
                                     class="${rowClass}"
                                     data-cliente-id="${clienteIdNormalizado}" 
                                     data-pedido-id="${p.Num_Pedido}"
                                     onclick="highlightClientRows(event)"
                                     draggable="${isDraggable}"
                                     ondragstart="dragStart(event, '${p.Num_Pedido}', '${clienteIdNormalizado}', '${sourceId}')">`;
        table += `<td><input type="checkbox" class="form-check-input row-checkbox" value="${p.Num_Pedido}" onclick="updateBulkActionsPanel(event)"></td>`;
        colunasExibir.forEach(c => {
            let cellContent = p[c] === undefined || p[c] === null ? '' : p[c];
            if (c === 'Num_Pedido') {
                const isPriority = pedidosPrioritarios.includes(String(p.Num_Pedido));
                const isRecall = pedidosRecall.includes(String(p.Num_Pedido));
                const isSemCorte = pedidosSemCorte.has(String(p.Num_Pedido));
                const priorityBadge = isPriority ? ' <span class="badge bg-warning text-dark">Prioridade</span>' : (isRecall ? ' <span class="badge bg-info">Recall</span>' : '');
                const semCorteBadge = isSemCorte ? ' <span class="badge bg-transparent" title="Pedido Sem Corte"><i class="bi bi-scissors text-warning"></i></span>' : '';
                table += `<td>${cellContent}${priorityBadge}${semCorteBadge}</td>`;
            } else if (c === 'Agendamento' && cellContent === 'Sim') {
                table += `<td><span class="badge bg-warning text-dark">${cellContent}</span></td>`;
            } else if (c === 'Predat' || c === 'Dat_Ped') {
                let formattedDate = '';
                const dateObj = cellContent instanceof Date ? cellContent : new Date(cellContent);

                if (dateObj instanceof Date && !isNaN(dateObj)) {
                    formattedDate = dateObj.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
                } else {
                    formattedDate = cellContent || '';
                }

                if (c === 'Predat' && isOverdue(p.Predat)) {
                    table += `<td><span class="text-danger fw-bold">${formattedDate}</span></td>`;
                } else {
                    table += `<td>${formattedDate}</td>`;
                }
            } else if (c === 'Quilos_Saldo' || c === 'Cubagem') {
                table += `<td>${(cellContent || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>`;
            } else {
                table += `<td>${cellContent}</td>`;
            }
        });
        table += '</tr>';
    });
    table += '</tbody></table></div>';
    return table;
}

function displayGerais(div, grupos) {
    // MODIFICADO: Agora considera tambÃ©m as rotas jÃ¡ processadas para exibir os botÃµes,
    // mesmo que nÃ£o tenham pedidos pendentes (caso de alocaÃ§Ã£o total sem sobras).
    const rotasPendentes = Object.keys(grupos);
    const rotasProcessadas = [];
    processedRoutes.forEach(key => {
        key.split(',').forEach(r => rotasProcessadas.push(r.trim()));
    });

    const todasRotas = new Set([...rotasPendentes, ...rotasProcessadas]);

    if (todasRotas.size === 0) {
        div.innerHTML = '<div class="empty-state"><i class="bi bi-file-earmark-excel"></i><p>Nenhum pedido de varejo disponÃ­vel.</p></div>';
        document.getElementById('botoes-fiorino').innerHTML = '<div class="empty-state"><i class="bi bi-box"></i><p>Nenhuma rota de Fiorino disponÃ­vel. Processe um arquivo para comeÃ§ar.</p></div>';
        document.getElementById('botoes-van').innerHTML = '<div class="empty-state"><i class="bi bi-truck-front-fill"></i><p>Nenhuma rota de Van disponÃ­vel. Processe um arquivo para comeÃ§ar.</p></div>';
        document.getElementById('botoes-34').innerHTML = '<div class="empty-state"><i class="bi bi-truck-flatbed"></i><p>Nenhuma rota de 3/4 disponÃ­vel. Processe um arquivo para comeÃ§ar.</p></div>';
        return;
    }

    // --- CORREÃ‡ÃƒO DE UX (Manter AcordeÃ£o Aberto) ---
    // Salva o ID do acordeÃ£o que estÃ¡ aberto. O ID agora Ã© baseado na rota (ex: 'collapseGeral-11101'),
    // que Ã© um identificador estÃ¡vel, ao contrÃ¡rio do Ã­ndice que mudava a cada redesenho.
    // Isso garante que o acordeÃ£o correto permaneÃ§a aberto apÃ³s arrastar e soltar pedidos.
    const openAccordionItem = div.querySelector('.accordion-collapse.show');
    const openAccordionId = openAccordionItem ? openAccordionItem.id : null;
    // --- FIM DA MELHORIA ---

    // Usa a funÃ§Ã£o centralizada para garantir a mesma ordem da busca
    const rotasOrdenadas = getSortedVarejoRoutes(Array.from(todasRotas));

    const botoes = { fiorino: '', van: '', tresQuartos: '' };
    const addedButtons = new Set();

    rotasOrdenadas.forEach(rota => {
        let config = rotaVeiculoMap[rota];
        // LÃ³gica para tratar rotas nÃ£o mapeadas como rotas de SÃ£o Paulo (Van/3/4)
        if (!config) {
            config = { type: 'van', title: `Van / 3/4 SÃ£o Paulo - Rota ${rota}` };
        }

        if (config && !addedButtons.has(rota)) {
            let rotaValue = `'${rota}'`;
            if (config.combined) {
                // prettier-ignore
                const combinedRoutes = [rota, ...config.combined];
                rotaValue = `[${combinedRoutes.map(r => `'${r}'`).join(', ')}]`;
                combinedRoutes.forEach(r => addedButtons.add(r));
            }

            // Define o tÃ­tulo do botÃ£o dinamicamente
            let buttonTitle = config.title; // prettier-ignore
            if (config.type === 'van' && !config.title.startsWith('Rota 1')) { // Se for van e nÃ£o for do ParanÃ¡
                buttonTitle = `${rota} (VAN-3/4- SP)`;
            }

            const vehicleType = config.type;
            const colorClass = vehicleType === 'fiorino' ? 'success' : (vehicleType === 'van' ? 'primary' : 'warning');
            const divId = vehicleType === 'fiorino' ? 'resultado-fiorino-geral' : (vehicleType === 'van' ? 'resultado-van-geral' : 'resultado-34-geral');
            const btnId = `btn-${vehicleType}-${rota}`;
            const routesKeyString = rotaValue.replace(/\[|\]|'|\s/g, ''); // Transforma ['1', '2'] em 1,2 (sem espaÃ§os)

            // Verifica se a rota jÃ¡ foi processada para renderizar o botÃ£o no estado correto
            if (processedRoutes.has(routesKeyString)) {
                botoes[vehicleType] += `
                            <div class="btn-group mt-2 me-2" role="group">
                                <button id="${btnId}" class="btn btn-${colorClass} active" onclick="exibirCargasDaRota('${routesKeyString}')"><i class="bi bi-eye-fill me-2"></i>${buttonTitle}</button>
                                <button class="btn btn-${colorClass} active" onclick="reprocessarRota('${routesKeyString}', event)" title="Reprocessar Rota"><i class="bi bi-arrow-clockwise"></i></button>
                            </div>`;
            } else {
                const functionCall = `separarCargasGeneric(${rotaValue}, '${divId}', '${buttonTitle}', '${vehicleType}', this)`;
                botoes[vehicleType] += `<button id="${btnId}" class="btn btn-outline-${colorClass} mt-2 me-2" onclick="${functionCall}">${buttonTitle}</button>`;
            }
        }
    });
    document.getElementById('botoes-fiorino').innerHTML = botoes.fiorino || '<div class="empty-state"><i class="bi bi-box"></i><p>Nenhuma rota de Fiorino encontrada.</p></div>';
    document.getElementById('botoes-van').innerHTML = botoes.van || '<div class="empty-state"><i class="bi bi-truck-front-fill"></i><p>Nenhuma rota de Van encontrada.</p></div>';
    document.getElementById('botoes-34').innerHTML = botoes.tresQuartos || '<div class="empty-state"><i class="bi bi-truck-flatbed"></i><p>Nenhuma rota de 3/4 encontrada.</p></div>';
    let accordionHtml = '<div class="accordion accordion-flush" id="accordionGeral">';
    let hasPendingItems = false;

    rotasOrdenadas.forEach((rota, index) => {
        const grupo = grupos[rota];
        if (!grupo) return; // Pula se nÃ£o houver pedidos pendentes para esta rota
        hasPendingItems = true;
        const totalKgFormatado = grupo.totalKg.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const veiculo = rotaVeiculoMap[rota]?.type || 'van'; // Assume 'van' para rotas nÃ£o mapeadas
        let veiculoClass = '';
        if (veiculo === 'fiorino') veiculoClass = 'route-fiorino';
        else if (veiculo === 'van') veiculoClass = 'route-van';
        else if (veiculo === 'tresQuartos') veiculoClass = 'route-tresQuartos';


        let rotaDisplay; // Rota: 11101 (Fiorino)
        if (veiculo === 'van' && !rotaVeiculoMap[rota]?.title.startsWith('Rota 1')) {
            rotaDisplay = `Rota: ${rota} (VAN-3/4- SP)`;
        } else {
            const veiculoNome = veiculo.replace('tresQuartos', '3/4').replace(/^\w/, c => c.toUpperCase());
            rotaDisplay = `Rota: ${rota} (${veiculoNome})`;
        }
        // CORREÃ‡ÃƒO: O ID do collapse agora usa a rota, que Ã© um identificador estÃ¡vel.
        const collapseId = `collapseGeral-${rota}`;
        accordionHtml += `<div class="accordion-item"><h2 class="accordion-header"><button class="accordion-button collapsed ${veiculoClass}" type="button" data-bs-toggle="collapse" data-bs-target="#${collapseId}"><strong>${rotaDisplay}</strong> &nbsp; <span class="badge bg-secondary ms-2"><i class="bi bi-box me-1"></i>${grupo.pedidos.length}</span> <span class="badge bg-light text-dark ms-2"><i class="bi bi-database me-1"></i>${totalKgFormatado} kg</span></button></h2>
                                  <div id="${collapseId}" class="accordion-collapse collapse" data-bs-parent="#accordionGeral">
                                    <div class="accordion-body">${createTable(grupo.pedidos, null, 'geral')}</div></div></div>`;
    });
    accordionHtml += '</div>';

    if (!hasPendingItems) {
        div.innerHTML = '<div class="empty-state"><i class="bi bi-check-circle-fill"></i><p>Todos os pedidos disponÃ­veis foram alocados.</p></div>';
    } else {
        div.innerHTML = accordionHtml;
    }

    // --- CORREÃ‡ÃƒO DE UX (Manter AcordeÃ£o Aberto) ---
    // Reabre o acordeÃ£o que estava aberto antes da atualizaÃ§Ã£o, usando o ID estÃ¡vel salvo.
    if (openAccordionId) {
        const newAccordionItem = document.getElementById(openAccordionId);
        if (newAccordionItem) {
            const bsCollapse = bootstrap.Collapse.getOrCreateInstance(newAccordionItem, { toggle: false });
            bsCollapse.show();
        }
    }
}

function displayAccordionGerais(div, grupos) {
    if (!div) return;

    if (Object.keys(grupos).length === 0) {
        div.innerHTML = '<div class="empty-state"><i class="bi bi-file-earmark-excel"></i><p>Nenhum pedido de varejo disponÃ­vel.</p></div>';
        return;
    }

    const rotasOrdenadas = getSortedVarejoRoutes(Object.keys(grupos));
    let accordionHtml = '<div class="accordion accordion-flush" id="accordionGeral">';

    rotasOrdenadas.forEach((rota, index) => {
        const grupo = grupos[rota];
        const totalKgFormatado = grupo.totalKg.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const config = rotaVeiculoMap[rota] || { type: 'van' }; // Fallback para rotas nÃ£o mapeadas (SP)
        const veiculo = config.type;

        let rotaDisplay;
        if (veiculo === 'van' && !config.title?.startsWith('Rota 1')) {
            rotaDisplay = `Rota: ${rota} (VAN-3/4- SP)`;
        } else {
            const veiculoNome = veiculo.replace('tresQuartos', '3/4').replace(/^\w/, c => c.toUpperCase());
            rotaDisplay = `Rota: ${rota} (${veiculoNome})`;
        }

        accordionHtml += `<div class="accordion-item"><h2 class="accordion-header" id="headingGeral${index}"><button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapseGeral${index}"><strong>${rotaDisplay}</strong> &nbsp; <span class="badge bg-secondary ms-2"><i class="bi bi-box me-1"></i>${grupo.pedidos.length}</span> <span class="badge bg-light text-dark ms-2"><i class="bi bi-database me-1"></i>${totalKgFormatado} kg</span></button></h2>
                                  <div id="collapseGeral${index}" class="accordion-collapse collapse" data-bs-parent="#accordionGeral">
                                    <div class="accordion-body">${createTable(grupo.pedidos, null, 'geral')}</div></div></div>`;
    });
    accordionHtml += '</div>';
    div.innerHTML = accordionHtml;
}

function displayPedidosBloqueados(div, pedidos) {
    if (pedidos.length === 0) {
        div.innerHTML = '<div class="empty-state"><i class="bi bi-shield-check"></i><p>Nenhum pedido bloqueado manualmente.</p></div>';
        return;
    }
    const totalKg = pedidos.reduce((sum, p) => sum + p.Quilos_Saldo, 0);
    const totalKgFormatado = totalKg.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const accordionId = 'accordionBloqueados';
    const collapseId = 'collapseBloqueados';

    let html = `<div class="accordion accordion-flush" id="${accordionId}">
                <div class="accordion-item">
                    <h2 class="accordion-header"><button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#${collapseId}"><strong>Total Bloqueado:</strong> ${pedidos.length} pedidos / ${totalKgFormatado} kg</button></h2>
                    <div id="${collapseId}" class="accordion-collapse collapse" data-bs-parent="#${accordionId}"><div class="accordion-body p-0">${createTable(pedidos)}</div></div>
                </div>
            </div>`;
    div.innerHTML = html;
}

function displayPedidosCFNumerico(div, pedidos) {
    if (pedidos.length === 0) { div.innerHTML = '<div class="empty-state"><i class="bi bi-funnel"></i><p>Nenhum pedido filtrado por esta regra.</p></div>'; return; }

    const grupos = pedidos.reduce((acc, p) => {
        const rota = p.Cod_Rota; if (!acc[rota]) { acc[rota] = { pedidos: [], totalKg: 0 }; } acc[rota].pedidos.push(p); acc[rota].totalKg += p.Quilos_Saldo; return acc;
    }, {});
    let accordionHtml = '<div class="accordion accordion-flush" id="accordionCF">';

    // Usa a mesma funÃ§Ã£o de ordenaÃ§Ã£o da lista de disponÃ­veis para manter a consistÃªncia
    const rotasOrdenadas = getSortedVarejoRoutes(Object.keys(grupos));
    rotasOrdenadas.forEach((rota, index) => {
        const grupo = grupos[rota];
        const totalKgFormatado = grupo.totalKg.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const veiculo = rotaVeiculoMap[rota]?.type || 'van'; // Assume 'van' para rotas nÃ£o mapeadas
        let veiculoClass = '';
        if (veiculo === 'fiorino') veiculoClass = 'route-fiorino';
        else if (veiculo === 'van') veiculoClass = 'route-van';
        else if (veiculo === 'tresQuartos') veiculoClass = 'route-tresQuartos';


        let rotaDisplay;
        if (veiculo === 'van' && !rotaVeiculoMap[rota]?.title.startsWith('Rota 1')) {
            rotaDisplay = `Rota: ${rota} (VAN-3/4- SP)`;
        } else {
            const veiculoNome = veiculo.replace('tresQuartos', '3/4').replace(/^\w/, c => c.toUpperCase());
            rotaDisplay = `Rota: ${rota} (${veiculoNome})`;
        }

        const collapseId = `collapseCF-${rota}`; // ID estÃ¡vel usando a rota
        accordionHtml += `<div class="accordion-item"><h2 class="accordion-header"><button class="accordion-button collapsed ${veiculoClass}" type="button" data-bs-toggle="collapse" data-bs-target="#${collapseId}"><strong>${rotaDisplay}</strong> &nbsp; <span class="badge bg-secondary ms-2"><i class="bi bi-box me-1"></i>${grupo.pedidos.length}</span> <span class="badge bg-light text-dark ms-2"><i class="bi bi-database me-1"></i>${totalKgFormatado} kg</span></button></h2>
                                  <div id="${collapseId}" class="accordion-collapse collapse" data-bs-parent="#accordionCF">
                                    <div class="accordion-body p-0">${createTable(grupo.pedidos, null, 'bloqueados-regra')}</div></div></div>`;
    });
    accordionHtml += '</div>'; div.innerHTML = accordionHtml;
}

function displayTresQuartos(div, loads) {
    if (div) div.innerHTML = '';
}

function displayRota1(div, pedidos) {
    if (!pedidos || pedidos.length === 0) {
        div.innerHTML = '<div class="empty-state"><i class="bi bi-check-circle"></i><p>Nenhum pedido da Rota 1 para alteraÃ§Ã£o encontrado.</p></div>';
        return;
    }

    let html = `
                <div class="d-flex justify-content-end mb-2 no-print">
                    <button class="btn btn-sm btn-outline-warning" onclick="imprimirGeneric(document.getElementById('resultado-rota1'), 'Pedidos Rota 1 para AlteraÃ§Ã£o')">
                        <i class="bi bi-printer-fill me-1"></i>Imprimir Lista
                    </button>
                </div>
                ${createTable(pedidos, ['Num_Pedido', 'Cliente', 'Nome_Cliente', 'Quilos_Saldo', 'Cidade', 'Predat', 'Dat_Ped', 'CF', 'Coluna5'])}
            `;
    div.innerHTML = html;
}

function createPrintWindow(title) {
    const printWindow = window.open('', '', 'height=800,width=1200');
    printWindow.document.write('<html><head><title>' + title + '</title>');
    printWindow.document.write('<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">');
    printWindow.document.write(`<style>
                @page { size: auto; margin: 5mm; }
                body { margin: 10px; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-family: sans-serif; font-size: 10pt; } 
                .card, .load-card { break-inside: avoid; margin-bottom: 10px; page-break-inside: avoid; border: 1px solid #ccc; border-radius: 4px; background-color: #fff; } 
                .load-card-header { background-color: #f0f0f0; padding: 5px 10px; border-bottom: 1px solid #ccc; display: flex; justify-content: space-between; align-items: center; }
                .load-title { font-weight: bold; font-size: 1rem; color: #000; }
                .load-meta { font-size: 0.8rem; color: #555; margin-top: 2px; }
                .load-meta-item { margin-right: 10px; display: inline-flex; align-items: center; }
                .load-meta-item i { margin-right: 4px; }
                .no-print { display: none !important; } 
                .bg-success { background-color: #198754 !important; color: white !important; } 
                .bg-primary { background-color: #0d6efd !important; color: white !important; } 
                .bg-warning { background-color: #ffc107 !important; color: black !important; } 
                .bg-danger { background-color: #dc3545 !important; color: white !important; } 
                .table-responsive { overflow: visible !important; } 
                table, th, td { border: 1px solid #dee2e6 !important; padding: 2px 4px !important; font-size: 8pt !important; } 
                .table-primary, .table-primary > th, .table-primary > td { --bs-table-bg: #cfe2ff !important; color: #000 !important; } 
                h1, h2, h3, h4, h5 { margin-top: 0.5rem; margin-bottom: 0.5rem; }
                .progress { display: none !important; } /* Esconde barra de progresso na impressÃ£o */
                .card-body { padding: 5px !important; }
                .px-3 { padding-left: 5px !important; padding-right: 5px !important; }
                .pt-2 { padding-top: 5px !important; }
                .pb-3 { padding-bottom: 5px !important; }
            </style></head><body>`);
    return printWindow;
}

function imprimirGeneric(source, title) {
    let elementToPrint = null;
    let htmlContent = '';

    if (source instanceof HTMLElement) {
        elementToPrint = source;
    } else if (typeof source === 'string') {
        const el = document.getElementById(source);
        if (el) {
            elementToPrint = el;
        } else {
            htmlContent = source;
        }
    }

    if (elementToPrint) {
        const clone = elementToPrint.cloneNode(true);

        // Lógica para buscar o texto da observação salva e colocar na área de impressão
        const allCardsInClone = clone.querySelectorAll('div[data-load-id]');
        allCardsInClone.forEach(cardClone => {
            const loadId = cardClone.dataset.loadId;
            const load = activeLoads[loadId];
            const observationText = load?.observation || '';

            const clonePrintDiv = cardClone.querySelector('.print-only-observation');
            if (clonePrintDiv) {
                const printParagraph = clonePrintDiv.querySelector('p');
                if (printParagraph && observationText) {
                    printParagraph.innerHTML = `<strong>Observações:</strong><br>${observationText.replace(/\n/g, '<br>')}`;
                    clonePrintDiv.style.display = 'block';
                } else if (printParagraph) {
                    printParagraph.innerHTML = '';
                    clonePrintDiv.style.display = 'none';
                }
            }
        });
        htmlContent = clone.outerHTML;
    }

    const printWindow = createPrintWindow(title);
    printWindow.document.body.innerHTML = `<h3>${title}</h3>` + htmlContent;
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 500);
}

function imprimirSobras(title) {
    if (currentLeftoversForPrinting.length === 0) { alert("Nenhuma sobra para imprimir."); return; }
    const totalKgFormatado = currentLeftoversForPrinting.reduce((sum, p) => sum + p.Quilos_Saldo, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const printWindow = createPrintWindow(title); // prettier-ignore
    let contentToPrint = `<h3>${title} - Total: ${totalKgFormatado} kg</h3>` + createTable(currentLeftoversForPrinting);
    printWindow.document.body.innerHTML = contentToPrint;
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
}

function imprimirCargasGeneric(divId, title) {
    const containerDiv = document.getElementById(divId);
    if (!containerDiv) return;

    // CORREÃ‡ÃƒO: Busca todos os cards de carga dentro do container geral da aba (ex: 'resultado-fiorino-geral'),
    // incluindo tanto os gerados pelo sistema quanto os manuais.
    const cardsParaImprimir = containerDiv.querySelectorAll('div[data-load-id]');

    if (cardsParaImprimir.length === 0) { alert(`Nenhuma carga montada para imprimir na seÃ§Ã£o "${title}".`); return; }

    const containerClone = document.createElement('div');

    let finalTitle = title; // ComeÃ§a com o tÃ­tulo padrÃ£o

    // LÃ“GICA APRIMORADA: Verifica se QUALQUER carga a ser impressa contÃ©m rotas de SP, independentemente da aba.
    let isSaoPauloRoute = false;
    const spRoutes = new Set(['2555', '2560', '2561', '2571', '2575', '2705', '2735', '2745']);
    for (const card of cardsParaImprimir) {
        const loadId = card.dataset.loadId;
        if (activeLoads[loadId] && activeLoads[loadId].pedidos.some(p => spRoutes.has(String(p.Cod_Rota)))) {
            isSaoPauloRoute = true;
            break; // Encontrou uma, jÃ¡ pode parar
        }
    }

    // Se for uma rota de SP, altera o tÃ­tulo para refletir isso.
    if (isSaoPauloRoute) {
        finalTitle = `${title} (SÃ£o Paulo)`;
    }

    cardsParaImprimir.forEach(originalCard => {
        const cardClone = originalCard.cloneNode(true);
        const loadId = cardClone.dataset.loadId;
        const observationText = activeLoads[loadId]?.observation || '';
        const clonePrintDiv = cardClone.querySelector('.print-only-observation');
        if (clonePrintDiv) {
            const printParagraph = clonePrintDiv.querySelector('p');
            if (printParagraph && observationText) {
                printParagraph.innerHTML = `<strong>ObservaÃ§Ãµes:</strong><br>${observationText.replace(/\n/g, '<br>')}`;
                clonePrintDiv.style.display = 'block';
            }
        }
        containerClone.appendChild(cardClone);
    });

    const printWindow = createPrintWindow(finalTitle); // Usa o tÃ­tulo final
    printWindow.document.body.innerHTML = `<h3>${finalTitle}</h3>` + containerClone.innerHTML; // Usa o tÃ­tulo final
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
}

function imprimirTocoIndividual(cf) {
    if (!gruposToco[cf]) { showToast(`Nenhuma carga Toco encontrada para o CF: ${cf}`, 'warning'); return; }
    const grupo = gruposToco[cf];

    // VERIFICAÃ‡ÃƒO: Impede a impressÃ£o e montagem se houver qualquer pedido bloqueado no grupo.
    const hasBlockedOrder = grupo.pedidos.some(p => isPedidoBloqueado(p));
    if (hasBlockedOrder) {
        showToast(`NÃ£o Ã© possÃ­vel montar a carga Toco (CF: ${cf}) pois ela contÃ©m pedidos bloqueados.`, 'danger');
        return;
    }

    const totalKgFormatado = grupo.totalKg.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const totalCubagemFormatado = grupo.totalCubagem.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const printWindow = createPrintWindow('Imprimir Carga Toco CF: ' + cf);
    let contentToPrint = `<h3>Carga Toco CF: ${cf} - Total: ${totalKgFormatado} kg / ${totalCubagemFormatado} mÂ³</h3>` + createTable(grupo.pedidos, null, `toco-${cf}`); // prettier-ignore
    printWindow.document.body.innerHTML = contentToPrint;
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 500);

    // Remove o grupo Toco da lista de disponÃ­veis e atualiza a UI
    delete gruposToco[cf];
    renderAllUI();
    showToast(`Carga Toco (CF: ${cf}) impressa e considerada montada.`, 'success');
}
function imprimirCargaManualIndividual(loadId) {
    const load = activeLoads[loadId]; const cardToPrint = document.getElementById(loadId); if (!load || !cardToPrint) { showToast(`Erro: Carga com ID ${loadId} nÃ£o encontrada.`, 'error'); return; }
    const cardClone = cardToPrint.cloneNode(true);
    const observationText = load?.observation || '';
    const clonePrintDiv = cardClone.querySelector('.print-only-observation');
    if (clonePrintDiv) {
        const printParagraph = clonePrintDiv.querySelector('p');
        if (printParagraph && observationText) {
            printParagraph.innerHTML = `<strong>ObservaÃ§Ãµes:</strong><br>${observationText.replace(/\n/g, '<br>')}`;
            clonePrintDiv.style.display = 'block';
        }
    }

    const title = `ImpressÃ£o - Carga Manual ${load.numero} (${load.vehicleType})`;
    const printWindow = createPrintWindow(title);

    printWindow.document.body.innerHTML = `<h3>${title}</h3>` + cardClone.outerHTML;
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 500);
}

/**
 * Imprime um card de carga individual (seja de rota ou manual).
 * @param {string} loadId O ID da carga a ser impressa.
 */
function imprimirCargaIndividual(loadId) {
    const load = activeLoads[loadId];
    const cardToPrint = document.getElementById(loadId);

    if (!load || !cardToPrint) {
        showToast(`Erro: Carga com ID ${loadId} não encontrada para impressão.`, 'error');
        return;
    }

    const cardClone = cardToPrint.cloneNode(true);
    const observationText = load.observation || '';
    const clonePrintDiv = cardClone.querySelector('.print-only-observation');
    if (clonePrintDiv && observationText) {
        const printParagraph = clonePrintDiv.querySelector('p');
        if (printParagraph) printParagraph.innerHTML = `<strong>Observações:</strong><br>${observationText.replace(/\n/g, '<br>')}`;
        clonePrintDiv.style.display = 'block';
    }

    imprimirGeneric(cardClone.outerHTML, `Impressão - Carga ${load.numero} (${load.vehicleType})`);
}



function isMoveValid(load, groupToAdd, vehicleType) {
    const config = getVehicleConfig(vehicleType);

    if ((load.totalKg + groupToAdd.totalKg) > config.hardMaxKg) return false;
    if ((load.totalCubagem + groupToAdd.totalCubagem) > config.hardMaxCubage) return false;

    if (groupToAdd.isSpecial) {
        const specialClientIdsInLoad = new Set(
            load.pedidos
                .filter(isSpecialClient)
                .map(p => normalizeClientId(p.Cliente))
        );
        const groupToAddClientId = normalizeClientId(groupToAdd.pedidos[0].Cliente);
        // REGRA: Permite no mÃ¡ximo 2 clientes especiais por carga (Volta ao padrÃ£o anterior).
        if (!specialClientIdsInLoad.has(groupToAddClientId) && specialClientIdsInLoad.size >= 2) {
            return false;
        }
    }

    if (groupToAdd.pedidos.some(p => p.Agendamento === 'Sim') && load.pedidos.some(p => p.Agendamento === 'Sim')) return false;

    return true;
}

function runHeuristicOptimization(packableGroups, vehicleType) {
    const strategies = [
        {
            name: 'priority-weight-desc', sorter: (a, b) => {
                // 1. Prioriza por data mais antiga (CritÃ©rio Principal)
                if (a.oldestDate && b.oldestDate) {
                    if (a.oldestDate < b.oldestDate) return -1;
                    if (a.oldestDate > b.oldestDate) return 1;
                } else if (a.oldestDate) { return -1; }
                else if (b.oldestDate) { return 1; }

                // 2. Prioridade Manual (CritÃ©rio SecundÃ¡rio)
                const aHasPrio = a.pedidos.some(p => pedidosPrioritarios.includes(String(p.Num_Pedido).trim()) || pedidosRecall.includes(String(p.Num_Pedido).trim()));
                const bHasPrio = b.pedidos.some(p => pedidosPrioritarios.includes(String(p.Num_Pedido).trim()) || pedidosRecall.includes(String(p.Num_Pedido).trim()));
                if (aHasPrio && !bHasPrio) return -1;
                if (!aHasPrio && bHasPrio) return 1;

                // 3. Desempate final por peso
                return b.totalKg - a.totalKg;
            }
        },
        {
            name: 'scheduled-weight-desc', sorter: (a, b) => {
                // 1. Prioriza por data mais antiga
                if (a.oldestDate && b.oldestDate) {
                    if (a.oldestDate < b.oldestDate) return -1;
                    if (a.oldestDate > b.oldestDate) return 1;
                } else if (a.oldestDate) { return -1; }
                else if (b.oldestDate) { return 1; }
                // 2. Desempate por agendamento
                const aHasSched = a.pedidos.some(p => p.Agendamento === 'Sim');
                const bHasSched = b.pedidos.some(p => p.Agendamento === 'Sim');
                if (aHasSched && !bHasSched) return -1;
                if (!aHasSched && bHasSched) return 1;
                // 3. Desempate final por peso
                return b.totalKg - a.totalKg;
            }
        },
        {
            name: 'weight-desc', sorter: (a, b) => {
                if (a.oldestDate && b.oldestDate) { if (a.oldestDate < b.oldestDate) return -1; if (a.oldestDate > b.oldestDate) return 1; } else if (a.oldestDate) { return -1; } else if (b.oldestDate) { return 1; }
                return b.totalKg - a.totalKg;
            }
        },
        {
            name: 'weight-asc', sorter: (a, b) => {
                if (a.oldestDate && b.oldestDate) { if (a.oldestDate < b.oldestDate) return -1; if (a.oldestDate > b.oldestDate) return 1; } else if (a.oldestDate) { return -1; } else if (b.oldestDate) { return 1; }
                return a.totalKg - b.totalKg;
            }
        }
    ];

    let bestResult = null;

    for (const strategy of strategies) {
        const sortedGroups = [...packableGroups].sort(strategy.sorter);
        const result = createSolutionFromHeuristic(sortedGroups, vehicleType);

        const leftoverWeight = result.leftovers.reduce((sum, g) => sum + g.totalKg, 0);

        if (bestResult === null || leftoverWeight < bestResult.leftoverWeight) {
            bestResult = { ...result, leftoverWeight: leftoverWeight, strategy: strategy.name };
        }
    }

    console.log(`NÃ­vel 1: Melhor estratÃ©gia para ${vehicleType} foi ${bestResult.strategy} com ${bestResult.leftoverWeight.toFixed(2)}kg de sobra.`);
    return bestResult;
}

function createSolutionFromHeuristic(itemsParaEmpacotar, vehicleType) {
    const config = getVehicleConfig(vehicleType);
    let loads = [];
    let leftoverItems = [];

    itemsParaEmpacotar.forEach(item => {
        if (item.totalKg > config.hardMaxKg || item.totalCubagem > config.hardMaxCubage) {
            leftoverItems.push(item); return;
        }

        let bestFit = null;
        for (const load of loads) {
            if (isMoveValid(load, item, vehicleType)) {
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

function getSolutionEnergy(solution, vehicleType) {
    const config = getVehicleConfig(vehicleType);
    const balancingFactor = 0.01; // Fator de peso para a penalidade de balanceamento.

    const leftoverWeight = solution.leftovers.reduce((sum, group) => sum + group.totalKg, 0);

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

        // A variÃ¢ncia mede o quÃ£o espalhados os pesos estÃ£o em relaÃ§Ã£o Ã  mÃ©dia.
        const variance = weights.reduce((sum, w) => sum + Math.pow(w - averageWeight, 2), 0) / weights.length;
        balancePenalty = variance * balancingFactor;
    }

    // A energia total Ã© a soma do peso das sobras e das penalidades.
    return leftoverWeight + loadPenalty + balancePenalty;
}

let thinkingInterval = null;
function startThinkingText() {
    const phrases = [
        "Analisando combinaÃ§Ãµes...",
        "Testando cenÃ¡rios de encaixe...",
        "Calculando a melhor rota...",
        "Verificando restriÃ§Ãµes de peso e cubagem...",
        "Buscando o melhor aproveitamento...",
        "Simulando trocas entre cargas...",
        "Otimizando a distribuiÃ§Ã£o...",
        "Refinando a soluÃ§Ã£o encontrada..."
    ];
    let currentIndex = 0;
    const thinkingTextElement = document.getElementById('thinking-text');
    if (thinkingInterval) clearInterval(thinkingInterval);
    thinkingInterval = setInterval(() => {
        if (thinkingTextElement) thinkingTextElement.textContent = phrases[currentIndex];
        currentIndex = (currentIndex + 1) % phrases.length;
    }, 1500);
}
function stopThinkingText() { if (thinkingInterval) clearInterval(thinkingInterval); }

function calculateDisplaySobras(solution, vehicleType) {
    const config = getVehicleConfig(vehicleType);
    let totalSobras = 0;
    totalSobras += solution.leftovers.reduce((sum, group) => sum + group.totalKg, 0);
    solution.loads.forEach(load => {
        if (load.totalKg > 0 && load.totalKg < config.minKg) {
            totalSobras += load.totalKg;
        }
    });
    return totalSobras;
}

function refinarCargasComTrocas(initialLoads, initialLeftovers, vehicleType) {
    let loads = deepClone(initialLoads);
    let leftovers = deepClone(initialLeftovers);
    let improvementMade;

    if (leftovers.length === 0) {
        return { refinedLoads: loads, remainingLeftovers: leftovers };
    }

    let attempts = 0;
    const maxAttempts = (leftovers.length * loads.length) || 1;

    do {
        improvementMade = false;
        attempts++;
        for (let i = 0; i < leftovers.length; i++) {
            const leftoverGroup = leftovers[i];

            for (let j = 0; j < loads.length; j++) {
                const load = loads[j];

                const clientGroupsInLoad = Object.values(load.pedidos.reduce((acc, pedido) => {
                    const clienteId = normalizeClientId(pedido.Cliente);
                    if (!acc[clienteId]) acc[clienteId] = { pedidos: [], totalKg: 0, totalCubagem: 0, isSpecial: isSpecialClient(pedido) };
                    acc[clienteId].pedidos.push(pedido);
                    acc[clienteId].totalKg += pedido.Quilos_Saldo;
                    acc[clienteId].totalCubagem += pedido.Cubagem;
                    return acc;
                }, {}));

                for (let k = 0; k < clientGroupsInLoad.length; k++) {
                    const groupToSwapOut = clientGroupsInLoad[k];

                    const tempLoadAfterRemoval = {
                        pedidos: load.pedidos.filter(p => !groupToSwapOut.pedidos.some(gp => gp.Num_Pedido === p.Num_Pedido)),
                        totalKg: load.totalKg - groupToSwapOut.totalKg,
                        totalCubagem: load.totalCubagem - groupToSwapOut.totalCubagem,
                    };

                    if (isMoveValid(tempLoadAfterRemoval, leftoverGroup, vehicleType)) {
                        const idsToRemove = new Set(groupToSwapOut.pedidos.map(p => p.Num_Pedido));
                        load.pedidos = load.pedidos.filter(p => !idsToRemove.has(p.Num_Pedido));
                        load.totalKg -= groupToSwapOut.totalKg;
                        load.totalCubagem -= groupToSwapOut.totalCubagem;

                        load.pedidos.push(...leftoverGroup.pedidos);
                        load.totalKg += leftoverGroup.totalKg;
                        load.totalCubagem += leftoverGroup.totalCubagem;

                        leftovers.splice(i, 1);
                        leftovers.push(groupToSwapOut);

                        console.log(`POLIMENTO (NÃ­vel 3): Encaixou grupo de ${leftoverGroup.totalKg.toFixed(2)}kg trocando por um de ${groupToSwapOut.totalKg.toFixed(2)}kg.`);
                        improvementMade = true;
                        break;
                    }
                }
                if (improvementMade) break;
            }
            if (improvementMade) break;
        }
    } while (improvementMade && leftovers.length > 0 && attempts < maxAttempts);

    if (attempts >= maxAttempts) console.warn("Polimento (NÃ­vel 3) interrompido para evitar loop infinito.");

    return { refinedLoads: loads, remainingLeftovers: leftovers };
}

async function separarCargasGeneric(routeOrRoutes, divId, title, vehicleType, buttonElement, isBatchMode = false) {
    // NOVO: Remove mensagens de sucesso de rotas anteriores para manter a interface limpa.
    if (!isBatchMode) {
        document.querySelectorAll('.route-success-message').forEach(el => el.remove());
    }

    // NOVO: Se o painel de carga manual estiver aberto, fecha-o antes de processar uma nova rota.
    if (document.getElementById('manual-load-builder-wrapper')) cancelManualLoad();

    const allRouteButtons = document.querySelectorAll('#botoes-fiorino button, #botoes-van button, #botoes-34 button');

    const routesKey = Array.isArray(routeOrRoutes) ? routeOrRoutes.sort().join(',') : String(routeOrRoutes);

    processedRoutes.add(routesKey);

    // CORREÃ‡ÃƒO: Limpa a Ã¡rea de resultado antes de processar uma nova rota.
    // Isso garante que apenas as cargas da rota atual sejam exibidas.
    const resultadoDiv = document.getElementById(divId);
    if (!isBatchMode) {
        resultadoDiv.innerHTML = '';
    } else {
        // Se for modo batch, remove apenas o estado vazio se existir para adicionar as novas cargas
        const emptyState = resultadoDiv.querySelector('.empty-state');
        if (emptyState) emptyState.remove();
    }
    // Restaura o feedback visual no botÃ£o da rota processada

    if (planilhaData.length === 0) {
        resultadoDiv.innerHTML = '<p class="text-danger">Nenhum dado de planilha carregado.</p>';
        allRouteButtons.forEach(btn => btn.disabled = false);
        return;
    }

    const routes = Array.isArray(routeOrRoutes) ? routeOrRoutes : [String(routeOrRoutes)];
    let pedidosRota = pedidosGeraisAtuais.filter(p => routes.includes(String(p.Cod_Rota)));

    const clientGroupsMap = pedidosRota.reduce((acc, pedido) => {
        const clienteId = normalizeClientId(pedido.Cliente);
        if (!acc[clienteId]) { acc[clienteId] = { pedidos: [], totalKg: 0, totalCubagem: 0, isSpecial: isSpecialClient(pedido) }; }
        acc[clienteId].pedidos.push(pedido);
        acc[clienteId].totalKg += pedido.Quilos_Saldo;
        acc[clienteId].totalCubagem += pedido.Cubagem;
        return acc;
    }, {});
    let packableGroups = Object.values(clientGroupsMap);

    // NOVO: Calcula a data de pedido mais antiga para cada grupo de cliente.
    // (Movido para antes da lÃ³gica da rota 11711 para garantir que os grupos excluÃ­dos tambÃ©m tenham a data calculada para a cascata)
    packableGroups.forEach(group => {
        group.oldestDate = group.pedidos.reduce((oldest, p) => {
            // Prioridade: Dat_Ped (Data do Pedido) para FIFO. Fallback para Predat se Dat_Ped estiver vazio.
            let pDate = p.Dat_Ped;
            if (!pDate || (pDate instanceof Date && isNaN(pDate.getTime()))) {
                pDate = p.Predat;
            }

            if (pDate) {
                const dateObj = pDate instanceof Date ? pDate : new Date(pDate);
                if (!isNaN(dateObj.getTime())) {
                    if (!oldest || dateObj < oldest) return dateObj;
                }
            }
            return oldest;
        }, null);
    });

    // --- LÃ“GICA ESPECIAL PARA PRIORIZAR FIORINO EM ROTAS MISTAS ---
    let groupsExcludedFromFiorino = [];

    // Verifica se alguma das rotas atuais estÃ¡ no mapa especial
    const rotaEspecialEncontrada = routes.find(r => rotasEspeciaisFiorino[r]);

    if (rotaEspecialEncontrada) {
        const cidadesPermitidasFiorino = new Set(rotasEspeciaisFiorino[rotaEspecialEncontrada]);
        const normalizeCity = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();

        const fiorinoGroups = [];
        const otherGroups = [];

        packableGroups.forEach(group => {
            const city = normalizeCity(String(group.pedidos[0].Cidade || '').split(',')[0]);
            if (cidadesPermitidasFiorino.has(city)) {
                fiorinoGroups.push(group);
            } else {
                otherGroups.push(group);
            }
        });

        if (otherGroups.length > 0) {
            packableGroups = fiorinoGroups;
            groupsExcludedFromFiorino = otherGroups;
            showToast(`Rota ${rotaEspecialEncontrada}: Separando ${otherGroups.length} clientes para Van (cidades mistas).`, 'info');
        }
        // Garante que a primeira tentativa seja Fiorino apenas com as cidades permitidas
        vehicleType = 'fiorino';
    }

    packableGroups.forEach(group => {
        group.Quilos_Saldo = group.totalKg;
        group.Cubagem = group.totalCubagem;
        if (group.totalCubagem > 0) group.density = group.totalKg / group.totalCubagem;
        else group.density = Infinity;
    });

    const optimizationLevel = document.getElementById('optimizationLevelSelect').value;
    let optimizationResult;

    // --- LÃ“GICA DE PROCESSAMENTO COM WEB WORKER ---
    const processingWorker = new Worker('worker.js');
    const modalElement = document.getElementById('processing-modal');
    const modal = bootstrap.Modal.getOrCreateInstance(modalElement);
    const progressBar = document.getElementById('processing-progress-bar');
    const statusText = document.getElementById('processing-status-text');

    // Mostra o modal de processamento para otimizaÃ§Ãµes que demoram
    if (optimizationLevel !== '1') {
        progressBar.style.width = '0%';
        statusText.textContent = `Otimizando ${title}...`;
        startThinkingText();
        modal.show();
    } else {
        resultadoDiv.insertAdjacentHTML('beforeend', '<div id="spinner-temp-container" class="d-flex align-items-center justify-content-center p-5"><div class="spinner-border text-primary" role="status"></div><span class="ms-3">Analisando estratÃ©gias e montando cargas...</span></div>');
    }

    // Coleta as configuraÃ§Ãµes atuais dos veÃ­culos
    const vehicleConfigs = {
        fiorinoMinCapacity: parseFloat(document.getElementById('fiorinoMinCapacity').value), fiorinoMaxCapacity: parseFloat(document.getElementById('fiorinoMaxCapacity').value), fiorinoCubage: parseFloat(document.getElementById('fiorinoCubage').value), fiorinoHardMaxCapacity: parseFloat(document.getElementById('fiorinoHardMaxCapacity').value), fiorinoHardCubage: parseFloat(document.getElementById('fiorinoHardCubage').value),
        vanMinCapacity: parseFloat(document.getElementById('vanMinCapacity').value), vanMaxCapacity: parseFloat(document.getElementById('vanMaxCapacity').value), vanCubage: parseFloat(document.getElementById('vanCubage').value), vanHardMaxCapacity: parseFloat(document.getElementById('vanHardMaxCapacity').value), vanHardCubage: parseFloat(document.getElementById('vanHardCubage').value),
        tresQuartosMinCapacity: parseFloat(document.getElementById('tresQuartosMinCapacity').value), tresQuartosMaxCapacity: parseFloat(document.getElementById('tresQuartosMaxCapacity').value), tresQuartosCubage: parseFloat(document.getElementById('tresQuartosCubage').value),
        tocoMinCapacity: parseFloat(document.getElementById('tocoMinCapacity').value), tocoMaxCapacity: parseFloat(document.getElementById('tocoMaxCapacity').value), tocoCubage: parseFloat(document.getElementById('tocoCubage').value)
    };

    // Envia os dados para o worker
    processingWorker.postMessage({
        command: 'start-optimization',
        packableGroups: packableGroups,
        vehicleType: vehicleType,
        optimizationLevel: optimizationLevel,
        configs: vehicleConfigs,
        pedidosPrioritarios: pedidosPrioritarios,
        pedidosRecall: pedidosRecall
    });

    // Aguarda a resposta do worker
    optimizationResult = await new Promise((resolve, reject) => {
        processingWorker.onmessage = function (e) {
            const { status, result, message, stack, progress } = e.data;
            if (status === 'complete') {
                resolve(result);
            } else if (status === 'progress') {
                progressBar.style.width = `${progress}%`;
            } else if (status === 'error') {
                console.error("Erro recebido do Worker:", message, stack);
                reject(new Error(message));
            }
        };
        processingWorker.onerror = function (e) {
            reject(new Error(`Erro no Worker: ${e.message}`));
        };
    });

    // Limpeza apÃ³s o tÃ©rmino
    allRouteButtons.forEach(btn => { if (!btn.classList.contains('active')) btn.disabled = false; });
    if (optimizationLevel !== '1') {
        stopThinkingText();
        modal.hide();
    } else {
        const spinner = document.getElementById('spinner-temp-container');
        if (spinner) spinner.remove();
    }
    processingWorker.terminate();
    // --- FIM DA LÃ“GICA DO WORKER ---

    // Tenta encaixar sobras em cargas existentes que ainda tÃªm espaÃ§o.
    const { refinedLoads: initialRefinedLoads, remainingLeftovers: initialLeftovers } = refineLoadsWithSimpleFit(optimizationResult.loads, optimizationResult.leftovers);

    // Reintegra os grupos excluÃ­dos da otimizaÃ§Ã£o inicial (Rota 11711) para serem processados na cascata (Van)
    if (groupsExcludedFromFiorino.length > 0) {
        initialLeftovers.push(...groupsExcludedFromFiorino);
    }

    // ========================================================================
    // INÃCIO DA NOVA LÃ“GICA DE CASCATA (Fiorino -> Van -> 3/4 -> Toco)
    // ========================================================================
    let primaryLoads = initialRefinedLoads;
    let leftoverGroups = initialLeftovers;
    let secondaryLoads = [];
    let tertiaryLoads = [];
    let quaternaryLoads = [];

    primaryLoads.forEach(l => l.vehicleType = vehicleType);

    // FunÃ§Ã£o auxiliar para chamar a otimizaÃ§Ã£o (usando a heurÃ­stica rÃ¡pida para as cascatas)
    const runCascadeOptimization = (groups, cascadeVehicleType) => {
        if (groups.length === 0) return { loads: [], leftovers: [] };
        console.log(`CASCATA: Tentando montar ${cascadeVehicleType} com ${groups.length} grupos de sobras.`);
        // Usamos a heurÃ­stica simples (NÃ­vel 1) para as etapas da cascata para manter a velocidade.
        return runHeuristicOptimization(groups, cascadeVehicleType);
    };

    switch (vehicleType) {
        case 'fiorino':
            // Sobras de Fiorino tentam virar Van
            const vanResult = runCascadeOptimization(leftoverGroups, 'van');
            secondaryLoads = vanResult.loads.map(l => ({ ...l, vehicleType: 'van' }));
            leftoverGroups = vanResult.leftovers;

            // Sobras de Van tentam virar 3/4
            const tqResultFromFiorino = runCascadeOptimization(leftoverGroups, 'tresQuartos');
            tertiaryLoads = tqResultFromFiorino.loads.map(l => ({ ...l, vehicleType: 'tresQuartos' }));
            leftoverGroups = tqResultFromFiorino.leftovers;

            // Sobras de 3/4 tentam virar Toco
            const tocoResultFromFiorino = runCascadeOptimization(leftoverGroups, 'toco');
            quaternaryLoads = tocoResultFromFiorino.loads.map(l => ({ ...l, vehicleType: 'toco' }));
            leftoverGroups = tocoResultFromFiorino.leftovers;
            break;

        case 'van':
            // Sobras de Van tentam virar 3/4
            const tqResultFromVan = runCascadeOptimization(leftoverGroups, 'tresQuartos');
            secondaryLoads = tqResultFromVan.loads.map(l => ({ ...l, vehicleType: 'tresQuartos' }));
            leftoverGroups = tqResultFromVan.leftovers;

            // Sobras de 3/4 tentam virar Toco
            const tocoResultFromVan = runCascadeOptimization(leftoverGroups, 'toco');
            tertiaryLoads = tocoResultFromVan.loads.map(l => ({ ...l, vehicleType: 'toco' }));
            leftoverGroups = tocoResultFromVan.leftovers;
            break;

        case 'tresQuartos':
            // Sobras de 3/4 tentam virar Toco
            const tocoResultFromTQ = runCascadeOptimization(leftoverGroups, 'toco');
            secondaryLoads = tocoResultFromTQ.loads.map(l => ({ ...l, vehicleType: 'toco' }));
            leftoverGroups = tocoResultFromTQ.leftovers;
            break;
    }

    // ========================================================================
    // FIM DA NOVA LÃ“GICA DE CASCATA
    // ========================================================================

    const allPotentialLoads = [...primaryLoads, ...secondaryLoads, ...tertiaryLoads, ...quaternaryLoads];
    const finalValidLoads = [];
    let finalLeftoverGroups = [...leftoverGroups];

    allPotentialLoads.forEach(load => {
        const config = getVehicleConfig(load.vehicleType);
        if (!config) { // Adiciona uma verificaÃ§Ã£o para o caso de um tipo de veÃ­culo invÃ¡lido
            console.warn(`ConfiguraÃ§Ã£o nÃ£o encontrada para o tipo de veÃ­culo: ${load.vehicleType}. Descartando carga.`);
            const clientGroupsInFailedLoad = Object.values(load.pedidos.reduce((acc, p) => {
                const clienteId = normalizeClientId(p.Cliente);
                if (!acc[clienteId]) { acc[clienteId] = { pedidos: [], totalKg: 0, totalCubagem: 0, isSpecial: isSpecialClient(p) }; }
                acc[clienteId].pedidos.push(p);
                acc[clienteId].totalKg += p.Quilos_Saldo;
                acc[clienteId].totalCubagem += p.Cubagem;
                return acc;
            }, {}));
            finalLeftoverGroups.push(...clientGroupsInFailedLoad);
            return;
        }

        // A condiÃ§Ã£o volta a ser estrita para garantir que tentamos encher a carga primeiro
        if (load.totalKg >= config.minKg) {
            finalValidLoads.push(load);
        } else {
            const clientGroupsInFailedLoad = Object.values(load.pedidos.reduce((acc, p) => {
                const clienteId = normalizeClientId(p.Cliente);
                if (!acc[clienteId]) { acc[clienteId] = { pedidos: [], totalKg: 0, totalCubagem: 0, isSpecial: isSpecialClient(p) }; }
                acc[clienteId].pedidos.push(p);
                acc[clienteId].totalKg += p.Quilos_Saldo;
                acc[clienteId].totalCubagem += p.Cubagem;
                return acc;
            }, {}));
            finalLeftoverGroups.push(...clientGroupsInFailedLoad);
        }
    });

    finalValidLoads.forEach((load, index) => {
        load.numero = `${load.vehicleType.charAt(0).toUpperCase()}${index + 1}`;
        const loadId = `${load.vehicleType}-${Date.now()}-${index}`;
        load.id = loadId;
        load.routesKey = routesKey; // Vincula a carga ao processamento desta rota
        activeLoads[loadId] = load;
    });

    // CORREÃ‡ÃƒO: Isola as cargas geradas nesta execuÃ§Ã£o especÃ­fica para renderizaÃ§Ã£o.
    // Isso impede que cargas de processamentos anteriores sejam redesenhadas.
    const loadsGeneratedInThisRun = finalValidLoads;

    // Atualiza a lista de pedidos disponÃ­veis, removendo os que acabaram de ser alocados.
    const alocatedOrderIds = new Set(finalValidLoads.flatMap(load => load.pedidos.map(p => p.Num_Pedido)));
    pedidosGeraisAtuais = pedidosGeraisAtuais.filter(p => !alocatedOrderIds.has(p.Num_Pedido));

    // ATUALIZADO: A renderizaÃ§Ã£o agora Ã© centralizada, mas a lÃ³gica de foco na UI permanece.
    const gruposGeraisRestantes = pedidosGeraisAtuais.reduce((acc, p) => { const rota = p.Cod_Rota; if (!acc[rota]) { acc[rota] = { pedidos: [], totalKg: 0 }; } acc[rota].pedidos.push(p); acc[rota].totalKg += p.Quilos_Saldo; return acc; }, {});
    setTimeout(() => { // Adicionado um pequeno atraso para garantir que a UI esteja pronta
        const routeContext = {
            divId: divId,
            title: title,
            routesKey: routesKey,
            buttonId: buttonElement ? buttonElement.id : null
        };
        saveRouteContext(routeContext);

        // MOVED: Salva o estado aqui, APÃ“S o contexto da rota ter sido atualizado.
        // Isso garante que ao recarregar, saibamos onde exibir esta carga.
        saveStateToLocalStorage();
    }, 100);

    const vehicleInfo = {
        fiorino: { name: 'Fiorino', colorClass: 'bg-success', textColor: 'text-white', icon: 'bi-box-seam-fill' },
        van: { name: 'Van', colorClass: 'bg-primary', textColor: 'text-white', icon: 'bi-truck-front-fill' },
        tresQuartos: { name: '3/4', colorClass: 'bg-warning', textColor: 'text-dark', icon: 'bi-truck-flatbed' },
        toco: { name: 'Toco', colorClass: 'bg-secondary', textColor: 'text-white', icon: 'bi-inboxes-fill' }
    };

    let html = `<h5 class="mt-3">Cargas para <strong>${title}</strong></h5>`;

    // CORREÃ‡ÃƒO: Renderiza apenas as cargas geradas nesta execuÃ§Ã£o.
    if (loadsGeneratedInThisRun.length === 0) {
        html += `<div class="alert alert-secondary">Nenhuma carga foi formada para esta rota.</div>`;
    } else {
        loadsGeneratedInThisRun.forEach(load => {
            html += renderLoadCard(load, load.vehicleType, vehicleInfo[load.vehicleType] || vehicleInfo['van']);
        });
    }
    if (!isBatchMode) {
        resultadoDiv.innerHTML = `<div class="resultado-container">${html}</div>`;
    } else {
        resultadoDiv.insertAdjacentHTML('beforeend', `<div class="resultado-container">${html}</div>`);
    }

    // CORREÃ‡ÃƒO: As chamadas de atualizaÃ§Ã£o da UI foram movidas para o final,
    // e a chamada para `handlePostProcessingUI` foi ajustada para lidar com as sobras
    // desta execuÃ§Ã£o especÃ­fica.
    updateAndRenderKPIs();
    updateAndRenderChart();
    // CORREÃ‡ÃƒO: ForÃ§a a re-renderizaÃ§Ã£o dos botÃµes para garantir que o botÃ£o de reprocessar apareÃ§a.
    const gruposGerais = pedidosGeraisAtuais.reduce((acc, p) => { const rota = p.Cod_Rota; if (!acc[rota]) { acc[rota] = { pedidos: [], totalKg: 0 }; } acc[rota].pedidos.push(p); acc[rota].totalKg += p.Quilos_Saldo; return acc; }, {});
    displayGerais(document.getElementById('resultado-geral'), gruposGerais);
    displayGerais(document.getElementById('resultado-geral'), pedidosGeraisAtuais.reduce((acc, p) => { const rota = p.Cod_Rota; if (!acc[rota]) { acc[rota] = { pedidos: [], totalKg: 0 }; } acc[rota].pedidos.push(p); acc[rota].totalKg += p.Quilos_Saldo; return acc; }, {}));
    handlePostProcessingUI(finalLeftoverGroups, routeOrRoutes, title, divId); // CORREÃ‡ÃƒO: Chamada ajustada

}

function reprocessarRota(routesKey, event) {
    event.stopPropagation(); // Impede que o clique dispare a exibiÃ§Ã£o da rota

    if (!confirm(`Tem certeza que deseja reprocessar a rota ${routesKey}? As cargas atuais para esta rota serÃ£o desfeitas.`)) {
        return;
    }

    // 1. Encontrar as cargas associadas a esta rota
    // CORREÃ‡ÃƒO: Filtra apenas as cargas criadas por este processamento especÃ­fico (routesKey)
    const loadsToUndo = Object.values(activeLoads).filter(load =>
        load.routesKey === routesKey
    );

    if (loadsToUndo.length === 0) {
        showToast("Nenhuma carga encontrada para esta rota. Resetando o botÃ£o.", "info");
    }

    // 2. Coletar todos os pedidos das cargas a serem desfeitas
    const pedidosParaDevolver = loadsToUndo.flatMap(load => load.pedidos);

    // 3. Remover as cargas do `activeLoads`
    loadsToUndo.forEach(load => {
        delete activeLoads[load.id];
    });

    // 4. Devolver os pedidos para a lista de `pedidosGeraisAtuais`
    // CORREÃ‡ÃƒO: Evita duplicatas ao devolver pedidos para a lista de disponÃ­veis
    const currentIds = new Set(pedidosGeraisAtuais.map(p => String(p.Num_Pedido)));
    const uniquePedidos = pedidosParaDevolver.filter(p => !currentIds.has(String(p.Num_Pedido)));
    pedidosGeraisAtuais.push(...uniquePedidos);

    // 5. Remover a rota do conjunto de rotas processadas
    processedRoutes.delete(routesKey);
    delete processedRouteContexts[routesKey];

    // 6. Redesenhar a UI para refletir o estado atualizado
    // Limpa a visualizaÃ§Ã£o da rota se ela estiver sendo mostrada no momento
    const context = processedRouteContexts[routesKey];
    if (context) {
        const resultadoDiv = document.getElementById(context.divId);
        if (resultadoDiv) resultadoDiv.innerHTML = '';
    }
    renderAllUI();

    showToast(`Rota ${routesKey} pronta para ser reprocessada.`, "success");
}

function exibirCargasDaRota(routesKey) {
    const context = processedRouteContexts[routesKey];
    if (!context) return;

    const resultadoDiv = document.getElementById(context.divId);
    resultadoDiv.innerHTML = ''; // Limpa a Ã¡rea de resultado

    const vehicleInfo = {
        fiorino: { name: 'Fiorino', colorClass: 'bg-success', textColor: 'text-white', icon: 'bi-box-seam-fill' },
        van: { name: 'Van', colorClass: 'bg-primary', textColor: 'text-white', icon: 'bi-truck-front-fill' },
        tresQuartos: { name: '3/4', colorClass: 'bg-warning', textColor: 'text-dark', icon: 'bi-truck-flatbed' },
        toco: { name: 'Toco', colorClass: 'bg-secondary', textColor: 'text-white', icon: 'bi-inboxes-fill' }
    };

    // Encontra as cargas salvas para esta rota
    // CORREÃ‡ÃƒO: Filtra estritamente pelo routesKey para evitar mostrar Tocos ou cargas de outras rotas que compartilhem pedidos
    const loadsParaExibir = Object.values(activeLoads).filter(load =>
        load.routesKey === routesKey
    );

    let html = `<h5 class="mt-3">Cargas para <strong>${context.title}</strong></h5>`;
    if (loadsParaExibir.length > 0) {
        loadsParaExibir.forEach(load => {
            html += renderLoadCard(load, load.vehicleType, vehicleInfo[load.vehicleType] || vehicleInfo['van']);
        });
    }
    resultadoDiv.innerHTML = `<div class="resultado-container">${html}</div>`;
}

function roteirizarSobrasSP(leftoverPedidos) {
    if (!leftoverPedidos || leftoverPedidos.length === 0) {
        showToast("NÃ£o hÃ¡ sobras para roteirizar.", 'info');
        return;
    }

    const cidadesMap = new Map();
    leftoverPedidos.forEach(pedido => {
        const cidade = (String(pedido.Cidade || '')).split(',')[0].trim();
        const uf = (String(pedido.UF || '')).trim().toUpperCase();
        if (cidade && uf && !cidadesMap.has(cidade)) {
            cidadesMap.set(cidade, uf);
        }
    });

    const cidadesComEstado = Array.from(cidadesMap.entries());
    if (cidadesComEstado.length === 0) {
        showToast("Nenhuma cidade vÃ¡lida encontrada nas sobras para roteirizar.", 'warning');
        return;
    }

    const origem = "Empresa Selmi, BR-369, 86181-570 RolÃ¢ndia, ParanÃ¡, Brasil";
    const baseUrl = "https://graphhopper.com/maps/";
    const params = new URLSearchParams();
    params.append('point', origem);
    cidadesComEstado.forEach(([cidade, uf]) => params.append('point', `${cidade}, ${uf}, Brasil`));
    params.append('point', origem); // Ponto de chegada
    params.append('profile', 'car');
    params.append('layer', 'OpenStreetMap');
    window.open(`${baseUrl}?${params.toString()}`, '_blank');
}

function handlePostProcessingUI(sobras, rotasProcessadas, tituloRota, divId) {
    const allSobrasPedidos = sobras.flatMap(g => g.pedidos);

    const resultadoDiv = document.getElementById(divId);
    if (!resultadoDiv) return;

    const container = resultadoDiv.querySelector('.resultado-container');
    if (!container) return;

    // Limpa card de sobras anterior, se houver
    const oldLeftoversCard = container.querySelector('.leftovers-card');
    if (oldLeftoversCard) oldLeftoversCard.remove();

    // NOVO: Verifica se alguma carga foi realmente criada para esta rota.
    // Se nenhuma carga foi criada, nÃ£o mostra o card de sobras, apenas abre o acordeÃ£o.
    const loadsForThisRoute = Object.values(activeLoads).filter(load =>
        load.pedidos.some(p => rotasProcessadas.includes(String(p.Cod_Rota)))
    );
    const noLoadsCreated = loadsForThisRoute.length === 0;

    if (allSobrasPedidos.length > 0) {
        currentLeftoversForPrinting = allSobrasPedidos; // Atualiza a variÃ¡vel global de sobras
        const rotas = Array.isArray(rotasProcessadas) ? rotasProcessadas : [String(rotasProcessadas)];

        // CORREÃ‡ÃƒO DEFINITIVA: Identifica uma rota de SP se ela comeÃ§ar com '25', '26' ou '27'.
        // Isso garante que todas as rotas de varejo de SP, incluindo as novas, sejam capturadas.
        const isSaoPauloRoute = rotas.some(r =>
            String(r).startsWith('25') || String(r).startsWith('26') || String(r).startsWith('27'));

        // NOVO: Acumula as sobras de SP e habilita o botÃ£o de exportaÃ§Ã£o
        if (isSaoPauloRoute) {
            allSaoPauloLeftovers.push(...allSobrasPedidos);
            document.getElementById('export-sobras-sp-btn').disabled = false;
        }
        const finalLeftoverKg = allSobrasPedidos.reduce((sum, p) => sum + p.Quilos_Saldo, 0);
        const printButtonHtml = `<button class="btn btn-info ms-2 no-print" onclick="imprimirSobras('Sobras Finais de ${tituloRota}')"><i class="bi bi-printer-fill me-1"></i>Imprimir Sobras</button>`;

        // O card de sobras foi removido conforme solicitado. As sobras jÃ¡ estÃ£o visÃ­veis na lista de "DisponÃ­veis Varejo".

        // Se sobrou, encontra o acordeÃ£o da primeira rota processada e o abre
        const rotaPrincipal = rotas[0];
        const collapseElement = document.getElementById(`collapseGeral-${rotaPrincipal}`);
        if (collapseElement) {
            const bsCollapse = bootstrap.Collapse.getOrCreateInstance(collapseElement, { toggle: false });
            if (!collapseElement.classList.contains('show')) bsCollapse.show();
        }

    } else {
        // Se nÃ£o sobrou nada, significa que todos os pedidos foram alocados.
        // Mostra a mensagem de sucesso apenas se alguma carga foi criada.
        if (!noLoadsCreated) {
            const resultContainer = document.getElementById(divId);
            const successMessage = document.createElement('div');
            successMessage.className = 'alert alert-success alert-dismissible fade show mt-3 route-success-message';
            successMessage.role = 'alert';
            successMessage.innerHTML = `<strong>Sucesso!</strong> Todos os pedidos da rota <strong>${tituloRota}</strong> foram alocados. <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>`;

            // Insere a mensagem antes do container de resultados da rota.
            const parentContainer = resultContainer.closest('.tab-pane');
            parentContainer.querySelector('.no-print').insertAdjacentElement('afterend', successMessage);
        }
    }
}

function exportarSobrasSP_PDF() {
    if (allSaoPauloLeftovers.length === 0) {
        showToast("NÃ£o hÃ¡ sobras de rotas de SÃ£o Paulo para exportar.", 'info');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const title = "RelatÃ³rio de Sobras - Vans SÃ£o Paulo";
    const today = new Date().toLocaleDateString('pt-BR');

    doc.setFontSize(18);
    doc.text(title, 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Gerado em: ${today}`, 14, 30);

    const tableColumn = ["Cod Rota", "NÃºmero do Pedido", "Peso (kg)", "Cidade"];
    const tableRows = [];
    let totalWeight = 0;

    allSaoPauloLeftovers.forEach(pedido => {
        const weight = pedido.Quilos_Saldo || 0;
        totalWeight += weight;
        const pedidoData = [
            String(pedido.Cod_Rota || ''),
            String(pedido.Num_Pedido || ''),
            weight.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
            String(pedido.Cidade || '')
        ];
        tableRows.push(pedidoData);
    });

    // Adiciona a linha de rodapÃ© com os totais
    const footerRow = [
        { content: `Total de Pedidos: ${allSaoPauloLeftovers.length}`, colSpan: 2, styles: { fontStyle: 'bold', halign: 'right' } },
        { content: totalWeight.toLocaleString('pt-BR', { minimumFractionDigits: 2 }), styles: { fontStyle: 'bold' } },
        { content: '', styles: {} }
    ];
    tableRows.push(footerRow);

    doc.autoTable({ head: [tableColumn], body: tableRows, startY: 35, theme: 'striped' });
    doc.save("Sobras_Vans_SP.pdf");
}

async function runExpertOptimizer(packableGroups, vehicleType) {
    console.log(`Executando NÃ­vel 2: OtimizaÃ§Ã£o Especialista para ${vehicleType}...`);

    // Fase 1: OtimizaÃ§Ã£o principal com Recozimento Simulado
    const saResult = await runSimulatedAnnealing(packableGroups, vehicleType, 'Otimizando... (Fase 1/3: AnÃ¡lise Profunda)');

    // Fase 2: Tenta reconstruir a pior carga para melhorar a soluÃ§Ã£o
    document.getElementById('processing-status-text').textContent = 'Otimizando... (Fase 2/3: ReconstruÃ§Ã£o)';
    document.getElementById('thinking-text').textContent = 'Analisando e reestruturando cargas ineficientes.';
    const reconstructed = await refinarComReconstrucao(saResult.loads, saResult.leftovers, vehicleType);

    // Fase 3: Faz um polimento final, tentando trocar sobras com itens de menor peso nas cargas
    document.getElementById('processing-status-text').textContent = 'Otimizando... (Fase 3/3: Polimento Final)';
    document.getElementById('thinking-text').textContent = 'Buscando Ãºltimas oportunidades de encaixe.';
    return refinarCargasComTrocas(reconstructed.refinedLoads, reconstructed.remainingLeftovers, vehicleType);
}

function refineLoadsWithSimpleFit(initialLoads, initialLeftovers) {
    let refinedLoads = deepClone(initialLoads);
    let remainingLeftovers = deepClone(initialLeftovers);

    for (let i = remainingLeftovers.length - 1; i >= 0; i--) {
        const leftoverGroup = remainingLeftovers[i];

        for (const load of refinedLoads) {
            const vehicleType = load.vehicleType;
            if (!vehicleType) continue;

            if (isMoveValid(load, leftoverGroup, vehicleType)) {
                load.pedidos.push(...leftoverGroup.pedidos);
                load.totalKg += leftoverGroup.totalKg;
                load.totalCubagem += leftoverGroup.totalCubagem;

                remainingLeftovers.splice(i, 1);
                break;
            }
        }
    }
    return { refinedLoads, remainingLeftovers };
}

async function refinarComReconstrucao(initialLoads, initialLeftovers, vehicleType) {
    let loads = deepClone(initialLoads);
    let leftovers = deepClone(initialLeftovers);

    if (loads.length < 2) {
        console.log("POLIMENTO (NÃ­vel 4): Poucas cargas para reconstruir. Pulando etapa.");
        return { refinedLoads: loads, remainingLeftovers: leftovers };
    }


    loads.sort((a, b) => a.totalKg - b.totalKg);
    const worstLoad = loads[0];

    const config = getVehicleConfig(vehicleType);
    if (worstLoad.totalKg >= config.softMaxKg) {
        console.log("POLIMENTO (NÃ­vel 4): A carga menos cheia jÃ¡ estÃ¡ bem otimizada. Pulando etapa.");
        return { refinedLoads: initialLoads, remainingLeftovers: initialLeftovers };
    }


    const groupsToReallocate = Object.values(worstLoad.pedidos.reduce((acc, p) => {
        const cId = normalizeClientId(p.Cliente);
        if (!acc[cId]) acc[cId] = { pedidos: [], totalKg: 0, totalCubagem: 0, isSpecial: isSpecialClient(p) };
        acc[cId].pedidos.push(p);
        acc[cId].totalKg += p.Quilos_Saldo;
        acc[cId].totalCubagem += p.Cubagem;
        return acc;
    }, {}));

    const newLeftovers = [...leftovers, ...groupsToReallocate];
    const remainingLoads = loads.slice(1);


    const { refinedLoads: reconstructedLoads, remainingLeftovers: finalLeftovers } = refineLoadsWithSimpleFit(remainingLoads, newLeftovers);

    const originalSobras = initialLeftovers.reduce((sum, g) => sum + g.totalKg, 0);
    const newSobras = finalLeftovers.reduce((sum, g) => sum + g.totalKg, 0);

    if (newSobras < originalSobras) {
        console.log(`POLIMENTO (NÃ­vel 4): ReconstruÃ§Ã£o bem-sucedida! Sobra reduzida de ${originalSobras.toFixed(2)}kg para ${newSobras.toFixed(2)}kg.`);
        return { refinedLoads: reconstructedLoads, remainingLeftovers: finalLeftovers };
    } else {
        console.log("POLIMENTO (NÃ­vel 4): ReconstruÃ§Ã£o nÃ£o melhorou o resultado. Revertendo.");
        return { refinedLoads: initialLoads, remainingLeftovers: initialLeftovers };
    }
}

function saveObservation(event, loadId) {
    event.stopPropagation(); // Impede que outros eventos de clique sejam disparados
    const textarea = document.getElementById(`obs-textarea-${loadId}`);
    if (activeLoads[loadId] && textarea) {
        activeLoads[loadId].observation = textarea.value;
        saveStateToLocalStorage();
        toggleObservationEdit(loadId, false);
    }
}

function toggleObservationEdit(loadId, editMode) {
    const container = document.getElementById(`obs-container-${loadId}`);
    if (!container) return;

    const observationText = activeLoads[loadId]?.observation || '';
    if (editMode) {
        container.innerHTML = `
                    <textarea id="obs-textarea-${loadId}" class="form-control form-control-sm" rows="2" placeholder="Ex: Ligar para o cliente antes...">${observationText}</textarea>
                    <div class="mt-2">
                        <button class="btn btn-sm btn-success" onclick="saveObservation(event, '${loadId}')"><i class="bi bi-check-circle me-1"></i>Salvar</button>
                        <button class="btn btn-sm btn-secondary" onclick="toggleObservationEdit('${loadId}', false)"><i class="bi bi-x-circle me-1"></i>Cancelar</button>
                    </div>
                `;
    } else {
        if (observationText) {
            container.innerHTML = `
                        <p class="form-control-plaintext form-control-sm small p-2 border rounded" style="white-space: pre-wrap; background-color: var(--dark-bg);">${observationText}</p>
                        <div class="mt-2">
                            <button class="btn btn-sm btn-outline-secondary" onclick="toggleObservationEdit('${loadId}', true)"><i class="bi bi-pencil me-1"></i>Editar</button>
                            <button class="btn btn-sm btn-outline-danger" onclick="deleteObservation('${loadId}')"><i class="bi bi-trash me-1"></i>Excluir</button>
                        </div>
                    `;
        } else {
            container.innerHTML = `<button class="btn btn-sm btn-outline-info" onclick="toggleObservationEdit('${loadId}', true)"><i class="bi bi-plus-circle me-1"></i>Adicionar ObservaÃ§Ã£o</button>`;
        }
    }
}

function deleteObservation(loadId) {
    if (activeLoads[loadId] && confirm('Tem certeza que deseja excluir esta observaÃ§Ã£o?')) {
        activeLoads[loadId].observation = '';
        saveStateToLocalStorage();
        toggleObservationEdit(loadId, false);
    }
}

function renderLoadCard(load, vehicleType, vInfo) {
    load.pedidos.sort((a, b) => {
        const clienteA = String(a.Cliente); const clienteB = String(b.Cliente);
        const pedidoA = String(a.Num_Pedido); const pedidoB = String(b.Num_Pedido);
        const clienteCompare = clienteA.localeCompare(clienteB, undefined, { numeric: true });
        if (clienteCompare !== 0) return clienteCompare;
        return pedidoA.localeCompare(pedidoB, undefined, { numeric: true });
    });

    const totalKgFormatado = load.totalKg.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const totalCubagemFormatado = (load.totalCubagem || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const isPriorityLoad = load.pedidos.some(p => pedidosPrioritarios.includes(String(p.Num_Pedido)) || pedidosRecall.includes(String(p.Num_Pedido)));

    const distanciaHtml = `<span id="distancia-${load.id}" class="ms-2 badge bg-dark border border-secondary text-secondary fw-normal"></span>`;

    const priorityBadge = isPriorityLoad ? '<span class="badge bg-warning text-dark ms-2"><i class="bi bi-star-fill"></i> Prioridade</span>' : '';
    const hardLimitBadge = load.usedHardLimit ? '<span class="badge bg-danger ms-2"><i class="bi bi-exclamation-triangle-fill"></i> Excesso</span>' : '';
    const isSaoPauloRoute = load.pedidos.some(p => ['2555', '2560', '2561', '2571', '2575', '2705', '2735', '2745'].includes(String(p.Cod_Rota)));
    const spDescription = isSaoPauloRoute ? ' <span class="badge bg-info text-dark ms-1">SP</span>' : '';

    const config = getVehicleConfig(vehicleType);
    const maxKg = config.hardMaxKg;

    const isOverloaded = maxKg > 0 && load.totalKg > maxKg;
    const pesoPercentual = maxKg > 0 ? (load.totalKg / maxKg) * 100 : 0;
    let progressColor = 'bg-primary';
    if (isOverloaded || pesoPercentual > 100) progressColor = 'bg-danger'; // Acima do limite rígido
    else if (pesoPercentual > (config.softMaxKg / maxKg * 100)) progressColor = 'bg-warning'; // Acima do preferencial
    else if (pesoPercentual >= (config.minKg / maxKg * 100)) progressColor = 'bg-success'; // Acima do mínimo
    else progressColor = 'bg-secondary'; // Abaixo do mínimo

    const progressBar = `
                <div class="progress" role="progressbar" aria-label="Capacidade" style="height: 4px; border-radius: 0; background-color: rgba(0,0,0,0.1);">
                  <div class="progress-bar ${progressColor}" style="width: ${Math.min(pesoPercentual, 100)}%"></div>
                </div>`;

    const vehicleSelectDropdown = `
                <select class="form-select form-select-sm border-0 bg-transparent text-secondary fw-bold py-0 ps-0 pe-4" style="width: auto; cursor: pointer; font-size: 0.8rem;" onchange="changeLoadVehicleType('${load.id}', this.value)">
                    <option value="fiorino" ${vehicleType === 'fiorino' ? 'selected' : ''}>Fiorino</option>
                    <option value="van" ${vehicleType === 'van' ? 'selected' : ''}>Van</option>
                    <option value="tresQuartos" ${vehicleType === 'tresQuartos' ? 'selected' : ''}>3/4</option>
                    <option value="toco" ${vehicleType === 'toco' ? 'selected' : ''}>Toco</option>
                </select>`;

    const observationForPrint = ` 
                <div class="print-only-observation mt-2 p-2 border rounded" style="background-color: #f8f9fa; display: none;">
                    <p class="mb-0"></p>
                </div>`;

    const observationText = load.observation || '';
    let initialObservationHtml;
    if (observationText) {
        initialObservationHtml = `
                    <div class="alert alert-secondary d-flex justify-content-between align-items-center p-2 mb-0 mt-2">
                        <small class="text-truncate" style="max-width: 80%;"><i class="bi bi-info-circle me-1"></i>${observationText}</small>
                        <div>
                            <button class="btn btn-link btn-sm p-0 text-secondary me-2" onclick="toggleObservationEdit('${load.id}', true)"><i class="bi bi-pencil"></i></button>
                            <button class="btn btn-link btn-sm p-0 text-danger" onclick="deleteObservation('${load.id}')"><i class="bi bi-trash"></i></button>
                        </div>
                    </div>`;
    } else {
        initialObservationHtml = `<button class="btn btn-sm btn-link text-decoration-none text-muted p-0 mt-2" style="font-size: 0.8rem;" onclick="toggleObservationEdit('${load.id}', true)"><i class="bi bi-plus-circle me-1"></i>Adicionar Obs</button>`;
    }

    let titleColorClass = 'text-body';
    if (vehicleType === 'fiorino') titleColorClass = 'text-success';
    else if (vehicleType === 'van') titleColorClass = 'text-primary';
    else if (vehicleType === 'tresQuartos') titleColorClass = 'text-warning';

    // --- NOVA LÃ“GICA: Identificar Data Mais Antiga (Predat) ---
    let oldestDate = null;
    let oldestOrders = [];

    load.pedidos.forEach(p => {
        if (!p.Predat) return;
        let pDate = p.Predat instanceof Date ? p.Predat : new Date(p.Predat);
        if (isNaN(pDate.getTime())) return;

        // Normaliza para comparar apenas a data (zera horas)
        const pDateOnly = new Date(pDate.getFullYear(), pDate.getMonth(), pDate.getDate());

        if (oldestDate === null || pDateOnly < oldestDate) {
            oldestDate = pDateOnly;
            oldestOrders = [p.Num_Pedido];
        } else if (pDateOnly.getTime() === oldestDate.getTime()) {
            oldestOrders.push(p.Num_Pedido);
        }
    });

    let oldestDateHtml = '';
    if (oldestDate) {
        const dateStr = oldestDate.toLocaleDateString('pt-BR');
        const ordersStr = oldestOrders.join(', ');
        // Estilo destacado para chamar atenÃ§Ã£o do motorista/expediÃ§Ã£o
        oldestDateHtml = `
                    <div class="mt-2 pt-2 border-top border-secondary-subtle">
                        <div class="d-flex align-items-center text-warning-emphasis">
                            <i class="bi bi-calendar-event-fill me-2 fs-5"></i>
                            <div>
                                <span class="fw-bold d-block" style="line-height: 1.2;">Prazo Máximo de Entrega: ${dateStr}</span>
                                <span class="small text-muted">Ref. Pedido(s): ${ordersStr}</span>
                            </div>
                        </div>
                    </div>`;
    }
    // --- FIM NOVA LÃ“GICA ---

    // --- NOVO: BotÃ£o de aÃ§Ã£o modificado para toggle de mapa e container oculto ---
    return `<div id="${load.id}" class="load-card vehicle-${vehicleType} drop-zone-card ${isPriorityLoad ? 'shadow-lg' : ''}" ondragover="dragOver(event)" ondragleave="dragLeave(event)" ondrop="drop(event)" data-load-id="${load.id}" data-vehicle-type="${vehicleType}">
                        <div class="load-card-header">
                            <div class="d-flex flex-column">
                                <div class="load-title ${titleColorClass}">
                                    <i class="bi ${vInfo.icon} me-2"></i>${vInfo.name} #${load.numero}${spDescription}
                                    ${priorityBadge} ${hardLimitBadge}
                                </div>
                                <div class="load-meta">
                                    <span class="load-meta-item" title="Peso Total"><i class="bi bi-database"></i> ${totalKgFormatado} kg</span>
                                    <span class="load-meta-item" title="Cubagem Total"><i class="bi bi-rulers"></i> ${totalCubagemFormatado} m³</span>
                                    ${distanciaHtml}
                                    <span id="freight-${load.id}" class="load-meta-item badge bg-success text-white border border-success fw-bold ms-2 ${load.freightValue ? '' : 'd-none'}" title="Valor Estimado do Frete">
                                        ${load.freightValue ? `<i class="bi bi-cash-stack me-1"></i>R$ ${Number(load.freightValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ''}
                                    </span>
                                </div>
                            </div>
                            <div class="d-flex flex-column align-items-end gap-1">
                                <div class="no-print mb-1">${vehicleSelectDropdown}</div>
                                <div class="load-actions no-print">
                                    <button class="btn-icon-action" onclick="showRouteOnMap('${load.id}')" title="Ver Rota no Mapa"><i class="bi bi-map-fill"></i></button>
                                    <button class="btn-icon-action" onclick="abrirMapaCarga('${load.id}')" title="Google Maps (Externo)"><i class="bi bi-box-arrow-up-right"></i></button>
                                    <button class="btn-icon-action" onclick="imprimirCargaIndividual('${load.id}')" title="Imprimir"><i class="bi bi-printer"></i></button>
                                </div>
                            </div>
                        </div>
                        ${progressBar}
                        <div class="card-body p-0">
                            <div class="px-3 pt-2 pb-3">
                                <div class="no-print" id="obs-container-${load.id}">${initialObservationHtml}</div>
                                ${observationForPrint}
                                
                                <div class="mt-2">${createTable(load.pedidos, null, load.id)}</div>
                                ${oldestDateHtml}
                            </div>
                        </div>
                    </div>`;
}



async function calculateManualRoute() {
    const citiesInput = document.getElementById('manualRoutingCities').value;
    const cities = citiesInput.split('\n').map(c => c.trim()).filter(Boolean);

    if (cities.length === 0) {
        showToast("Por favor, insira pelo menos uma cidade.", 'warning');
        return;
    }

    const origem = "Empresa Selmi, BR-369, 86181-570 RolÃ¢ndia, ParanÃ¡, Brasil";
    const destino = origem; // A rota retorna para a origem
    const baseUrl = "https://graphhopper.com/maps/";
    const params = new URLSearchParams();

    params.append('point', origem);
    cities.forEach(cidade => {
        params.append('point', cidade);
    });
    params.append('point', destino);

    params.append('profile', 'car');
    params.append('layer', 'OpenStreetMap');

    const url = `${baseUrl}?${params.toString()}`;

    // Abre a URL em uma nova aba
    window.open(url, '_blank');

    // Fecha o modal apÃ³s abrir a nova aba
    const manualRoutingModalEl = document.getElementById('manualRoutingModal');
    const manualRoutingModal = bootstrap.Modal.getInstance(manualRoutingModalEl);
    if (manualRoutingModal) {
        manualRoutingModal.hide();
    }
}

async function calcularDistanciaCarga(loadId, retries = 2) {
    const apiKey = document.getElementById('graphhopperApiKey').value;
    if (!apiKey) {
        showToast("Insira sua chave da API do GraphHopper nas ConfiguraÃ§Ãµes.", 'warning');
        // Abre o modal de configuraÃ§Ãµes
        const configModal = new bootstrap.Modal(document.getElementById('configModal'));
        configModal.show();
        return;
    }

    const load = activeLoads[loadId];
    if (!load) {
        showToast("Carga nÃ£o encontrada.", 'error');
        return;
    }

    const kmBtn = document.getElementById(`btn-km-${loadId}`);
    const distanciaSpan = document.getElementById(`distancia-${load.id}`);

    // Mostra feedback de carregamento
    if (kmBtn) {
        kmBtn.disabled = true;
        kmBtn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Calculando...`;
    }
    if (distanciaSpan) distanciaSpan.innerHTML = '';

    // Extrai cidades Ãºnicas com seus respectivos estados (UF) para maior precisÃ£o,
    // buscando os dados completos na planilha original para garantir que 'Cidade' e 'UF' existam.
    const cidadesMap = new Map();
    const pedidoIdsNaCarga = new Set(load.pedidos.map(p => String(p.Num_Pedido)));

    planilhaData.forEach(pedidoOriginal => {
        if (pedidoIdsNaCarga.has(String(pedidoOriginal.Num_Pedido))) {
            const cidade = (String(pedidoOriginal.Cidade || '')).split(',')[0].trim();
            const uf = (String(pedidoOriginal.UF || '')).trim().toUpperCase();

            if (cidade && uf) {
                // Usa a cidade como chave para evitar duplicatas.
                // Assume que uma carga nÃ£o terÃ¡ a mesma cidade em estados diferentes.
                if (!cidadesMap.has(cidade)) {
                    cidadesMap.set(cidade, uf);
                }
            }
        }
    });
    const cidadesComEstado = Array.from(cidadesMap.entries());

    if (cidadesComEstado.length === 0) {
        if (kmBtn) {
            kmBtn.disabled = false;
            kmBtn.innerHTML = `<i class="bi bi-calculator-fill me-1"></i>Calcular KM`;
        }
        showToast("Nenhuma cidade vÃ¡lida encontrada para roteirizar.", 'warning');
        return;
    }

    // Ponto de partida e chegada fixo
    const origem = "Empresa Selmi, BR-369, 86181-570 RolÃ¢ndia, ParanÃ¡, Brasil";

    try {
        // 1. Geocodificar a origem (com cache)
        let origemPoint;
        if (origemCoords) {
            console.log("Usando coordenadas da origem do cache.");
            origemPoint = origemCoords;
        } else {
            console.log("Buscando coordenadas da origem pela primeira vez...");
            const origemResponse = await fetch(`https://graphhopper.com/api/1/geocode?q=${encodeURIComponent(origem)}&key=${apiKey}`);
            if (!origemResponse.ok) {
                throw new Error(`Falha ao buscar coordenadas da origem. Status: ${origemResponse.status}`);
            }
            const origemData = await origemResponse.json();
            if (!origemData.hits || origemData.hits.length === 0) {
                throw new Error("NÃ£o foi possÃ­vel encontrar as coordenadas da origem (Empresa Selmi). Verifique o endereÃ§o ou a chave da API.");
            }
            origemPoint = origemData.hits[0].point;
            origemCoords = origemPoint; // Salva em cache para uso futuro
        }

        // 2. Geocodificar os destinos (cidades)
        const locations = [{ id: "start", name: "Origem", ...origemPoint }];
        for (const [cidade, uf] of cidadesComEstado) {
            const query = `${cidade}, ${uf}, Brasil`;
            const locResponse = await fetch(`https://graphhopper.com/api/1/geocode?q=${encodeURIComponent(query)}&key=${apiKey}`);
            const locData = await locResponse.json();
            if (locData.hits && locData.hits.length > 0) {
                locations.push({ id: cidade, name: cidade, ...locData.hits[0].point });
            }
        }

        // 3. Montar e chamar a API de OtimizaÃ§Ã£o de Rota
        const requestBody = {
            vehicles: [{ vehicle_id: 'veiculo_1', start_address: { location_id: 'start', lon: origemPoint.lng, lat: origemPoint.lat } }],
            services: locations.slice(1).map(loc => ({
                id: loc.id,
                name: loc.name,
                address: { location_id: loc.id, lon: loc.lng, lat: loc.lat }
            })),
            objectives: [{ type: "min-max", value: "completion_time" }]
        };

        const routeResponse = await fetch(`https://graphhopper.com/api/1/vrp?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        const routeData = await routeResponse.json();
        if (routeData.status !== 'finished') throw new Error(`O cÃ¡lculo da rota falhou: ${routeData.message || 'Erro desconhecido'}`);

        const totalDistanceMeters = routeData.solution.distance;
        const totalDistanceKm = (totalDistanceMeters / 1000).toFixed(1);

        // 4. Atualizar o card com a distÃ¢ncia
        if (distanciaSpan) {
            distanciaSpan.innerHTML = `<i class="bi bi-geo-alt-fill me-1"></i><strong>${totalDistanceKm} km</strong> (ida e volta)`;
        }

        // NOVO: Atualiza o frete assim que o KM é calculado
        if (typeof updateLoadFreightDisplay === 'function') {
            updateLoadFreightDisplay(loadId, totalDistanceKm);
        }

    } catch (error) {
        console.error("Erro ao roteirizar:", error);
        // Se a falha foi na origem e ainda temos tentativas, limpa o cache e tenta de novo.
        if (error.message.includes("origem") && retries > 0) {
            console.warn(`Falha na origem. Limpando cache e tentando novamente... (${retries} tentativas restantes)`);
            origemCoords = null; // Limpa o cache para forÃ§ar uma nova busca
            return calcularDistanciaCarga(loadId, retries - 1);
        }
        showToast(`Falha ao calcular a rota: ${error.message}`, 'error');
        if (distanciaSpan) distanciaSpan.innerHTML = `<span class="text-danger small">Falha no cÃ¡lculo</span>`;
    } finally {
        // Restaura o botÃ£o
        if (kmBtn) {
            kmBtn.disabled = false;
            kmBtn.innerHTML = `<i class="bi bi-calculator-fill me-1"></i>Calcular KM`;
        }
    }
}



// VariÃ¡vel global para a instÃ¢ncia do mapa no modal
let mapInstance = null;

async function showRouteOnMap(loadId) {
    const mapModalEl = document.getElementById('mapModal');
    const mapModal = bootstrap.Modal.getOrCreateInstance(mapModalEl);
    const mapContainer = document.getElementById('map-container'); // Container do mapa dentro do modal
    const mapStatus = document.getElementById('map-status');
    const mapTitle = document.getElementById('mapModalTitle');

    // Limpa estado anterior
    currentRouteInfo = {};
    mapStatus.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> Carregando...';
    // NÃ£o limpe o innerHTML do container para nÃ£o destruir o elemento que o Leaflet usa, se possÃ­vel, ou recrie
    if (mapInstance) {
        mapInstance.remove();
        mapInstance = null;
    }
    mapContainer.innerHTML = '';

    const load = activeLoads[loadId];
    if (load) {
        mapTitle.textContent = `Rota - Carga ${load.numero || load.id}`;
    }

    mapModal.show();

    const apiKey = document.getElementById('graphhopperApiKey').value;
    if (!apiKey) {
        mapStatus.innerHTML = '<span class="text-danger">API Key nÃ£o configurada.</span>';
        mapContainer.innerHTML = '<div class="d-flex align-items-center justify-content-center h-100 text-danger">API Key do GraphHopper necessÃ¡ria.</div>';
        return;
    }

    if (!load || !load.pedidos || load.pedidos.length === 0) {
        mapStatus.innerHTML = '<span class="text-warning">Sem pedidos na carga.</span>';
        return;
    }

    try {
        // 1. Origem
        if (!origemCoords) {
            const origemResponse = await fetch(`https://graphhopper.com/api/1/geocode?q=${encodeURIComponent("Empresa Selmi, RolÃ¢ndia, ParanÃ¡")}&key=${apiKey}`);
            const origemData = await origemResponse.json();
            if (!origemData.hits || origemData.hits.length === 0) throw new Error("Origem nÃ£o encontrada.");
            origemCoords = { lat: origemData.hits[0].point.lat, lng: origemData.hits[0].point.lng };
        }

        // 2. Destinos
        const locations = [{ name: "Origem (Selmi)", coords: origemCoords, isOrigin: true }];
        const uniqueCities = [...new Set(load.pedidos.map(p => `${p.Cidade}, ${p.UF}`))];
        const delay = ms => new Promise(res => setTimeout(res, ms));

        for (const city of uniqueCities) {
            const cleanedCity = city.replace(/\s+/g, ' ').trim();
            const geoResponse = await fetch(`https://graphhopper.com/api/1/geocode?q=${encodeURIComponent(cleanedCity)}&key=${apiKey}`);
            const geoData = await geoResponse.json();
            if (geoData.hits && geoData.hits.length > 0) {
                locations.push({ name: city, coords: { lat: geoData.hits[0].point.lat, lng: geoData.hits[0].point.lng } });
            }
            await delay(250);
        }

        if (locations.length <= 1) {
            mapStatus.innerHTML = '<span class="text-warning">Destinos nÃ£o encontrados.</span>';
            return;
        }

        // 3. Inicializa Mapa
        mapInstance = L.map(mapContainer).setView(origemCoords, 6);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(mapInstance);

        const bounds = L.latLngBounds();
        locations.forEach((loc, index) => {
            const marker = L.marker(loc.coords).addTo(mapInstance).bindPopup(`<b>${loc.name}</b>`);
            if (loc.isOrigin) {
                marker.setIcon(L.icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png', shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png', iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41] }));
            }
            bounds.extend(loc.coords);
        });

        // 4. Rota
        const useOptimization = locations.length <= 5;
        let orderedLocations = [...locations];
        let routeUrl;

        if (useOptimization) {
            const points = orderedLocations.map(loc => `point=${loc.coords.lat},${loc.coords.lng}`);
            points.push(`point=${origemCoords.lat},${origemCoords.lng}`);
            routeUrl = `https://graphhopper.com/api/1/route?${points.join('&')}&vehicle=car&key=${apiKey}&points_encoded=true&optimize=true`;
        } else {
            const dests = orderedLocations.slice(1).sort((a, b) => a.name.localeCompare(b.name));
            orderedLocations = [orderedLocations[0], ...dests];
            const points = orderedLocations.map(loc => `point=${loc.coords.lat},${loc.coords.lng}`);
            points.push(`point=${origemCoords.lat},${origemCoords.lng}`);
            routeUrl = `https://graphhopper.com/api/1/route?${points.join('&')}&vehicle=car&key=${apiKey}&points_encoded=true&optimize=false`;
        }

        const resp = await fetch(routeUrl);
        const data = await resp.json();

        if (data.paths && data.paths.length > 0) {
            const path = data.paths[0];
            const decoded = decodePolyline(path.points);
            L.polyline(decoded, { color: 'blue', weight: 4, opacity: 0.7 }).addTo(mapInstance);
            mapInstance.fitBounds(bounds, { padding: [50, 50] });

            const distKm = (path.distance / 1000).toFixed(1);
            const timeStr = formatTime(path.time);
            mapStatus.innerHTML = `<span class="text-success fw-bold">DistÃ¢ncia: ${distKm} km | Tempo: ${timeStr}</span>`;

            // Info para WhatsApp
            const allPoints = orderedLocations.map(l => `${l.coords.lat},${l.coords.lng}`);
            allPoints.push(`${orderedLocations[0].coords.lat},${orderedLocations[0].coords.lng}`);
            currentRouteInfo = {
                loadName: `Carga ${load.numero}`,
                stops: orderedLocations.slice(1).map(l => l.name),
                googleMapsUrl: `https://www.google.com/maps/dir/${allPoints.join('/')}`,
                distancia: distKm,
                tempo: timeStr
            };

            // NOVO: Atualiza o frete assim que a rota é exibida/calculada no mapa
            if (typeof updateLoadFreightDisplay === 'function') {
                updateLoadFreightDisplay(loadId, distKm);
            }
        } else {
            mapStatus.innerHTML = '<span class="text-danger">NÃ£o foi possÃ­vel traÃ§ar a rota.</span>';
        }

        // ForÃ§a resize do mapa apÃ³s modal abrir totalmente
        setTimeout(() => { mapInstance.invalidateSize(); }, 500);

    } catch (e) {
        console.error("Erro mapa modal:", e);
        mapStatus.innerHTML = `<span class="text-danger">Erro: ${e.message}</span>`;
    }
}


function abrirMapaCarga(loadId) {
    const load = activeLoads[loadId];
    if (!load) {
        showToast("Carga nÃ£o encontrada.", 'error');
        return;
    }

    const cidadesMap = new Map();
    const pedidoIdsNaCarga = new Set(load.pedidos.map(p => String(p.Num_Pedido)));

    planilhaData.forEach(pedidoOriginal => {
        if (pedidoIdsNaCarga.has(String(pedidoOriginal.Num_Pedido))) {
            const cidade = (String(pedidoOriginal.Cidade || '')).split(',')[0].trim();
            const uf = (String(pedidoOriginal.UF || '')).trim().toUpperCase();
            if (cidade && uf && !cidadesMap.has(cidade)) {
                cidadesMap.set(cidade, uf);
            }
        }
    });
    const cidadesComEstado = Array.from(cidadesMap.entries());

    if (cidadesComEstado.length === 0) {
        showToast("Nenhuma cidade vÃ¡lida encontrada para roteirizar.", 'warning');
        return;
    }

    const origem = "Empresa Selmi, BR-369, 86181-570 RolÃ¢ndia, ParanÃ¡, Brasil";
    const destino = origem;
    const baseUrl = "https://graphhopper.com/maps/";
    const params = new URLSearchParams();
    params.append('point', origem);
    cidadesComEstado.forEach(([cidade, uf]) => { let pontoParada = `${cidade}, ${uf}, Brasil`; if (cidade.toLowerCase().trim() === 'rolÃ¢ndia') { pontoParada = `Centro, RolÃ¢ndia, ${uf}, Brasil`; } params.append('point', pontoParada); });
    params.append('point', destino);
    // Usa 'car' como perfil de veÃ­culo padrÃ£o para roteirizaÃ§Ã£o.
    const url = `${baseUrl}?${params.toString()}&profile=car&layer=OpenStreetMap`;

    // Abre a URL em uma nova aba
    window.open(url, '_blank');
}

/**
 * Decodifica uma string de polilinha (formato do Google/GraphHopper) em um array de coordenadas.
 * @param {string} str A string da polilinha codificada.
 * @returns {Array<[number, number]>} Um array de pares [latitude, longitude].
 */
function decodePolyline(str) {
    let index = 0, lat = 0, lng = 0, array = [];
    let shift = 0, result = 0, byte, latitude_change, longitude_change;
    const factor = Math.pow(10, 5);

    while (index < str.length) {
        byte = null; shift = 0; result = 0;
        do {
            byte = str.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);

        latitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lat += latitude_change;

        shift = 0; result = 0;
        do {
            byte = str.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);

        longitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lng += longitude_change;

        array.push([lat / factor, lng / factor]);
    }
    return array;
}

/**
 * Formata milissegundos em uma string legÃ­vel de horas e minutos.
 * @param {number} millis - O tempo em milissegundos.
 * @returns {string} O tempo formatado (ex: "2h 30min").
 */
function formatTime(millis) {
    if (!millis || millis < 0) return "0min";
    const totalMinutes = Math.floor(millis / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    let result = '';
    if (hours > 0) result += `${hours}h `;
    if (minutes > 0 || hours === 0) result += `${minutes}min`;
    return result.trim();
}

/**
 * NOVO: Prepara e imprime o conteÃºdo do modal do mapa.
 */
function printMap() {
    const mapModal = document.getElementById('mapModal');
    if (!mapModal) return;

    // Adiciona uma classe ao body para controlar a visibilidade na impressÃ£o
    document.body.classList.add('print-map-active');

    // Usa um pequeno timeout para garantir que o CSS seja aplicado antes da impressÃ£o
    setTimeout(() => {
        window.print();
        // Remove a classe apÃ³s a impressÃ£o ser acionada
        document.body.classList.remove('print-map-active');
    }, 250);
}

/**
 * NOVO: Compartilha a rota atual no WhatsApp.
 */
function shareRouteOnWhatsApp() {
    if (!currentRouteInfo || !currentRouteInfo.loadName) {
        showToast("Nenhuma informaÃ§Ã£o de rota para compartilhar. Calcule a rota primeiro.", 'warning');
        return;
    }

    const { loadName, stops, googleMapsUrl, distancia, tempo } = currentRouteInfo;

    let message = `*PrevisÃ£o de Rota - ${loadName}*\n\n`;
    message += `*Paradas:*\n`;
    stops.forEach((stop, index) => {
        message += `${index + 1}. ${stop}\n`;
    });
    message += `\n*DistÃ¢ncia Total:* ${distancia} km`;
    message += `\n*Tempo Estimado:* ${tempo}`;
    message += `\n\n*Ver no Mapa:*\n${googleMapsUrl}`;

    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
}






// ... (cÃ³digo existente) ...

function displayToco(div, grupos) {
    if (Object.keys(grupos).length === 0) { div.innerHTML = '<div class="empty-state"><i class="bi bi-inboxes-fill"></i><p>Nenhuma carga "Toco" encontrada.</p></div>'; return; }

    const maxKg = parseFloat(document.getElementById('tocoMaxCapacity').value);
    let accordionHtml = '<div class="accordion accordion-flush" id="accordionTocoMesa">'; // ID alterado para evitar conflito

    Object.keys(grupos).sort().forEach((cf, index) => {
        const grupo = grupos[cf];
        if (!grupo) return; // Adiciona uma guarda para evitar erros se o grupo for nulo/indefinido

        const loadId = `toco-${cf}`;
        grupo.id = loadId;
        grupo.vehicleType = 'toco';
        grupo.numero = cf; // Garante que o nÃºmero seja o CF para exibiÃ§Ã£o correta
        activeLoads[loadId] = grupo;

        const pedidos = grupo.pedidos;
        pedidos.sort((a, b) => {
            const clienteA = String(a.Cliente); const clienteB = String(b.Cliente);
            const pedidoA = String(a.Num_Pedido); const pedidoB = String(b.Num_Pedido);
            const clienteCompare = clienteA.localeCompare(clienteB, undefined, { numeric: true });
            if (clienteCompare !== 0) return clienteCompare;
            return pedidoA.localeCompare(pedidoB, undefined, { numeric: true });
        });
        const totalKgFormatado = grupo.totalKg.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const isOverloaded = grupo.totalKg > maxKg;
        const weightBadge = isOverloaded
            ? `<span class="badge bg-danger ms-2"><i class="bi bi-exclamation-triangle-fill me-1"></i>${totalKgFormatado} kg (ACIMA DO PESO!)</span>`
            : `<span class="badge bg-light text-dark ms-2"><i class="bi bi-database me-1"></i>${totalKgFormatado} kg</span>`;

        const pesoPercentual = (grupo.totalKg / maxKg) * 100;
        let progressColor = 'bg-success';
        if (isOverloaded || pesoPercentual > 100) progressColor = 'bg-danger';
        else if (pesoPercentual > 95) progressColor = 'bg-warning';
        else if (pesoPercentual > 75) progressColor = 'bg-warning';
        const progressBar = `<div class="progress mb-3" role="progressbar" style="height: 10px;"><div class="progress-bar ${progressColor}" style="width: ${Math.min(pesoPercentual, 100)}%"></div></div>`;
        const headerColorClass = isOverloaded ? 'bg-danger' : '';

        accordionHtml += `<div class="accordion-item"><h2 class="accordion-header" id="headingToco${index}"><button class="accordion-button collapsed ${headerColorClass}" type="button" data-bs-toggle="collapse" data-bs-target="#collapseToco${index}"><strong>CF: ${cf}</strong> &nbsp; <span class="badge bg-secondary ms-2"><i class="bi bi-box me-1"></i>${pedidos.length}</span> ${weightBadge}</button></h2><div id="collapseToco${index}" class="accordion-collapse collapse" data-bs-parent="#accordionTocoMesa"><div class="accordion-body drop-zone-card" id="${loadId}" ondragover="dragOver(event)" ondragleave="dragLeave(event)" ondrop="drop(event)" data-load-id="${loadId}" data-vehicle-type="toco"><button class="btn btn-sm btn-outline-info mb-3 no-print" onclick="imprimirTocoIndividual('${cf}', event)"><i class="bi bi-printer-fill me-1"></i>Imprimir</button>${progressBar}${createTable(pedidos, null, loadId)}</div></div></div>`;
    });
    accordionHtml += '</div>'; div.innerHTML = accordionHtml;
}

function displayTruck(div, grupos, pedidosCarreta) {
    let todosOsGrupos = { ...grupos };
    const chaveRota11000 = "Rota 11000 (Truck)";
    const chaveCarreta = "Pedidos de Carreta/Truck sem CF";

    if (pedidosCarreta?.length > 0) {
        todosOsGrupos[chaveCarreta] = { // prettier-ignore
            pedidos: pedidosCarreta,
            totalKg: pedidosCarreta.reduce((sum, p) => sum + p.Quilos_Saldo, 0),
            totalCubagem: pedidosCarreta.reduce((sum, p) => sum + p.Cubagem, 0)
        };
        gruposPorCFGlobais[chaveCarreta] = todosOsGrupos[chaveCarreta];
    }

    if (Object.keys(todosOsGrupos).length === 0) {
        div.innerHTML = '<div class="empty-state"><i class="bi bi-truck"></i><p>Nenhum grupo de carga Truck encontrado.</p></div>';
        return;
    }
    let accordionHtml = '<div class="accordion accordion-flush" id="accordionTruck">';

    const specialKeysOrder = [chaveCarreta, chaveRota11000];
    const sortedKeys = Object.keys(todosOsGrupos).sort((a, b) => {
        const aIsSpecial = specialKeysOrder.includes(a);
        const bIsSpecial = specialKeysOrder.includes(b);

        if (aIsSpecial && bIsSpecial) {
            return specialKeysOrder.indexOf(a) - specialKeysOrder.indexOf(b);
        }
        if (aIsSpecial) return -1;
        if (bIsSpecial) return 1;
        return a.localeCompare(b, undefined, { numeric: true });
    });

    sortedKeys.forEach((cf, index) => {
        const grupo = todosOsGrupos[cf];

        grupo.pedidos.sort((a, b) => {
            const clienteA = String(a.Cliente); const clienteB = String(b.Cliente);
            const pedidoA = String(a.Num_Pedido); const pedidoB = String(b.Num_Pedido);
            const clienteCompare = clienteA.localeCompare(clienteB, undefined, { numeric: true });
            if (clienteCompare !== 0) return clienteCompare;
            return pedidoA.localeCompare(pedidoB, undefined, { numeric: true });
        });

        const totalKgFormatado = grupo.totalKg.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const totalCubagemFormatado = grupo.totalCubagem.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const rotas = [...new Set(grupo.pedidos.map(p => p.Cod_Rota))].join(', ');
        const collapseId = `collapseCF-Mesa-${index}`;

        accordionHtml += `
                    <div class="accordion-item">
                        <h2 class="accordion-header" id="headingCargaCFMesa${index}">
                            <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#${collapseId}">
                                <strong>${isNumeric(cf) ? "CF: " : ""}${cf}</strong> &nbsp;
                                <span class="badge bg-secondary ms-2" title="Rotas">${rotas || 'N/A'}</span>
                                <span class="badge bg-light text-dark ms-2"><i class="bi bi-database me-1"></i>${totalKgFormatado} kg</span>
                                <span class="badge bg-light text-dark ms-2"><i class="bi bi-rulers me-1"></i>${totalCubagemFormatado} mÂ³</span>
                            </button>
                        </h2>
                        <div id="${collapseId}" class="accordion-collapse collapse" data-bs-parent="#accordionCargasPorCF">
                            <div class="accordion-body">
                                <button class="btn btn-sm btn-outline-info mb-3 no-print" onclick="imprimirCargaCFIndividual('${cf}')">
                                    <i class="bi bi-printer-fill me-1"></i>Imprimir esta Carga
                                </button>
                                ${createTable(grupo.pedidos)}
                            </div>
                        </div>
                    </div>`;
    });
    accordionHtml += '</div>';
    div.innerHTML = accordionHtml;
}

function displayCargasFechadasPR(div, pedidos) {
    if (!div) return;
    if (pedidos.length === 0) {
        div.innerHTML = '<div class="empty-state"><i class="bi bi-building-fill-check"></i><p>Nenhuma Carga Fechada do ParanÃ¡ encontrada.</p></div>';
        return;
    }

    // Agrupa por CF ou 'Condor'
    const grupos = pedidos.reduce((acc, p) => {
        const coluna5 = String(p.Coluna5 || '').toUpperCase();
        let key;
        if (coluna5.includes('CONDOR (TRUCK)') || coluna5.includes('CONDOR TOD TRUC')) {
            key = 'Condor Truck';
        } else if (coluna5.includes('TBL ESPECIAL') && !isNumeric(p.CF)) {
            key = 'TBL ESPECIAL SEM CF';
        } else {
            key = `CF: ${p.CF}`;
        }

        if (!acc[key]) { acc[key] = { pedidos: [], totalKg: 0, totalCubagem: 0 }; }
        acc[key].pedidos.push(p);
        acc[key].totalKg += p.Quilos_Saldo;
        acc[key].totalCubagem += p.Cubagem;
        return acc;
    }, {});

    let accordionHtml = '<div class="accordion accordion-flush" id="accordionCargasFechadasPR">';

    const sortedKeys = Object.keys(grupos).sort((a, b) => {
        if (a === 'Condor Truck') return -1;
        if (b === 'Condor Truck') return 1;
        if (a === 'TBL ESPECIAL SEM CF') return -1; // Coloca TBL ESPECIAL depois de Condor
        if (b === 'TBL ESPECIAL SEM CF') return 1;
        return a.localeCompare(b, undefined, { numeric: true });
    });

    sortedKeys.forEach((key, index) => {
        const grupo = grupos[key];
        const totalKgFormatado = grupo.totalKg.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const totalCubagemFormatado = grupo.totalCubagem.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const rotas = [...new Set(grupo.pedidos.map(p => p.Cod_Rota))].filter(Boolean).join(', ');
        const collapseId = `collapseCargasFechadasPR-${index}`;
        const printAreaId = `print-area-pr-${index}`; // ID Ãºnico para a Ã¡rea de impressÃ£o

        accordionHtml += `
                    <div class="accordion-item" id="${printAreaId}">
                        <h2 class="accordion-header">
                            <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#${collapseId}">
                                <strong>${key}</strong> &nbsp;
                                <span class="badge bg-secondary ms-2" title="Rotas">${rotas || 'N/A'}</span>
                                <span class="badge bg-light text-dark ms-2"><i class="bi bi-database me-1"></i>${totalKgFormatado} kg</span>
                                <span class="badge bg-light text-dark ms-2"><i class="bi bi-rulers me-1"></i>${totalCubagemFormatado} mÂ³</span>
                            </button>
                        </h2>
                        <div id="${collapseId}" class="accordion-collapse collapse" data-bs-parent="#accordionCargasFechadasPR">
                            <div class="accordion-body">
                                <button class="btn btn-sm btn-outline-info mb-3 no-print" onclick="imprimirCargaFechadaPRIndividual('${printAreaId}', '${key}')"><i class="bi bi-printer-fill me-1"></i>Imprimir este Grupo</button>
                                ${createTable(grupo.pedidos)}
                            </div>
                        </div>
                    </div>`;
    });
    accordionHtml += '</div>';
    div.innerHTML = accordionHtml;
}

function displayCargasFechadasRestBrasil(div, grupos, pedidosCarreta) {
    if (!div) return;

    let todosOsGrupos = JSON.parse(JSON.stringify(grupos)); // Clona para nÃ£o modificar o original
    const chaveCarreta = "Pedidos de Carreta/Truck sem CF";
    const chaveTblEspecial = "TBL ESPECIAL SEM CF";

    if (pedidosCarreta?.length > 0) {
        todosOsGrupos[chaveTblEspecial] = {
            pedidos: pedidosCarreta,
            totalKg: pedidosCarreta.reduce((sum, p) => sum + p.Quilos_Saldo, 0),
            totalCubagem: pedidosCarreta.reduce((sum, p) => sum + p.Cubagem, 0)
        };
    }

    if (Object.keys(todosOsGrupos).length === 0) {
        div.innerHTML = '<div class="empty-state"><i class="bi bi-globe-americas"></i><p>Nenhuma Carga Fechada (Resto do Brasil) encontrada.</p></div>';
        return;
    }

    let accordionHtml = '<div class="accordion accordion-flush" id="accordionCargasFechadasRestBr">';

    const specialKeysOrder = [chaveTblEspecial]; // Define a ordem das chaves especiais
    const sortedKeys = Object.keys(todosOsGrupos).sort((a, b) => {
        const aIsSpecial = specialKeysOrder.includes(a);
        const bIsSpecial = specialKeysOrder.includes(b);
        if (aIsSpecial && bIsSpecial) return specialKeysOrder.indexOf(a) - specialKeysOrder.indexOf(b);
        if (aIsSpecial) return -1; if (bIsSpecial) return 1;
        return a.localeCompare(b, undefined, { numeric: true });
    });

    sortedKeys.forEach((key, index) => {
        const grupo = todosOsGrupos[key];
        const totalKgFormatado = grupo.totalKg.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const totalCubagemFormatado = grupo.totalCubagem.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const rotas = [...new Set(grupo.pedidos.map(p => p.Cod_Rota))].filter(Boolean).join(', ');
        const collapseId = `collapseCargasFechadasRestBr-${index}`;
        const displayName = isNumeric(key) ? `CF: ${key}` : key;

        accordionHtml += `
                    <div class="accordion-item">
                        <h2 class="accordion-header">
                            <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#${collapseId}">
                                <strong>${displayName}</strong> &nbsp;
                                <span class="badge bg-secondary ms-2" title="Rotas">${rotas || 'N/A'}</span>
                                <span class="badge bg-light text-dark ms-2"><i class="bi bi-database me-1"></i>${totalKgFormatado} kg</span>
                                <span class="badge bg-light text-dark ms-2"><i class="bi bi-rulers me-1"></i>${totalCubagemFormatado} mÂ³</span>
                            </button>
                        </h2>
                        <div id="${collapseId}" class="accordion-collapse collapse" data-bs-parent="#accordionCargasFechadasRestBr">
                            <div class="accordion-body">
                                <button class="btn btn-sm btn-outline-info mb-3 no-print" onclick="imprimirCargaCFIndividual('${key}')"><i class="bi bi-printer-fill me-1"></i>Imprimir esta Carga</button>
                                ${createTable(grupo.pedidos)}
                            </div>
                        </div>
                    </div>`;
    });
    accordionHtml += '</div>';
    div.innerHTML = accordionHtml;
}

function imprimirCargaFechadaPRIndividual(printAreaId, key) {
    imprimirGeneric(printAreaId, `Carga Fechada PR - ${key}`);
}

function imprimirCargaCFIndividual(cf) {
    if (!gruposPorCFGlobais || !gruposPorCFGlobais[cf]) {
        alert(`Nenhuma carga encontrada para: ${cf}`);
        return;
    }
    const grupo = gruposPorCFGlobais[cf];
    const totalKgFormatado = grupo.totalKg.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const totalCubagemFormatado = grupo.totalCubagem.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const printWindow = createPrintWindow(`Imprimir Carga: ${cf}`);
    let contentToPrint = `<h3>Carga: ${cf} - Total: ${totalKgFormatado} kg / ${totalCubagemFormatado} mÂ³</h3>` + createTable(grupo.pedidos, null, `cf-${cf}`);
    printWindow.document.body.innerHTML = contentToPrint;
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
}

function startManualLoadBuilder() {
    if (document.getElementById('manual-load-builder-wrapper')) return;

    manualLoadInProgress = {
        pedidos: [], totalKg: 0, totalCubagem: 0, vehicleType: 'fiorino'
    };

    const activeTabPane = document.querySelector('.tab-pane.active');
    if (!activeTabPane) {
        showToast("Erro: Nenhuma aba de trabalho estÃ¡ ativa.", 'error');
        return;
    }

    const builderWrapper = document.createElement('div');
    builderWrapper.id = 'manual-load-builder-wrapper';
    builderWrapper.className = 'p-3 border-top border-secondary';

    builderWrapper.innerHTML = `
                <div class="card border-info shadow-lg" id="manual-load-card">
                    <div class="card-header bg-info text-dark"><h5 class="mb-0"><i class="bi bi-tools me-2"></i>Painel de Montagem de Carga Manual</h5></div>
                    <div class="card-body">
                        <div class="row align-items-center mb-3">
                            <div class="col-md-4"><label for="manualVehicleType" class="form-label">Montar para o veÃ­culo:</label><select id="manualVehicleType" class="form-select" onchange="updateManualBuilderUI()"><option value="fiorino">Fiorino</option><option value="van">Van</option><option value="tresQuartos">3/4</option><option value="toco">Toco</option></select></div>
                            <div class="col-md-5"><p class="mb-1"><strong>Peso Total:</strong> <span id="manualLoadKg">0,00</span> kg</p><p class="mb-0"><strong>Cubagem Total:</strong> <span id="manualLoadCubage">0,00</span> mÂ³</p></div>
                            <div class="col-md-3 text-end"><button class="btn btn-danger me-2" onclick="cancelManualLoad()"><i class="bi bi-x-circle me-1"></i>Cancelar</button><button id="finalizeManualLoadBtn" class="btn btn-success" onclick="finalizeManualLoad()" disabled><i class="bi bi-check-circle me-1"></i>Criar</button></div>
                        </div>
                        <div id="manual-progress-bar-container"></div>
                        <div id="manual-drop-zone" class="p-3 border rounded drop-zone-card" style="background-color: var(--dark-bg); min-height: 150px;" ondragover="dragOver(event)" ondragleave="dragLeave(event)" ondrop="drop(event)" data-load-id="manual-builder">
                            <p class="text-muted text-center" id="manual-drop-text">Arraste os pedidos da lista de "DisponÃ­veis Varejo" para cÃ¡.</p><div id="manual-load-table-container"></div>
                        </div>
                    </div>
                </div>`;

    // NOVO: Insere o painel de montagem no topo da Ã¡rea de trabalho, nÃ£o no final.
    const insertAfterElement = activeTabPane.querySelector('.mb-3.no-print'); // Encontra o container dos botÃµes de rota
    if (insertAfterElement && insertAfterElement.nextElementSibling && insertAfterElement.nextElementSibling.tagName === 'HR') {
        insertAfterElement.insertAdjacentElement('afterend', builderWrapper);
    } else {
        // Fallback: se nÃ£o encontrar, insere no inÃ­cio da aba.
        activeTabPane.prepend(builderWrapper);
    }

    updateManualBuilderUI();
    // Rola a tela suavemente para o painel recÃ©m-criado.
    builderWrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function updateManualBuilderUI() {
    if (!manualLoadInProgress) return;

    const vehicleType = document.getElementById('manualVehicleType').value;
    manualLoadInProgress.vehicleType = vehicleType;

    document.getElementById('manualLoadKg').textContent = manualLoadInProgress.totalKg.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    document.getElementById('manualLoadCubage').textContent = manualLoadInProgress.totalCubagem.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const tableContainer = document.getElementById('manual-load-table-container');
    const dropText = document.getElementById('manual-drop-text');
    if (manualLoadInProgress.pedidos.length > 0) {
        tableContainer.innerHTML = createTable(manualLoadInProgress.pedidos, null, 'manual-builder');
        dropText.style.display = 'none';
    } else {
        tableContainer.innerHTML = '';
        dropText.style.display = 'block';
    }

    const config = getVehicleConfig(vehicleType);

    const finalizeBtn = document.getElementById('finalizeManualLoadBtn');
    finalizeBtn.disabled = manualLoadInProgress.totalKg < config.minKg;

    const pesoPercentual = config.hardMaxKg > 0 ? (manualLoadInProgress.totalKg / config.hardMaxKg) * 100 : 0;
    let progressColor = 'bg-secondary';
    if (manualLoadInProgress.totalKg >= config.minKg) progressColor = 'bg-success';
    if (pesoPercentual > 75) progressColor = 'bg-warning';
    if (pesoPercentual > 95) progressColor = 'bg-danger';

    document.getElementById('manual-progress-bar-container').innerHTML = `
                <div class="progress mb-3" role="progressbar" style="height: 10px;">
                    <div class="progress-bar ${progressColor}" style="width: ${Math.min(pesoPercentual, 100)}%"></div>
                </div>
            `;
}

function finalizeManualLoad() {
    if (!manualLoadInProgress || manualLoadInProgress.pedidos.length === 0) return;

    const vehicleType = manualLoadInProgress.vehicleType;
    const newLoad = {
        ...manualLoadInProgress,
        id: `manual-${vehicleType}-${Date.now()}`,
        numero: `M-${Object.keys(activeLoads).filter(k => k.startsWith('manual')).length + 1}`
    };

    activeLoads[newLoad.id] = newLoad;

    // NOVO: Remove os pedidos da lista de disponÃ­veis para manter a consistÃªncia da UI.
    const usedOrderIds = new Set(newLoad.pedidos.map(p => String(p.Num_Pedido)));
    pedidosGeraisAtuais = pedidosGeraisAtuais.filter(p => !usedOrderIds.has(String(p.Num_Pedido)));


    const vehicleInfo = {
        fiorino: { name: 'Fiorino', colorClass: 'bg-success', textColor: 'text-white', icon: 'bi-box-seam-fill' },
        van: { name: 'Van', colorClass: 'bg-primary', textColor: 'text-white', icon: 'bi-truck-front-fill' },
        tresQuartos: { name: '3/4', colorClass: 'bg-warning', textColor: 'text-dark', icon: 'bi-truck-flatbed' },
        toco: { name: 'Toco', colorClass: 'bg-secondary', textColor: 'text-white', icon: 'bi-inboxes-fill' }
    };

    // Pega a aba ativa para inserir o card da carga manual
    const activeTabPane = document.querySelector('.tab-pane.active');
    if (!activeTabPane) {
        showToast("Erro: Nenhuma aba de trabalho ativa para adicionar a carga.", 'error');
        return;
    }

    // Encontra o container de resultados dentro da aba ativa
    let resultContainer = activeTabPane.querySelector('[id^="resultado-"]');
    if (!resultContainer) {
        // Se nÃ£o houver um container, cria um (caso de aba vazia)
        activeTabPane.innerHTML += `<div id="resultado-${vehicleType}-geral" class="mt-3"></div>`;
        resultContainer = activeTabPane.querySelector('[id^="resultado-"]');
    }

    // Gera o HTML do card e o insere no container correto
    const newCardHTML = renderLoadCard(newLoad, vehicleType, vehicleInfo[vehicleType]);
    resultContainer.insertAdjacentHTML('beforeend', newCardHTML);

    // MELHORIA: Em vez de fechar o painel, reinicia-o para permitir a criaÃ§Ã£o de outra carga em sequÃªncia.
    const currentVehicleType = document.getElementById('manualVehicleType').value;
    manualLoadInProgress = {
        pedidos: [], totalKg: 0, totalCubagem: 0, vehicleType: currentVehicleType
    };
    updateManualBuilderUI(); // Atualiza a UI do painel para refletir o estado zerado.

    // NOVO: Atualiza a lista de disponÃ­veis e os KPIs sem redesenhar toda a mesa de trabalho.
    const gruposGerais = pedidosGeraisAtuais.reduce((acc, p) => { const rota = p.Cod_Rota; if (!acc[rota]) { acc[rota] = { pedidos: [], totalKg: 0 }; } acc[rota].pedidos.push(p); acc[rota].totalKg += p.Quilos_Saldo; return acc; }, {});
    displayGerais(document.getElementById('resultado-geral'), gruposGerais);
    updateAndRenderKPIs();
    updateAndRenderChart();
    updateAndRenderChart();
    showToast(`Carga manual ${newLoad.numero} criada para ${vehicleInfo[vehicleType].name}!`, 'success');

    // AUDIT LOG
    if (window.triggerLogActivity) window.triggerLogActivity('CARGA_MANUAL_CRIADA', { numero: newLoad.numero, veiculo: vehicleInfo[vehicleType].name });
}

function cancelManualLoad() {
    if (!manualLoadInProgress) return;

    // Devolve os pedidos do painel manual para a lista de pedidos gerais.
    if (manualLoadInProgress.pedidos.length > 0) {
        pedidosGeraisAtuais.push(...manualLoadInProgress.pedidos);
    }

    const builderWrapper = document.getElementById('manual-load-builder-wrapper');
    if (builderWrapper) builderWrapper.remove();
    manualLoadInProgress = null;

    // Atualiza apenas as partes necessÃ¡rias da UI, sem redesenhar tudo.
    const gruposGerais = pedidosGeraisAtuais.reduce((acc, p) => { const rota = p.Cod_Rota; if (!acc[rota]) { acc[rota] = { pedidos: [], totalKg: 0 }; } acc[rota].pedidos.push(p); acc[rota].totalKg += p.Quilos_Saldo; return acc; }, {});
    displayGerais(document.getElementById('resultado-geral'), gruposGerais);
    updateAndRenderKPIs();
    updateAndRenderChart();
    saveStateToLocalStorage();
    showToast('Montagem de carga manual cancelada.', 'info');
}

function dragStart(event, pedidoId, clienteId, sourceId) {
    event.dataTransfer.setData("text/plain", JSON.stringify({ pedidoId, clienteId, sourceId }));
    event.dataTransfer.effectAllowed = "move";
}

function dragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const dropZoneCard = event.target.closest('.drop-zone-card');
    if (dropZoneCard) {
        dropZoneCard.classList.add('drag-over');
    }
}

function dragLeave(event) {
    const dropZoneCard = event.target.closest('.drop-zone-card');
    if (dropZoneCard) {
        dropZoneCard.classList.remove('drag-over');
    }
}

function drop(event) {
    event.preventDefault();
    const dropZoneCard = event.target.closest('.drop-zone-card');
    if (!dropZoneCard) return;
    dropZoneCard.classList.remove('drag-over');

    const { clienteId, sourceId } = JSON.parse(event.dataTransfer.getData("text/plain"));
    const targetId = dropZoneCard.dataset.loadId;

    if (sourceId === targetId) return;

    let sourceLoad, targetLoad;
    let sourceIsLeftovers = sourceId === 'leftovers';
    let targetIsLeftovers = targetId === 'leftovers';
    let sourceIsGeral = sourceId === 'geral';
    let targetIsGeral = targetId === 'geral';
    let targetIsManualBuilder = targetId === 'manual-builder';
    let sourceIsManualBuilder = sourceId === 'manual-builder';

    if (sourceIsLeftovers) {
        sourceLoad = { pedidos: currentLeftoversForPrinting };
    } else if (sourceIsGeral) {
        sourceLoad = { pedidos: pedidosGeraisAtuais };
    } else if (sourceIsManualBuilder) {
        sourceLoad = manualLoadInProgress;
    } else {
        sourceLoad = activeLoads[sourceId];
    }

    if (targetIsLeftovers) {
        targetLoad = { pedidos: currentLeftoversForPrinting, totalKg: 0, totalCubagem: 0 };
    } else if (targetIsManualBuilder) {
        targetLoad = manualLoadInProgress;
    } else if (targetIsGeral) {
        targetLoad = { pedidos: pedidosGeraisAtuais, totalKg: 0, totalCubagem: 0 };
    } else {
        targetLoad = activeLoads[targetId];
    }

    if (!sourceLoad || !targetLoad) {
        console.error("ERRO: Carga de origem ou destino nÃ£o encontrada.", { sourceId, targetId, activeLoads });
        return;
    }

    const clientOrdersToMove = sourceLoad.pedidos.filter(p => normalizeClientId(p.Cliente) === clienteId);
    if (clientOrdersToMove.length === 0) return;

    const orderIdsToMove = new Set(clientOrdersToMove.map(p => p.Num_Pedido));
    const clientBlockKg = clientOrdersToMove.reduce((sum, p) => sum + p.Quilos_Saldo, 0);
    const clientBlockCubagem = clientOrdersToMove.reduce((sum, p) => sum + p.Cubagem, 0);

    // CORREÃ‡ÃƒO: ValidaÃ§Ã£o completa da jogada usando isMoveValid
    if (!targetIsGeral && !targetIsLeftovers) {
        const groupToAdd = {
            pedidos: clientOrdersToMove,
            totalKg: clientBlockKg,
            totalCubagem: clientBlockCubagem,
            isSpecial: clientOrdersToMove.some(isSpecialClient)
        };

        const targetVehicleType = targetLoad.vehicleType;
        if (!isMoveValid(targetLoad, groupToAdd, targetVehicleType)) {
            alert(`AÃ§Ã£o invÃ¡lida! O grupo nÃ£o pode ser adicionado a esta carga.\nVerifique as regras de capacidade, clientes especiais e agendamento.`);
            dropZoneCard.classList.add('drop-invalid');
            setTimeout(() => dropZoneCard.classList.remove('drop-invalid'), 500);
            return;
        }
    }

    dropZoneCard.classList.add('drop-valid-target');
    setTimeout(() => dropZoneCard.classList.remove('drop-valid-target'), 700);

    if (sourceIsLeftovers) {
        currentLeftoversForPrinting = sourceLoad.pedidos.filter(p => !orderIdsToMove.has(p.Num_Pedido));
    } else if (sourceIsGeral) {
        pedidosGeraisAtuais = sourceLoad.pedidos.filter(p => !orderIdsToMove.has(p.Num_Pedido));
    } else {
        sourceLoad.pedidos = sourceLoad.pedidos.filter(p => !orderIdsToMove.has(p.Num_Pedido));
        sourceLoad.totalKg -= clientBlockKg;
        sourceLoad.totalCubagem -= clientBlockCubagem;
    }

    if (targetIsLeftovers) {
        currentLeftoversForPrinting.push(...clientOrdersToMove);
    } else if (targetIsGeral) {
        pedidosGeraisAtuais.push(...clientOrdersToMove);
    } else {
        targetLoad.pedidos.push(...clientOrdersToMove);
        targetLoad.totalKg += clientBlockKg;
        targetLoad.totalCubagem += clientBlockCubagem;
    }

    const vehicleInfo = {
        fiorino: { name: 'Fiorino', colorClass: 'bg-success', textColor: 'text-white', icon: 'bi-box-seam-fill' },
        van: { name: 'Van', colorClass: 'bg-primary', textColor: 'text-white', icon: 'bi-truck-front-fill' },
        tresQuartos: { name: '3/4', colorClass: 'bg-warning', textColor: 'text-dark', icon: 'bi-truck-flatbed' },
        toco: { name: 'Toco', colorClass: 'bg-secondary', textColor: 'text-white', icon: 'bi-inboxes-fill' }
    };

    // Instead of calling renderAllUI(), we will manually update the UI
    if (targetIsManualBuilder || sourceIsManualBuilder) {
        updateManualBuilderUI();
    }

    // Update the source and target cards
    if (!sourceIsGeral && !sourceIsLeftovers && !sourceIsManualBuilder) {
        const sourceCard = document.getElementById(sourceId);
        if (sourceCard) {
            const newSourceCardHTML = renderLoadCard(sourceLoad, sourceLoad.vehicleType, vehicleInfo[sourceLoad.vehicleType]);
            sourceCard.outerHTML = newSourceCardHTML;
        }
    }

    if (!targetIsGeral && !targetIsLeftovers && !targetIsManualBuilder) {
        const targetCard = document.getElementById(targetId);
        if (targetCard) {
            const newTargetCardHTML = renderLoadCard(targetLoad, targetLoad.vehicleType, vehicleInfo[targetLoad.vehicleType]);
            targetCard.outerHTML = newTargetCardHTML;
        }
    }

    // Update the "Pedidos DisponÃ­veis" list
    const gruposGerais = pedidosGeraisAtuais.reduce((acc, p) => { const rota = p.Cod_Rota; if (!acc[rota]) { acc[rota] = { pedidos: [], totalKg: 0 }; } acc[rota].pedidos.push(p); acc[rota].totalKg += p.Quilos_Saldo; return acc; }, {});
    displayGerais(document.getElementById('resultado-geral'), gruposGerais);

    updateAndRenderKPIs();
    updateAndRenderChart();
    saveStateToLocalStorage();
}

function highlightClientRows(event) {
    if (event.button === 2) return; // Ignora cliques com o botÃ£o direito para nÃ£o interferir no menu de contexto
    const clickedRow = event.target.closest('tr[data-cliente-id]');
    if (!clickedRow || !clickedRow.dataset.clienteId) return;

    const clienteId = clickedRow.dataset.clienteId;
    const isAlreadyHighlighted = clickedRow.classList.contains('client-highlight');

    document.querySelectorAll('tr.client-highlight').forEach(row => {
        row.classList.remove('client-highlight');
    });

    if (!isAlreadyHighlighted) {
        document.querySelectorAll(`tr[data-cliente-id='${clienteId}']`).forEach(row => {
            row.classList.add('client-highlight');
        });
    }
}

// --- FunÃ§Ãµes para AÃ§Ãµes em Massa ---
function toggleAllCheckboxes(source) {
    const table = source.closest('table');
    // Adicionado para o caso de nÃ£o haver tabela (estado vazio) - Simplificado
    if (!table) {
        updateBulkActionsPanel();
        return;
    }
    const checkboxes = table.querySelectorAll('.row-checkbox');
    checkboxes.forEach(checkbox => {
        checkbox.checked = source.checked;
    });
    updateBulkActionsPanel();
}

function updateBulkActionsPanel(event) {
    if (event) event.stopPropagation(); // Impede que o clique no checkbox dispare o highlight da linha

    const panel = document.getElementById('bulk-actions-panel');
    const countSpan = document.getElementById('bulk-actions-count');
    const labelSpan = document.getElementById('bulk-actions-label');
    const selectedCheckboxes = document.querySelectorAll('.row-checkbox:checked');

    if (selectedCheckboxes.length > 0) {
        countSpan.textContent = selectedCheckboxes.length;
        labelSpan.textContent = selectedCheckboxes.length > 1 ? ' itens selecionados' : ' item selecionado';
        panel.style.display = 'block';
    } else {
        panel.style.display = 'none';
    }
}

function clearBulkSelection() {
    document.querySelectorAll('.row-checkbox:checked').forEach(cb => cb.checked = false);
    document.querySelectorAll('thead input[type="checkbox"]').forEach(cb => cb.checked = false);
    updateBulkActionsPanel();
}

function bulkAction(action) {
    const selectedPedidos = Array.from(document.querySelectorAll('.row-checkbox:checked')).map(cb => cb.value);
    if (selectedPedidos.length === 0) return;

    let requiresReprocessing = false;

    switch (action) {
        case 'prioritize':
            selectedPedidos.forEach(num => { if (!pedidosPrioritarios.includes(num)) pedidosPrioritarios.push(num); if (!pedidosRecall.includes(num)) pedidosRecall.push(num); });
            requiresReprocessing = true;
            break;
        case 'block':
            selectedPedidos.forEach(num => pedidosBloqueados.add(num));
            requiresReprocessing = true;
            break;
        case 'copy':
            const textToCopy = selectedPedidos.join('\n');
            navigator.clipboard.writeText(textToCopy).then(() => {
                showToast(`${selectedPedidos.length} nÃºmero(s) de pedido copiado(s) para a Ã¡rea de transferÃªncia.`, 'success');
            }).catch(err => {
                console.error('Erro ao copiar nÃºmeros dos pedidos: ', err);
                showToast('Falha ao copiar os nÃºmeros. Verifique o console para mais detalhes.', 'danger');
            });
            // A aÃ§Ã£o de copiar nÃ£o requer reprocessamento.
            clearBulkSelection();
            return; // Sai da funÃ§Ã£o aqui.
            break;
    }

    if (requiresReprocessing) {
        saveStateToLocalStorage();
        atualizarUIAposAcao(`${selectedPedidos.length} pedido(s) foram atualizados.`);

        // AUDIT LOG
        import('./js/realtime.js').then(m => m.logActivity('ACAO_EM_MASSA', { tipo: action, qtd: selectedPedidos.length }));
        // Local toast for immediate feedback
        if (window.showLocalToast) window.showLocalToast('VocÃª', `AÃ§Ã£o em massa: ${action} (${selectedPedidos.length})`, 'info');
    }

    clearBulkSelection();
}

function montarCargaPredefinida(inputId, resultadoId, processedSet, nomeCarga) {
    const input = document.getElementById(inputId);
    const resultadoDivOriginal = document.getElementById(resultadoId);
    if (resultadoDivOriginal) resultadoDivOriginal.innerHTML = ''; // Limpa a Ã¡rea de resultado antiga

    if (planilhaData.length === 0) {
        showToast("Por favor, carregue a planilha primeiro.", 'warning');
        return;
    }

    const numerosPedidos = input.value.split('\n').map(n => n.trim()).filter(Boolean);

    if (numerosPedidos.length === 0) {
        alert(`Nenhum nÃºmero de pedido foi inserido para a ${nomeCarga}.`);
        return;
    }

    const pedidosSelecionados = [];
    const pedidosNaoEncontrados = [];
    const pedidosJaProcessados = [];

    numerosPedidos.forEach(num => {
        const isAlreadyInLoad = Object.values(activeLoads).some(load => load.pedidos.some(p => String(p.Num_Pedido) === num));
        if (isAlreadyInLoad) {
            pedidosJaProcessados.push(num);
            return;
        }
        const pedidoEncontrado = planilhaData.find(p => String(p.Num_Pedido) === num);
        if (pedidoEncontrado) {
            pedidosSelecionados.push(pedidoEncontrado);
        } else {
            pedidosNaoEncontrados.push(num);
        }
    });

    if (pedidosJaProcessados.length > 0) {
        showToast(`Pedidos jÃ¡ alocados em outras cargas foram ignorados: ${pedidosJaProcessados.join(', ')}`, 'warning');
    }
    if (pedidosNaoEncontrados.length > 0) {
        showToast(`Pedidos nÃ£o encontrados na planilha: ${pedidosNaoEncontrados.join(', ')}`, 'error');
    }
    if (pedidosSelecionados.length === 0) {
        return;
    }

    const totalKg = pedidosSelecionados.reduce((sum, p) => sum + p.Quilos_Saldo, 0);
    const totalCubagem = pedidosSelecionados.reduce((sum, p) => sum + p.Cubagem, 0);

    const veiculos = [
        { tipo: 'fiorino', nome: 'Fiorino', maxKg: getVehicleConfig('fiorino').hardMaxKg, maxCubagem: getVehicleConfig('fiorino').hardMaxCubage },
        { tipo: 'van', nome: 'Van', maxKg: getVehicleConfig('van').hardMaxKg, maxCubagem: getVehicleConfig('van').hardMaxCubage },
        { tipo: 'tresQuartos', nome: '3/4', maxKg: getVehicleConfig('tresQuartos').hardMaxKg, maxCubagem: getVehicleConfig('tresQuartos').hardMaxCubage },
        { tipo: 'toco', nome: 'Toco', maxKg: getVehicleConfig('toco').hardMaxKg, maxCubagem: getVehicleConfig('toco').hardMaxCubage }
    ];

    let veiculoEscolhido = null;
    for (const veiculo of veiculos) {
        if (totalKg <= veiculo.maxKg && totalCubagem <= veiculo.maxCubagem) {
            veiculoEscolhido = veiculo;
            break;
        }
    }

    if (!veiculoEscolhido) {
        veiculoEscolhido = { tipo: 'toco', nome: 'Carreta/Truck (Excedeu Capacidade)' };
    }

    // --- LÃ“GICA DE DIRECIONAMENTO PARA ABA ATIVA ---
    const vehicleType = veiculoEscolhido.tipo;

    // Encontra a aba ativa na Mesa de Trabalho
    const activeTabPane = document.querySelector('#vehicleTabsContent .tab-pane.active');
    let targetContainer;

    if (activeTabPane) {
        // Procura por um container de resultado dentro da aba ativa
        targetContainer = activeTabPane.querySelector('[id^="resultado-"]');
    }

    // Fallback: se nÃ£o encontrar um container na aba ativa, usa a lÃ³gica antiga baseada no tipo de veÃ­culo
    if (!targetContainer) {
        const fallbackContainerId = vehicleType === 'fiorino' ? 'resultado-fiorino-geral' : vehicleType === 'van' ? 'resultado-van-geral' : vehicleType === 'tresQuartos' ? 'resultado-34-geral' : 'resultado-toco';
        targetContainer = document.getElementById(fallbackContainerId);
    }
    // --- FIM DA LÃ“GICA DE DIRECIONAMENTO ---

    if (veiculoEscolhido) {
        const pedidosSelecionadosIds = new Set(pedidosSelecionados.map(p => String(p.Num_Pedido)));
        pedidosSelecionadosIds.forEach(id => processedSet.add(id));

        const loadId = `${nomeCarga.toLowerCase().replace(/\s+/g, '-')}-1`;
        const load = {
            id: loadId,
            pedidos: pedidosSelecionados,
            totalKg: totalKg,
            totalCubagem: totalCubagem,
            numero: nomeCarga,
            vehicleType: veiculoEscolhido.tipo
        };
        activeLoads[loadId] = load;

        const vehicleInfo = {
            fiorino: { name: 'Fiorino', colorClass: 'bg-success', textColor: 'text-white', icon: 'bi-box-seam-fill' },
            van: { name: 'Van', colorClass: 'bg-primary', textColor: 'text-white', icon: 'bi-truck-front-fill' },
            tresQuartos: { name: '3/4', colorClass: 'bg-warning', textColor: 'text-dark', icon: 'bi-truck-flatbed' },
            toco: { name: 'Carreta/Truck', colorClass: 'bg-secondary', textColor: 'text-white', icon: 'bi-inboxes-fill' }
        };

        // --- NOVA LÃ“GICA DE RENDERIZAÃ‡ÃƒO ---
        if (targetContainer) {
            const newCardHTML = renderLoadCard(load, vehicleType, vehicleInfo[vehicleType]);
            targetContainer.insertAdjacentHTML('beforeend', newCardHTML);

            // Rola para o novo card
            setTimeout(() => {
                const newCardElement = document.getElementById(loadId);
                if (newCardElement) newCardElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 300); // Delay para garantir que o card foi renderizado
        }

        // AUDIT LOG
        import('./js/realtime.js').then(m => m.logActivity('CARGA_MANUAL', { carga: nomeCarga, veiculo: veiculoEscolhido.nome }));
        if (window.showLocalToast) window.showLocalToast('VocÃª', `Carga Manual Criada: ${nomeCarga}`, 'success');

        showToast(`Carga ${nomeCarga} montada com sucesso em um(a) ${veiculoEscolhido.nome}!`, 'success');

        pedidosGeraisAtuais = pedidosGeraisAtuais.filter(p => !pedidosSelecionadosIds.has(String(p.Num_Pedido)));

        const gruposGerais = pedidosGeraisAtuais.reduce((acc, p) => { const rota = p.Cod_Rota; if (!acc[rota]) { acc[rota] = { pedidos: [], totalKg: 0 }; } acc[rota].pedidos.push(p); acc[rota].totalKg += p.Quilos_Saldo; return acc; }, {});
        displayGerais(document.getElementById('resultado-geral'), gruposGerais);

        updateAndRenderKPIs();
        updateAndRenderChart();

        saveStateToLocalStorage();

    } else {
        showToast(`Carga excede a capacidade dos veÃ­culos. Peso: ${totalKg.toFixed(2)}kg`, 'error');
    }
}

function displayPedidosFuncionarios(div, pedidos) {
    if (!div) return;
    div.innerHTML = ''; // Limpa o container
    if (pedidos.length === 0) {
        return false; // Retorna false se nÃ£o houver pedidos
    }

    pedidos.sort((a, b) => {
        const clienteA = String(a.Cliente); const clienteB = String(b.Cliente);
        const pedidoA = String(a.Num_Pedido); const pedidoB = String(b.Num_Pedido);
        const clienteCompare = clienteA.localeCompare(clienteB, undefined, { numeric: true });
        if (clienteCompare !== 0) return clienteCompare;
        return pedidoA.localeCompare(pedidoB, undefined, { numeric: true });
    });

    const totalKg = pedidos.reduce((sum, p) => sum + p.Quilos_Saldo, 0);
    const totalKgFormatado = totalKg.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const accordionId = 'accordionFuncionarios';
    const collapseId = 'collapseFuncionarios';
    const headerId = 'headingFuncionarios';
    const printAreaId = 'funcionarios-print-area';

    let accordionHtml = `<div class="accordion accordion-flush" id="${accordionId}">
                <div class="accordion-item" id="${printAreaId}">
                    <h2 class="accordion-header" id="${headerId}">
                        <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#${collapseId}">
                            <strong>Pedidos de FuncionÃ¡rios</strong> &nbsp;
                            <span class="badge bg-secondary ms-2"><i class="bi bi-box me-1"></i>${pedidos.length} Pedidos</span>
                            <span class="badge bg-light text-dark ms-2"><i class="bi bi-database me-1"></i>${totalKgFormatado} kg</span>
                        </button>
                    </h2>
                    <div id="${collapseId}" class="accordion-collapse collapse" data-bs-parent="#${accordionId}">
                        <div class="accordion-body">
                            <div class="d-flex justify-content-between align-items-center mb-3 no-print">
                                <p class="text-muted small mb-0">Pedidos com a tag "TBL FUNCIONARIO" na Coluna 5, separados automaticamente.</p>
                                <button class="btn btn-sm btn-outline-info" onclick="imprimirGeneric('${printAreaId}', 'Pedidos de FuncionÃ¡rios')">
                                    <i class="bi bi-printer-fill me-1"></i>Imprimir Lista
                                </button> 
                            </div>
                            ${createTable(pedidos, ['Num_Pedido', 'Cliente', 'Nome_Cliente', 'Quilos_Saldo', 'Cidade', 'Predat', 'Dat_Ped', 'Coluna5', 'BLOQ.'])}
                        </div>
                    </div>
                </div>
            </div>`;

    div.innerHTML = accordionHtml;
    return true; // Retorna true se houver pedidos
}

function displayPedidosTransferencias(div, pedidos) {
    if (!div) return;
    div.innerHTML = ''; // Limpa o container
    if (pedidos.length === 0) {
        return false; // Retorna false se nÃ£o houver pedidos
    }

    pedidos.sort((a, b) => {
        const clienteA = String(a.Cliente); const clienteB = String(b.Cliente);
        const pedidoA = String(a.Num_Pedido); const pedidoB = String(b.Num_Pedido);

        const clienteCompare = clienteA.localeCompare(clienteB, undefined, { numeric: true });
        if (clienteCompare !== 0) return clienteCompare;
        return pedidoA.localeCompare(pedidoB, undefined, { numeric: true });
    });

    const totalKg = pedidos.reduce((sum, p) => sum + p.Quilos_Saldo, 0);
    const totalKgFormatado = totalKg.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const accordionId = 'accordionTransferencias';
    const collapseId = 'collapseTransferencias';
    const headerId = 'headingTransferencias';
    const printAreaId = 'transferencias-print-area';

    let accordionHtml = `<div class="accordion accordion-flush" id="${accordionId}">
                <div class="accordion-item" id="${printAreaId}">
                    <h2 class="accordion-header" id="${headerId}">
                        <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#${collapseId}">
                            <strong>Pedidos de TransferÃªncia</strong> &nbsp;
                            <span class="badge bg-secondary ms-2"><i class="bi bi-box me-1"></i>${pedidos.length} Pedidos</span>
                            <span class="badge bg-light text-dark ms-2"><i class="bi bi-database me-1"></i>${totalKgFormatado} kg</span>
                        </button>
                    </h2>
                    <div id="${collapseId}" class="accordion-collapse collapse" data-bs-parent="#${accordionId}">
                        <div class="accordion-body">
                            <div class="d-flex justify-content-between align-items-center mb-3 no-print">
                                <p class="text-muted small mb-0">Pedidos com as tags "TABELA TRANSFER", "TRANSF. TODESCH" ou "INSTITUCIONAL" na Coluna 5.</p>
                                <button class="btn btn-sm btn-outline-info" onclick="imprimirGeneric('${printAreaId}', 'Pedidos de TransferÃªncia')">
                                    <i class="bi bi-printer-fill me-1"></i>Imprimir Lista
                                </button> 
                            </div>
                            ${createTable(pedidos, ['Num_Pedido', 'Cliente', 'Nome_Cliente', 'Quilos_Saldo', 'Cidade', 'Predat', 'Dat_Ped', 'Coluna5', 'BLOQ.'])}
                        </div>
                    </div>
                </div>
            </div>`;

    div.innerHTML = accordionHtml;
    return true; // Retorna true se houver pedidos
}

function displayPedidosExportacao(div, pedidos) {
    if (!div) return;
    div.innerHTML = ''; // Limpa o container
    if (pedidos.length === 0) {
        return false; // Retorna false se nÃ£o houver pedidos
    }

    pedidos.sort((a, b) => {
        const clienteA = String(a.Cliente); const clienteB = String(b.Cliente);
        const pedidoA = String(a.Num_Pedido); const pedidoB = String(b.Num_Pedido);

        const clienteCompare = clienteA.localeCompare(clienteB, undefined, { numeric: true });
        if (clienteCompare !== 0) return clienteCompare;
        return pedidoA.localeCompare(pedidoB, undefined, { numeric: true });
    });

    const totalKg = pedidos.reduce((sum, p) => sum + p.Quilos_Saldo, 0);
    const totalKgFormatado = totalKg.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const accordionId = 'accordionExportacao';
    const collapseId = 'collapseExportacao';
    const headerId = 'headingExportacao';
    const printAreaId = 'exportacao-print-area'; // Este ID Ã© usado no botÃ£o de imprimir

    let accordionHtml = `<div class="accordion accordion-flush" id="${accordionId}">
                <div class="accordion-item" id="${printAreaId}">
                    <h2 class="accordion-header" id="${headerId}">
                        <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#${collapseId}">
                            <strong>Pedidos de ExportaÃ§Ã£o</strong> &nbsp;
                            <span class="badge bg-secondary ms-2"><i class="bi bi-box me-1"></i>${pedidos.length} Pedidos</span>
                            <span class="badge bg-light text-dark ms-2"><i class="bi bi-database me-1"></i>${totalKgFormatado} kg</span>
                        </button>
                    </h2>
                    <div id="${collapseId}" class="accordion-collapse collapse" data-bs-parent="#${accordionId}">
                        <div class="accordion-body"><div class="d-flex justify-content-between align-items-center mb-3 no-print"><p class="text-muted small mb-0">Pedidos com a tag "TBL EXPORTACAO" na Coluna 5.</p><button class="btn btn-sm btn-outline-info" onclick="imprimirGeneric('${printAreaId}', 'Pedidos de ExportaÃ§Ã£o')"><i class="bi bi-printer-fill me-1"></i>Imprimir Lista</button></div>${createTable(pedidos, ['Num_Pedido', 'Cliente', 'Nome_Cliente', 'Quilos_Saldo', 'Cidade', 'Predat', 'Dat_Ped', 'Coluna5', 'BLOQ.'])}</div>
                    </div></div></div>`; // prettier-ignore
    div.innerHTML = accordionHtml;
    return true; // Retorna true se houver pedidos
}

function displayPedidosMoinho(div, pedidos) {
    if (!div) return;
    div.innerHTML = ''; // Limpa o container
    if (pedidos.length === 0) {
        return false; // Retorna false se nÃ£o houver pedidos
    }

    pedidos.sort((a, b) => {
        const clienteA = String(a.Cliente); const clienteB = String(b.Cliente);
        const pedidoA = String(a.Num_Pedido); const pedidoB = String(b.Num_Pedido);
        const clienteCompare = clienteA.localeCompare(clienteB, undefined, { numeric: true });
        if (clienteCompare !== 0) return clienteCompare;
        return pedidoA.localeCompare(pedidoB, undefined, { numeric: true });
    });

    const totalKg = pedidos.reduce((sum, p) => sum + p.Quilos_Saldo, 0);
    const totalKgFormatado = totalKg.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const accordionId = 'accordionMoinho';
    const collapseId = 'collapseMoinho';
    const printAreaId = 'moinho-print-area';

    let accordionHtml = `<div class="accordion accordion-flush" id="${accordionId}">
                <div class="accordion-item" id="${printAreaId}">
                    <h2 class="accordion-header">
                        <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#${collapseId}">
                            <strong>Pedidos "Moinho"</strong> &nbsp;
                            <span class="badge bg-secondary ms-2"><i class="bi bi-box me-1"></i>${pedidos.length} Pedidos</span>
                            <span class="badge bg-light text-dark ms-2"><i class="bi bi-database me-1"></i>${totalKgFormatado} kg</span>
                        </button>
                    </h2>
                    <div id="${collapseId}" class="accordion-collapse collapse" data-bs-parent="#${accordionId}">
                        <div class="accordion-body">
                            <div class="d-flex justify-content-between align-items-center mb-3 no-print">
                                <p class="text-muted small mb-0">Pedidos com a tag "MOINHO" na Coluna 5.</p>
                                <button class="btn btn-sm btn-outline-info" onclick="imprimirGeneric('${printAreaId}', 'Pedidos Moinho')"><i class="bi bi-printer-fill me-1"></i>Imprimir Lista</button>
                            </div>
                            ${createTable(pedidos, ['Num_Pedido', 'Cliente', 'Nome_Cliente', 'Quilos_Saldo', 'Cidade', 'Predat', 'Dat_Ped', 'Coluna5', 'BLOQ.'])}
                        </div>
                    </div></div></div>`;
    div.innerHTML = accordionHtml;
    return true; // Retorna true se houver pedidos
}

function displayPedidosMarcaPropria(div, pedidos) {
    if (!div) return;
    div.innerHTML = ''; // Limpa o container
    if (pedidos.length === 0) {
        return false; // Retorna false se nÃ£o houver pedidos
    }

    pedidos.sort((a, b) => {
        const clienteA = String(a.Cliente); const clienteB = String(b.Cliente);
        const pedidoA = String(a.Num_Pedido); const pedidoB = String(b.Num_Pedido);
        const clienteCompare = clienteA.localeCompare(clienteB, undefined, { numeric: true });
        if (clienteCompare !== 0) return clienteCompare;
        return pedidoA.localeCompare(pedidoB, undefined, { numeric: true });
    });

    const totalKg = pedidos.reduce((sum, p) => sum + p.Quilos_Saldo, 0);
    const totalKgFormatado = totalKg.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const accordionId = 'accordionMarcaPropria';
    const collapseId = 'collapseMarcaPropria';
    const printAreaId = 'marcapropria-print-area';

    let accordionHtml = `<div class="accordion accordion-flush" id="${accordionId}">
                <div class="accordion-item" id="${printAreaId}">
                    <h2 class="accordion-header">
                        <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#${collapseId}">
                            <strong>Pedidos "Marca PrÃ³pria"</strong> &nbsp;
                            <span class="badge bg-secondary ms-2"><i class="bi bi-box me-1"></i>${pedidos.length} Pedidos</span>
                            <span class="badge bg-light text-dark ms-2"><i class="bi bi-database me-1"></i>${totalKgFormatado} kg</span>
                        </button>
                    </h2>
                    <div id="${collapseId}" class="accordion-collapse collapse" data-bs-parent="#${accordionId}">
                        <div class="accordion-body">
                            <div class="d-flex justify-content-between align-items-center mb-3 no-print">
                                <p class="text-muted small mb-0">Pedidos com a tag "MARCA PROPRIA" na Coluna 5.</p>
                                <button class="btn btn-sm btn-outline-info" onclick="imprimirGeneric('${printAreaId}', 'Pedidos Marca PrÃ³pria')"><i class="bi bi-printer-fill me-1"></i>Imprimir Lista</button>
                            </div>
                            ${createTable(pedidos, ['Num_Pedido', 'Cliente', 'Nome_Cliente', 'Quilos_Saldo', 'Cidade', 'Predat', 'Dat_Ped', 'Coluna5', 'BLOQ.'])}
                        </div>
                    </div></div></div>`;
    div.innerHTML = accordionHtml;
    return true; // Retorna true se houver pedidos
}

function gerarRelatorioPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // --- 1. Coleta e Agrupamento de Dados ---
    const allLoads = Object.values(activeLoads);
    if (allLoads.length === 0 && currentLeftoversForPrinting.length === 0 && pedidosTransferencias.length === 0 && pedidosExportacao.length === 0 && pedidosFuncionarios.length === 0) {
        showToast("NÃ£o hÃ¡ dados processados para gerar o relatÃ³rio.", 'warning');
        return;
    }

    const varejoLoads = allLoads.filter(l => ['fiorino', 'van', 'tresQuartos', 'toco'].includes(l.vehicleType));
    const manualLoads = allLoads.filter(l => !['fiorino', 'van', 'tresQuartos', 'toco'].includes(l.vehicleType));

    const resumoVarejo = varejoLoads.reduce((acc, load) => {
        const type = load.vehicleType === 'tresQuartos' ? '3/4' : load.vehicleType.charAt(0).toUpperCase() + load.vehicleType.slice(1);
        if (!acc[type]) {
            acc[type] = { veiculos: 0, peso: 0, pedidos: 0 };
        }
        acc[type].veiculos++;
        acc[type].peso += load.totalKg;
        acc[type].pedidos += load.pedidos.length;
        return acc;
    }, {});

    const totalPedidosAlocados = allLoads.reduce((sum, l) => sum + l.pedidos.length, 0);
    const totalPesoAlocado = allLoads.reduce((sum, l) => sum + l.totalKg, 0);
    const totalVeiculos = varejoLoads.length + manualLoads.length;

    // --- 2. ConstruÃ§Ã£o do PDF ---
    const today = new Date().toLocaleDateString('pt-BR');
    let finalY = 10; // Inicia a posiÃ§Ã£o Y

    // CabeÃ§alho
    doc.setFontSize(20);
    doc.setTextColor('#00bfa5');
    doc.text("ApexLog", 14, 20);
    doc.setFontSize(18);
    doc.setTextColor(40);
    doc.text("RelatÃ³rio de PrevisÃ£o de ExpediÃ§Ã£o", 105, 20, { align: 'center' });
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(`Data de GeraÃ§Ã£o: ${today}`, 200, 26, { align: 'right' });
    doc.setLineWidth(0.5);
    doc.setDrawColor('#00bfa5');
    doc.line(14, 29, 200, 29);

    finalY = 35; // PosiÃ§Ã£o Y apÃ³s o cabeÃ§alho
    // Resumo Geral
    doc.setFontSize(14);
    doc.setTextColor(40);
    doc.text("Resumo Geral da PrevisÃ£o", 14, finalY);
    doc.autoTable({
        startY: finalY + 6,
        body: [
            ['Total de VeÃ­culos Previstos:', totalVeiculos.toString()],
            ['Peso Total Alocado (kg):', totalPesoAlocado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })],
            ['Total de Pedidos Alocados:', totalPedidosAlocados.toString()],
            ['Pedidos em Sobra (NÃ£o alocados):', currentLeftoversForPrinting.length.toString()],
        ],
        theme: 'striped',
        styles: { fontSize: 10, cellPadding: 2.5 },
        bodyStyles: { fillColor: false }, // Fundo transparente para o corpo
        columnStyles: { 0: { fontStyle: 'bold' } }
    });

    finalY = doc.lastAutoTable.finalY; // Atualiza a posiÃ§Ã£o Y

    // Detalhamento Varejo
    const bodyVarejo = Object.keys(resumoVarejo).map(tipo => {
        const data = resumoVarejo[tipo];
        const pesoMedio = data.veiculos > 0 ? (data.peso / data.veiculos) : 0;
        return [
            tipo,
            data.veiculos,
            data.peso.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
            pesoMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
            data.pedidos
        ];
    });

    if (bodyVarejo.length > 0) {
        finalY += 10; // Adiciona um espaÃ§o antes da prÃ³xima seÃ§Ã£o
        doc.setFontSize(14);
        doc.setTextColor(40);
        doc.text("Detalhamento de Cargas (Varejo)", 14, finalY);
        doc.autoTable({
            head: [['Tipo de VeÃ­culo', 'Qtd. VeÃ­culos', 'Peso Total (kg)', 'Peso MÃ©dio/VeÃ­culo (kg)', 'Qtd. Pedidos']],
            body: bodyVarejo,
            startY: finalY + 6,
            headStyles: { fillColor: [0, 191, 165], textColor: 255 }
        });
        finalY = doc.lastAutoTable.finalY; // Atualiza a posiÃ§Ã£o Y
    }

    // Outras Categorias (Re-adicionado)
    const bodyOutros = [];
    if (pedidosTransferencias.length > 0) bodyOutros.push(['TransferÃªncias', pedidosTransferencias.length, pedidosTransferencias.reduce((s, p) => s + p.Quilos_Saldo, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })]);
    if (pedidosExportacao.length > 0) bodyOutros.push(['ExportaÃ§Ã£o', pedidosExportacao.length, pedidosExportacao.reduce((s, p) => s + p.Quilos_Saldo, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })]);

    const totalPedidosTruck = Object.values(gruposPorCFGlobais).reduce((sum, g) => sum + g.pedidos.length, 0);
    const totalPesoTruck = Object.values(gruposPorCFGlobais).reduce((sum, g) => sum + g.totalKg, 0);
    if (totalPedidosTruck > 0) {
        bodyOutros.push(['Truck / Carreta', totalPedidosTruck, totalPesoTruck.toLocaleString('pt-BR', { minimumFractionDigits: 2 })]);
    }
    if (pedidosFuncionarios.length > 0) bodyOutros.push(['FuncionÃ¡rios', pedidosFuncionarios.length, pedidosFuncionarios.reduce((s, p) => s + p.Quilos_Saldo, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })]);

    if (bodyOutros.length > 0) {
        finalY += 10; // Adiciona um espaÃ§o
        doc.setFontSize(14);
        doc.setTextColor(40);
        doc.text("Outras Categorias de Pedidos", 14, finalY);
        doc.autoTable({
            head: [['Categoria', 'Qtd. Pedidos', 'Peso Total (kg)']],
            body: bodyOutros,
            startY: finalY + 6,
            headStyles: { fillColor: [80, 90, 110], textColor: 255 }
        });
    }

    // RodapÃ© e Salvamento
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`PÃ¡gina ${i} de ${pageCount}`, doc.internal.pageSize.width / 2, 287, { align: 'center' });
        doc.text('Este Ã© um relatÃ³rio de previsÃ£o e pode sofrer alteraÃ§Ãµes.', 14, 287);
    }

    doc.save(`Previsao_Expedicao_${today.replace(/\//g, '-')}.pdf`);
}

function exportarRelatorioDisponiveisPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const allAllocatedIds = new Set();
    Object.values(activeLoads).forEach(l => l.pedidos.forEach(p => allAllocatedIds.add(String(p.Num_Pedido))));

    // 1. Coletar todos os pedidos disponÃ­veis (Varejo + Toco) com identificaÃ§Ã£o de tipo
    let todosPedidos = pedidosGeraisAtuais.filter(p => !allAllocatedIds.has(String(p.Num_Pedido))).map(p => {
        const tipo = String(p.Cod_Rota || '').startsWith('2') ? 'Varejo SÃ£o Paulo' : 'Varejo';
        return { data: p, tipo: tipo };
    });

    // Adiciona pedidos de Toco disponÃ­veis
    Object.values(gruposToco).forEach(grupo => {
        grupo.pedidos.forEach(p => {
            if (!allAllocatedIds.has(String(p.Num_Pedido))) {
                todosPedidos.push({ data: p, tipo: 'Carga de Toco' });
            }
        });
    });

    if (todosPedidos.length === 0) {
        showToast("NÃ£o hÃ¡ pedidos disponÃ­veis para gerar o relatÃ³rio.", 'warning');
        return;
    }

    // 2. Ordenar estritamente por Dat_Ped (Mais antigo primeiro)
    todosPedidos.sort((a, b) => {
        const pA = a.data;
        const pB = b.data;
        const dateA = pA.Dat_Ped instanceof Date ? pA.Dat_Ped : new Date(pA.Dat_Ped || '9999-12-31');
        const dateB = pB.Dat_Ped instanceof Date ? pB.Dat_Ped : new Date(pB.Dat_Ped || '9999-12-31');
        return dateA - dateB;
    });

    // 3. ConfiguraÃ§Ã£o do PDF
    const today = new Date().toLocaleDateString('pt-BR');
    doc.setFontSize(16);
    doc.text("RelatÃ³rio de Fila de Pedidos (Por Data)", 14, 20);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Gerado em: ${today} - Total Pendente: ${todosPedidos.length} pedidos`, 14, 28);

    const tableColumn = ["Data Ped.", "Rota", "CÃ³d.", "Cliente", "Pedido", "Tipo", "Peso (kg)"];
    const tableRows = [];

    todosPedidos.forEach(item => {
        const p = item.data;
        let dataFormatada = "S/ Data";
        if (p.Dat_Ped) {
            const d = p.Dat_Ped instanceof Date ? p.Dat_Ped : new Date(p.Dat_Ped);
            if (!isNaN(d)) {
                dataFormatada = d.toLocaleDateString('pt-BR');
            }
        }

        const rowData = [
            dataFormatada,
            String(p.Cod_Rota || ''),
            normalizeClientId(p.Cliente),
            String(p.Nome_Cliente || '').substring(0, 25), // Limita tamanho do nome
            String(p.Num_Pedido),
            item.tipo,
            p.Quilos_Saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
        ];
        tableRows.push(rowData);
    });

    doc.autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 35,
        theme: 'striped',
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: [41, 128, 185] },
        columnStyles: {
            0: { fontStyle: 'bold' }, // Data em negrito
            6: { halign: 'right' }    // Peso alinhado Ã  direita
        }
    });

    doc.save(`Relatorio_Fila_Pedidos_${today.replace(/\//g, '-')}.pdf`);
    showToast("RelatÃ³rio de fila gerado com sucesso!", 'success');
}

function exportarRelatorioDisponiveisExcel() {
    const allAllocatedIds = new Set();
    Object.values(activeLoads).forEach(l => l.pedidos.forEach(p => allAllocatedIds.add(String(p.Num_Pedido))));

    // 1. Coletar todos os pedidos disponÃ­veis (Varejo + Toco)
    let todosPedidos = pedidosGeraisAtuais.filter(p => !allAllocatedIds.has(String(p.Num_Pedido))).map(p => ({ ...p, Tipo: String(p.Cod_Rota || '').startsWith('2') ? 'Varejo SÃ£o Paulo' : 'Varejo' }));

    Object.values(gruposToco).forEach(grupo => {
        grupo.pedidos.forEach(p => {
            if (!allAllocatedIds.has(String(p.Num_Pedido))) {
                todosPedidos.push({ ...p, Tipo: 'Carga de Toco' });
            }
        });
    });

    if (todosPedidos.length === 0) {
        showToast("NÃ£o hÃ¡ pedidos disponÃ­veis para gerar o relatÃ³rio.", 'warning');
        return;
    }

    // 2. Ordenar por Data
    todosPedidos.sort((a, b) => {
        const dateA = a.Dat_Ped instanceof Date ? a.Dat_Ped : new Date(a.Dat_Ped || '9999-12-31');
        const dateB = b.Dat_Ped instanceof Date ? b.Dat_Ped : new Date(b.Dat_Ped || '9999-12-31');
        return dateA - dateB;
    });

    // 3. Preparar dados para Excel
    const dataToExport = todosPedidos.map(p => ({
        'Data Pedido': p.Dat_Ped,
        'Rota': p.Cod_Rota,
        'CÃ³digo Cliente': normalizeClientId(p.Cliente),
        'Nome Cliente': p.Nome_Cliente,
        'NÃºmero Pedido': p.Num_Pedido,
        'Tipo': p.Tipo,
        'Peso (kg)': p.Quilos_Saldo,
        'Cidade': p.Cidade,
        'UF': p.UF
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport, { cellDates: true });
    const wscols = [{ wch: 12 }, { wch: 8 }, { wch: 10 }, { wch: 30 }, { wch: 12 }, { wch: 15 }, { wch: 10 }, { wch: 20 }, { wch: 5 }];
    worksheet['!cols'] = wscols;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Fila de Pedidos");

    const today = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
    XLSX.writeFile(workbook, `Relatorio_Fila_Pedidos_${today}.xlsx`);
    showToast("RelatÃ³rio Excel gerado com sucesso!", 'success');
}

function exportarRelatorioCompletoPorRotaExcel() {
    const allAllocatedIds = new Set();
    Object.values(activeLoads).forEach(l => l.pedidos.forEach(p => allAllocatedIds.add(String(p.Num_Pedido))));

    // 1. Pedidos Varejo DisponÃ­veis
    const pedidosVarejoReais = pedidosGeraisAtuais.filter(p => !allAllocatedIds.has(String(p.Num_Pedido)));

    // 2. Pedidos Toco DisponÃ­veis
    const pedidosTocoDisponiveis = [];
    Object.values(gruposToco).forEach(grupo => {
        grupo.pedidos.forEach(p => {
            if (!allAllocatedIds.has(String(p.Num_Pedido))) pedidosTocoDisponiveis.push(p);
        });
    });

    const todosPedidos = [...pedidosVarejoReais, ...pedidosTocoDisponiveis];

    if (todosPedidos.length === 0) {
        showToast("NÃ£o hÃ¡ pedidos disponÃ­veis para gerar o relatÃ³rio.", 'warning');
        return;
    }

    // Helper para nome da rota
    const getRouteDisplayName = (rota) => {
        const config = rotaVeiculoMap[rota] || { type: 'van', title: '' };
        const veiculo = config.type;

        if (veiculo === 'van' && !config.title?.startsWith('Rota 1')) {
            return `Rota: ${rota} (VAN-3/4- SP)`;
        } else {
            const veiculoNome = veiculo.replace('tresQuartos', '3/4').replace(/^\w/, c => c.toUpperCase());
            return `Rota: ${rota} (${veiculoNome})`;
        }
    };

    // Ordenar para corresponder Ã  sequÃªncia da UI "DisponÃ­veis Varejo"
    const vehicleOrder = { 'fiorino': 1, 'van': 2, 'tresQuartos': 3 };
    const numericSort = (a, b) => a.localeCompare(b, undefined, { numeric: true });

    todosPedidos.sort((a, b) => {
        const rotaA = String(a.Cod_Rota || '0');
        const rotaB = String(b.Cod_Rota || '0');

        if (rotaA === '0' && rotaB !== '0') return -1;
        if (rotaB === '0' && rotaA !== '0') return 1;

        const typeA = rotaVeiculoMap[rotaA]?.type || 'van';
        const typeB = rotaVeiculoMap[rotaB]?.type || 'van';

        const orderA = vehicleOrder[typeA] || 99;
        const orderB = vehicleOrder[typeB] || 99;

        if (orderA !== orderB) {
            return orderA - orderB;
        }

        if (typeA === 'van' && typeB === 'van') {
            const isParanaA = rotaVeiculoMap[rotaA]?.title.startsWith('Rota 1');
            const isParanaB = rotaVeiculoMap[rotaB]?.title.startsWith('Rota 1');
            if (isParanaA && !isParanaB) return -1;
            if (!isParanaA && isParanaB) return 1;
        }

        const rotaCompare = numericSort(rotaA, rotaB);
        if (rotaCompare !== 0) return rotaCompare;

        return (a.Nome_Cliente || '').localeCompare(b.Nome_Cliente || '');
    });

    // Preparar dados
    const dataToExport = todosPedidos.map(p => ({
        'Rota DescriÃ§Ã£o': getRouteDisplayName(p.Cod_Rota),
        'CÃ³d. Rota': p.Cod_Rota,
        'NÃºmero Pedido': p.Num_Pedido,
        'Cliente': normalizeClientId(p.Cliente),
        'Nome Cliente': p.Nome_Cliente,
        'Cidade': p.Cidade,
        'UF': p.UF,
        'Peso (kg)': p.Quilos_Saldo,
        'Cubagem': p.Cubagem,
        'Data Pedido': p.Dat_Ped
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport, { cellDates: true });

    // Ajuste de largura das colunas
    const wscols = [
        { wch: 30 }, // Rota DescriÃ§Ã£o
        { wch: 10 }, // CÃ³d. Rota
        { wch: 15 }, // NÃºmero Pedido
        { wch: 10 }, // Cliente
        { wch: 30 }, // Nome Cliente
        { wch: 20 }, // Cidade
        { wch: 5 },  // UF
        { wch: 12 }, // Peso
        { wch: 10 }, // Cubagem
        { wch: 12 }  // Data
    ];
    worksheet['!cols'] = wscols;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Pedidos por Rota");

    const today = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
    XLSX.writeFile(workbook, `Relatorio_Completo_Rotas_${today}.xlsx`);
    showToast("RelatÃ³rio Excel (Por Rota) gerado com sucesso!", 'success');
}

function exportarRelatorioCompletoPorRotaPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'mm', 'a4'); // Paisagem para caber mais colunas

    // SEGURANÃ‡A: Garante que a lista reflita exatamente o que estÃ¡ disponÃ­vel, excluindo alocados
    const allAllocatedIds = new Set();
    Object.values(activeLoads).forEach(l => l.pedidos.forEach(p => allAllocatedIds.add(String(p.Num_Pedido))));

    // 1. Pedidos Varejo DisponÃ­veis
    const pedidosVarejoReais = pedidosGeraisAtuais.filter(p => !allAllocatedIds.has(String(p.Num_Pedido)));

    // 2. Pedidos Toco DisponÃ­veis (ainda na aba Toco, nÃ£o montados)
    const pedidosTocoDisponiveis = [];
    Object.values(gruposToco).forEach(grupo => {
        grupo.pedidos.forEach(p => {
            if (!allAllocatedIds.has(String(p.Num_Pedido))) pedidosTocoDisponiveis.push(p);
        });
    });

    const todosPedidos = [...pedidosVarejoReais, ...pedidosTocoDisponiveis];

    if (todosPedidos.length === 0) {
        showToast("NÃ£o hÃ¡ pedidos disponÃ­veis para gerar o relatÃ³rio.", 'warning');
        return;
    }

    // Agrupar por Rota
    const grouped = todosPedidos.reduce((acc, p) => {
        const rota = p.Cod_Rota || 'Sem Rota';
        if (!acc[rota]) acc[rota] = [];
        acc[rota].push(p);
        return acc;
    }, {});

    // Ordenar Rotas
    const sortedRoutes = Object.keys(grouped).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    const today = new Date().toLocaleDateString('pt-BR');
    doc.setFontSize(16);
    doc.text("RelatÃ³rio Completo de Pedidos DisponÃ­veis (Por Rota)", 14, 15);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Gerado em: ${today}`, 14, 22);

    const tableColumn = ["Cod Rota", "Cliente", "Nome Cliente", "Agend.", "Num Pedido", "Quilos Saldo", "Cubagem", "Cidade", "UF", "Predat", "Dat Ped"];
    const tableRows = [];

    sortedRoutes.forEach(rota => {
        const pedidos = grouped[rota];
        // Ordenar por Nome do Cliente dentro da rota
        pedidos.sort((a, b) => (a.Nome_Cliente || '').localeCompare(b.Nome_Cliente || ''));

        pedidos.forEach(p => {
            const formatDate = (d) => {
                if (!d) return '';
                const dateObj = d instanceof Date ? d : new Date(d);
                return isNaN(dateObj) ? '' : dateObj.toLocaleDateString('pt-BR');
            };

            const rowData = [
                String(p.Cod_Rota || ''),
                normalizeClientId(p.Cliente),
                String(p.Nome_Cliente || '').substring(0, 30),
                p.Agendamento || 'NÃ£o',
                String(p.Num_Pedido),
                p.Quilos_Saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
                p.Cubagem.toLocaleString('pt-BR', { minimumFractionDigits: 3 }),
                String(p.Cidade || ''),
                String(p.UF || ''),
                formatDate(p.Predat),
                formatDate(p.Dat_Ped)
            ];
            tableRows.push(rowData);
        });
    });

    doc.autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 28,
        theme: 'striped',
        styles: { fontSize: 8, cellPadding: 1.5 },
        headStyles: { fillColor: [41, 128, 185] },
        columnStyles: {
            5: { halign: 'right' }, // Peso
            6: { halign: 'right' }  // Cubagem
        }
    });

    doc.save(`Relatorio_Completo_Rotas_${today.replace(/\//g, '-')}.pdf`);
    showToast("RelatÃ³rio PDF gerado com sucesso!", 'success');
}

// --- FUNÃ‡Ã•ES AUXILIARES PARA GEOLOCALIZAÃ‡ÃƒO E CLUSTERIZAÃ‡ÃƒO ---
function deg2rad(deg) { return deg * (Math.PI / 180); }

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Raio da Terra em km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

const cityCoordsCache = JSON.parse(localStorage.getItem('cityCoordsCache')) || {};

async function getCityCoordinates(cidade, uf) {
    const key = `${cidade.trim().toUpperCase()}-${uf.trim().toUpperCase()}`;
    if (cityCoordsCache[key]) return cityCoordsCache[key];

    const apiKey = document.getElementById('graphhopperApiKey').value;
    if (!apiKey) return null;

    try {
        const query = `${cidade}, ${uf}, Brasil`;
        const response = await fetch(`https://graphhopper.com/api/1/geocode?q=${encodeURIComponent(query)}&key=${apiKey}`);
        if (!response.ok) return null;
        const data = await response.json();
        if (data.hits && data.hits.length > 0) {
            const point = data.hits[0].point;
            cityCoordsCache[key] = { lat: point.lat, lng: point.lng };
            localStorage.setItem('cityCoordsCache', JSON.stringify(cityCoordsCache));
            return cityCoordsCache[key];
        }
    } catch (e) {
        console.error(`Erro ao buscar coordenadas para ${key}:`, e);
    }
    return null;
}

function processarPriorizacaoEmMassa() {
    const input = document.getElementById('bulkPriorityInput');
    if (!input) return;
    const orderNumbers = input.value.split(/[\n,\s\t]+/).map(s => s.trim()).filter(s => s.length > 0);

    if (orderNumbers.length === 0) { showToast("Nenhum nÃºmero de pedido encontrado.", "warning"); return; }

    let countAdded = 0;
    orderNumbers.forEach(num => {
        if (!pedidosPrioritarios.includes(num)) { pedidosPrioritarios.push(num); countAdded++; }
    });

    if (countAdded > 0) {
        saveStateToLocalStorage();
        renderAllUI(); // Atualiza toda a interface para refletir as prioridades
        showToast(`${countAdded} pedidos priorizados com sucesso!`, "success");

        // AUDIT LOG
        if (window.triggerLogActivity) window.triggerLogActivity('PRIORIZACAO_EM_MASSA', { qtd: countAdded });

        input.value = '';
        const modal = bootstrap.Modal.getInstance(document.getElementById('bulkPriorityModal'));
        if (modal) modal.hide();
    } else { showToast("Todos os pedidos informados jÃ¡ eram prioritÃ¡rios.", "info"); }
}

/**
 * NOVO: FunÃ§Ã£o para montar cargas automaticamente baseadas nos pedidos prioritÃ¡rios.
 * Identifica as rotas que possuem pedidos marcados como prioridade e processa apenas elas.
 */
async function montarCargasPrioritarias() {
    // 1. Identificar pedidos prioritÃ¡rios que ainda estÃ£o disponÃ­veis (nÃ£o alocados)
    const pedidosPrioritariosDisponiveis = pedidosGeraisAtuais.filter(p =>
        pedidosPrioritarios.includes(String(p.Num_Pedido)) ||
        pedidosRecall.includes(String(p.Num_Pedido))
    );

    if (pedidosPrioritariosDisponiveis.length === 0) {
        showToast("NÃ£o hÃ¡ pedidos prioritÃ¡rios pendentes na lista de disponÃ­veis.", "info");
        return;
    }

    // 2. Identificar as rotas Ãºnicas desses pedidos
    const rotasParaProcessar = [...new Set(pedidosPrioritariosDisponiveis.map(p => String(p.Cod_Rota)))];
    rotasParaProcessar.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    const confirmMsg = `Encontrei ${pedidosPrioritariosDisponiveis.length} pedido(s) prioritÃ¡rio(s) distribuÃ­do(s) em ${rotasParaProcessar.length} rota(s):\n\nRotas: ${rotasParaProcessar.join(', ')}\n\nDeseja montar as cargas para essas rotas agora? O sistema tentarÃ¡ incluir os prioritÃ¡rios e completar a carga com outros pedidos da rota.`;

    if (!confirm(confirmMsg)) return;

    showToast(`Iniciando montagem automÃ¡tica para ${rotasParaProcessar.length} rotas...`, "info");

    // Limpa mensagens de sucesso antigas antes de comeÃ§ar o lote para evitar acÃºmulo
    document.querySelectorAll('.route-success-message').forEach(el => el.remove());

    // 3. Processar cada rota sequencialmente
    for (const rota of rotasParaProcessar) {
        // Determina as configuraÃ§Ãµes da rota (tipo de veÃ­culo, tÃ­tulo, etc.)
        let config = rotaVeiculoMap[rota];

        // Fallback para rotas de SP ou nÃ£o mapeadas
        if (!config) {
            config = { type: 'van', title: `Rota ${rota} (AutomÃ¡tica)` };
        }

        // Determina o ID da div de destino baseado no tipo de veÃ­culo
        const divId = config.type === 'fiorino' ? 'resultado-fiorino-geral' :
            (config.type === 'van' ? 'resultado-van-geral' : 'resultado-34-geral');

        // Chama a funÃ§Ã£o de separaÃ§Ã£o existente
        // Passamos 'null' no botÃ£o pois Ã© uma chamada automÃ¡tica
        // Passamos 'true' para isBatchMode para nÃ£o limpar as cargas anteriores
        await separarCargasGeneric(rota, divId, config.title, config.type, null, true);

        // Pequena pausa para a UI respirar e nÃ£o travar
        await new Promise(r => setTimeout(r, 500));
    }

    // 4. Atualiza a interface geral para garantir que tudo esteja sincronizado
    renderAllUI();
    showToast("Processamento de cargas prioritÃ¡rias concluÃ­do!", "success");
}

/**
 * NOVO: FunÃ§Ã£o para montar todas as rotas disponÃ­veis sequencialmente.
 * Simula o clique manual em cada botÃ£o de rota.
 */
async function montarTodasAsRotas() {
    if (pedidosGeraisAtuais.length === 0) {
        showToast("NÃ£o hÃ¡ pedidos disponÃ­veis para montar.", "info");
        return;
    }

    // Identifica rotas Ãºnicas presentes nos pedidos disponÃ­veis
    const rotasDisponiveis = [...new Set(pedidosGeraisAtuais.map(p => String(p.Cod_Rota)))];

    if (rotasDisponiveis.length === 0) return;

    const rotasOrdenadas = getSortedVarejoRoutes(rotasDisponiveis);

    if (!confirm(`Deseja iniciar a montagem automÃ¡tica para ${rotasOrdenadas.length} rotas? O processo serÃ¡ executado sequencialmente.`)) return;

    showToast(`Iniciando montagem automÃ¡tica de ${rotasOrdenadas.length} rotas...`, "info");

    // Remove mensagens de sucesso anteriores
    document.querySelectorAll('.route-success-message').forEach(el => el.remove());

    const processedInThisBatch = new Set();

    for (const rota of rotasOrdenadas) {
        if (processedInThisBatch.has(rota)) continue;

        let config = rotaVeiculoMap[rota];
        if (!config) config = { type: 'van', title: `Rota ${rota} (AutomÃ¡tica)` };

        let rotasParaProcessar = rota;
        if (config.combined) {
            const combinedRoutes = [rota, ...config.combined];
            if (combinedRoutes.some(r => rotasDisponiveis.includes(r))) {
                rotasParaProcessar = combinedRoutes;
                combinedRoutes.forEach(r => processedInThisBatch.add(r));
            } else processedInThisBatch.add(rota);
        } else processedInThisBatch.add(rota);

        const divId = config.type === 'fiorino' ? 'resultado-fiorino-geral' : (config.type === 'van' ? 'resultado-van-geral' : 'resultado-34-geral');
        await separarCargasGeneric(rotasParaProcessar, divId, config.title, config.type, null, true);
        await new Promise(r => setTimeout(r, 300));
    }

    renderAllUI();
    showToast("Montagem automÃ¡tica de todas as rotas concluÃ­da!", "success");
}

async function processarRoteirizacaoLista() {
    const input = document.getElementById('roteiroPedidosInput');
    const useGeo = document.getElementById('roteiroGeoCheck').checked;

    const orderNumbers = input.value.split(/[\n,\s]+/).map(s => s.trim()).filter(Boolean);
    if (orderNumbers.length === 0) { showToast("Insira os nÃºmeros dos pedidos.", "warning"); return; }

    // Show processing modal
    const modalElement = document.getElementById('processing-modal');
    const modal = bootstrap.Modal.getOrCreateInstance(modalElement);
    const progressBar = document.getElementById('processing-progress-bar');
    const statusText = document.getElementById('processing-status-text');
    const thinkingText = document.getElementById('thinking-text');
    const detailsText = document.getElementById('processing-details-text');

    progressBar.style.width = '0%';
    statusText.textContent = `Roteirizando e Montando Cargas...`;
    thinkingText.textContent = "Identificando pedidos e calculando rotas...";
    detailsText.textContent = "";
    modal.show();
    startThinkingText();

    try {
        // Allow UI to render modal
        await new Promise(r => setTimeout(r, 100));

        const pedidosEncontrados = [];
        const pedidosNaoEncontrados = [];

        const availableMap = new Map(pedidosGeraisAtuais.map(p => [String(p.Num_Pedido), p]));

        orderNumbers.forEach(num => {
            if (availableMap.has(num)) {
                pedidosEncontrados.push(availableMap.get(num));
            } else {
                const leftover = currentLeftoversForPrinting.find(p => String(p.Num_Pedido) === num);
                if (leftover) pedidosEncontrados.push(leftover);
                else pedidosNaoEncontrados.push(num);
            }
        });

        if (pedidosEncontrados.length === 0) {
            modal.hide(); stopThinkingText();
            showToast("Nenhum pedido encontrado na lista de disponÃ­veis/sobras.", "error");
            return;
        }

        if (pedidosNaoEncontrados.length > 0) {
            showToast(`${pedidosNaoEncontrados.length} pedidos nÃ£o encontrados ou jÃ¡ alocados.`, "warning");
        }

        progressBar.style.width = '10%';
        thinkingText.textContent = "Mapeando cidades...";

        // 2. Map cities and get coordinates
        const uniqueCitiesMap = {};
        pedidosEncontrados.forEach(p => {
            const key = `${(p.Cidade || 'N/A').trim().toUpperCase()} - ${(p.UF || '').trim().toUpperCase()}`;
            if (!uniqueCitiesMap[key]) uniqueCitiesMap[key] = { pedidos: [], coords: null, key: key };
            uniqueCitiesMap[key].pedidos.push(p);
        });

        // PrÃ©-carrega coordenadas para todas as cidades encontradas
        if (useGeo) {
            const apiKey = document.getElementById('graphhopperApiKey').value;
            if (apiKey) {
                thinkingText.textContent = "Buscando coordenadas geogrÃ¡ficas...";
                const cityKeys = Object.keys(uniqueCitiesMap);
                for (let i = 0; i < cityKeys.length; i++) {
                    const cityKey = cityKeys[i];
                    const [cidade, uf] = cityKey.split(' - ');
                    const coords = await getCityCoordinates(cidade, uf);
                    if (coords) uniqueCitiesMap[cityKey].coords = coords;
                    progressBar.style.width = `${10 + (i / cityKeys.length) * 20}%`; // Progress 10% -> 30%
                }
            } else {
                showToast("API Key nÃ£o configurada. Agrupamento geogrÃ¡fico desativado.", "warning");
            }
        }

        // --- CLASSIFICAÃ‡ÃƒO DOS PEDIDOS POR VEÃCULO (Baseado na Rota) ---
        thinkingText.textContent = "Classificando pedidos por veÃ­culo...";
        const buckets = { fiorino: [], van: [], tresQuartos: [], toco: [] };
        const normalizeCity = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();

        pedidosEncontrados.forEach(p => {
            const rota = String(p.Cod_Rota);
            let type = 'van'; // PadrÃ£o

            // Verifica regras especiais de Fiorino (cidades permitidas)
            if (rotasEspeciaisFiorino[rota]) {
                const cidadePedido = normalizeCity(String(p.Cidade || '').split(',')[0]);
                if (new Set(rotasEspeciaisFiorino[rota]).has(cidadePedido)) {
                    type = 'fiorino';
                } else {
                    type = 'van'; // Se a cidade nÃ£o pode Fiorino, vai pra Van
                }
            } else if (rotaVeiculoMap[rota]) {
                type = rotaVeiculoMap[rota].type;
            }

            if (buckets[type]) buckets[type].push(p);
            else buckets.van.push(p);
        });

        // --- FUNÃ‡ÃƒO AUXILIAR DE OTIMIZAÃ‡ÃƒO POR ESTÃGIO ---
        const optimizeStage = async (orders, type) => {
            if (orders.length === 0) return { loads: [], leftovers: [] };

            // 1. Agrupar cidades prÃ³ximas (ClusterizaÃ§Ã£o)
            const stageCitiesMap = {};
            orders.forEach(p => {
                const key = `${(p.Cidade || 'N/A').trim().toUpperCase()} - ${(p.UF || '').trim().toUpperCase()}`;
                if (!stageCitiesMap[key]) stageCitiesMap[key] = { pedidos: [], coords: uniqueCitiesMap[key]?.coords, key: key };
                stageCitiesMap[key].pedidos.push(p);
            });

            const clusters = [];
            const assignedCities = new Set();
            const CLUSTER_RADIUS_KM = 50;

            for (const cityKey of Object.keys(stageCitiesMap)) {
                if (assignedCities.has(cityKey)) continue;
                const currentCluster = { cities: [stageCitiesMap[cityKey]], pedidos: [...stageCitiesMap[cityKey].pedidos] };
                assignedCities.add(cityKey);

                if (useGeo && stageCitiesMap[cityKey].coords) {
                    let addedInIteration;
                    do {
                        addedInIteration = false;
                        for (const otherCityKey of Object.keys(stageCitiesMap)) {
                            if (assignedCities.has(otherCityKey)) continue;
                            const otherCity = stageCitiesMap[otherCityKey];
                            if (!otherCity.coords) continue;
                            const isClose = currentCluster.cities.some(clusterCity => {
                                if (!clusterCity.coords) return false;
                                const dist = calculateDistance(clusterCity.coords.lat, clusterCity.coords.lng, otherCity.coords.lat, otherCity.coords.lng);
                                return dist <= CLUSTER_RADIUS_KM;
                            });
                            if (isClose) {
                                currentCluster.cities.push(otherCity);
                                currentCluster.pedidos.push(...otherCity.pedidos);
                                assignedCities.add(otherCityKey);
                                addedInIteration = true;
                            }
                        }
                    } while (addedInIteration);
                }
                clusters.push(currentCluster);
            }

            // 2. Otimizar cada cluster
            const stageLoads = [];
            const stageLeftovers = [];

            // ConfiguraÃ§Ãµes atuais
            const vehicleConfigs = {
                fiorinoMinCapacity: parseFloat(document.getElementById('fiorinoMinCapacity').value), fiorinoMaxCapacity: parseFloat(document.getElementById('fiorinoMaxCapacity').value), fiorinoCubage: parseFloat(document.getElementById('fiorinoCubage').value), fiorinoHardMaxCapacity: parseFloat(document.getElementById('fiorinoHardMaxCapacity').value), fiorinoHardCubage: parseFloat(document.getElementById('fiorinoHardCubage').value),
                vanMinCapacity: parseFloat(document.getElementById('vanMinCapacity').value), vanMaxCapacity: parseFloat(document.getElementById('vanMaxCapacity').value), vanCubage: parseFloat(document.getElementById('vanCubage').value), vanHardMaxCapacity: parseFloat(document.getElementById('vanHardMaxCapacity').value), vanHardCubage: parseFloat(document.getElementById('vanHardCubage').value),
                tresQuartosMinCapacity: parseFloat(document.getElementById('tresQuartosMinCapacity').value), tresQuartosMaxCapacity: parseFloat(document.getElementById('tresQuartosMaxCapacity').value), tresQuartosCubage: parseFloat(document.getElementById('tresQuartosCubage').value),
                tocoMinCapacity: parseFloat(document.getElementById('tocoMinCapacity').value), tocoMaxCapacity: parseFloat(document.getElementById('tocoMaxCapacity').value), tocoCubage: parseFloat(document.getElementById('tocoCubage').value)
            };

            for (const cluster of clusters) {
                const packableGroups = Object.values(cluster.pedidos.reduce((acc, p) => {
                    const cId = normalizeClientId(p.Cliente);
                    if (!acc[cId]) acc[cId] = { pedidos: [], totalKg: 0, totalCubagem: 0, isSpecial: isSpecialClient(p) };
                    acc[cId].pedidos.push(p); acc[cId].totalKg += p.Quilos_Saldo; acc[cId].totalCubagem += p.Cubagem;
                    return acc;
                }, {}));

                // Calcula a data mais antiga para priorizaÃ§Ã£o correta (Igual Ã  montagem normal)
                packableGroups.forEach(group => {
                    group.oldestDate = group.pedidos.reduce((oldest, p) => {
                        let pDate = p.Dat_Ped;
                        if (!pDate || (pDate instanceof Date && isNaN(pDate.getTime()))) {
                            pDate = p.Predat;
                        }
                        if (pDate) {
                            const dateObj = pDate instanceof Date ? pDate : new Date(pDate);
                            if (!isNaN(dateObj.getTime())) {
                                if (!oldest || dateObj < oldest) return dateObj;
                            }
                        }
                        return oldest;
                    }, null);
                });

                const processingWorker = new Worker('worker.js');
                processingWorker.postMessage({
                    command: 'start-optimization',
                    packableGroups: packableGroups,
                    vehicleType: type,
                    optimizationLevel: '2',
                    configs: vehicleConfigs,
                    pedidosPrioritarios: pedidosPrioritarios,
                    pedidosRecall: pedidosRecall
                });

                const result = await new Promise((resolve, reject) => {
                    processingWorker.onmessage = (e) => {
                        if (e.data.status === 'complete') resolve(e.data.result);
                        else if (e.data.status === 'error') reject(new Error(e.data.message));
                    };
                    processingWorker.onerror = (e) => reject(new Error(e.message));
                });
                processingWorker.terminate();

                // --- MELHORIA: Refinamento e AtribuiÃ§Ã£o de Tipo ---
                result.loads.forEach(l => l.vehicleType = type);
                const { refinedLoads, remainingLeftovers } = refineLoadsWithSimpleFit(result.loads, result.leftovers);

                // 3. VerificaÃ§Ã£o de DistÃ¢ncia
                if ((type === 'fiorino' || type === 'van') && useGeo) {
                    const distanceLimit = type === 'fiorino' ? 500 : 1400;
                    const depot = { lat: -23.31461, lng: -51.36963 };

                    refinedLoads.forEach(load => {
                        const citiesInLoad = [...new Set(load.pedidos.map(p => `${(p.Cidade || '').trim().toUpperCase()} - ${(p.UF || '').trim().toUpperCase()}`))];
                        let totalDistKm = 0;
                        let currentPos = depot;
                        let validDist = true;

                        // CÃ¡lculo aproximado da rota
                        for (const cityKey of citiesInLoad) {
                            const coords = uniqueCitiesMap[cityKey]?.coords;
                            if (coords) {
                                totalDistKm += calculateDistance(currentPos.lat, currentPos.lng, coords.lat, coords.lng);
                                currentPos = coords;
                            }
                        }
                        totalDistKm += calculateDistance(currentPos.lat, currentPos.lng, depot.lat, depot.lng);
                        const estimatedRoadDist = totalDistKm * 1.3;

                        if (estimatedRoadDist > distanceLimit) {
                            // Se exceder a distÃ¢ncia, desmonta a carga e joga para sobras (para tentar upgrade)
                            const groups = Object.values(load.pedidos.reduce((acc, p) => {
                                const cId = normalizeClientId(p.Cliente);
                                if (!acc[cId]) acc[cId] = { pedidos: [], totalKg: 0, totalCubagem: 0, isSpecial: isSpecialClient(p) };
                                acc[cId].pedidos.push(p); acc[cId].totalKg += p.Quilos_Saldo; acc[cId].totalCubagem += p.Cubagem;
                                return acc;
                            }, {}));
                            stageLeftovers.push(...groups);
                        } else {
                            stageLoads.push(load);
                        }
                    });
                } else {
                    stageLoads.push(...refinedLoads);
                }
                stageLeftovers.push(...remainingLeftovers);
            }
            return { loads: stageLoads, leftovers: stageLeftovers };
        };

        // --- EXECUÃ‡ÃƒO DO PIPELINE (CASCATA) ---
        const allCreatedLoads = [];

        // 1. FIORINO
        progressBar.style.width = '30%';
        thinkingText.textContent = "Processando cargas de Fiorino...";
        detailsText.textContent = "Tentando montar Fiorinos e verificando limites...";
        const fiorinoResult = await optimizeStage(buckets.fiorino, 'fiorino');
        allCreatedLoads.push(...fiorinoResult.loads.map(l => ({ ...l, vehicleType: 'fiorino' })));

        // Sobras de Fiorino vÃ£o para Van
        const ordersForVan = [...buckets.van, ...fiorinoResult.leftovers.flatMap(g => g.pedidos)];

        // 2. VAN
        progressBar.style.width = '50%';
        thinkingText.textContent = "Processando cargas de Van...";
        detailsText.textContent = "Incluindo sobras de Fiorino e rotas de Van...";
        const vanResult = await optimizeStage(ordersForVan, 'van');
        allCreatedLoads.push(...vanResult.loads.map(l => ({ ...l, vehicleType: 'van' })));

        // Sobras de Van vÃ£o para 3/4
        const ordersFor34 = [...buckets.tresQuartos, ...vanResult.leftovers.flatMap(g => g.pedidos)];

        // 3. 3/4
        progressBar.style.width = '70%';
        thinkingText.textContent = "Processando cargas de 3/4...";
        const tqResult = await optimizeStage(ordersFor34, 'tresQuartos');
        allCreatedLoads.push(...tqResult.loads.map(l => ({ ...l, vehicleType: 'tresQuartos' })));

        // Sobras de 3/4 vÃ£o para Toco
        const ordersForToco = [...buckets.toco, ...tqResult.leftovers.flatMap(g => g.pedidos)];

        // 4. TOCO
        progressBar.style.width = '90%';
        thinkingText.textContent = "Processando cargas de Toco...";
        const tocoResult = await optimizeStage(ordersForToco, 'toco');
        allCreatedLoads.push(...tocoResult.loads.map(l => ({ ...l, vehicleType: 'toco' })));

        // Sobras finais (nÃ£o couberam em nada)
        const finalLeftovers = tocoResult.leftovers.flatMap(g => g.pedidos);
        if (finalLeftovers.length > 0) {
            showToast(`${finalLeftovers.length} pedidos nÃ£o couberam em nenhum veÃ­culo e voltaram para a lista.`, 'warning');
        }

        let loads = allCreatedLoads;

        // 6. Finalize
        progressBar.style.width = '95%';
        thinkingText.textContent = "Finalizando...";

        // Limpa o container de roteirizados antes de adicionar novos
        const roteirizadosContainer = document.getElementById('resultado-roteirizados');
        if (roteirizadosContainer) roteirizadosContainer.innerHTML = '';

        // Pequeno delay para garantir que a UI atualize antes de travar na renderizaÃ§Ã£o
        setTimeout(() => {
            try {
                const vehicleInfo = { fiorino: { name: 'Fiorino', colorClass: 'bg-success', textColor: 'text-white', icon: 'bi-box-seam-fill' }, van: { name: 'Van', colorClass: 'bg-primary', textColor: 'text-white', icon: 'bi-truck-front-fill' }, tresQuartos: { name: '3/4', colorClass: 'bg-warning', textColor: 'text-dark', icon: 'bi-truck-flatbed' }, toco: { name: 'Toco', colorClass: 'bg-secondary', textColor: 'text-white', icon: 'bi-inboxes-fill' } };
                if (!loads) loads = [];
                loads.forEach((load, idx) => {
                    load.numero = `R-${Date.now().toString().slice(-4)}-${idx + 1}`;
                    load.id = `roteiro-${Date.now()}-${idx}`;
                    const citiesInLoad = [...new Set(load.pedidos.map(p => p.Cidade))];
                    load.observation = `RoteirizaÃ§Ã£o por Lista (${citiesInLoad.length} cidades)`;
                    activeLoads[load.id] = load;

                    // Agora direciona todas as cargas para o container de roteirizados
                    if (roteirizadosContainer) {
                        const cardHtml = renderLoadCard(load, load.vehicleType, vehicleInfo[load.vehicleType]);
                        roteirizadosContainer.insertAdjacentHTML('beforeend', cardHtml);
                    }
                });

                // Remove apenas os pedidos que foram efetivamente alocados em cargas vÃ¡lidas
                const usedIds = new Set(loads.flatMap(l => l.pedidos.map(p => String(p.Num_Pedido))));
                pedidosGeraisAtuais = pedidosGeraisAtuais.filter(p => !usedIds.has(String(p.Num_Pedido)));
                currentLeftoversForPrinting = currentLeftoversForPrinting.filter(p => !usedIds.has(String(p.Num_Pedido)));

                const gruposGerais = pedidosGeraisAtuais.reduce((acc, p) => { const rota = p.Cod_Rota; if (!acc[rota]) { acc[rota] = { pedidos: [], totalKg: 0 }; } acc[rota].pedidos.push(p); acc[rota].totalKg += p.Quilos_Saldo; return acc; }, {});
                displayGerais(document.getElementById('resultado-geral'), gruposGerais);

                progressBar.style.width = '100%';
                updateAndRenderKPIs();
                updateAndRenderChart();
                saveStateToLocalStorage();

                modal.hide();
                stopThinkingText();

                const modalEl = document.getElementById('roteirizacaoModal');
                const inputModal = bootstrap.Modal.getInstance(modalEl);
                if (inputModal) inputModal.hide();

                // Muda para a aba de Roteirizados
                const tabBtn = document.getElementById('roteirizados-tab-btn');
                if (tabBtn) { const tab = new bootstrap.Tab(tabBtn); tab.show(); }

                showToast(`${loads.length} cargas criadas com sucesso!`, "success");
            } catch (innerError) {
                console.error("Erro na renderizaÃ§Ã£o final:", innerError);
                modal.hide();
                stopThinkingText();
                showToast("Erro ao finalizar montagem: " + innerError.message, "error");
            }
        }, 100);

    } catch (e) {
        console.error(e);
        modal.hide();
        stopThinkingText();
        showToast("Erro ao processar: " + e.message, "error");
    }
}

// ================================================================================================
//  LÃ“GICA DE PERSISTÃŠNCIA DE ESTADO
// ================================================================================================

async function saveStateToLocalStorage() {
    if (typeof (Storage) === "undefined") {
        console.warn("Seu navegador nÃ£o suporta Local Storage. O progresso nÃ£o serÃ¡ salvo.");
        return;
    }
    try {
        const state = {
            originalColumnHeaders,
            pedidosGeraisAtuais,
            gruposToco,
            gruposPorCFGlobais,
            pedidosComCFNumericoIsolado,
            pedidosManualmenteBloqueadosAtuais,
            pedidosPrioritarios: Array.from(pedidosPrioritarios),
            pedidosBloqueados: Array.from(pedidosBloqueados),
            pedidosRecall: Array.from(pedidosRecall),
            pedidosEspeciaisProcessados: Array.from(pedidosEspeciaisProcessados),
            pedidosSemCorte: Array.from(pedidosSemCorte),
            pedidosVendaAntecipadaProcessados: Array.from(pedidosVendaAntecipadaProcessados),
            rota1SemCarga,
            pedidosFuncionarios,
            pedidosCarretaSemCF,
            pedidosTransferencias,
            pedidosExportacao,
            cargasFechadasPR,
            pedidosMoinho,
            pedidosMarcaPropria,
            tocoPedidoIds: Array.from(tocoPedidoIds),
            allSaoPauloLeftovers, // NOVO: Salva as sobras de SP
            currentLeftoversForPrinting,
            activeLoads,
            kpiData,
            processedRoutes: Array.from(processedRoutes), // Salva as rotas processadas
            processedRouteContexts: processedRouteContexts, // Salva os contextos
            lastActiveTab: localStorage.getItem('lastActiveTab') || '#fiorino-tab-pane' // Salva a aba ativa
        };
        localStorage.setItem('logisticsAppState', JSON.stringify(state));
        console.log("Estado da aplicaÃ§Ã£o salvo no Local Storage.");
    } catch (e) {
        console.error("Erro ao salvar o estado no Local Storage:", e);
        showToast("Erro ao salvar o estado. O armazenamento pode estar cheio.", 'error');
    }
}

async function saveRouteContext(context) {
    // Agora apenas atualiza a variÃ¡vel global. O salvamento ocorre em saveStateToLocalStorage.
    if (!processedRouteContexts) {
        processedRouteContexts = {};
    }
    processedRouteContexts[context.routesKey] = context;
}

async function loadStateFromLocalStorage() {
    if (typeof (Storage) === "undefined") return;

    const savedStateJSON = localStorage.getItem('logisticsAppState');
    if (!savedStateJSON) {
        console.log("Nenhum estado salvo encontrado.");
        return;
    }

    try {
        // NOVO: Carrega os dados brutos da planilha do IndexedDB
        const savedPlanilha = await loadPlanilhaFromDb();
        if (savedPlanilha) {
            planilhaData = savedPlanilha;
            console.log("Dados da planilha restaurados do IndexedDB.");
            // Simula o evento de carregamento de arquivo para re-popular a UI,
            // mas com um flag para nÃ£o limpar o estado.
            const fileInfo = { name: localStorage.getItem('lastFileName') || 'planilha-salva.xlsx' };
            if (fileInput) fileInput.files[0] = new File([], fileInfo.name); // Apenas para UI
            handleFile(new File([], fileInfo.name), true);

        } else {
            console.log("Nenhum dado de planilha encontrado no IndexedDB.");
        }

        const savedState = JSON.parse(savedStateJSON);

        // FunÃ§Ã£o auxiliar para garantir que as datas sejam objetos Date
        const reviveDates = (data) => {
            if (!data) return [];
            return data.map(item => {
                if (item.Predat && typeof item.Predat === 'string') item.Predat = new Date(item.Predat);
                if (item.Dat_Ped && typeof item.Dat_Ped === 'string') item.Dat_Ped = new Date(item.Dat_Ped);
                return item;
            });
        };

        originalColumnHeaders = savedState.originalColumnHeaders || [];
        pedidosGeraisAtuais = savedState.pedidosGeraisAtuais || [];
        gruposToco = savedState.gruposToco || {};
        gruposPorCFGlobais = savedState.gruposPorCFGlobais || {};
        pedidosComCFNumericoIsolado = savedState.pedidosComCFNumericoIsolado || [];
        pedidosManualmenteBloqueadosAtuais = savedState.pedidosManualmenteBloqueadosAtuais || [];
        pedidosPrioritarios = savedState.pedidosPrioritarios || [];
        pedidosRecall = savedState.pedidosRecall || [];
        pedidosBloqueados = new Set(savedState.pedidosBloqueados || []);
        pedidosEspeciaisProcessados = new Set(savedState.pedidosEspeciaisProcessados || []);
        pedidosSemCorte = new Set(savedState.pedidosSemCorte || []);
        pedidosVendaAntecipadaProcessados = new Set(savedState.pedidosVendaAntecipadaProcessados || []);
        rota1SemCarga = savedState.rota1SemCarga || [];
        pedidosFuncionarios = savedState.pedidosFuncionarios || [];
        pedidosCarretaSemCF = savedState.pedidosCarretaSemCF || [];
        pedidosTransferencias = savedState.pedidosTransferencias || [];
        pedidosExportacao = savedState.pedidosExportacao || [];
        cargasFechadasPR = savedState.cargasFechadasPR || [];
        pedidosMoinho = savedState.pedidosMoinho || [];
        pedidosMarcaPropria = savedState.pedidosMarcaPropria || [];
        tocoPedidoIds = new Set(savedState.tocoPedidoIds || []);
        allSaoPauloLeftovers = savedState.allSaoPauloLeftovers || []; // NOVO: Carrega as sobras de SP
        currentLeftoversForPrinting = savedState.currentLeftoversForPrinting || [];
        activeLoads = savedState.activeLoads || {};
        kpiData = savedState.kpiData || {};
        processedRoutes = new Set(savedState.processedRoutes || []);
        processedRouteContexts = savedState.processedRouteContexts || {};
        localStorage.setItem('lastActiveTab', savedState.lastActiveTab); // Restaura a aba salva

        // NOVO: Habilita o botÃ£o se houver sobras de SP salvas
        const exportBtn = document.getElementById('export-sobras-sp-btn');
        if (exportBtn) {
            exportBtn.disabled = !allSaoPauloLeftovers || allSaoPauloLeftovers.length === 0;
        }

        // Reconverte as strings de data para objetos Date em todas as listas relevantes
        pedidosGeraisAtuais = reviveDates(pedidosGeraisAtuais);
        pedidosComCFNumericoIsolado = reviveDates(pedidosComCFNumericoIsolado);
        pedidosManualmenteBloqueadosAtuais = reviveDates(pedidosManualmenteBloqueadosAtuais);
        rota1SemCarga = reviveDates(rota1SemCarga);
        pedidosFuncionarios = reviveDates(pedidosFuncionarios);
        pedidosCarretaSemCF = reviveDates(pedidosCarretaSemCF);
        pedidosTransferencias = reviveDates(pedidosTransferencias);
        pedidosExportacao = reviveDates(pedidosExportacao);
        cargasFechadasPR = reviveDates(cargasFechadasPR);
        pedidosMoinho = reviveDates(pedidosMoinho);
        pedidosMarcaPropria = reviveDates(pedidosMarcaPropria);
        currentLeftoversForPrinting = reviveDates(currentLeftoversForPrinting);
        Object.values(activeLoads).forEach(load => load.pedidos = reviveDates(load.pedidos));
        Object.values(gruposToco).forEach(group => group.pedidos = reviveDates(group.pedidos));
        Object.values(gruposPorCFGlobais).forEach(group => group.pedidos = reviveDates(group.pedidos));

        // Se nÃ£o houver dados da planilha E nenhum estado salvo, nÃ£o hÃ¡ o que restaurar.
        if (planilhaData.length === 0 && (pedidosGeraisAtuais.length === 0 && Object.keys(activeLoads).length === 0 && currentLeftoversForPrinting.length === 0)) {
            console.log("Nenhum estado processado para restaurar.");
            return;
        }

        // Re-renderizar a UI com os dados carregados
        statusDiv.innerHTML = `<p class="text-success">Progresso anterior restaurado com sucesso!</p>`;
        processarBtn.disabled = false;

        // Re-renderizar a UI com os dados carregados
        statusDiv.innerHTML = `<p class="text-success">Progresso anterior restaurado com sucesso!</p>`;
        processarBtn.disabled = false;

        // Re-renderizar a UI com os dados carregados
        statusDiv.innerHTML = `<p class="text-success">Progresso anterior restaurado com sucesso!</p>`;
        processarBtn.disabled = false;

        // 2026-01-24: ForÃ§a a restauraÃ§Ã£o da VIEW e da TAB ativa para evitar tela em branco e garantir UX
        setTimeout(() => {
            const lastView = localStorage.getItem('lastActiveView') || 'summary-view'; // Default para summary se nao houver salvo
            // Remove # se existir para garantir compatibilidade
            const cleanViewId = lastView.replace('#', '');

            const viewLink = document.querySelector(`a[href="#${cleanViewId}"]`) || document.querySelector(`.sidebar-link[href="#${cleanViewId}"]`);
            if (viewLink) {
                console.log(`Restaurando View: ${cleanViewId}`);
                viewLink.click(); // Simula clique para ativar view e sidebar
            } else {
                // Fallback seguro
                activateView('summary-view', document.querySelector('a[href="#summary-view"]'));
            }

            const lastTab = localStorage.getItem('lastActiveTab');
            if (lastTab) {
                const tabBtn = document.querySelector(`button[data-bs-target="${lastTab}"]`);
                if (tabBtn) {
                    // Pequeno delay para garantir que a aba esteja visÃ­vel antes de clicar
                    setTimeout(() => tabBtn.click(), 100);
                }
            }
        }, 100);

        popularFiltrosDeRota();
        atualizarListaBloqueados();
        atualizarListaSemCorte();

        // Re-renderizar todas as seÃ§Ãµes principais
        const gruposGerais = pedidosGeraisAtuais.reduce((acc, p) => { const rota = p.Cod_Rota; if (!acc[rota]) { acc[rota] = { pedidos: [], totalKg: 0 }; } acc[rota].pedidos.push(p); acc[rota].totalKg += p.Quilos_Saldo; return acc; }, {});
        displayGerais(document.getElementById('resultado-geral'), gruposGerais);
        displayToco(document.getElementById('resultado-toco'), gruposToco);

        // Adicionado para restaurar todas as outras seÃ§Ãµes da UI
        displayPedidosBloqueados(document.getElementById('resultado-bloqueados'), pedidosManualmenteBloqueadosAtuais);
        displayRota1(document.getElementById('resultado-rota1'), rota1SemCarga);
        displayPedidosCFNumerico(document.getElementById('resultado-cf-numerico'), pedidosComCFNumericoIsolado);
        displayCargasFechadasPR(document.getElementById('resultado-cargas-fechadas-pr'), cargasFechadasPR);
        displayCargasFechadasRestBrasil(document.getElementById('resultado-cargas-fechadas-rest-br'), gruposPorCFGlobais, pedidosCarretaSemCF);
        displayPedidosFuncionarios(document.getElementById('resultado-funcionarios'), pedidosFuncionarios);
        displayPedidosTransferencias(document.getElementById('resultado-transferencias'), pedidosTransferencias);
        displayPedidosExportacao(document.getElementById('resultado-exportacao'), pedidosExportacao);
        displayPedidosMoinho(document.getElementById('resultado-moinho'), pedidosMoinho);
        displayPedidosMarcaPropria(document.getElementById('resultado-marca-propria'), pedidosMarcaPropria);
        reRenderManualLoads();

        // NOVO: ReconstrÃ³i a UI inicial (botÃµes e listas) a partir dos dados restaurados
        // Isso Ã© crucial para criar os containers onde as cargas serÃ£o renderizadas
        if (pedidosGeraisAtuais.length > 0 || processedRoutes.size > 0) {
            const gruposGerais = pedidosGeraisAtuais.reduce((acc, p) => {
                const rota = p.Cod_Rota;
                if (!acc[rota]) { acc[rota] = { pedidos: [], totalKg: 0 }; }
                acc[rota].pedidos.push(p);
                acc[rota].totalKg += p.Quilos_Saldo;
                return acc;
            }, {});
            displayGerais(document.getElementById('resultado-geral'), gruposGerais);
        }

        reRenderActiveLoads(processedRouteContexts);
        if (Object.keys(kpiData).length > 0) updateAndRenderKPIs();
        updateAndRenderChart();
        recalcAllFreights();

        console.log("Estado da aplicaÃ§Ã£o restaurado do Local Storage.");
    } catch (e) {
        console.error("Erro ao carregar o estado do Local Storage:", e);
        localStorage.removeItem('logisticsAppState'); // Limpa estado corrompido
    }
}

function reRenderManualLoads() {
    const manualLoads = Object.values(activeLoads).filter(load => load.id.includes('venda-antecipada') || load.id.includes('especial'));
    if (manualLoads.length === 0) return;

    const vehicleInfo = {
        fiorino: { name: 'Fiorino', colorClass: 'bg-success', textColor: 'text-white', icon: 'bi-box-seam-fill' },
        van: { name: 'Van', colorClass: 'bg-primary', textColor: 'text-white', icon: 'bi-truck-front-fill' },
        tresQuartos: { name: '3/4', colorClass: 'bg-warning', textColor: 'text-dark', icon: 'bi-truck-flatbed' }
    };

    manualLoads.forEach(load => {
        const resultadoId = load.id.startsWith('venda-antecipada') ? 'resultado-venda-antecipada' : 'resultado-carga-especial';
        const resultadoDiv = document.getElementById(resultadoId);
        if (resultadoDiv) {
            resultadoDiv.innerHTML = `
                        <div class="alert alert-success d-flex justify-content-between align-items-center">
                            <div><strong>Carga ${load.numero} restaurada.</strong></div>
                            <button class="btn btn-light btn-sm no-print" onclick="imprimirGeneric('${resultadoId}', 'Carga ${load.numero}')"><i class="bi bi-printer-fill me-1"></i> Imprimir Carga</button>
                        </div>
                        ${renderLoadCard(load, load.vehicleType, vehicleInfo[load.vehicleType])}`;
        }
    });
}

function reRenderActiveLoads(processedRouteContexts) {
    if (Object.keys(activeLoads).length === 0) return;

    const vehicleInfo = {
        fiorino: { name: 'Fiorino', colorClass: 'bg-success', textColor: 'text-white', icon: 'bi-box-seam-fill' },
        van: { name: 'Van', colorClass: 'bg-primary', textColor: 'text-white', icon: 'bi-truck-front-fill' },
        tresQuartos: { name: '3/4', colorClass: 'bg-warning', textColor: 'text-dark', icon: 'bi-truck-flatbed' }
    };

    // Agrupa as cargas por contexto de rota (divId)
    const loadsByContext = {};

    // Processa os contextos para reativar os botÃµes e preparar os containers
    for (const contextKey in processedRouteContexts) {
        const context = processedRouteContexts[contextKey];
        const resultadoDiv = document.getElementById(context.divId);
        if (!resultadoDiv) continue;

        // Limpa e prepara o container da rota
        resultadoDiv.innerHTML = `<div class="resultado-container"><h5 class="mt-3">Cargas para <strong>${context.title}</strong></h5></div>`;

        // Reativa o botÃ£o da rota processada
        // Reativa o botÃ£o da rota processada
        const routeButton = document.getElementById(context.buttonId);
        if (routeButton) {
            const vehicleType = routeButton.id.split('-')[1];
            const colorClass = vehicleType === 'fiorino' ? 'success' : (vehicleType === 'van' ? 'primary' : 'warning');
            routeButton.classList.remove(`btn-outline-${colorClass}`);
            routeButton.classList.add(`btn-${colorClass}`, 'active');
            routeButton.innerHTML = `<i class="bi bi-check-circle-fill me-2"></i>${context.title}`;
            routeButton.disabled = true; // Garante que o botÃ£o permaneÃ§a desativado
        }
    }

    // Renderiza cada carga no seu respectivo container
    for (const loadId in activeLoads) {
        const load = activeLoads[loadId];
        if (!load.id || !load.vehicleType || !vehicleInfo[load.vehicleType] || load.id.startsWith('manual-') || load.id.startsWith('venda-antecipada') || load.id.startsWith('especial')) continue;

        const context = Object.values(processedRouteContexts).find(c => load.pedidos.some(p => c.routesKey.split(',').includes(String(p.Cod_Rota))));
        if (context) {
            const resultadoDiv = document.getElementById(context.divId);
            const container = resultadoDiv?.querySelector('.resultado-container');
            if (container) container.insertAdjacentHTML('beforeend', renderLoadCard(load, load.vehicleType, vehicleInfo[load.vehicleType]));
        }
    }

    // Renderiza as sobras na Ãºltima aba ativa (ou na primeira, como fallback)
    // REMOVIDO: O card de sobras foi removido da interface conforme solicitaÃ§Ã£o.
    /*
    if (currentLeftoversForPrinting.length > 0) {
         ... (cÃ³digo removido) ...
    }
    */
}

// --- Script para a nova animaÃ§Ã£o "Holographic Nexus" (V9) ---
const processingModal = document.getElementById('processing-modal');
const animationContainer = document.querySelector('.loading-animation-container');

function createHolographicNexus() {
    if (!animationContainer) return;

    const system = animationContainer.querySelector('.nexus-system');
    if (!system) return;

    // Limpa pacotes antigos
    system.querySelectorAll('.data-packet').forEach(el => el.remove());

    const packetCount = 16; // Mais partÃ­culas para efeito mais rico
    for (let i = 0; i < packetCount; i++) {
        const packet = document.createElement('div');
        packet.className = 'data-packet';
        const angle = Math.random() * 360;
        const delay = Math.random() * 2;
        const duration = 1 + Math.random() * 1.5;

        packet.style.setProperty('--angle', `${angle}deg`);
        packet.style.animation = `packet-travel ${duration}s ease-in infinite ${delay}s`;
        system.appendChild(packet);
    }
}

if (processingModal) {
    processingModal.addEventListener('show.bs.modal', createHolographicNexus);
}


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
    if (typeof updateFreightTableUI === 'function') {
        updateFreightTableUI();
    }

    // Recalcula fretes de todas as cargas ativas se tiverem distância
    if (typeof recalcAllFreights === 'function') {
        recalcAllFreights();
    }

    showToast("Configurações de frete salvas com sucesso!", "success");
}


