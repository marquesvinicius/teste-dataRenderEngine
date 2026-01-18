/**
 * ConfigNormalizer - Cérebro da Recursividade
 * 
 * Responsável por detectar e normalizar configurações legadas para o formato
 * recursivo moderno. Permite que o DataRenderEngine suporte aninhamento infinito
 * (Accordion → Tabela → Accordion) via configuração declarativa.
 * 
 * @module core/ConfigNormalizer
 */
class ConfigNormalizer {
    /**
     * Propriedades globais que devem ser herdadas pelos componentes filhos.
     * @type {string[]}
     */
    static INHERITABLE_PROPS = ['keyField', 'persistenceKey', 'debug', 'primaryColor', 'themeColor'];

    /**
     * Normaliza uma configuração para o formato recursivo.
     * 
     * @param {Object} config - Configuração de entrada (pode ser legado ou já recursivo)
     * @returns {Object} Configuração normalizada no formato recursivo
     * 
     * @example
     * // Formato legado com accordion e table no mesmo nível
     * const legacyConfig = {
     *     accordion: { levels: ['DEPARTAMENTO'] },
     *     table: { columns: [...], pageSize: 10 }
     * };
     * 
     * // Resultado após normalização
     * const normalized = ConfigNormalizer.normalize(legacyConfig);
     * // {
     * //   type: 'accordion',
     * //   config: { levels: ['DEPARTAMENTO'] },
     * //   content: { type: 'table', config: { columns: [...], pageSize: 10 } }
     * // }
     */
    static normalize(config) {
        if (!config || typeof config !== 'object') {
            return { type: 'table', config: {} };
        }

        // Se já tem 'type' definido, está no formato recursivo
        if (config.type) {
            return ConfigNormalizer._ensureInheritance(config);
        }

        // Detecção de formato legado
        const hasAccordion = 'accordion' in config || ('levels' in config && Array.isArray(config.levels) && config.levels.length > 0);
        const hasTable = 'table' in config;

        // Caso 1: Formato legado com accordion E table no mesmo nível
        if (hasAccordion && hasTable) {
            const accordionConfig = config.accordion || { levels: config.levels };
            const tableConfig = config.table || {};

            // Extrai propriedades globais para herança
            const globalProps = ConfigNormalizer._extractGlobalProps(config);

            return {
                type: 'accordion',
                config: {
                    ...globalProps,
                    ...accordionConfig
                },
                content: {
                    type: 'table',
                    config: {
                        ...globalProps,
                        ...tableConfig
                    }
                }
            };
        }

        // Caso 2: Apenas accordion/levels (sem table explícito)
        if (hasAccordion) {
            const accordionConfig = config.accordion || {};
            const levels = config.levels || accordionConfig.levels || [];
            const globalProps = ConfigNormalizer._extractGlobalProps(config);

            // Remove propriedades já extraídas para evitar duplicação
            const cleanConfig = { ...config };
            delete cleanConfig.accordion;
            delete cleanConfig.levels;
            ConfigNormalizer.INHERITABLE_PROPS.forEach(prop => delete cleanConfig[prop]);

            return {
                type: 'accordion',
                config: {
                    ...globalProps,
                    ...accordionConfig,
                    levels: levels,
                    ...cleanConfig // Inclui propriedades extras como columns, actions, etc.
                }
            };
        }

        // Caso 3: Assume tabela por padrão
        const globalProps = ConfigNormalizer._extractGlobalProps(config);
        return {
            type: 'table',
            config: {
                ...globalProps,
                ...config
            }
        };
    }

    /**
     * Extrai propriedades globais que devem ser herdadas.
     * @private
     * @param {Object} config - Configuração original
     * @returns {Object} Objeto com apenas as propriedades herdáveis
     */
    static _extractGlobalProps(config) {
        const props = {};
        ConfigNormalizer.INHERITABLE_PROPS.forEach(prop => {
            if (config[prop] !== undefined) {
                props[prop] = config[prop];
            }
        });
        return props;
    }

    /**
     * Garante que propriedades herdáveis sejam propagadas para componentes filhos.
     * @private
     * @param {Object} config - Configuração já no formato recursivo
     * @returns {Object} Configuração com herança aplicada
     */
    static _ensureInheritance(config) {
        if (!config.content) {
            return config;
        }

        // Extrai propriedades do config pai
        const parentProps = ConfigNormalizer._extractGlobalProps(config.config || {});

        // Aplica no filho com precedência para o filho (shallow merge)
        const childConfig = config.content.config || {};
        config.content.config = {
            ...parentProps, // Pai primeiro (menor prioridade)
            ...childConfig  // Filho depois (maior prioridade)
        };

        // Recursivamente aplica nos netos
        if (config.content.content) {
            config.content = ConfigNormalizer._ensureInheritance(config.content);
        }

        return config;
    }

    /**
     * Verifica se uma configuração está no formato recursivo moderno.
     * @param {Object} config - Configuração a verificar
     * @returns {boolean} true se já está no formato recursivo
     */
    static isRecursiveFormat(config) {
        return config && typeof config === 'object' && 'type' in config;
    }

    /**
     * Resolve o tipo de renderizador baseado na configuração.
     * @param {Object} normalizedConfig - Configuração já normalizada
     * @returns {'accordion'|'table'} Tipo do componente raiz
     */
    static getRootType(normalizedConfig) {
        return normalizedConfig?.type || 'table';
    }
}

// Registro global
if (typeof window !== 'undefined') {
    window.ConfigNormalizer = ConfigNormalizer;
}
