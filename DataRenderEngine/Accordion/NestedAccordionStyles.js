/**
 * Gerador de estilos dinâmicos (CSS-in-JS) para o NestedAccordionRenderer.
 * Centraliza regras de layout, responsividade móvel e aplicação de tema de cores.
 */
class NestedAccordionStyle {
    /**
     * Retorna a string CSS compilada para injeção no DOM.
     * Utiliza `color-mix` nativo ou função de fallback para variações de opacidade.
     *
     * @param {Object} config
     * @param {string} [config.primaryColor='#0056b3'] - Cor base para bordas e destaques.
     * @param {Function} [config.applyOpacity] - Callback opcional para manipulação de cor (legacy support).
     * @returns {string} CSS formatado.
     */
    static getStyles(config = {}) {
        const { primaryColor = RendererUtils.DEFAULT_THEME_COLOR, applyOpacity } = config;
        const primaryColorLight = applyOpacity
            ? applyOpacity(primaryColor, 0.1)
            : `color-mix(in srgb, ${primaryColor} 10%, transparent)`;
        return `
            .nar-container {
            }
            .nar-card {
                background: #fff;
                border: 1px solid rgba(0,0,0,0.06);
                border-radius: 8px !important;
                margin-bottom: 16px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.03);
                overflow: hidden;
                transition: box-shadow 0.3s ease, transform 0.2s ease;
                position: relative;
            }
            .nar-card:hover {
                box-shadow: 0 8px 24px rgba(0,0,0,0.06);
            }
            .nar-header {
                padding: 12px 18px;
                cursor: pointer;
                background: #fff;
                display: flex;
                align-items: center;
                justify-content: space-between;
                user-select: none;
                transition: background-color 0.2s;
                border-left: 6px solid transparent;
                position: relative;
            }
            .nar-header:hover {
                background-color: #fafafa;
            }
            .nar-card.expanded > .nar-header,
            .nar-card.selected > .nar-header {
                background-color: color-mix(in srgb, var(--primary-color, ${primaryColor}) 15%, transparent) !important;
                border-left-color: var(--primary-color, ${primaryColor}) !important;
                border-left-width: 6px !important;
                border-left-style: solid !important;
                box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--primary-color, ${primaryColor}) 25%, transparent);
            }
            .nar-card.expanded > .nar-header:hover,
            .nar-card.selected > .nar-header:hover {
                background-color: color-mix(in srgb, var(--primary-color, ${primaryColor}) 22%, transparent) !important;
                box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--primary-color, ${primaryColor}) 35%, transparent);
            }
            .nar-card.expanded .nar-card.expanded > .nar-header,
            .nar-card.expanded .nar-card.selected > .nar-header,
            .nar-card.selected .nar-card.expanded > .nar-header,
            .nar-card.selected .nar-card.selected > .nar-header {
                background-color: color-mix(in srgb, var(--primary-color, ${primaryColor}) 10%, transparent) !important;
            }
            .nar-card.expanded .nar-card.expanded > .nar-header:hover,
            .nar-card.expanded .nar-card.selected > .nar-header:hover,
            .nar-card.selected .nar-card.expanded > .nar-header:hover,
            .nar-card.selected .nar-card.selected > .nar-header:hover {
                background-color: color-mix(in srgb, var(--primary-color, ${primaryColor}) 15%, transparent) !important;
            }
            .nar-title-group {
                display: flex;
                flex-direction: column;
                gap: 4px;
                flex-grow: 1;
            }
            .nar-title-wrapper {
                display: flex;
                align-items: center;
                gap: 8px;
                flex-wrap: wrap;
            }
            .nar-title {
                font-weight: 700;
                font-size: 16px;
                color: #2c3e50;
                line-height: 1.2;
            }
            .nar-title-badge {
                display: inline-flex;
                align-items: center;
                padding: 3px 8px;
                background-color: var(--primary-color);
                color: #ffffff;
                border-radius: 12px;
                font-size: 11px;
                font-weight: 600;
                line-height: 1;
                text-transform: uppercase;
                letter-spacing: 0.3px;
                white-space: nowrap;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
            }
            .nar-subtitle {
                font-size: 12px;
                color: #7f8c8d;
                font-weight: 500;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .nar-badge {
                display: inline-flex;
                align-items: baseline;
                gap: 6px;
                padding: 4px 10px;
                background-color: #ffffff;
                color: #2c3e50;
                border-radius: 12px;
                font-size: 12px;
                font-weight: 500;
                line-height: 1;
                border: 1px solid rgba(0, 0, 0, 0.08);
                box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
                white-space: nowrap;
            }
            .nar-badge i {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                font-size: 11px;
                color: #7f8c8d;
            }
            .nar-icon-container {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 32px;
                height: 32px;
                border-radius: 50%;
                background-color: rgba(0,0,0,0.03);
                transition: background-color 0.2s, transform 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);
            }
            .nar-header:hover .nar-icon-container {
                background-color: rgba(0,0,0,0.06);
            }
            .nar-chevron {
                font-size: 14px;                      
                color: var(--primary-color, ${primaryColor}); 
                transition: transform 0.4s cubic-bezier(0.25, 1, 0.5, 1); 
            }
            .nar-card.expanded > .nar-header > .nar-icon-container {
                background-color: var(--primary-color-light, ${primaryColorLight}); 
                transform: rotate(180deg);           
            }
            .nar-content-wrapper {
                max-height: 0;                    
                overflow: hidden;                 
                transition: max-height 0.5s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.4s ease;
                opacity: 0.5;                    
                background-color: #fff;
                border-top: 1px solid transparent; 
            }
            .nar-card.expanded > .nar-content-wrapper {
                max-height: 2000px;             
                opacity: 1;                     
                border-top: 1px solid #f0f0f0;  
            }
            .nar-body {
                padding: 24px;
                background-color: #fff;
            }
            .nar-card .nar-card {
                border: 1px solid #eee !important;
                box-shadow: none !important;
                margin-bottom: 8px;
                border-radius: 6px !important;
                margin-left: 12px;
                margin-right: 12px;
            }
            .nar-card .nar-card .nar-card {
                margin-left: 24px;
                margin-right: 24px;
            }
            .nar-card .nar-card .nar-header {
                padding: 8px 16px;
            }
            .nar-card .nar-card .nar-title {
                font-size: 14px;
            }
            .nar-card .nar-card .nar-card .nar-header {
                padding: 6px 14px;
            }
            .nar-pagination-minimal .nar-page-btn {
                transition: background-color 0.2s, transform 0.2s ease;
            }
            .nar-pagination-minimal .nar-page-btn:not(:disabled):hover {
                background-color: rgba(0,0,0,0.06) !important;
                transform: scale(1.05);
            }
            .nar-pagination-minimal .nar-page-btn:not(:disabled):active {
                transform: scale(0.95);
            }
            .nar-pagination-minimal .nar-accordion-select,
            .nar-container .nar-accordion-select {
                cursor: pointer !important;
            }
            .nar-pagination-minimal .nar-accordion-select:hover,
            .nar-container .nar-accordion-select:hover {
                cursor: pointer !important;
            }
            /* Custom Gray Checkbox */
            .nar-checkbox-custom {
                appearance: none !important;
                -webkit-appearance: none !important;
                width: 16px !important;
                height: 16px !important;
                border: 1.5px solid #ccc !important;
                border-radius: 3px !important;
                background-color: #fcfcfc !important;
                cursor: pointer !important;
                position: relative !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                transition: all 0.2s ease !important;
                margin: 0 !important;
                outline: none !important;
            }
            .nar-checkbox-custom:checked {
                background-color: var(--primary-color) !important;
                border-color: var(--primary-color) !important;
            }
            .nar-checkbox-custom:checked::after {
                content: '\\f00c';
                font-family: 'FontAwesome';
                font-size: 10px !important;
                color: #ffffff !important;
                font-weight: 900 !important;
                display: block !important;
            }
            .nar-checkbox-custom:not(:checked):hover {
                border-color: #aaa !important;
                background-color: #fff !important;
            }
            .nar-checkbox-custom:checked:hover {
                opacity: 0.85;
            }
            .nar-checkbox-custom:hover {
                box-shadow: 0 0 0 3px rgba(0,0,0,0.05) !important;
            }
            .nar-checkbox-custom:active {
                transform: scale(0.95) !important;
            }
            @media (max-width: 767px) {
                .nar-container {
                    padding-left: 0 !important;
                    padding-right: 0 !important;
                }
                .nar-body {
                    padding: 12px 6px !important;
                }
                .nar-header {
                    padding: 10px 10px !important;
                }
                .nar-card .nar-card {
                    margin-left: 2px !important;
                    margin-right: 2px !important;
                }
                .nar-card .nar-card .nar-card {
                    margin-left: 4px !important;
                    margin-right: 4px !important;
                }
                .nar-card .nar-card .nar-body {
                    padding: 8px 6px !important;
                }
                .nar-card .nar-card .nar-card .nar-body {
                    padding: 6px 4px !important;
                }
                .nar-card .nar-card .nar-header {
                    padding: 6px 10px !important;
                }
                .nar-card .nar-card .nar-card .nar-header {
                    padding: 5px 8px !important;
                }
                .nar-card {
                    margin-bottom: 12px !important;
                }
                .nar-card .nar-card {
                    margin-bottom: 6px !important;
                }
            }
        `;
    }
}

if (typeof window !== 'undefined') {
    window.DataRenderEngine = window.DataRenderEngine || {};
    window.DataRenderEngine.NestedAccordionStyles = NestedAccordionStyle;
}
