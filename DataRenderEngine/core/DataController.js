/**
 * Gerenciador de estado agnóstico a DOM (Store).
 * Centraliza a lógica de manipulação de dados tabular, desacoplando-a da renderização.
 * * Responsabilidades:
 * - Filtragem (Busca global ou por campos específicos)
 * - Ordenação (com tratamento legado para moeda BRL)
 * - Controle de Paginação e Seleção (Checkbox)
 */
class DataController {
    /**
     * @param {Object} config
     * @param {string} [config.keyField='CODIGO'] - Identificador único para persistência de seleção.
     * @param {string[]} [config.searchFields] - Lista de campos considerados na busca.
     * @param {Function} [config.isFieldVisible] - Predicado para ignorar colunas ocultas na busca.
     * @param {Function} config.onDataChange - Hook crítico: recebe snapshot { pageData, stats, total }.
     * @param {boolean} [config.debug=false] - Ativa logs detalhados de manipulação de dados.
     */
    constructor(config) {
        this.data = [];
        this.filteredData = [];
        this.selectedIds = config.externalSelectedIds || new Set();
        this.isFieldVisible = config.isFieldVisible;
        this.keyField = config.keyField || 'CODIGO';
        this.searchFields = config.searchFields || [];
        this.debug = config.debug || false;
        this.pagination = {
            enabled: config.pagination !== false,
            pageSize: config.pageSize || 10,
            currentPage: 1
        };
        this.sortConfig = { field: null, direction: null };
        this.onDataChange = config.onDataChange;
        this.onSelectionChange = config.onSelectionChange;
        this._destroyed = false;
    }

    _log(action, meta) {
        if (this.debug && window.RendererUtils) {
            window.RendererUtils.logDebug(`DataController: ${action}`, meta, 'info');
        }
    }

    /**
     * Substitui o dataset completo e reaplica filtros/ordenação.
     * @param {Array<Object>} data - Dados brutos (raw).
     */
    setData(data) {
        if (data && !Array.isArray(data)) {
            console.warn('[DataController] setData recebeu um objeto não iterável. Esperado Array. Usando [].', data);
            this.data = [];
        } else {
            this.data = data || [];
        }

        this._log('setData', { count: this.data.length });
        this.applyFilters();
    }


    /**
     * Aplica o termo de busca aos dados.
     * Reseta a paginação para a página 1.
     * 
     * @param {string} term - Texto a ser pesquisado.
     */
    setSearchTerm(term) {
        if (this.searchTerm !== term) {
            this._log('setSearchTerm', { term });
            this.searchTerm = term;
            this.pagination.currentPage = 1;
            this.applyFilters();
        }
    }

    /**
     * Define o critério de ordenação e reaplica filtros.
     * 
     * @param {string} field - Nome do campo a ser ordenado.
     * @param {string} direction - 'asc' ou 'desc'.
     * @param {Function} [customCompare] - Função de comparação customizada (a, b) => number. 
     *                                     Se fornecida, substitui a lógica padrão de comparação.
     */
    setSort(field, direction, customCompare) {
        this._log('setSort', { field, direction });
        this.sortConfig = { field, direction, customCompare };
        this.applyFilters();
    }

    /**
     * Núcleo de processamento de dados.
     * * Regras Não Óbvias:
     * 1. Respeita `isFieldVisible` para não buscar em colunas ocultas pelo usuário.
     * 2. Ordenação possui "Heurística de moeda BR": strings detectadas como moeda (R$) ou 
     * formatadas (ex: 1.000,00) são convertidas para Float automaticamente antes da comparação.
     */
    applyFilters() {
        const tStart = performance.now();
        let result = [];
        if (!this.searchTerm) {
            result = [...this.data];
        } else {
            const term = this.searchTerm.toLowerCase();
            result = this.data.filter(item => {
                if (this.searchFields.length > 0) {
                    return this.searchFields.some(field => {
                        if (this.isFieldVisible) {
                            const isVisible = this.isFieldVisible(field);
                            if (!isVisible) {
                                return false;
                            }
                        }
                        const val = item[field];
                        const match = val && String(val).toLowerCase().includes(term);
                        return match;
                    });
                }
                return Object.keys(item).some(key => {
                    if (this.isFieldVisible && !this.isFieldVisible(key)) return false;
                    const val = item[key];
                    return val && String(val).toLowerCase().includes(term);
                });
            });
        }
        if (this.sortConfig.field && this.sortConfig.direction) {
            const { field, direction } = this.sortConfig;
            result.sort((a, b) => {
                let valA = a[field];
                let valB = b[field];
                if (valA == null) valA = '';
                if (valB == null) valB = '';
                const parseMoney = (val) => {
                    if (typeof val === 'number') return val;
                    if (typeof val !== 'string') return NaN;
                    if (val.indexOf('-') > 0) return NaN;
                    const clean = val.replace(/[R$\s.]/g, '').replace(',', '.');
                    return parseFloat(clean);
                };
                const numA = parseMoney(valA);
                const numB = parseMoney(valB);
                if (!isNaN(numA) && !isNaN(numB) && valA !== '' && valB !== '') {
                    valA = numA;
                    valB = numB;
                } else {
                    valA = String(valA).toLowerCase();
                    valB = String(valB).toLowerCase();
                }
                if (valA < valB) return direction === 'asc' ? -1 : 1;
                if (valA > valB) return direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        this.filteredData = result;

        if (this.debug && window.RendererUtils) {
            const tEnd = performance.now();
            window.RendererUtils.logDebug(`DataController: Filtered ${(tEnd - tStart).toFixed(2)}ms`, {
                input: this.data.length,
                output: result.length,
                filters: { term: this.searchTerm, sort: this.sortConfig }
            }, 'perf');
        }

        this.notifyChange();
    }

    getCurrentPageData() {
        if (!this.pagination.enabled) return this.filteredData;
        const start = (this.pagination.currentPage - 1) * this.pagination.pageSize;
        const end = start + this.pagination.pageSize;
        return this.filteredData.slice(start, end);
    }

    goToPage(page) {
        const totalPages = this.getTotalPages();
        if (page < 1 || page > totalPages) return;
        this.pagination.currentPage = page;
        this.notifyChange();
    }

    setPageSize(size) {
        this.pagination.pageSize = parseInt(size);
        this.pagination.currentPage = 1;
        this.notifyChange();
    }

    getTotalPages() {
        return Math.ceil(this.filteredData.length / this.pagination.pageSize) || 1;
    }

    /**
     * Gerencia estado de seleção baseado em `this.keyField`.
     * Dispara `onSelectionChange` com os objetos completos das linhas selecionadas.
     */
    toggleSelection(id) {
        const idStr = String(id);
        if (this.selectedIds.has(idStr)) {
            this.selectedIds.delete(idStr);
        } else {
            this.selectedIds.add(idStr);
        }
        if (this.onSelectionChange) this.onSelectionChange(this.getSelectedItems());
    }

    toggleSelectAll(shouldSelect) {
        const allIds = this.filteredData.map(i => String(i[this.keyField]));
        if (shouldSelect) {
            allIds.forEach(id => this.selectedIds.add(id));
        } else {
            allIds.forEach(id => this.selectedIds.delete(id));
        }
        if (this.onSelectionChange) this.onSelectionChange(this.getSelectedItems());
        this.notifyChange();
    }

    isAllSelected() {
        if (this.filteredData.length === 0) return false;
        return this.filteredData.every(item => this.selectedIds.has(String(item[this.keyField])));
    }

    getSelectedItems() {
        return this.data.filter(item => this.selectedIds.has(String(item[this.keyField])));
    }

    getDataSnapshot() {
        return {
            pageData: this.getCurrentPageData(),
            pagination: this.pagination,
            total: this.filteredData.length,
            totalPages: this.getTotalPages(),
            stats: {
                start: ((this.pagination.currentPage - 1) * this.pagination.pageSize) + 1,
                end: Math.min(this.pagination.currentPage * this.pagination.pageSize, this.filteredData.length)
            }
        };
    }

    /**
     * Dispara evento para re-renderização externa.
     * Retorna estrutura pronta para consumo do renderizador (stats de paginação já calculados).
     */
    notifyChange() {
        if (this.onDataChange) {
            this.onDataChange(this.getDataSnapshot());
        }
    }

    /**
     * Limpa referências para permitir garbage collection.
     * Deve ser chamado quando o componente visual for destruído.
     */
    destroy() {
        if (this._destroyed) return;
        this._destroyed = true;

        this.data = [];
        this.filteredData = [];
        this.selectedIds = new Set();
        this.onDataChange = null;
        this.onSelectionChange = null;
        this.isFieldVisible = null;
        this.sortConfig = null;
    }
}