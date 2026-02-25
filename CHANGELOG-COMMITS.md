# Changelog – alterações documentadas por commit

Este documento lista cada alteração feita no projeto, para referência e para commits separados.

---

## 1. Store: IDs de partidas removidas (deleted match ids)
- Adicionar `DELETED_MATCH_IDS_KEY` no store.
- Funções `loadDeletedMatchIds()` e `saveDeletedMatchIds(ids)` para persistir no localStorage os IDs das partidas que o usuário removeu.
- Usado para que, após F5, partidas removidas continuem fora mesmo se o servidor ainda as devolver.

## 2. Store: Merge file + localStorage e filtro de removidas
- Em `mergeRankingData`: união de partidas do arquivo com partidas só no localStorage (ex.: criadas manualmente).
- Inclusão de `localOnly` (partidas que existem só no localStorage).
- Após o merge, filtrar partidas cujo ID está em `loadDeletedMatchIds()` para não reaparecerem após F5.

## 3. Ranking: remover “Adicionar jogador”
- Remover do ranking o bloco com input e botão “Adicionar jogador”.
- Remover event listeners associados ao add-player no ranking.

## 4. Sortear: “Adicionar jogador” na seção Sortear times
- Adicionar na seção Sortear times o bloco com input e botão “Adicionar jogador”.
- Manter a mesma função `addPlayer()` e rerender.

## 5. Sortear: pool de jogadores em ordem do ranking
- Função `playersInRankingOrder(ranking)` para ordenar jogadores como no ranking.
- Área “Jogadores” com pills arrastáveis na ordem do ranking (mais partidas primeiro).

## 6. Sortear: baú (drop zone) para incluir no sorteio
- Área “No sorteio” como drop zone (baú).
- Arrastar pills do pool para o baú para incluir no sorteio.
- Pills no baú com botão × para remover.
- Funções `refreshSortearPool`, `addPlayerPillToBag`, `setupSortearBagDrop`.

## 7. Sortear: mínimo 6 jogadores e hint
- Exigir pelo menos 6 jogadores no baú para permitir “Sortear times”.
- Mensagem de erro: “Coloque pelo menos 6 jogadores no baú do sorteio.”
- Hint simplificado: “Arraste os jogadores para o baú para incluí-los no sorteio (mín. 6).”

## 8. Sortear resultado: cores por equipe e botões dentro dos boxes
- Equipe 1: borda/título azul (sky), botão “Equipe 1 venceu” dentro do box, estilo sky.
- Equipe 2: borda/título âmbar, botão “Equipe 2 venceu” dentro do box, estilo âmbar.
- Botão “Sortear de novo” centralizado abaixo.

## 9. Sortear resultado: últimas partidas (Últimos) em vez de streak
- Trocar “X em sequência” por “Últimos:” + últimas 5 partidas (V/D).
- Remover badge de ELO ao lado do nome; manter emblema do rank.

## 10. Sortear: tags e emblema no pool e no baú
- Tags Líder, Vice-líder, Lanterna nos pills do pool e do baú.
- Emblema do rank (frame) ao lado do nome nos pills.
- Função `sortearPillContent(p, ranking, options)`.

## 11. Sortear resultado: tags e emblema por jogador
- Na lista de jogadores do resultado, emblema + nome + tags (Líder, Vice, Lanterna).
- Linha “Últimos:” com as últimas 5 partidas (V/D).

## 12. Modal Criar partida: emblema e tags (sem ELO)
- No pool e nas linhas do modal, emblema do rank + nome + tags (Líder, Vice, Lanterna).
- Sem caixa de texto de ELO.
- Função `createMatchPlayerContent(p, ranking)` e `refreshCreateMatchPool(formEl, ranking)`.

## 13. Persistência: saveRankingToServer e toast de erro
- Chamar `saveRankingToServer({ players, matches })` após `addMatchFromSortear` e ao criar partida manual.
- Função `persistRankingToServer()` e toast “Falha ao salvar no servidor…” em caso de erro.

## 14. Confirmação antes de registrar vitória
- Ao clicar “Equipe 1 venceu” ou “Equipe 2 venceu”, exibir `confirm('Confirmar resultado? Equipe X venceu. A partida será registrada.')`.
- Só registrar e limpar resultado após confirmação.

## 15. Remoção do overlay pós-vitória
- Remover função `showPostWinOverlay` e todas as chamadas.
- Registrar partida diretamente com `addMatchFromSortear` e limpar resultado (ou fechar modal).
- Remover CSS do overlay (`.post-win-overlay`, etc.).

## 16. Histórico: botão remover partida (×)
- Botão × em cada card do histórico.
- Função `deleteMatch(matchId)`: confirmar, remover da lista, salvar, adicionar ID a `saveDeletedMatchIds`, `persistRankingToServer`, rerender.
- Estilo `.history-match-delete`.

## 17. Histórico: botão inverter resultado (⇅)
- Botão ⇅ em cada card do histórico.
- Função `invertMatch(matchId)`: confirmar, trocar `winnerIds` e `loserIds`, salvar, persistRankingToServer, rerender.
- Estilo `.history-match-invert`.

## 18. Sortear resultado: botão “Inverter times” antes de confirmar
- Botão “⇅ Inverter times” na tela de resultado do sorteio (ao lado de “Sortear de novo”).
- Ao clicar: trocar `dataset.team1Ids` e `dataset.team2Ids`, re-renderizar os dois boxes e reanexar handlers dos botões “Equipe X venceu”.
- Funções `refreshSortearResultTeams()` e `attachSortearWinHandlers()`.

## 19. CSS: estilos do sortear (pool, pill, baú, last, teams)
- `.sortear-pool`, `.sortear-pill`, `.sortear-bag`, `.sortear-bag-pill`, `.sortear-bag-remove`, `.sortear-result-last-wrap`, `.sortear-result-streak`, cores das equipes.

## 20. CSS: estilos do modal Criar partida (emblem, name)
- `.create-match-emblem`, `.create-match-name`, `.create-match-pill` gap, `.edit-match-row` flex.

## 21. CSS: histórico (delete, invert)
- `.history-match-delete`, `.history-match-invert`.

## 22. CSS: toast de erro ao salvar
- `.save-error-toast`, `.save-error-toast.show`.

---

## Commits realizados (agrupados)

As alterações foram commitadas em **7 commits** lógicos (para facilitar review e revert pontual):

1. **docs: add CHANGELOG-COMMITS.md** – Este documento (itens 1–22).
2. **store: add deleted match ids + merge file+local and filter removed matches** – Itens 1–2.
3. **feat: ranking, sortear, create match, persist, history, invert** – Itens 3–18 (main.ts).
4. **style: sortear pool/bag/result, create match, history, toast** – Itens 19–22 (style.css).
5. **chore: exclude src/*-cabare-v1.ts from tsconfig** – Configuração.
6. **data: update ranking.json** – Dados (opcional).

Para obter 20–30 commits separados (um por item), é possível usar `git rebase -i` e “edit” o commit do `main.ts` (e eventualmente do `style.css`) para dividir em vários commits com `git add -p` e mensagens por item.
