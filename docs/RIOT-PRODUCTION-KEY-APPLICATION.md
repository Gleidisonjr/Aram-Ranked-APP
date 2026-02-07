# Riot Developer Portal – Production API Key Application

Use the text below when registering your product for a **Production API Key** and **RSO (Riot Sign On)** access. Copy and adapt as needed for the portal form.

---

## Formulário – Campos para copiar e colar

Preencha o formulário do Portal do Desenvolvedor com os valores abaixo. A descrição está em **inglês** e completa para evitar rejeição.

### Nome do produto*

```
ARAM Cabaré – Ranking & Match History
```

### Descrição do produto*

(Copie o bloco abaixo inteiro. É a descrição completa em inglês.)

```
ARAM Cabaré is a League of Legends ARAM ranking and match history tool for a small, private group of friends (about 10–20 players). We regularly play custom ARAM games together and use this product to track results in one place: wins and losses, KDA, champions played, and a simple ranking.

The product is already live. Users paste a match ID (from the in-game client or match history) into the app and click “Search and add match.” Our backend then fetches the match data from the Riot API and adds the game to our internal ranking (winners, losers, picks, KDA). We do not store or expose raw Riot data; we only use it to build our own aggregated stats and history.

Currently we use the Match v5 API (via a server-side proxy on Vercel) to add normal and ranked games by match ID. However, Match v5 returns 404 for custom games, which are most of our games. To support custom matches we need access to the lol-rso-match-v1 API, which includes custom matches when the player is authenticated via Riot Sign On (RSO).

With a Production API Key and RSO we will: (1) Let the user log in with their Riot account (OAuth redirect to Riot, no credentials entered in our app). (2) Use the returned access token to call GET /lol/rso-match/v1/matches/{matchId} and retrieve custom match details. (3) Add those matches to our ranking in the same way we do for normal/ranked games. We will only use the token for this purpose and in line with Riot’s documentation.

APIs we use or will use: Match v5 (match data for normal/ranked by match ID), and lol-rso-match-v1 with RSO (match data for custom games by match ID). We do not use summoner or champion APIs.

The frontend is hosted on GitHub Pages; the API proxy runs on Vercel. The product URL is: [insert your live URL here, e.g. https://gleidisonjr.github.io/Aram-Ranked-APP/ or your Vercel URL]
```

*(Substitua `[insert your live URL here, ...]` pela URL real do seu app antes de enviar.)*

### Grupo de Produtos*

Use o grupo padrão ou crie/selecione um grupo onde o produto ficará. Não é preenchido com texto deste doc.

### URL do produto

Cole a URL pública do app, por exemplo:

- GitHub Pages: `https://gleidisonjr.github.io/Aram-Ranked-APP/`
- ou a URL do deploy na Vercel, se for a que os usuários acessam.

### Foco no jogo do produto*

Selecione: **League of Legends**.

---

## Product name (suggested)

**ARAM Cabaré – Ranking & Match History**

(or the exact name of your app as it appears to users)

---

## Product description (short – for form fields)

**One paragraph (≈150–200 words):**

Our product is a **League of Legends ARAM ranking and match history app** used by a fixed group of friends (e.g. 10–20 players). We run custom ARAM games and want to track results (wins/losses, KDA, champions) in one place.

Today we use the **Match v5 API** with a server-side proxy to add **normal and ranked** games by match ID. We need **Riot Sign On (RSO)** and access to **lol-rso-match-v1** because our games are often **custom matches**. Match v5 returns 404 for custom games; the RSO Match API is the one that includes custom matches when the player is authenticated.

With RSO we will:
- Let the user log in with their Riot account (OAuth).
- Use the returned access token to call **GET /lol/rso-match/v1/matches/{matchId}** so we can fetch **custom** match details.
- Add those matches to our ranking the same way we do for normal/ranked (same UI: “Add match by ID”), without storing passwords—only the token for the session.

The app is already live (frontend on GitHub Pages, API on Vercel). We use the API only to pull match data by ID and build our internal ranking; we do not expose raw Riot data to the public. We will implement the OAuth flow and use the RSO client only for this purpose, in line with Riot’s policies.

---

## Longer description (if the form allows more text)

**What the product does**

- **ARAM ranking app** for a private community (same group of friends). We play custom ARAMs and want a single place to see standings, match history, and stats (KDA, champions).
- **Add matches by Match ID:** the user pastes the match ID (from the client or match history). We fetch match data from the Riot API and add the game to our ranking (winners, losers, picks, KDA). Today this works for **normal/ranked** via Match v5; it does **not** work for **custom** games (404).
- **Why we need RSO:** Custom games are only available through **lol-rso-match-v1**, which requires the **player’s access token** (RSO). We need a Production API Key and an RSO client so we can:
  1. Let the user sign in with Riot (OAuth).
  2. Call `GET /lol/rso-match/v1/matches/{matchId}` with the user’s token to retrieve **custom** match data.
  3. Use that data only to add the match to our internal ranking (same flow as for Match v5).

**Technical setup**

- **Frontend:** Static site (Vite/TypeScript) hosted on GitHub Pages. No Riot credentials in the frontend.
- **Backend:** Serverless API on Vercel. It holds the Riot API key and (for RSO) will perform the token exchange and call the RSO Match API with the user’s token. We do not store Riot passwords; we only use the OAuth access token for the session.
- **Data usage:** We use match data solely to build our ranking (participants, teams, KDA, champions). We do not redistribute raw Riot data; we only show our own aggregated stats and history.

**Audience and scale**

- Small, closed group (on the order of 10–20 players). Not a public or commercial product. Rate limits for a Production key are more than enough for our usage.

**Compliance**

- We will implement RSO according to the documentation provided after approval (OAuth redirect to auth.riotgames.com, token exchange on the server, use of the token only for lol-rso-match-v1). We will not store or misuse player credentials and will follow the Developer Portal policies.

---

## Checklist before submitting

- [ ] Product name filled in (e.g. “ARAM Cabaré – Ranking & Match History”).
- [ ] Short description (one paragraph) copied and adjusted if needed.
- [ ] If the form has a “long description” or “use case” field, use the longer description above.
- [ ] If asked for **data needs**, mention: **Match v5** (already in use) and **lol-rso-match-v1** (custom matches) with **RSO**.
- [ ] If asked for **URL**, use your live app URL (e.g. GitHub Pages or Vercel frontend).
- [ ] Ensure you have a **working prototype** (your current site + “Add match by ID” for normal/ranked) so you can refer to it in the application.

---

## After approval

Once you receive your **Production API Key** and **RSO Client** (Client ID, redirect URI, etc.):

1. Add the Production key to your Vercel env (e.g. `RIOT_API_KEY`) if you use it for Match v5.
2. Implement the RSO OAuth flow (redirect → callback → token exchange) and a backend route that calls `GET /lol/rso-match/v1/matches/{matchId}` with the user’s token.
3. In the app, when the user is logged in via RSO, use the RSO Match API for “Add match by ID” so custom games are supported; keep using Match v5 when RSO is not used or for normal/ranked only.

See `docs/RIOT-API-REMODEL.md` in this repo for the technical context (Match v5 vs lol-rso-match-v1, custom games, and backend architecture).
