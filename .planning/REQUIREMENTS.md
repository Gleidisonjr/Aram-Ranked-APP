# Requisitos (v1)

## Identificador de requisitos
- Formato: `CAT-XX` (ex.: `AUTH-01`, `SYNC-03`)

## Validados (já implementados / esperados no v1)
### UI / Ranking
- ✓ `UI-01`: O app exibe uma tabela de ranking com ELO, V/D, últimos resultados e win rate.
- ✓ `UI-02`: O app exibe em cards (mobile) e mantém consistência visual com badges/emblemas e tags.
- ✓ `UI-03`: Partidas com `excludeFromStats` são exibidas no histórico mas não influenciam o ranking.

### Partidas e Histórico
- ✓ `MATCH-01`: O app permite criar partidas (admin) definindo `winnerIds`, `loserIds` e `createdAt`.
- ✓ `MATCH-02`: O app permite inverter uma partida (admin) trocando vencedor e perdedor.
- ✓ `MATCH-03`: O app permite remover uma partida do histórico (admin) e marca para não retornar no cálculo.

### Admin gating (segurança leve em front)
- ✓ `AUTH-01`: O visitante não deve ver a UI de admin (sortear/criar/remover/inverter) no GitHub Pages.
- ✓ `AUTH-02`: O admin só fica ativo após login correto (credenciais fixas no front).
- ✓ `AUTH-03`: Ao recarregar/abrir novamente, o login é solicitado novamente (admin é “session in-memory”).

### Persistência e sincronização multi-admin
- ✓ `SYNC-01`: O app carrega `public/ranking.json` e faz merge com dados locais (`localStorage`) para exibir estado completo.
- ✓ `SYNC-02`: Ao registrar/alterar partidas no modo admin, o app envia `players+matches` para um endpoint externo configurado por `VITE_API_BASE`.
- ✓ `SYNC-03`: O endpoint externo grava `public/ranking.json` no repo, tornando as alterações visíveis no GitHub Pages para todos.

## Ativos (a confirmar / melhorias planejadas)
### Robustez / Confiabilidade
- [ ] `ROB-01`: Exibir toast claro quando falhar o envio de sincronização (incluindo “dados salvos localmente”).
- [ ] `ROB-02`: “Recarregar dados do site” (admin) para resolver inconsistências entre abas/dispositivos.
- [ ] `ROB-03`: Deduplicação/controle de concorrência para evitar race conditions no arquivo `public/ranking.json`.

### UX / Acessibilidade
- [ ] `UX-01`: Filtros no histórico (apenas consideradas / apenas excluídas / todas).
- [ ] `UX-02`: Paginação ou virtualização para performance quando o histórico crescer.
- [ ] `A11Y-01`: Melhor foco visível e navegação por teclado nos pills e botões de admin.

## Fora de escopo (v1)
- `OUT-01`: Autenticação profissional com backend (JWT httpOnly, OAuth, etc.).
- `OUT-02`: Multi-admin com contas individuais e permissões complexas.
- `OUT-03`: Banco de dados (Supabase/Firebase) e migrações.

