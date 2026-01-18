/**
 * ThemeManager - Gestão Centralizada de Temas
 * 
 * Responsável pela injeção e gestão de estilos CSS do DataRenderEngine.
 * Centraliza a lógica de `<style>` injection para evitar duplicação e
 * facilitar futura migração para CSS Variables.
 * 
 * @module themes/ThemeManager
 */
class ThemeManager {
    /**
     * Flag para evitar inicialização duplicada.
     * @type {boolean}
     * @private
     */
    static _initialized = false;

    /**
     * Cache de IDs de estilos já injetados.
     * @type {Set<string>}
     * @private
     */
    static _injectedStyles = new Set();

    /**
     * Cor de tema padrão (fallback).
     * @type {string}
     */
    static DEFAULT_COLOR = '#333333';

    /**
     * Inicializa o ThemeManager.
     * Deve ser chamado uma vez durante o bootstrap do DataRenderEngine.
     * 
     * @param {Object} [options={}] - Opções de inicialização
     * @param {string} [options.primaryColor] - Cor primária do tema
     * @param {boolean} [options.injectBaseStyles=true] - Se deve injetar estilos base
     */
    static init(options = {}) {
        if (ThemeManager._initialized) {
            return;
        }

        const primaryColor = options.primaryColor || ThemeManager._detectThemeColor() || ThemeManager.DEFAULT_COLOR;

        // Define variável CSS global para referência
        document.documentElement.style.setProperty('--dre-primary-color', primaryColor);

        ThemeManager._initialized = true;
    }

    /**
     * Injeta uma folha de estilos com ID único.
     * Se um estilo com o mesmo ID já existir, não faz nada (idempotente).
     * 
     * @param {string} id - Identificador único do bloco de estilos
     * @param {string} cssContent - Conteúdo CSS a ser injetado
     */
    static injectStyles(id, cssContent) {
        if (ThemeManager._injectedStyles.has(id)) {
            // Atualiza conteúdo se já existir
            const existing = document.getElementById(id);
            if (existing && existing.textContent !== cssContent) {
                existing.textContent = cssContent;
            }
            return;
        }

        const style = document.createElement('style');
        style.id = id;
        style.textContent = cssContent;
        document.head.appendChild(style);

        ThemeManager._injectedStyles.add(id);
    }

    /**
     * Remove um bloco de estilos pelo ID.
     * 
     * @param {string} id - Identificador do bloco de estilos
     */
    static removeStyles(id) {
        const style = document.getElementById(id);
        if (style) {
            style.remove();
            ThemeManager._injectedStyles.delete(id);
        }
    }

    /**
     * Detecta a cor do tema do portal legado via CSS computado.
     * Utiliza workaround com elemento dummy para extrair background do .header.
     * 
     * @returns {string|null} Cor detectada ou null
     * @private
     */
    static _detectThemeColor() {
        if (typeof window === 'undefined' || !document) return null;

        const dummy = document.createElement('div');
        dummy.className = 'header';
        dummy.style.display = 'none';
        document.body.appendChild(dummy);

        const color = window.getComputedStyle(dummy).backgroundColor;
        document.body.removeChild(dummy);

        // Valida se é uma cor válida (não transparente)
        if (color && color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent') {
            return color;
        }

        return null;
    }

    /**
     * Aplica opacidade a uma cor usando color-mix.
     * 
     * @param {string} color - Cor base (hex, rgb, ou nome)
     * @param {number} alpha - Opacidade (0-1)
     * @returns {string} Cor com opacidade aplicada via color-mix
     */
    static applyOpacity(color, alpha) {
        const percentage = Math.round(alpha * 100);
        return `color-mix(in srgb, ${color} ${percentage}%, transparent)`;
    }

    /**
     * Gera uma paleta de cores baseada em uma cor principal.
     * 
     * @param {string} baseColor - Cor base para gerar a paleta
     * @returns {Object} Objeto com variantes de cor
     */
    static generatePalette(baseColor) {
        const safeColor = baseColor || ThemeManager.DEFAULT_COLOR;
        return {
            base: safeColor,
            light: ThemeManager.applyOpacity(safeColor, 0.1),
            medium: ThemeManager.applyOpacity(safeColor, 0.5),
            hover: ThemeManager.applyOpacity(safeColor, 0.05),
            border: ThemeManager.applyOpacity(safeColor, 0.3)
        };
    }

    /**
     * Reseta o estado do ThemeManager.
     * Útil para testes ou hot-reload.
     */
    static reset() {
        ThemeManager._initialized = false;
        ThemeManager._injectedStyles.forEach(id => {
            ThemeManager.removeStyles(id);
        });
        ThemeManager._injectedStyles.clear();
    }
}

// Registro global
if (typeof window !== 'undefined') {
    window.ThemeManager = ThemeManager;
}
