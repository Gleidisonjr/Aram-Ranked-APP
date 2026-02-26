# GitHub Pages – deploy e URL

Projeto publicado **apenas no GitHub Pages** (sem Vercel nem outro serviço).

## Botão "Entrar como administrador"

Na barra do topo (ao lado de "Temporada: ...") aparece o botão **"Entrar como administrador"**. Quem clica abre o login (usuário e senha); após entrar, pode sortear times, criar partidas e usar os botões do histórico. Se você não vê o botão: faça **atualização forçada** (**Ctrl+Shift+R** ou **Cmd+Shift+R**) ou abra em aba anônima; o site pode estar em cache.

## Dados no site e vários admins

O site carrega o ranking e as partidas do arquivo **`public/ranking.json`** do repositório. Para que **qualquer pessoa** que use o modo admin (em qualquer máquina) faça alterações que **apareçam para todos** (partidas no histórico e no ranking):

Há dois guias passo a passo (escolha um):
- **Com Vercel (mais rápido):** **`docs/PASSO-A-PASSO-VERCEL.md`** — conectar o repo na Vercel, duas variáveis e pronto.
- **Sem Vercel (Cloudflare Workers):** **`docs/PASSO-A-PASSO-RANKING-PARA-TODOS.md`** — função grátis na Cloudflare que só atualiza o repo.

Se **não** fizer essa configuração, as alterações do modo admin ficam só no navegador de quem fez.

## Dados no site (sem API)

O site usa o arquivo **`public/ranking.json`** do repositório. Sem a API configurada, para o que aparece no site mudar você precisa atualizar esse arquivo no projeto, fazer **commit** e **push**.

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
