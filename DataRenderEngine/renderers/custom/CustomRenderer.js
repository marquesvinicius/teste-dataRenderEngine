(function () {
    'use strict';

    /**
     * CustomRenderer - Renderizador para conteúdo HTML livre ou lógica JS customizada.
     * Permite injetar HTML estático e/ou executar funções de renderização dinâmicas
     * dentro da árvore recursiva do DataRenderEngine (ex: dentro de um Accordion).
     * 
     * @class CustomRenderer
     */
    class CustomRenderer {
        /**
         * Renderiza conteúdo customizado em um container.
         * 
         * @param {string} containerId - ID do elemento DOM container
         * @param {any} data - Dados filtrados para este nó
         * @param {Object} config - Configuração específica do componente
         * @param {string} [config.html] - HTML estático para injetar no container
         * @param {Function} [config.render] - Função de renderização dinâmica: (container, data) => void
         * @param {Function} [config.destroy] - Função de limpeza opcional chamada ao destruir
         * @returns {Object|null} Interface padrão com métodos destroy e updateSelectionVisuals
         */
        static render(containerId, data, config) {
            const container = document.getElementById(containerId);
            if (!container) {
                console.warn('[CustomRenderer] Container não encontrado:', containerId);
                return null;
            }

            // 1. Injeção de HTML estático
            if (config.html) {
                container.innerHTML = config.html;
            }

            // 2. Execução de lógica dinâmica (Callback)
            if (typeof config.render === 'function') {
                try {
                    config.render(container, data);
                } catch (e) {
                    console.error('[CustomRenderer] Erro na função render:', e);
                }
            }

            // Retorna interface padrão para não quebrar o pai (Accordion, etc.)
            return {
                /**
                 * Limpa o container e executa destroy customizado se definido.
                 */
                destroy: () => {
                    if (typeof config.destroy === 'function') {
                        try {
                            config.destroy();
                        } catch (e) {
                            console.error('[CustomRenderer] Erro na função destroy:', e);
                        }
                    }
                    container.innerHTML = '';
                },
                /**
                 * Stub necessário para compatibilidade com SelectionPlugin.
                 */
                updateSelectionVisuals: () => { }
            };
        }
    }

    // Expor globalmente seguindo o padrão do projeto
    window.CustomRenderer = CustomRenderer;

    // Adicionar ao namespace se ele já existir
    if (window.DataRenderEngine) {
        window.DataRenderEngine.renderers = window.DataRenderEngine.renderers || {};
        window.DataRenderEngine.renderers.CustomRenderer = CustomRenderer;
    }
})();
