/**
 * Gerenciador de estilos encapsulados para tabelas.
 * Implementa cache de opacidade e gera CSS dinâmico para controles,
 * cabeçalhos sticky e responsividade.
 */
class TableStyle {
    static _opacityCache = new Map();

    /**
     * Gera estilos base para estrutura, botões e dropdowns.
     * Centraliza a lógica de cores derivadas (hover, seleção) baseadas no `accentColor`.
     *
     * @param {Object} config - { accentColor, legacyTableRenderer, applyOpacity }
     * @returns {string} CSS string.
     */
    static getBaseStyles(config) {
        const { accentColor, legacyTableRenderer, applyOpacity } = config;
        const getOpacity = (alpha) => {
            const key = `${accentColor}-${alpha}`;
            if (!TableStyle._opacityCache.has(key)) {
                TableStyle._opacityCache.set(key, applyOpacity(accentColor, alpha));
            }
            return TableStyle._opacityCache.get(key);
        };
        const hoverBg = getOpacity(0.24);
        const selectedHoverBg = getOpacity(0.35);
        const colBtnHoverBg = getOpacity(0.15);
        const colResetHover = getOpacity(0.8);
        const labelHoverBg = getOpacity(0.05);
        return `
                .tr-controls { display: flex; justify-content: flex-end; align-items: center; margin-bottom: 5px; flex-wrap: wrap; gap: 10px; padding: 0; }
                .tr-col-manager { position: relative; }
                .tr-col-btn { border-radius: 4px; height: 34px; padding: 0 12px; border: 1px solid #ddd; background: #fff; color: #555; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all 0.2s; }
                .tr-col-btn:hover { background: ${colBtnHoverBg}; border-color: #ccc; color: #333; }
                .tr-col-dropdown { display: none; position: absolute; top: 100%; right: 0; margin-top: 5px; width: 280px; background: #fff; border: 1px solid rgba(0,0,0,0.15); border-radius: 4px; box-shadow: 0 6px 12px rgba(0,0,0,0.175); z-index: 1000; padding: 0; text-align: left; }
                .tr-col-dropdown-header { padding: 10px; border-bottom: 1px solid #eee; }
                .tr-col-dropdown-search { width: 100%; padding: 6px 10px; border: 1px solid #ddd; border-radius: 3px; font-size: 0.9em; }
                .tr-col-list { max-height: 250px; overflow-y: auto; padding: 5px 0; }
                .tr-col-item { display: block; padding: 6px 15px; cursor: pointer; font-size: 0.9em; color: #333; user-select: none; margin: 0; }
                .tr-col-item:hover { background-color: #f5f5f5; }
                .tr-col-item input { margin-right: 8px; vertical-align: middle; cursor: pointer; width: 16px; height: 16px; accent-color: ${accentColor} !important; -webkit-appearance: none; appearance: none; border: 1.5px solid #ccc; border-radius: 3px; position: relative; outline: none; }
                .tr-col-item input:checked { accent-color: ${accentColor} !important; background-color: ${accentColor} !important; border-color: ${accentColor} !important; }
                .tr-col-item input:checked::after { content: "✓"; position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); color: white; font-size: 12px; font-weight: bold; }
                .tr-col-item.disabled { color: #999; cursor: default; }
                .tr-col-item span { vertical-align: middle; }
                .tr-col-footer { padding: 8px 10px; border-top: 1px solid #eee; text-align: center; background: #fcfcfc; }
                .tr-col-reset-btn { background: none; border: none; color: ${accentColor}; font-size: 0.85em; cursor: pointer; text-decoration: underline; padding: 0; }
                .tr-col-reset-btn:hover { color: ${colResetHover}; }
                .tr-table-wrapper { 
                    overflow-x: auto; 
                    ${legacyTableRenderer ? 'border-radius: 8px;' : 'border-radius: 0;'} 
                    ${legacyTableRenderer ? 'border: 1px solid #e9ecef;' : 'border: none;'} 
                    position: relative; margin: 0; width: 100%; 
                }
                .tr-table-wrapper table { 
                    margin-bottom: 0; 
                    width: 100%;
                    border-collapse: separate !important; 
                    border-spacing: 0 !important; 
                }
                .tr-table-wrapper thead th { 
                    position: sticky; top: 0; z-index: 5; 
                    box-shadow: 0 1px 2px rgba(0,0,0,0.05); 
                }
                .tr-table-wrapper tbody tr { 
                    background-color: #ffffff !important; 
                    font-size: 0.85rem; 
                    transition: transform 0.2s ease, box-shadow 0.2s ease, background-color 0.15s;
                }
                .tr-table-wrapper tbody tr:hover { 
                    background-color: ${hoverBg} !important; 
                    transform: translateY(-1px);
                    box-shadow: 0 2px 4px rgba(118, 201, 110, 0.1);
                    position: relative; 
                    z-index: 2;          
                }
                .nar-container .tr-table-wrapper table,
                .nar-body .tr-table-wrapper table {
                    font-size: 0.85rem !important;
                }
                .nar-container .tr-table-wrapper tbody tr,
                .nar-body .tr-table-wrapper tbody tr {
                      font-size: 0.85rem !important;
                }
                .tr-table-wrapper tbody tr td:nth-child(2) {
                    border-radius: 0 !important;
                    transition: border-radius 0.2s ease;
                }
                .tr-table-wrapper tbody tr:hover td:nth-child(2) {
                    border-top-left-radius: 10px !important;
                    border-bottom-left-radius: 10px !important;
                }
                .tr-table-wrapper tbody tr td:last-child {
                    border-radius: 0 !important;
                    transition: border-radius 0.2s ease;
                }
                .tr-table-wrapper tbody tr:hover td:last-child {
                    border-top-right-radius: 10px !important;
                    border-bottom-right-radius: 10px !important;
                }
                .tr-table-wrapper table.table > tbody > tr > td {
                    border-top: 1px solid #e9ecef !important;
                    border-bottom: none !important;
                }
                .tr-table-wrapper table.table > tbody > tr:first-child > td {
                    border-top: none !important;
                }
                .tr-table-wrapper table.table > tbody > tr:hover > td {
                    border-top-color: transparent !important;
                }
                .tr-table-wrapper table.table > tbody > tr:hover + tr > td {
                    border-top-color: transparent !important;
                }
                .tr-table-wrapper thead th[hidden], .tr-table-wrapper tbody td[hidden] { display: none !important; }
                .tr-table-wrapper input[type="checkbox"] { cursor: pointer; width: 16px; height: 16px; accent-color: ${accentColor} !important; -webkit-appearance: none; appearance: none; border: 1.5px solid #ccc; border-radius: 3px; position: relative; outline: none; }
                .tr-table-wrapper input[type="checkbox"]:checked { accent-color: ${accentColor} !important; background-color: ${accentColor} !important; border-color: ${accentColor} !important; }
                .tr-table-wrapper input[type="checkbox"]:checked::after { content: "✓"; position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); color: white; font-size: 12px; font-weight: bold; }
                .tr-table-wrapper td, .tr-table-wrapper th { white-space: normal; overflow: visible; text-overflow: clip; word-wrap: break-word; }
                .tr-table-wrapper th.tr-checkbox-cell, .tr-table-wrapper td.tr-checkbox-cell { text-overflow: clip !important; overflow: visible !important; padding-left: 2px !important; padding-right: 2px !important; }
                .tr-table-wrapper th.tr-column-critical, .tr-table-wrapper td.tr-column-critical { overflow: visible !important; text-overflow: clip !important; white-space: nowrap !important; min-width: 180px !important; }
                .tr-table-wrapper th.tr-column-no-ellipsis, .tr-table-wrapper td.tr-column-no-ellipsis { overflow: visible !important; text-overflow: clip !important; white-space: normal !important; }
                .tr-table-wrapper.tr-table-fixed-widths table { table-layout: fixed; width: 100%; }
                .tr-table-wrapper.tr-table-fixed-widths th, .tr-table-wrapper.tr-table-fixed-widths td { overflow: hidden; text-overflow: ellipsis; white-space: normal; }
                .tr-table-wrapper.tr-table-fixed-widths th.tr-column-critical, .tr-table-wrapper.tr-table-fixed-widths td.tr-column-critical { overflow: visible !important; text-overflow: clip !important; }
                .tr-table-wrapper.tr-has-critical-columns { overflow-x: auto !important; -webkit-overflow-scrolling: touch !important; }
                .tr-table-wrapper.tr-has-critical-columns table { width: max-content; min-width: 100%; }
                .tr-col-list label:hover { background-color: ${labelHoverBg}; }
                .tr-table-wrapper tbody tr.selected-row, .tr-table-wrapper tbody tr:nth-of-type(odd).selected-row { background-color: ${hoverBg} !important; }
                .tr-table-wrapper tbody tr.selected-row:hover { 
                    background-color: ${selectedHoverBg} !important; 
                    transform: translateY(-1px);
                    box-shadow: 0 2px 4px rgba(118, 201, 110, 0.1);
                    z-index: 2;
                    position: relative;
                }
                .th-sortable { cursor: pointer; user-select: none; }
                .th-sortable:hover { background-color: rgba(0,0,0,0.05); }
                .sort-icon { margin-left: 8px; opacity: 0.35; font-size: 0.85em; transition: opacity 0.2s ease-in-out; }
                .th-sortable:hover .sort-icon:not(.active) { opacity: 0.75 !important; }
                .sort-icon:hover { opacity: 0.75; }
                .sort-icon.active { opacity: 0.75; color: inherit; }
                .tr-sort-icons { display: inline-flex; flex-direction: column; margin-left: 8px; vertical-align: middle; justify-content: center; align-items: center; opacity: 1; line-height: 1; gap: 0; align-self: center; }
                .tr-sort-icons i { font-size: 10px; display: block; height: 6px; line-height: 6px; margin: 0; padding: 0; color: inherit; -webkit-text-fill-color: transparent; -webkit-background-clip: text; background-clip: text; background-size: 100% 200%; transition: background-position 0.5s ease-out; }
                .tr-sort-icons .fa-caret-up { margin-bottom: -1px; background-image: linear-gradient(to bottom, rgba(150,150,150,0.3) 50%, currentColor 50%); background-position: 0% 0%; }
                .tr-sort-icons .fa-caret-down { margin-top: -1px; background-image: linear-gradient(to bottom, currentColor 50%, rgba(150,150,150,0.3) 50%); background-position: 0% 100%; }
                .th-sortable.just-sorted .tr-sort-icons.hover-preditivo.is-asc i { transition: none !important; }
                .th-sortable.just-sorted .tr-sort-icons.hover-preditivo.is-asc .fa-caret-up { background-position: 0% 100% !important; }
                .th-sortable.just-sorted .tr-sort-icons.hover-preditivo.is-asc .fa-caret-down { background-position: 0% 100% !important; }
                .th-sortable.just-sorted .tr-sort-icons.hover-preditivo.is-desc i { transition: none !important; }
                .th-sortable.just-sorted .tr-sort-icons.hover-preditivo.is-desc .fa-caret-down { background-position: 0% 0% !important; }
                .th-sortable.just-sorted .tr-sort-icons.hover-preditivo.is-desc .fa-caret-up { background-position: 0% 0% !important; }
                .tr-table-wrapper th[style*="width"], .tr-table-wrapper td[style*="width"] { flex-shrink: 0; }
                .th-sortable-datatables .tr-th-title { padding-right: 0px; box-sizing: border-box; }
        `;
    }

    /**
     * Gera estilos estendidos para comportamentos avançados.
     * Cobre:
     * - Ordenação preditiva (hover effects).
     * - Layout inteligente (fixed vs auto).
     * - Ícones de ordenação estilo DataTables.
     * - Responsividade móvel (contadores de linha, ajustes de padding).
     */
    static getExtendedStyles(config) {
        const { accentColor, tableId } = config;
        return `
                .th-sortable:hover .tr-sort-icons.hover-preditivo:not(.is-active) .fa-caret-up {
                    background-position: 0% 100%; 
                }
                .th-sortable:hover .tr-sort-icons:not(.hover-preditivo):not(.is-active) .fa-caret-up,
                .th-sortable:hover .tr-sort-icons:not(.hover-preditivo):not(.is-active) .fa-caret-down {
                      background-position: 0% 100%; 
                }
                .tr-smart-layout .table {
                    table-layout: fixed !important;
                    width: 100% !important; 
                    border-collapse: separate !important;
                }
                .tr-smart-layout.tr-table-wrapper {
                      overflow-x: auto !important;
                }
                .tr-sort-icons.is-asc .fa-caret-up {
                    background-position: 0% 100%; 
                }
                .th-sortable:hover .tr-sort-icons.hover-preditivo.is-asc .fa-caret-down {
                    background-position: 0% 0%; 
                }
                .th-sortable:hover .tr-sort-icons.hover-preditivo.is-asc .fa-caret-up {
                    background-position: 0% 0%; 
                }
                .th-sortable:hover .tr-sort-icons:not(.hover-preditivo).is-asc .fa-caret-down {
                    background-position: 0% 0%; 
                }
                .tr-sort-icons.is-desc .fa-caret-down {
                    background-position: 0% 0%; 
                }
                .th-sortable:hover .tr-sort-icons.hover-preditivo.is-desc .fa-caret-down {
                    background-position: 0% 100%; 
                }
                .th-sortable:hover .tr-sort-icons:not(.hover-preditivo).is-desc .fa-caret-up {
                    background-position: 0% 100%; 
                }
                .th-sortable-datatables {
                    position: relative;
                    padding-right: 30px !important; 
                }
                .th-sortable-datatables::before,
                .th-sortable-datatables::after {
                    position: absolute;
                    top: 50%;
                    transform: translateY(-50%); 
                    display: block;
                    font-size: 1.0em;
                    color: inherit;
                    -webkit-text-fill-color: transparent;
                    -webkit-background-clip: text;
                    background-clip: text;
                    background-size: 100% 200%;
                    transition: background-position 0.5s ease-out;
                }
                .th-sortable-datatables::before {
                    right: 1em;                      
                    content: "\\2191";              
                    background-image: linear-gradient(to bottom, rgba(150,150,150,0.3) 50%, currentColor 50%);
                    background-position: 0% 0%; 
                }
                .th-sortable-datatables::after {
                    right: 0.5em;                   
                    content: "\\2193";              
                    background-image: linear-gradient(to bottom, currentColor 50%, rgba(150,150,150,0.3) 50%);
                    background-position: 0% 100%; 
                }
                .th-sortable-datatables.just-sorted.th-hover-preditivo.sorting_asc:hover::before { 
                    background-position: 0% 100% !important; 
                }
                .th-sortable-datatables.just-sorted.th-hover-preditivo.sorting_asc:hover::after { 
                    background-position: 0% 0% !important; 
                }
                .th-sortable-datatables.just-sorted.th-hover-preditivo.sorting_desc:hover::after { 
                    background-position: 0% 0% !important; 
                }
                .th-sortable-datatables.just-sorted.th-hover-preditivo.sorting_desc:hover::before { 
                    background-position: 0% 100% !important; 
                }
                .th-sortable-datatables.th-hover-preditivo:not(.sorting_asc):not(.sorting_desc):hover::before { 
                    background-position: 0% 100%; 
                }
                .th-sortable-datatables.sorting_asc::before { 
                    background-position: 0% 100%; 
                }
                .th-sortable-datatables.th-hover-preditivo.sorting_asc:hover::after { 
                    background-position: 0% 0%; 
                }
                .th-sortable-datatables.th-hover-preditivo.sorting_asc:hover::before { 
                    background-position: 0% 0%; 
                }
                .th-sortable-datatables.sorting_desc::after { 
                    background-position: 0% 0%; 
                }
                .th-sortable-datatables.th-hover-preditivo.sorting_desc:hover::after { 
                    background-position: 0% 100%; 
                }
                @media (max-width: 767px) {
                    .tr-table-wrapper table {
                        font-size: 1rem !important;
                    }
                    .tr-table-wrapper table tbody tr td {
                        border-top: 1px solid #eee !important; 
                        border-bottom: none !important;
                    }
                    .tr-table-wrapper table tbody tr:first-child td {
                        border-top: none !important;
                    }
                    .tr-table-wrapper th, 
                    .tr-table-wrapper td {
                        padding: 12px 10px !important;
                    }
                    .tr-table-wrapper th {
                        vertical-align: middle !important;
                        display: table-cell !important;
                    }
                    .th-sortable-datatables {
                        padding-right: 40px !important;
                    }
                    .th-sortable-datatables::before,
                    .th-sortable-datatables::after {
                        top: 50% !important;
                        transform: translateY(-50%) !important;
                        bottom: auto !important;
                    }
                    .th-sortable .tr-sort-icons {
                        align-self: center !important;
                        vertical-align: middle !important;
                    }
                    .th-sortable > div[style*="display: flex"] {
                        align-items: center !important;
                    }
                    .tr-smart-layout .table,
                    .tr-table-wrapper.tr-table-fixed-widths table {
                        table-layout: auto !important; 
                    }
                    .tr-table-wrapper th.tr-column-critical,
                    .tr-table-wrapper td.tr-column-critical {
                        overflow: visible !important;
                        text-overflow: clip !important;
                        white-space: nowrap !important;
                        min-width: 80px !important; 
                    }
                    .tr-table-wrapper.tr-has-critical-columns {
                        overflow-x: auto !important;
                        -webkit-overflow-scrolling: touch !important; 
                        scrollbar-width: thin;
                        scrollbar-color: rgba(0,0,0,0.3) transparent;
                    }
                    .tr-table-wrapper.tr-has-critical-columns table {
                        width: max-content !important;
                        min-width: 100% !important;
                    }
                    }
                    .tr-table-wrapper::-webkit-scrollbar-track {
                        background: transparent;
                    }
                    .tr-table-wrapper::-webkit-scrollbar-thumb:hover {
                        background-color: rgba(0,0,0,0.5);
                    }
                    .tr-table-wrapper.tr-table-fixed-widths th.tr-column-critical,
                    .tr-table-wrapper.tr-table-fixed-widths td.tr-column-critical {
                        min-width: 140px !important; 
                    }
                    .nar-container .tr-table-wrapper.tr-table-fixed-widths table,
                    .nar-body .tr-table-wrapper.tr-table-fixed-widths table {
                        table-layout: auto !important; 
                    }
                    .nar-container .tr-table-wrapper th,
                    .nar-container .tr-table-wrapper td,
                    .nar-body .tr-table-wrapper th,
                    .nar-body .tr-table-wrapper td {
                        padding: 6px 4px !important; 
                    }
                    .nar-container .tr-table-wrapper,
                    .nar-body .tr-table-wrapper {
                        margin-left: 0 !important;
                        margin-right: 0 !important;
                    }
                    .nar-container .tr-table-wrapper,
                    .nar-body .tr-table-wrapper {
                        overflow-x: auto !important;
                        -webkit-overflow-scrolling: touch; 
                    }
                    .nar-container .tr-controls,
                    .nar-body .tr-controls {
                        padding: 0 !important;
                        margin-bottom: 8px !important;
                    }
                    .nar-container #pagination-container,
                    .nar-body #pagination-container {
                        padding-left: 0 !important;
                        padding-right: 0 !important;
                    }
                    .tr-table-wrapper tbody {
                        counter-reset: rowNumber; 
                    }
                    .tr-table-wrapper tbody tr {
                        counter-increment: rowNumber; 
                    }
        `;
    }

    static getComponentStyles(config) {
        const { accentColor, applyOpacity } = config;
        const borderColor = applyOpacity ? applyOpacity(accentColor, 1) : accentColor;
        return `
            .page-size-select {
                border-color: ${borderColor} !important;
            }
            .tr-table-wrapper th.tr-checkbox-cell,
            .tr-table-wrapper td.tr-checkbox-cell {
                text-align: center !important;
                vertical-align: middle !important;
                padding: 0 !important; 
                width: 40px !important;
                min-width: 40px !important;
                max-width: 40px !important;
            }
            .tr-table-wrapper th.tr-checkbox-cell input,
            .tr-table-wrapper td.tr-checkbox-cell input {
                margin: 0 auto !important;    
                display: block !important;    
                float: none !important;
                position: relative !important;  
            }
            .tr-mobile-marker-cell {
                display: none;
                width: 0;
                padding: 0 !important;
                border: none !important;
            }
            @media (max-width: 767px) {
                .tr-table-wrapper table {
                    border-collapse: collapse !important; 
                    border-spacing: 0 !important;
                }
                .tr-table-wrapper tbody tr td:nth-child(2),
                .tr-table-wrapper tbody tr td:last-child {
                    border-radius: 0 !important;
                }
                .tr-table-wrapper table tbody tr td {
                    border-top: 1px solid #eee !important; 
                }
                .tr-table-wrapper table tbody tr:first-child td {
                    border-top: none !important;
                }
                .tr-mobile-marker-cell {
                    display: table-cell;
                    width: 25px !important;
                    min-width: 25px !important;
                    max-width: 25px !important;
                    padding: 0 !important;
                    position: -webkit-sticky !important;
                    position: sticky !important;
                    left: 0; 
                    background-color: #ffffff !important;
                    border-right: none !important; 
                    z-index: 19 !important; 
                }
                thead th.tr-mobile-marker-cell {
                    z-index: 20 !important; 
                    border-bottom: 1px solid #ddd;
                    border-right: none !important; 
                }
                td.tr-mobile-marker-cell::before {
                    content: counter(rowNumber); 
                    position: absolute;
                    left: 0; top: 0; bottom: 0; width: 25px;  
                    background-color: ${accentColor}; 
                    color: #ffffff; font-size: 0.75rem; font-weight: 700;    
                    display: flex; align-items: center; justify-content: center;
                }
                .tr-table-wrapper th.tr-checkbox-cell,
                .tr-table-wrapper td.tr-checkbox-cell {
                    position: -webkit-sticky !important;
                    position: sticky !important;
                    left: 25px; 
                    background-color: #ffffff !important;
                    background-clip: padding-box; 
                    border-right: 1px solid #e9ecef;
                    box-shadow: 2px 0 5px rgba(0,0,0,0.05);
                }
                .tr-table-wrapper thead th.tr-checkbox-cell {
                    z-index: 20 !important; 
                    opacity: 1 !important;
                    border-left: none !important; 
                    overflow: visible !important; 
                }
                .tr-table-wrapper thead th.tr-checkbox-cell input {
                    transform: translateX(-12px) scale(1.1); 
                    position: relative;
                    z-index: 25;
                    margin: 0;
                }
                .tr-table-wrapper tbody td.tr-checkbox-cell {
                    z-index: 19 !important;
                }
                .tr-table-wrapper td.tr-checkbox-cell {
                    padding-left: 2px !important;
                }
            }
            .th-sortable {
                position: relative !important;
            }
            .tr-sort-icons, .sort-icon {
                position: absolute !important;
                right: 5px !important;
                top: 50%;
                transform: translateY(-50%);
                margin: 0 !important;
                width: auto !important;
            }
            .tr-table-wrapper th.th-sortable {
                padding-right: 25px !important;
            }
            .tr-table-wrapper td[style*="text-align: right"],
            .tr-table-wrapper th[style*="text-align: right"] {
                padding-right: 25px !important;
            }
            .tr-table-wrapper th.th-sortable[style*="text-align: center"] {
                padding-left: 25px !important; 
            }
            .tr-table-wrapper th.tr-type-currency,
            .tr-table-wrapper td.tr-type-currency {
                padding-right: 45px !important; 
            }
        `;
    }

    static clearCache() {
        TableStyle._opacityCache.clear();
    }
}

if (typeof window !== 'undefined') {
    window.DataRenderEngine = window.DataRenderEngine || {};
    window.DataRenderEngine.TableStyles = TableStyle;
}
