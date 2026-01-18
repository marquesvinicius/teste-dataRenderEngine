/**
 * DataRenderEngine Type Definitions
 * 
 * Este arquivo contém definições JSDoc para melhorar a experiência de
 * desenvolvimento (DevX) com Intellisense em editores compatíveis.
 * 
 * @module types/index
 */

// =============================================================================
// COLUMN TYPES
// =============================================================================

/**
 * @typedef {Object} GridColumn
 * @property {string} field - Nome do campo no objeto de dados
 * @property {string} title - Título exibido no cabeçalho da coluna
 * @property {string} [type] - Tipo de dado para formatação automática.
 *   Valores suportados: 'currency', 'date', 'cpf', 'cnpj', 'phone', 'cep', 
 *   'km', 'boolean_icon', 'badge', 'code', 'card'
 * @property {string} [width] - Largura da coluna (ex: "150px", "auto", "10%")
 * @property {string} [align] - Alinhamento do texto: 'left' | 'center' | 'right'
 * @property {boolean} [sortable=true] - Se a coluna pode ser ordenada
 * @property {boolean} [defaultHidden=false] - Se a coluna inicia oculta
 * @property {Function} [formatter] - Função de formatação personalizada (value, row) => string
 * @property {string} [style] - Estilos CSS inline para a coluna
 */

/**
 * @typedef {'currency'|'date'|'cpf'|'cnpj'|'phone'|'cep'|'km'|'boolean_icon'|'badge'|'code'|'card'|'input'} ColumnType
 */

// =============================================================================
// ACTION TYPES
// =============================================================================

/**
 * @typedef {Object} ActionConfig
 * @property {string} title - Título/tooltip da ação
 * @property {string} [icon] - Classe do ícone FontAwesome (ex: 'fa fa-edit')
 * @property {boolean} [inline=false] - Se exibe inline (botão) ou no menu dropdown
 * @property {Function} onClick - Callback executado ao clicar: (rowData, rowId) => void
 */

// =============================================================================
// TABLE CONFIG
// =============================================================================

/**
 * @typedef {Object} TableConfig
 * @property {string} containerId - ID do elemento DOM container
 * @property {GridColumn[]} columns - Definição das colunas
 * @property {boolean} [pagination=true] - Habilitar paginação
 * @property {number} [pageSize=10] - Quantidade de itens por página
 * @property {string} [keyField='CODIGO'] - Campo que identifica unicamente cada linha
 * @property {boolean} [selection=false] - Habilitar checkboxes de seleção
 * @property {ActionConfig[]} [actions] - Ações disponíveis por linha
 * @property {string} [actionsColumnWidth] - Largura da coluna de ações
 * @property {boolean} [isInAccordion=false] - Se a tabela está dentro de um accordion
 * @property {boolean} [allowSearch=false] - Habilitar plugin de busca
 * @property {boolean} [allowColumnManagement=false] - Habilitar gerenciador de colunas
 * @property {boolean} [debug=false] - Modo debug com logs detalhados
 * @property {string} [primaryColor] - Cor primária do tema
 * @property {string} [persistenceKey] - Chave para persistência de estado (localStorage)
 * @property {Function} [onRowClick] - Callback ao clicar em uma linha: (rowData) => void
 * @property {Function} [onSelectionChange] - Callback ao mudar seleção: (selectedItems) => void
 * @property {Object} [emptyState] - Configuração de estado vazio
 */

/**
 * @typedef {Object} EmptyStateConfig
 * @property {Object} [notFound] - Configuração quando não há dados
 * @property {string} [notFound.title='Nenhum dado encontrado'] - Título
 * @property {string} [notFound.message] - Mensagem descritiva
 * @property {string} [notFound.iconType='enterprise'|'graphic'] - Tipo do ícone SVG
 * @property {Object} [waiting] - Configuração de aguardando filtros
 * @property {string} [waiting.title='Aguardando'] - Título
 * @property {string} [waiting.message] - Mensagem
 */

// =============================================================================
// ACCORDION CONFIG
// =============================================================================

/**
 * @typedef {Object} AccordionConfig
 * @property {string} containerId - ID do elemento DOM container
 * @property {string[]} levels - Campos para agrupamento hierárquico (ordem determina níveis)
 * @property {GridColumn[]} [columns] - Colunas para tabelas folha
 * @property {boolean} [pagination=true] - Habilitar paginação de grupos
 * @property {number} [pageSize=10] - Quantidade de grupos por página
 * @property {string} [keyField='CODIGO'] - Campo identificador único
 * @property {boolean} [selection=false] - Habilitar seleção de grupos/itens
 * @property {boolean} [showCount=true] - Exibir contagem de itens por grupo
 * @property {ActionConfig[]} [actions] - Ações por grupo
 * @property {string} [primaryColor] - Cor primária do tema
 * @property {string[][]} [titleBadges] - Badges a exibir no título por nível
 * @property {Object} [levelConfigs] - Configurações específicas por nível
 * @property {TableConfig} [table] - Configuração das tabelas folha
 * @property {boolean} [keepGroupingColumns=false] - Manter colunas de agrupamento nas tabelas
 * @property {boolean} [debug=false] - Modo debug
 */

/**
 * @typedef {Object} LevelConfig
 * @property {boolean} [selection] - Override de seleção para este nível
 * @property {boolean} [showCount] - Override de contagem para este nível
 * @property {ActionConfig[]} [actions] - Ações específicas deste nível
 * @property {string[][]} [titleBadges] - Badges específicos deste nível
 */

// =============================================================================
// CUSTOM CONFIG
// =============================================================================

/**
 * Configuração para componentes customizados (type: 'custom' ou 'html').
 * Permite injetar HTML estático e/ou executar lógica JS dinâmica.
 * 
 * @typedef {Object} CustomConfig
 * @property {string} [html] - HTML estático para injetar no container
 * @property {Function} [render] - Função de renderização dinâmica: (container, data) => void
 * @property {Function} [destroy] - Função de cleanup opcional chamada ao destruir o componente
 */

// =============================================================================
// RECURSIVE CONFIG (Formato Moderno)
// =============================================================================

/**
 * @typedef {Object} RecursiveConfig
 * @property {'accordion'|'table'|'custom'|'html'} type - Tipo do componente
 * @property {Object|CustomConfig} config - Configuração específica do componente
 * @property {RecursiveConfig} [content] - Componente filho (para aninhamento)
 */

// =============================================================================
// GRID CONFIG (Unificado / Legado)
// =============================================================================

/**
 * Configuração mestra para smartRender.
 * Suporta tanto formato legado quanto recursivo.
 * 
 * @typedef {Object} GridConfig
 * @property {GridColumn[]} [columns] - Definição das colunas
 * @property {string[]} [levels] - Níveis de agrupamento (ativa modo accordion)
 * @property {boolean} [pagination=true] - Habilitar paginação
 * @property {number} [pageSize=10] - Itens por página
 * @property {string} [keyField] - Campo identificador único
 * @property {boolean} [selection=false] - Habilitar seleção
 * @property {ActionConfig[]} [actions] - Ações por linha/grupo
 * @property {boolean} [allowSearch=false] - Plugin de busca
 * @property {boolean} [allowColumnManagement=false] - Plugin gerenciador de colunas
 * @property {boolean} [debug=false] - Modo debug
 * @property {string} [primaryColor] - Cor primária
 * @property {string} [persistenceKey] - Chave de persistência
 * @property {AccordionConfig} [accordion] - Config específica de accordion
 * @property {TableConfig} [table] - Config específica de tabela
 * @property {Object} [emptyState] - Estados vazios
 * @property {Object} [columnStyles] - Estilos por coluna
 * @property {string[]} [visibleColumns] - Filtro de colunas visíveis
 * @property {Function} [onRowClick] - Callback clique na linha
 * @property {Function} [onSelectionChange] - Callback mudança de seleção
 */

// =============================================================================
// PLUGIN TYPES
// =============================================================================

/**
 * @typedef {Object} PluginInstance
 * @property {string} [id] - Identificador do plugin
 * @property {Function} [onInit] - Hook de inicialização
 * @property {Function} [beforeRender] - Hook pré-renderização
 * @property {Function} [onAfterRender] - Hook pós-renderização
 * @property {Function} [mountToolbar] - Hook para adicionar controles na toolbar
 * @property {Function} [destroy] - Cleanup do plugin
 */

// =============================================================================
// DATA TYPES
// =============================================================================

/**
 * Formato de dados backend Vólus (legado).
 * 
 * @typedef {Object} VolusDataPayload
 * @property {Object[]} [Relacao] - Array de dados
 * @property {Object} [Informacoes] - Metadados
 * @property {Object} [Informacoes.Tabela] - Config de tabela do backend
 * @property {Object} [Informacoes.Accordion] - Config de accordion do backend
 */

// =============================================================================
// EXPORT FOR IDE
// =============================================================================

/**
 * Namespace de tipos exportado para consumo por IDEs.
 * @namespace DataRenderEngineTypes
 */
if (typeof window !== 'undefined') {
    window.DataRenderEngineTypes = {
        /** @type {GridColumn} */
        GridColumn: {},
        /** @type {GridConfig} */
        GridConfig: {},
        /** @type {TableConfig} */
        TableConfig: {},
        /** @type {AccordionConfig} */
        AccordionConfig: {},
        /** @type {ActionConfig} */
        ActionConfig: {},
        /** @type {RecursiveConfig} */
        RecursiveConfig: {},
        /** @type {CustomConfig} */
        CustomConfig: {}
    };
}
