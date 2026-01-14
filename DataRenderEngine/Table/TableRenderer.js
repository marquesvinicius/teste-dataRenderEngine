/**
 * Renderizador de tabelas agnóstico a framework (Vanilla JS).
 * Suporta ordenação, paginação, seleção múltipla e plugins de extensão.
 *
 * Principais responsabilidades:
 * - Construção do DOM da tabela e controles.
 * - Binding de eventos (clique, sort, scroll).
 * - Integração com DataController para gestão de estado.
 */
class TableRenderer {
    /**
     * @param {Object} config
     * @param {string} config.containerId - ID do elemento pai onde a tabela será montada.
     * @param {Object[]} config.columns - Definição das colunas (field, title, type, width, align).
     * @param {Object[]} [config.actions] - Botões de ação. Ex: [{ icon: 'fa-edit', title: 'Editar', onClick: (item) => ... }]
     * @param {boolean} [config.selection=false] - Habilita checkboxes de seleção múltipla (default: false).
     * @param {number} [config.pageSize=10] - Quantidade de itens por página.
     * @param {string} [config.keyField='CODIGO'] - Campo usado como ID único da linha.
     * @param {boolean} [config.legacyTableRenderer=false] - Modo de compatibilidade com CSS legado.
     * @param {string} [config.persistenceKey] - Chave para salvar preferências (largura colunas, ordenação) no LocalStorage.
     * @param {boolean} [config.isInAccordion=false] - Flag para ajustar layout se estiver dentro de um accordion.
     */
    constructor(config) {
        this.containerId = config.containerId;
        this.tableId = config.tableId || 'dataTable-' + Math.floor(Math.random() * 10000);
        this.config = config;
        this.columns = config.columns || [];
        this.actions = config.actions || [];
        this.actionsColumnWidth = config.actionsColumnWidth || null;
        this.footer = config.footer || null;
        this.onRowClick = config.onRowClick;
        this.selectionEnabled = config.selection ?? false;
        this.legacyTableRenderer = config.legacyTableRenderer === true;
        this.allowColumnManagement = config.allowColumnManagement !== false;
        this.persistenceKey = config.persistenceKey || null;
        this.hiddenColumns = new Set();
        this.columns.forEach(col => {
            if (col.defaultHidden) this.hiddenColumns.add(col.field);
        });
        this.dataController = new DataController({
            keyField: config.keyField || 'CODIGO',
            pageSize: config.pageSize ?? 10,
            searchFields: config.searchFields,
            pagination: config.pagination,
            externalSelectedIds: config.externalSelectedIds,
            debug: config.debug,
            isFieldVisible: (field) => !this.hiddenColumns.has(field),
            onDataChange: (state) => {
                this.runPluginHook('onDataChange', state);
                this.updateTable(state);
            },
            onSelectionChange: (selectedItems) => {
                this.updateSelectionVisuals();
                if (config.onSelectionChange) config.onSelectionChange(selectedItems);
            }
        });
        this.plugins = config.plugins || [];
        RendererUtils.initPlugins(this, this.plugins);
        this.accentColor = RendererUtils.resolveThemeColor(config.accentColor, '#333333');
        const detectedColor = RendererUtils.getThemeColor();
        this.headerColor = config.headerColor || detectedColor || '#f8f9fa';
        this.headerBorderColor = config.headerBorderColor || RendererUtils.getHeaderBorderBottomColor() || '#333333';
        this.thBorderColor = config.thBorderColor || RendererUtils.getCssVariable('--table-th-border-color') || '#333333';
        this.sortState = { field: null, direction: 'asc' };
        this.iconeOrdenacaoNova = config.iconeOrdenacaoNova === true;
        this.hoverOrdenacaoPreditivo = config.hoverOrdenacaoPreditivo !== false;
        this.forceCompactPagination = config.forceCompactPagination !== false;
        this.isInAccordion = config.isInAccordion === true;
        this.criticalColumns = config.criticalColumns || [];
        this.headerTextColor = config.headerTextColor || (this.headerColor === '#f8f9fa' ? this.accentColor : '#ffffff');
        this.hasDataLoaded = false;
        this._widthCache = new Map();
        this._lastDatasetRef = null;
        this.emptyState = RendererUtils.getStandardEmptyState(config.emptyState);

        // Selection Plugin Integration
        if (this.selectionEnabled) {
            this.selectionPlugin = new SelectionPlugin({ enabled: true });
            this.plugins.push(this.selectionPlugin);
            this.selectionPlugin.init(this);
        }

        if (this.config.debug) {
            RendererUtils.logDebug(`TableRenderer inicializado para #${this.containerId}`, {
                config: this.config,
                columns: this.columns
            }, 'info');
        }

        this.runPluginHook('onInit', this.dataController);
        this.initStyles();
        this.initStructure();
        this.bindGlobalEvents();
        this.bindInstanceEvents();
        this.boundScrollHandler = this.handleOutsideScroll.bind(this);

        this._destroyed = false;
        this._feedbackTimer = null;
    }

    /**
     * Fecha menus de ação flutuantes ao scrollar fora da área do menu.
     * @param {Event} e
     */
    handleOutsideScroll(e) {
        const openMenu = document.querySelector('.tr-actions-menu.show');
        if (!openMenu) return;
        const isInside = e.target.closest('.tr-actions-menu.show');
        if (!isInside) {
            this.closeActionMenu();
        }
    }

    /**
     * Ouve eventos específicos da instância, como edição de células (inline edit).
     */
    bindInstanceEvents() {
        this._bindDelegateEvents();
        const container = document.getElementById(this.containerId);
        if (!container) return;

        this._cellEditHandler = (e) => {
            if (!e.detail) return;
            const { id, field, value } = e.detail;
            if (this.dataController && !this.dataController.remotePagination && this.dataController.data) {
                const item = this.dataController.data.find(d =>
                    String(d[this.dataController.keyField]) === String(id)
                );
                if (item) {
                    item[field] = value;
                }
            }
        };
        container.addEventListener('tr-cell-edit', this._cellEditHandler);
    }

    _bindDelegateEvents() {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        // Input events for dirty state tracking
        this._inputHandler = (e) => {
            const target = e.target;
            if (target.matches('.tr-editable-input')) {
                // Future: Add dirty state visual indicator logic here if needed
                // Currently handled by direct tr-cell-edit dispatch on save
            }
        };
        container.addEventListener('input', this._inputHandler);

        // Keydown events for shortcuts (Enter/Escape)
        this._keydownHandler = (e) => {
            const target = e.target;
            if (!target.matches('.tr-editable-input')) return;

            if (e.key === 'Enter') {
                e.preventDefault(); // Prevent form submission if inside a form
                e.stopPropagation();

                const btn = target.parentNode.querySelector('[data-action="save-edit"]');
                this._handleCellSave(target, btn);
            } else if (e.key === 'Escape' || e.key === 'Esc') {
                e.preventDefault();
                e.stopPropagation();
                // Revert to original value
                const original = target.getAttribute('data-original-value');
                if (original !== null) {
                    target.value = original;
                }
                target.blur();
            }
        };
        container.addEventListener('keydown', this._keydownHandler);

        this._clickHandler = (e) => {
            const target = e.target.closest('[data-action]');

            // Special handling for edit inputs to stop propagation
            if (e.target.matches('.tr-editable-input') || (target && target.getAttribute('data-action') === 'edit-input')) {
                e.stopPropagation();
                return;
            }

            if (!target) return;

            const action = target.getAttribute('data-action');
            const id = target.getAttribute('data-id');

            // Handle actions
            switch (action) {
                case 'save-edit':
                    e.stopPropagation();
                    const input = target.parentNode.querySelector('.tr-editable-input');
                    this._handleCellSave(input, target);
                    break;
                case 'sort':
                    this.handleSort(target.getAttribute('data-field'));
                    break;
                case 'select-all':
                    if (this.selectionPlugin) {
                        this.selectionPlugin.handleSelectAll(target.checked);
                    }
                    break;
                case 'select-row':
                    e.stopPropagation();
                    if (this.selectionPlugin) {
                        this.selectionPlugin.handleSelectRow(id);
                    }
                    break;
                case 'row-click':
                    this.handleRowClick(id);
                    break;
                case 'toggle-switch':
                    e.stopPropagation();
                    const toggleField = target.getAttribute('data-field');
                    this.handleColumnAction(toggleField, id, 'toggle', target.checked);
                    break;
                case 'settings-click':
                    e.stopPropagation();
                    const settingsField = target.getAttribute('data-field');
                    this.handleColumnAction(settingsField, id, 'settings');
                    break;
                case 'action-inline':
                    e.stopPropagation();
                    const index = parseInt(target.getAttribute('data-index'), 10);
                    this.handleActionClick(index, id);
                    break;
                case 'action-menu-toggle':
                    e.stopPropagation();
                    this.toggleActionMenu(id);
                    break;
            }
        };
        container.addEventListener('click', this._clickHandler);
    }

    bindGlobalEvents() {
        if (!window.TableRendererGlobalEventsBound) {
            window.addEventListener('resize', () => {
                const openMenus = document.querySelectorAll('.tr-actions-menu.show');
                if (openMenus.length > 0) {
                    if (window.TableInstances) {
                        Object.values(window.TableInstances).forEach(inst => inst.closeActionMenu());
                    }
                }
            });
            document.addEventListener('click', (e) => {
                const dropdowns = document.querySelectorAll('.tr-col-dropdown');
                dropdowns.forEach(dd => {
                    if (dd.style.display === 'block') {
                        const tableId = dd.id.replace('col-dropdown-', '');
                        const btn = document.getElementById(`col-btn-${tableId}`);
                        if (!dd.contains(e.target) && (!btn || !btn.contains(e.target))) {
                            dd.style.display = 'none';
                        }
                    }
                });
            });
            window.addEventListener('scroll', () => {
                const actionClones = document.querySelectorAll(`[id*="-clone"]`);
                if (actionClones.length > 0) {
                    actionClones.forEach(el => el.remove());
                    const overlays = document.querySelectorAll('.tr-menu-overlay');
                    overlays.forEach(o => o.classList.remove('show'));
                    const activeBtns = document.querySelectorAll('.tr-actions-btn-active');
                    activeBtns.forEach(btn => {
                        btn.classList.remove('tr-actions-btn-active');
                        btn.style.zIndex = '';
                        btn.style.position = '';
                    });
                }
            }, { passive: true });
            window.TableRendererGlobalEventsBound = true;
        }
    }

    /**
     * Atualiza dados e invalida cache de larguras se a referência do dataset mudar.
     * @param {Array} data
     */
    setData(data) {
        if (this._lastDatasetRef !== data) {
            this._lastDatasetRef = data;
            if (this._widthCache) this._widthCache.clear();
        }
        this.hasDataLoaded = true;
        this.dataController.setData(data);
    }

    getCssVariable(name) {
        if (typeof window === 'undefined' || !document) return null;
        const value = getComputedStyle(document.documentElement).getPropertyValue(name);
        return value ? value.trim() : null;
    }
    applyOpacity(color, alpha) {
        const percentage = Math.round(alpha * 100);
        return `color-mix(in srgb, ${color} ${percentage}%, transparent)`;
    }
    initStyles() {
        const accentColor = this.accentColor || '#333';

        CommonStyles.initCommonStyles({
            accentColor: accentColor,
            applyOpacity: (color, alpha) => this.applyOpacity(color, alpha)
        });

        const cssContent = `
            ${TableStyle.getBaseStyles({
            accentColor: accentColor,
            legacyTableRenderer: this.legacyTableRenderer,
            applyOpacity: (color, alpha) => this.applyOpacity(color, alpha)
        })}
            ${TableStyle.getExtendedStyles({
            accentColor: accentColor,
            tableId: this.tableId
        })}
            ${TableStyle.getComponentStyles({
            accentColor: accentColor,
            applyOpacity: (color, alpha) => this.applyOpacity(color, alpha)
        })}
            ${typeof window.PluginStyles !== 'undefined' ? window.PluginStyles.getStyles() : ''}
        `;

        CommonStyles.injectStyles('tr-styles-core', cssContent);
    }
    initStructure() {
        const container = document.getElementById(this.containerId);
        if (!container) return;
        container.innerHTML = '';
        const toolbarContainer = document.createElement('div');
        toolbarContainer.className = 'tr-controls';
        toolbarContainer.id = `toolbar-${this.tableId}`;
        toolbarContainer.style.display = 'flex';
        toolbarContainer.style.justifyContent = 'flex-end';
        toolbarContainer.style.alignItems = 'center';
        toolbarContainer.style.gap = '10px';
        toolbarContainer.style.marginBottom = '10px';
        container.appendChild(toolbarContainer);
        this.runPluginHook('mountToolbar', toolbarContainer);
        const tableContainer = document.createElement('div');
        tableContainer.id = `table-container-${this.tableId}`;
        container.appendChild(tableContainer);
        const paginationContainer = document.createElement('div');
        paginationContainer.id = `pagination-container-${this.tableId}`;
        container.appendChild(paginationContainer);
        if (this.footer) {
            const footerDiv = document.createElement('div');
            footerDiv.id = `footer-container-${this.tableId}`;
            footerDiv.className = 'row';
            footerDiv.style.marginTop = '15px';
            container.appendChild(footerDiv);
            this.renderFooter();
        }
        this.runPluginHook('onAfterStructureHelper');
        window.addEventListener('resize', () => this.runPluginHook('onWindowResize'));
        if (!this.hasDataLoaded) {
            this.updateTable({
                pageData: [],
                total: 0,
                pagination: { enabled: false, currentPage: 1, pageSize: 10 },
                totalPages: 0
            });
        }
    }

    /**
     * API Pública para injetar controles na toolbar.
     * @param {HTMLElement|string} element - Elemento DOM ou string HTML.
     * @param {string} position - 'afterbegin' | 'beforeend'.
     */
    addToolbarControl(element, position = 'beforeend') {
        const toolbar = document.getElementById(`toolbar-${this.tableId}`);
        if (!toolbar) return;

        if (typeof element === 'string') {
            toolbar.insertAdjacentHTML(position, element);
        } else if (element instanceof HTMLElement) {
            toolbar.insertAdjacentElement(position, element);
        }
    }

    /**
     * Renderiza o corpo da tabela e controles baseados no estado atual (dados filtrados/paginados).
     * Gerencia estados vazios e re-aplica seleção visual.
     * @param {Object} state - Estado vindo do DataController.
     */
    updateTable(state) {
        const tStart = performance.now();
        const tableContainer = document.getElementById(`table-container-${this.tableId}`);
        const paginationContainer = document.getElementById(`pagination-container-${this.tableId}`);
        const container = document.getElementById(this.containerId);
        const controls = container ? container.querySelector('.tr-controls') : null;
        const footer = document.getElementById(`footer-container-${this.tableId}`);

        if (!tableContainer || !paginationContainer) return;

        const scrollWrapper = tableContainer.querySelector('.tr-table-wrapper');
        const previousScrollLeft = scrollWrapper ? scrollWrapper.scrollLeft : 0;
        const previousScrollTop = scrollWrapper ? scrollWrapper.scrollTop : 0;

        const { pageData, total } = state;

        const isEmptyState = RendererUtils.handleEmptyState(
            tableContainer,
            {
                hasDataLoaded: this.hasDataLoaded,
                dataCount: pageData.length,
                emptyStateConfig: this.emptyState,
                themeColor: this.themeColor || this.accentColor
            },
            { controls, footer, pagination: paginationContainer }
        );

        if (isEmptyState) {
            this.updateSelectionVisuals();
            return;
        }

        const visibleColumns = this.columns.filter(col => !this.hiddenColumns.has(col.field));

        if (visibleColumns.length === 0) {
            this._renderNoColumnsState(tableContainer, controls, footer, paginationContainer);
            return;
        }

        const widthMap = this._calculateColumnWidths(visibleColumns, pageData);

        const html = `
            <div class="tr-table-wrapper table-responsive ${this._getTableWrapperClasses(visibleColumns, widthMap)}" style="width: 100%;">
                <table id="${this.tableId}" class="table" style="width: 100%;">
                    ${window.ColumnWidthUtils ? window.ColumnWidthUtils.buildColGroupHtml(visibleColumns, widthMap, this.selectionEnabled, this.actions.length > 0) : ''}
                    ${this._renderTableHeader(visibleColumns, widthMap)}
                    ${this._renderTableBody(pageData, visibleColumns, widthMap, state.pagination)}
                </table>
            </div>`;

        tableContainer.innerHTML = html;

        const newScrollWrapper = tableContainer.querySelector('.tr-table-wrapper');
        if (newScrollWrapper) {
            newScrollWrapper.scrollLeft = previousScrollLeft;
            newScrollWrapper.scrollTop = previousScrollTop;
        }

        if (state.pagination.enabled && total > 0) {
            paginationContainer.innerHTML = this.renderPagination(state);
        } else {
            paginationContainer.innerHTML = '';
        }

        this.updateSelectionVisuals();

        if (this.config.debug) {
            const tEnd = performance.now();
            const duration = (tEnd - tStart).toFixed(2);
            RendererUtils.logDebug(`Table Render Cycle: ${duration}ms`, {
                rows: pageData.length,
                total: total,
                cols: visibleColumns.length
            }, 'perf');
            
            RendererUtils.renderDebugBadge(this.containerId, { 
                duration: duration, 
                mode: 'Update' 
            });
        }
    }

    /**
     * Alias para updateTable visando consistência com NestedAccordionRenderer.
     * Permite forçar re-renderização via console de forma padronizada.
     */
    render() {
        if (this.dataController) {
            this.updateTable(this.dataController.getDataSnapshot());
        }
    }

    _renderNoColumnsState(container, controls, footer, pagination) {
        const noColsState = {
            title: 'Nenhuma coluna disponível',
            message: 'Selecione colunas no gerenciador para visualizar os dados.',
            iconType: 'empty',
        };
        RendererUtils.handleEmptyState(
            container,
            {
                hasDataLoaded: true,
                dataCount: 0,
                emptyStateConfig: { notFound: noColsState },
                themeColor: this.themeColor || this.accentColor
            },
            { controls, footer, pagination }
        );
        this.updateSelectionVisuals();
    }

    _calculateColumnWidths(visibleColumns, pageData) {
        const fullData = this.dataController.data || pageData || [];
        const cacheKey = (this.persistenceKey || this.containerId) + ':widths';
        return window.ColumnWidthUtils ?
            window.ColumnWidthUtils.computeAutoWidths(this.columns, fullData, this._widthCache, cacheKey, this.actions, this.actionsColumnWidth) :
            new Map();
    }

    _getTableWrapperClasses(visibleColumns, widthMap) {
        const hasFixedWidths = visibleColumns.some(col => col.width) || this.actions.length > 0;
        const selectionClass = this.selectionEnabled ? 'has-selection' : '';
        const fixedWidthClass = hasFixedWidths ? 'tr-table-fixed-widths' : '';
        const smartLayoutClass = (window.ColumnWidthUtils) ? 'tr-smart-layout' : '';
        const hasCriticalColumns = this.criticalColumns.length > 0;
        const criticalColumnsClass = hasCriticalColumns ? 'tr-has-critical-columns' : '';
        return `${selectionClass} ${fixedWidthClass} ${criticalColumnsClass} ${smartLayoutClass}`;
    }

    _renderTableHeader(visibleColumns, widthMap) {
        const actionsWidth = widthMap.get('actions') || 120;
        const actionsStyle = `width: ${actionsWidth}px; min-width: ${actionsWidth}px; max-width: ${actionsWidth}px;`;

        return `
            <thead style="background-color: #ffffff;">
                <tr>
                    <th class="tr-mobile-marker-cell"></th> 
                    ${this.selectionEnabled ? `
                    <th class="tr-checkbox-cell" style="width: 40px; text-align: center; vertical-align: middle; background-color: #ffffff; border-bottom: 1px solid ${this.thBorderColor} !important; padding: 12px 2px;">
                        ${this.selectionPlugin ? this.selectionPlugin.renderHeaderCheckbox() : ''}
                    </th>` : ''}
                    ${visibleColumns.map(col => this._renderHeaderCell(col, widthMap)).join('')}              
                    ${this.actions.length ? `<th style="${actionsStyle} text-align: center; vertical-align: middle; background-color: #ffffff; border-bottom: 1px solid ${this.thBorderColor} !important; color: ${this.headerTextColor}; padding: 14px 15px;">Ações</th>` : ''}
                </tr>
            </thead>`;
    }

    _renderHeaderCell(col, widthMap) {
        // Suporta 3 modos de ordenação visual:
        // 1. iconeOrdenacaoNova + hoverOrdenacaoPreditivo: Setas duplas que são animadas ao passar o mouse.
        // 2. iconeOrdenacaoNova (Simples): Seta única indicando estado atual.
        // 3. Legado (DataTables): Classes CSS clássicas para compatibilidade visual.
        const isSorted = this.sortState.field === col.field;
        const sortDir = this.sortState.direction;
        const isSortable = col.sortable !== false;
        let sortIcon = '';
        let baseClass = isSortable ? 'th-sortable' : '';
        let sortingClass = '';

        if (isSortable) {
            if (this.iconeOrdenacaoNova) {
                if (this.hoverOrdenacaoPreditivo) {
                    let containerClass = '';
                    if (isSorted) {
                        containerClass = sortDir === 'asc' ? 'is-active is-asc' : 'is-desc';
                    }
                    containerClass += ' hover-preditivo';
                    sortIcon = `
                        <div class="tr-sort-icons ${containerClass}">
                            <i class="fa fa-caret-up"></i>
                            <i class="fa fa-caret-down"></i>
                        </div>`;
                } else {
                    const icon = isSorted ? (sortDir === 'asc' ? 'fa-sort-asc' : 'fa-sort-desc') : 'fa-sort';
                    const activeClass = isSorted ? 'active' : '';
                    sortIcon = `<i class="fa ${icon} sort-icon ${activeClass}"></i>`;
                }
            } else {
                baseClass += ' th-sortable-datatables';
                if (this.hoverOrdenacaoPreditivo) baseClass += ' th-hover-preditivo';
                if (isSorted) sortingClass = sortDir === 'asc' ? 'sorting_asc' : 'sorting_desc';
            }
        }

        const dataAction = isSortable ? `data-action="sort" data-field="${col.field}"` : '';
        let widthStyle = '';
        if (col.width) {
            widthStyle = `width: ${col.width}; min-width: ${col.width};`;
        } else if (widthMap.has(col.field) && widthMap.get(col.field) !== null) {
            const wPx = widthMap.get(col.field);
            widthStyle = `width: ${wPx}px; min-width: ${wPx}px; max-width: ${wPx}px; box-sizing: border-box;`;
        }

        const isCritical = this.criticalColumns.includes(col.field);
        if (isCritical) {
            baseClass += ' tr-column-critical';
            if (!widthStyle.includes('min-width') || (parseInt(widthStyle.match(/min-width:\s*(\d+)/)?.[1] || 0) < 180)) {
                widthStyle += ' min-width: 180px !important;';
            }
        }
        if (col.noEllipsis) baseClass += ' tr-column-no-ellipsis';

        const isJustSorted = this.justSortedField === col.field;
        if (isJustSorted) baseClass += ' just-sorted';
        const removeJustSorted = isJustSorted ? `onmouseleave="this.classList.remove('just-sorted'); window.TableInstances['${this.containerId}'].justSortedField = null;"` : '';

        let contentHtml;
        if (isSortable && this.iconeOrdenacaoNova) {
            contentHtml = `
                <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
                    <span style="flex-grow: 1; text-align: ${col.align || 'left'}">${col.title}</span>
                    ${sortIcon}
                </div>`;
        } else {
            contentHtml = `
                <div class="tr-th-content" style="display: flex; align-items: center; justify-content: ${col.align === 'center' ? 'center' : (col.align === 'right' ? 'flex-end' : 'flex-start')};">
                    <span class="tr-th-title">${col.title}</span>
                    ${sortIcon}
                </div>`;
        }

        if (col.field === 'actions' || col.type === 'actions') baseClass += ' tr-col-actions';
        if (col.type) baseClass += ` tr-type-${col.type}`;

        return `
            <th class="${baseClass} ${sortingClass}" ${dataAction} ${removeJustSorted} 
                style="${widthStyle} vertical-align: middle; font-weight: 600; border-bottom: 1px solid ${this.thBorderColor} !important; background-color: #ffffff; color: ${this.headerTextColor}; white-space: nowrap; padding: 14px 15px; position: relative;"
                title="${col.title}">
                ${contentHtml}
            </th>`;
    }

    _renderTableBody(pageData, visibleColumns, widthMap, pagination) {
        let startCounter = 0;
        if (pagination && pagination.enabled) {
            startCounter = ((pagination.currentPage || 1) - 1) * (pagination.pageSize || 10);
        }
        return `
            <tbody style="counter-reset: rowNumber ${startCounter};">
                ${pageData.map(row => this._renderRow(row, visibleColumns, widthMap)).join('')}
            </tbody>`;
    }

    _renderRow(row, visibleColumns, widthMap) {
        const id = row[this.dataController.keyField];
        const isChecked = this.dataController.selectedIds.has(String(id));
        const checkedAttr = isChecked ? 'checked' : '';
        const rowClass = isChecked ? 'selected-row' : '';
        const hasGlobalLink = typeof window !== 'undefined' && window.LINK_TABLE && Array.isArray(window.LINK_TABLE);
        const isClickable = this.onRowClick || hasGlobalLink;
        const rowStyle = isClickable ? 'cursor: pointer;' : '';
        const dataAction = isClickable ? `data-action="row-click" data-id="${id}"` : '';

        let html = `<tr class="${rowClass}" data-id="${id}" style="${rowStyle}" ${dataAction}>`;
        html += `<td class="tr-mobile-marker-cell"></td>`;

        if (this.selectionEnabled) {
            html += `
                <td class="text-center tr-checkbox-cell" 
                    data-action="select-row" data-id="${id}"
                    style="cursor: pointer; vertical-align: middle; padding: 12px 2px;">
                    ${this.selectionPlugin ? this.selectionPlugin.renderRowCheckbox(id, isChecked) : ''}
                </td>`;
        }

        html += visibleColumns.map(col => this._renderCell(row, col, id, widthMap)).join('');

        if (this.actions.length) {
            html += this._renderActionsCell(id, widthMap);
        }

        html += `</tr>`;
        return html;
    }

    _renderCell(row, col, id, widthMap) {
        let value = row[col.field];
        const isCritical = this.criticalColumns.includes(col.field);
        const isNoEllipsis = col.noEllipsis;
        let cellClasses = '';
        if (col.type) cellClasses += ` tr-type-${col.type}`;
        if (isCritical) cellClasses += ' tr-column-critical';
        if (isNoEllipsis) cellClasses += ' tr-column-no-ellipsis';

        let widthStyle = '';
        if (col.width) {
            widthStyle = `width: ${col.width}; min-width: ${col.width};`;
        } else if (widthMap.has(col.field) && widthMap.get(col.field) !== null) {
            const wPx = widthMap.get(col.field);
            widthStyle = `width: ${wPx}px; min-width: ${wPx}px; max-width: ${wPx}px; box-sizing: border-box;`;
        }

        if (isCritical) {
            if (!widthStyle.includes('min-width') || (parseInt(widthStyle.match(/min-width:\s*(\d+)/)?.[1] || 0) < 180)) {
                widthStyle += ' min-width: 180px !important;';
            }
        }

        if (col.type === 'toggle') {
            return this._renderToggleCell(row, col, id, cellClasses, widthStyle);
        } else if (col.type === 'settings') {
            return `
                <td class="${cellClasses}" style="${widthStyle} text-align: ${col.align || 'center'}; vertical-align: middle; padding: 8px 15px;">
                    <button class="btn btn-sm btn-link tr-settings-btn" style="color: ${this.accentColor}; padding: 0 5px;" 
                        data-action="settings-click" data-field="${col.field}" data-id="${id}"
                        title="Parâmetros">
                        <i class="fa fa-cog"></i>
                    </button>
                </td>`;
        } else {
            if (col.formatter) {
                value = col.formatter(value, row, col);
            }
            const dataColumnAttr = `data-column="${col.field}"`;
            const dataTypeAttr = col.type ? `data-column-type="${col.type}"` : '';
            return `<td class="${cellClasses}" ${dataColumnAttr} ${dataTypeAttr} style="${widthStyle} ${col.style || ''} text-align: ${col.align || 'left'}; vertical-align: middle; padding: 8px 15px;">${value !== null && value !== undefined ? value : ''}</td>`;
        }
    }

    _renderToggleCell(row, col, id, cellClasses, widthStyle) {
        let isChecked = false;
        if (typeof col.checked === 'function') {
            isChecked = col.checked(row);
        } else if (typeof row[col.field] === 'boolean') {
            isChecked = row[col.field];
        } else {
            isChecked = row[col.field] == 1 || row[col.field] == 'true';
        }
        const toggleId = `toggle-${this.tableId}-${id}-${col.field}`;
        let labelHtml = '';
        const labelId = `toggle-label-${this.tableId}-${id}-${col.field}`;
        if (col.toggleLabel) {
            const labelText = typeof col.toggleLabel === 'function' ? col.toggleLabel(row) : col.toggleLabel;
            if (labelText) {
                labelHtml = `<span id="${labelId}" class="tr-toggle-label">${labelText}</span>`;
            }
        }

        return `
            <td class="${cellClasses}" style="${widthStyle} text-align: ${col.align || 'left'}; vertical-align: middle; padding: 8px 15px;">
                <div class="tr-toggle-wrapper" style="justify-content: ${col.align === 'center' ? 'center' : (col.align === 'right' ? 'flex-end' : 'flex-start')};" data-action="stop-propagation">
                    ${labelHtml}
                    <label class="tr-switch">
                        <input type="checkbox" id="${toggleId}" ${isChecked ? 'checked' : ''} 
                            data-action="toggle-switch" data-field="${col.field}" data-id="${id}">
                        <span class="tr-slider"></span>
                    </label>
                </div>
            </td>`;
    }

    _renderActionsCell(id, widthMap) {
        const actionsWidth = widthMap.get('actions') || 120;
        const actionsStyle = `width: ${actionsWidth}px; min-width: ${actionsWidth}px; max-width: ${actionsWidth}px;`;

        return `<td data-action="stop-propagation" style="${actionsStyle} text-align: center; vertical-align: middle; padding: 12px 15px; overflow: visible;">
            ${RendererUtils.renderActionsHtml(this.actions, id, this.tableId)}
        </td>`;
    }

    /**
     * Gerencia a ordenação de colunas.
     * Suporta ordenação customizada para colunas especiais (toggle, currency) via `customCompare`.
     * 
     * Estratégia de Comparação:
     * - Currency: Normaliza strings 'R$ 1.000,00' para float antes de comparar.
     * - Toggle/Boolean: Agrupa true/false.
     * - Default: LocaleCompare numérico para strings gerais.
     */
    handleSort(field) {
        let newDirection = 'asc';
        if (this.sortState.field === field) {
            if (this.sortState.direction === 'asc') {
                newDirection = 'desc';
            } else if (this.sortState.direction === 'desc') {
                newDirection = null;
            }
        }
        this.justSortedField = field;
        if (newDirection === null) {
            this.sortState = { field: null, direction: 'asc' };
            if (this.dataController) {
                this.dataController.setSort(null, null);
            }
        } else {
            this.sortState = { field, direction: newDirection };
            if (this.dataController && !this.dataController.remotePagination) {
                const compare = (a, b) => {
                    const valA = a[field];
                    const valB = b[field];
                    if (valA == null && valB == null) return 0;
                    if (valA == null) return 1;
                    if (valB == null) return -1;
                    const colDef = this.columns.find(c => c.field === field);
                    const type = colDef ? colDef.type : null;
                    if (type === 'input' || type === 'currency' || (!isNaN(valA) && !isNaN(valB) && valA !== '' && valB !== '')) {
                        const floatA = parseFloat(String(valA).replace('R$', '').replace(/\./g, '').replace(',', '.').trim());
                        const floatB = parseFloat(String(valB).replace('R$', '').replace(/\./g, '').replace(',', '.').trim());
                        if (!isNaN(floatA) && !isNaN(floatB)) {
                            return floatA - floatB;
                        }
                    }
                    if (type === 'toggle' || typeof valA === 'boolean') {
                        const boolA = valA === true || valA === 'true' || valA === 1;
                        const boolB = valB === true || valB === 'true' || valB === 1;
                        return (boolA === boolB) ? 0 : (boolA ? -1 : 1);
                    }
                    return String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: 'base' });
                };
                this.dataController.setSort(field, newDirection, compare);
            } else {
                this.dataController.setSort(field, newDirection);
            }
        }
    }
    renderPagination(state) {
        const { currentPage, pageSize } = state.pagination;
        const totalPages = state.totalPages;
        const config = {
            currentPage: currentPage,
            totalPages: totalPages,
            pageSize: pageSize,
            containerId: this.containerId,
            accentColor: this.accentColor,
            globalCallbackObj: `window.TableInstances['${this.containerId}']`,
            forceCompact: this.forceCompactPagination || this.tableId === 'table-cartoes'
        };
        if (this.isInAccordion) {
            config.variant = 'accordion';
            config.totalItems = state.total || 0;
            config.stats = state.stats || { start: 0, end: 0 };
        }
        return RendererUtils.renderPaginationBar(config);
    }
    updateSelectionVisuals() {
        if (!this.selectionEnabled || !this.selectionPlugin) return;
        this.selectionPlugin.updateVisuals();
    }
    renderFooter() {
        if (this.footer) {
            RendererUtils.renderFooterHtml({
                containerId: `footer-container-${this.tableId}`,
                title: this.footer.title,
                items: this.footer.items,
                themeColor: this.headerColor,
                borderColor: this.thBorderColor
            });
        }
    }
    updateFooter(data) {
        if (!data) return;
        Object.keys(data).forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = data[id];
        });
    }
    handleRowClick(id) {
        const item = this.dataController.data.find(d => d[this.dataController.keyField] == id);
        if (!item) return;
        if (this.onRowClick) {
            this.onRowClick(item);
            return;
        }
        if (typeof window !== 'undefined' && window.LINK_TABLE && Array.isArray(window.LINK_TABLE)) {
            const funcName = window.LINK_TABLE[0];
            const paramField = window.LINK_TABLE.length > 1 ? window.LINK_TABLE[1] : this.dataController.keyField;
            if (typeof window[funcName] === 'function') {
                const value = item[paramField];
                window[funcName](value);
            } else {
                console.warn(`TableRenderer: Função global '${funcName}' (LINK_TABLE) não encontrada.`);
            }
        }
    }
    handleActionClick(actionIndex, id) {
        const item = this.dataController.data.find(d => d[this.dataController.keyField] == id);
        if (!item) return;
        const action = this.actions[actionIndex];
        if (!action || !action.onClick) return;
        if (typeof action.onClick === 'function') {
            action.onClick(item);
            return;
        }
        if (typeof action.onClick === 'string' && typeof window[action.onClick] === 'function') {
            window[action.onClick](item[this.dataController.keyField]);
            return;
        }
        console.warn(`TableRenderer: onClick da ação '${action.title || actionIndex}' não é válido. Deve ser função ou nome de função global.`);
    }

    _handleCellSave(inputElement, feedbackElement) {
        if (!inputElement) return;
        const newVal = inputElement.value;
        const originalVal = inputElement.getAttribute('data-original-value');

        // Dispara evento para persistência (API/Backend)
        inputElement.dispatchEvent(new CustomEvent('tr-cell-edit', {
            bubbles: true,
            detail: {
                id: inputElement.dataset.id,
                field: inputElement.dataset.field,
                value: newVal,
                original: originalVal
            }
        }));

        // Feedback Visual Otimista (Optimistic UI):
        // Assume sucesso imediato trocando o ícone para verde, melhorando a percepção de performance.
        if (feedbackElement) {
            const icon = feedbackElement.querySelector('i');
            if (icon) {
                const oldClass = icon.className;
                const oldColor = icon.style.color;

                icon.className = 'fa fa-check';
                icon.style.color = '#28a745';

                if (this._feedbackTimer) clearTimeout(this._feedbackTimer);

                this._feedbackTimer = setTimeout(() => {
                    if (this._destroyed) return; // Segurança contra execução após destroy
                    icon.className = oldClass;
                    icon.style.color = oldColor || '';
                    this._feedbackTimer = null;
                }, 1000);
            }
        }
    }

    /**
     * Exibe o menu de ações flutuante.
     * Utiliza clonagem de nós e portal para `document.body` para evitar problemas de `overflow: hidden` na tabela.
     */
    toggleActionMenu(rowId) {
        if (typeof event !== 'undefined' && event) event.stopPropagation();
        const menuId = `action-menu-${this.tableId}-${rowId}`;
        const btnId = `btn-actions-${this.tableId}-${rowId}`;
        const btn = document.getElementById(btnId);
        const existingClone = document.getElementById(menuId + '-clone');
        if (existingClone) {
            this.closeActionMenu();
            return;
        }
        this.closeActionMenu();
        const originalMenu = document.getElementById(menuId);
        if (originalMenu && btn) {
            btn.style.position = 'relative';
            btn.style.zIndex = '999991';
            btn.classList.add('tr-actions-btn-active');
            document.addEventListener('wheel', this.boundScrollHandler, { passive: true });
            document.addEventListener('touchmove', this.boundScrollHandler, { passive: true });

            const clone = originalMenu.cloneNode(true);
            clone.id = menuId + '-clone';
            clone.style.display = 'block';
            clone.style.position = 'fixed';
            clone.style.zIndex = '999999';
            clone.style.visibility = 'hidden';
            clone.classList.add('show');
            clone.classList.remove('tr-dropup');

            // Attach delegate listener to the cloned menu
            clone.addEventListener('click', (e) => {
                const target = e.target.closest('[data-action="action-item"]');
                if (target) {
                    e.stopPropagation(); // Prevent bubbling to document
                    this.closeActionMenu();
                    const index = parseInt(target.getAttribute('data-index'), 10);
                    const rId = target.getAttribute('data-id');
                    this.handleActionClick(index, rId);
                }
            });

            document.body.appendChild(clone);
            RendererUtils.positionFloatingElement(btn, clone, { align: 'right', offsetY: 2 });
            if (clone.classList.contains('is-dropup')) {
                clone.classList.add('tr-dropup');
            }
            let overlay = document.getElementById(`overlay-${this.tableId}`);
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = `overlay-${this.tableId}`;
                overlay.className = 'tr-menu-overlay';
                overlay.style.zIndex = '999990';
                overlay.onclick = () => this.closeActionMenu();
                document.body.appendChild(overlay);
            }
            overlay.classList.add('show');
        }
    }
    closeActionMenu() {
        document.removeEventListener('wheel', this.boundScrollHandler);
        document.removeEventListener('touchmove', this.boundScrollHandler);
        const clones = document.querySelectorAll(`[id*="-clone"]`);
        clones.forEach(el => el.remove());
        const overlay = document.getElementById(`overlay-${this.tableId}`);
        if (overlay) overlay.classList.remove('show');
        const activeBtns = document.querySelectorAll(`.tr-actions-btn-active`);
        activeBtns.forEach(btn => btn.classList.remove('tr-actions-btn-active'));
        const allBtns = document.querySelectorAll(`.tr-actions-btn[style*="z-index"]`);
        allBtns.forEach(b => {
            b.style.zIndex = '';
            b.style.position = '';
        });
    }
    handleColumnAction(field, rowId, type, value) {
        const col = this.columns.find(c => c.field === field);
        if (!col) return;
        const item = this.dataController.data.find(d => String(d[this.dataController.keyField]) === String(rowId));
        if (!item) return;
        if (type === 'toggle') {
            item[field] = value;
            if (col.toggleLabel) {
                const labelId = `toggle-label-${this.tableId}-${rowId}-${field}`;
                const labelEl = document.getElementById(labelId);
                if (labelEl) {
                    const newText = typeof col.toggleLabel === 'function' ? col.toggleLabel(item) : col.toggleLabel;
                    labelEl.innerText = newText;
                    if (value) labelEl.classList.add('active'); else labelEl.classList.remove('active');
                }
            }
            if (col.onChange) {
                col.onChange(item, value);
            } else if (col.onToggle) {
                col.onToggle(item, value);
            }
        } else if (type === 'settings') {
            if (col.onSettingsClick) {
                col.onSettingsClick(item);
            }
        }
    }
    static getStatusBadge(status, customMap) {
        return RendererUtils.renderStatusBadge(status, customMap);
    }
    static getStyleForType(type, field) {
        if (type === 'input' || type === 'input_text' || type === 'editable') {
            return {
                align: 'center',
                sortable: true,
                formatter: (v, row, col_def) => {
                    const val = (v !== null && v !== undefined) ? v : '';
                    const requireConfirm = col_def && col_def.requireConfirm !== false;
                    const safeVal = RendererUtils.escapeHtml(val);
                    const commonInputAttrs = `
                        class="form-control input-sm tr-editable-input" 
                        value="${safeVal}" 
                        data-action="edit-input"
                        data-id="${row.CODIGO || row.id || ''}"
                        data-field="${col_def ? col_def.field : ''}"
                        data-original-value="${safeVal}"
                        placeholder="Digite algo..."`;

                    if (!requireConfirm) {
                        return `<input type="text" ${commonInputAttrs} style="width: 100%; min-width: 120px; text-align: center;">`;
                    }

                    return `<div class="tr-input-wrapper" style="display: flex; align-items: stretch; width: 100%; min-width: 160px; gap: 0; overflow: visible; margin: 0 auto;">
                           <input type="text" ${commonInputAttrs} style="flex: 1 1 auto; min-width: 120px; height: 32px; border-top-right-radius: 0; border-bottom-right-radius: 0; border-right: 0;">
                           <button class="btn btn-default btn-sm tr-input-save-btn" type="button" 
                               style="flex: 0 0 36px; height: 32px; padding: 0 10px; border-left: 0; background-color: #f9f9f9; border: 1px solid #ccc; border-radius: 0 4px 4px 0; display: inline-flex; align-items: center; justify-content: center;"
                               title="Salvar (Enter)" aria-label="Salvar (Enter)"
                               data-action="save-edit">
                               <i class="fa fa-floppy-o" style="color: #555;"></i>
                           </button>
                       </div>`;
                }
            };
        }
        return RendererUtils.getTypeConfig(type);
    }
    getPlugin(pluginName) {
        if (!this.plugins) return null;
        return this.plugins.find(p => p.constructor.name === pluginName);
    }
    runPluginHook(hookName, ...args) {
        RendererUtils.runHook(this.plugins, hookName, args, {
            debug: this.config.debug,
            id: this.containerId || this.tableId,
            name: this.constructor.name
        });
    }

    /**
     * Remove listeners e referências para evitar vazamento de memória.
     */
    destroy() {
        if (this._destroyed) return;
        this._destroyed = true;

        if (this._feedbackTimer) {
            clearTimeout(this._feedbackTimer);
            this._feedbackTimer = null;
        }

        if (this.boundScrollHandler) {
            document.removeEventListener('wheel', this.boundScrollHandler);
            document.removeEventListener('touchmove', this.boundScrollHandler);
        }

        const container = document.getElementById(this.containerId);
        if (container) {
            if (this._inputHandler) container.removeEventListener('input', this._inputHandler);
            if (this._keydownHandler) container.removeEventListener('keydown', this._keydownHandler);
            if (this._clickHandler) container.removeEventListener('click', this._clickHandler);
            if (this._cellEditHandler) container.removeEventListener('tr-cell-edit', this._cellEditHandler);
        }

        this.closeActionMenu();

        if (this.dataController) {
            this.dataController.destroy();
        }

        this._inputHandler = null;
        this._keydownHandler = null;
        this._clickHandler = null;
        this._cellEditHandler = null;
        this.dataController = null;
    }
}

/**
 * Fachada para inicialização simplificada da TableRenderer.
 * Encapsula a lógica de conversão de dados legados (arrays de arrays) para objetos.
 */
class BasicTableRenderer {
    /**
     * @param {string} containerId
     * @param {Object[]} data - Dados brutos.
     * @param {Object[]} columnsDef - Definição de colunas.
     * @param {Object} options - Configurações extras (pagination, selection, etc).
     */
    static render(containerId, data, columnsDef, options = {}) {
        if (!containerId || typeof containerId !== 'string') {
            console.error('BasicTableRenderer: containerId inválido.', containerId);
            return null;
        }
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`BasicTableRenderer: Container '#${containerId}' não encontrado no DOM.`);
            return null;
        }
        if (!columnsDef || columnsDef.length === 0) {
            if (container.dataset.colunas) {
                try {
                    columnsDef = JSON.parse(container.dataset.colunas);
                } catch (e) {
                    console.error('BasicTableRenderer: Erro ao ler data-colunas.', e);
                }
            } else if (window.COLUNAS_GRID) {
                columnsDef = window.COLUNAS_GRID;
            }
        }
        if (!Array.isArray(columnsDef) || columnsDef.length === 0) {
            container.innerHTML = '<div class="alert alert-warning">Erro: Configuração de colunas ausente.</div>';
            console.error('BasicTableRenderer: columnsDef deve ser um array não vazio.');
            return null;
        }
        const safeData = Array.isArray(data) ? data : [];
        try {
            const cleanColumns = columnsDef.map(col => {
                if (Array.isArray(col)) {
                    if (col.length < 1) return { field: 'erro', title: 'Erro Config' };
                    const [field, title, type] = col;
                    return BasicTableRenderer._buildCol({ field, title, type });
                }
                if (typeof col === 'object' && col !== null) {
                    return BasicTableRenderer._buildCol(col);
                }
                return { field: 'erro', title: 'Config Inválida' };
            });
            const config = {
                ...options,
                containerId: containerId,
                keyField: options.keyField || 'CODIGO',
                pageSize: options.pageSize,
                selection: options.selection,
                searchFields: options.searchFields,
                columns: cleanColumns,
                onRowClick: options.onRowClick || BasicTableRenderer._resolveRowClick(options),
                actions: options.actions || []
            };
            if (options.footer && options.footer.items && options.footer.items.length > 0) {
                const normalizeItems = (items) => {
                    if (!Array.isArray(items)) return [];
                    return items.map(item => {
                        if (Array.isArray(item)) {
                            return { id: item[0], label: item[1], value: item[2], color: item[3] || null };
                        }
                        return item;
                    });
                };
                config.footer = {
                    title: options.footer.title || 'Total',
                    items: normalizeItems(options.footer.items)
                };
            }
            const renderer = new TableRenderer(config);
            if (Array.isArray(data)) {
                renderer.setData(safeData);
            }
            else if (typeof options.initialLoad === 'function') {
                options.initialLoad();
            }
            if (!window.TableInstances) window.TableInstances = {};
            window.TableInstances[containerId] = renderer;
            return renderer;
        } catch (error) {
            console.error('BasicTableRenderer: Erro fatal ao renderizar tabela.', error);
            container.innerHTML = `<div class="alert alert-danger">Erro ao renderizar tabela: ${error.message}</div>`;
            return null;
        }
    }
    static _resolveRowClick(options) {
        const linkConfig = options.rowLink;
        if (Array.isArray(linkConfig) && linkConfig.length > 0) {
            return (item) => {
                const funcName = linkConfig[0];
                const paramField = linkConfig.length > 1 ? linkConfig[1] : (options.keyField || 'CODIGO');
                if (typeof window[funcName] === 'function') {
                    const value = item[paramField];
                    window[funcName](value);
                } else {
                    console.warn(`BasicTableRenderer: Função '${funcName}' definida em rowLink não encontrada.`);
                }
            };
        }
        return null;
    }
    static _buildCol(def) {
        const title = def.title !== undefined ? def.title : def.field;
        const col = {
            ...def,
            field: def.field,
            title: title,
            align: def.align || 'left',
            width: def.width || 'auto',
            defaultHidden: def.defaultHidden || false
        };
        if (!def.type && def.field) {
            const f = def.field.toUpperCase();
            if (f.includes('VALOR') || f.includes('SALDO') || f.includes('LIMITE') || f.includes('PRECO') || f.includes('TOTAL')) {
                def.type = 'currency';
            }
            else if (f.includes('DATA') || f.startsWith('DT_') || f.includes('NASCIMENTO') || f.includes('VENCIMENTO')) {
                def.type = 'date';
            }
        }
        if (def.type) {
            const style = TableRenderer.getStyleForType(def.type, def.field);
            if (style.align && !def.align) col.align = style.align;
            if (style.formatter && !def.formatter) col.formatter = style.formatter;
            if (style.sortable !== undefined && def.sortable === undefined) col.sortable = style.sortable;
        }
        return col;
    }
}