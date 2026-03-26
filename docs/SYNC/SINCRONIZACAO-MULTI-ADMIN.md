# Sincronização multi-admin (para partidas aparecerem para todos)

## Por que isso existe
O **GitHub Pages** é estático: ele lê do repositório (`public/ranking.json`) e entrega ao navegador.
Quando alguém cria/edita partidas no modo admin, essas mudanças precisam ser persistidas **no repositório** para que:

- o histórico no site atualize
- o ranking recalculado inclua as novas partidas
- todos os admins/visitantes vejam os mesmos dados

Sem persistência no repositório, as alterações ficam apenas no navegador (ex.: `localStorage`) de quem fez.

## Como funciona no app
O app chama uma API externa via `VITE_API_BASE` sempre que um admin:
- cria partida
- remove partida
- inverte resultado

A API recebe `players + matches` e atualiza o arquivo:
- `public/ranking.json`

Depois disso, o GitHub Pages reflete o novo estado para todos.

## Pré-requisitos
Você precisa de 2 coisas:
1. Um serviço externo hospedando a função `save-ranking` (que atualiza o `public/ranking.json` no GitHub)
2. Uma variável no GitHub para o front saber para onde enviar:
   - `VITE_API_BASE`

## Opção A: Vercel (recomendada por ser mais simples)
Siga: `docs/DEPLOY/VERCEL-API.md`

## Opção B: Cloudflare Workers (alternativa grátis)
Siga: `docs/PASSO-A-PASSO-RANKING-PARA-TODOS.md`

## Como validar que funcionou
1. Entre em modo admin.
2. Crie uma partida.
3. Aguarde o deploy do GitHub Pages.
4. Abra novamente a página (em outra aba/dispositivo) e confirme que o histórico e o ranking atualizaram.

