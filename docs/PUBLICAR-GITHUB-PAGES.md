# Subir atualizações e publicar no GitHub Pages (passo a passo)

Este guia mostra como enviar as alterações do projeto para o GitHub e deixar o app publicado no GitHub Pages.

---

## O que já foi feito

- **Commit criado** com as alterações (README + screenshots em `docs/screenshots/`).
- **Remote configurado:** `origin` → `https://github.com/Gleidisonjr/Aram-Ranked-APP.git`
- **Branch:** `main`

O push não foi concluído automaticamente (falha de conexão). Siga os passos abaixo no seu computador.

---

## Passo 1 – Abrir o terminal na pasta do projeto

No **PowerShell** ou **Prompt de Comando**:

```powershell
cd "c:\Users\dopamine\Desktop\Projetos\Ranking Cabaré"
```

Se der problema com o “é” no nome da pasta, use o nome curto:

```powershell
cd c:\Users\dopamine\Desktop\Projetos\RANKIN~1
```

---

## Passo 2 – Enviar as alterações para o GitHub (push)

```bash
git push origin main
```

- Se pedir **usuário e senha:** o GitHub não aceita mais senha comum. Use um **Personal Access Token (PAT)** no lugar da senha.
- Se usar **GitHub CLI** (`gh auth login` já configurado): o `git push` deve usar a autenticação já salva.

**Criar um token (se precisar):**

1. GitHub → **Settings** (do seu usuário) → **Developer settings** → **Personal access tokens** → **Tokens (classic)**.
2. **Generate new token (classic)**.
3. Marque pelo menos o escopo **repo**.
4. Use o token como “senha” quando o Git pedir.

---

## Passo 3 – Ativar o GitHub Pages (se ainda não estiver ativo)

1. Abra o repositório: **https://github.com/Gleidisonjr/Aram-Ranked-APP**
2. Vá em **Settings** (do repositório).
3. No menu lateral, clique em **Pages**.
4. Em **Build and deployment**, em **Source** escolha **GitHub Actions**.

Assim o deploy passa a ser feito pelo workflow que já está no projeto (`.github/workflows/deploy-pages.yml`).

---

## Passo 4 – Conferir o deploy

1. No repositório, abra a aba **Actions**.
2. Deve aparecer o workflow **“Deploy to GitHub Pages”** rodando (ou já concluído).
3. Quando estiver com ícone verde (sucesso), o site estará no ar.

**Link do site:**

```
https://gleidisonjr.github.io/Aram-Ranked-APP/
```

*(Substitua `Gleidisonjr` e `Aram-Ranked-APP` se o seu usuário ou nome do repositório forem outros.)*

---

## Resumo dos comandos (para as próximas vezes)

Sempre que fizer alterações e quiser atualizar o site:

```bash
cd "c:\Users\dopamine\Desktop\Projetos\Ranking Cabaré"

git add .
git status
git commit -m "Descrição do que você alterou"
git push origin main
```

Depois do push, o GitHub Actions faz o deploy sozinho e em alguns minutos o site é atualizado.

---

## Site abre em branco?

Se o link do GitHub Pages abre mas a página fica toda branca:

1. **Confirme qual workflow fez o deploy**
   - Repositório → aba **Actions**.
   - Veja o último workflow que rodou. O nome deve ser **"Deploy to GitHub Pages"** (o do nosso projeto).
   - Se tiver outro workflow (ex.: "Static HTML" ou "Jekyll") que também faz deploy, **desative ou apague** esse arquivo em `.github/workflows/`. O único que deve publicar é o `deploy-pages.yml`, que roda `npm run build` com o base path correto.

2. **Forçar um novo deploy**
   - Em **Actions**, abra o workflow **"Deploy to GitHub Pages"**.
   - Clique em **Run workflow** → **Run workflow** de novo.
   - Espere terminar (ícone verde) e teste o site de novo.

3. **Ver o que está sendo publicado**
   - Na mesma run do workflow, abra o job **build** e o step **"Build for GitHub Pages"**.
   - No log deve aparecer o conteúdo de `dist/index.html`. Confira se os links de script e CSS começam com `/Aram-Ranked-APP/` (ou o nome do seu repositório). Se começarem com `/assets/` sem o nome do repo, o base path não foi aplicado.

4. **Testar no navegador**
   - Abra o site, pressione **F12** (DevTools) → aba **Console**. Veja se aparece algum erro em vermelho.
   - Na aba **Network** (Rede), recarregue a página e veja se algum arquivo (`.js`, `.css`, `ranking.json`) retorna **404**. Se retornar, o caminho está errado.
   - Tente em uma **aba anônima** ou com **cache desativado**, para não carregar uma versão antiga.
