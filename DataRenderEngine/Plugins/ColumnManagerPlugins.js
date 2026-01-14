window.ColumnManagerPlugin = class ColumnManagerPlugin {
    constructor(options = {}) {
        this.hostInstance = null;
        this.persistenceKey = options.persistenceKey || null;
        this.id = 'column-manager';
        // Necessário para o listener de resize/scroll não perder a referência
        this.reposition = this.reposition.bind(this);
    }

    init(instance) {
        this.hostInstance = instance;
        if (!this.hostInstance.hiddenColumns) {
            this.hostInstance.hiddenColumns = new Set();
        }
        if (instance.config && instance.config.persistenceKey) {
            this.persistenceKey = instance.config.persistenceKey;
        }
        this.loadColumnSettings();
    }

    mountToolbar(toolbarContainer) {
        const uniqueId = this.hostInstance.tableId || this.hostInstance.containerId;
        this.injectStyles();

        const wrapper = document.createElement('div');
        wrapper.className = 'tre-col-manager-wrapper';
        // Removemos o position: relative daqui pois o dropdown será movido para o body

        const btn = document.createElement('button');
        btn.id = `col-btn-${uniqueId}`;
        btn.className = 'tre-btn-col-manager';
        btn.type = 'button';
        btn.title = 'Gerenciar Colunas';
        btn.innerHTML = '<i class="fa fa-columns"></i>';
        btn.addEventListener('click', (e) => {
            this.toggleDropdown(e);
        });
        wrapper.appendChild(btn);

        const dropdown = document.createElement('div');
        dropdown.id = `col-dropdown-${uniqueId}`;
        dropdown.className = 'tr-col-dropdown tre-dropdown-menu';
        dropdown.style.display = 'none';

        // Estilos críticos para o funcionamento "Portal"
        dropdown.style.position = 'absolute';
        dropdown.style.zIndex = '99999'; // Altíssimo para ficar sobre tudo
        dropdown.style.padding = '10px';
        dropdown.style.minWidth = '250px';
        dropdown.style.maxHeight = '400px';
        dropdown.style.overflowY = 'auto';
        dropdown.style.textAlign = 'left';

        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.id = `col-search-${uniqueId}`;
        searchInput.className = 'form-control input-sm';
        searchInput.placeholder = 'Filtrar colunas...';
        searchInput.style.marginBottom = '10px';
        searchInput.style.width = '100%';
        searchInput.addEventListener('click', (e) => e.stopPropagation());
        searchInput.addEventListener('keyup', (e) => {
            this.filterColumnList(e.target.value, uniqueId);
        });
        dropdown.appendChild(searchInput);

        const listContainer = document.createElement('div');
        listContainer.id = `col-list-${uniqueId}`;
        listContainer.className = 'tr-col-list';
        dropdown.appendChild(listContainer);

        const footerDiv = document.createElement('div');
        footerDiv.style.marginTop = '10px';
        footerDiv.style.textAlign = 'right';
        footerDiv.style.borderTop = '1px solid #eee';
        footerDiv.style.paddingTop = '5px';

        const resetBtn = document.createElement('button');
        resetBtn.id = `reset-btn-${uniqueId}`;
        resetBtn.className = 'btn btn-xs btn-link';
        resetBtn.type = 'button';
        resetBtn.textContent = 'Restaurar padrão';
        resetBtn.addEventListener('click', () => {
            this.resetSettings();
        });
        this.setupResetButtonStyles(resetBtn);
        footerDiv.appendChild(resetBtn);
        dropdown.appendChild(footerDiv);

        // Inicialmente anexa ao wrapper, mas o toggleDropdown vai mover para o body
        wrapper.appendChild(dropdown);

        if (this.hostInstance && typeof this.hostInstance.addToolbarControl === 'function') {
            this.hostInstance.addToolbarControl(wrapper, 'beforeend');
        } else if (toolbarContainer) {
            toolbarContainer.appendChild(wrapper);
        }

        // Listener para fechar o menu ao scrollar a página (evita que o menu flutue sozinho)
        document.addEventListener('scroll', (e) => {
            // Ignora scroll dentro do próprio dropdown
            if (e.target.id === `col-dropdown-${uniqueId}` || (dropdown.contains && dropdown.contains(e.target))) return;

            if (dropdown.style.display === 'block') {
                dropdown.style.display = 'none';
            }
        }, { capture: true, passive: true });

        // Listener para reposicionar se a janela for redimensionada
        window.addEventListener('resize', () => {
            if (dropdown.style.display === 'block') {
                const btnRef = document.getElementById(`col-btn-${uniqueId}`);
                if (btnRef) this.reposition(btnRef, dropdown);
            }
        });
    }

    toggleDropdown(event) {
        if (event) event.stopPropagation();

        if (!this.hostInstance) return;
        const uniqueId = this.hostInstance.tableId || this.hostInstance.containerId;
        const dropdown = document.getElementById(`col-dropdown-${uniqueId}`);
        const btn = document.getElementById(`col-btn-${uniqueId}`);

        if (!dropdown || !btn) return;

        // Fecha outros dropdowns da mesma classe
        document.querySelectorAll('.tr-col-dropdown').forEach(d => {
            if (d.id !== dropdown.id) d.style.display = 'none';
        });

        if (dropdown.style.display === 'block') {
            dropdown.style.display = 'none';
        } else {
            // --- PORTAL MAGIC ---
            // Move o elemento para o body. Isso remove qualquer restrição de overflow dos pais.
            document.body.appendChild(dropdown);

            this.renderColumnSelector(uniqueId);

            // Exibe primeiro para o navegador calcular a largura/altura correta
            dropdown.style.display = 'block';

            // Calcula e aplica a posição exata na tela
            this.reposition(btn, dropdown);

            // Reseta input e foca
            const searchInput = document.getElementById(`col-search-${uniqueId}`);
            if (searchInput) {
                searchInput.value = '';
                this.filterColumnList('', uniqueId);
                setTimeout(() => searchInput.focus(), 50);
            }
        }
    }

    reposition(btn, dropdown) {
        const rect = btn.getBoundingClientRect();
        // Scroll da página para compensar posição absoluta no body
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

        // Topo: logo abaixo do botão (+2px de margem)
        dropdown.style.top = (rect.bottom + scrollTop + 2) + 'px';

        // Esquerda: Alinha a direita do dropdown com a direita do botão
        const ddWidth = dropdown.offsetWidth || 250;
        let leftPos = (rect.right + scrollLeft - ddWidth);

        // Se sair da tela pela esquerda, inverte e alinha à esquerda do botão
        if (leftPos < 0) leftPos = rect.left + scrollLeft;

        dropdown.style.left = leftPos + 'px';
    }

    setupResetButtonStyles(resetBtn) {
        if (window.RendererUtils) {
            const themeColor = window.RendererUtils.getThemeColor() || '#007bff';
            resetBtn.style.color = themeColor;
            resetBtn.style.setProperty('color', themeColor, 'important');

            resetBtn.addEventListener('mouseenter', () => {
                resetBtn.style.opacity = '0.8';
                resetBtn.style.textDecoration = 'underline';
            });
            resetBtn.addEventListener('mouseleave', () => {
                resetBtn.style.opacity = '1';
                resetBtn.style.textDecoration = 'none';
            });
        }
    }

    renderColumnSelector(uniqueId) {
        const listContainer = document.getElementById(`col-list-${uniqueId}`);
        if (!listContainer) return;
        listContainer.innerHTML = '';
        const columns = this.hostInstance.columns || [];
        const criticalColumns = (this.hostInstance.config && this.hostInstance.config.criticalColumns) || [];

        if (columns.length === 0) {
            listContainer.innerHTML = '<div style="padding:5px; color:#999;">Nenhuma coluna configurável.</div>';
            return;
        }

        columns.forEach(col => {
            if (col.field === 'erro') return;
            const isVisible = !this.hostInstance.hiddenColumns.has(col.field);
            const isCritical = criticalColumns.includes(col.field);
            const isDisabled = col.allowToggle === false || isCritical;

            const label = document.createElement('label');
            label.className = isDisabled ? 'tr-col-item disabled' : 'tr-col-item';
            label.style.display = 'block';
            label.style.marginBottom = '5px';
            label.style.cursor = 'pointer';
            label.style.fontWeight = 'normal';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = isVisible;
            if (isDisabled) checkbox.disabled = true;
            checkbox.addEventListener('click', (e) => {
                this.toggleColumn(col.field, e.target);
            });

            const span = document.createElement('span');
            span.style.marginLeft = '5px';
            span.textContent = col.title;

            label.appendChild(checkbox);
            label.appendChild(span);
            listContainer.appendChild(label);
        });
    }

    toggleColumn(field, checkboxEl) {
        const criticalColumns = (this.hostInstance.config && this.hostInstance.config.criticalColumns) || [];
        if (criticalColumns.includes(field)) {
            // Se for crítica, reverte o checkbox visualmente e sai
            if (checkboxEl) checkboxEl.checked = !checkboxEl.checked;
            return;
        }

        const colDef = this.hostInstance.columns.find(c => c.field === field);
        if (colDef && colDef.allowToggle === false) return;

        if (!this.hostInstance.hiddenColumns.has(field)) {
            const visibleDataCols = this.hostInstance.columns.filter(c =>
                !this.hostInstance.hiddenColumns.has(c.field) &&
                c.field !== 'actions' &&
                c.type !== 'actions'
            );
            if (visibleDataCols.length <= 1) {
                if (checkboxEl) checkboxEl.checked = true;
                if (typeof toastr !== 'undefined') {
                    toastr.warning("É necessário ter no mínimo 1 coluna de dados ativa", '', { "closeButton": true });
                }
                return;
            }
        }

        if (this.hostInstance.hiddenColumns.has(field)) {
            this.hostInstance.hiddenColumns.delete(field);
        } else {
            this.hostInstance.hiddenColumns.add(field);
        }

        this.saveColumnSettings();
        if (this.hostInstance.dataController) {
            this.hostInstance.dataController.applyFilters();
        }
    }

    filterColumnList(term, uniqueIdOverride) {
        const uniqueId = uniqueIdOverride || (this.hostInstance.tableId || this.hostInstance.containerId);
        const listContainer = document.getElementById(`col-list-${uniqueId}`);
        if (!listContainer) return;
        const labels = listContainer.querySelectorAll('label');
        const search = term.toLowerCase();
        labels.forEach(lbl => {
            const text = lbl.innerText.toLowerCase();
            lbl.style.display = text.includes(search) ? 'block' : 'none';
        });
    }

    injectStyles() {
        // Estilos simplificados pois agora o posicionamento é via JS no body
        const styleContent = `
            .tre-btn-col-manager {
                border-radius: 4px; 
                height: 34px; 
                padding: 0 12px; 
                border: 1px solid #ccc; 
                background-color: #fff; 
                color: #555; 
                cursor: pointer; 
                display: inline-flex; 
                align-items: center; 
                justify-content: center;
                transition: all 0.2s ease;
            }
            .tre-btn-col-manager:hover {
                background-color: #e6e6e6; 
                border-color: #adadad;
                color: #333;
            }
            .tre-dropdown-menu {
                background: #fff; 
                border: 1px solid #ccc; 
                box-shadow: 0 5px 25px rgba(0,0,0,0.3); 
                border-radius: 4px;
                font-family: inherit;
                font-size: 14px;
                /* Reset de fontes caso o body tenha algo diferente */
                line-height: 1.4;
                color: #333;
            }
            .tr-col-item.disabled {
                opacity: 0.6;
                cursor: not-allowed;
            }
        `;
        if (window.DataRenderEngine && window.DataRenderEngine.CommonStyles) {
            window.DataRenderEngine.CommonStyles.injectStyles('tre-col-manager-styles', styleContent);
        } else {
            if (document.getElementById('tre-col-manager-styles')) return;
            const style = document.createElement('style');
            style.id = 'tre-col-manager-styles';
            style.textContent = styleContent;
            document.head.appendChild(style);
        }
    }

    loadColumnSettings() {
        const defaults = new Set();
        if (this.hostInstance.columns) {
            this.hostInstance.columns.forEach(col => {
                if (col.defaultHidden) defaults.add(col.field);
            });
        }
        
        const criticalColumns = (this.hostInstance.config && this.hostInstance.config.criticalColumns) || [];

        if (!this.persistenceKey) {
            this.hostInstance.hiddenColumns = defaults;
        } else {
            try {
                const saved = localStorage.getItem(`tr-cols-${this.persistenceKey}`);
                if (saved) {
                    const parsed = JSON.parse(saved);
                    this.hostInstance.hiddenColumns = new Set(parsed);
                } else {
                    this.hostInstance.hiddenColumns = defaults;
                }
            } catch (e) {
                console.error('ColumnManager: Erro ao carregar colunas:', e);
                this.hostInstance.hiddenColumns = defaults;
            }
        }
        
        // Garante que colunas críticas nunca fiquem ocultas
        if (criticalColumns.length > 0) {
            criticalColumns.forEach(field => {
                if (this.hostInstance.hiddenColumns.has(field)) {
                    this.hostInstance.hiddenColumns.delete(field);
                }
            });
        }
    }

    saveColumnSettings() {
        if (!this.persistenceKey) return;
        try {
            localStorage.setItem(`tr-cols-${this.persistenceKey}`, JSON.stringify([...this.hostInstance.hiddenColumns]));
        } catch (e) {
            console.error('ColumnManager: Erro ao salvar colunas:', e);
        }
    }

    resetSettings() {
        if (this.persistenceKey) {
            localStorage.removeItem(`tr-cols-${this.persistenceKey}`);
        }
        this.hostInstance.hiddenColumns.clear();
        
        const criticalColumns = (this.hostInstance.config && this.hostInstance.config.criticalColumns) || [];

        this.hostInstance.columns.forEach(col => {
            if (col.defaultHidden && !criticalColumns.includes(col.field)) {
                this.hostInstance.hiddenColumns.add(col.field);
            }
        });
        this.saveColumnSettings();
        if (this.hostInstance.dataController) {
            this.hostInstance.dataController.applyFilters();
        }
        const uniqueId = this.hostInstance.tableId || this.hostInstance.containerId;
        this.renderColumnSelector(uniqueId);
    }
};