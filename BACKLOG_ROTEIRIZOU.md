# Backlog Roteirizou! — conferência com a conversa e o código

A auditoria preservou os recursos já entregues. Não houve reset dos cadastros nem mudança das chaves legadas de armazenamento. A nomenclatura vigente é Spec e AND/E continua sendo o único conectivo permitido.

| Item | Resultado | Evidência/decisão |
|---|---|---|
| VIS-01 | Aplicado agora | Roteirizou!, ícone de rota branco, grafite, laranja e conteúdo claro. |
| VIS-02 | Aplicado agora | Menu recolhível com preferência local e rótulos acessíveis. |
| VIS-03 | Aplicado agora | Breadcrumb dinâmico com retorno às consultas. |
| VIS-04 | Aplicado agora | Faixa de rascunho e confirmação antes de saída/recarregamento. |
| VIS-05 | Já aplicado; preservado | Campos alinhados e Voltar no topo e rodapé. |
| PAR-01 | Aplicado agora | Busca parcial de código de TT na consulta de parametrizações. |
| PAR-02 | Aplicado agora | Nome, cadastro e atualização, crescente/decrescente antes da paginação. |
| PAR-03 | Já aplicado; preservado | JSON com dados e snapshot do layout. |
| PAR-04 | Já aplicado; preservado | Janela de nome para a cópia, sem duplicidade. |
| PAR-05 | Já aplicado; preservado | Cadastro sem descrição, via menu Cadastrar. |
| PAR-06 | Aplicado agora | Exibir em modo somente leitura e Alterar em ação separada. |
| LIM-01 | Aplicado agora | Botão Baixar modelo com regra removido; importação mantida. |
| LIM-02 | Aplicado agora | Importar planilha removido do menu; Importar Excel permanece na edição para permitir REG-10. |
| LIM-03 | Aplicado agora | Guia do modelo e seu diálogo removidos. |
| LIM-04 | Aplicado agora | Bloco Da planilha à integração e seu botão removidos. |
| LIM-05 | Aplicado agora | Texto Importe uma planilha para começar removido. |
| LIM-06 | Já aplicado; preservado | Novo layout sem inventário de arquivos, seletor de cadastro e exclusão. |
| LIM-07 | Já aplicado; preservado | Sem Nova parametrização na consulta. |
| REG-01 | Aplicado agora | == e => recebem erro com linha e sugestão; regras inválidas mantidas para correção. |
| REG-02 | Já aplicado; mensagens complementadas | IN/NOT IN com ou sem parênteses e erros de lista específicos. |
| REG-03 | Já aplicado; preservado | Validação Produto/Spec; Spec é o nome vigente de DataPrep conforme conversa. |
| REG-04 | Complementado agora | Regra e campo_produto preservados. Saída sem crases; nomes Spec com hífen recebem alerta em vez de gerar SQL inválido. |
| REG-05 | Já aplicado; preservado | Produto opcional com Spec obrigatório. |
| REG-06 | Já aplicado; preservado | Operador <>. |
| REG-07 | Já aplicado; preservado | Filtros piloto e exclusão. |
| REG-08 | Já aplicado; preservado | Checkbox de exclusão lógica, sem remover TTs. |
| REG-09 | Já aplicado; preservado | Contas formatadas e empresa com barra. |
| REG-10 | Já aplicado; preservado | Seleção de aba e linha do cabeçalho. |
| REG-11 | Já aplicado; preservado | Campos de origem/destino e databases definitivos LK2/VP8 editáveis. |
| REG-12 | Complementado agora | EXCLUIR sem diferenciar caixa; vínculos verificados na interface e no servidor Python. |
| REG-13 | Já aplicado; preservado | Data/valor exibidos conforme mapeamento Spec. |
| ADM-01 | Já aplicado; preservado | Parametrizações representam os projetos. |
| ADM-02 | Retirado por solicitação posterior do usuário | Limpeza geral e autorização administrativa removidas. Mantida a exclusão individual em cada componente. |
| ADM-03 | Retirado por solicitação posterior do usuário | Limpeza geral e autorização administrativa removidas. Mantida a exclusão individual em cada componente. |
| ADM-04 | Retirado por solicitação posterior do usuário | Limpeza geral e autorização administrativa removidas. Mantida a exclusão individual em cada componente. |
| ADM-05 | Retirado por solicitação posterior do usuário | Limpeza geral e autorização administrativa removidas. Mantida a exclusão individual em cada componente. |

## Limites explícitos

A limpeza geral e a autorização administrativa foram retiradas por solicitação posterior. Permanecem apenas as exclusões individuais de layouts e parametrizações.

A retirada de crases foi aplicada sem produzir SQL ambíguo: nomes Spec com hífen são preservados no layout, mas precisam de um identificador Spec simples para gerar SQL sem delimitadores. Campo de produto continua aceitando qualquer caractere.

## Verificação

Testes de frontend cobrem vinculação de botões, presença dos controles HTML, rascunhos, confirmação de navegação, modo Exibir, busca/ordenação, parsers SQL e transferência JSON. Testes Python cobrem API, concorrência, migração, nomes duplicados, confirmação de exclusão e isolamento entre projetos. Na prévia do navegador foram conferidos breadcrumb, menu, modo Exibir, aviso de alteração, cancelamento de saída e salvamento.
