# Aranked Cabaré (Ranking) — Projeto

## Visão / Objetivo do Projeto
Permitir que usuários visualizem um ranking de partidas com ELO e histórico, e que o modo administrado permita **criar, sortear e corrigir partidas** de forma que o ranking exibido no **GitHub Pages** reflita as alterações para **todos os visitantes**.

## Usuários
- Visitante: visualiza ranking e histórico (read-only).
- Admin: entra com credenciais fixas e gerencia partidas (sortear times, registrar resultado, inverter/remover no histórico).

## Core Value (o “único” que precisa funcionar)
Quando um Admin registrar/alterar uma partida, o `public/ranking.json` do repositório deve ser atualizado e o GitHub Pages deve passar a exibir o ranking/histórico consistentes para todos.

## Restrições / Não-negociáveis
- GitHub Pages é estático: sem backend próprio no Pages.
- A fonte do site é `public/ranking.json`.
- O app local (admin ou não) já mantém persistência em `localStorage`; a sincronização precisa atualizar o arquivo do repositório para “multi-admin”.
- A UI deve continuar com o visual/UX atual (incluindo pills, emblemas e tags).
- Partidas “excluídas do ranking” (ex.: faixa #22+) devem continuar com o comportamento atual: aparecem no histórico, mas não contam para o ranking.

## Modelos de Dados (alto nível)
- `players`: lista de jogadores com `id` e `name` (+ `badge`/tags).
- `matches`: lista de partidas com `id`, `winnerIds`, `loserIds`, `createdAt` e `excludeFromStats`.
- Regras de ranking: calculadas a partir de `players` + `matches` (com `excludeFromStats`).

## Escopo atual (o que este v1 cobre)
- UI: ranking, histórico, comparar jogadores e gráficos.
- Sortear times (admin): drag-and-drop para montar times e registrar resultado.
- Criar partida (admin): modal manual com drag-and-drop/seleção.
- Histórico (admin): botões de inverter/remover.
- Gating do admin: credenciais fixas para habilitar admin, sem expor funções no visitante.
- Sincronização multi-admin: ao executar ações admin, enviar `players+matches` para um endpoint externo configurado por `VITE_API_BASE` e atualizar o `public/ranking.json`.

## Não escopo (Out of Scope para v1)
- Autenticação real com backend (OAuth/2FA) e criptografia de senha no servidor.
- Banco de dados (Supabase/Firebase) e migrações.
- Controle de acesso por papéis/usuários múltiplos reais (admin fixo).

## Status
Este planejamento documenta a evolução atual do app para suportar admin multi-máquina via atualização do `public/ranking.json`.

## Última atualização
*2026-03-26*

