# Modo admin (login + acesso às funções)

O app publicado no **GitHub Pages** é principalmente leitura.
Para usar as funções de administração (sortear times, criar partida, remover/inverter no histórico), existe um **modo admin** com **login e senha fixos**.

## Login admin

- URL do site (exemplo):
  - `https://gleidisonjr.github.io/Aram-Ranked-APP/`
- Botão no topo:
  - **“Entrar como administrador”**
- Credenciais (fixas):
  - Login: `22cm`
  - Senha: `Kabare`

## Como liberar a interface do admin

1. Abra o site.
2. Clique em **“Entrar como administrador”**.
3. Faça login.
4. Após login, aparecem:
   - **Sortear times** (admin)
   - **Criar partida (manual)**
   - Botões **⇅** e **×** no **histórico**

## Observações importantes

- Essa proteção é **front-end** (o Pages é estático). Ela serve para evitar que visitantes comuns utilizem as funções de admin.
- Para as alterações ficarem disponíveis para **todos** (multi-admin real), a sincronização precisa estar configurada (veja `docs/SYNC/SINCRONIZACAO-MULTI-ADMIN.md`).

## Recarregar / F5

- A sessão admin é feita de forma “session in-memory”: ao recarregar a página ou abrir em outro navegador/dispositivo, você deve fazer login novamente.

