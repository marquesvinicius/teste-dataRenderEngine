# 📚 Vólus DataRenderEngine (SmartRender)

O **DataRenderEngine** é a nova arquitetura para renderização de tabelas e accordions no sistema Vólus. Ele substitui as antigas funções monolíticas por um sistema modular, seguro e extensível baseado em **Core + Plugins**.

## 📦 Dependências (Carregadas Automaticamente)

O DataRenderEngine **carrega automaticamente** as seguintes bibliotecas se não estiverem presentes:

- **jQuery 3.6.0** - Manipulação de DOM e eventos
- **Bootstrap 4.6.2 CSS** - Layout e componentes visuais
- **Font Awesome 6.0.0** - Ícones

> ✅ **Portabilidade Total:** Basta incluir o `index.js` e o motor cuidará do resto!

```html
<!-- Apenas isso é necessário! -->
<script src="DataRenderEngine/index.js"></script>
```

**Opcional:** Se preferir gerenciar as dependências manualmente (para controle de versão ou cache), adicione-as antes do motor:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@4.6.2/dist/css/bootstrap.min.css">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
<script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
<script src="DataRenderEngine/index.js"></script>
```

## 🚀 Guia Rápido

Para renderizar uma tabela moderna, utilize o método `smartRender`. Ele gerencia automaticamente a injeção de dependências e configuração.

```javascript
// Exemplo de Uso
RendererUtils.smartRender('div-container-id', dadosDoBackend, {
    // Obrigatório para salvar preferências do usuário (ordem/visibilidade de colunas)
    persistenceKey: 'minha-tela-consulta-v1', 
    
    // Flags de Funcionalidade (Ativadas por padrão)
    allowSearch: true,               // Injeta barra de busca
    allowColumnManagement: true,     // Injeta botão de colunas
    
    // Modo Diagnóstico (Ative se algo der errado)
    debug: false, 

    // Configurações do Core da Tabela
    table: {
        pageSize: 20,
        criticalColumns: ['CARTAO', 'NOME'], // Colunas que nunca escondem
        onRowClick: (item) => abrirDetalhes(item.CODIGO),
        actions: [{
            icon: 'fa fa-edit',
            title: 'Editar',
            onClick: (item) => editarItem(item.CODIGO), // ✅ Função callback
            inline: true
        }]
    }
});

```

### ⚙️ Principais Configurações

| Propriedade | Tipo | Descrição | Padrão |
| --- | --- | --- | --- |
| `allowSearch` | `Boolean` | Ativa o plugin de Busca Rápida na toolbar. Se `false`, remove a lupa. | `true` |
| `allowColumnManagement` | `Boolean` | Ativa o plugin de Gerenciar Colunas. | `true` |
| `persistenceKey` | `String` | **Crítico:** Chave única para salvar colunas no LocalStorage. | `null` |
| `debug` | `Boolean` | Ativa logs detalhados no console para diagnóstico. | `false` |
| `table` | `Object` | Repassa configurações para o `TableRenderer` (paginação, clicks). | `{}` |
| `plugins` | `Array` | Lista manual de plugins (ex: `[new ExportExcelPlugin()]`). | `[]` |

### 📌 Defaults (Tabela e Accordion)

O sistema adota os seguintes valores padrão caso não sejam informados:

*   **selection:** `false` (Seleção desabilitada por padrão)
*   **pageSize:** `10`
*   **pagination:** `true` (Accordion) / Definido por dados (Tabela)
*   **showCount:** `true` (Apenas Accordion)

---

## 🛠 Arquitetura

O sistema foi desenhado para ser **"Não-Invasivo"** e **"Blindado"**.

1. **SmartRender (Facade):** Recebe os dados, resolve configurações e aplica **Dedupe** (garante que nunca existam dois plugins iguais, mesmo que instanciados manualmente).
2. **TableRenderer (Core):** Responsável *apenas* pela estrutura HTML base, paginação e eventos globais. Ele não desenha botões extras.
3. **Plugins:** Injetam funcionalidades (Botões, Inputs) na Toolbar via Hooks.
4. **PluginStyles:** Centraliza o CSS dos plugins para evitar estilos inline e manter governança.

### 🛡️ Segurança e Logs

O Engine possui um sistema de `try/catch` granular.

* **Se um plugin falhar:** A tabela **NÃO** quebra. O erro é capturado e logado no console.
* **Modo Debug:** Ao ativar `debug: true`, o console mostrará o ciclo de vida:
> `[DataRenderEngine] 🔧 SearchPlugin executando 'mountToolbar'`



---

## 🔌 Criando Novos Plugins

Para criar uma nova funcionalidade (ex: Exportar Excel), crie uma classe em `/plugins` seguindo este padrão:

```javascript
// Arquivo: /plugins/ExportExcelPlugin.js
window.ExportExcelPlugin = class ExportExcelPlugin {
    constructor() {
        this.id = 'export-excel'; // ID único obrigatório
    }

    init(tableInstance) {
        this.tableInstance = tableInstance;
    }

    // Hook Principal: Onde você injeta seu botão na Toolbar
    mountToolbar(toolbarContainer) {
        // Use classes com prefixo 'tre-' (TableRenderEngine)
        const btnHtml = `
            <button class="btn btn-success btn-sm tre-btn-export" onclick="...">
                <i class="fa fa-file-excel-o"></i> Excel
            </button>
        `;
        // Injeta no final da toolbar
        toolbarContainer.insertAdjacentHTML('beforeend', btnHtml);
    }
}

```

### 🎨 Governança de CSS

**Não use estilos inline.** Adicione as classes novas no arquivo `/styles/PluginStyles.js`.

* **Prefixo Obrigatório:** Use `.tre-` (Table Render Engine) para evitar conflitos com o CSS legado (`.tr-`).
* ✅ `.tre-search-input`
* ❌ `.search-input`



---

## ⚠️ Solução de Problemas (Troubleshooting)

1. **Barra de busca não aparece:**
* Verifique se `allowSearch` não está `false`.
* Verifique se o arquivo `SearchPlugin.js` foi carregado no `index.js`.


2. **Estilo quebrado ou botão sem hover:**
* Verifique se você definiu o CSS no `PluginStyles.js`.
* Confira se não há `style="..."` inline no HTML bloqueando o CSS.


3. **Preciso debugar em produção:**
* Abra o console do navegador e rode:
```javascript
window.TableInstances['id-do-container'].config.debug = true;
// Force um update para ver os logs
window.TableInstances['id-do-container'].initStructure();

```