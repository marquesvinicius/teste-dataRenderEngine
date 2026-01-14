/**
 * Plugin de busca global integrado ao DataController.
 * Injeta input na toolbar e gerencia o binding de eventos de filtragem em tempo real.
 */
window.SearchPlugin = class SearchPlugin {
    constructor() {
        this.hostInstance = null;
        this.id = 'search';
    }

    /**
     * Inicializa o contexto e define a estratégia de campos de busca.
     * * Regra de Fallback:
     * Se `dataController.searchFields` não for fornecido na config,
     * o plugin assume automaticamente TODAS as colunas disponíveis como alvos da busca.
     *
     * @param {Object} instance - Instância principal do renderizador.
     */
    init(instance) {
        this.hostInstance = instance;
        if (!instance.dataController) {
            console.error("SearchPlugin: DataController não encontrado na instância.");
            return;
        }
        if (!instance.dataController.searchFields || instance.dataController.searchFields.length === 0) {
            if (instance.columns) {
                instance.dataController.searchFields = instance.columns.map(c => c.field);
            }
        }
    }

    /**
     * Renderiza o input de busca no início da toolbar ('afterbegin').
     * Vincula evento `oninput` direto ao DataController e restaura estado anterior se houver.
     *
     * @param {HTMLElement} toolbarContainer
     */
    mountToolbar(toolbarContainer) {
        const uniqueId = this.hostInstance.tableId || this.hostInstance.containerId;
        const globalRef = `window.TableInstances['${this.hostInstance.containerId}']`;
        const searchHtml = `
            <div class="tr-search-wrapper" style="display: flex; align-items: center; position: relative; max-width: 300px;">
                <i class="fa fa-search tr-search-icon" style="position: absolute; left: 10px; color: #aaa; z-index: 2;"></i>
                <input type="text" class="form-control input-sm tr-search-input" 
                       id="search-input-${uniqueId}"
                       placeholder="Pesquisar..." 
                       title="Filtrar dados desta tabela"
                       autocomplete="off"
                       oninput="${globalRef}.dataController.setSearchTerm(this.value)"
                       style="padding-left: 30px !important; width: 100%;">
            </div>
        `;
        
        if (this.hostInstance && typeof this.hostInstance.addToolbarControl === 'function') {
            this.hostInstance.addToolbarControl(searchHtml, 'afterbegin');
        } else if (toolbarContainer) {
            toolbarContainer.insertAdjacentHTML('afterbegin', searchHtml);
        }

        const currentTerm = this.hostInstance.dataController.searchTerm;
        if (currentTerm) {
            const input = document.getElementById(`search-input-${uniqueId}`);
            if (input) input.value = currentTerm;
        }
        this.adjustSearchPadding();
    }

    onWindowResize() {
        this.adjustSearchPadding();
    }

    adjustSearchPadding() {
        const container = document.getElementById(this.hostInstance.containerId);
        if (!container) return;
        const icon = container.querySelector('.tr-search-icon');
        const input = container.querySelector('.tr-search-input');
        if (icon && input) {
            requestAnimationFrame(() => {
                const width = icon.offsetWidth || 14;
                input.style.setProperty('padding-left', `${width + 18}px`, 'important');
            });
        }
    }
}