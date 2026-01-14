/**
 * Utilitário para cálculo heurístico de larguras de colunas em Grids.
 * Resolve layout shifts e otimiza espaço via amostragem (limitada a 100 linhas) e cache.
 *
 * Precedência: Locked > Config Fixa > Presets (Field/Type) > Amostragem > Header Safety.
 *
 * Comportamento:
 * - Garante largura mínima para Headers (Label + Sort Icon).
 * - Elege "Hero Column" (width: auto) se a tabela couber no viewport.
 * - Retorna null para indicar largura flexível (fallback).
 */
class ColumnWidthUtils {
    static SAMPLING_LIMIT = 100;
    static FONT_AVG_WIDTH = 10;
    static PADDING_X = 20;
    static SAFETY_BUFFER = 12;
    static HEADER_CHAR_WIDTH = 8.5;
    static HEADER_BASE_PADDING = 40;
    static HEADER_SORT_ICON_SPACE = 25;
    static HEADER_SAFETY_MARGIN = 15;
    static LOCKED_FIELDS = ['actions', 'checkbox', 'selected', 'selector'];
    static LOCKED_TYPES = ['actions', 'checkbox', 'selection', 'settings'];

    /**
     * Presets de negócio com precedência sobre amostragem de conteúdo.
     */
    static FIELD_PRESETS = {
        'CIDADE': { min: 120, max: 180 },
        'MUNICIPIO': { min: 120, max: 180 },
        'ESTADO': { min: 60, max: 90 },
        'UF': { min: 60, max: 90 },
        'ENDERECO': { min: 200, max: 300 },
        'LOGRADOURO': { min: 200, max: 300 },
        'RUA': { min: 180, max: 280 },
        'BAIRRO': { min: 120, max: 180 },
        'NOME': { min: 140, max: 220 },
        'NOME_FUNCIONARIO': { min: 140, max: 220 },
        'NOME_CARTAO': { min: 140, max: 200 },
        'RAZAO_SOCIAL': { min: 160, max: 240 },
        'EMAIL': { min: 150, max: 240 },
        'TELEFONE': { min: 120, max: 150 },
        'CELULAR': { min: 120, max: 150 },
        'CPF': { min: 120, max: 140 },
        'CNPJ': { min: 150, max: 180 },
        'CEP': { min: 90, max: 110 },
        'REFERENCIA': { min: 100, max: 140 },
        'CARTAO': { min: 160, max: 220 },
        'NRO_CARTAO': { min: 160, max: 220 },
        'DEPARTAMENTO': { min: 120, max: 220 },
        'STATUS': { min: 100, max: 140 },
        'MOSTRA_STATUS': { min: 100, max: 140 },
        'DESCRICAO_STATUS': { min: 120, max: 160 },
        'SITUACAO': { min: 100, max: 140 },
        'VALOR': { min: 110, max: 160 },
        'SALDO': { min: 110, max: 160 },
        'SALDO_ATUAL': { min: 130, max: 180 },
        'LIMITE': { min: 110, max: 160 },
        'MOSTRA_LIMITE': { min: 130, max: 180 },
        'TOTAL': { min: 110, max: 160 }
    };
    static TYPE_PRESETS = {
        'currency': { min: 100, max: 140 },
        'date': { min: 100, max: 130 },
        'datetime': { min: 140, max: 180 },
        'badge': { min: 100, max: 140 },
        'boolean_icon': { min: 60, max: 90 },
        'toggle': { min: 70, max: 90 },
        'phone': { min: 120, max: 150 },
        'state': { min: 60, max: 80 },
        'cep': { min: 90, max: 110 },
        'code': { min: 80, max: 120 },
        'text': { min: 100, max: 250 }
    };

    /**
     * Calcula larguras otimizadas via heurísticas e amostragem.
     *
     * Regras:
     * - Utiliza cache se disponível.
     * - Presets de negócio têm precedência.
     * - Protege largura do header (Label + Sort Icon).
     * - Define "Hero Column" (null/auto) se houver espaço em tela.
     *
     * @param {Object[]} columns Configuração das colunas.
     * @param {Object[]} data Dataset completo (sujeito a amostragem).
     * @param {Map} [cache] Instância de cache.
     * @param {string} [cacheKey] Chave para cache.
     * @param {Object[]} [actionsDef] Definição de ações.
     * @param {number|string} [actionsOverrideWidth] Largura forçada para ações.
     * @param {boolean} [debug] Ativa logs detalhados.
     * @returns {Map<string, number|null>} Mapa de larguras em px (null = auto).
     */
    static computeAutoWidths(columns, data, cache, cacheKey, actionsDef = [], actionsOverrideWidth = null, debug = false) {
        if (cache && cacheKey && cache.has(cacheKey)) {
            if (debug) console.log(`[SmartWidths] Cache HIT for ${cacheKey}`);
            return cache.get(cacheKey);
        }
        if (debug) console.groupCollapsed('SmartWidths Calculation');
        const widthMap = new Map();
        if (actionsOverrideWidth) {
            let forcedW = 120;
            if (typeof actionsOverrideWidth === 'number') {
                forcedW = actionsOverrideWidth;
            } else if (typeof actionsOverrideWidth === 'string') {
                forcedW = parseInt(actionsOverrideWidth.replace('px', ''), 10) || 120;
            }
            widthMap.set('actions', forcedW);
            if (debug) console.log(`[Calc] Actions: FORCE OVERRIDE = ${forcedW}px`);
        } else if (actionsDef && actionsDef.length > 0) {
            const inlineCount = actionsDef.filter(a => a.inline).length;
            const hasDropdown = actionsDef.some(a => !a.inline);
            const padding = 60;
            const btnWidth = 65;
            let actionsWidth = padding + (inlineCount * btnWidth);
            if (hasDropdown) actionsWidth += btnWidth;
            actionsWidth = Math.max(300, Math.min(actionsWidth, 600));
            widthMap.set('actions', actionsWidth);
            if (debug) console.log(`[Calc] Actions: ${inlineCount} inline, Dropdown=${hasDropdown} -> ${actionsWidth}px`);
        } else {
            widthMap.set('actions', 0);
        }
        const safeData = data || [];
        const sampleSize = Math.min(safeData.length, this.SAMPLING_LIMIT);
        const sampleData = safeData.slice(0, sampleSize);
        let longestColField = null;
        let maxCalculatedWidth = 0;
        let totalTableWidth = (widthMap.get('actions') || 0);
        columns.forEach(col => {
            if (this._isLocked(col)) {
                widthMap.set(col.field, null);
                totalTableWidth += 40;
                return;
            }
            if (col.width && col.width !== 'auto') {
                const configPx = parseInt(col.width, 10);
                if (!isNaN(configPx) && col.title) {
                    const minHeaderRequired = this._calculateMinHeaderWidth(col.title);
                    if (configPx < minHeaderRequired) {
                        if (debug) console.log(`[Safety] Overriding config ${col.width} -> ${minHeaderRequired}px for ${col.field} (Header: "${col.title}")`);
                        widthMap.set(col.field, minHeaderRequired);
                        totalTableWidth += minHeaderRequired;
                        return;
                    }
                }
                widthMap.set(col.field, col.width);
                totalTableWidth += parseInt(col.width, 10) || 0;
                return;
            }
            const fieldUpper = col.field ? col.field.toUpperCase() : '';
            const preset = this.FIELD_PRESETS[fieldUpper] ||
                this.TYPE_PRESETS[col.type?.toLowerCase()] ||
                this.TYPE_PRESETS['text'];
            let maxContentChars = 0;
            let headerChars = 0;
            let minHeaderRequired = 0;
            if (col.title) {
                headerChars = String(col.title).length;
                minHeaderRequired = this._calculateMinHeaderWidth(col.title);
            }
            for (const row of sampleData) {
                let val = row[col.field];
                if (val !== null && val !== undefined) {
                    const str = String(val);
                    maxContentChars = Math.max(maxContentChars, str.length);
                }
            }
            const contentPx = (maxContentChars * this.FONT_AVG_WIDTH) + this.PADDING_X + this.SAFETY_BUFFER;
            const clampedContentPx = Math.max(preset.min, Math.min(contentPx, preset.max));
            const finalPx = Math.max(clampedContentPx, minHeaderRequired);
            const roundedPx = Math.round(finalPx);
            widthMap.set(col.field, roundedPx);
            const isTextType = !col.type || ['text', 'string'].includes(col.type);
            if (isTextType && clampedContentPx > maxCalculatedWidth) {
                maxCalculatedWidth = clampedContentPx;
                longestColField = col.field;
            }
            const resolvedW = widthMap.get(col.field) || 0;
            totalTableWidth += resolvedW;
            if (debug) {
                console.log(`[Calc] ${col.field}: Content=${maxContentChars}ch (${clampedContentPx}px) | Header="${col.title}" (${minHeaderRequired}px) -> Final=${roundedPx}px`);
            }
        });
        const viewportWidth = window.innerWidth || 1920;
        const availableSpace = viewportWidth - 60;
        if (totalTableWidth < availableSpace) {
            if (!longestColField) {
                let maxW = 0;
                columns.forEach(col => {
                    if (!this._isLocked(col) && widthMap.has(col.field)) {
                        const w = widthMap.get(col.field);
                        if (w > maxW) {
                            maxW = w;
                            longestColField = col.field;
                        }
                    }
                });
            }
            if (longestColField && widthMap.has(longestColField)) {
                if (debug) console.log(`%c[Fluid Hero] Elected: ${longestColField} (Table fits: ${totalTableWidth} < ${availableSpace})`, 'color: gold');
                widthMap.set(longestColField, null);
            }
        } else {
            if (debug) console.log(`%c[Responsive] No Hero elected. Table overflows (${totalTableWidth} > ${availableSpace}). Enforcing scroll.`, 'color: orange');
        }
        if (debug) console.groupEnd();
        if (cache && cacheKey) {
            cache.set(cacheKey, widthMap);
        }
        return widthMap;
    }

    static _isLocked(col) {
        if (this.LOCKED_FIELDS.includes(col.field)) return true;
        if (col.type && this.LOCKED_TYPES.includes(col.type)) return true;
        return false;
    }

    static _calculateMinHeaderWidth(headerTitle) {
        if (!headerTitle) return 80;
        const titleString = String(headerTitle);
        const charCount = titleString.length;
        const textWidth = charCount * this.HEADER_CHAR_WIDTH;
        const totalWidth = textWidth
            + this.HEADER_BASE_PADDING
            + this.HEADER_SORT_ICON_SPACE
            + this.HEADER_SAFETY_MARGIN;
        return Math.ceil(totalWidth);
    }

    /**
     * Gera HTML de `<colgroup>` para renderização eficiente.
     *
     * @param {Object[]} columns
     * @param {Map} widthMap
     * @param {boolean} selectionEnabled
     * @param {boolean} hasActions
     * @returns {string} String HTML.
     */
    static buildColGroupHtml(columns, widthMap, selectionEnabled, hasActions) {
        let html = '<colgroup>';
        if (selectionEnabled) html += '<col style="width: 40px">';
        columns.forEach(col => {
            const w = widthMap.get(col.field);
            if (w !== null && w !== undefined) {
                html += `<col style="width: ${w}px">`;
            } else {
                html += '<col style="width: auto">';
            }
        });
        if (hasActions) {
            const w = widthMap.get('actions');
            if (w) {
                html += `<col style="width: ${w}px">`;
            } else {
                html += '<col style="width: 120px">';
            }
        }
        html += '</colgroup>';
        return html;
    }
}
window.ColumnWidthUtils = ColumnWidthUtils;
