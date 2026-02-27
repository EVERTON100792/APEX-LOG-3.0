/**
 * Email Generator Module for APEX-LOG-3.0
 * With Supabase integration for shared driver and config storage.
 */

// Supabase client setup
const EMAIL_SUPABASE_URL = 'https://izpcrgnevzwparsslchd.supabase.co';
const EMAIL_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6cGNyZ25ldnp3cGFyc3NsY2hkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMjAxNTMsImV4cCI6MjA4NDY5NjE1M30.xYtk3mzOjSCYCNv3P5eq5aEmRUFSA_ERa58ABdL5Tpk';
const _supabase = (typeof supabase !== 'undefined')
    ? supabase.createClient(EMAIL_SUPABASE_URL, EMAIL_SUPABASE_ANON_KEY)
    : null;

document.addEventListener('DOMContentLoaded', async () => {
    // Arrays originais (com fallback / merge com os salvos localmente)
    const motoristasOriginais = [
        { nome: "ABRAAO MESSIAS POLICANTI", codigo: "577", placa: "AGX3I88" },
        { nome: "AGENOR DIAS", codigo: "741", placa: "MBF8J91" },
        { nome: "ALAIN BASSI DO NASCIMENTO", codigo: "781", placa: "EPQ7554" },
        { nome: "ALEX RIBEIRO", codigo: "123", placa: "DHW2J53" },
        { nome: "ALEX SANDRO OLIVEIRA DE ALMIEIDA", codigo: "925", placa: "ATB2F08" },
        { nome: "ALEXSANDRO REIS", codigo: "423", placa: "ETF0D64" },
        { nome: "ALEXSANDRO SILVA DA COSTA", codigo: "481", placa: "LOM8J38" },
        { nome: "ALICIO BATISTA PAIVA", codigo: "754", placa: "ASG9F40" },
        { nome: "ALISSON LUIZ LOUCAO", codigo: "403", placa: "AQJ9H16" },
        { nome: "ANDRE FONTANELA", codigo: "907", placa: "AQJ0B22" },
        { nome: "ANDRO ALIRIO FERREIRA", codigo: "441", placa: "AOC3G53" },
        { nome: "ANISIO DA SILVA", codigo: "682", placa: "EJE1A71" },
        { nome: "ANTONIO MARCOS NUNES DE OLIVEIRA", codigo: "901", placa: "ARY5F11" },
        { nome: "APARECIDO BARBOSA DE LIMA", codigo: "408", placa: "EZU3J87" },
        { nome: "BRUNO GONCALVES RIBEIRO GUIMARAES", codigo: "101", placa: "DBH7D23" },
        { nome: "CARLOS ALBERTO DE OLIVEIRA", codigo: "495", placa: "BCC4F88" },
        { nome: "CARLOS EDUARDO GOMES", codigo: "478", placa: "AYG9C90" },
        { nome: "CARLOS ZOBERTO ECHAMENDI", codigo: "554", placa: "LPP0J82" },
        { nome: "CICERO RODRIGUES", codigo: "831", placa: "ASU6C30" },
        { nome: "CLAUDIMAR RODRIGUES", codigo: "916", placa: "BAH5J78" },
        { nome: "CLAUDINEI APARECIDO BRISDA", codigo: "820", placa: "OIF4B89" },
        { nome: "CLAUDINEI APARECIDO MENDES", codigo: "185", placa: "BBK2D30" },
        { nome: "CLAUDINEI DE SOUZA", codigo: "829", placa: "DQR8B21" },
        { nome: "CLOVIS AUGUSTO GUIMARAES", codigo: "321", placa: "AFJ7812" },
        { nome: "CRISTIANO DE SOUZA LIMA", codigo: "631", placa: "MFX0C52" },
        { nome: "CRISTIANO DOLEMBA", codigo: "398", placa: "FKT2F73" },
        { nome: "DANILO JUNIOR ALACOQUE", codigo: "814", placa: "DJC2D45" },
        { nome: "DANNILO JUNIOR DA COSTA", codigo: "469", placa: "GRA3D21" },
        { nome: "DAVID BRUNO DOS SANTOS DIAS", codigo: "661", placa: "GUU9904" },
        { nome: "DENIELTON BUENO DA SILVA", codigo: "143", placa: "BTO6D76" },
        { nome: "EDERSON DA SILVA", codigo: "91", placa: "AWA3D28" },
        { nome: "EDIVALDO FABRICIO DE LIMA", codigo: "860", placa: "AJI4656" },
        { nome: "EDSON MESSIAS", codigo: "800", placa: "CPR0J63" },
        { nome: "EDUARDO VINICIUS BALISIO", codigo: "463", placa: "LSM4H90" },
        { nome: "ELI BERNARDINO ALMEIDA", codigo: "182", placa: "SEQ0J71" },
        { nome: "ERLI BERNARDINO", codigo: "182", placa: "SEO0J71" },
        { nome: "EVERTON LUIS MOURA", codigo: "297", placa: "AOZ3J39" },
        { nome: "EVERTON ROBSON DA SILVA", codigo: "464", placa: "ARV7J35" },
        { nome: "EVERTON RODRIGO TUPAN", codigo: "433", placa: "FUI0J65" },
        { nome: "FABIO DA SILVA OLIVIRA", codigo: "381", placa: "PVQ3A82" },
        { nome: "FABIO DOS SANTOS", codigo: "121", placa: "BBK2D41" },
        { nome: "FELIPE BIANCHI", codigo: "817", placa: "BDC7C29" },
        { nome: "FERNANDO MESSIAS POLICANTI", codigo: "900", placa: "ARY5F11" },
        { nome: "FERNANDO MESSIAS POLICANTI NETO", codigo: "131", placa: "EJW8E42" },
        { nome: "FLAVIO ANTONIO DE CARVALHO", codigo: "855", placa: "ARB5176" },
        { nome: "FLAVIO CESAR SHIGEAKI FURU", codigo: "813", placa: "BCR1I38" },
        { nome: "GENIEL DE SOUSA POLICANTI AS", codigo: "816", placa: "AOQ0A48" },
        { nome: "GENIVAL LINO DE ALMEIDA", codigo: "909", placa: "HMC5H95" },
        { nome: "GERALDO TEODORO", codigo: "418", placa: "ATD3G45" },
        { nome: "GILMAR MENDES DE OLIVEIRA", codigo: "244", placa: "AYG1B15" },
        { nome: "HELIO DOS SANTOS ABREU", codigo: "431", placa: "EKH0I50" },
        { nome: "HENRIQUE DA SILVA STAVANATO", codigo: "440", placa: "MLV2C15" },
        { nome: "HENRIQUE DA SILVEIRA TAVARES", codigo: "140", placa: "MLV5G12" },
        { nome: "IGOR DA SILVA DE JESUS", codigo: "421", placa: "AJR3E53" },
        { nome: "IRINEU CARDOSO DE MOURA", codigo: "722", placa: "AHK0011" },
        { nome: "IVAN BORTOLOSSI DE SOUZA", codigo: "395", placa: "TAY2F85" },
        { nome: "JACKSON LUIZ MACHADO", codigo: "904", placa: "ANB0G77" },
        { nome: "JAIR DE ASSIS DE JESUS", codigo: "325", placa: "AQQ5I31" },
        { nome: "JECIEL TEODORO DA SILVA", codigo: "840", placa: "ABY2B31" },
        { nome: "JEFERSON DOS SANTOS COSTA", codigo: "500", placa: "ARY5F11" },
        { nome: "JESAEL CARNEIRO DE MELO", codigo: "150", placa: "ATA0C31" },
        { nome: "JOAO BATISTA URONANI", codigo: "627", placa: "SEU8J28" },
        { nome: "JOAO MANOEL DE SOUZA SEVERO", codigo: "715", placa: "BEB7H99" },
        { nome: "JOAO PAULO MACHADO BARBOSA", codigo: "818", placa: "FNZ2J53" },
        { nome: "JOAO VITOR TREDER CHACON", codigo: "821", placa: "MDV8J42" },
        { nome: "JORGE ARMANDO RIVERA LOPES", codigo: "900", placa: "FWG7H74" },
        { nome: "JOSE ANGELO DOS SANTOS", codigo: "944", placa: "AQB0H89" },
        { nome: "JOSE BENEDITO DE OLIVEIRA", codigo: "908", placa: "IYL0H15" },
        { nome: "JOSE CARLOS DE OLIVEIRA", codigo: "130", placa: "AQQ8B23" },
        { nome: "JOSEMAR DO NASCIMENTO", codigo: "112", placa: "EWJ0B95" },
        { nome: "JOSIAS BATISTA ALMEIDA", codigo: "406", placa: "BDN3D74" },
        { nome: "JULIANO NUNES KISTENMACHER", codigo: "803", placa: "APF0E63" },
        { nome: "LEONARDO OLIVEIRA RESENDE", codigo: "428", placa: "BDN0A67" },
        { nome: "MAICON HENRIQUE DIAS", codigo: "806", placa: "AWV9F72" },
        { nome: "MAIKON MICHEL RODRIGUES", codigo: "893", placa: "AQC4D55" },
        { nome: "MARCELO APARECIDO GERALDO", codigo: "807", placa: "AKW2J76" },
        { nome: "MARCELO PETENASSI ZARAMELA", codigo: "400", placa: "ACC1A28" },
        { nome: "MARCELO PEREIRA ALVES", codigo: "181", placa: "APN0081" },
        { nome: "MARCIO FABIO GARCIA", codigo: "437", placa: "B544D68" },
        { nome: "MARCO FABIO GARCIA", codigo: "477", placa: "BSQ5D65" },
        { nome: "MARCOS ALVES DA SILVA", codigo: "394", placa: "BMB8J88" },
        { nome: "MARCOS APARECIDO IRMER", codigo: "404", placa: "AOF0I81" },
        { nome: "MARCOS ROBERTO DE OLIVEIRA", codigo: "737", placa: "SEL8D06" },
        { nome: "MARCOS ROBERTO DIAS", codigo: "802", placa: "HSD4543" },
        { nome: "MATHEUS GABRIEL DE SOUZA MEIRA", codigo: "376", placa: "ARU8B29" },
        { nome: "MATHEUS GUIMARAES DE SOUZA", codigo: "1533", placa: "PVQ3A82" },
        { nome: "MATHEUS HENRIQUE DE SOUZA", codigo: "526", placa: "ATG1J95" },
        { nome: "MAURO DA SILVA", codigo: "241", placa: "AWZ3A35" },
        { nome: "NEYMAR KONOPKA", codigo: "970", placa: "AXY7G76" },
        { nome: "ODAIR JOSE DE CARVALHO", codigo: "885", placa: "DRR2C83" },
        { nome: "ODILO CARLOS MOREIRA DOS SANTOS", codigo: "521", placa: "AYD7C78" },
        { nome: "OLIVIO PIRES GONCALVES", codigo: "854", placa: "JJZ4G84" },
        { nome: "OSWALDO SADAHALU KOBATA", codigo: "736", placa: "QDN7G63" },
        { nome: "PAULO ROGERIO FRANQUELO", codigo: "429", placa: "GOV1D72" },
        { nome: "PAULO VICENTE DOS SANTOS", codigo: "784", placa: "ALT5H85" },
        { nome: "PETERSON VINICIUS DOS SANTOS CARDOSO", codigo: "444", placa: "BBV9E74" },
        { nome: "RAFAEL GOMES FERREIRA", codigo: "133", placa: "AYG9C89" },
        { nome: "RAFAEL ROMUALDO DA SILVA", codigo: "424", placa: "OCJ7J49" },
        { nome: "REGINALDO APARECIDO DOS SANTOS", codigo: "297", placa: "A0Z3J39" },
        { nome: "REGINALDO GOMES DE ARRUDA", codigo: "824", placa: "OQU7J49" },
        { nome: "REINALDO APARECIDO PONTES", codigo: "372", placa: "MQS9C71" },
        { nome: "RENATO RODRIGUES OLIVEIRA", codigo: "132", placa: "AQT5B32" },
        { nome: "RICARDO INVINCICNHI", codigo: "839", placa: "DQR8B21" },
        { nome: "RICARDO INNVINNCHL", codigo: "829", placa: "DQR0B21" },
        { nome: "ROBERTO GOMES DE ABREU", codigo: "432", placa: "BCZ3F43" },
        { nome: "ROBERTO PEREIRA FELIX", codigo: "822", placa: "AKC6G32" },
        { nome: "ROBERTO RIBEIRO", codigo: "820", placa: "AXX9H77" },
        { nome: "ROBERTO ROMOALDO DA SILVA", codigo: "432", placa: "ACC3A57" },
        { nome: "RODRIGO DE SOUSA", codigo: "513", placa: "AMH4D32" },
        { nome: "RONALDO VALENTIN DAMACENO", codigo: "384", placa: "ANC4J53" },
        { nome: "SANDERSON HERCULANO DA COSTA", codigo: "245", placa: "AYN7G19" },
        { nome: "SILVIO CESAR SHIGEAKI FURUMITI", codigo: "814", placa: "DJC2D45" },
        { nome: "TIAGO GALETI", codigo: "872", placa: "AXN0F66" },
        { nome: "VAGNER APARECIDO SAQUELI", codigo: "425", placa: "AXX9H76" },
        { nome: "VAGNER JOSE LIMA DE SOUZA", codigo: "915", placa: "AUH6F51" },
        { nome: "VALDEILDO DE SOUZA", codigo: "402", placa: "MJB2C47" },
        { nome: "VALDINEI DE SOUZA", codigo: "435", placa: "AJI8236" },
        { nome: "VALDINEI JOSE CALLADO", codigo: "460", placa: "KCR2E43" },
        { nome: "VALDIR ZAMONETA", codigo: "828", placa: "DHF588" },
        { nome: "VINICIUS PEREIRA SOARES", codigo: "503", placa: "BAN8678" },
        { nome: "VOLMIR DA SILVA", codigo: "419", placa: "AME2C78" },
        { nome: "WESLEY DAYRTON DO NASCIMENTO", codigo: "485", placa: "MKN-1D60" },
        { nome: "WILSON ALVES SILVEIRA", codigo: "874", placa: "DAH4G00" }
    ];

    // Chaves de LocalStorage
    const LS_KEY_MOTORISTAS = 'apex_custom_motoristas';
    const LS_KEY_ASSINATURA = 'apex_email_assinatura';

    // Gerenciamento de Motoristas
    // Fetch custom motoristas from Supabase, fallback to localStorage
    async function getMotoristasDoBanco() {
        if (!_supabase) return [];
        try {
            const { data, error } = await _supabase
                .from('email_motoristas')
                .select('nome, codigo, placa')
                .order('nome');
            if (error) throw error;
            return data || [];
        } catch (e) {
            console.warn('Supabase offline, usando localStorage:', e.message);
            return JSON.parse(localStorage.getItem(LS_KEY_MOTORISTAS) || '[]');
        }
    }

    // Merge original list with Supabase custom drivers
    async function getMotoristas() {
        try {
            const salvos = JSON.parse(localStorage.getItem(LS_KEY_MOTORISTAS)) || [];
            // Merge customizados e originais, removendo duplicados por nome (ignorando case)
            const customDrivers = await getMotoristasDoBanco();
            const map = new Map(motoristasOriginais.map(m => [m.nome.toUpperCase(), m]));
            // Adiciona motoristas salvos localmente (se houver)
            salvos.forEach(m => {
                map.set(m.nome.toUpperCase(), m);
            });
            // Adiciona/sobrescreve com motoristas do Supabase (prioridade)
            customDrivers.forEach(m => {
                map.set(m.nome.toUpperCase(), m);
            });
            return [...map.values()].sort((a, b) => a.nome.localeCompare(b.nome));
        } catch (e) {
            console.error("Erro ao ler motoristas do localStorage:", e);
            return [...motoristasOriginais];
        }
    }

    // Load email configs (destinatário/CC) from Supabase
    async function loadEmailConfigs() {
        if (!_supabase) return;
        try {
            const { data, error } = await _supabase
                .from('email_configs')
                .select('id, valor');
            if (error) throw error;
            (data || []).forEach(({ id, valor }) => {
                const el = document.getElementById(id);
                if (el) el.value = valor;
            });
        } catch (e) {
            console.warn('Erro ao carregar configs de e-mail:', e.message);
        }
    }

    // Save email config to Supabase (auto-save on blur with debounce)
    function bindEmailConfigSave(elementId) {
        const el = document.getElementById(elementId);
        if (!el || !_supabase) return;
        let t;
        el.addEventListener('input', () => {
            clearTimeout(t);
            t = setTimeout(async () => {
                try {
                    await _supabase.from('email_configs').upsert({ id: elementId, valor: el.value, updated_at: new Date().toISOString() });
                } catch (e) { console.warn('Erro ao salvar config:', e.message); }
            }, 1200);
        });
    }

    // Render motorista list in the Gerenciar modal
    async function renderListaMotoristas(filtro = '') {
        const container = document.getElementById('listaGerenciarMotoristas');
        if (!container) return;
        container.innerHTML = `<div class="text-center p-4 text-muted"><div class="spinner-border spinner-border-sm me-2"></div>Carregando...</div>`;

        const todos = await getMotoristas();
        let dbNomes = new Set();
        if (_supabase) {
            const { data } = await _supabase.from('email_motoristas').select('nome');
            if (data) data.forEach(m => dbNomes.add(m.nome.toUpperCase()));
        }

        const filtrados = filtro
            ? todos.filter(m => m.nome.toLowerCase().includes(filtro.toLowerCase()) || m.codigo.includes(filtro))
            : todos;

        if (!filtrados.length) {
            container.innerHTML = `<div class="text-center p-4 text-muted"><i class="bi bi-inbox fs-3 d-block mb-2"></i>Nenhum motorista encontrado.</div>`;
            return;
        }

        container.innerHTML = filtrados.map(m => {
            const isCustom = dbNomes.has(m.nome.toUpperCase());
            const badge = isCustom
                ? `<span class="motorista-row-badge" style="background:rgba(99,102,241,0.15);color:#818cf8;">CADASTRADO</span>`
                : `<span class="motorista-row-badge" style="background:rgba(71,85,105,0.3);color:#64748b;">ORIGINAL</span>`;
            const safeName = m.nome.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
            const actions = isCustom
                ? `<div class="motorista-row-actions">
                    <button class="btn btn-outline-warning" title="Editar" onclick="window.abrirEdicaoMotorista('${safeName}','${m.codigo}','${m.placa}')"><i class="bi bi-pencil-fill"></i></button>
                    <button class="btn btn-outline-danger" title="Excluir" onclick="window.excluirMotorista('${safeName}')"><i class="bi bi-trash-fill"></i></button>
                   </div>`
                : `<div class="motorista-row-actions"></div>`;
            return `<div class="motorista-row">
                <div class="motorista-row-info">
                    <div class="motorista-row-name">${m.nome}</div>
                    <div class="motorista-row-meta">LCONT00${m.codigo} &nbsp;&middot;&nbsp; ${m.placa}</div>
                </div>
                ${badge}${actions}
            </div>`;
        }).join('');
    }

    // Excluir motorista do Supabase
    window.excluirMotorista = async function (nome) {
        if (!confirm(`Excluir o motorista "${nome}" permanentemente?`)) return;
        try {
            if (_supabase) {
                const { error } = await _supabase.from('email_motoristas').delete().eq('nome', nome);
                if (error) throw error;
            }
            await popularSelects();
            await renderListaMotoristas(document.getElementById('searchGerenciarMotoristas')?.value || '');
            showToast('Sucesso', `Motorista ${nome} excluído.`, 'success');
        } catch (err) {
            showToast('Erro', 'Falha ao excluir: ' + err.message, 'danger');
        }
    };

    // Abrir modal de edição pré-preenchido
    window.abrirEdicaoMotorista = function (nome, codigo, placa) {
        document.getElementById('editarMotoristaId').value = nome;
        document.getElementById('editarNomeMotorista').value = nome;
        document.getElementById('editarCodigoMotorista').value = codigo;
        document.getElementById('editarPlacaMotorista').value = placa;
        const gerMod = bootstrap.Modal.getInstance(document.getElementById('gerenciarMotoristasModal'));
        if (gerMod) gerMod.hide();
        setTimeout(() => {
            const editModal = new bootstrap.Modal(document.getElementById('editarMotoristaModal'));
            editModal.show();
        }, 400);
    };

    // Salvar edições no Supabase
    window.confirmarEdicaoMotorista = async function () {
        const nomeOriginal = document.getElementById('editarMotoristaId').value;
        const novoNome = document.getElementById('editarNomeMotorista').value.trim().toUpperCase();
        const novoCodigo = document.getElementById('editarCodigoMotorista').value.trim();
        const novaPlaca = document.getElementById('editarPlacaMotorista').value.trim().toUpperCase();
        if (!novoNome || !novoCodigo || !novaPlaca) return showToast('Erro', 'Preencha todos os campos.', 'danger');
        try {
            if (_supabase) {
                const { error } = await _supabase.from('email_motoristas')
                    .update({ nome: novoNome, codigo: novoCodigo, placa: novaPlaca })
                    .eq('nome', nomeOriginal);
                if (error) throw error;
            }
            bootstrap.Modal.getInstance(document.getElementById('editarMotoristaModal'))?.hide();
            await popularSelects();
            showToast('Sucesso', 'Motorista atualizado!', 'success');
        } catch (err) {
            showToast('Erro', 'Falha ao editar: ' + err.message, 'danger');
        }
    };

    // Wire Gerenciar modal: load on open, filter on search
    const gerenciarModal = document.getElementById('gerenciarMotoristasModal');
    if (gerenciarModal) {
        gerenciarModal.addEventListener('show.bs.modal', () => renderListaMotoristas());
        const searchInput = document.getElementById('searchGerenciarMotoristas');
        if (searchInput) {
            let searchT;
            searchInput.addEventListener('input', () => {
                clearTimeout(searchT);
                searchT = setTimeout(() => renderListaMotoristas(searchInput.value), 300);
            });
        }
    }


    // Expose para o botão de salvar novo motorista
    window.salvarNovoMotorista = async function (e) {
        if (e) e.preventDefault();

        const nome = document.getElementById('novoNomeMotorista').value.trim().toUpperCase();
        const codigo = document.getElementById('novoCodigoMotorista').value.trim();
        const placa = document.getElementById('novaPlacaMotorista').value.trim().toUpperCase();

        if (!nome || !codigo || !placa) {
            showToast('Erro', 'Preencha todos os campos corretamente.', 'danger');
            return;
        }

        try {
            // Save to Supabase
            if (_supabase) {
                const { error } = await _supabase
                    .from('email_motoristas')
                    .upsert([{ nome, codigo, placa }], { onConflict: 'nome' }); // Use upsert to handle potential duplicates by name
                if (error) throw error;
            } else {
                // Fallback to localStorage
                const salvos = JSON.parse(localStorage.getItem(LS_KEY_MOTORISTAS)) || [];
                salvos.push({ nome, placa, codigo });
                localStorage.setItem(LS_KEY_MOTORISTAS, JSON.stringify(salvos));
            }

            await popularSelects();

            document.getElementById('novoMotoristaForm').reset();
            const modal = bootstrap.Modal.getInstance(document.getElementById('novoMotoristaModal'));
            if (modal) modal.hide();

            showToast('Sucesso', `Motorista ${nome} cadastrado e pronto para uso!`, 'success');

        } catch (err) {
            console.error(err);
            showToast('Erro', 'Falha ao salvar motorista: ' + err.message, 'danger');
        }
    };

    async function popularSelects() {
        const motoristas = await getMotoristas();
        const selects = ['motoristaCredito', 'motoristaPortaria', 'motoristaOriginal', 'motoristaSubstituto', 'motoristaRemonte'];

        selects.forEach(id => {
            const select = document.getElementById(id);
            if (!select) return;
            select.innerHTML = '';
            motoristas.forEach(m => {
                const opt = document.createElement('option');
                opt.value = JSON.stringify(m);
                opt.textContent = `${m.nome} (LCONT00${m.codigo}) - ${m.placa}`;
                select.appendChild(opt);
            });
        });
    }

    // Funções de Busca nas Selects
    function setupBuscaSelect(inputId, selectId) {
        const input = document.getElementById(inputId);
        const select = document.getElementById(selectId);
        if (!input || !select) return;

        input.addEventListener('input', function () {
            const termo = this.value.toLowerCase();
            let encontrado = false;
            for (let i = 0; i < select.options.length; i++) {
                const textoOpcao = select.options[i].textContent.toLowerCase();
                if (textoOpcao.includes(termo)) {
                    select.selectedIndex = i;
                    encontrado = true;
                    select.options[i].style.display = 'block';
                } else {
                    select.options[i].style.display = 'none';
                }
            }
            if (!encontrado) select.selectedIndex = -1;

            // Corrige bug visual de display none no html select puro
            if (termo === "") {
                for (let i = 0; i < select.options.length; i++) {
                    select.options[i].style.display = '';
                }
            }
        });
    }

    // Gerenciador de Assinatura
    const elAssinatura = document.getElementById('assinaturaEditavel');
    if (elAssinatura) {
        // Carregar
        const savedAssinatura = localStorage.getItem(LS_KEY_ASSINATURA);
        if (savedAssinatura) {
            elAssinatura.innerHTML = savedAssinatura;
        }

        // Auto-salvar ao mudar (debounce simples)
        let timeoutAssinatura;
        elAssinatura.addEventListener('input', () => {
            clearTimeout(timeoutAssinatura);
            timeoutAssinatura = setTimeout(() => {
                localStorage.setItem(LS_KEY_ASSINATURA, elAssinatura.innerHTML);
                showToast("Sistema", "Assinatura salva", "info");
            }, 1000);
        });

        // Botão copiar assinatura apenas
        document.getElementById('copiarAssinaturaBtn')?.addEventListener('click', () => {
            copyToClipboardHTML(elAssinatura.innerHTML);
            showToast("Sucesso", "Assinatura copiada!", "success");
        });
    }

    // Helper Global para Copiar para o Clipboard Mantendo HTML
    async function copyToClipboardHTML(htmlContent) {
        try {
            const blob = new Blob([htmlContent], { type: 'text/html' });
            const data = [new ClipboardItem({ 'text/html': blob })];
            await navigator.clipboard.write(data);
            return true;
        } catch (err) {
            console.error('Failed to copy text: ', err);
            // Fallback velho
            const textarea = document.createElement('textarea');
            textarea.value = htmlContent.replace(/<[^>]*>?/gm, ''); // strip html crude
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            return true;
        }
    }


    /* --- HELPERS --- */
    function formatarMoeda(valor) {
        return 'R$ ' + valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function getSaudacao() {
        return new Date().getHours() < 12 ? 'Bom dia' : 'Boa tarde';
    }

    function getAssinaturaHtml() {
        if (!elAssinatura || !elAssinatura.innerHTML.trim()) {
            showToast('Aviso', 'Preencha sua assinatura antes de gerar o e-mail.', 'warning');
            return null;
        }
        return elAssinatura.innerHTML;
    }

    /* --- LÓGICA DE CADA MODO --- */

    // 1. Crédito
    const kmInformadoEl = document.getElementById('kmInformado');
    const kmPagoEl = document.getElementById('kmPago');
    const valorKmEl = document.getElementById('valorKm');
    const previewCreditoEl = document.getElementById('previewCredito');

    function calcCredito() {
        if (!kmInformadoEl || !kmPagoEl || !valorKmEl || !previewCreditoEl) return;
        const info = parseFloat(kmInformadoEl.value) || 0;
        const pago = parseFloat(kmPagoEl.value) || 0;
        const vkm = parseFloat(valorKmEl.value) || 0;
        const dif = info - pago;
        const total = dif > 0 ? dif * vkm : 0;
        previewCreditoEl.textContent = `R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        return { dif, total };
    }

    if (kmInformadoEl) {
        kmInformadoEl.addEventListener('input', calcCredito);
        kmPagoEl.addEventListener('input', calcCredito);
        valorKmEl.addEventListener('input', calcCredito);
    }

    document.getElementById('gerarCreditoBtn')?.addEventListener('click', async () => {
        const dest = document.getElementById('emailDestinatario').value;
        const cc = document.getElementById('emailCopia').value;
        const motSelect = document.getElementById('motoristaCredito').value;
        if (!dest || !motSelect) return showToast('Aviso', 'Preencha o destinatário e selecione o motorista.', 'warning');
        const mot = JSON.parse(motSelect);
        const assinaturaHtml = getAssinaturaHtml();
        if (!assinaturaHtml) return;

        const kmInfo = parseFloat(document.getElementById('kmInformado').value) || 0;
        const kmPago = parseFloat(document.getElementById('kmPago').value) || 0;
        const aut = document.getElementById('autorizacaoSaida').value || 'N/A';
        const motivoSelect = document.getElementById('motivo');
        const motivo = motivoSelect ? motivoSelect.value : '';
        const vals = calcCredito();
        if (!vals || vals.dif <= 0) return showToast('Aviso', 'KM informado deve ser maior que o pago.', 'warning');

        const saudacao = getSaudacao();
        const textoAutorizacao = aut && aut !== 'N/A' ? `Autorização de Saída: ${aut}` : '';
        const assunto = `Lançamento de Crédito - Diferença de KM - ${mot.nome}`;
        const corpoHtml = `<div style="font-family: Arial, sans-serif; font-size: 14px; color: #000;"><p>${saudacao} Ana,</p><p>Por gentileza, lançar um crédito no valor de <strong>${formatarMoeda(vals.total)}</strong> para o motorista <strong>${mot.nome}</strong>, referente a diferença de ${kmInfo - kmPago} km ${motivo}.</p><p>Seguem os dados para conferência:</p><p>Motorista: ${mot.nome}<br>LCONT00${mot.codigo}<br>Placa: ${mot.placa}<br>${textoAutorizacao}</p><p>Qualquer dúvida, estou à disposição.</p><br>${assinaturaHtml}</div>`;

        await showCopyBoxAndCopyToClipboard(corpoHtml);
        openMailClient(dest, cc, assunto);
    });

    document.getElementById('whatsappCreditoBtn')?.addEventListener('click', () => {
        const motSelect = document.getElementById('motoristaCredito').value;
        if (!motSelect) return showToast('Aviso', 'Selecione o motorista.', 'warning');
        const mot = JSON.parse(motSelect);

        const kmInfo = parseFloat(document.getElementById('kmInformado').value) || 0;
        const kmPago = parseFloat(document.getElementById('kmPago').value) || 0;
        const dif = kmInfo - kmPago;

        if (dif <= 0) return showToast('Aviso', 'KM informado deve ser maior que o pago.', 'warning');

        const msg = `Olá tudo bem?\nPassando para informar que a diferença de ${dif} KM já foi enviada para a Ana lançar como crédito.\nQualquer dúvida, sigo à disposição.`;
        const msgEncoded = encodeURIComponent(msg);
        window.open(`https://wa.me/?text=${msgEncoded}`, '_blank');
    });

    // 2. Portaria
    document.getElementById('gerarPortariaBtn')?.addEventListener('click', async () => {
        const dest = document.getElementById('emailDestinatarioPortaria').value;
        const cc = document.getElementById('emailCopiaPortaria').value;
        const motSelect = document.getElementById('motoristaPortaria').value;
        if (!dest || !motSelect) return showToast('Aviso', 'Preencha o destinatário e selecione o motorista.', 'warning');
        const mot = JSON.parse(motSelect);
        const assinaturaHtml = getAssinaturaHtml();
        if (!assinaturaHtml) return;

        const tipoVeiculo = document.getElementById('tipoVeiculo').value;
        const saudacao = getSaudacao();
        const assunto = `Liberação para Abastecimento - ${mot.nome}`;
        const corpoHtml = `<div style="font-family: Arial, sans-serif; font-size: 14px; color: #000;"><p>${saudacao},</p><p>Por gentileza, liberar o motorista <strong>${mot.nome}</strong> para fazer o abastecimento do veículo ${tipoVeiculo}, placa ${mot.placa}.</p><p>Obrigado.</p><br>${assinaturaHtml}</div>`;

        await showCopyBoxAndCopyToClipboard(corpoHtml);
        openMailClient(dest, cc, assunto);
    });

    document.getElementById('whatsappPortariaBtn')?.addEventListener('click', () => {
        const motSelect = document.getElementById('motoristaPortaria').value;
        if (!motSelect) return showToast('Aviso', 'Selecione o motorista.', 'warning');
        const mot = JSON.parse(motSelect);
        const tipoVeiculo = document.getElementById('tipoVeiculo').value;

        const msg = `O e-mail solicitando a sua liberação já foi enviado para a portaria (Veículo: ${tipoVeiculo}, Placa: ${mot.placa}).\nVocê já pode prosseguir com o abastecimento.`;
        const msgEncoded = encodeURIComponent(msg);
        window.open(`https://wa.me/?text=${msgEncoded}`, '_blank');
    });

    // 3. Transbordo
    const radProps = document.querySelectorAll('input[name="tipoTransbordo"]');
    const camposProporcional = document.getElementById('camposProporcional');
    const valorTotEl = document.getElementById('valorTotalFrete');
    const totEntrEl = document.getElementById('totalEntregas');
    const entFeitasEl = document.getElementById('entregasFeitas');
    const pOriginal = document.getElementById('previewValorOriginal');
    const pSubst = document.getElementById('previewValorSubstituto');

    function calcTransbordo() {
        if (!valorTotEl || !pOriginal) return;
        const isProp = document.getElementById('tipoProporcional').checked;
        const vTot = parseFloat(valorTotEl.value) || 0;

        let vOrig = 0, vSubst = 0;

        if (isProp) {
            const tEntr = parseInt(totEntrEl.value) || 1;
            const feitas = parseInt(entFeitasEl.value) || 0;
            const vPorEntrega = vTot / tEntr;
            vOrig = feitas * vPorEntrega;
            vSubst = vTot - vOrig;
        } else {
            vOrig = 0;
            vSubst = vTot;
        }

        pOriginal.textContent = `R$ ${vOrig.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        pSubst.textContent = `R$ ${vSubst.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        return { isProp, vTot, vOrig, vSubst };
    }

    if (radProps) radProps.forEach(r => r.addEventListener('change', () => {
        camposProporcional.style.display = r.value === 'proporcional' ? 'flex' : 'none';
        calcTransbordo();
    }));
    if (valorTotEl) {
        valorTotEl.addEventListener('input', calcTransbordo);
        if (totEntrEl) totEntrEl.addEventListener('input', calcTransbordo);
        if (entFeitasEl) entFeitasEl.addEventListener('input', calcTransbordo);
    }

    document.getElementById('gerarTransbordoBtn')?.addEventListener('click', async () => {
        const dest = document.getElementById('emailDestinatario').value;
        const cc = document.getElementById('emailCopia').value;
        const motOSel = document.getElementById('motoristaOriginal').value;
        const motSSel = document.getElementById('motoristaSubstituto').value;
        if (!dest || !motOSel || !motSSel) return showToast('Aviso', 'Preencha o destinatário e selecione os dois motoristas.', 'warning');
        if (motOSel === motSSel) return showToast('Aviso', 'O motorista original e o substituto não podem ser os mesmos.', 'warning');
        const assinaturaHtml = getAssinaturaHtml();
        if (!assinaturaHtml) return;

        const motO = JSON.parse(motOSel);
        const motS = JSON.parse(motSSel);
        const numeroSaida = document.getElementById('numeroSaidaTransbordo').value.trim();
        const textoNumeroSaida = numeroSaida ? `<p>Número da Saída de referência: ${numeroSaida}</p>` : '';
        const vals = calcTransbordo();
        if (!vals || vals.vTot <= 0) return showToast('Aviso', 'Insira um valor de frete válido.', 'warning');
        const saudacao = getSaudacao();
        let assunto = '';
        let corpoHtml = '';

        if (vals.isProp) {
            const totalEntregas = parseInt(totEntrEl.value) || 0;
            const entregasFeitas = parseInt(entFeitasEl.value) || 0;
            if (totalEntregas <= 0 || entregasFeitas < 0 || entregasFeitas > totalEntregas) { return showToast('Aviso', 'Verifique os números de entrega.', 'warning'); }
            assunto = `Lançamento Proporcional - Transbordo de Rota (Saída ${numeroSaida || 'N/A'})`;
            corpoHtml = `<div style="font-family: Arial, sans-serif; font-size: 14px; color: #000;"><p>${saudacao} Ana,</p><p>Por favor, lançar o valor proporcional referente ao transbordo feito entre os motoristas abaixo.</p>${textoNumeroSaida}<hr><p><strong>MOTORISTA ORIGINAL (com problema):</strong><br>Nome: ${motO.nome}<br>LCONT00${motO.codigo}<br>Placa: ${motO.placa}<br><strong>VALOR A RECEBER: ${formatarMoeda(vals.vOrig)}</strong> (referente a ${entregasFeitas} de ${totalEntregas} entregas)</p><hr><p><strong>MOTORISTA SUBSTITUTO (que assumiu):</strong><br>Nome: ${motS.nome}<br>LCONT00${motS.codigo}<br>Placa: ${motS.placa}<br><strong>VALOR A RECEBER: ${formatarMoeda(vals.vSubst)}</strong> (referente às ${totalEntregas - entregasFeitas} entregas restantes)</p><hr><p>Qualquer dúvida, estou à disposição.</p><br>${assinaturaHtml}</div>`;
        } else {
            assunto = `Lançamento Integral - Transbordo de Rota (Saída ${numeroSaida || 'N/A'})`;
            corpoHtml = `<div style="font-family: Arial, sans-serif; font-size: 14px; color: #000;"><p>${saudacao} Ana,</p><p>Por favor, lançar o valor integral do frete para o motorista substituto, conforme detalhado abaixo, devido a um problema com o veículo do motorista original antes do início das entregas.</p>${textoNumeroSaida}<hr><p><strong>MOTORISTA SUBSTITUTO (que assumiu a rota completa):</strong><br>Nome: ${motS.nome}<br>LCONT00${motS.codigo}<br>Placa: ${motS.placa}<br><strong>VALOR A RECEBER: ${formatarMoeda(vals.vTot)}</strong> (valor integral)</p><hr><p>O motorista original, ${motO.nome}, não receberá valor por esta rota.</p><p>Qualquer dúvida, estou à disposição.</p><br>${assinaturaHtml}</div>`;
        }
        await showCopyBoxAndCopyToClipboard(corpoHtml);
        openMailClient(dest, cc, assunto);
    });

    // 4. Remonte
    document.getElementById('gerarRemonteBtn')?.addEventListener('click', async () => {
        const dest = document.getElementById('emailDestinatarioRemonte').value;
        const cc = document.getElementById('emailCopiaRemonte').value;
        const motSelect = document.getElementById('motoristaRemonte').value;
        const dataCarregamento = document.getElementById('dataCarregamentoRemonte').value;
        const romaneio = document.getElementById('numeroRomaneioRemonte').value;
        const superv = document.getElementById('nomeSupervisoraRemonte').value;
        if (!dest || !motSelect || !dataCarregamento || !romaneio || !superv) return showToast('Aviso', 'Preencha todos os campos obrigatórios.', 'warning');
        const assinaturaHtml = getAssinaturaHtml();
        if (!assinaturaHtml) return;

        const mot = JSON.parse(motSelect);
        const tipoVeic = document.getElementById('tipoVeiculoRemonte').value;
        const saudacao = getSaudacao();
        const assunto = `REMONTE - ${mot.nome}`;
        const corpoHtml = `<div style="font-family: Arial, sans-serif; font-size: 14px; color: #000;"><p>${saudacao}!</p><p>Contratado ${tipoVeic} – <strong>${mot.nome}</strong> PLACA: ${mot.placa}. Estará carregando ${dataCarregamento}, com produto em seu veículo do Romaneio ${romaneio}.</p><p>${superv}, aguardando seu Ok.</p><br>${assinaturaHtml}</div>`;

        await showCopyBoxAndCopyToClipboard(corpoHtml);
        openMailClient(dest, cc, assunto);
    });

    // 5. Ajuste de Rota
    document.getElementById('addLinhaAjusteRotaBtn')?.addEventListener('click', () => {
        const container = document.getElementById('linhasAjusteRota');
        const novaLinha = document.createElement('div');
        novaLinha.className = 'rota-entry-row input-group';
        novaLinha.innerHTML = `
            <input type="text" class="cliente-input form-control bg-dark border-secondary text-light" placeholder="Cliente">
            <input type="text" class="rota-input form-control bg-dark border-secondary text-light" placeholder="Rota" style="max-width: 100px;">
            <input type="text" class="praca-input form-control bg-dark border-secondary text-light" placeholder="Praça">
            <button class="btn btn-outline-danger btn-remover-linha"><i class="bi bi-trash-fill"></i></button>
        `;
        container.appendChild(novaLinha);

        novaLinha.querySelector('.btn-remover-linha').addEventListener('click', function () {
            novaLinha.remove();
        });

        const removeBtns = document.querySelectorAll('.btn-remover-linha');
        removeBtns.forEach((btn, ind) => {
            btn.disabled = false;
        });
    });

    document.getElementById('gerarAjusteRotaBtn')?.addEventListener('click', async () => {
        const dest = document.getElementById('emailDestinatarioAjusteRota').value;
        const cc = document.getElementById('emailCopiaAjusteRota').value;
        if (!dest) return showToast('Aviso', 'Preencha o destinatário.', 'warning');
        const assinaturaHtml = getAssinaturaHtml();
        if (!assinaturaHtml) return;

        const linhas = document.querySelectorAll('#linhasAjusteRota .rota-entry-row');
        let tabelaLinhasHtml = '';
        linhas.forEach(linha => {
            const cliente = linha.querySelector('.cliente-input').value.trim();
            const rota = linha.querySelector('.rota-input').value.trim();
            const praca = linha.querySelector('.praca-input').value.trim();
            if (cliente && rota && praca) {
                tabelaLinhasHtml += `<tr><td style="border: 1px solid #ccc; padding: 8px;">${cliente}</td><td style="border: 1px solid #ccc; padding: 8px;">${rota}</td><td style="border: 1px solid #ccc; padding: 8px;">${praca}</td></tr>`;
            }
        });
        if (!tabelaLinhasHtml) return showToast('Aviso', 'Preencha pelo menos um cliente, rota e praça.', 'warning');

        const saudacao = getSaudacao();
        const assunto = `Ajuste de Rota e Praça`;
        const corpoHtml = `<div style="font-family: Arial, sans-serif; font-size: 14px; color: #000;"><p>${saudacao},</p><p>Por favor, ajustar rota e praça dos clientes abaixo:</p><table style="border-collapse: collapse; width: auto; font-family: Arial, sans-serif; font-size: 14px; border: 1px solid #ccc;"><thead><tr><th style="border: 1px solid #ccc; padding: 8px; background-color: #f2f2f2; text-align: left;">Cliente</th><th style="border: 1px solid #ccc; padding: 8px; background-color: #f2f2f2; text-align: left;">Rota</th><th style="border: 1px solid #ccc; padding: 8px; background-color: #f2f2f2; text-align: left;">Praça</th></tr></thead><tbody>${tabelaLinhasHtml}</tbody></table><br>${assinaturaHtml}</div>`;

        await showCopyBoxAndCopyToClipboard(corpoHtml);
        openMailClient(dest, cc, assunto);
    });

    // Funções Core UI
    function showCopyBoxAndCopyToClipboard(htmlContent) {
        const copyBox = document.getElementById('globalCopyBox');
        const emailBodyParaCopiar = document.getElementById('emailBodyParaCopiar');
        if (!copyBox || !emailBodyParaCopiar) return;

        emailBodyParaCopiar.innerHTML = htmlContent;
        copyToClipboardHTML(htmlContent).then(() => {
            copyBox.style.display = 'block';
            showToast("Sucesso", "Conteúdo copiado para a área de transferência!", "success");
            setTimeout(() => {
                copyBox.style.display = 'none';
            }, 8000); // Esconde a caixa verde depois de 8s
        });
    }

    function removeAccents(str) {
        return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }

    function openMailClient(to, cc, subject) {
        // Strip accents before encoding to prevent garbled characters in Outlook
        const safeSubject = encodeURIComponent(removeAccents(subject));
        const ccParam = cc ? `&cc=${encodeURIComponent(cc)}` : '';
        const mailtoLink = `mailto:${encodeURIComponent(to)}?subject=${safeSubject}${ccParam}`;
        setTimeout(() => {
            window.location.href = mailtoLink;
        }, 300);
    }

    // Inicialização da aba de E-mail
    // Exportamos a função initEmailGenerator para script.js chamar quando clicar na aba
    window.initEmailGenerator = async function () {
        console.log('Inicializando Gerador de E-mails (Supabase sync)...');
        await loadEmailConfigs();
        await popularSelects();
        setupBuscaSelect('searchMotoristaCredito', 'motoristaCredito');
        setupBuscaSelect('searchMotoristaPortaria', 'motoristaPortaria');
        setupBuscaSelect('searchMotoristaOriginal', 'motoristaOriginal');
        setupBuscaSelect('searchMotoristaSubstituto', 'motoristaSubstituto');
        setupBuscaSelect('searchMotoristaRemonte', 'motoristaRemonte');
        calcCredito();
        calcTransbordo();
        // Bind auto-save for all email fields
        ['emailDestinatario', 'emailCopia', 'emailDestinatarioPortaria', 'emailCopiaPortaria',
            'emailDestinatarioRemonte', 'emailCopiaRemonte', 'emailDestinatarioAjusteRota', 'emailCopiaAjusteRota'
        ].forEach(bindEmailConfigSave);
    };

    // Switch de Modos UI
    const modeBtns = document.querySelectorAll('.mode-switcher .btn-mode');
    const formsContent = {
        'modeCreditoBtn': 'formCredito',
        'modePortariaBtn': 'formPortaria',
        'modeTransbordoBtn': 'formTransbordo',
        'modeRemonteBtn': 'formRemonte',
        'modeAjusteRotaBtn': 'formAjusteRota'
    };

    modeBtns.forEach(btn => {
        btn.addEventListener('click', function () {
            modeBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');

            Object.values(formsContent).forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.style.display = 'none';
                    el.classList.remove('fade-in');
                }
            });

            const targetId = formsContent[this.id];
            const targetForm = document.getElementById(targetId);
            if (!targetForm) return;

            targetForm.style.display = 'block';
            // Re-trigger fade animation cleanly
            void targetForm.offsetWidth;
            targetForm.classList.add('fade-in');

            // Scroll the view back to top to prevent jump
            const view = document.getElementById('email-generator-view');
            if (view) view.scrollTo({ top: 0, behavior: 'instant' });

            // Esconder o form geral caso seja modo Portaria / Remonte que tem cc proprio.
            const general = document.getElementById('generalEmailFields');
            if (general) {
                if (['formPortaria', 'formRemonte', 'formAjusteRota'].includes(targetId)) {
                    general.style.display = 'none';
                } else {
                    general.style.display = 'block';
                }
            }
        });
    });

    // Auto-populate selects and load configs on page load
    await popularSelects();
    await loadEmailConfigs();
    // Bind auto-save for all email config fields
    ['emailDestinatario', 'emailCopia', 'emailDestinatarioPortaria', 'emailCopiaPortaria',
        'emailDestinatarioRemonte', 'emailCopiaRemonte', 'emailDestinatarioAjusteRota', 'emailCopiaAjusteRota'
    ].forEach(bindEmailConfigSave);
});
