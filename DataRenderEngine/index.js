(function () {
    'use strict';

    /**
     * Bootstrap do DataRenderEngine (Loader sem Bundler).
     * Responsável por:
     * - Inferir `basePath` dinamicamente via tag `<script>`.
     * - Carregar módulos (Styles, Utils, Renderers) sequencialmente via injeção de DOM.
     * - Gerenciar fila de execução (`initializationQueue`) para evitar Race Conditions.
     * - Expor API global `window.DataRenderEngine`.
     */

    // --- CONFIGURAÇÃO DOS MÓDULOS (PONTO ÚNICO DE MANUTENÇÃO) ---
    // Este array define a lista ordenada de scripts que compõem o DataRenderEngine.
    //
    // Para adicionar novos PLUGINS, TEMAS ou FUNCIONALIDADES:
    // 1. Adicione uma nova linha neste array na posição desejada (a ordem de carregamento é sequencial).
    // 2. Defina o objeto com:
    //      - path: Caminho relativo do arquivo a partir de DataRenderEngine/ (ex: 'plugins/MeuPlugin.js')
    //      - check (opcional): Nome da variável global ou namespace criado pelo script (ex: 'MeuPlugin' ou 'DataRenderEngine.MeuPlugin').
    //        Isso é usado automaticamente pelo checkModules() para validar o carregamento.
    //
    // Exemplo: { path: 'plugins/NovoRecurso.js', check: 'NovoRecurso' }
    const MODULES_CONFIG = [
        // Core modules
        { path: 'core/DataController.js', check: 'DataController' },
        { path: 'core/ConfigNormalizer.js', check: 'ConfigNormalizer' },
        { path: 'styles/CommonStyles.js', check: 'DataRenderEngine.CommonStyles' },
        { path: 'core/RendererHelpers.js', check: ['RendererUtils', 'DataRenderFactory'] },
        { path: 'utils/ColumnWidthUtils.js' },
        // Theme management
        { path: 'themes/ThemeManager.js', check: 'ThemeManager' },
        { path: 'styles/TableStyles.js', check: 'DataRenderEngine.TableStyles' },
        // Renderers
        { path: 'renderers/table/TableRenderer.js', check: ['TableRenderer', 'BasicTableRenderer'] },
        { path: 'styles/NestedAccordionStyles.js', check: 'DataRenderEngine.NestedAccordionStyles' },
        { path: 'renderers/accordion/AccordionRenderer.js', check: ['NestedAccordionRenderer', 'BasicNestedAccordionRenderer'] },
        { path: 'renderers/custom/CustomRenderer.js', check: 'CustomRenderer' },
        // Plugins
        { path: 'plugins/SearchPlugin.js', check: 'SearchPlugin' },
        { path: 'plugins/SelectionPlugin.js', check: 'SelectionPlugin' },
        { path: 'plugins/ColumnManagerPlugins.js' },
        { path: 'styles/PluginStyles.js' },
        // Types (DevX - opcional, não bloqueia se faltar)
        { path: 'types/index.js' }
    ];

    const currentScript = document.currentScript || document.querySelector('script[src*="DataRenderEngine/index.js"]');
    let basePath = '../static/js/DataRenderEngine';
    if (currentScript) {
        const scriptSrc = currentScript.src || currentScript.getAttribute('src');
        if (scriptSrc) {
            const cleanSrc = scriptSrc.split('?')[0].split('#')[0];
            basePath = cleanSrc.replace(/\/index\.js$/, '');
        }
    }

    const version = currentScript?.dataset?.version || '';
    const versionParam = version ? `?v=${version}` : '';

    /**
     * Carrega automaticamente as dependências obrigatórias (jQuery, Bootstrap, Font Awesome).
     * Injeta as bibliotecas no DOM se não estiverem presentes.
     * @returns {Promise<void>}
     */
    async function loadDependencies() {
        const dependencies = [];

        // Verifica e carrega jQuery
        if (typeof $ === 'undefined' && typeof jQuery === 'undefined') {
            console.info('%c[DataRenderEngine] 📦 Carregando jQuery...', 'color: #2196F3;');
            dependencies.push(loadExternalScript('https://code.jquery.com/jquery-3.6.0.min.js'));
        }

        // Verifica e carrega Bootstrap CSS
        const hasBootstrap = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
            .some(link => link.href.toLowerCase().includes('bootstrap'));
        if (!hasBootstrap) {
            console.info('%c[DataRenderEngine] 📦 Carregando Bootstrap CSS...', 'color: #2196F3;');
            loadExternalCSS('https://cdn.jsdelivr.net/npm/bootstrap@4.6.2/dist/css/bootstrap.min.css');
        }

        // Verifica e carrega Font Awesome
        const hasFontAwesome = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
            .some(link => link.href.toLowerCase().includes('font-awesome') ||
                link.href.toLowerCase().includes('fontawesome'));
        if (!hasFontAwesome) {
            console.info('%c[DataRenderEngine] 📦 Carregando Font Awesome...', 'color: #2196F3;');
            loadExternalCSS('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css');
        }

        // Aguarda carregamento de scripts (CSS é assíncrono e não bloqueia)
        if (dependencies.length > 0) {
            await Promise.all(dependencies);
            console.info('%c[DataRenderEngine] ✅ Dependências carregadas com sucesso!', 'color: #4CAF50; font-weight: bold;');
        }
    }

    /**
     * Carrega um script externo e retorna uma Promise.
     * @param {string} src - URL do script
     * @returns {Promise<void>}
     */
    function loadExternalScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.async = false;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Falha ao carregar: ${src}`));
            document.head.appendChild(script);
        });
    }

    /**
     * Carrega uma folha de estilos externa (não bloqueia execução).
     * @param {string} href - URL do CSS
     */
    function loadExternalCSS(href) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        document.head.appendChild(link);
    }

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const existingScript = document.querySelector(`script[src="${src}"]`);
            if (existingScript) { resolve(); return; }
            const script = document.createElement('script');
            script.type = 'text/javascript';
            script.src = src;
            script.async = false;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Falha ao carregar script: ${src}`));
            document.head.appendChild(script);
        });
    }

    /**
     * Orquestra o carregamento de todos os sub-módulos do motor.
     * Itera sobre a configuração `MODULES_CONFIG` para carregar scripts sequencialmente.
     * Aplica cache-busting via query param `?v=` se disponível no script tag.
     */
    async function loadDataRenderEngine() {
        try {
            // Carrega dependências automaticamente se ausentes
            await loadDependencies();

            // Carrega módulos do motor
            for (const module of MODULES_CONFIG) {
                await loadScript(`${basePath}/${module.path}${versionParam}`);
            }

            initializeDataRenderEngine();
        } catch (error) {
            console.error('DataRenderEngine: Erro ao carregar módulos', error);
            throw error;
        }
    }

    const initializationQueue = [];

    /**
     * Registra callbacks para execução segura após o carregamento total do motor.
     * Implementa padrão Observer para mitigar race conditions onde o script da página
     * carrega antes do motor.
     *
     * @param {Function} initFunction - Função que inicializa o grid/accordion.
     * @param {string} [moduleName] - Validação opcional de dependência (ex: 'BasicTableRenderer').
     */
    function registerInitialization(initFunction, moduleName) {
        if (typeof initFunction !== 'function') {
            console.warn('DataRenderEngine: Tentativa de registrar inicialização com função inválida');
            return;
        }
        initializationQueue.push({
            fn: initFunction,
            module: moduleName
        });
        if (window.DataRenderEngine && window.DataRenderEngine.loaded) {
            executeInitialization({ fn: initFunction, module: moduleName });
        }
    }

    function resolveNamespace(path) {
        if (!path) return undefined;
        const parts = path.split('.');
        let current = window;
        for (const part of parts) {
            if (current === undefined || current === null) return undefined;
            current = current[part];
        }
        return current;
    }

    function isModuleAvailable(moduleName) {
        // Verifica suporte a namespaces (ex: DataRenderEngine.CommonStyles)
        if (moduleName.includes('.')) {
            return typeof resolveNamespace(moduleName) !== 'undefined';
        }

        if (typeof window[moduleName] !== 'undefined') {
            return true;
        }
        try {
            const checkFn = new Function('return typeof ' + moduleName + ' !== "undefined"');
            return checkFn();
        } catch (e) {
            return false;
        }
    }

    function executeInitialization(init) {
        if (init.module && !isModuleAvailable(init.module)) {
            return;
        }
        try {
            init.fn();
        } catch (error) {
            console.error('DataRenderEngine: Erro ao executar inicialização', error);
        }
    }

    function executeAllInitializations() {
        initializationQueue.forEach(executeInitialization);
    }

    /**
     * "Magic Loader": Escaneia o escopo global (`window`) por funções com nomes padronizados
     * (ex: `initializeTable`, `initAccordion`) e as registra automaticamente.
     * Workaround para páginas legadas que não invocam `registerInit` explicitamente.
     */
    function autoDetectInitializations() {
        const initPatterns = [
            'initializeEmptyState',
            'initializeTable',
            'initializeAccordion',
            'initEmptyState',
            'initTable',
            'initAccordion'
        ];
        initPatterns.forEach(pattern => {
            if (typeof window[pattern] === 'function') {
                let moduleName = null;
                if (pattern.includes('Table')) {
                    moduleName = 'BasicTableRenderer';
                } else if (pattern.includes('Accordion') && !pattern.includes('Empty')) {
                    moduleName = 'BasicNestedAccordionRenderer';
                }
                registerInitialization(window[pattern], moduleName);
            }
        });
    }

    function checkDataRenderEngineModules() {
        const modules = {};

        MODULES_CONFIG.forEach(config => {
            if (!config.check) return;

            const checks = Array.isArray(config.check) ? config.check : [config.check];

            checks.forEach(checkKey => {
                // Remove prefixo de namespace para chave do objeto (opcional, mantendo compatibilidade)
                // Ex: DataRenderEngine.CommonStyles -> CommonStyles
                const key = checkKey.split('.').pop();
                modules[key] = isModuleAvailable(checkKey);
            });
        });

        const allLoaded = Object.values(modules).every(loaded => loaded === true);
        return {
            allLoaded,
            modules,
            missing: Object.entries(modules).filter(([_, loaded]) => !loaded).map(([name]) => name)
        };
    }

    /**
     * Função interna para renderização recursiva de componentes.
     * Usada pelo AccordionRenderer para delegar renderização de folhas.
     * 
     * @param {HTMLElement|string} container - Container ou ID do container
     * @param {Array} data - Dados a renderizar
     * @param {Object} config - Configuração normalizada
     * @returns {Object} Instância do renderer criado
     */
    function renderComponent(container, data, config = {}) {
        const containerId = typeof container === 'string' ? container : container.id;

        // Usa ConfigNormalizer se disponível, senão fallback para lógica legada
        let normalizedConfig = config;
        if (typeof window.ConfigNormalizer !== 'undefined' && !config.type) {
            normalizedConfig = window.ConfigNormalizer.normalize(config);
        }

        const type = normalizedConfig.type || 'table';
        const componentConfig = normalizedConfig.config || config;

        if (type === 'accordion') {
            if (typeof window.BasicNestedAccordionRenderer !== 'undefined') {
                return window.BasicNestedAccordionRenderer.render(containerId, data, componentConfig);
            }
        }

        // Custom/HTML component
        if (type === 'custom' || type === 'html') {
            const Renderer = window.DataRenderEngine?.renderers?.CustomRenderer || window.CustomRenderer;
            if (Renderer) {
                return Renderer.render(containerId, data, componentConfig);
            }
        }

        // Default: tabela
        if (typeof window.BasicTableRenderer !== 'undefined') {
            return window.BasicTableRenderer.render(containerId, data, componentConfig.columns, componentConfig);
        }

        console.error('[DataRenderEngine] Nenhum renderer disponível para:', type);
        return null;
    }

    /**
     * Garantia de Retrocompatibilidade
     * Cria shims para variáveis globais legadas, garantindo que código antigo continue funcionando
     * mesmo após a reorganização estrutural dos arquivos.
     */
    function setupBackwardCompatibility() {
        if (typeof window === 'undefined') return;

        // 1. Construir namespace principal DataRenderEngine
        window.DataRenderEngine = window.DataRenderEngine || {};

        // API Principal - Aponta diretamente para o smartRender existente
        // IMPORTANTE: NÃO criar wrapper que chama smartRender pois causaria recursão infinita
        // quando smartRender for re-atribuído para apontar para render
        if (typeof window.RendererUtils !== 'undefined' && typeof window.RendererUtils.smartRender === 'function') {
            window.DataRenderEngine.render = window.RendererUtils.smartRender;
        } else {
            window.DataRenderEngine.render = renderComponent;
        }
        window.DataRenderEngine.renderComponent = renderComponent;

        // Utilitários
        if (typeof window.RendererUtils !== 'undefined') {
            window.DataRenderEngine.Utils = window.RendererUtils;
        }

        // Core
        window.DataRenderEngine.core = {
            DataRenderFactory: window.DataRenderFactory || null,
            ConfigNormalizer: window.ConfigNormalizer || null
        };

        // Renderers
        window.DataRenderEngine.renderers = {
            TableRenderer: window.TableRenderer || null,
            BasicTableRenderer: window.BasicTableRenderer || null,
            AccordionRenderer: window.NestedAccordionRenderer || null,
            NestedAccordionRenderer: window.NestedAccordionRenderer || null,
            CustomRenderer: window.CustomRenderer || null
        };

        // ThemeManager
        if (typeof window.ThemeManager !== 'undefined') {
            window.DataRenderEngine.ThemeManager = window.ThemeManager;
        }

        // 2. SHIMS LEGADOS (Crítico para portais antigos)

        // RendererUtils global
        if (window.DataRenderEngine.Utils) {
            window.RendererUtils = window.DataRenderEngine.Utils;
        }

        // Re-acoplamento do smartRender (apenas se ainda não existir)
        // NÃO reatribuir se já existe, pois DataRenderEngine.render já aponta para ele
        if (window.RendererUtils && !window.RendererUtils.smartRender && window.DataRenderEngine.render) {
            window.RendererUtils.smartRender = window.DataRenderEngine.render;
        }

        // Classes auxiliares globais
        if (window.DataRenderEngine.renderers.TableRenderer) {
            window.TableRenderer = window.DataRenderEngine.renderers.TableRenderer;
        }
        if (window.DataRenderEngine.renderers.BasicTableRenderer) {
            window.BasicTableRenderer = window.DataRenderEngine.renderers.BasicTableRenderer;
        }
        if (window.DataRenderEngine.core.DataRenderFactory) {
            window.DataRenderFactory = window.DataRenderEngine.core.DataRenderFactory;
        }
        if (window.DataRenderEngine.renderers.AccordionRenderer) {
            window.NestedAccordionRenderer = window.DataRenderEngine.renderers.AccordionRenderer;
        }
        if (typeof window.BasicNestedAccordionRenderer !== 'undefined') {
            window.DataRenderEngine.BasicNestedAccordionRenderer = window.BasicNestedAccordionRenderer;
        }
    }

    function initializeDataRenderEngine() {
        if (typeof window === 'undefined') return;
        window.DataRenderEngine = window.DataRenderEngine || {};
        window.DataRenderEngine.checkModules = checkDataRenderEngineModules;
        window.DataRenderEngine.loaded = true;

        // Configurar retrocompatibilidade após carregamento
        setupBackwardCompatibility();

        autoDetectInitializations();
        executeAllInitializations();
        const event = new CustomEvent('DataRenderEngineReady', {
            detail: { DataRenderEngine: window.DataRenderEngine }
        });
        document.dispatchEvent(event);
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function () {
                setTimeout(function () {
                    setupBackwardCompatibility();
                    autoDetectInitializations();
                    executeAllInitializations();
                }, 100);
            });
        } else {
            setTimeout(function () {
                setupBackwardCompatibility();
                autoDetectInitializations();
                executeAllInitializations();
            }, 100);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadDataRenderEngine);
    } else {
        loadDataRenderEngine();
    }

    /**
     * API Pública Global.
     * @namespace window.DataRenderEngine
     * @property {boolean} loaded - Flag indicando se todos os submódulos carregaram.
     * @property {Function} registerInit - Método seguro para inicialização de grids.
     */
    if (typeof window !== 'undefined') {
        window.DataRenderEngine = window.DataRenderEngine || {};
        window.DataRenderEngine.load = loadDataRenderEngine;
        window.DataRenderEngine.registerInit = registerInitialization;
        if (window.DataRenderEngine.loaded) {
            setupBackwardCompatibility();
            autoDetectInitializations();
            executeAllInitializations();
            const event = new CustomEvent('DataRenderEngineReady', {
                detail: { DataRenderEngine: window.DataRenderEngine }
            });
            document.dispatchEvent(event);
        }
    }
})();
