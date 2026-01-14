/**
 * Utilitário estático central do DataRenderEngine.
 * Responsável por normalização de dados, detecção de ambiente,
 * formatação de valores e orquestração de plugins.
 * Atua como Facade para decidir entre renderizar Tabela ou Accordion.
 */
class RendererUtils {
    /**
     * Registro interno de instâncias por containerId.
     * Permite que o smartRender reutilize instâncias existentes automaticamente.
     */
    static _instances = new Map();

    /**
     * Cor padrão neutra usada como fallback quando nenhuma cor de tema é detectada.
     * Este valor deve ser agnóstico a qualquer portal específico.
     */
    static DEFAULT_THEME_COLOR = '#333333';

    /**
     * Inicializador de contexto para páginas com grids.
     * Detecta jQuery e decide entre executar callback de carga ou exibir estado de espera.
     * 
     * **Magic Loader:** Se o nome da função for `initializeEmptyState`, o engine a chama automaticamente.
     *
     * @param {string} containerId - ID do elemento DOM principal (geralmente um DIV vazio ou com loading).
     * @param {Function|Object} configOrLoadFn - Função de carregamento (callback) ou config de estado inicial.
     */
    static init(containerId, configOrLoadFn = {}) {
        if (typeof $ === 'undefined') return;
        $(function () {
            if (typeof configOrLoadFn === 'function') {
                configOrLoadFn();
                RendererUtils.bindAutoSubmit();
            }
            else {
                RendererUtils.renderWaitingState(containerId, configOrLoadFn);
            }
        });
    }

    /**
     * Workaround para extrair a cor do tema legado.
     * Cria um elemento dummy invisível para ler estilos computados (CSS injection).
     */
    static getThemeColor() {
        if (typeof window === 'undefined' || !document) return null;
        const dummy = document.createElement('div');
        dummy.className = 'header';
        dummy.style.display = 'none';
        document.body.appendChild(dummy);
        const color = window.getComputedStyle(dummy).backgroundColor;
        document.body.removeChild(dummy);
        return (color && color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent') ? color : null;
    }
    static getHeaderBorderBottomColor() {
        if (typeof window === 'undefined' || !document) return null;
        const dummy = document.createElement('div');
        dummy.className = 'header';
        dummy.style.display = 'none';
        document.body.appendChild(dummy);
        const borderColor = window.getComputedStyle(dummy).borderBottomColor;
        document.body.removeChild(dummy);
        return (borderColor && borderColor !== 'rgba(0, 0, 0, 0)' && borderColor !== 'transparent' && borderColor !== 'rgb(0, 0, 0)') ? borderColor : null;
    }
    static getCssVariable(name) {
        if (typeof window === 'undefined' || !document) return null;
        const value = getComputedStyle(document.documentElement).getPropertyValue(name);
        return value ? value.trim() : null;
    }
    static applyOpacity(color, alpha) {
        const percentage = Math.round(alpha * 100);
        return `color-mix(in srgb, ${color} ${percentage}%, transparent)`;
    }
    static escapeHtml(text) {
        if (text == null) return '';
        return String(text)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
    static generateThemePalette(baseColor) {
        const safeColor = baseColor || '#333';
        return {
            base: safeColor,
            light: RendererUtils.applyOpacity(safeColor, 0.1),
            medium: RendererUtils.applyOpacity(safeColor, 0.5),
            hover: RendererUtils.applyOpacity(safeColor, 0.05)
        };
    }

    /**
     * Registro central de formatadores de dados.
     * Mapeia tipos (cpf, cnpj, currency) para funções de transformação visual.
     */
    static formatters = {
        cpf: (value) => {
            if (!value) return '';
            value = String(value).replace(/\D/g, '');
            if (value.length === 11) {
                return value.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
            }
            return value;
        },
        cnpj: (value) => {
            if (!value) return '';
            value = String(value).replace(/\D/g, '');
            if (value.length === 14) {
                return value.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
            }
            return value;
        },
        phone: (value) => {
            if (!value) return '-';
            let str = String(value).replace(/\D/g, '');
            if (str.length === 11) {
                return str.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
            }
            if (str.length === 10) {
                return str.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
            }
            return value;
        },
        cep: (value) => {
            if (!value) return '-';
            let str = String(value).replace(/\D/g, '');
            if (str.length === 8) {
                return str.replace(/(\d{5})(\d{3})/, "$1-$2");
            }
            return value;
        },
        date: (value) => {
            if (!value) return '-';
            if (typeof value === 'string') {
                if (value.match(/^\d{2}\/\d{2}\/\d{4}/)) return value;
                if (value.match(/^\d{4}-\d{2}-\d{2}/)) {
                    const [y, m, d] = value.split(' ')[0].split('-');
                    return `${d}/${m}/${y}`;
                }
            }
            const date = new Date(value);
            return isNaN(date.getTime()) ? value : date.toLocaleDateString('pt-BR');
        },
        currency: (value) => {
            if (value === null || value === undefined || value === '') return 'R$ 0,00';
            if (typeof value === 'number') {
                return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            }
            let str = String(value).trim();
            if (str.includes(',')) {
                if (!str.toLowerCase().startsWith('r$')) return `R$ ${str}`;
                return str;
            }
            let num = parseFloat(str);
            if (!isNaN(num)) {
                return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            }
            return str;
        },
        km: (value) => {
            if (value === null || value === undefined || value === '') return '-';
            if (typeof value === 'number') return `${value} km`;
            return `${value} km`;
        },
        boolean_icon: (value) => {
            const isTrue = value === true || value === 1 || value === '1' ||
                String(value).toLowerCase() === 's' || String(value).toLowerCase() === 'sim' ||
                String(value).toLowerCase() === 'true';
            if (isTrue) {
                return `<i class="fa fa-check-circle" style="color: #28a745; font-size: 1.2em;"></i>`;
            }
            return `<i class="fa fa-times-circle" style="color: #dc3545; opacity: 0.3; font-size: 1.2em;"></i>`;
        }
    };

    /**
     * Gera um hash simples da configuração para detectar mudanças estruturais.
     */
    static getConfigHash(config) {
        try {
            return JSON.stringify(config, (key, value) => {
                if (typeof value === 'function') {
                    // Retorna um placeholder ou o código da função para o hash
                    return value.toString();
                }
                return value;
            });
        } catch (e) {
            console.warn('[SmartRender] Falha ao gerar hash da config:', e);
            return Date.now().toString(); // Fallback: força recriação se falhar
        }
    }

    /**
     * Principal ponto de entrada (Facade) para renderização.
     * Orquestra a decisão entre Tabela ou Accordion baseada na configuração.
     * Agora com inteligência de reidratação automática baseada no containerId
     * e detecção de mudanças de configuração (Stale Config).
     *
     * @param {string} containerId - ID do elemento onde o grid será montado.
     * @param {Object|Array} data - Dados brutos.
     * @param {Object} config - Configuração Mestra (DATARENDER_CONFIG).
     */
    static smartRender(containerId, data, config = {}) {
        const perfKey = `smartRender-${containerId}`;
        const startTime = performance.now();
        const isDebug = config.debug === true;

        if (isDebug) {
            console.group(`%c[SmartRender] 🚀 Iniciando Renderização: #${containerId}`, 'color: #0d6efd; font-weight: bold; font-size: 1.1em;');
            console.log('📦 Data Payload:', data);
            console.log('⚙️ Config Payload:', config);
        }

        // Tenta recuperar instância existente para este container
        let instance = RendererUtils._instances.get(containerId);
        const currentHash = RendererUtils.getConfigHash(config);

        if (instance) {
            // Verifica se a configuração mudou (Stale Config Check)
            const storedHash = instance._configHash;

            if (storedHash && storedHash !== currentHash) {
                if (isDebug) console.warn('⚠️ Configuração alterada detectada. Recriando instância...');
                RendererUtils.destroy(containerId); // Destrói a anterior
                instance = null; // Força criação de nova
            } else if (typeof instance.setData === 'function') {
                // Configuração igual, apenas atualiza dados (Fast Path)
                if (isDebug) console.info('⚡ Fast Path: Atualizando apenas dados (setData)');
                instance.setData(data);

                if (isDebug) {
                    const duration = (performance.now() - startTime).toFixed(2);
                    console.log(`%c✨ Concluído em ${duration}ms`, 'color: #198754; font-weight: bold;');
                    console.groupEnd();
                    RendererUtils.renderDebugBadge(containerId, { duration, mode: 'Update' });
                }
                return instance;
            }
        }

        // Se não existe ou não suporta setData, cria uma nova
        try {
            const newInstance = DataRenderFactory.create(containerId, data, config);

            if (newInstance) {
                // Salva o hash da config na instância para futuras comparações
                newInstance._configHash = currentHash;

                // Registra para futuras atualizações
                RendererUtils._instances.set(containerId, newInstance);

                if (isDebug) {
                    const duration = (performance.now() - startTime).toFixed(2);
                    console.log(`%c✨ Instância Criada em ${duration}ms`, 'color: #198754; font-weight: bold;');
                    console.groupEnd();
                    // Pequeno delay para garantir que o DOM existe
                    setTimeout(() => RendererUtils.renderDebugBadge(containerId, { duration, mode: 'Create' }), 100);
                }
            }
            return newInstance;
        } catch (e) {
            if (isDebug) {
                console.error('🔥 Erro Crítico no SmartRender:', e);
                console.groupEnd();
            }
            throw e;
        }
    }

    /**
     * Renderiza um pequeno badge visual "DEBUG" no canto do container.
     */
    static renderDebugBadge(containerId, info = {}) {
        const container = document.getElementById(containerId);
        if (!container) return; // Container pode ter sumido

        // Remove badge anterior se existir (para evitar duplicação)
        const oldBadge = container.querySelector('.tre-debug-badge');
        if (oldBadge) oldBadge.remove();

        // Garante que o container tenha position relative para posicionar o badge absoluto
        const originalPos = window.getComputedStyle(container).position;
        if (originalPos === 'static') {
            container.style.position = 'relative';
        }

        const badgeHtml = `
            <div class="tre-debug-badge" 
                 title="DataRenderEngine em modo DEBUG.\nContainer: #${containerId}\nTempo Render: ${info.duration}ms\nModo: ${info.mode}"
                 style="position: absolute; top: -10px; right: -5px; z-index: 9999; 
                        background: #dc3545; color: white; font-size: 9px; font-weight: bold; 
                        padding: 2px 6px; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                        cursor: help; opacity: 0.8; pointer-events: auto; font-family: monospace;">
                Request: ${info.duration}ms
            </div>
        `;

        container.insertAdjacentHTML('beforeend', badgeHtml);
    }

    /**
     * Log unificado para debug com formatação
     */
    static logDebug(msg, data = null, type = 'info') {
        // Estilo base
        const styles = {
            info: 'color: #0d6efd',
            success: 'color: #198754; font-weight: bold',
            warn: 'color: #fd7e14',
            error: 'color: #dc3545; font-weight: bold',
            perf: 'color: #6610f2; font-style: italic'
        };

        const style = styles[type] || styles.info;

        if (data) {
            console.groupCollapsed(`%c[DRE] ${msg}`, style);
            console.log(data);
            console.groupEnd();
        } else {
            console.log(`%c[DRE] ${msg}`, style);
        }
    }

    /**
     * Destrói manualmente uma instância gerenciada pelo SmartRender.
     * @param {string} containerId 
     */
    static destroy(containerId) {
        const instance = RendererUtils._instances.get(containerId);
        if (instance) {
            if (typeof instance.destroy === 'function') {
                instance.destroy();
            }
            RendererUtils._instances.delete(containerId);
        }
    }

    static _resolvePlugins(config) {
        const pluginMap = new Map();
        if (config.plugins && Array.isArray(config.plugins)) {
            config.plugins.forEach(p => {
                const id = p.id || p.constructor.name;
                pluginMap.set(id, p);
            });
        }
        const allowSearch = config.allowSearch === true || (config.table && config.table.allowSearch === true);
        if (allowSearch && typeof window.SearchPlugin !== 'undefined') {
            if (!pluginMap.has('search') && !pluginMap.has('SearchPlugin')) {
                pluginMap.set('search', new window.SearchPlugin());
            }
        }
        const allowCols = config.allowColumnManagement === true || (config.table && config.table.allowColumnManagement === true);
        if (allowCols && typeof window.ColumnManagerPlugin !== 'undefined') {
            if (!pluginMap.has('column-manager') && !pluginMap.has('ColumnManagerPlugin')) {
                const pKey = config.persistenceKey || config.containerId || 'default-grid';
                pluginMap.set('column-manager', new window.ColumnManagerPlugin({ persistenceKey: pKey }));
            }
        }
        return Array.from(pluginMap.values());
    }
    static TYPE_ALIASES = {
        'money': 'currency', 'moeda': 'currency', 'valor': 'currency', 'limite': 'currency', 'saldo': 'currency', 'preco': 'currency',
        'data': 'date', 'datetime': 'date',
        'celular': 'phone', 'telefone': 'phone', 'tel': 'phone',
        'cartao': 'card',
        'codigo': 'code', 'id': 'code', 'identifier': 'code', 'matricula': 'code', 'contrato': 'code', 'pedido': 'code', 'ref': 'code',
        'distance': 'km',
        'boolean': 'boolean_icon', 'icon': 'boolean_icon', 'bool': 'boolean_icon',
        'input_text': 'input', 'editable': 'input',
        'status': 'badge',
        'estado': 'state', 'uf': 'state'
    };
    static TYPE_DEFINITIONS = {
        'currency': { align: 'right', formatter: 'currency' },
        'date': { align: 'center', formatter: 'date' },
        'cpf': { align: 'center', formatter: 'cpf' },
        'cnpj': { align: 'center', formatter: 'cnpj' },
        'phone': { align: 'center', formatter: 'phone' },
        'cep': { align: 'center', formatter: 'cep' },
        'km': { align: 'right', formatter: 'km' },
        'card': { align: 'center', formatter: null },
        'code': { align: 'center', formatter: null },
        'badge': { align: 'center', formatter: 'badge_custom_func' },
        'boolean_icon': { align: 'center', formatter: 'boolean_icon' },
        'center': { align: 'center' },
        'right': { align: 'right' },
        'left': { align: 'left' },
        'settings': { align: 'center', sortable: false },
        'input': { align: 'center', sortable: true },
        'state': { align: 'center', width: '60px' }
    };

    /**
     * Resolve propriedades visuais (alinhamento, formatter) com base no tipo.
     * Utiliza mapa de aliases (ex: 'moeda' -> 'currency').
     * @param {string} type - Tipo de dado.
     */
    static getTypeConfig(type) {
        if (!type) return {};
        const rawType = type.toLowerCase();
        const canonical = RendererUtils.TYPE_ALIASES[rawType] || rawType;
        const def = RendererUtils.TYPE_DEFINITIONS[canonical];
        if (!def) return {};
        const config = {
            align: def.align,
            sortable: def.sortable
        };
        if (def.formatter) {
            if (def.formatter === 'badge_custom_func') {
                config.formatter = RendererUtils.renderStatusBadge;
            } else if (RendererUtils.formatters[def.formatter]) {
                config.formatter = RendererUtils.formatters[def.formatter];
            }
        }
        return config;
    }
    static renderStatusBadge(status, customMap) {
        if (!status) return '-';
        const upperStatus = String(status).toUpperCase();
        const defaultClassMap = {
            'ATIVO': 'status-ativo',
            'CONCLUÍDO': 'status-ativo',
            'BLOQUEADO': 'status-bloqueado',
            'CANCELADO': 'status-cancelado',
            'RECUSADO': 'status-cancelado',
            'REPROVADO': 'status-cancelado',
            'EM ANÁLISE': 'status-em-analise',
            'EM ANALISE': 'status-em-analise',
            'EM REVISAO': 'status-em-analise',
            'EM REVISÃO': 'status-em-analise',
            'EFETIVADO': 'status-efetivado',
            'CADASTRADO': 'status-cadastrado',
            'INATIVO': 'status-inativo',
            'ENTREGUE': 'status-entregue',
            'FINALIZADO': 'status-entregue'
        };
        const styleMap = {
            'SOLICITADO': {
                background: 'rgba(59, 191, 173, 0.1)',
                border: '1px solid #3BBFAD',
                color: '#3BBFAD'
            },
            'APROVADO': {
                background: 'rgba(118, 201, 110, 0.1)',
                border: '1px solid #76C96E',
                color: '#76C96E'
            },
            'PENDENTE': {
                background: 'rgba(255, 193, 7, 0.1)',
                border: '1px solid #FFC107',
                color: '#FFC107'
            },
            'EM DESENVOLVIMENTO': {
                background: 'linear-gradient(90deg, rgba(59, 191, 173, 0) 0%, #3BBFAD 100%)',
                border: '1px solid #3BBFAD',
                color: '#1a5c53'
            }
        };
        if (customMap && customMap[upperStatus]) {
            return `<span class="status-badge ${customMap[upperStatus]}">${status}</span>`;
        }
        if (styleMap[upperStatus]) {
            const s = styleMap[upperStatus];
            const inlineStyle = `
                box-sizing: border-box;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                padding: 3px 4px;
                border-radius: 4px;
                background: ${s.background};
                border: ${s.border};
                color: ${s.color};
                font-weight: 500;
                white-space: nowrap;
            `;
            return `<span class="status-badge" style="${inlineStyle.replace(/\s+/g, ' ').trim()}">${status}</span>`;
        }
        const cls = defaultClassMap[upperStatus] || 'status-neutro';
        return `<span class="status-badge ${cls}">${status}</span>`;
    }
    static getEmptyStateIcon(type, color, secondaryColor) {
        const primary = color || 'currentColor';
        const secondary = secondaryColor || '#3F4444';
        if (type === 'enterprise') return RendererUtils.getEnterpriseLightSVG(primary, secondary);
        return RendererUtils.getGraphicLightSVG(primary, secondary);
    }
    static renderEmptyState(container, config) {
        if (!container) return;
        const { iconType, color, title, message } = config;
        const dynamicColor = color || '#333';
        const svgHtml = RendererUtils.getEmptyStateIcon(iconType, dynamicColor);
        container.innerHTML = `
            <div class="empty-state" style="width: 100%; min-height: 300px; display: flex; flex-direction: column; align-items: center; justify-content: center; border-radius: 8px; border: 1px dashed #e0e0e0; margin-top: 10px; padding: 50px 20px;">
                ${svgHtml}
                <h5 style="color: #555; font-weight: 700; margin-bottom: 8px;">${title}</h5>
                <p class="text-muted" style="font-size: 0.95em; margin-bottom: 0;">${message}</p>
            </div>
        `;
    }
    static renderWaitingState(containerId, config = {}) {
        if (!containerId) {
            console.warn('RendererUtils.renderWaitingState: containerId é obrigatório');
            return;
        }
        const container = typeof containerId === 'string'
            ? document.getElementById(containerId)
            : containerId;
        if (!container) {
            console.warn(`RendererUtils.renderWaitingState: Container "${containerId}" não encontrado`);
            return;
        }
        const detectedColor = RendererUtils.getThemeColor();
        const cssPrimary = RendererUtils.getCssVariable('--primary-color');
        const dynamicColor = config.color || detectedColor || cssPrimary || '#333333';
        const defaultConfig = {
            iconType: 'enterprise',
            title: 'Filtros não definidos',
            message: 'Defina os filtros acima e clique em Consultar para visualizar os dados.',
            color: dynamicColor
        };
        RendererUtils.renderEmptyState(container, { ...defaultConfig, ...config });
        RendererUtils.bindAutoSubmit();
    }

    /**
     * Gera o HTML para botões de ação (utilizado em Tabelas e Accordions).
     * @param {Array} actions - Array de configurações de ação.
     * @param {string|number} id - ID do item/linha.
     * @param {string} instanceId - ID da instância (para IDs únicos).
     * @returns {string} HTML dos botões.
     */
    static renderActionsHtml(actions, id, instanceId) {
        if (!actions || actions.length === 0) return '';

        let html = `<div class="tr-actions-container" style="display: flex; align-items: center; justify-content: center;">`;
        const inlineActions = actions.filter(a => a.inline);
        const dropdownActions = actions.filter(a => !a.inline);

        if (inlineActions.length > 0) {
            html += inlineActions.map((action, index) => {
                const globalIndex = actions.findIndex(a => a === action);
                return `
                <button class="btn btn-sm btn-link tr-action-btn-inline"
                    type="button"
                    style="color: #666; margin: 0 4px; padding: 0 4px;"
                    title="${action.title || ''}"
                    data-action="action-inline" data-index="${globalIndex}" data-id="${id}">
                    ${action.icon ? `<i class="${action.icon}"></i>` : (action.title || 'Ação')}
                </button>`;
            }).join('');
        }

        if (dropdownActions.length > 0) {
            html += `
                <button id="btn-actions-${instanceId}-${id}" class="tr-actions-btn" 
                    type="button"
                    data-action="action-menu-toggle" data-id="${id}"
                    style="margin-left: 5px;">
                    <i class="fa fa-ellipsis-h"></i>
                </button>
                <div id="action-menu-${instanceId}-${id}" class="tr-actions-menu">
                    ${dropdownActions.map(action => {
                const globalIndex = actions.findIndex(a => a === action);
                return `
                        <button class="tr-actions-item" type="button" data-action="action-item" data-index="${globalIndex}" data-id="${id}">
                            ${action.icon ? `<i class="${action.icon}"></i>` : ''}
                            ${action.title || 'Ação'}
                        </button>`;
            }).join('')}
                </div>`;
        }
        html += `</div>`;
        return html;
    }

    /**
     * Gera o HTML para checkboxes de seleção.
     * @param {string|number} id - ID do item.
     * @param {boolean} isChecked - Se está marcado.
     * @param {string} instanceId - ID da instância.
     * @param {boolean} [isHeader=false] - Se é checkbox de cabeçalho (Select All).
     * @returns {string} HTML do checkbox.
     */
    static renderCheckboxHtml(id, isChecked, instanceId, isHeader = false, options = {}) {
        const action = isHeader ? 'select-all' : 'select-row';
        const uniqueId = isHeader ? `cb-all-${instanceId}` : `cb-${instanceId}-${id}`;
        const scale = options.scale || 1;
        const customClass = options.customClass || '';
        const accentColor = options.accentColor || 'var(--primary-color)';

        const style = `cursor: pointer; vertical-align: middle; display: flex; align-items: center;`;

        return `
            <div class="tr-checkbox-wrapper ${customClass}-wrapper" style="${style}">
                <input type="checkbox" id="${uniqueId}" 
                    class="${customClass}"
                    data-action="${action}" 
                    data-id="${id}" 
                    ${isChecked ? 'checked' : ''}
                    style="pointer-events: auto; margin: 0; accent-color: ${accentColor}; transform: scale(${scale}); transform-origin: center;">
            </div>
        `;
    }

    /**
     * Interceptador global de 'Enter' em formulários de filtro.
     * Prevines submits múltiplos (spam/debounce) e redireciona para o botão de consulta correto.
     * Cache de 5 segundos para consultas idênticas.
     */
    static bindAutoSubmit() {
        $(document).off('keydown.smartRenderAuto').on('keydown.smartRenderAuto', 'input, select', function (e) {
            if (e.which === 13) {
                const $input = $(this);
                const $scope = $input.closest('form, .card, .container, .row, div[id^="div-card"]');
                const currentQuery = $scope.find('input, select, textarea').filter(':visible').serialize();
                const now = new Date().getTime();
                const lastQuery = $scope.data('sr-last-query');
                const lastTime = $scope.data('sr-last-time') || 0;
                if (now - lastTime < 1000) {
                    console.warn('[SmartRender] 🛡️ Spam protection: Enter ignorado.');
                    e.preventDefault(); e.stopPropagation();
                    return false;
                }
                if (currentQuery === lastQuery && (now - lastTime < 5000)) {
                    console.info('[SmartRender] 🛡️ Consulta idêntica ignorada (Cache de 5s).');
                    e.preventDefault(); e.stopPropagation();
                    return false;
                }
                let $btn = $scope.find('button[type="submit"]:visible');
                if ($btn.length === 0)
                    $btn = $scope.find('button:visible:has(.fa-search), a.btn:visible:has(.fa-search), button:visible:has(.fa-filter)');
                if ($btn.length === 0)
                    $btn = $scope.find('.btn-primary:visible, .btn-success:visible').not('[data-dismiss]');
                if ($btn.length === 0)
                    $btn = $scope.find('button:visible, a.btn:visible').first();
                if ($btn.length > 0) {
                    e.preventDefault();
                    e.stopPropagation();
                    $scope.data('sr-last-query', currentQuery);
                    $scope.data('sr-last-time', now);
                    console.log('[SmartRender] Enter detectado: Clicando em', $btn.text().trim() || 'Botão');
                    $btn.first().click();
                    return false;
                }
            }
        });
    }
    static renderEmptyStateFallback(container, config) {
        if (!container) return;
        const { iconUrl, color, title, message } = config;
        const iconStyle = `
            width: 60px; 
            height: 60px; 
            background-color: ${color || '#333'}; 
            -webkit-mask: url(${iconUrl}) no-repeat center; 
            mask: url(${iconUrl}) no-repeat center; 
            -webkit-mask-size: contain; 
            mask-size: contain;
            margin-bottom: 20px;
            display: inline-block;
        `;
        container.innerHTML = `
            <div class="empty-state" style="width: 100%; min-height: 300px; display: flex; flex-direction: column; align-items: center; justify-content: center; border-radius: 8px; border: 1px dashed #e0e0e0; margin-top: 10px; padding: 50px 20px;">
                <div style="${iconStyle}"></div>
                <h5 style="color: #555; font-weight: 700; margin-bottom: 8px;">${title}</h5>
                <p class="text-muted" style="font-size: 0.95em; margin-bottom: 0;">${message}</p>
            </div>
        `;
    }
    static renderPaginationHtml(config) {
        const { currentPage, totalPages, globalCallbackObj } = config;
        const accentColor = config.accentColor || '#333';
        const forceCompact = config.forceCompact || false;
        const isMobile = config.isMobile !== undefined ? config.isMobile : (typeof window !== 'undefined' && window.innerWidth <= 767);
        const shouldUseCompact = isMobile && (totalPages > 5 || forceCompact);
        const getOnClick = (pageVal) => `${globalCallbackObj}.dataController.goToPage(${pageVal}); return false;`;
        const hexOpacity = (hex, alpha) => RendererUtils.applyOpacity(hex, alpha);
        const activeStyle = `background-color: ${accentColor} !important; border-color: ${accentColor} !important; color: #ffffff !important; pointer-events: none; cursor: default;`;
        let html = `
            <div style="display: flex; align-items: center; ${isMobile ? 'justify-content: center; width: 100%;' : ''}">
                <nav style="${isMobile ? 'width: 100%; margin-top: 10px;' : ''}">
                    <ul class="pagination mb-0" style="margin: 0; gap: 5px; border-color: ${hexOpacity(accentColor, 1)} !important; ${isMobile ? 'width: 100%; justify-content: space-between; display: flex;' : ''}">
        `;
        if (shouldUseCompact) {
            html += `<li class="page-item ${Number(currentPage) === 1 ? 'disabled' : ''}" style="flex: 1; text-align: center;">
                        <a class="page-link" href="#" onclick="${getOnClick(currentPage - 1)}" style="width: 100%; display: block;">&laquo;</a>
                     </li>`;
            if (totalPages <= 3) {
                for (let i = 1; i <= totalPages; i++) {
                    const isActive = Number(currentPage) === i;
                    html += `<li class="page-item ${isActive ? 'active' : ''}" style="flex: 1; text-align: center;">
                                <a class="page-link" href="#" onclick="${isActive ? 'return false;' : getOnClick(i)}" style="width: 100%; display: block; ${isActive ? activeStyle : ''}">${i}</a>
                             </li>`;
                }
            } else {
                const isP1Active = Number(currentPage) === 1;
                html += `<li class="page-item ${isP1Active ? 'active' : ''}" style="flex: 1; text-align: center;">
                            <a class="page-link" href="#" onclick="${isP1Active ? 'return false;' : getOnClick(1)}" style="width: 100%; display: block; ${isP1Active ? activeStyle : ''}">1</a>
                          </li>`;
                const isMiddle = Number(currentPage) > 1 && Number(currentPage) < totalPages;
                const ellipsisClick = `var input = this.nextElementSibling; this.style.display = 'none'; input.style.display = 'block'; input.focus();`;
                const inputBlur = `setTimeout(() => { this.style.display='none'; this.previousElementSibling.style.display='block'; this.value=''; }, 200);`;
                const inputKey = `if(event.key === 'Enter') { let val = parseInt(this.value); if(!isNaN(val) && val >= 1 && val <= ${totalPages}) ${globalCallbackObj}.dataController.goToPage(val); }`;
                const middleSpanStyle = isMiddle
                    ? `background-color: ${accentColor} !important; border-color: ${accentColor} !important; color: #ffffff !important; cursor: pointer !important; pointer-events: auto !important;`
                    : `cursor: pointer; user-select: none;`;
                html += `<li class="page-item ${isMiddle ? 'active' : ''}" style="flex: 1; text-align: center; position: relative;">
                            <span class="page-link" style="width: 100%; display: block; ${middleSpanStyle}" 
                                  onclick="${ellipsisClick}">${isMiddle ? currentPage : '...'}</span>
                            <input type="number" class="page-link" style="display: none; width: 100%; text-align: center; padding: 0.5rem; border-radius: 0.25rem; height: 100%; margin: 0; -moz-appearance: textfield;" 
                                   placeholder="${currentPage}" min="1" max="${totalPages}" 
                                   onblur="${inputBlur}" 
                                   onkeydown="${inputKey}">
                          </li>`;
                const isPnActive = Number(currentPage) === totalPages;
                html += `<li class="page-item ${isPnActive ? 'active' : ''}" style="flex: 1; text-align: center;">
                            <a class="page-link" href="#" onclick="${isPnActive ? 'return false;' : getOnClick(totalPages)}" style="width: 100%; display: block; ${isPnActive ? activeStyle : ''}">${totalPages}</a>
                          </li>`;
            }
            html += `<li class="page-item ${Number(currentPage) === totalPages ? 'disabled' : ''}" style="flex: 1; text-align: center;">
                        <a class="page-link" href="#" onclick="${getOnClick(currentPage + 1)}" style="width: 100%; display: block;">&raquo;</a>
                      </li>`;
        } else {
            html += `<li class="page-item ${Number(currentPage) === 1 ? 'disabled' : ''}">
                        <a class="page-link" href="#" onclick="${getOnClick(currentPage - 1)}">&laquo;</a>
                     </li>`;
            let startPage, endPage;
            if (totalPages <= 5) {
                startPage = 1; endPage = totalPages;
            } else {
                if (currentPage <= 3) { startPage = 1; endPage = 4; }
                else if (currentPage + 2 >= totalPages) { startPage = totalPages - 3; endPage = totalPages; }
                else { startPage = currentPage - 1; endPage = currentPage + 1; }
            }
            if (startPage > 1) {
                const isActive = Number(currentPage) === 1;
                html += `<li class="page-item ${isActive ? 'active' : ''}">
                            <a class="page-link" href="#" onclick="${isActive ? 'return false;' : getOnClick(1)}" style="${isActive ? activeStyle : ''}">1</a>
                         </li>`;
                if (startPage > 2) html += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
            }
            for (let i = startPage; i <= endPage; i++) {
                const isActive = Number(currentPage) === i;
                html += `<li class="page-item ${isActive ? 'active' : ''}">
                            <a class="page-link" href="#" onclick="${isActive ? 'return false;' : getOnClick(i)}" style="${isActive ? activeStyle : ''}">${i}</a>
                         </li>`;
            }
            if (endPage < totalPages) {
                if (endPage < totalPages - 1) html += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
                const isActive = Number(currentPage) === totalPages;
                html += `<li class="page-item ${isActive ? 'active' : ''}">
                            <a class="page-link" href="#" onclick="${isActive ? 'return false;' : getOnClick(totalPages)}" style="${isActive ? activeStyle : ''}">${totalPages}</a>
                         </li>`;
            }
            html += `<li class="page-item ${Number(currentPage) === totalPages ? 'disabled' : ''}">
                        <a class="page-link" href="#" onclick="${getOnClick(currentPage + 1)}">&raquo;</a>
                      </li>`;
        }
        html += `</ul></nav></div>`;
        return html;
    }
    static renderPaginationBar(config) {
        const { currentPage, totalPages, pageSize, containerId, accentColor, globalCallbackObj } = config;
        const variant = config.variant || 'default';
        const safeAccent = accentColor || '#333';
        if (variant === 'accordion') {
            const totalItems = typeof config.totalItems === 'number' ? config.totalItems : 0;
            const start = totalItems === 0 ? 0 : (config.stats?.start || (((currentPage || 1) - 1) * (pageSize || 0)) + 1);
            const end = totalItems === 0 ? 0 : Math.min(config.stats?.end || ((currentPage || 1) * (pageSize || 0)), totalItems);
            const infoText = totalItems > 0 ? `${start} a ${end}` : '0 registros';
            const prevDisabled = Number(currentPage) === 1;
            const nextDisabled = Number(currentPage) >= Number(totalPages);
            const btnBaseStyle = `height: 32px; width: 32px; border: none; background-color: rgba(0,0,0,0.03); color: ${safeAccent}; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; cursor: pointer; transition: background-color 0.2s, transform 0.2s ease;`;
            const btnDisabledStyle = 'opacity: 0.4; cursor: not-allowed; pointer-events: none;';
            return `
                <div class="nar-pagination-minimal" style="--nar-primary-color: ${safeAccent}; display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 8px 0; width: 100%; flex-wrap: wrap;">
                    <div style="display: flex; align-items: center; gap: 8px; font-size: 0.8em; color: #555; flex-wrap: wrap;">
                        <label style="margin: 0; white-space: nowrap;">Mostrar</label>
                        <select class="page-size-select form-control input-sm nar-accordion-select"
                                onchange="${globalCallbackObj}.dataController.setPageSize(this.value)"
                                aria-label="Resultados por página"
                                style="height: 26px !important; padding: 3px 8px; font-size: 0.85em; border: 1px solid ${RendererUtils.applyOpacity(safeAccent, 0.4)}; background-color: #fff; color: #333; border-radius: 4px; width: auto; min-width: 60px; cursor: pointer;">
                            <option value="5" ${pageSize == 5 ? 'selected' : ''}>5</option>
                            <option value="10" ${pageSize == 10 ? 'selected' : ''}>10</option>
                            <option value="25" ${pageSize == 25 ? 'selected' : ''}>25</option>
                            <option value="50" ${pageSize == 50 ? 'selected' : ''}>50</option>
                            <option value="100" ${pageSize == 100 ? 'selected' : ''}>100</option>
                        </select>
                        </div>
                    <div style="display: flex; align-items: center; gap: 8px; font-weight: 600; color: #333;">
                        <button class="nar-page-btn nar-page-btn-prev" ${prevDisabled ? 'disabled' : ''} 
                                onclick="${prevDisabled ? 'return false;' : `${globalCallbackObj}.dataController.goToPage(${currentPage - 1})`}"
                                style="${btnBaseStyle} ${prevDisabled ? btnDisabledStyle : ''}" 
                                aria-label="Página anterior">
                            &laquo;
                        </button>
                        <span style="min-width: 60px; text-align: center; display: flex; align-items: center; justify-content: center; gap: 4px;">
                            <span class="nar-page-current" style="background-color: color-mix(in srgb, ${safeAccent} 15%, transparent); color: ${safeAccent}; padding: 4px 10px; border-radius: 4px; font-weight: 700; min-width: 24px; display: inline-block; text-align: center;">${currentPage}</span>
                            <span style="color: #666;">/</span>
                            <span style="color: #999;">${totalPages}</span>
                        </span>
                        <button class="nar-page-btn nar-page-btn-next" ${nextDisabled ? 'disabled' : ''} 
                                onclick="${nextDisabled ? 'return false;' : `${globalCallbackObj}.dataController.goToPage(${Number(currentPage) + 1})`}"
                                style="${btnBaseStyle} ${nextDisabled ? btnDisabledStyle : ''}" 
                                aria-label="Próxima página">
                            &raquo;
                        </button>
                    </div>
                </div>
            `;
        }
        return `
            <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; padding: 8px 12px; width: 100%; margin-top: 10px; background-color: #ffffff; border-radius: 4px;">
                <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 5px;">
                    <label style="margin-bottom: 0; font-weight: 500; color: #333; font-size: 0.9em; margin-right: 10px; white-space: nowrap;">
                        Resultados por página:
                    </label>
                    <select class="page-size-select form-control input-sm" 
                            onchange="${globalCallbackObj}.dataController.setPageSize(this.value)"
                            aria-label="Resultados por página"
                            style="display: inline-block; width: auto; height: 34px !important; padding: 2px 10px; font-size: 1rem; border: 1px solid ${RendererUtils.applyOpacity(accentColor || '#333', 0.4)}; background-color: #fff; color: #333; border-radius: 4px; cursor: pointer;">
                        <option value="5" ${pageSize == 5 ? 'selected' : ''}>5</option>
                        <option value="10" ${pageSize == 10 ? 'selected' : ''}>10</option>
                        <option value="25" ${pageSize == 25 ? 'selected' : ''}>25</option>
                        <option value="50" ${pageSize == 50 ? 'selected' : ''}>50</option>
                        <option value="100" ${pageSize == 100 ? 'selected' : ''}>100</option>
                    </select>
                </div>
                ${RendererUtils.renderPaginationHtml({
            currentPage: currentPage,
            totalPages: totalPages,
            containerId: containerId,
            accentColor: accentColor,
            globalCallbackObj: globalCallbackObj,
            forceCompact: config.forceCompact
        })}
            </div>
        `;
    }
    static renderGlobalFooter(targetContainerId, items, options = {}) {
        const targetEl = document.getElementById(targetContainerId);
        if (!targetEl) {
            console.warn(`RendererUtils.renderGlobalFooter: Container alvo '${targetContainerId}' não encontrado.`);
            return;
        }
        const config = {
            title: 'Total',
            defaultColor: RendererUtils.getThemeColor() || '#789cd6',
            ...options
        };
        const safeItems = Array.isArray(items) ? items : [];
        const footerId = `${targetContainerId}-footer-global`;
        if (safeItems.length === 0) {
            const existingFooter = document.getElementById(footerId);
            if (existingFooter) {
                existingFooter.remove();
            }
            return;
        }
        const hasValidData = safeItems.some(item => {
            const value = item.value;
            if (value === null || value === undefined || value === '') return false;
            if (typeof value === 'number') return value !== 0;
            const numValue = parseFloat(value);
            if (!isNaN(numValue)) return numValue !== 0;
            return true;
        });
        if (!hasValidData) {
            const existingFooter = document.getElementById(footerId);
            if (existingFooter) {
                existingFooter.remove();
            }
            return;
        }
        let footerEl = document.getElementById(footerId);
        if (footerEl) {
            footerEl.innerHTML = '';
        } else {
            footerEl = document.createElement('div');
            footerEl.id = footerId;
            footerEl.style.marginTop = '15px';
            if (targetEl.parentNode) {
                if (targetEl.nextSibling) {
                    targetEl.parentNode.insertBefore(footerEl, targetEl.nextSibling);
                } else {
                    targetEl.parentNode.appendChild(footerEl);
                }
            }
        }
        const styledItems = safeItems.map((item, index) => ({
            label: item.label,
            value: item.value,
            id: item.id || `${footerId}-item-${index}`,
            valueColor: item.valueColor || config.defaultColor,
            color: item.color || '#333333'
        }));
        RendererUtils.renderFooterHtml({
            containerId: footerId,
            title: config.title,
            items: styledItems,
            borderColor: config.borderColor,
            ...options
        });
    }
    static renderFooterHtml(config) {
        const { containerId, title, items, themeColor, borderColor } = config;
        const container = document.getElementById(containerId);
        if (!container) return;
        const safeThemeColor = RendererUtils.resolveThemeColor(themeColor);
        const safeBorderColor = borderColor || safeThemeColor;
        const safeTitle = title || 'Total';
        let html = `
            <div class="col-md-12">
                <p class="lead" style="margin-bottom: 8px; padding: 6px 0; font-weight: 700; border-bottom: 1px solid ${safeBorderColor}; background-color: #ffffff; color: ${safeThemeColor}; width: 100%; display: block; border-radius: 0;">
                    ${safeTitle}
                </p>
                <div class="table-responsive">
                    <table class="table table-borderless" style="margin-bottom: 8px; border-top: none !important;">
                        <tbody>
        `;
        if (items && Array.isArray(items)) {
            items.forEach(item => {
                const itemColor = item.color || '#333333';
                const itemValueColor = item.valueColor || safeThemeColor;
                html += `
                    <tr style="border-top: none !important;">
                        <td style="color: ${itemColor}; border-top: none !important;">${item.label}</td>
                        <td class="text-xs-right" id="${item.id || ''}" style="color: ${itemValueColor}; border-top: none !important;">
                            ${item.value || ''}
                        </td>
                    </tr>
                `;
            });
        }
        html += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        container.innerHTML = html;
    }

    /**
     * Resolve a configuração final unificando dados do backend e overrides do frontend.
     * Centraliza a lógica de decisão de layout (Accordion vs Table) e normalização de propriedades.
     *
     * @param {Object} data - Resposta completa do backend (deve conter Informacoes).
     * @param {Object} routeConfig - Configuração específica da rota (Frontend).
     * @param {Object} baseConfig - Configuração base global.
     * @returns {Object} Configuração final pronta para o smartRender.
     */
    static resolveConfig(data, routeConfig = {}, baseConfig = {}) {
        // 1. Inicia com a configuração base
        const finalConfig = { ...baseConfig };

        // 2. Mescla propriedades da raiz do routeConfig (ex: table, persistenceKey)
        // Isso garante que configurações específicas da rota sobrescrevam a base
        Object.keys(routeConfig).forEach(key => {
            if (key === 'accordion') return; // Accordion é tratado separadamente abaixo

            if (key === 'table' && finalConfig.table) {
                // Merge inteligente para o objeto 'table' para não perder defaults da base
                finalConfig.table = { ...finalConfig.table, ...routeConfig.table };
            } else {
                // Sobrescrita direta para outros campos (persistenceKey, etc)
                finalConfig[key] = routeConfig[key];
            }
        });

        // 3. Normalização e Unificação (Backend + Frontend)
        const backendAccordion = data.Informacoes?.Accordion || {};

        // Normaliza propriedade 'Niveis' do backend para 'levels' do engine
        if (backendAccordion.Niveis) {
            backendAccordion.levels = backendAccordion.Niveis;
        }

        // Mescla configs: O que está no Frontend (routeConfig) tem prioridade sobre o Backend
        const mergedAccordionConfig = {
            ...backendAccordion,
            ...(routeConfig.accordion || {})
        };

        // 3. Decisão de Renderização
        // Renderiza Accordion se houver níveis definidos (origem back ou front) OU se a rota tiver configuração explícita de accordion
        const hasLevels = mergedAccordionConfig.levels && mergedAccordionConfig.levels.length > 0;
        const shouldUseAccordion = hasLevels || !!routeConfig.accordion;

        if (shouldUseAccordion) {
            finalConfig.accordion = {
                allowSearch: true, // Default global para accordions
                ...mergedAccordionConfig
            };
        } else {
            // Garante que não sobrou lixo se for tabela
            delete finalConfig.accordion;
            delete finalConfig.levels;
        }

        return finalConfig;
    }

    static positionFloatingElement(targetEl, floatingEl, options = {}) {
        if (!targetEl || !floatingEl) return;
        const rect = targetEl.getBoundingClientRect();
        const menuWidth = floatingEl.offsetWidth;
        const menuHeight = floatingEl.offsetHeight;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const offsetY = options.offsetY || 2;
        let top = rect.bottom + offsetY;
        if (top + menuHeight > viewportHeight) {
            top = rect.top - menuHeight - offsetY;
            floatingEl.classList.add('tr-dropup');
        } else {
            floatingEl.classList.remove('tr-dropup');
        }
        let left = rect.left;
        if (left + menuWidth > viewportWidth) {
            left = rect.right - menuWidth;
            if (left < 0) left = 10;
        }
        floatingEl.style.position = 'fixed';
        floatingEl.style.top = `${top}px`;
        floatingEl.style.left = `${left}px`;
        floatingEl.style.right = 'auto';
        floatingEl.style.bottom = 'auto';
        floatingEl.style.visibility = 'visible';
    }
    static getEnterpriseLightSVG(dynamicColor, secondaryColor) {
        const neutral = secondaryColor || '#3F4444';
        return `
            <svg width="60" height="60" viewBox="0 0 140 140" fill="none" xmlns="http://www.w3.org/2000/svg">
                <g clip-path="url(#clip0_3013_13579)">
                    <path d="M9.69779 93.2778L30.4219 84.0508L28.4547 79.6324L7.73057 88.8594L9.69779 93.2778Z" stroke="${neutral}"/>
                    <path d="M-1.67969 93.8007L19.8438 84.2178L17.5206 79L-4.0028 88.5829L-1.67969 93.8007Z" fill="${neutral}"/>
                    <path d="M114 26.75H17.75V40.6187L50.1688 73.0812L52.75 75.6188V114.25H70.25V105.5H79V114.25C79 116.571 78.0781 118.796 76.4372 120.437C74.7962 122.078 72.5706 123 70.25 123H52.75C50.4294 123 48.2038 122.078 46.5628 120.437C44.9219 118.796 44 116.571 44 114.25V79.25L11.5813 46.8313C10.7624 46.0172 10.1127 45.0492 9.66971 43.983C9.2267 42.9167 8.99909 41.7734 9 40.6187V26.75C9 24.4294 9.92187 22.2038 11.5628 20.5628C13.2038 18.9219 15.4294 18 17.75 18H114V26.75Z" fill="${dynamicColor}"/>
                    <path d="M130.231 49.8937L117.106 36.7687C116.7 36.3587 116.216 36.0332 115.683 35.8111C115.149 35.589 114.578 35.4746 114 35.4746C113.422 35.4746 112.851 35.589 112.317 35.8111C111.784 36.0332 111.3 36.3587 110.894 36.7687L70.25 77.4562V96.75H89.5437L130.231 56.1062C130.641 55.6995 130.967 55.2156 131.189 54.6825C131.411 54.1494 131.525 53.5775 131.525 53C131.525 52.4224 131.411 51.8506 131.189 51.3175C130.967 50.7843 130.641 50.3004 130.231 49.8937ZM85.9563 88H79V81.0437L100.875 59.1687L107.831 66.125L85.9563 88ZM114 59.9562L107.044 53L114 46.0437L120.956 53L114 59.9562Z" fill="${dynamicColor}"/>
                    <path fill-rule="evenodd" clip-rule="evenodd" d="M78.0845 111.03C78.7651 110.93 79.3591 111.08 79.8664 111.481C79.9851 115.316 80.0248 119.15 79.9851 122.986C70.4021 123.024 60.8196 122.986 51.2375 122.873C50.9208 122.497 50.9208 122.121 51.2375 121.745C60.2623 118.286 69.2115 114.715 78.0845 111.03Z" fill="${neutral}"/>
                </g>
                <defs><clipPath id="clip0_3013_13579"><rect width="140" height="140" fill="white"/></clipPath></defs>
            </svg>`;
    }
    static getGraphicLightSVG(dynamicColor, secondaryColor) {
        const neutral = secondaryColor || '#3F4444';
        return `
            <svg width="60" height="60" viewBox="0 0 140 140" fill="none" xmlns="http://www.w3.org/2000/svg">
                <g id="enterprise" clip-path="url(#clip0_2683_34326)">
                    <path id="Vector" d="M35.275 29.7281C34.9236 29.3414 34.4952 29.0323 34.0173 28.8208C33.5394 28.6093 33.0226 28.5001 32.5 28.5C30.5109 28.5 28.6032 29.2902 27.1967 30.6967C25.7902 32.1032 25 34.0109 25 36V111C25 112.989 25.7902 114.897 27.1967 116.303C28.6032 117.71 30.5109 118.5 32.5 118.5H107.5C108.226 118.5 108.937 118.289 109.546 117.893C110.155 117.496 110.635 116.932 110.929 116.267C111.223 115.603 111.318 114.868 111.201 114.151C111.085 113.434 110.763 112.766 110.275 112.228L35.275 29.7281ZM44.4766 51H32.5V37.8188L44.4766 51ZM32.5 111V58.5H51.2969L99.025 111H32.5ZM115 36V96.5766C115 97.5711 114.605 98.525 113.902 99.2282C113.198 99.9315 112.245 100.327 111.25 100.327C110.255 100.327 109.302 99.9315 108.598 99.2282C107.895 98.525 107.5 97.5711 107.5 96.5766V58.5H73.225C72.2304 58.5 71.2766 58.1049 70.5733 57.4016C69.8701 56.6984 69.475 55.7446 69.475 54.75C69.475 53.7554 69.8701 52.8016 70.5733 52.0984C71.2766 51.3951 72.2304 51 73.225 51H107.5V36H96.25V39.75C96.25 40.7446 95.8549 41.6984 95.1517 42.4016C94.4484 43.1049 93.4946 43.5 92.5 43.5C91.5054 43.5 90.5516 43.1049 89.8483 42.4016C89.1451 41.6984 88.75 40.7446 88.75 39.75V36H52.7734C51.7789 36 50.825 35.6049 50.1218 34.9016C49.4185 34.1984 49.0234 33.2446 49.0234 32.25C49.0234 31.2554 49.4185 30.3016 50.1218 29.5984C50.825 28.8951 51.7789 28.5 52.7734 28.5H88.75V24.75C88.75 23.7554 89.1451 22.8016 89.8483 22.0983C90.5516 21.3951 91.5054 21 92.5 21C93.4946 21 94.4484 21.3951 95.1517 22.0983C95.8549 22.8016 96.25 23.7554 96.25 24.75V28.5H107.5C109.489 28.5 111.397 29.2902 112.803 30.6967C114.21 32.1032 115 34.0109 115 36Z" fill="${dynamicColor}"/>
                    <g id="vectors">
                        <path id="Vector_2" d="M11.6982 28.2777L32.4222 19.0508L30.455 14.6323L9.73093 23.8593L11.6982 28.2777Z" stroke="${neutral}"/>
                        <path id="Vector_3" d="M0.323121 28.7996L21.8466 19.2168L19.5234 13.999L-1.99999 23.5818L0.323121 28.7996Z" fill="${neutral}"/>
                    </g>
                    <path id="Vector_4" fill-rule="evenodd" clip-rule="evenodd" d="M110.15 106.035C110.808 105.918 111.382 106.094 111.87 106.562C111.986 111.034 112.024 115.508 111.986 119.983C102.734 120.027 93.4816 119.984 84.2295 119.852C83.9235 119.414 83.9235 118.974 84.2295 118.536C92.9416 114.5 101.584 110.334 110.15 106.035Z" fill="${neutral}"/>
                </g>
                <defs><clipPath id="clip0_2683_34326"><rect width="140" height="140" fill="white"/></clipPath></defs>
            </svg>
        `;
    }

    /**
     * Adapter para contratos legados (ex: JSON do backend).
     * Converte estruturas `Tabela.Cabecalho` e `Tabela.Campos` para o formato
     * moderno de array de objetos `columns`.
     */
    static convertLegacyTableConfig(legacyInfo) {
        if (!legacyInfo || !legacyInfo.Tabela) return { columns: [], onRowClick: null };
        const tabela = legacyInfo.Tabela;
        if (legacyInfo.Columns || tabela.Columns) {
            const cols = legacyInfo.Columns || tabela.Columns;
            let onRowClick = null;
            if (tabela.LinkTable && tabela.LinkTable.length >= 2) {
                const funcName = tabela.LinkTable[0];
                const paramField = tabela.LinkTable[1];
                onRowClick = (item) => {
                    if (typeof window !== 'undefined' && typeof window[funcName] === 'function') {
                        window[funcName](item[paramField]);
                    }
                };
            }
            return { columns: cols, onRowClick };
        }
        const cabecalho = tabela.Cabecalho || [];
        const campos = tabela.Campos || [];
        const alinhamentos = tabela.Alinhamento || [];
        const funJquery = legacyInfo.FunJquery || [];
        const columns = cabecalho.map((titulo, i) => {
            const campo = campos[i];
            const align = alinhamentos[i] || 'left';
            let type = null;
            if (campo.includes('STATUS')) type = 'badge';
            else if (campo.includes('VALOR') || campo.includes('VLR') || campo.includes('TOTAL')) type = 'currency';
            else if (campo.includes('DATA')) type = 'date';
            let formatter = null;
            if (funJquery && funJquery[i] && funJquery[i] !== '') {
                const funcName = funJquery[i];
                formatter = (value) => {
                    if (typeof window !== 'undefined' && typeof window[funcName] === 'function') {
                        return window[funcName](value);
                    }
                    return value;
                };
            }
            return {
                title: titulo,
                field: campo,
                align: align,
                type: type,
                formatter: formatter
            };
        });
        let onRowClick = null;
        if (tabela.LinkTable && tabela.LinkTable.length >= 2) {
            const funcName = tabela.LinkTable[0];
            const paramField = tabela.LinkTable[1];
            onRowClick = (item) => {
                if (typeof window !== 'undefined' && typeof window[funcName] === 'function') {
                    window[funcName](item[paramField]);
                }
            };
        }
        return { columns, onRowClick };
    }
    static initPlugins(instance, plugins) {
        if (!plugins || !Array.isArray(plugins)) return;
        plugins.forEach(plugin => {
            if (plugin && typeof plugin.init === 'function') {
                try {
                    plugin.init(instance);
                } catch (e) {
                    console.error(`Erro ao inicializar plugin ${plugin.constructor.name}:`, e);
                }
            }
        });
    }

    /**
     * Gerenciador de ciclo de vida dos plugins.
     * Executa hooks (ex: 'onInit', 'beforeRender') em todos os plugins registrados,
     * encapsulando tratamento de erros.
     */
    static runHook(plugins, hookName, args, context = {}) {
        if (!plugins || !Array.isArray(plugins)) return;
        const { debug, id, name } = context;
        const logPrefix = name || 'RenderEngine';
        plugins.forEach(plugin => {
            if (plugin && typeof plugin[hookName] === 'function') {
                try {
                    if (debug) console.log(`%c[${logPrefix}] 🔧 ${plugin.id || 'Plugin'} executando '${hookName}'`, 'color: #007bff');
                    plugin[hookName](...args);
                } catch (e) {
                    console.group(`%c[${logPrefix}] 🔴 Erro: ${plugin.id}`, 'color: red');
                    console.error(`Hook: ${hookName}`, e);
                    console.groupEnd();
                }
            }
        });
    }
    static resolveThemeColor(configColor, fallback = RendererUtils.DEFAULT_THEME_COLOR) {
        const detected = RendererUtils.getThemeColor();
        const cssPrimary = RendererUtils.getCssVariable('--primary-color');
        return configColor || detected || cssPrimary || fallback;
    }
    static getStandardEmptyState(customConfig = {}) {
        const defaults = {
            waiting: {
                iconType: 'enterprise',
                title: 'Filtros não definidos',
                message: 'Preencha os filtros acima para realizar a consulta.'
            },
            notFound: {
                iconType: 'graphic',
                title: 'Nenhum dado disponível',
                message: 'Ajuste os filtros para visualizar as informações.'
            }
        };
        return {
            waiting: { ...defaults.waiting, ...(customConfig.waiting || {}) },
            notFound: { ...defaults.notFound, ...(customConfig.notFound || {}) }
        };
    }
    static handleEmptyState(container, config, uiControls = {}) {
        const { hasDataLoaded, dataCount, emptyStateConfig, themeColor } = config;
        const { controls, footer, pagination } = uiControls;
        const showWaiting = !hasDataLoaded;
        const showNotFound = hasDataLoaded && dataCount === 0;
        if (!showWaiting && !showNotFound) {
            if (controls) controls.style.display = '';
            if (footer) footer.style.display = '';
            return false;
        }
        if (showWaiting) {
            if (controls) controls.style.display = 'none';
        } else {
            if (controls) controls.style.display = '';
        }
        if (footer) footer.style.display = 'none';
        if (pagination) pagination.innerHTML = '';
        const stateConfig = showWaiting ? emptyStateConfig.waiting : emptyStateConfig.notFound;
        RendererUtils.renderEmptyState(container, {
            iconType: stateConfig.iconType || (stateConfig.icon?.includes('enterprise') ? 'enterprise' : 'graphic'),
            color: themeColor || '#333333',
            title: stateConfig.title,
            message: stateConfig.message
        });
        return true;
    }
}

/**
 * Factory responsável por instanciar o renderizador correto (Table ou Accordion)
 * e normalizar as configurações de entrada.
 */
class DataRenderFactory {
    static create(containerId, data, config = {}, columns = null) {
        const $container = $(`#${containerId}`);
        let relacao = null;
        if (Array.isArray(data)) {
            relacao = data;
        } else if (data && typeof data === 'object') {
            if ('Relacao' in data) {
                relacao = data.Relacao || [];
            } else {
                relacao = null;
            }
        } else {
            relacao = null;
        }

        const info = (data && data.Informacoes) ? data.Informacoes : {};
        $container.empty();
        $(`input[id^="filter-"]`).remove();
        $(`#${containerId}-footer-global`).remove();

        const layoutNoHtml = $container.attr('data-layout');
        
        // Prioriza config.levels sobre data-layout do HTML para melhor portabilidade
        const hasConfigLevels = config.levels && config.levels.length > 0;
        const hasAccordionConfig = config.accordion?.levels?.length > 0;
        const hasBackendLevels = info.Accordion?.Niveis?.length > 0;
        const shouldBeAccordion = hasConfigLevels || hasAccordionConfig || hasBackendLevels || layoutNoHtml === 'accordion';
        
        const isTable = (info.IsTable !== undefined) ? info.IsTable : !shouldBeAccordion;
        const htmlColumns = $container.attr('data-colunas') ? JSON.parse($container.attr('data-colunas')) : null;

        let legacyConfig = null;
        if (info.Tabela) {
            legacyConfig = RendererUtils.convertLegacyTableConfig(info);
        }

        const backendColumns = legacyConfig ? legacyConfig.columns : null;
        const legacyOnRowClick = legacyConfig ? legacyConfig.onRowClick : null;

        let finalColumns = columns || config.columns || htmlColumns || backendColumns || window.ColunasGrid;

        if (config.visibleColumns && Array.isArray(config.visibleColumns) && finalColumns) {
            finalColumns = finalColumns.filter(col => config.visibleColumns.includes(col.field));
        }

        let actionsWidthOverride = null;
        if (config.columnStyles) {
            if (config.columnStyles['actions'] && config.columnStyles['actions'].width) {
                actionsWidthOverride = config.columnStyles['actions'].width;
            }
            if (finalColumns) {
                finalColumns = finalColumns.map(col => {
                    const styles = config.columnStyles[col.field] || {};
                    const reservedKeys = ['width', 'align', 'type', 'formatter', 'sortable', 'title', 'defaultHidden'];
                    const cssProps = [];
                    const columnOverrides = {};
                    Object.keys(styles).forEach(key => {
                        if (reservedKeys.includes(key)) {
                            columnOverrides[key] = styles[key];
                        } else {
                            const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
                            cssProps.push(`${cssKey}: ${styles[key]};`);
                        }
                    });
                    const styleString = (col.style || '') + cssProps.join(' ');
                    return {
                        ...col,
                        ...columnOverrides,
                        style: styleString
                    };
                });
            }
        }

        if (legacyOnRowClick) {
            if (!config.onRowClick) config.onRowClick = legacyOnRowClick;
            if (config.table && !config.table.onRowClick) config.table.onRowClick = legacyOnRowClick;
        }

        const finalPlugins = RendererUtils._resolvePlugins(config);
        config.plugins = finalPlugins;

        let renderer;
        if (isTable) {
            const tableDefaults = {
                pagination: true,
                pageSize: 10,
                isInAccordion: false
            };
            const tableConfig = {
                ...tableDefaults,
                ...config,
                ...(config.table || {}),
                plugins: finalPlugins
            };
            if (actionsWidthOverride) {
                tableConfig.actionsColumnWidth = actionsWidthOverride;
            }
            renderer = BasicTableRenderer.render(containerId, relacao, finalColumns, tableConfig);
        } else {
            const resolvedLevels = config.levels || config.accordion?.levels || info.Accordion?.Niveis || [];
            const accordionConfig = {
                ...config,
                levels: resolvedLevels,
                columns: finalColumns,
                actionsColumnWidth: actionsWidthOverride
            };
            renderer = BasicNestedAccordionRenderer.render(
                containerId,
                data,
                accordionConfig,
                finalColumns
            );
        }

        if (relacao && relacao.length > 0 && config.showFooter !== false) {
            RendererUtils.renderGlobalFooter(containerId, [
                { label: 'Quantidade', value: relacao.length, id: 'footer_qtd' }
            ], { title: config.footerTitle || 'Totais' });
        }

        return renderer;
    }
}

window.RendererUtils = RendererUtils;
window.DataRenderFactory = DataRenderFactory;