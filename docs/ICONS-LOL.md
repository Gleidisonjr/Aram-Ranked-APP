# Ícones e assets do League of Legends no projeto

O app já usa ícones oficiais do LoL em dois lugares. Você pode reutilizar as mesmas fontes para substituir emojis por ícones mais relacionados ao jogo (abates, mortes, assistências, vitórias, derrotas, etc.).

---

## O que já está integrado

### 1. Ícones de campeões (Data Dragon – Riot CDN)
- **Arquivo:** `src/ddragon.ts`
- **Função:** `getChampionIconUrl(nomeDoCampeao)` → URL da imagem do campeão
- **Fonte:** `https://ddragon.leagueoflegends.com/cdn/{version}/img/champion/{id}.png`
- **Uso:** Coluna “Mais jogado” / “Melhor” no ranking, perfil, histórico de partidas (campeão por jogador)

### 2. Emblemas de patente (ELO) – Community Dragon
- **Arquivo:** `src/ddragon.ts`
- **Função:** `getRankEmblemUrl(patenteTier)` → URL do emblema da patente (Ferro, Bronze, Prata, etc.)
- **Fonte:** `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/ranked-emblem/emblem-{tier}.png`
- **Tiers suportados:** ferro, bronze, prata, ouro, platina, esmeralda, diamante, mestre, grao-mestre, challenger
- **Uso:** Coluna ELO na tabela do ranking (ícone ao lado do texto da patente)

---

## Como usar para mais coisas (substituir emojis)

- **Abates / Mortes / Assistências:** O jogo e o client usam ícones para K/D/A. Eles não estão no Data Dragon público da mesma forma que campeões. Opções:
  - **Community Dragon** – navegar em `https://raw.communitydragon.org/latest/` e procurar por “kills”, “deaths”, “assists” ou “score” nas pastas de imagens do client (ex.: `rcp-fe-lol-static-assets`).
  - **Ícones genéricos de jogos:** usar SVG ou PNG de ícones “skull”, “target”, “hand” em licença livre para representar K/D/A se preferir algo neutro mas temático.

- **Vitória / Derrota:** O client tem ícones de vitória e derrota. Vale procurar em Community Dragon em pastas como `rcp-fe-lol-static-assets` ou `rcp-fe-lol-end-of-game` por “victory”, “defeat”, “win”, “loss”.

- **Outros ícones do client:**  
  https://raw.communitydragon.org/latest/plugins/  
  Listando as pastas você encontra sprites e imagens de UI que podem ser usados com link direto (ex.: ícones de runas, itens, summoner spells). Sempre confira licença de uso para projetos públicos.

---

## Resumo rápido

| Recurso        | Onde está no código | Fonte principal                          |
|----------------|--------------------|------------------------------------------|
| Ícone campeão  | `getChampionIconUrl()` em `ddragon.ts` | Data Dragon (Riot)                       |
| Emblema ELO    | `getRankEmblemUrl()` em `ddragon.ts`   | Community Dragon (ranked-emblem)         |
| K/D/A, V/D     | Ainda em emoji/texto                  | Community Dragon (procurar em plugins)   |

Assim você pode ir trocando, aos poucos, os emojis por ícones do LoL ou de jogos onde fizer sentido.
