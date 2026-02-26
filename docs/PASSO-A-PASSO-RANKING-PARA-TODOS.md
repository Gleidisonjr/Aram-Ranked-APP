# Passo a passo: partidas do admin atualizam para todos (só GitHub Pages + 1 função grátis)

O **site** fica 100% no **GitHub Pages**. O GitHub Pages **não pode gravar** nada no repositório; ele só entrega arquivos. Por isso, para que **qualquer pessoa** que use o modo admin (criar partida, sortear) faça alterações que **todos veem**, é preciso **uma função mínima** em outro serviço (grátis) que só **recebe os dados e atualiza o arquivo no GitHub**. Você **não** publica o site nesse serviço — só essa função.

Abaixo: usar **Cloudflare Workers** (grátis, sem cartão) só como essa “ponte”.

---

## Passo 1: Criar um token no GitHub

1. No GitHub, clique na sua **foto** (canto superior direito) → **Settings**.
2. No menu da esquerda, em **Developer settings** → **Personal access tokens** → **Tokens (classic)**.
3. **Generate new token (classic)**.
4. Dê um nome (ex.: `Ranking Cabaré`), marque a permissão **`repo`** e gere.
5. **Copie o token** e guarde em um lugar seguro (ele não aparece de novo).

---

## Passo 2: Conta na Cloudflare (se ainda não tiver)

1. Acesse [cloudflare.com](https://www.cloudflare.com) e crie uma conta (grátis).
2. Não é preciso cadastrar cartão.

---

## Passo 3: Criar o Worker na Cloudflare

1. No painel da Cloudflare, no menu lateral: **Workers & Pages**.
2. **Create** → **Create Worker**.
3. Dê um nome (ex.: `ranking-cabare-save`) e **Deploy**.
4. Clique em **Edit code**.
5. Apague o código que veio e **cole o conteúdo** do arquivo **`docs/cloudflare-worker-save-ranking.js`** do seu projeto (ou use o código que está no fim deste guia).
6. **Save and Deploy**.

---

## Passo 4: Colocar o token e o repositório no Worker

1. No Worker que você criou, vá em **Settings** → **Variables and Secrets**.
2. **Add variable** (ou “Add secret”):
   - **Variable name:** `GITHUB_TOKEN`  
   - **Value:** o token que você copiou no Passo 1  
   - Marque como **Encrypted** (secret).
3. De novo **Add variable**:
   - **Variable name:** `GITHUB_REPO`  
   - **Value:** `Gleidisonjr/Aram-Ranked-APP` (ou `seu-usuario/nome-do-repo`).
4. **Save** e faça **Deploy** de novo se pedir.

---

## Passo 5: Copiar a URL do Worker

1. Na página do Worker, em **Overview**, veja a URL (algo como `https://ranking-cabare-save.seudominio.workers.dev`).
2. **Copie essa URL inteira** (sem barra no final).  
   Essa é a sua **URL da API**. O app vai enviar os dados para `essaURL/api/save-ranking`.

---

## Passo 6: Dizer ao site qual é a URL da API (variável no GitHub)

1. Abra o **repositório** do projeto no GitHub.
2. **Settings** → **Secrets and variables** → **Actions**.
3. Aba **Variables** → **New repository variable**.
4. Nome: **`VITE_API_BASE`**  
   Valor: a URL que você copiou no Passo 5 (ex.: `https://ranking-cabare-save.seudominio.workers.dev`, **sem** barra no final).
5. **Add**.

---

## Passo 7: Fazer o site “nascer” de novo com a variável

1. No repositório, aba **Actions**.
2. Workflow **“Deploy to GitHub Pages”** → **Run workflow** → **Run workflow**.
3. Espere terminar (verde). O site no GitHub Pages passa a usar a URL da API que você configurou.

---

## Pronto

- Quem entra no **link do GitHub Pages** e clica em **“Entrar como administrador”** e faz login pode **criar partidas** e **sortear**.
- Toda vez que um admin **cria, remove ou inverte** uma partida, o site envia os dados para o Worker; o Worker atualiza o arquivo **`public/ranking.json`** no GitHub.
- O GitHub faz um novo deploy do Pages e **todos** que abrirem o link passam a ver o **histórico e o ranking atualizados**.

Se **não** fizer os passos acima (Worker + variável `VITE_API_BASE`), as alterações do admin continuam só no navegador de quem fez.

---

## Código do Worker (para colar no Passo 3)

Se você não tiver o arquivo `cloudflare-worker-save-ranking.js`, use o código abaixo no “Edit code” do Worker:

```js
function base64Encode(str) {
  return btoa(unescape(encodeURIComponent(str)))
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      })
    }
    if (request.method !== 'POST' || !url.pathname.endsWith('save-ranking')) {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    }

    const token = env.GITHUB_TOKEN
    const repo = env.GITHUB_REPO || 'Gleidisonjr/Aram-Ranked-APP'
    if (!token) {
      return new Response(JSON.stringify({ error: 'GITHUB_TOKEN not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    }

    let body
    try {
      body = await request.json()
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    }

    const { players, matches } = body
    if (!Array.isArray(players) || !Array.isArray(matches)) {
      return new Response(JSON.stringify({ error: 'Body must contain players and matches arrays' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    }

    const data = { players, matches }
    const content = JSON.stringify(data, null, 2)
    const contentBase64 = base64Encode(content)
    const auth = token.startsWith('ghp_') ? `Bearer ${token}` : `token ${token}`

    try {
      const getRes = await fetch(
        `https://api.github.com/repos/${repo}/contents/public/ranking.json`,
        { headers: { Authorization: auth } }
      )
      const existing = getRes.ok ? await getRes.json() : null
      const sha = existing?.sha

      const updateRes = await fetch(
        `https://api.github.com/repos/${repo}/contents/public/ranking.json`,
        {
          method: 'PUT',
          headers: { Authorization: auth, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: 'Atualizar ranking (admin)',
            content: contentBase64,
            sha: sha || undefined,
          }),
        }
      )

      if (!updateRes.ok) {
        const err = await updateRes.json().catch(() => ({}))
        return new Response(
          JSON.stringify({ error: err.message || 'Failed to update file on GitHub' }),
          { status: updateRes.status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
        )
      }

      return new Response(JSON.stringify({ ok: true, message: 'Ranking salvo' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Failed to save ranking' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    }
  },
}
```

Salve e faça **Deploy**. Depois siga do Passo 4 em diante.
