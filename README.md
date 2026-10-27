# Portal de parametrização contábil

## Executar o projeto local

Recomendado para o corporativo: Python 3.9 ou superior, sem pacotes externos.

```bash
python server.py
```

No Windows, caso o comando seja `py`, use `py server.py`.

Alternativa preservada para quem já usa Node.js 18 ou superior: `npm start`.
Não é necessário instalar dependências para executar nenhuma das opções.

Abra http://localhost:8080. Encerre o servidor com Ctrl+C.

## Layouts em arquivos do projeto

A pasta `layouts/` contém um JSON por layout. O servidor local cria essa pasta se necessário, lê seus arquivos automaticamente e salva as alterações feitas em Gerenciar layouts. Não é necessário escolher uma pasta no navegador.

Os arquivos guardam `id`, `name`, `fields`, `createdAt` e `updatedAt`. As datas são armazenadas em UTC e exibidas no horário de São Paulo. A data de cadastro é mantida nas alterações. Arquivos antigos sem data ficam como “Não registrado”; o sistema não inventa a data original.

O botão Recarregar layouts relê os arquivos do disco. JSONs inválidos são identificados sem impedir a leitura dos demais. Os arquivos podem ser versionados normalmente no Git.

Ao executar apenas `python -m http.server`, abrir o HTML diretamente ou usar a prévia hospedada, o servidor de arquivos do projeto não estará ativo. Nesse modo os layouts ficam no armazenamento do navegador. Para gravar em `layouts/`, use `python server.py` nesta pasta.

## Estrutura

- `server.mjs`: servidor HTTP local, vinculado a 127.0.0.1. Lê e grava apenas os registros de layout do projeto; não se conecta ao MySQL.
- `layouts/*.json`: layouts e datas de controle.
- `dist/`: HTML, CSS, inicialização JavaScript e biblioteca Excel local.
- `dist/js/`: código separado em Models, Views, Controllers, Services, Repositories e utilitários.
- `server.py` e `backend/`: servidor Python e API de layouts.
- `docs/ARQUITETURA.md`: guia dos arquivos e responsabilidades.

## Fluxo e recursos

Selecione LK2 ou VP8, informe o Código de Serviço (até 5 dígitos), escolha um layout e importe as parametrizações.

Layout Excel/CSV: `campo_produto;campo_dataprep;tipo`. A validação usa os campos do produto ou DataPrep e a prévia SQL escreve DataPrep. Tipos STRING, INT, DECIMAL, DATE e DATETIME. Também pode importar/exportar uma cópia JSON de um layout salvo.

Parametrizações: 12 colunas obrigatórias. Empresa fixa NNN.NNN ou NNN/NNN; departamento fixo de 5 dígitos; referências dinâmicas precisam existir nos campos do produto ou DataPrep do layout. Contas fixas com 13 dígitos. ATRIBUTO_VALOR precisa ser numérico.

Apenas campo/operador/valor variam no mesmo Transtype. Alterações nos dados compartilhados são replicadas ao salvar. Nenhuma condição é acrescentada automaticamente. As regras correspondem às condições importadas ou informadas no editor.

Importação alternativa por regra_sql em uma célula: IN, NOT IN, >, >=, <, <=, =; AND/e sem diferenciar caixa. Ausência de conectivo entre condições completas implica AND. AND/E e OR/OU são preservados. Funções e agrupamentos lógicos ainda não são aceitos. Listas sem parênteses na tela, com parênteses no SQL.

Valores de condições STRING são limpos na importação/edição (maiúsculas, sem acentos/pontuação), nunca no MySQL. Nomes de campos Produto/DataPrep preservam a grafia importada e permitem hífen. Tipos e aspas vêm do layout.

Gerar parametrização baixa provisoriamente um Excel das linhas exibidas, com status de revisão e validação. O script de carga SQL definitivo para a esteira ainda depende do esquema das tabelas e das regras de INSERT/UPDATE. O portal não executa SQL nem altera a base.

## API local

- `GET /api/layouts`: lista os arquivos válidos e problemas de leitura.
- `PUT /api/layouts/:id`: valida e grava um layout em JSON, com escrita por arquivo temporário e renomeação.

Os registros são revalidados pelo servidor antes da gravação. O servidor não habilita CORS para outros sites.

SheetJS CE 0.18.5, Apache-2.0. Fontes opcionais do Google Fonts.

## Uma linha por Transtype

A tabela mostra uma linha por Transtype, com os dados compartilhados e todas as condições em uma expressão SQL consolidada. Os indicadores e os filtros de status são por Transtype. A busca que encontra uma condição mantém o Transtype completo no resultado.

Clique na linha para abrir o editor completo. Os dados compartilhados aparecem uma vez; todas as condições podem ser editadas, adicionadas ou removidas na mesma tela. Ao salvar, todas as linhas internas do Transtype são atualizadas juntas. As condições informadas são preservadas ao salvar. Dados divergentes em um Transtype importado são sinalizados; o editor mostra os valores compartilhados do primeiro registro e avisa que serão aplicados a todas as condições ao salvar.

Gerar parametrização baixa o Excel nessa mesma visão: uma linha por Transtype com REGRA consolidada, respeitando os filtros. A expressão usa os campos dataprep, conforme a saída definida. Os modelos de entrada continuam disponíveis nos dois formatos anteriores.

## Exemplo com 33 Transtypes

O exemplo demonstrativo inclui TT001 (recebimento de vendas), TT002 (pagamento a fornecedores), TT003 (tarifas de serviços) e TT004 (ajuste contábil). Há diferenças de empresas, departamentos, contas, períodos, IN/NOT IN e limites de valor. O botão de carregamento manual do exemplo foi removido da interface. Dados importados não são substituídos automaticamente; a atualização automática se aplica apenas ao antigo exemplo demonstrativo.

## Seleção de campos nas condições

CAMPO usa um seletor limitado a campo_produto do layout ativo. Cada condição possui pesquisa para localizar campos. A pesquisa preserva a seleção atual. Nomes inválidos importados pelo Excel continuam visíveis, marcados como não localizados e desabilitados na lista; a correção exige escolher um campo válido. Não há mais digitação livre do nome do campo no editor.

## Pesquisa dentro da lista e disposição do editor

A pesquisa do CAMPO fica dentro da lista, aberta ao clicar no seletor. A lista permite escolher somente campos válidos do produto ou DataPrep do layout e suporta setas e Escape.

No editor aberto ao clicar em um Transtype, os dados compartilhados seguem cinco linhas: Transtype/Descrição; Atributo data/Atributo valor; Empresa; Departamento débito/Departamento crédito; Conta débito/Conta crédito.

Atributo data e Atributo valor também usam o seletor de campos do layout com pesquisa interna. Atributos inválidos importados permanecem sinalizados. O campo Empresa ocupa a largura de uma coluna, mantendo sua linha exclusiva no editor.

## Ordenação e paginação

Clique nos cabeçalhos para alternar a ordenação crescente/decrescente. A ordenação considera números nos códigos (TT2 antes de TT10). A coluna de ação EDITAR não é ordenável.

Escolha 10, 50 ou 100 Transtypes por página e navegue por primeira, anterior, próxima ou última página. Busca, filtros, ordenação e troca do tamanho da página voltam à primeira página. A geração do Excel inclui todos os Transtypes filtrados na ordem selecionada, sem limitar à página atual.

## Projetos e refinamentos

- A tela inicial lista projetos. Cada projeto guarda nome, solicitação, Transtypes, tipo LK2/VP8, serviço, layout e marcações de exclusão. O conjunto anterior é preservado no Projeto inicial.
- Projetos e marcações usam localStorage neste protótipo; são específicos do navegador e não são compartilhados entre usuários. Layouts são compartilhados entre projetos nesse navegador. O servidor local continua salvando layouts em layouts/*.json.
- A coluna Excluir apenas sinaliza; não remove registros. O Excel exportado inclui EXCLUIR (SIM/NÃO) e PROJETO, respeitando pesquisa, filtro e ordenação em todas as páginas.
- As listas pesquisáveis exibem campos de Produto e DataPrep do mapeamento selecionado, com identificação discreta. Ambas as referências são validadas e a expressão escreve campo_dataprep sem crases. Mapeamentos duplicados ou ambíguos são rejeitados no cadastro.
- Empresa e departamentos permitem alternar entre valor fixo e campo pesquisável. Campos inválidos importados permanecem sinalizados; o salvamento do editor exige correção.
- A importação aceita o número da linha de cabeçalho, preservando linhas vazias para contar a posição correta.
- Contas são apresentadas em NNNN.NNN.NNN.NNN e empresa fixa com /; os valores internos permanecem originais.
- Exclusão de layout exige EXCLUIR exato. Vínculos com projetos que possuem parametrizações bloqueiam a exclusão. No modo local, DELETE /api/layouts/:id exige a confirmação e exclui o JSON; a verificação de vínculos é feita no front-end, onde os projetos são armazenados.
- O exemplo contém 33 códigos TT001 a TT033. Nenhuma regra é executada em banco; o botão Gerar parametrização continua produzindo o Excel enquanto o modelo final da esteira não foi definido.

Validação de regressão: `npm test` (projetos, marcações, importação, regras, tipos, paginação e exportação).

As listas pesquisáveis possuem botões Produto e DataPrep para filtrar os campos sem alterar a seleção atual. Ao abrir, exibem o lado do campo selecionado (Produto como padrão). O tipo Valor fixo/Campo do layout fica sempre acima do valor da Empresa e dos departamentos.

Para Empresa e departamentos no modo Campo do layout, a escolha Produto/DataPrep fica somente dentro da lista pesquisável. Trocar o filtro não altera o campo selecionado até escolher uma opção. A Empresa mantém posição e largura ao alternar entre os tipos.

A coluna Piloto permite marcar cada Transtype, independentemente da marcação Excluir. Ambas são persistidas por projeto e acompanham a renomeação do código. As ações Marcar todas/Desmarcar todas se aplicam a todos os Transtypes do projeto, incluindo páginas não exibidas e registros fora dos filtros. O Excel inclui PILOTO e EXCLUIR com SIM/NÃO.

Correção de seleção: o estado do filtro da lista usa um atributo separado dos botões de Produto/DataPrep, evitando que cliques em campos sejam confundidos com a troca de filtro.

A lista permanece aberta ao adicionar condições ou rolar o editor: o foco não desloca a tela e a posição da lista acompanha a rolagem do formulário.

O mapeamento de layout usa `campo_produto;campo_dataprep;tipo`. Arquivos JSON, cabeçalhos Excel/CSV e layouts antigos no navegador com `campo_origem` continuam sendo lidos e convertidos para `campo_produto`. Os modelos e as novas gravações usam apenas o nome novo.

`campo_produto` é opcional; `campo_dataprep` e `tipo` são obrigatórios. Exemplo válido: `;CAMPO_EXEMPLO;STRING`. Excel/CSV também pode omitir a coluna campo_produto. Campos sem produto aparecem apenas na opção DataPrep; layouts somente DataPrep abrem nessa opção.

Na lista pesquisável, o rótulo de cada opção mostra apenas a origem do filtro ativo (Produto ou DataPrep) e o tipo do dado, por exemplo `DataPrep · STRING`, inclusive quando o nome existe nos dois lados.

O operador diferente `<>` está disponível no construtor visual, na importação por colunas e no parser de regras SQL em uma célula.

Cada projeto pode ser excluído na listagem, após digitar EXCLUIR. Isso remove suas parametrizações e marcações do navegador; os layouts compartilhados permanecem. É possível excluir todos os projetos, sem recriar o exemplo ao recarregar. Atributo data e Atributo valor na tabela e no Excel exibem campo_dataprep conforme o mapeamento; a edição conserva as referências selecionadas. A pesquisa e ordenação dos atributos usam os nomes DataPrep apresentados.

### Origem e destino por projeto

Abaixo do Código de Serviço, informe Database - Origem, Tabela - Origem, Database - Destino e Tabela - Destino. Os valores são salvos automaticamente por projeto no navegador. LK2 sugere `db_corp_repositoriosdedados_integracaovarejo_contabil_spec_01` e VP8 sugere `db_corp_gestaodefinancas_integracao_recepcaocontabil_spec_01`; ambos permanecem editáveis. Nomes provisórios de versões anteriores são substituídos pelo padrão ao abrir o projeto. Um destino personalizado é preservado ao trocar o tipo.

## Código organizado

A versão organizada usa indentação de quatro espaços nos arquivos próprios de HTML, CSS, JavaScript, Python e JSON. `dist/xlsx.js` é uma biblioteca de terceiros e foi preservada sem alterações.

O front-end usa separação inspirada em MVC, serviços para regras e Repository para persistência. Não exige compilação, npm install, Git ou internet para funcionar localmente. Os scripts são carregados na ordem declarada no HTML; mantenha a pasta `dist/` completa.

### Verificações

- Backend Python: `python -m unittest discover -s tests -p "test_*.py"`
- Regras e interface JavaScript: `npm test` (apenas para desenvolvimento com Node disponível)

Leia `docs/ARQUITETURA.md` para saber qual arquivo alterar e `LEIA-ME-PRIMEIRO.txt` para começar.

## Atualização de regras e nomes de campos

Não existe mais inclusão automática de ATRIBUTO_VALOR > 0, inclusive ao importar, abrir, trocar o layout ou salvar. Condições que já estavam salvas permanecem para revisão no editor, pois não há registro de quais foram geradas automaticamente em versões anteriores.

Nomes de campos preservam maiúsculas/minúsculas em Excel, CSV, JSON, seleção e saída DataPrep. A comparação para localização e duplicidade continua sem diferenciar maiúsculas/minúsculas. Hífen é permitido após o primeiro caractere. Identificadores DataPrep com hífen usam crases na expressão MySQL para impedir interpretação como subtração; os demais continuam sem crases. Tipos como STRING e INT continuam padronizados.

## Importação de regras com erro e operadores lógicos

Aspas não fechadas, ou um operador lógico seguido de outra condição encontrado dentro de um literal, sinalizam um erro de sintaxe. O portal importa as outras linhas normalmente e mantém o texto original da regra incorreta, marcado como Com alerta. Não corrige nem normaliza esse texto automaticamente.

Abra o Transtype, corrija o Texto original da regra e clique em Revalidar regra. O salvamento fica bloqueado enquanto a sintaxe não for revalidada; após a correção, revise os campos e salve. Os alertas e o texto original persistem por projeto e são incluídos na exportação de revisão.

AND/E e OR/OU são aceitos sem diferenciar caixa. A coluna LÓGICA no editor permite escolher AND ou OR entre condições. A saída usa AND e OR e preserva a ordem, seguindo a precedência nativa SQL (AND antes de OR). Agrupamentos lógicos com parênteses continuam sinalizados para revisão; os parênteses de listas IN/NOT IN são aceitos normalmente. Textos comuns contendo AND ou E, sem formato de outra condição, e apóstrofos escapados com duas aspas continuam válidos.

## Código do layout e informações da parametrização

O cadastro do layout inclui Código do layout, obrigatório para salvar ou baixar uma cópia JSON. O código aceita texto com até 100 caracteres e preserva zeros à esquerda. O JSON de layout usa schemaVersion 3 e inclui `code`. Layouts antigos sem código continuam legíveis; preencha o código ao salvar suas alterações. O identificador técnico `id` continua independente do código informado.

A tela de parametrização possui uma seção Informações da parametrização com Squad e Base de conhecimento. São campos opcionais salvos automaticamente por projeto, com limites de 100 e 2.000 caracteres, respectivamente. Base de conhecimento é informada como código em um campo de texto de uma linha, com o mesmo tamanho visual de Squad.

O filtro **Somente marcadas para piloto** exibe apenas os Transtypes marcados na coluna Piloto; a busca e a geração da parametrização respeitam os registros exibidos.

## Salvamento dos projetos no computador

Ao iniciar com `python server.py`, os projetos e layouts do navegador são salvos automaticamente no arquivo `dados/portal.json`. Abra o mesmo endereço local para recuperar em outro navegador ou janela anônima. A tela mostra se a gravação foi confirmada. O arquivo possui controle de concorrência: se outra janela salvar primeiro, a gravação conflitante é bloqueada e a tela informa o erro. O portal hospedado continua usando o navegador. Faça cópias de segurança da pasta `dados/` e também de `layouts/`; salvar no mesmo computador não protege contra falha ou perda do dispositivo. Na primeira execução local, se não houver arquivo local, os dados do navegador atual serão gravados no arquivo. Se já houver arquivo local, ele é carregado, e eventuais dados diferentes do navegador são preservados em uma cópia no armazenamento do navegador.

O botão Salvar projeto confirma o salvamento no computador quando o servidor Python estiver ativo. Na versão online ele confirma o armazenamento no navegador. Caso haja conflito ou falha no arquivo, informa que a gravação não foi confirmada.
