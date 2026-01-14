/**
 * Gerenciador central de estilos compartilhados (CSS-in-JS).
 * Implementa cache em memória e injeta CSS globalmente para garantir
 * consistência visual entre tabelas, accordions e plugins.
 */
class CommonStyles {
    static _styleCache = new Map();

    static _getCacheKey(config) {
        const accentColor = config.accentColor || '#0056b3';
        return `common-${accentColor}`;
    }

    /**
     * Ponto de entrada para injeção de estilos no DOM.
     * Verifica duplicidade pelo ID para garantir idempotência.
     *
     * @param {Object} config - Configurações de tema (accentColor, applyOpacity).
     * @returns {boolean} True se os estilos foram injetados, False se já existiam.
     */
    static initCommonStyles(config = {}) {
        return CommonStyles.injectStyles('common-styles-core', CommonStyles.getAllCommonStyles(config));
    }

    /**
     * Helper utilitário para injeção segura de CSS.
     * Centraliza a criação de tags `<style>` e evita duplicidade.
     * 
     * @param {string} styleId - ID único para a tag style.
     * @param {string} cssContent - Conteúdo CSS.
     * @returns {boolean} True se injetou, False se já existia.
     */
    static injectStyles(styleId, cssContent) {
        if (document.getElementById(styleId)) {
            return false;
        }
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = cssContent;
        document.head.appendChild(style);
        return true;
    }

    static getPaginationStyles(config = {}) {
        const { accentColor = '#0056b3', applyOpacity } = config;
        const hoverBg = applyOpacity
            ? applyOpacity(accentColor, 0.15)
            : `color-mix(in srgb, var(--primary-color, ${accentColor}) 15%, transparent)`;
        return `
            .nar-container .page-size-select,
            .page-size-select {
                transition: background-color 0.2s, border-color 0.2s !important;
            }
            .nar-container .page-size-select:hover, 
            .nar-container .page-size-select:focus,
            .page-size-select:hover, 
            .page-size-select:focus {
                background-color: ${hoverBg} !important;
                outline: none !important;
            }
            .nar-container .pagination .page-item.active .page-link,
            .pagination .page-item.active .page-link {
                cursor: default !important;
                pointer-events: none !important;
            }
            .nar-container .pagination .page-item.active .page-link:hover,
            .pagination .page-item.active .page-link:hover {
                background-color: inherit !important;
                border-color: transparent !important;
                color: inherit !important;
            }
            .nar-container .pagination .page-item:not(.active):not(.disabled) .page-link:hover,
            .pagination .page-item:not(.active):not(.disabled) .page-link:hover {
                background-color: ${hoverBg} !important;
                border-color: transparent !important;
                color: #333 !important;
                z-index: 2; 
                position: relative;
            }
            .nar-container .pagination,
            .pagination {
                display: flex;
                align-items: center;
                gap: 5px;
            }
            .nar-container .pagination .page-link,
            .pagination .page-link {
                min-width: 34px;
                height: 34px;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 0.375rem 0.75rem;
                line-height: 1.5;
            }
            @media (max-width: 767px) {
                .pagination .page-link {
                    padding: 0.75rem 1rem; 
                    font-size: 1rem;
                    height: auto !important;
                }
            }
            @media (max-width: 767px) {
                .nar-container .tr-controls,
                .tr-controls {
                    justify-content: space-between !important;
                    flex-wrap: nowrap !important;
                }
                div[id^="pagination-container-"] > div > div:first-child {
                    flex-direction: row !important; 
                    align-items: center !important;
                    justify-content: space-between !important;
                    gap: 5px;
                    padding: 8px 10px !important;
                }
                div[id^="pagination-container-"] > div > div:first-child > div {
                    width: 100%;
                    justify-content: space-between;
                    display: flex;
                    align-items: center;
                }
                div[id^="pagination-container-"] label {
                    font-size: 1rem !important; 
                    margin-right: 5px !important;
                    flex: 1;
                    margin-bottom: 0;
                }
                div[id^="pagination-container-"] select {
                    flex: 0 0 auto; 
                    height: 34px !important; 
                }
            }
        `;
    }

    static getStatusBadgeStyles() {
        return `
            .status-badge {
                display: inline-flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                padding: 0px 5px;
                min-width: 41px;
                border-radius: 4px;
                font-family: 'Mulish', sans-serif;
                font-weight: 700;
                font-style: normal;
                font-size: 10px;
                height: 21px;
                line-height: 1;
                letter-spacing: 0%;
                white-space: nowrap;
            }
            .status-neutro {
                background-color: #f8f9fa;
                color: #6c757d;
                border: 1px solid #dee2e6;
            }
            .status-ativo {
                background-color: #76C96E;
                opacity: 1;
                color: #262626;
            }
            .status-bloqueado {
                background-color: rgba(228, 54, 55, 0.1);
                color: #262626;
            }
            .status-cancelado {
                background-color: #F0312E;
                opacity: 1;
                color: #FEFEFE;
            }
            .status-em-analise {
                background-color: #FFC107;
                opacity: 1;
                color: #262626;
            }
            .status-efetivado {
                background-color: #76C96E;
                opacity: 1;
                color: #262626;
            }
            .status-cadastrado {
                background-color: rgba(118, 201, 110, 0.1);
                border: 1px solid #76C96E;
                color: #262626;
            }
            .status-inativo {
                background-color: #E0E0E0;
                color: #262626;
                width: auto;
                padding: 4px;
            }
            .status-entregue {
                background-color: #00BCD4;
                color: #ffffff;
                width: auto;
                padding: 4px;
            }
        `;
    }

    static getSearchStyles() {
        return `
            .tr-search-wrapper {
                position: relative;
                min-width: 200px;
            }
            .tr-search-input {
                padding-left: 2.8em !important;
                border-radius: 20px !important;
                height: 34px;
            }
            .tr-search-icon {
                position: absolute;
                left: 0.8em;
                top: 50%;
                transform: translateY(-50%);
                color: #999;
                z-index: 10;
                pointer-events: none;
            }
            @media (max-width: 767px) {
                .tr-search-wrapper {
                    width: auto !important;
                    flex: 1;
                    min-width: 0;
                    margin-right: 10px;
                }
                .tr-search-input {
                    height: 44px;
                    width: 100% !important;
                    padding-left: 3.4em !important;
                }
                .tr-search-icon {
                    left: 1em;
                }
            }
        `;
    }

    static getCheckboxStyles(config = {}) {
        const { accentColor = '#0056b3' } = config;
        return `
            input[type="checkbox"].custom-checkbox,
            .custom-checkbox {
                cursor: pointer;
                width: 16px;
                height: 16px;
                accent-color: ${accentColor} !important;
                -webkit-appearance: none;
                appearance: none;
                border: 1.5px solid #ccc;
                border-radius: 3px;
                position: relative;
                outline: none;
            }
            input[type="checkbox"].custom-checkbox:checked,
            .custom-checkbox:checked {
                accent-color: ${accentColor} !important;
                background-color: ${accentColor} !important;
                border-color: ${accentColor} !important;
            }
            input[type="checkbox"].custom-checkbox:checked::after,
            .custom-checkbox:checked::after {
                content: "✓";
                position: absolute;
                left: 50%;
                top: 50%;
                transform: translate(-50%, -50%);
                color: white;
                font-size: 12px;
                font-weight: bold;
            }
        `;
    }

    static getInlineActionButtonStyles(config = {}) {
        const { accentColor = '#0056b3', applyOpacity } = config;
        const hoverBg = applyOpacity
            ? applyOpacity(accentColor, 0.1)
            : `color-mix(in srgb, ${accentColor} 10%, transparent)`;
        return `
            .tr-action-btn-inline:hover {
                color: ${accentColor} !important;
                background-color: ${hoverBg} !important;
                border-radius: 4px;
            }
        `;
    }

    static getToggleSwitchStyles(config = {}) {
        const { accentColor = '#0056b3' } = config;
        return `
            .tr-toggle-wrapper {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .tr-toggle-label {
                font-size: 0.9em;
                color: #333;
            }
            .tr-switch {
                position: relative;
                display: inline-block;
                width: 36px;
                height: 20px;
                margin-bottom: 0;
            }
            .tr-switch input {
                opacity: 0;
                width: 0;
                height: 0;
            }
            .tr-slider {
                position: absolute;
                cursor: pointer;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background-color: #ccc;
                transition: .4s;
                border-radius: 34px;
            }
            .tr-slider:before {
                position: absolute;
                content: "";
                height: 14px;
                width: 14px;
                left: 3px;
                bottom: 3px;
                background-color: white;
                transition: .4s;
                border-radius: 50%;
            }
            input:checked + .tr-slider {
                background-color: ${accentColor};
            }
            input:focus + .tr-slider {
                box-shadow: 0 0 1px ${accentColor};
            }
            input:checked + .tr-slider:before {
                transform: translateX(16px);
            }
        `;
    }

    static getActionDropdownStyles(config = {}) {
        const { accentColor = '#0056b3', applyOpacity } = config;
        const softBg = applyOpacity
            ? applyOpacity(accentColor, 0.15)
            : `rgba(0, 0, 0, 0.05)`;
        return `
            .tr-actions-container {
                position: relative;
                display: inline-block;
            }
            .tr-actions-btn {
                background: transparent;
                border: none;
                font-size: 1.2rem;
                color: #555;
                cursor: pointer;
                padding: 4px 8px;
                border-radius: 6px;
                transition: background-color 0.2s ease, color 0.2s ease;
            }
            .tr-actions-btn:hover,
            .tr-actions-btn-active {
                color: #333 !important;
                background-color: ${softBg} !important;
            }
            .tr-actions-menu {
                display: none;
                position: fixed;
                background-color: #fff;
                min-width: 100px;
                width: max-content !important;
                max-width: 200px;
                max-height: 300px;
                overflow-y: auto;
                overscroll-behavior: contain;
                box-shadow: 0px 8px 16px 0px rgba(0,0,0,0.2);
                z-index: 9999;
                border-radius: 4px;
                text-align: left;
                padding: 4px 0;
            }
            .tr-actions-menu.show {
                display: block;
            }
            .tr-actions-item {
                color: #333; 
                padding: 6px 12px;
                text-decoration: none;
                display: block;
                background: none;
                border: none;
                width: 100%;
                text-align: left;
                font-size: 0.85rem;
                cursor: pointer;
                line-height: 1.2;
                white-space: nowrap;
                transition: background-color 0.1s ease;
            }
            .tr-actions-item:hover {
                background-color: ${softBg} !important; 
                color: #333 !important; 
                text-decoration: none !important;
            }
            .tr-actions-item i {
                margin-right: 8px;
                width: 16px;
                text-align: center;
                color: inherit; 
            }
            .tr-settings-btn {
                transition: all 0.2s ease;
            }
            .tr-settings-btn:hover {
                color: ${accentColor} !important;
                opacity: 0.8;
                transform: rotate(15deg);
            }
            .tr-menu-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 9998;
                display: none;
            }
            .tr-menu-overlay.show {
                display: block;
            }
        `;
    }

    /**
     * Agrega todos os módulos de estilo em uma única string CSS.
     * Utiliza cache interno baseado no `config.accentColor` para performance.
     *
     * @param {Object} config
     * @returns {string} CSS completo pronto para uso.
     */
    static getAllCommonStyles(config = {}) {
        const cacheKey = CommonStyles._getCacheKey(config);
        if (CommonStyles._styleCache.has(cacheKey)) {
            return CommonStyles._styleCache.get(cacheKey);
        }
        const styles = `
            ${CommonStyles.getPaginationStyles(config)}
            ${CommonStyles.getStatusBadgeStyles()}
            ${CommonStyles.getSearchStyles()}
            ${CommonStyles.getCheckboxStyles(config)}
            ${CommonStyles.getInlineActionButtonStyles(config)}
            ${CommonStyles.getToggleSwitchStyles(config)}
            ${CommonStyles.getActionDropdownStyles(config)}
        `;
        CommonStyles._styleCache.set(cacheKey, styles);
        return styles;
    }

    /**
     * Limpa o cache de estilos gerados.
     * Útil quando há troca dinâmica de tema sem reload da página.
     */
    static clearCache() {
        CommonStyles._styleCache.clear();
    }
}

if (typeof window !== 'undefined') {
    window.DataRenderEngine = window.DataRenderEngine || {};
    window.DataRenderEngine.CommonStyles = CommonStyles;
}
