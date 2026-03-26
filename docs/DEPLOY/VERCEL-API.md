# Vercel API (para persistir partidas e atualizar public/ranking.json)

## Objetivo
O GitHub Pages não consegue gravar no repositório. Para que **qualquer admin** em qualquer máquina consiga criar partidas e isso apareça para todos, usamos uma **função externa** hospedada (por exemplo na Vercel).

Essa função recebe `players + matches` e atualiza o arquivo:
- `public/ranking.json`

Depois disso, o GitHub Pages atualiza automaticamente.

## Passo a passo (resumo)

1. Criar **GITHUB_TOKEN** no GitHub (escopo `repo`)
2. Na Vercel:
   - importar o repositório
   - adicionar variáveis:
     - `GITHUB_TOKEN`
     - `GITHUB_REPO`
   - fazer deploy
3. No GitHub (repositório do site):
   - criar variável `VITE_API_BASE` com a **URL** da Vercel (sem barra final)
4. Rodar novamente o workflow **“Deploy to GitHub Pages”**

## Guia completo
- `docs/PASSO-A-PASSO-VERCEL.md`

