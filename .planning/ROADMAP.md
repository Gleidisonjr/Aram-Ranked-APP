# Roadmap (v1)

## Visão geral
Este roadmap organiza a evolução do app para suportar admin multi-máquina com atualização compartilhada no **GitHub Pages**, preservando a experiência atual de ranking/histórico.

---

## Phases propostas

### Phase 1 — Admin gating e UI coerente
**Objetivo:** garantir que visitantes não criem partidas e que o admin apareça somente após autenticação.

**Success criteria**
1. Visitante no link normal vê ranking/histórico sem seção de sortear/criar/remover/inverter.
2. Ao acessar “Entrar como administrador”, o modal pede login e só após login admin funções aparecem.

---

### Phase 2 — Sincronização multi-admin no `public/ranking.json`
**Objetivo:** qualquer ação admin atualiza o arquivo do repo de forma que todos vejam o mesmo estado.

**Success criteria**
1. Quando admin cria/inverte/remove uma partida, o histórico do GitHub Pages atualiza e inclui o match.
2. O ranking recalcula corretamente (incluindo regras de `excludeFromStats`).

---

### Phase 3 — Confiabilidade e UX de administração
**Objetivo:** reduzir dúvidas/confusões e aumentar resiliência.

**Success criteria**
1. Toasts e mensagens indicam falhas de sincronização e a origem dos dados.
2. Revisões e melhorias planejadas para race conditions/caching (quando necessário).

