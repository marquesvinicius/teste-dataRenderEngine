// Dados hierárquicos simulados (Estado -> Cidade -> Clientes)
const dadosAccordion = [
    // SP - São Paulo
    { ID: 101, NOME: 'João Silva', ESTADO: 'SP', CIDADE: 'São Paulo', CARGO: 'Desenvolvedor', STATUS: 'Ativo', SALARIO: 5500.00 },
    { ID: 102, NOME: 'Maria Souza', ESTADO: 'SP', CIDADE: 'São Paulo', CARGO: 'Designer', STATUS: 'Férias', SALARIO: 4800.50 },
    { ID: 103, NOME: 'Roberto Santos', ESTADO: 'SP', CIDADE: 'Campinas', CARGO: 'Gerente', STATUS: 'Ativo', SALARIO: 12000.00 },
    
    // RJ - Rio de Janeiro
    { ID: 201, NOME: 'Ana Costa', ESTADO: 'RJ', CIDADE: 'Rio de Janeiro', CARGO: 'Analista', STATUS: 'Inativo', SALARIO: 3200.00 },
    { ID: 202, NOME: 'Lucas Lima', ESTADO: 'RJ', CIDADE: 'Niterói', CARGO: 'QA', STATUS: 'Ativo', SALARIO: 4100.00 },
    
    // MG - Minas Gerais
    { ID: 301, NOME: 'Carlos Oliveira', ESTADO: 'MG', CIDADE: 'Belo Horizonte', CARGO: 'DBA', STATUS: 'Ativo', SALARIO: 8500.00 },
    { ID: 302, NOME: 'Fernanda Lima', ESTADO: 'MG', CIDADE: 'Uberlândia', CARGO: 'UX Writer', STATUS: 'Em Análise', SALARIO: 4500.00 },
    
    // Outros
    { ID: 401, NOME: 'Paulo Souza', ESTADO: 'RS', CIDADE: 'Porto Alegre', CARGO: 'DevOps', STATUS: 'Ativo', SALARIO: 9200.00 },
    { ID: 402, NOME: 'Juliana Dias', ESTADO: 'PR', CIDADE: 'Curitiba', CARGO: 'Product Owner', STATUS: 'Bloqueado', SALARIO: 10500.00 },
    { ID: 403, NOME: 'Marcos Rocha', ESTADO: 'PR', CIDADE: 'Londrina', CARGO: 'Tech Lead', STATUS: 'Ativo', SALARIO: 15000.00 }
];

document.addEventListener('DataRenderEngineReady', function() {
    console.log('Motor pronto! Iniciando renderização do Accordion.');

    // Limpa msg de carregamento
    document.getElementById('container-accordion').innerHTML = '';

    /**
     * Configuração do NestedAccordionRenderer
     * 
     * levels: Define a hierarquia de agrupamento.
     *         O motor agrupará os dados automaticamente por 'ESTADO' e depois por 'CIDADE'.
     *         Os itens restantes (folhas) serão exibidos na tabela final.
     */
    RendererUtils.smartRender('container-accordion', dadosAccordion, {
        // Define a estrutura de níveis (Agrupamento)
        levels: ['ESTADO', 'CIDADE'],
        
        persistenceKey: 'accordion-teste-v1',
        primaryColor: '#0056b3', // Cor temática (herda do CSS se não definir, mas bom forçar aqui para exemplo)
        
        // Configurações do Accordion (Pai)
        accordion: {
            showCount: true,      // Mostra contagem de itens no título
            selection: true,      // Habilita seleção em massa (cascata)
            pagination: true,     // Paginação dos grupos de primeiro nível (Estados)
            pageSize: 5           // 5 Estados por página
        },

        // Configurações da Tabela Folha (Filho)
        table: {
            keyField: 'ID',
            selection: true, // Checkboxes na tabela
            actions: [{
                icon: 'fa fa-pencil',
                title: 'Editar',
                onClick: (item) => alert(`Editando cliente ${item.NOME} (${item.ID})`)
            }]
        },

        // Definição das colunas da tabela final (folha)
        columns: [
            { field: 'ID', title: 'Cód', width: '60px', align: 'center' },
            { field: 'NOME', title: 'Nome do Cliente', sortable: true },
            { field: 'CARGO', title: 'Cargo', width: '150px' },
            { field: 'SALARIO', title: 'Salário', type: 'currency', width: '120px' },
            { field: 'STATUS', title: 'Situação', align: 'center', width: '100px', 
              formatter: (val) => TableRenderer.getStatusBadge(val) 
            }
        ]
    });
});
