# Organização do Portal de Integrações

O portal continua sem etapa de compilação. O navegador executa JavaScript e o Python atende os arquivos e a API local de layouts.

## Responsabilidades

| Arquivo ou pasta                                     | Responsabilidade                                                        |
| ---------------------------------------------------- | ----------------------------------------------------------------------- |
| `dist/index.html`                                    | Estrutura, formulários, diálogos e ordem dos scripts                    |
| `dist/style.css`                                     | Aparência, cores e comportamento responsivo                             |
| `dist/app.js`                                        | Inicialização: carregar dados, renderizar a tela e conectar eventos     |
| `dist/js/models/portal-state.js`                     | Estado da aplicação, exemplos e recuperação de dados existentes         |
| `dist/js/views/portal-view.js`                       | Renderização, tabela, mensagens e seletores de campos                   |
| `dist/js/controllers/portal-controller.js`           | Eventos, navegação, edição, importação e exportação                     |
| `dist/js/services/sql-service.js`                    | Tipos, validação contábil, leitura de regras e geração da expressão SQL |
| `dist/js/services/layout-service.js`                 | Validação, mapeamento e coordenação dos layouts                         |
| `dist/js/services/project-service.js`                | Troca de projetos, salvamento e marcações                               |
| `dist/js/repositories/browser-storage-repository.js` | Acesso ao armazenamento do navegador                                    |
| `dist/js/repositories/layout-api-repository.js`      | Requisições HTTP à API de layouts                                       |
| `dist/js/utils/formatters.js`                        | Identificadores, textos, datas, contas e nomes de campos                |
| `server.py`                                          | Composição e inicialização do servidor Python                           |
| `backend/http_controller.py`                         | Receber HTTP, validar requisições e devolver respostas                  |
| `backend/layout_service.py`                          | Regras e validação do conteúdo de um layout                             |
| `backend/layout_repository.py`                       | Ler, salvar e excluir JSONs com gravação atômica                        |
| `server.mjs`                                         | Servidor Node anterior, mantido como alternativa                        |

## Padrões aplicados

- **Separação inspirada em MVC:** estado nos Models, tela nas Views e interações nos Controllers.
- **Service Layer:** regras contábeis e de layout em arquivos próprios.
- **Repository:** armazenamento do navegador, transporte HTTP e persistência JSON possuem adaptadores específicos.
- **Composition Root:** `app.js` e `server.py` iniciam e conectam as partes.

A refatoração preserva o estado compartilhado do front-end e funções que o consultam. Ela não é uma conversão para módulos ES isolados ou MVC estrito: os scripts clássicos carregam em ordem, sem ferramentas de build, para simplificar o uso offline e a compatibilidade com os dados existentes.

## Onde ficam os dados

Projetos, Transtypes, marcações, Código de Serviço e databases/tabelas continuam no armazenamento do navegador. As chaves e os formatos existentes foram mantidos. Um endereço ou navegador diferente possui outro armazenamento; baixar o código não transfere os dados do portal hospedado.

Com `python server.py`, layouts são lidos e gravados na pasta `layouts/`. Sem a API local, a interface continua com o modo de prévia no navegador. O servidor escuta somente em `127.0.0.1`.

## Como alterar

Para mudar uma regra contábil, comece em `sql-service.js`. Para mudar a apresentação, use `portal-view.js`, HTML ou CSS. Para mudar uma ação de botão, use `portal-controller.js`. Para mudar o armazenamento de layouts, use os repositórios e preserve o contrato JSON da API.

A biblioteca `xlsx.js` está incluída para importar/exportar Excel offline. Não edite esse arquivo: ele é um componente de terceiros.
