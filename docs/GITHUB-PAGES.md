# GitHub Pages – deploy e URL

## Dados no site (GitHub Pages)

O site público usa o arquivo **`public/ranking.json`** do repositório. Para o que você vê na sua máquina aparecer no site: atualize esse arquivo no projeto, faça **commit** e **push**. O deploy do GitHub Pages usa o que está no repo.

---

## URL correta do site

O app é publicado em:

**`https://<seu-usuario>.github.io/<nome-do-repositorio>/`**

Exemplo: se o repositório for `Aram-Ranked-APP` e o usuário `Gleidisonjr`:

- **https://gleidisonjr.github.io/Aram-Ranked-APP/**

A barra no final e o caminho com o nome do repositório são obrigatórios (o build usa esse base path).

---

## Se a página ainda mostra versão antiga

1. **Confirme a origem do GitHub Pages**
   - No repositório: **Settings** → **Pages**
   - Em **Build and deployment** → **Source** deve estar **"GitHub Actions"** (não "Deploy from a branch").
   - Se estiver em branch, o deploy do Actions não é o que aparece no site.

2. **Veja se o último workflow terminou**
   - Aba **Actions** → workflow **"Deploy to GitHub Pages"**
   - O último run deve ter os dois jobs em verde: **build** e **deploy** (não "Skipped").

3. **Cache do navegador**
   - Atualização forçada: **Ctrl+Shift+R** (Windows/Linux) ou **Cmd+Shift+R** (Mac).
   - Ou abra a URL em uma **aba anônima/privada**.

4. **Aguarde 1–2 minutos**
   - Depois do deploy, o GitHub Pages pode levar um pouco para atualizar.

---

## Disparar um novo deploy

- Qualquer **push na branch `main`** dispara o workflow.
- Ou: **Actions** → **Deploy to GitHub Pages** → **Run workflow** → **Run workflow**.
