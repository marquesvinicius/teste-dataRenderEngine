/**
 * Motor core responsável por renderizar layouts hierárquicos (Accordions).
 * Gerencia normalização de dados, agrupamento recursivo por níveis e ciclo de vida do DOM.
 *
 * Diferente de uma tabela comum, este renderizador delega a exibição do nó final
 * (leaf) para o callback `config.renderLeaf`.
 */
class NestedAccordionRenderer {
    /**
     * Inicializa o renderizador e registra a instância globalmente.
     *
     * @param {Object} config - Configuração base.
     * @param {string} config.containerId - ID do elemento DOM alvo.
     * @param {string[]} config.levels - Campos usados para o agrupamento hierárquico (ex: ['ESTADO', 'CIDADE']).
     * @param {Object} [config.levelConfigs] - Configurações granulares por nível (0, 1, 2...). Permite sobrescrever `selection`, `actions`, `titleBadges` e `showCount` para níveis específicos. Ex: `{ 0: { selection: false }, 1: { selection: true } }`.
     * @param {string[]|Object} [config.titleBadges] - Badges a exibir ao lado do título do grupo. Pode ser array (por nível) ou objeto mapeado.
     * @param {Function} config.renderLeaf - Callback crítico: responsável por desenhar o conteúdo final (Tabela) dentro do último nível do accordion.
     * @param {Object[]} [config.plugins] - Lista de plugins ativos.
     * @param {boolean} [config.pagination=true] - Habilita paginação (default: true).
     * @param {boolean} [config.forceCompactPagination=true] - Força paginação compacta (default: true).
     * @param {boolean} [config.showCount=true] - Exibe contagem de itens (default: true).
     * @param {boolean} [config.selection=false] - Habilita seleção/checkboxes (default: false).
     */
    constructor(config) {
        this.containerId = config.containerId;
        this.tableId = config.containerId;
        this.config = config;
        this.levels = config.levels || [];
        this.renderLeaf = config.renderLeaf || null;
        this.columns = config.columns || [];
        this.hiddenColumns = new Set();
        this.columns.forEach(col => {
            if (col.defaultHidden) this.hiddenColumns.add(col.field);
        });
        this.primaryColor = RendererUtils.resolveThemeColor(config.primaryColor, '#333333');
        this.levelColors = config.levelColors || this.generateLevelColors(this.primaryColor);
        this.showCount = config.showCount ?? true;
        this.titleBadges = config.titleBadges || [];
        this.emptyState = RendererUtils.getStandardEmptyState(config.emptyState);
        this.pagination = {
            enabled: config.pagination ?? true,
            forceCompact: config.forceCompactPagination ?? true,
            currentPage: 1,
            pageSize: config.pageSize ?? 10,
            totalItems: 0,
            totalPages: 0
        };
        const initialData = Array.isArray(config.data) ? config.data : [];
        this.dataController = new DataController({
            keyField: config.keyField || 'CODIGO',
            searchFields: this.columns.map(c => c.field),
            pagination: false,
            isFieldVisible: (field) => !this.hiddenColumns.has(field),
            debug: config.debug,
            onDataChange: (state) => {
                this.render();
            }
        });
        /**
         * OVERRIDE INTENCIONAL (Instance-Level)
         * Substituímos os métodos de navegação da instância privada de DataController
         * para forçar a re-renderização completa do componente Accordion,
         * garantindo que a estrutura hierárquica seja reconstruída corretamente.
         * 
         * Isso é seguro pois altera apenas esta instância (this.dataController),
         * sem afetar o prototype da classe DataController.
         */
        this.dataController.goToPage = (page) => {
            this.pagination.currentPage = Number(page);
            this.render();
        };
        this.dataController.setPageSize = (size) => {
            this.pagination.pageSize = Number(size);
            this.pagination.currentPage = 1;
            this.render();
        };
        this.dataController.setData(initialData);
        this.hasDataLoaded = Array.isArray(config.data);
        this.tableConfig = config.table || {};
        this.formatters = config.formatters || {};
        this.actions = config.actions || [];
        this.selectionEnabled = config.selection ?? false;

        // Check if any level or table enables selection explicitly
        if (!this.selectionEnabled) {
            const hasLevelSelection = config.levelConfigs && Object.values(config.levelConfigs).some(cfg => cfg.selection === true);
            const hasTableSelection = config.table && config.table.selection === true;
            this.selectionEnabled = hasLevelSelection || hasTableSelection;
        }

        this._groupItemsMap = new Map();
        this.expandedGroups = new Set(); // Persistência de estado de expansão
        this.plugins = config.plugins || [];

        // Selection Plugin Integration
        if (this.selectionEnabled) {
            this.selectionPlugin = new SelectionPlugin({ enabled: true });
            this.plugins.push(this.selectionPlugin);
            this.selectionPlugin.init(this);
        }

        this.initStyles();
        if (!window.NestedAccordionInstances) window.NestedAccordionInstances = {};
        window.NestedAccordionInstances[this.containerId] = this;
        if (!window.TableInstances) window.TableInstances = {};
        window.TableInstances[this.containerId] = this;

        RendererUtils.initPlugins(this, this.plugins);
        this.runPluginHook('onInit', this);
        this.initStructure();
        this.initStructure();
        this.bindEvents(); // Bind accordion-specific events

        if (this.config.debug) {
            RendererUtils.logDebug(`NestedAccordionRenderer inicializado para #${this.containerId}`, {
                levels: this.levels,
                config: this.config
            }, 'info');
        }

        this.dataController.setData(initialData);

        this._destroyed = false;
    }

    /**
     * Recupera configuração específica para um nível, com fallback para global e default.
     */
    getConfig(property, level, defaultValue) {
        // 1. Tenta config específica do nível
        if (this.config.levelConfigs && this.config.levelConfigs[level] && this.config.levelConfigs[level][property] !== undefined) {
            return this.config.levelConfigs[level][property];
        }
        // 2. Tenta config global (this.config[property] ou this[property])
        if (this.config[property] !== undefined) return this.config[property];
        if (this[property] !== undefined) return this[property];

        // 3. Retorna default
        return defaultValue;
    }

    /**
     * Atualiza o dataset e força uma nova renderização imediata.
     * Utilizado para "reatividade" manual em atualizações externas.
     *
     * @param {Array} data - Array plano de objetos.
     */
    setData(data) {
        this.hasDataLoaded = true;

        let finalData = [];
        if (Array.isArray(data)) {
            finalData = data;
        } else if (data && typeof data === 'object') {
            finalData = data.Relacao || data.items || [];
        }
        // ---------------------------------------

        this.dataController.setData(finalData);
    }

    /**
     * API Pública para injetar controles na toolbar.
     * @param {HTMLElement|string} element - Elemento DOM ou string HTML.
     * @param {string} position - 'afterbegin' | 'beforeend'.
     */
    addToolbarControl(element, position = 'beforeend') {
        const toolbar = document.getElementById(`nar-toolbar-${this.containerId}`);
        if (!toolbar) return;

        if (typeof element === 'string') {
            toolbar.insertAdjacentHTML(position, element);
        } else if (element instanceof HTMLElement) {
            toolbar.insertAdjacentElement(position, element);
        }
    }

    initStructure() {
        const container = document.getElementById(this.containerId);
        if (!container) return;
        container.classList.add('nar-container');
        container.style.setProperty('--primary-color', this.primaryColor);
        const toolbarId = `nar-toolbar-${this.containerId}`;
        let toolbar = document.getElementById(toolbarId);
        if (!toolbar) {
            toolbar = document.createElement('div');
            toolbar.id = toolbarId;
            toolbar.className = 'nar-toolbar';
            toolbar.style.cssText = "margin-bottom: 10px; display:flex; justify-content:flex-end; gap: 10px;";
            container.appendChild(toolbar);
            this.runPluginHook('mountToolbar', toolbar);
        }
        const contentId = `nar-content-${this.containerId}`;
        let content = document.getElementById(contentId);
        if (!content) {
            content = document.createElement('div');
            content.id = contentId;
            container.appendChild(content);
        }
        const pagId = `nar-pagination-${this.containerId}`;
        let pag = document.getElementById(pagId);
        if (!pag) {
            pag = document.createElement('div');
            pag.id = pagId;
            container.appendChild(pag);
        }
    }
    generateLevelColors(baseColor) {
        return [
            { border: baseColor, bg: '#fff' },
            { border: RendererUtils.applyOpacity(baseColor, 0.7), bg: '#fff' },
            { border: RendererUtils.applyOpacity(baseColor, 0.4), bg: '#fff' },
            { border: '#e0e0e0', bg: '#fff' }
        ];
    }
    initStyles() {
        const primaryColor = this.primaryColor || '#0056b3';

        CommonStyles.initCommonStyles({
            accentColor: primaryColor,
            applyOpacity: (color, alpha) => RendererUtils.applyOpacity(color, alpha)
        });

        const cssContent = `
            ${NestedAccordionStyle.getStyles({
            primaryColor: primaryColor,
            applyOpacity: (color, alpha) => RendererUtils.applyOpacity(color, alpha)
        })}
            ${typeof window.PluginStyles !== 'undefined' ? window.PluginStyles.getStyles() : ''}
        `;

        CommonStyles.injectStyles('nar-styles-core', cssContent);
    }

    /**
     * Atualiza apenas o estado visual da seleção (checkboxes) sem re-renderizar todo o Accordion.
     * Isso preserva o estado dos componentes internos (como paginação das tabelas filhas).
     */
    updateSelectionVisuals() {
        if (!this.selectionEnabled || !this.selectionPlugin) return;

        // 1. Update Group Headers (Accordion Level)
        const headers = document.querySelectorAll(`#nar-content-${this.containerId} .nar-header`);
        headers.forEach(header => {
            const toggleId = header.getAttribute('data-toggle-id');
            const checkboxContainer = header.querySelector('.nar-checkbox-container');

            if (toggleId && checkboxContainer) {
                // Determine group selection state
                const items = this._groupItemsMap.get(toggleId);
                let isSelected = false;

                if (items && items.length > 0) {
                    isSelected = items.every(item =>
                        this.dataController.selectedIds.has(String(item[this.dataController.keyField]))
                    );
                }

                // Update checkbox
                const input = checkboxContainer.querySelector('input[type="checkbox"]');
                if (input) {
                    input.checked = isSelected;
                }

                // Update card visual state
                const card = document.getElementById(`card-${toggleId}`);
                if (card) {
                    if (isSelected) {
                        card.classList.add('selected');
                    } else {
                        card.classList.remove('selected');
                    }
                }
            }
        });

        // 2. Delegate to Leaf Tables (Nested Table Level)
        // Find all initialized table instances within this accordion
        const tables = document.querySelectorAll(`#nar-content-${this.containerId} .tr-table-wrapper table`);
        tables.forEach(table => {
            // Check global registry for the table instance
            // Note: TableRenderer usually registers itself in window.TableInstances using containerId.
            // In nested context, the containerId passed to BasicTableRenderer.render is the DIV id (leaf-content-${uniqueId}).

            // table is the <table> element inside the wrapper. 
            // We need to find the container div that was passed to BasicTableRenderer.render
            const leafContainer = table.closest('.nar-leaf-container');

            if (leafContainer && leafContainer.id) {
                const leafInstance = window.TableInstances[leafContainer.id];
                if (leafInstance && typeof leafInstance.updateSelectionVisuals === 'function') {
                    leafInstance.updateSelectionVisuals();
                } else if (leafInstance && leafInstance.selectionPlugin && typeof leafInstance.selectionPlugin.updateVisuals === 'function') {
                    // Fallback directo ao plugin se o metodo nao existir na instancia
                    leafInstance.selectionPlugin.updateVisuals(leafInstance);
                }
            }
        });
    }

    /**
     * Executa o pipeline de renderização:
     * 1. Aplica filtros e paginação via DataController.
     * 2. Agrupa dados conforme `this.levels`.
     * 3. Reconstrói o DOM do container e dispara hooks de plugins.
     */
    render() {
        const tStart = performance.now();
        const contentContainer = document.getElementById(`nar-content-${this.containerId}`);
        const paginationContainer = document.getElementById(`nar-pagination-${this.containerId}`);
        if (!contentContainer) return;

        this._groupItemsMap.clear(); // Limpa mapa de grupos

        this.runPluginHook('beforeRender');
        const activeData = this.dataController.filteredData;
        const isEmptyState = RendererUtils.handleEmptyState(
            contentContainer,
            {
                hasDataLoaded: this.hasDataLoaded,
                dataCount: activeData.length,
                emptyStateConfig: this.emptyState,
                themeColor: this.primaryColor
            }
        );
        if (isEmptyState) {
            if (paginationContainer) paginationContainer.innerHTML = '';
            return;
        }
        const groupedData = this.groupByLevels(activeData, this.levels, 0);
        const allKeys = Object.keys(groupedData).filter(k => k !== '_isLeaf' && k !== 'items');
        this.pagination.totalItems = allKeys.length;
        this.pagination.totalPages = Math.ceil(this.pagination.totalItems / this.pagination.pageSize) || 1;
        if (this.pagination.currentPage > this.pagination.totalPages) {
            this.pagination.currentPage = 1;
        }
        let keysToRender = allKeys;
        if (this.pagination.enabled) {
            const start = (this.pagination.currentPage - 1) * this.pagination.pageSize;
            const end = start + this.pagination.pageSize;
            keysToRender = allKeys.slice(start, end);
        }
        const pagedGroupedData = {};
        keysToRender.forEach(key => pagedGroupedData[key] = groupedData[key]);
        let html = '';
        if (groupedData._isLeaf) {
            const uniqueId = 'root';
            html = `<div id="leaf-content-${uniqueId}" class="nar-leaf-container" style="padding: 0;"></div>`;
            contentContainer.innerHTML = html;
            const leafContainer = document.getElementById(`leaf-content-${uniqueId}`);
            if (leafContainer && this.renderLeaf) {
                this.renderLeaf(groupedData.items, leafContainer, uniqueId);
            }
        } else {
            html = this.renderLevel(pagedGroupedData, 0, this.containerId);
            contentContainer.innerHTML = html;
            this.initLeafComponents(pagedGroupedData, 0, this.containerId);
        }
        if (this.pagination.enabled && paginationContainer) {
            paginationContainer.innerHTML = this.renderPaginationControls();
        }
        this.runPluginHook('onAfterRender');

        if (this.config.debug) {
            const tEnd = performance.now();
            const duration = (tEnd - tStart).toFixed(2);
            RendererUtils.logDebug(`Accordion Render Cycle: ${duration}ms`, {
                totalGroups: this.pagination.totalItems,
                groupsRendered: keysToRender.length
            }, 'perf');

            RendererUtils.renderDebugBadge(this.containerId, {
                duration: duration,
                mode: 'Update'
            });
        }
    }
    renderPaginationControls() {
        const { currentPage, pageSize, totalPages } = this.pagination;
        return RendererUtils.renderPaginationBar({
            currentPage,
            totalPages,
            pageSize,
            forceCompact: this.pagination.forceCompact,
            containerId: this.containerId,
            accentColor: this.primaryColor,
            globalCallbackObj: `window.NestedAccordionInstances['${this.containerId}']`
        });
    }
    renderEmptyState(container, stateConfig) {
        const config = stateConfig || this.emptyState.notFound;
        RendererUtils.renderEmptyState(container, {
            iconType: config.iconType,
            color: this.primaryColor,
            title: config.title,
            message: config.message
        });
    }
    groupByLevels(data, levels, currentLevel) {
        if (currentLevel >= levels.length) {
            return { _isLeaf: true, items: data };
        }
        const field = levels[currentLevel];
        const groups = {};
        data.forEach(item => {
            const key = this.getNestedValue(item, field) || 'Outros';
            if (!groups[key]) groups[key] = [];
            groups[key].push(item);
        });
        const result = {};
        Object.keys(groups).forEach(key => {
            result[key] = this.groupByLevels(groups[key], levels, currentLevel + 1);
        });
        return result;
    }
    getNestedValue(obj, path) {
        return path.split('.').reduce((o, i) => (o ? o[i] : null), obj);
    }
    countItems(node) {
        if (!node) return 0;
        if (node._isLeaf) return Array.isArray(node.items) ? node.items.length : 0;
        if (typeof node !== 'object') return 0;
        return Object.values(node).reduce((acc, subNode) => {
            if (subNode && (subNode._isLeaf || typeof subNode === 'object')) {
                return acc + this.countItems(subNode);
            }
            return acc;
        }, 0);
    }
    renderTitleBadges(level, levelColor = null) {
        // 1. Resolve a fonte (prioridade: levelConfigs > global)
        const source = this.getConfig('titleBadges', level, []);

        let badges = [];

        // Verifica se a configuração veio especificamente do levelConfigs para este nível
        const hasLevelConfig = this.config.levelConfigs &&
            this.config.levelConfigs[level] &&
            this.config.levelConfigs[level].titleBadges !== undefined;

        if (hasLevelConfig) {
            // Se estiver no levelConfigs, assume que o valor já é o array de badges para este nível
            badges = Array.isArray(source) ? source : [];
        } else if (Array.isArray(source)) {
            // Comportamento Legado: Array global aplica-se apenas ao nível 0
            if (level === 0) badges = source;
        } else if (source && typeof source === 'object') {
            // Mapeamento global: { 0: [...], 1: [...] }
            badges = source[level] || source[String(level)] || [];
        }

        if (!badges || badges.length === 0) return '';

        return badges.map(text => {
            const badgeStyle = levelColor ? `style="background-color: ${levelColor} !important;"` : '';
            return `<span class="nar-title-badge" ${badgeStyle}>${text}</span>`;
        }).join('');
    }
    getItems(node) {
        if (!node) return [];
        if (node._isLeaf) return node.items || [];
        if (typeof node !== 'object') return [];
        return Object.values(node).flatMap(subNode => this.getItems(subNode));
    }

    renderLevel(node, level, parentId) {
        if (!node || typeof node !== 'object') return '';
        let html = '';
        const theme = this.levelColors[level % this.levelColors.length] || this.levelColors[0];

        // Fator de escala para os checkboxes: diminui conforme o nível aumenta
        const scale = Math.max(0.85, 1 - (level * 0.15));

        Object.keys(node).forEach((key, index) => {
            if (key === '_isLeaf' || key === 'items') return;
            const childNode = node[key];
            const uniqueId = `${parentId}_${level}_${index}`;

            // Registra itens deste grupo para uso nos eventos (seleção/ações)
            const groupItems = this.getItems(childNode);
            this._groupItemsMap.set(uniqueId, groupItems);

            const isLeaf = childNode._isLeaf === true;
            const contentHtml = isLeaf
                ? `<div id="leaf-content-${uniqueId}" class="nar-leaf-container"></div>`
                : this.renderLevel(childNode, level + 1, uniqueId);
            const titleBadgesHtml = this.renderTitleBadges(level, theme.border);

            // Checkbox Logic
            let checkboxHtml = '';
            let isGroupSelected = false;

            // Resolve selection config for this level
            const globalSelection = this.config.selection ?? false;
            const isSelectionEnabled = this.getConfig('selection', level, globalSelection);

            if (isSelectionEnabled && this.selectionPlugin) {
                const allSelected = groupItems.length > 0 && groupItems.every(item =>
                    this.dataController.selectedIds.has(String(item[this.dataController.keyField]))
                );
                isGroupSelected = allSelected;
                checkboxHtml = this.selectionPlugin.renderGroupCheckbox(uniqueId, allSelected, { scale: scale });
            }

            // Actions Logic
            let actionsHtml = '';

            // Resolve actions config for this level
            const levelActions = this.getConfig('actions', level, this.actions);

            if (levelActions && levelActions.length > 0) {
                actionsHtml = RendererUtils.renderActionsHtml(levelActions, uniqueId, this.containerId);
                // Adicionamos data-level para tratamento de eventos
                actionsHtml = `<div class="nar-actions-container" data-level="${level}">${actionsHtml}</div>`;
            }

            // Expansion Logic
            const isExpanded = this.expandedGroups.has(uniqueId);
            const expandedClass = isExpanded ? ' expanded' : '';
            const wrapperStyle = isExpanded ? 'style="max-height: none;"' : '';

            html += `
                <div class="nar-card ${isGroupSelected ? 'selected' : ''}${expandedClass}" id="card-${uniqueId}">
                    <div class="nar-header" data-toggle-id="${uniqueId}" style="border-left-color: ${theme.border} !important; cursor: pointer;">
                        <div class="nar-title-group" style="display: flex; flex-direction: row; align-items: center; gap: 22px;">
                            ${checkboxHtml}
                            <div class="nar-main-content" style="display: flex; flex-direction: column; flex-grow: 1; gap: 4px;">
                                <div class="nar-title-wrapper" style="display: flex; align-items: center; gap: 8px;">
                                    <div class="nar-title" style="font-size: ${16 - (level * 1)}px;">${key}</div>
                                ${titleBadgesHtml}
                            </div>
                                <div class="nar-subtitle" style="display: flex; align-items: center; justify-content: flex-start; padding-left: 0;">
                                    ${this.getConfig('showCount', level, this.showCount) ? `<span class="nar-badge" style="padding: 2px 8px; font-size: 11px;"><i class="fa fa-list-ul"></i> ${this.countItems(childNode)} itens</span>` : ''}
                                </div>
                            </div>
                        </div>
                        <div class="nar-right-controls" style="display: flex; align-items: center; gap: 10px;">
                            ${actionsHtml}
                        <div class="nar-icon-container">
                            <i class="fa fa-chevron-down nar-chevron" id="chevron-${uniqueId}"></i>
                            </div>
                        </div>
                    </div>
                    <div class="nar-content-wrapper" id="wrapper-${uniqueId}" ${wrapperStyle}>
                        <div class="nar-body">${contentHtml}</div>
                    </div>
                </div>`;
        });
        return html;
    }

    toggleGroupSelection(uniqueId) {
        if (this.selectionPlugin) {
            this.selectionPlugin.toggleGroupSelection(uniqueId, this._groupItemsMap);
        }
    }

    // Handler para cliques em ações do accordion
    handleActionClick(actionIndex, uniqueId, level = null) {
        const items = this._groupItemsMap.get(uniqueId);
        // Se não achou por uniqueId, pode ser clique em folha (tabela interna)?
        // Actions em Accordion Header são de grupo.
        if (!items) return;

        let actions = this.actions;
        if (level !== null) {
            actions = this.getConfig('actions', level, this.actions);
        }

        const action = actions[actionIndex];
        if (!action) return;

        if (action.onClick) {
            // Passa a lista de itens do grupo para a ação
            action.onClick(items);
        }
    }

    bindEvents() {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        // Remove listeners antigos para evitar duplicidade se re-renderizar sem destruir instância
        // Mas bindEvents deve ser chamado apenas uma vez no constructor/init.

        this._clickHandler = (e) => {
            const target = e.target;

            // 1. Handle Actions (Priority)
            const actionElem = target.closest('[data-action]');
            if (actionElem) {
                const action = actionElem.getAttribute('data-action');
                const uniqueId = actionElem.getAttribute('data-id'); // Aqui é uniqueId do grupo ou ID da linha (mas linha é tabela filha, não chega aqui se bubbling stopped)

                // Actions do Accordion Header (Group Actions)
                if (target.closest('.nar-header')) {
                    // Impede que o clique na ação propague para o header (Toggle)
                    e.stopPropagation();

                    // Tenta descobrir o nível a partir do container de ações
                    const actionsContainer = actionElem.closest('.nar-actions-container');
                    const level = actionsContainer ? parseInt(actionsContainer.getAttribute('data-level')) : null;

                    if (action === 'action-inline' || action === 'action-item') {
                        const index = parseInt(actionElem.getAttribute('data-index'), 10);
                        this.handleActionClick(index, uniqueId, level);
                        if (action === 'action-item') {
                            this.closeActionMenu();
                        }
                    } else if (action === 'action-menu-toggle') {
                        this.toggleActionMenu(uniqueId, level);
                    }
                    return; // Finaliza processamento
                }
            }

            // 2. Handle Accordion Toggle
            // Se não for ação e for click no header
            const header = target.closest('.nar-header');
            if (header) {
                // Verifica se não clicou em algo interativo (input, button, a) que não foi capturado acima
                // Checkboxes já tem stopPropagation inline, então não devem chegar aqui.
                if (target.tagName === 'INPUT' || target.tagName === 'BUTTON' || target.tagName === 'A') return;

                const toggleId = header.getAttribute('data-toggle-id');
                if (toggleId) {
                    this.toggle(toggleId);
                }
            }
        };
        container.addEventListener('click', this._clickHandler);

        // Scroll close menu logic similar to TableRenderer
        this.boundScrollHandler = this.handleOutsideScroll.bind(this);
        document.addEventListener('scroll', this.boundScrollHandler, { passive: true });

        this._resizeHandler = () => this.closeActionMenu();
        window.addEventListener('resize', this._resizeHandler);
    }

    /**
     * Limpa listeners e estado interno.
     */
    destroy() {
        if (this._destroyed) return;
        this._destroyed = true;

        if (this.boundScrollHandler) {
            document.removeEventListener('scroll', this.boundScrollHandler);
        }
        if (this._resizeHandler) {
            window.removeEventListener('resize', this._resizeHandler);
        }

        const container = document.getElementById(this.containerId);
        if (container && this._clickHandler) {
            container.removeEventListener('click', this._clickHandler);
        }

        this.closeActionMenu();

        if (this.dataController) {
            this.dataController.destroy();
        }

        // Clear Maps
        if (this._groupItemsMap) this._groupItemsMap.clear();
        if (this.expandedGroups) this.expandedGroups.clear();

        // Nullify references
        this._clickHandler = null;
        this._resizeHandler = null;
        this.boundScrollHandler = null;
        this.dataController = null;

        // Remove from global registry
        if (window.NestedAccordionInstances && window.NestedAccordionInstances[this.containerId]) {
            delete window.NestedAccordionInstances[this.containerId];
        }
        if (window.TableInstances && window.TableInstances[this.containerId]) {
            delete window.TableInstances[this.containerId];
        }
    }

    // Reutilizando lógica de Menu do TableRenderer (Adaptada)
    handleOutsideScroll(e) {
        const openMenu = document.querySelector('.tr-actions-menu.show');
        if (!openMenu) return;
        if (!e.target.closest('.tr-actions-menu.show')) {
            this.closeActionMenu();
        }
    }

    toggleActionMenu(uniqueId, level = null) {
        const menuId = `action-menu-${this.containerId}-${uniqueId}`;
        const btnId = `btn-actions-${this.containerId}-${uniqueId}`;
        const btn = document.getElementById(btnId);

        this.closeActionMenu();

        const originalMenu = document.getElementById(menuId);
        if (originalMenu && btn) {
            const clone = originalMenu.cloneNode(true);
            clone.id = menuId + '-clone';
            clone.style.display = 'block';
            clone.style.position = 'fixed';
            clone.style.zIndex = '999999';
            clone.classList.add('show');

            // Re-bind events no clone pois cloneNode perde listeners
            clone.addEventListener('click', (e) => {
                const target = e.target.closest('[data-action="action-item"]');
                if (target) {
                    e.stopPropagation();
                    this.closeActionMenu();
                    const index = parseInt(target.getAttribute('data-index'), 10);
                    const uId = target.getAttribute('data-id');
                    this.handleActionClick(index, uId, level);
                }
            });

            document.body.appendChild(clone);
            RendererUtils.positionFloatingElement(btn, clone, { align: 'right', offsetY: 2 });

            let overlay = document.getElementById(`overlay-${this.containerId}`);
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = `overlay-${this.containerId}`;
                overlay.className = 'tr-menu-overlay';
                overlay.style.zIndex = '999990';
                overlay.onclick = () => this.closeActionMenu();
                document.body.appendChild(overlay);
            }
            overlay.classList.add('show');
        }
    }

    closeActionMenu() {
        const clones = document.querySelectorAll(`[id*="-clone"]`);
        clones.forEach(el => el.remove());
        const overlay = document.getElementById(`overlay-${this.containerId}`);
        if (overlay) overlay.classList.remove('show');
    }
    initLeafComponents(node, level, parentId) {
        if (!node || typeof node !== 'object') return;
        Object.keys(node).forEach((key, index) => {
            if (key === '_isLeaf' || key === 'items') return;
            const childNode = node[key];
            const uniqueId = `${parentId}_${level}_${index}`;
            if (childNode._isLeaf) {
                const container = document.getElementById(`leaf-content-${uniqueId}`);
                if (container && this.renderLeaf) {
                    this.renderLeaf(childNode.items, container, uniqueId);
                }
            } else {
                this.initLeafComponents(childNode, level + 1, uniqueId);
            }
        });
    }
    toggle(uniqueId) {
        const card = document.getElementById(`card-${uniqueId}`);
        const wrapper = document.getElementById(`wrapper-${uniqueId}`);
        if (!card || !wrapper) return;
        const isExpanded = card.classList.contains('expanded');
        if (isExpanded) {
            this.expandedGroups.delete(uniqueId);
            wrapper.style.maxHeight = wrapper.scrollHeight + "px";
            wrapper.offsetHeight;
            card.classList.remove('expanded');
            wrapper.style.maxHeight = null;
        } else {
            this.expandedGroups.add(uniqueId);
            card.classList.add('expanded');
            wrapper.style.maxHeight = wrapper.scrollHeight + "px";
            setTimeout(() => {
                if (card.classList.contains('expanded')) {
                    wrapper.style.maxHeight = 'none';
                }
            }, 500);
        }
    }
    renderLegacyTable(items, container) {
        if (!this.tableConfig || !this.tableConfig.campos) return;
        const { cabecalho, campos } = this.tableConfig;
        let html = '<div class="table-responsive"><table class="table table-hover mb-0"><thead><tr>';
        cabecalho.forEach(h => html += `<th>${h}</th>`);
        html += '</tr></thead><tbody>';
        items.forEach(item => {
            html += '<tr>';
            campos.forEach(campo => html += `<td>${item[campo] || ''}</td>`);
            html += '</tr>';
        });
        html += '</tbody></table></div>';
        container.innerHTML = html;
    }
    /**
     * Ponto de extensão para plugins.
     * Permite injeção de comportamento em momentos chave (ex: 'onInit', 'beforeRender').
     * @param {string} hookName
     * @param {...*} args - Argumentos passados para o hook.
     */
    runPluginHook(hookName, ...args) {
        RendererUtils.runHook(this.plugins, hookName, args, {
            debug: this.config.debug,
            id: this.containerId || this.tableId,
            name: this.constructor.name
        });
    }
    getPlugin(pluginName) {
        if (!this.plugins || this.plugins.length === 0) {
            console.warn(`[Accordion Debug] getPlugin('${pluginName}') chamado, mas this.plugins está vazio ou null.`);
            return null;
        }
        const found = this.plugins.find(p => p.constructor.name === pluginName);
        if (!found) {
            const foundById = this.plugins.find(p => p.id === 'column-manager' && pluginName === 'ColumnManagerPlugin');
            if (foundById) {
                return foundById;
            }
            console.error(`[Accordion Debug] Plugin '${pluginName}' não encontrado. Plugins disponíveis:`, this.plugins.map(p => p.constructor.name));
        }
        return found;
    }
}

/**
 * Fachada estática (Factory) para inicialização rápida de Accordions.
 * Responsável por normalizar contratos de dados legados (Relacao/Informacoes)
 * e resolver precedência de configurações (Global vs Tabela vs Accordion).
 */
class BasicNestedAccordionRenderer {
    /**
     * Ponto de entrada principal. Instancia o renderizador e define o comportamento padrão
     * das folhas (usando BasicTableRenderer).
     *
     * @param {string} containerId
     * @param {Object|Array} data - Suporta array plano ou objeto legado ({ Relacao, Informacoes }).
     * @param {Object} [options] - Opções de UI, paginação e overrides de config.
     * @param {Array} [columns] - Definição manual de colunas (opcional se vier no data).
     * @returns {NestedAccordionRenderer} Instância criada.
     */
    static render(containerId, data, options = {}, columns = null) {
        let finalData = null;
        if (data && typeof data === 'object' && 'Relacao' in data) {
            finalData = data.Relacao || [];
        } else if (Array.isArray(data)) {
            finalData = data;
        } else {
            finalData = null;
        }
        const safeData = data || {};
        const info = safeData.Informacoes || {};
        const accordionInfo = info.Accordion || {};
        const globalOpts = options || {};
        const accordionSpecificOpts = globalOpts.accordion || {};
        const tableSpecificOpts = globalOpts.table || {};

        // Config isolation: ensure root flags only come from accordion or root, NOT table
        const resolveRootFlag = (prop) => {
            if (accordionSpecificOpts[prop] !== undefined) return accordionSpecificOpts[prop];
            // Check root but exclude table-specific if names collide?
            // Usually globalOpts contains everything including 'table'.
            // We should trust properties at the root level unless they are explicitly 'table' or 'accordion' objects.
            // However, historically users might mix scopes.
            // If we strictly want to avoid table pollution, we should check if prop exists in globalOpts directly.
            // Given the issue, it seems globalOpts has properties merged from table config?
            // If globalOpts IS the object passed by smartRender, and smartRender merges table config into it...
            // Let's verify RendererUtils.resolveConfig logic.
            // Assuming globalOpts is the root config object:
            if (globalOpts[prop] !== undefined) return globalOpts[prop];
            return undefined;
        };
        const levels = globalOpts.levels || accordionSpecificOpts.levels || accordionInfo.Niveis || [];
        let finalColumns = columns || tableSpecificOpts.columns || globalOpts.columns;
        let onRowClick = tableSpecificOpts.onRowClick || globalOpts.onRowClick;
        const actions = tableSpecificOpts.actions || globalOpts.actions || [];
        const actionsColumnWidth = tableSpecificOpts.actionsColumnWidth || globalOpts.actionsColumnWidth || null;
        const plugins = globalOpts.plugins || [];
        if (!finalColumns) {
            const legacyConfig = RendererUtils.convertLegacyTableConfig(info);
            finalColumns = legacyConfig.columns;
            if (!onRowClick) onRowClick = legacyConfig.onRowClick;
        }
        const keepGroupingColumns = resolveRootFlag('keepGroupingColumns');
        if (!keepGroupingColumns && Array.isArray(finalColumns) && levels.length > 0) {
            finalColumns = finalColumns.filter(col => {
                const fieldName = (col && col.field) ? col.field : col;
                return !levels.includes(fieldName);
            });
        }
        if (!finalColumns || finalColumns.length === 0) {
            console.error("BasicNestedAccordionRenderer: Colunas finais vazias ou inválidas!", finalColumns);
        }
        const rootAllowSearch = resolveRootFlag('allowSearch');
        const rootAllowColMan = resolveRootFlag('allowColumnManagement');

        const resolvedKeyField = (info.Tabela && info.Tabela.LinkTable && info.Tabela.LinkTable[1]) ? info.Tabela.LinkTable[1] :
            (info.Tabela && info.Tabela.Columns && info.Tabela.Columns[0]) ? info.Tabela.Columns[0].field :
                (info.Tabela && info.Tabela.Campos) ? info.Tabela.Campos[0] : 'CODIGO';

        const renderer = new NestedAccordionRenderer({
            keyField: resolvedKeyField,
            containerId: containerId,
            levels: levels,
            data: finalData,
            ...globalOpts,
            ...accordionSpecificOpts,
            // Mantemos defaults do Accordion aqui pois ele é o "Componente" neste contexto
            pagination: accordionSpecificOpts.pagination ?? globalOpts.pagination,
            forceCompactPagination: accordionSpecificOpts.forceCompactPagination ?? globalOpts.forceCompactPagination,
            pageSize: accordionSpecificOpts.pageSize ?? globalOpts.pageSize ?? 10,
            primaryColor: accordionSpecificOpts.primaryColor || '#333333',
            titleBadges: accordionSpecificOpts.titleBadges || [],
            emptyState: options.emptyState,
            columns: finalColumns,
            table: tableSpecificOpts,
            plugins: plugins.filter(p => {
                if (p.constructor.name === 'ColumnManagerPlugin') return rootAllowColMan === true;
                if (p.constructor.name === 'SearchPlugin') return rootAllowSearch === true;
                return true;
            }),
            renderLeaf: (items, container, leafId) => {
                const accordionInstance = window.TableInstances[containerId];
                let columnsToRender = finalColumns;

                // Respeita colunas ocultas pelo ColumnManager do Accordion (se houver)
                if (accordionInstance && accordionInstance.hiddenColumns && accordionInstance.hiddenColumns.size > 0) {
                    columnsToRender = finalColumns.filter(col => !accordionInstance.hiddenColumns.has(col.field));
                }

                if (!Array.isArray(columnsToRender) || columnsToRender.length === 0) {
                    container.innerHTML = '<div class="text-muted p-2">Nenhuma coluna visível.</div>';
                    return;
                }

                // Clonagem inteligente dos plugins para a folha
                // Resolve flags locais para a folha (Leaf)
                const resolveLeafFlag = (prop) => {
                    if (tableSpecificOpts[prop] !== undefined) return tableSpecificOpts[prop];
                    if (globalOpts[prop] !== undefined) return globalOpts[prop];
                    return false;
                };
                const leafAllowSearch = resolveLeafFlag('allowSearch');
                const leafAllowColMan = resolveLeafFlag('allowColumnManagement');

                const leafPlugins = plugins
                    .filter(p => {
                        // Filtra plugins para a folha baseado nas configs da tabela
                        if (p.constructor.name === 'ColumnManagerPlugin' && !leafAllowColMan) return false;
                        if (p.constructor.name === 'SearchPlugin' && !leafAllowSearch) return false;
                        // O SelectionPlugin do pai (Accordion) NÃO deve ser passado para a folha.
                        // A folha deve instanciar seu próprio SelectionPlugin se selection: true.
                        if (p.constructor.name === 'SelectionPlugin') return false;
                        return true;
                    })
                    .map(p => {
                        if (p && p.constructor) {
                            // Special Case: ColumnManager precisa de persistenceKey única por folha
                            if (p.constructor.name === 'ColumnManagerPlugin') {
                                const baseKey = p.persistenceKey || containerId || 'auto-gen-accord';
                                return new p.constructor({
                                    persistenceKey: `${baseKey}_L_${leafId}`
                                });
                            }
                            // Special Case: SearchPlugin é stateless, nova instância é segura
                            if (p.constructor.name === 'SearchPlugin') return new p.constructor();
                        }
                        return p;
                    });

                // Construção da Configuração da Tabela Folha (Pass-Through)
                // Prioridade: Config Específica da Tabela > Config Global > Defaults do TableRenderer (implícitos)
                BasicTableRenderer.render(
                    container.id,
                    items,
                    columnsToRender,
                    {
                        // Defaults sensatos para contexto de Accordion, mas sobrescrevíveis
                        pageSize: 10,
                        forceCompactPagination: true,
                        isInAccordion: true,

                        // Merge de Configurações (Spread puro)
                        ...globalOpts,
                        ...tableSpecificOpts, // tableSpecificOpts ganha de globalOpts

                        // Garante que flags críticas sejam respeitadas explicitamente na folha
                        allowSearch: leafAllowSearch,
                        allowColumnManagement: leafAllowColMan,

                        // Overrides Críticos
                        plugins: leafPlugins,
                        tableId: `tbl-nested-${leafId}`,
                        keyField: resolvedKeyField,
                        actions: actions,
                        actionsColumnWidth: actionsColumnWidth,
                        onRowClick: onRowClick,

                        // Lógica de Seleção Híbrida (Herança com Override)
                        // 1. Se a tabela definiu explicitamente (true ou false), respeita a tabela (Cozinheiro manda).
                        // 2. Se a tabela é omissa (undefined), herda do Accordion (Garçom sugere o padrão da casa).
                        selection: (tableSpecificOpts.selection !== undefined)
                            ? tableSpecificOpts.selection
                            : (accordionInstance && accordionInstance.selectionEnabled),

                        // Sincronização de Estado de Seleção
                        // Passamos o Set do Accordion para a Tabela Folha usar como referência externa.
                        // Isso garante que seleções feitas na folha reflitam no estado global do accordion.
                        externalSelectedIds: accordionInstance ? accordionInstance.dataController.selectedIds : null,

                        onSelectionChange: (selectedItems) => {
                            if (accordionInstance) {
                                // Prevent full re-render on selection change to avoid state loss (pagination reset)
                                accordionInstance.updateSelectionVisuals();
                            }
                        },

                        // Extra Configs (sempre por último para garantir override se necessário)
                        ...(tableSpecificOpts.extraConfig || {}),
                    }
                );
            }
        });
        if (!window.TableInstances) window.TableInstances = {};
        window.TableInstances[containerId] = renderer;
        renderer.metaInfo = info;
        return renderer;
    }
}
window.BasicNestedAccordionRenderer = BasicNestedAccordionRenderer;