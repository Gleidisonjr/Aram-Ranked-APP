# Passo a passo: partidas do admin atualizam para todos (usando Vercel)

O **site** continua no **GitHub Pages**. A Vercel é usada **só** para rodar uma função que recebe os dados do app e atualiza o arquivo `public/ranking.json` no GitHub. Assim, qualquer pessoa que usar o modo admin (criar partida, sortear) faz as alterações aparecerem para todos.

Faça os passos abaixo quando for configurar (pode ser em outro dia).

---

## Passo 1: Criar um token no GitHub

1. No GitHub, clique na sua **foto** (canto superior direito) → **Settings**.
2. No menu da esquerda: **Developer settings** → **Personal access tokens** → **Tokens (classic)**.
3. **Generate new token (classic)**.
4. Dê um nome (ex.: `Ranking Cabaré`), marque a permissão **`repo`** e clique em **Generate token**.
5. **Copie o token** e guarde em um lugar seguro (ele não aparece de novo).

---

## Passo 2: Entrar na Vercel e importar o projeto

1. Acesse [vercel.com](https://vercel.com) e faça login (pode usar “Continue with GitHub”).
2. No painel, clique em **Add New** → **Project**.
3. Na lista de repositórios, escolha o repositório do projeto (ex.: **Aram-Ranked-APP** ou **Ranking-Cabare**) e clique em **Import**.

---

## Passo 3: Configurar o projeto na Vercel

1. Na tela de importação:
   - **Project Name**: pode deixar o que vier (ex.: `aram-ranked-app`).
   - **Root Directory**: deixe em branco (raiz do repositório).
   - **Build Command** e **Output Directory**: podem ficar como estão (o build do front não importa para a função; a pasta `api/` será usada como função).
2. Antes de dar **Deploy**, clique em **Environment Variables** (ou “Configure”) e adicione:

   | Name           | Value                          |
   |----------------|--------------------------------|
   | `GITHUB_TOKEN` | (cole o token do Passo 1)      |
   | `GITHUB_REPO`  | `Gleidisonjr/Aram-Ranked-APP`  |

   (Troque `GITHUB_REPO` pelo seu `usuario/nome-do-repo` se for diferente.)

3. Marque as variáveis para **Production** (e opcionalmente Preview).
4. Clique em **Deploy** e espere terminar.

---

## Passo 4: Copiar a URL do projeto na Vercel

1. Quando o deploy terminar, a Vercel mostra a URL do projeto (ex.: `https://aram-ranked-app.vercel.app` ou `https://aram-ranked-app-xxx.vercel.app`).
2. **Copie essa URL inteira** e **não** coloque barra no final.  
   Exemplo: `https://aram-ranked-app.vercel.app`

---

## Passo 5: Configurar a variável no repositório do GitHub

1. Abra o **repositório** do projeto no GitHub.
2. Vá em **Settings** → **Secrets and variables** → **Actions**.
3. Aba **Variables** → **New repository variable**.
4. **Name:** `VITE_API_BASE`  
   **Value:** a URL que você copiou no Passo 4 (ex.: `https://aram-ranked-app.vercel.app`), **sem** barra no final.
5. Clique em **Add**.

---

## Passo 6: Fazer um novo deploy do GitHub Pages

1. No repositório, aba **Actions**.
2. Workflow **“Deploy to GitHub Pages”** → **Run workflow** → **Run workflow**.
3. Espere o workflow terminar (ícone verde). O site no GitHub Pages passa a usar a URL da Vercel para enviar as partidas.

---

## Pronto

- Quem acessar o **link do GitHub Pages** e entrar como **administrador** (login e senha) pode **criar partidas** e **sortear**.
- Toda vez que um admin **criar, remover ou inverter** uma partida, o app envia os dados para a Vercel; a função atualiza o **`public/ranking.json`** no GitHub.
- O GitHub faz um novo deploy do Pages e **todos** que abrirem o link veem o **histórico e o ranking atualizados**.

O site continua sendo o do **GitHub Pages**; a Vercel só roda essa função em segundo plano.
