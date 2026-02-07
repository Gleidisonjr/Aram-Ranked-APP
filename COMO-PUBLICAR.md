# Como publicar o Ranking Cabaré e compartilhar o link com os amigos

Para que qualquer pessoa acesse o ranking pela internet (e você possa mandar o link no grupo), é preciso **publicar** o projeto em um serviço de hospedagem. Abaixo estão opções gratuitas e simples.

---

## 1. Gerar a pasta pronta para publicar

No terminal, na pasta do projeto, rode:

```bash
npm run build
```

Isso gera a pasta **`dist`** com tudo que o site precisa. Essa pasta é a que você vai enviar para o serviço de hospedagem.

---

## 2. Onde publicar (escolha uma opção)

### Opção A – Netlify (bem simples)

1. Acesse [netlify.com](https://www.netlify.com) e crie uma conta (pode ser com GitHub ou e-mail).
2. Arraste a pasta **`dist`** (a que o `npm run build` gerou) na área **“Drag and drop your site output folder here”** na tela inicial do Netlify.
3. Em alguns segundos o Netlify gera um link, tipo:  
   `https://nome-aleatorio-123.netlify.app`
4. Esse é o link que você manda pros amigos. Eles abrem e acessam o ranking.

**Atualizar o ranking depois:** sempre que mudar algo (ou atualizar o `ranking.json`), rode de novo `npm run build`, entre no mesmo site no Netlify e arraste de novo a pasta `dist` em cima da área de deploy. O link continua o mesmo.

---

### Opção B – Vercel

1. Acesse [vercel.com](https://vercel.com) e crie uma conta (pode ser com GitHub).
2. Instale o Vercel no computador (uma vez só):  
   `npm i -g vercel`
3. Na pasta do projeto, rode:  
   `vercel`
4. Siga as perguntas (pode apertar Enter nas opções padrão).
5. No final o Vercel mostra um link, tipo:  
   `https://ranking-cabare-xxx.vercel.app`
6. Esse é o link para compartilhar.

**Atualizar:** rode de novo `vercel` na pasta do projeto (ou conecte o projeto ao GitHub e o Vercel atualiza sozinho a cada push).

---

### Opção C – GitHub Pages (ideal para compartilhar no Discord)

O projeto já está preparado para publicar no **GitHub** e usar **GitHub Pages**. Cada vez que você der push na branch `main`, o site é atualizado automaticamente.

**Passo a passo:**

1. **Crie um repositório no GitHub** (se ainda não tiver):
   - Acesse [github.com](https://github.com) e clique em **New repository**.
   - Nome sugerido: `Ranking-Cabare` ou `ranking-cabare`.
   - Não marque “Add a README” se você já tem o projeto na pasta (para não dar conflito).

2. **Suba o projeto para o repositório** (no terminal, na pasta do projeto):
   ```bash
   git init
   git add .
   git commit -m "Publicar ranking no GitHub Pages"
   git branch -M main
   git remote add origin https://github.com/SEU-USUARIO/NOME-DO-REPOSITORIO.git
   git push -u origin main
   ```
   Troque `SEU-USUARIO` e `NOME-DO-REPOSITORIO` pelo seu usuário e nome do repositório.

3. **Ative o GitHub Pages:**
   - No repositório, vá em **Settings** → **Pages** (menu lateral).
   - Em **Build and deployment**, em **Source** escolha **GitHub Actions**.

4. **Aguarde o primeiro deploy:**
   - Depois do primeiro push, a workflow **Deploy to GitHub Pages** vai rodar sozinha (aba **Actions**).
   - Quando terminar (ícone verde), o site estará no ar.

5. **Seu link será:**
   ```
   https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/
   ```
   Exemplo: se o usuário for `joao` e o repositório `Ranking-Cabare`, o link é:
   `https://joao.github.io/Ranking-Cabare/`

6. **Compartilhar no Discord:**  
   Mande o link no servidor ou no grupo: *“Galera, ranking ARAM aqui: [link]”*. Qualquer um com o link pode acessar.

**Atualizar o ranking:** edite o `ranking.json` (ou o código), faça commit e push de novo na `main`. O GitHub Actions vai fazer o build e publicar de novo; o link continua o mesmo.

---

## 3. Botões só para você (admin)

No site publicado, os botões **"Restaurar dados"** e **"Nova temporada"** **não aparecem** para quem acessa o link normal. Só você (quem configura o ranking) precisa deles.

Para ver e usar esses botões, abra o site com: **o mesmo link + `?admin=1`** (ex.: `https://seu-usuario.github.io/ranking-cabare/?admin=1`). Guarde esse link com `?admin=1` só para você; para o Discord e para os amigos use o link sem nada no final.

---

## 4. Resumo rápido

| O que fazer | Comando / ação |
|-------------|-----------------|
| Gerar site para publicar | `npm run build` (gera a pasta `dist`) |
| Publicar e ganhar link | GitHub Pages (Settings > Pages > Source: GitHub Actions) ou Netlify/Vercel |
| Compartilhar com os amigos | Enviar o link sem ?admin=1 |
| Ver Restaurar / Nova temporada | Acessar o link com ?admin=1 (só você) |

Assim que o link estiver no ar, é só mandar no grupo: “Amigos, ranking aqui: [link]”.
