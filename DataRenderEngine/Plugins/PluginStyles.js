/**
 * Repositório central de estilos (CSS-in-JS) compartilhados entre plugins.
 * Garante a renderização visual consistente de componentes auxiliares (Busca, Gerenciador de Colunas)
 * sem dependência de folhas de estilo externas.
 */
class PluginStyles {
    /**
     * Retorna definições CSS para componentes de UI injetados dinamicamente.
     * Cobre estilos para:
     * - Wrapper e inputs de busca (.tre-search-*)
     * - Dropdowns e botões de gerenciamento (.tre-col-manager-*)
     *
     * @returns {string} Regras CSS prontas para injeção em tag `<style>`.
     */
    static getStyles() {
        return `
            .tre-search-wrapper {
                display: flex;
                align-items: center;
                position: relative;
                max-width: 300px;
            }
            .tre-search-icon {
                position: absolute; 
                left: 10px; 
                color: #aaa; 
                z-index: 2;
            }
            .tre-search-input {
                border-radius: 4px !important;
                border: 1px solid #ccc !important;
                box-shadow: inset 0 1px 1px rgba(0,0,0,.075);
                transition: border-color ease-in-out .15s, box-shadow ease-in-out .15s;
                height: 34px !important;
                padding-left: 32px !important;
                width: 100%;
            }
            .tre-search-input:focus {
                border-color: #66afe9 !important;
                outline: 0;
                box-shadow: inset 0 1px 1px rgba(0,0,0,.075), 0 0 8px rgba(102, 175, 233, .6);
            }
            .tre-col-manager-wrapper {
                position: relative;
            }
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
                box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
                border-radius: 4px;
                padding: 10px;
                min-width: 250px;
                max-height: 400px;
                overflow-y: auto;
                text-align: left;
            }
        `;
    }
}
window.PluginStyles = PluginStyles;
