// Dados fictícios para teste (agora com SALARIO)
const meusDados = [
    { ID: 1, NOME: 'João Silva', CARGO: 'Desenvolvedor', STATUS: 'Ativo', SALARIO: 5500.00 },
    { ID: 2, NOME: 'Maria Souza', CARGO: 'Designer', STATUS: 'Férias', SALARIO: 4800.50 },
    { ID: 3, NOME: 'Roberto Santos', CARGO: 'Gerente', STATUS: 'Ativo', SALARIO: 12000.00 },
    { ID: 4, NOME: 'Ana Costa', CARGO: 'Analista', STATUS: 'Inativo', SALARIO: 3200.00 },
    { ID: 5, NOME: 'Lucas Lima', CARGO: 'QA', STATUS: 'Ativo', SALARIO: 4100.00 },
    { ID: 6, NOME: 'Carlos Oliveira', CARGO: 'DBA', STATUS: 'Ativo', SALARIO: 8500.00 },
    { ID: 7, NOME: 'Fernanda Lima', CARGO: 'UX Writer', STATUS: 'Em Análise', SALARIO: 4500.00 },
    { ID: 8, NOME: 'Paulo Souza', CARGO: 'DevOps', STATUS: 'Ativo', SALARIO: 9200.00 },
    { ID: 9, NOME: 'Juliana Dias', CARGO: 'Product Owner', STATUS: 'Bloqueado', SALARIO: 10500.00 },
    { ID: 10, NOME: 'Marcos Rocha', CARGO: 'Tech Lead', STATUS: 'Ativo', SALARIO: 15000.00 }
];

// Ouve o evento disparado quando o motor termina de carregar todos os scripts
document.addEventListener('DataRenderEngineReady', function() {
    console.log('Motor pronto! Iniciando renderização.');

    // Limpa msg de carregamento
    document.getElementById('container-tabela').innerHTML = '';

    // Usa a função auxiliar smartRender recomendada no README
    RendererUtils.smartRender('container-tabela', meusDados, {
        persistenceKey: 'tabela-teste-v1', // Chave para salvar preferências
        allowSearch: true,                 // Plugin de busca
        allowColumnManagement: false,      // Plugin de colunas (desativado conforme pedido)
        selection: true,                   // Habilita checkboxes
        
        // Definição explícita das colunas (Necessário pois o motor não infere automaticamente de arrays simples)
        columns: [
            { field: 'ID', title: 'ID', width: '60px', align: 'center' },
            { field: 'NOME', title: 'Nome Completo', sortable: true },
            { field: 'CARGO', title: 'Cargo', sortable: true },
            
            // Exemplo de Formatação Automática de Moeda (type: 'currency')
            { field: 'SALARIO', title: 'Salário', type: 'currency', sortable: true },
            
            { field: 'STATUS', title: 'Status', align: 'center', 
              formatter: (value) => TableRenderer.getStatusBadge(value) 
            }
        ],

        // Configurações específicas da tabela
        table: {
            keyField: 'ID', // Define o campo único (chave primária) dos dados
            pageSize: 10,
            actions: [{
                icon: 'fa fa-eye',
                title: 'Visualizar',
                onClick: (item) => alert('Visualizando: ' + item.NOME + ' - Salário: R$ ' + item.SALARIO),
            }]
        }
    });

    // Renderiza Footer Global Customizado usando RendererUtils
    const totalSalarios = meusDados.reduce((acc, curr) => acc + (curr.SALARIO || 0), 0);
    const totalFormatado = RendererUtils.formatters.currency(totalSalarios);

    RendererUtils.renderGlobalFooter('container-tabela', [
        { label: 'Total de Funcionários', value: meusDados.length },
        { label: 'Folha Salarial Mensal', value: totalFormatado, valueColor: '#28a745' }
    ], { 
        title: 'Resumo Corporativo',    });
});

// Função para exibir itens selecionados em um Modal Bootstrap usando DataRenderEngine
function abrirModalSelecionados() {
    const tableInstance = window.TableInstances['container-tabela'];
    
    if (!tableInstance || !tableInstance.dataController) {
        alert('Tabela não inicializada.');
        return;
    }

    const selecionados = tableInstance.dataController.getSelectedItems();
    const containerId = 'conteudo-modal-selecionados';

    // Abre o modal primeiro
    $('#modalSelecionados').modal('show');

    // Renderiza a tabela somente após o modal estar visível (para calcular larguras corretamente)
    // O uso de .one garante que o evento dispare apenas uma vez por abertura
    $('#modalSelecionados').one('shown.bs.modal', function () {
        const container = document.getElementById(containerId);
        container.innerHTML = ''; // Limpa conteúdo anterior

        if (selecionados.length === 0) {
            container.innerHTML = '<div class="alert alert-info">Nenhum item selecionado.</div>';
            return;
        }

        // Reutiliza o motor para renderizar a tabela do modal
        RendererUtils.smartRender(containerId, selecionados, {
            allowSearch: true,  // Permite filtrar dentro dos selecionados
            allowColumnManagement: false,
            selection: false,
            persistenceKey: null, // Não salva preferências desta tabela temporária
            
            columns: [
                { field: 'ID', title: 'ID', width: '60px', align: 'center' },
                { field: 'NOME', title: 'Nome', sortable: true },
                // Reutilizando formatação no modal
                { field: 'SALARIO', title: 'Salário', type: 'currency', width: '120px' },
                { field: 'STATUS', title: 'Status', align: 'center',
                  formatter: (v) => TableRenderer.getStatusBadge(v)
                }
            ],
            
            table: {
                keyField: 'ID',
                pageSize: 5, // Paginação reduzida para caber no modal
                actions: []  // Sem ações extras
            }
        });
    });
}
