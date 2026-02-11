# Salvar ranking permanentemente (Editar partida)

Quando você clica em **Editar** em uma partida e depois em **Salvar**, as alterações são:

1. Salvas no navegador (localStorage)
2. Enviadas para a API `/api/save-ranking`, que atualiza o arquivo `public/ranking.json` no repositório GitHub

Para a etapa 2 funcionar, configure no **Vercel** (onde a API está):

## Variáveis de ambiente no Vercel

1. Acesse o projeto no [Vercel](https://vercel.com)
2. Settings → Environment Variables
3. Adicione:

| Nome | Valor |
|------|-------|
| `GITHUB_TOKEN` | Token do GitHub com permissão `repo` |
| `GITHUB_REPO` | `Gleidisonjr/Aram-Ranked-APP` (ou seu owner/repo) |

### Como criar o GITHUB_TOKEN

1. GitHub → Settings → Developer settings → Personal access tokens
2. Generate new token (classic)
3. Marque o escopo **repo**
4. Copie o token e cole na variável `GITHUB_TOKEN` do Vercel

Depois de configurar, faça um novo deploy no Vercel para as variáveis entrarem em vigor.
