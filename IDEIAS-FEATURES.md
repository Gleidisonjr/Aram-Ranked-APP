# Ideias de features para o Ranking Cabaré (ARAM com a galera)

Ideias para expandir o ecossistema do ranking com seus amigos.

---

## Já no app
- Ranking V/D, patente (elo LoL), KDA, piques, sequência, conquistas (só no perfil), histórico, temporada, filtro (últimas 10), exportar/imprimir, perfil com conquistas, **sortear times** (quem vai jogar → divide em 2 times aleatórios).
- **Tag “★ Criador”** ao lado do nome de quem criou o ranking (badge no jogador).
- **Print da partida** – Cada partida pode ter um `screenshotUrl` (ex: `/match-prints/m-print-1.png`). No histórico aparece o link “📷 Print” para abrir a imagem em nova aba (prova em caso de dúvida). Salve a imagem em `public/match-prints/` com o nome igual ao `id` da partida e adicione o campo no `ranking.json`.
- **Ícones Data Dragon** – Coluna “Campeão” mostra ícone + nome do campeão mais jogado (Riot CDN, sem API key).
- Partidas são importadas/registradas manualmente via Cursor (ranking.json).

---

## Sugestões para implementar

### Competitivo e metas
- **Desafio do mês** – Meta coletiva (ex: “100 partidas no mês”) com barra de progresso.
- **Rivalidades** – Marcar “rival” entre dois jogadores e destacar o confronto direto (quem ganhou mais quando jogaram um contra o outro).
- **MVP da semana/mês** – Quem mais ganhou ou melhor win rate no período; badge no ranking.
- **Promoção/rebaixamento** – Alertas tipo “1 vitória para subir de divisão” ou “em risco de cair”.
- **Série (best of)** – Registrar “melhor de 3” ou “melhor de 5” e mostrar quem ganhou a série.

### Social e diversão
- **Comentários/trash talk** – Campo de texto por partida ou por jogador (ex: “carregou”, “feedou”) só entre vocês.
- **Memes do grupo** – Seção de frases/ memes que viram “conquista” ou badge (ex: “pegou 0/10 uma vez”).
- **Hall da fama** – Página com recordes: maior sequência de vitórias, mais abates em uma partida, etc.
- **Comparar dois jogadores** – Tela lado a lado: V, D, Win%, KDA, conquistas, “quem ganhou mais quando jogaram juntos”.

### Dados e visão
- **Gráfico de evolução** – Linha do tempo: vitórias acumuladas ou elo ao longo do tempo por jogador.
- **Heatmap** – Que dia/hora a galera mais joga (se guardarem data/hora das partidas).
- **Estatísticas por campeão** – Win rate e quantidade de jogos por campeão (usando os piques que vocês já registram).
- **Previsão “quem está quente”** – Destaque para quem está em sequência de vitórias ou win rate alto na temporada.

### Organização
- **Times fixos (duplas/trios)** – Cadastrar “dupla A”, “dupla B” e ver ranking por dupla ou por trio.
- **Agenda** – “Próxima sessão: sábado 20h” (só exibição, sem notificação).
- **Convite para partida** – Link ou mensagem padrão para mandar no Discord: “Partida do Ranking Cabaré – entrem no lobby”.

### Integração e compartilhamento
- **Bot no Discord** – Comando tipo `!ranking` que responde com o top 5 ou um resumo (precisa de backend).
- **Compartilhar perfil** – Link ou imagem “cartão” do jogador (foto, nome, patente, conquistas) para postar no grupo.
- **Exportar temporada** – Download de um JSON/CSV da temporada para backup ou planilha.

### Gamificação extra
- **Moedas / pontos** – Ganhar pontos por vitória, sequência, conquistas; “loja” simbólica (trocar por título, emoji no nome, etc.).
- **Títulos** – Ex: “Rei do ARAM”, “Suporte do grupo”, “Eternamente Ferro”, exibidos no perfil.
- **Desafios semanais** – “Ganhar 3 com um campeão que nunca usou”, “Fazer 20 assistências em uma partida”; ao completar, desbloqueia badge.
- **Níveis de conta** – XP por partida/jogo; níveis 1–50 com nome (Iniciante, Regular, Veterano, etc.).

### Qualidade de vida
- **Modo escuro/claro** – Toggle de tema (já é escuro; opção clara para de dia).
- **Ordenar colunas** – Clicar no cabeçalho para ordenar por V, D, Win%, KDA, etc.
- **Buscar jogador** – Campo de busca para achar nome na tabela e no histórico.
- **Notas por jogador** – Campo de anotação privada (ex: “só joga de sup”) para lembrar preferências.

---

## Por onde começar
- **Rivalidades** e **Comparar jogadores** – usam dados que vocês já têm.
- **Gráfico de evolução** – melhora muito a sensação de “subir ou descer”.
- **MVP da semana** – simples e gera brincadeira.
- **Comentários/trash talk** por partida – diverte e não exige integração externa.

Se quiser, podemos escolher 1 ou 2 dessas e eu te guio passo a passo na implementação no código.

---

## APIs e dados do League of Legends (simples de usar)

Pesquisa sobre o que existe para trazer dados/visual do LoL sem complicar o projeto.

### 1. Data Dragon (oficial, **sem API key**)
- **O que é:** CDN da Riot com dados estáticos: campeões, itens, runas, ícones.
- **Uso fácil:** Pegar ícone do campeão no “pique” em vez de só texto.
  - Versões: `https://ddragon.leagueoflegends.com/api/versions.json`
  - Lista de campeões: `https://ddragon.leagueoflegends.com/cdn/{version}/data/pt_BR/champion.json`
  - Ícone do campeão: `https://ddragon.leagueoflegends.com/cdn/{version}/img/champion/{id}.png` (ex.: `Aatrox.png`)
- **Ideia no ranking:** Na coluna “Campeão” e no perfil, mostrar a imagem do campeão mais jogado. Autocomplete ao digitar o nome do campeão (usando o JSON) para padronizar nomes.

### 2. Community Dragon (comunitário, **sem API key**)
- **O que é:** Assets extras (ícones, splashes, etc.) organizados por ID.
- **Uso:** Se no Data Dragon faltar algo (ex.: ícone novo), o Community Dragon costuma ter.
- **URL base:** `https://raw.communitydragon.org/latest/...` (ex.: champion-icons).

### 3. Riot API (oficial, **com API key**)
- **Onde:** [developer.riotgames.com](https://developer.riotgames.com) – criar conta e gerar API key (tem rate limit e regras de uso).
- **Endpoints úteis:** summoner-v4 (dados do invocador), match-v5 (histórico de partida), champion-mastery-v4 (maestria de campeão), league-v4 (ranqueada).
- **Complexidade:** Maior: precisa de backend ou proxy para não expor a key; match IDs do ARAM são diferentes do seu “ARAM Cabaré” (partidas customizadas com a galera).
- **Ideia possível (mais trabalhosa):** Vincular “nome no ranking” a “nome no LoL” e mostrar no perfil: ranqueada atual, maestria dos campeões favoritos, etc. Só vale se quiserem investir em backend.

### Sugestões simples para implementar primeiro (sem backend)
1. **Ícones dos campeões (Data Dragon)** – Buscar a versão atual, carregar `champion.json` uma vez, e usar a URL do ícone para o campeão mais jogado e na lista de piques. Só front-end.
2. **Autocomplete de campeão** – Ao registrar pique (ou no Cursor ao editar JSON), sugerir nomes a partir do `champion.json` em PT-BR para evitar “Aatrox” vs “atrox”.
3. **Cartão “campeão do momento”** – Na home ou no perfil, destacar o campeão mais jogado do jogador com nome + ícone (Data Dragon).

Assim o projeto continua simples (sem servidor, sem API key no front) e ganha cara de “LoL” com pouco código.

---

## Mais ideias de features

### Prova e transparência
- **Galeria de prints** – Página ou modal listando todas as partidas que têm print; clicar abre em lightbox.
- **Data/hora no histórico** – Já existe; destacar “há 2 dias” ou “esta semana” para contexto rápido.

### Visual e identidade
- **Ícone do campeão no perfil** – No modal do jogador, listar os campeões mais jogados com ícone (Data Dragon) e win rate por campeão.
- **Cores por time no sortear** – Equipe 1 em verde/azul, Equipe 2 em vermelho/laranja para copiar no chat.
- **Copiar times** – Botão “Copiar” que cola no clipboard os nomes dos dois times formatados para colar no Discord.

### Metas e desafios
- **Contador de partidas da temporada** – Número total em destaque (ex: “47 partidas nesta temporada”).
- **Próximo marco** – “Faltam 3 partidas para 50 nesta temporada”.
- **Desafio “X partidas em uma semana”** – Meta semanal com barra; quem bater ganha destaque ou badge.

### Social
- **Destaque do dia/semana** – Um jogador em evidência (mais vitórias, maior sequência ou sorteio).
- **Pior e melhor KDA da partida** – No histórico, mostrar quem foi MVP e quem “feedou” (baseado em KDA quando existir).
- **Frases épicas** – Campo opcional por partida: “Jogada do jogo”, “Momentos”, para memes depois.

### Técnico
- **PWA / instalar app** – Permitir “Adicionar à tela inicial” no celular para abrir como app.
- **Backup/restore** – Exportar tudo (players + matches) em um JSON e importar em outro dispositivo.
- **Modo offline** – Service worker para ver ranking sem internet (dados já carregados).
