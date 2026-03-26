# Versões do projeto

## ARAM Ranked 2 (atual — simples)
- **Entry:** `src/main.ts`, `src/store.ts`, `src/types.ts`
- Ranking só com vitórias, derrotas e ELO. Sortear times → escolher Equipe 1 ou 2 vencedora. Sem KDA, sem campeões, sem partida manual.

## Cabaré v1 (pausado — completo)
- **Backup:** `src/main-cabare-v1.ts`, `src/store-cabare-v1.ts`, `src/types-cabare-v1.ts`
- Versão completa com KDA, campeões, partida manual, destaques, recordes, OTP, etc. Código preservado para reutilizar depois.
- Para voltar a usar: copiar os `-cabare-v1.ts` sobre `main.ts`, `store.ts` e `types.ts`, e remover o `exclude` de `tsconfig.json` (e ajustar o que for necessário).
