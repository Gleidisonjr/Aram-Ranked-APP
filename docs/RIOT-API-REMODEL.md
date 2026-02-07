# Remodelagem: partidas via API da Riot

Este documento descreve como mudar a arquitetura do app para **buscar partidas direto da API da Riot**, usando apenas o **ID da partida** (match ID) que você joga no LoL. As estatísticas (KDA, dano, etc.) passam a vir automáticas, sem depender de print.

---

## Visão geral

- **Hoje:** você manda print da tela de pós-jogo; alguém (ou um processo) preenche o `ranking.json` manualmente ou via ferramenta.
- **Depois:** você informa o **match ID** da partida (e a região, ex.: Brasil = AMERICAS). O app (via um backend) consulta a **Riot Match v5 API**, recebe todos os dados da partida e **cria a partida no ranking** automaticamente, com KDA, campeões, dano e tudo que a API devolver.

**Único passo manual:** enviar o **match ID** (e opcionalmente a região) em algum lugar do app (ex.: campo “Adicionar partida por ID” + botão “Buscar na Riot”).

---

## É possível? Sim

A **Riot Games API** expõe o endpoint **Match v5**:

- **GET** `https://{region}.api.riotgames.com/lol/match/v5/matches/{matchId}`
- **Regiões (routing):** AMERICAS (NA, BR, LAN, LAS), EUROPE, ASIA, SEA.
- Para **Brasil** usa-se o routing **AMERICAS** (o match ID é o mesmo que aparece no cliente/jogos BR).

A resposta traz, entre outros:

- **Participantes:** `riotIdGameName`, `championName`, `kills`, `deaths`, `assists`, `win`, `teamId`
- **Dano:** `totalDamageDealtToChampions`, `totalDamageDealt`, `physicalDamageDealtToChampions`, `magicDamageDealtToChampions`, `trueDamageDealtToChampions`
- **Outros:** `goldEarned`, `totalMinionsKilled`, `visionScore`, `timePlayed`, etc.
- **Times:** `teams[].win` → saber quem ganhou/perdeu.

Ou seja: dá para montar a partida (vencedores, perdedores, picks, KDA e dano) só com esse endpoint.

---

## Partida custom (sala criada por vocês) — qual API usar?

O ARAM de vocês pode ser **custom** (sala criada por vocês) ou **normal/ranqueado**. A API disponível hoje tem uma limitação importante:

| API | Para que serve | Partidas custom? |
|-----|----------------|------------------|
| **[match-v5](https://developer.riotgames.com/apis#match-v5)** (League of Legends) | Buscar partida **por match ID**. Retorna participantes, times, KDA, dano, campeões. **Única API atual** para partidas de LoL. | **Não.** A Match v5 **retorna 404** para partidas personalizadas (custom). Só retorna partidas **normais ou ranqueadas**. ([Issue Riot #472](https://github.com/RiotGames/developer-relations/issues/472)) |
| **match-v4** (deprecada) | Antes era possível buscar custom por ID em `/lol/match/v4/matches/{matchId}`. | Foi **descontinuada** em junho/2021. Não está mais disponível. |
| **[lol-rso-match-v1](https://developer.riotgames.com/apis#lol-rso-match-v1)** (RSO) | **Get match by match id** — lista de IDs e partida por ID. Doc: *"Includes custom matches"*. | **Sim.** Inclui partidas custom. Exige **Riot Sign On**: jogador faz login (OAuth); app usa **token de acesso** do usuário. Endpoints: `GET /lol/rso-match/v1/matches/ids`, `GET /lol/rso-match/v1/matches/{matchId}`. |
| **spectator-v5** | Partida **ao vivo** (spectate). | Não devolve histórico. |

**Conclusão:**  
- **Partidas normais/ranqueadas:** use **match-v5** (como hoje no app).  
- **Partidas custom:** use **lol-rso-match-v1** com **Riot Sign On**: usuário faz login com Riot, o app obtém um access token e chama `GET /lol/rso-match/v1/matches/{matchId}` (Americas). É preciso registrar um **cliente RSO** no Riot Developer Portal (client id, redirect URI), implementar OAuth e um backend que troque o código por token e chame a RSO com o token do usuário.

---

## Limitações importantes

### 1. API key

- Toda requisição à Riot exige **API key** (Riot Developer Portal).
- **Development key:** expira em 24h, boa para testes.
- **Production key:** requer app aprovado pela Riot, maior limite de requisições.

### 2. Chamadas não podem vir do navegador

- A API da Riot **não permite CORS** de origens arbitrárias.
- Se o frontend (Vite/React no GitHub Pages) chamar direto `https://br1.api.riotgames.com/...`, o navegador bloqueia.
- **Conclusão:** é obrigatório ter um **backend** (ou serverless) que:
  - recebe **matchId** (e região),
  - chama a Riot com a API key no servidor,
  - devolve os dados já “traduzidos” para o formato do nosso app.

### 3. Onde fica a API key

- A API key **nunca** deve ir no código do frontend (nem em repositório público).
- Ela fica só no backend (variável de ambiente, ex.: `RIOT_API_KEY`).

---

## Arquitetura sugerida

```
[Frontend (Vite/TS no GitHub Pages)]
    ↓ usuário cola match ID e clica "Buscar"
    ↓ POST /api/match?matchId=BR1_123...&region=americas
[Seu Backend (Node/Express ou serverless)]
    ↓ lê RIOT_API_KEY do ambiente
    ↓ GET https://americas.api.riotgames.com/lol/match/v5/matches/{matchId}
[Riot API]
    ↓ retorna MatchDto (participants, teams, etc.)
[Backend]
    ↓ mapeia para o formato do app (winnerIds, loserIds, picks, kda, damage, etc.)
    ↓ opcional: resolve “nome in-game” → jogador do ranking (mapeamento)
    ↓ retorna JSON
[Frontend]
    ↓ cria a partida no estado (addMatch) e persiste (ex.: atualiza ranking.json ou envia para backend salvar)
```

- **Persistência:** pode continuar sendo arquivo (`ranking.json`) atualizado pelo backend, ou um banco; o frontend pode só “adicionar a partida” em memória + localStorage e o backend sincronizar, conforme você quiser evoluir.

---

## Mapeamento Riot → nosso modelo

Nosso tipo de partida hoje (resumido):

- `winnerIds`, `loserIds` (IDs dos jogadores do app)
- `picks`: `{ playerId, champion }`
- `kda`: `{ playerId, kills, deaths, assists }`
- `createdAt`

Da Riot temos por participante:

- Identidade: `puuid`, `riotIdGameName` (ou `summonerName`)
- `teamId`, `win` → definir vencedores e perdedores
- `championName` → pick
- `kills`, `deaths`, `assists` → KDA
- `totalDamageDealtToChampions`, etc. → dano (para novas estatísticas)

**Problema:** nosso app usa `player.id` (ex.: `p-4-prq-lulu`); a Riot devolve **nome in-game** (ex.: `PRQ Lulu`). Precisamos de uma forma de **ligar** nome Riot → jogador do ranking:

1. **Por nome:** comparar `riotIdGameName` (ou `summonerName`) com `player.name` (ignorando case/acentos). Se bater, usa esse `player.id`.
2. **Tabela de mapeamento:** configuração (no app ou no backend) do tipo “nome in-game X = jogador Y do ranking”. Primeira vez que aparecer um nome novo, pode-se criar jogador ou pedir ao usuário para vincular.

Sugestão: começar com **match por nome**; depois evoluir para mapeamento explícito se precisar.

---

## Onde pegar o match ID

- No cliente do LoL, após a partida, na tela de **estatísticas** / **histórico**, às vezes é possível ver o ID (depende da interface).
- Em sites que usam a Riot API (ex.: op.gg, u.gg) o match ID aparece na URL da partida.
- Formato típico: string longa, ex. `BR1_1234567890123456789` (região + número).

O usuário **copia** esse ID e **cola** no campo “Adicionar partida por ID” no app.

---

## Passos para implementar (resumido)

1. **Backend**
   - Criar um serviço (Node/Express, Vercel/Netlify Function, etc.) com uma rota, ex.: `GET/POST /api/match?matchId=...&region=americas`.
   - No servidor, chamar a Riot: `GET https://americas.api.riotgames.com/lol/match/v5/matches/{matchId}` com header `X-Riot-Token: <RIOT_API_KEY>`.
   - Tratar 404 (partida não existe), 403 (key inválida), 429 (rate limit).
   - Mapear a resposta para um JSON no formato que o frontend já usa (winnerIds, loserIds, picks, kda, createdAt e, se quiser, damage por jogador).

2. **Mapeamento de jogadores**
   - No backend (ou no frontend com os dados já em mão): para cada `participant`, usar `riotIdGameName` (ou `summonerName`) para achar o `player.id` no ranking (por nome ou por tabela de mapeamento). Se não achar, pode retornar “jogador X não encontrado” e não criar a partida, ou criar jogador novo conforme regra definida.

3. **Frontend**
   - Nova UI: campo “Match ID”, seletor de região (default AMERICAS para BR), botão “Buscar partida na Riot”.
   - Ao clicar: chamar o **seu backend** (`/api/match?matchId=...&region=...`), receber o JSON da partida, chamar `addMatch(...)` (ou equivalente) e atualizar estado + persistência (localStorage / enviar para backend salvar em `ranking.json` ou DB).

4. **Tipos e estatísticas extras**
   - Estender `Match` e a UI para incluir dano (e o que mais quiser) por jogador; o backend já pode enviar isso no JSON a partir dos campos da Riot (`totalDamageDealtToChampions`, etc.).

5. **Segurança e limites**
   - API key só no backend; rate limit da Riot (20 req/s para development, outros para production); validar `matchId` no backend (formato, tamanho) para evitar abuso.

---

## Deploy da API no Vercel (app continua no GitHub Pages)

O app continua sendo publicado no **GitHub Pages** como hoje. A API fica em um deploy à parte no **Vercel** (gratuito), e o app no GitHub Pages só chama essa URL quando você usa “Adicionar partida (Riot API)”.

1. **Criar conta e projeto no Vercel**
   - Acesse [vercel.com](https://vercel.com), crie conta (pode ser com GitHub).
   - **Add New** → **Project** → importe o **mesmo repositório** do app (ex.: Aram-Ranked-APP).
   - Root: deixe a raiz do repositório (não mude).
   - **Build Command:** `npm run build` | **Output Directory:** `dist` (já vêm preenchidos pelo `vercel.json` do projeto).

2. **Configurar a API key da Riot**
   - No projeto no Vercel: **Settings** → **Environment Variables**.
   - Nome: `RIOT_API_KEY` | Valor: sua API key ( [Riot Developer Portal](https://developer.riotgames.com/) → Create API Key ).
   - Marque **Production** (e opcionalmente Preview) e salve.

3. **Fazer o deploy**
   - **Deploy** (ou um novo push no repositório). Ao terminar, o Vercel mostra a URL do projeto, ex.: `https://aram-ranked-app-xxx.vercel.app`.

4. **Configurar a URL no app**
   - Abra o app no **GitHub Pages** (ou local).
   - Na seção **“Adicionar partida (Riot API)”**, no campo **“URL do proxy”**, cole a URL do Vercel (ex.: `https://aram-ranked-app-xxx.vercel.app`), **sem** barra no final.
   - A URL fica salva no navegador (localStorage). A partir daí, “Buscar e adicionar partida” usa essa API.

**Resumo:** você passa a ter dois “deploys”: o **site** no GitHub Pages (como hoje) e a **API** no Vercel. Quem só abre o link do GitHub Pages continua usando o app normalmente; quem quiser usar “Adicionar partida por Match ID” precisa que você tenha feito o deploy no Vercel e configurado a URL do proxy uma vez no app.

---

## Referências

- [Riot Developer Portal – APIs](https://developer.riotgames.com/apis)
- [Match v5 – Get match by ID](https://developer.riotgames.com/api-details/match-v5): documento oficial do endpoint e do `MatchDto` / `ParticipantDto`.
- Regiões: AMERICAS (BR, NA, LAN, LAS), EUROPE, ASIA, SEA.

---

## Resumo

- **Sim, é possível** trazer as partidas direto da Riot usando só o match ID.
- **Backend é obrigatório** (para API key e CORS).
- **Único input manual** é o **match ID** (e região); o resto (KDA, dano, campeões, V/D) sai da API.
- Este doc serve como plano para a remodelagem; a implementação pode ser feita em fases (primeiro backend + criar partida com KDA; depois mapeamento de jogadores; por último dano e extras na UI).
