# ARAM Ranked — Versão 1

Versão **completa** do app (KDA, campeões, destaques, conquistas, partida manual com campeões, etc.).

O código da Versão 1 está preservado na **raiz do repositório**, nos arquivos:

- `src/main-cabare-v1.ts`
- `src/store-cabare-v1.ts`
- `src/types-cabare-v1.ts`

## Como rodar a Versão 1

A partir da **raiz do repositório**:

1. Faça backup dos arquivos atuais (Versão 2):
   ```bash
   cp src/main.ts src/main.ts.bak
   cp src/store.ts src/store.ts.bak
   cp src/types.ts src/types.ts.bak
   ```

2. Use o código da Versão 1 como entrada:
   ```bash
   cp src/main-cabare-v1.ts src/main.ts
   cp src/store-cabare-v1.ts src/store.ts
   cp src/types-cabare-v1.ts src/types.ts
   ```

3. Em `tsconfig.json`, remova a linha que exclui os arquivos v1:
   - Apague ou comente: `"exclude": ["src/*-cabare-v1.ts"]`

4. Rode o projeto:
   ```bash
   npm install
   npm run dev
   ```

Para voltar à **Versão 2**, restaure os backups e recoloque o `exclude` no `tsconfig.json`.

---

Veja também **documentation/README.md** na raiz para a visão geral das duas versões.
