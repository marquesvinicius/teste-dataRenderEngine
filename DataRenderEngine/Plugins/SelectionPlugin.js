/**
 * Plugin de Seleção para TableRenderer e NestedAccordionRenderer.
 * Centraliza a lógica de renderização de checkboxes e manipulação de estado de seleção.
 */
class SelectionPlugin {
    /**
     * @param {Object} config
     * @param {boolean} [config.enabled=true]
     */
    constructor(config = {}) {
        this.id = 'SelectionPlugin';
        this.enabled = config.enabled !== false;
        this.renderer = null;
        this.dataController = null;
    }

    /**
     * Inicializa o plugin ligando-o ao renderer.
     * @param {Object} renderer - Instância do TableRenderer ou NestedAccordionRenderer.
     */
    init(renderer) {
        this.renderer = renderer;
        this.dataController = renderer.dataController;
    }

    /**
     * Renderiza checkbox de cabeçalho (Select All).
     * @returns {string} HTML do checkbox.
     */
    renderHeaderCheckbox() {
        if (!this.enabled) return '';
        const isAllSelected = this.dataController ? this.dataController.isAllSelected() : false;
        const containerId = this.renderer.tableId || this.renderer.containerId;
        return RendererUtils.renderCheckboxHtml('all', isAllSelected, containerId, true);
    }

    /**
     * Renderiza checkbox de linha.
     * @param {string|number} id - ID da linha.
     * @param {boolean} isChecked - Se está selecionado.
     * @returns {string} HTML do checkbox.
     */
    renderRowCheckbox(id, isChecked) {
        if (!this.enabled) return '';
        const containerId = this.renderer.tableId || this.renderer.containerId;
        return RendererUtils.renderCheckboxHtml(id, isChecked, containerId, false);
    }

    /**
     * Renderiza checkbox de grupo (Accordion).
     * @param {string} uniqueId - ID único do grupo.
     * @param {boolean} isSelected - Se o grupo está selecionado.
     * @param {Object} options - Opções extras como scale e customClass.
     * @returns {string} HTML do checkbox envolvido em container.
     */
    renderGroupCheckbox(uniqueId, isSelected, options = {}) {
        if (!this.enabled) return '';

        const scale = options.scale || 1;
        const customClass = options.customClass || 'nar-checkbox-custom';
        const containerId = this.renderer.containerId;

        const baseCb = RendererUtils.renderCheckboxHtml(uniqueId, isSelected, containerId, false, {
            scale: scale,
            customClass: customClass
        });

        // Nota: O método toggleGroupSelection deve ser exposto pelo Renderer para manter o contexto correto no HTML inline
        return `
            <div class="nar-checkbox-container" 
                 onclick="event.stopPropagation(); window.NestedAccordionInstances['${containerId}'].toggleGroupSelection('${uniqueId}');" 
                 style="display: flex; align-items: center; justify-content: center;">
                ${baseCb}
            </div>`;
    }

    /**
     * Lógica de manipulação para "Select All".
     * @param {boolean} checked - Novo estado.
     */
    handleSelectAll(checked) {
        if (this.dataController) {
            this.dataController.toggleSelectAll(checked);
        }
    }

    /**
     * Lógica de manipulação para seleção de linha individual.
     * @param {string|number} id - ID do item.
     */
    handleSelectRow(id) {
        if (this.dataController) {
            this.dataController.toggleSelection(id);
        }
    }

    /**
     * Lógica de toggle de grupo (Accordion).
     * Seleciona ou deseleciona todos os itens que pertencem ao grupo.
     * @param {string} uniqueId - ID do grupo.
     * @param {Map} groupItemsMap - Mapa que contém os itens do grupo.
     */
    toggleGroupSelection(uniqueId, groupItemsMap) {
        if (!this.dataController) return;

        const items = groupItemsMap.get(uniqueId);
        if (!items || items.length === 0) return;

        const allSelected = items.every(item =>
            this.dataController.selectedIds.has(String(item[this.dataController.keyField]))
        );

        items.forEach(item => {
            const id = String(item[this.dataController.keyField]);
            if (allSelected) {
                this.dataController.selectedIds.delete(id);
            } else {
                this.dataController.selectedIds.add(id);
            }
        });

        // Use updateSelectionVisuals instead of notifyChange to avoid full re-render
        // This preserves table state while updating checkbox visuals
        if (this.renderer && typeof this.renderer.updateSelectionVisuals === 'function') {
            this.renderer.updateSelectionVisuals();
        } else {
            this.dataController.notifyChange();
        }
    }

    /**
     * Atualiza o estado visual dos checkboxes (apenas para TableRenderer).
     * O AccordionRenderer re-renderiza a estrutura completa no onDataChange.
     */
    updateVisuals() {
        if (!this.enabled || !this.renderer) return;

        // Se não for TableRenderer, geralmente não precisa de update visual manual do DOM
        // pois o framework (accordion) faz re-render.
        // Verificamos se é TableRenderer pela presença de tableId e estrutura de tabela.
        if (this.renderer.constructor.name !== 'TableRenderer') return;

        const tableId = this.renderer.tableId;
        if (!this.dataController) return;

        const isAllSelected = this.dataController.isAllSelected();
        const cbAll = document.getElementById(`cb-all-${tableId}`);
        if (cbAll) cbAll.checked = isAllSelected;

        const table = document.getElementById(tableId);
        if (!table) return;
        const tbody = table.querySelector('tbody');
        if (!tbody) return;

        const rows = tbody.querySelectorAll('tr');
        rows.forEach(tr => {
            const idString = tr.getAttribute('data-id');
            if (!idString) return;

            // Verifica seleção (suporta ID numérico ou string)
            let isSelected = this.dataController.selectedIds.has(idString);
            if (!isSelected && !isNaN(idString)) {
                isSelected = this.dataController.selectedIds.has(Number(idString));
            }

            const cb = tr.querySelector(`input[type="checkbox"]`);
            if (cb) cb.checked = isSelected;

            if (isSelected) {
                tr.classList.add('selected-row');
            } else {
                tr.classList.remove('selected-row');
            }
        });
    }
}

window.SelectionPlugin = SelectionPlugin;
