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
    //      - path: Caminho relativo do arquivo a partir de DataRenderEngine/ (ex: 'Plugins/MeuPlugin.js')
    //      - check (opcional): Nome da variável global ou namespace criado pelo script (ex: 'MeuPlugin' ou 'DataRenderEngine.MeuPlugin').
    //        Isso é usado automaticamente pelo checkModules() para validar o carregamento.
    //
    // Exemplo: { path: 'Plugins/NovoRecurso.js', check: 'NovoRecurso' }
    const MODULES_CONFIG = [
        { path: 'DataController/DataController.js', check: 'DataController' },
        { path: 'Shared/CommonStyles.js', check: 'DataRenderEngine.CommonStyles' },
        { path: 'Shared/RendererUtils.js', check: ['RendererUtils', 'DataRenderFactory'] },
        { path: 'Utils/ColumnWidthUtils.js' },
        { path: 'Table/TableStyles.js', check: 'DataRenderEngine.TableStyles' },
        { path: 'Table/TableRenderer.js', check: ['TableRenderer', 'BasicTableRenderer'] },
        { path: 'Accordion/NestedAccordionStyles.js', check: 'DataRenderEngine.NestedAccordionStyles' },
        { path: 'Accordion/NestedAccordionRenderer.js', check: ['NestedAccordionRenderer', 'BasicNestedAccordionRenderer'] },
        { path: 'Plugins/SearchPlugin.js', check: 'SearchPlugin' },
        { path: 'Plugins/SelectionPlugin.js', check: 'SelectionPlugin' },
        { path: 'Plugins/ColumnManagerPlugins.js' },
        { path: 'Plugins/PluginStyles.js' }
    ];

    // Dependências Externas (Bootstrap, jQuery, FontAwesome)
    // O motor verificará se já existem na página. Se não, carregará automaticamente.
    const EXTERNAL_DEPENDENCIES = [
        {
            name: 'jQuery',
            type: 'script',
            src: 'https://code.jquery.com/jquery-3.6.0.min.js',
            check: () => typeof window.jQuery !== 'undefined'
        },
        {
            name: 'Bootstrap CSS',
            type: 'style',
            src: 'https://cdn.jsdelivr.net/npm/bootstrap@4.6.2/dist/css/bootstrap.min.css',
            check: () => {
                // Verifica se há algum link com bootstrap no href
                return Array.from(document.querySelectorAll('link')).some(l => l.href.includes('bootstrap'));
            }
        },
        {
            name: 'Bootstrap JS',
            type: 'script',
            src: 'https://cdn.jsdelivr.net/npm/bootstrap@4.6.2/dist/js/bootstrap.bundle.min.js',
            check: () => typeof window.jQuery !== 'undefined' && typeof window.jQuery.fn.modal !== 'undefined'
        },
        {
            name: 'FontAwesome',
            type: 'style',
            src: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
            check: () => Array.from(document.querySelectorAll('link')).some(l => l.href.includes('font-awesome') || l.href.includes('all.min.css'))
        }
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

    function loadStyle(src) {
        return new Promise((resolve, reject) => {
            const existingLink = document.querySelector(`link[href="${src}"]`);
            if (existingLink) { resolve(); return; }
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = src;
            link.onload = () => resolve();
            link.onerror = () => reject(new Error(`Falha ao carregar estilo: ${src}`));
            document.head.appendChild(link);
        });
    }

    async function loadExternalDependencies() {
        for (const dep of EXTERNAL_DEPENDENCIES) {
            if (dep.check && dep.check()) {
                // Já carregado
                continue;
            }
            try {
                if (dep.type === 'script') {
                    await loadScript(dep.src);
                } else if (dep.type === 'style') {
                    await loadStyle(dep.src);
                }
            } catch (error) {
                console.warn(`DataRenderEngine: Aviso - Falha ao carregar dependência opcional ${dep.name}.`, error);
            }
        }
    }

    /**
     * Orquestra o carregamento de todos os sub-módulos do motor.
     * Itera sobre a configuração `MODULES_CONFIG` para carregar scripts sequencialmente.
     * Aplica cache-busting via query param `?v=` se disponível no script tag.
     */
    async function loadDataRenderEngine() {
        try {
            // 1. Carrega dependências externas (se necessário)
            await loadExternalDependencies();

            // 2. Carrega módulos internos
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

    function initializeDataRenderEngine() {
        if (typeof window === 'undefined') return;
        window.DataRenderEngine = window.DataRenderEngine || {};
        window.DataRenderEngine.checkModules = checkDataRenderEngineModules;
        window.DataRenderEngine.loaded = true;
        
        // Mapeamentos legados/explícitos caso necessários
        if (typeof window.RendererUtils !== 'undefined') window.DataRenderEngine.RendererUtils = window.RendererUtils;
        if (typeof window.BasicNestedAccordionRenderer !== 'undefined') window.DataRenderEngine.BasicNestedAccordionRenderer = window.BasicNestedAccordionRenderer;
        
        autoDetectInitializations();
        executeAllInitializations();
        const event = new CustomEvent('DataRenderEngineReady', {
            detail: { DataRenderEngine: window.DataRenderEngine }
        });
        document.dispatchEvent(event);
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function () {
                setTimeout(function () {
                    autoDetectInitializations();
                    executeAllInitializations();
                }, 100);
            });
        } else {
            setTimeout(function () {
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
            autoDetectInitializations();
            executeAllInitializations();
            const event = new CustomEvent('DataRenderEngineReady', {
                detail: { DataRenderEngine: window.DataRenderEngine }
            });
            document.dispatchEvent(event);
        }
    }
})();
