# Deploy do GitHub Pages (update do site)

## Quando usar
Sempre que você fizer `commit + push` no repositório (ou quando a API externa atualizar `public/ranking.json`), o GitHub Pages precisa ser reconstruído.

## Passo a passo

1. Abra o repositório no GitHub.
2. Vá em **Settings → Pages**
3. Confirme que **Source** está como **GitHub Actions**.
4. Na aba **Actions**, rode:
   - Workflow: **“Deploy to GitHub Pages”**
   - Clique em **Run workflow**
5. Aguarde ficar verde (jobs `build` e `deploy`).

## Link do site

- `https://<seu-usuario>.github.io/<nome-do-repositorio>/`

Exemplo:
- `https://gleidisonjr.github.io/Aram-Ranked-APP/`

