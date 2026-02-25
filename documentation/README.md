# Documentação — ARAM Ranked

Este repositório contém **duas versões** do aplicativo ARAM Ranked.

---

## Versão 1 — ARAM Ranked 1 (completa)

- **Pasta:** `aram-ranked-v1/`
- **Código-fonte (backup):** na raiz do repositório:
  - `src/main-cabare-v1.ts`
  - `src/store-cabare-v1.ts`
  - `src/types-cabare-v1.ts`
- **Descrição:** Versão completa com KDA, campeões, partida manual, destaques, recordes, conquistas, sorteio com escolha de campeão, etc.
- **Para rodar a Versão 1:** veja as instruções em `aram-ranked-v1/README.md`.

---

## Versão 2 — ARAM Ranked 2 (simplificada)

- **Pasta:** raiz do repositório (projeto atual)
- **Código-fonte:** `src/main.ts`, `src/store.ts`, `src/types.ts`
- **Descrição:** Versão simplificada: ranking (posição, jogador, ELO, V/D, últimos, Win%), sortear times, histórico, comparar jogadores, gráficos de evolução. Sem KDA nem campeões no fluxo. Partidas a partir da #21 não contam para o ranking (considerar até a partida #20).
- **Para rodar:** na raiz, `npm install` e `npm run dev`.

---

## Resumo

|        | Versão 1 | Versão 2 |
|--------|----------|----------|
| **Onde** | `aram-ranked-v1/` (código em `src/*-cabare-v1.ts`) | Raiz do repo |
| **Ranking** | ELO, V/D, KDA, ratio, campeões | ELO, V/D, Win%, últimos |
| **Sortear** | Com campeões | Só times |
| **Histórico** | Com KDA, expansível | Cards com splash por partida |
| **Partida manual** | Completa (campeões, KDA) | Só vencedores/perdedores |

Nenhum código da Versão 1 foi apagado; está preservado nos arquivos `*-cabare-v1.ts`.
