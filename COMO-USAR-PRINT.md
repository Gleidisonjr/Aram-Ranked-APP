# Atualizar o ranking com print da partida

Sim, **dá para usar os prints**. Você pode fazer de dois jeitos:

## 1. Enviar o print no chat (recomendado)

1. No fim da partida (ou da tela do lobby), tire o print.
2. Envie a imagem **aqui no chat do Cursor**, no mesmo projeto do Ranking Cabaré.
3. Me diga **quem ganhou**: “Equipe 1” ou “Equipe 2” (como aparece no print).
4. Eu extraio **só os nomes das duas equipes e o vencedor** (não extraio campeões da imagem — não é confiável). Te devolvo um **JSON**.
5. No app, na seção **“Importar partida do print”**, cole esse JSON e clique em **Importar partida**.
6. O ranking e os jogadores são atualizados na hora.

Se quiser, em vez de colar no app, eu posso **atualizar o arquivo `public/ranking.json`** do projeto para você. Aí é só dar **refresh (F5)** na página do ranking que os dados novos aparecem.

## 2. Formato do JSON para colar

Quando eu te passar os dados do print, o JSON vai estar nesse formato:

```json
{
  "equipe1": ["yGarCiaZz", "Don Godoy", "22cm50kmes190cm"],
  "equipe2": ["Ran D Ex", "PRQ Lulu", "SrSinist"],
  "vencedor": "equipe1"
}
```

- **equipe1** e **equipe2**: nomes como aparecem no jogo.
- **vencedor**: `"equipe1"` ou `"equipe2"`.

**Campeões (piques):** adicione manualmente no app ou no JSON com o bloco `picks`:

```json
"picks": [
  { "nome": "yGarCiaZz", "campeao": "Aurora" },
  { "nome": "Don Godoy", "campeao": "Alistar" }
]
```

**KDA (opcional):** para registrar abates/mortes/assistências da partida, use o bloco `kda` no JSON ou preencha os campos "KDA (opcional)" ao registrar a partida no app:

```json
"kda": [
  { "nome": "yGarCiaZz", "kills": 21, "deaths": 13, "assists": 17 },
  { "nome": "Don Godoy", "kills": 7, "deaths": 10, "assists": 14 }
]
```

No app, a tabela do ranking passa a mostrar a **média de KDA** e o **campeão mais pickado** de cada jogador.

## Resumo

- **Print no chat** → eu leio os times e quem ganhou → te devolvo o JSON ou atualizo o `ranking.json`.
- **Você** cola o JSON no app (ou dá F5 se eu tiver atualizado o arquivo).
- O **front** do ranking sempre reflete o que está no JSON + o que você importou/localStorage.

Se você guardar os prints no Discord e mandar aqui depois, dá para ir montando o histórico e eu vou te passando os JSONs ou atualizando o `ranking.json` para manter o ranking em dia.

---

## Corrigir partida com tabela de estatísticas (KDA, dano, cura, etc.)

Quando a partida já existe mas **campeão e/ou estatísticas estão errados** (ex.: apareceu você como Veigar quando jogou Irelia), dá para corrigir usando o **print da tela de estatísticas** do fim da partida.

### Regra: eu extraio os números, você informa os campeões

- **Eu:** leio do print os **valores** (KDA, dano, cura, dano recebido, etc.) por coluna. Não confio em identificar o campeão pelo ícone da imagem (às vezes erra, ex.: Nautilus vs Aatrox).
- **Você:** diz **qual campeão** cada jogador/coluna usou. Assim os números ficam certos e os campeões também.

Se você mandar print do **histórico do app** (como a partida aparece na lista), eu pergunto **“qual campeão é cada um?”** e você responde; aí eu só ajusto os campeões no JSON sem mudar KDA nem estatísticas.

### O que eu preciso de você

1. **A imagem (print)** da tela em que aparecem as colunas de estatísticas (cada coluna = um jogador: KDA, dano, cura, etc.).
2. **O mapeamento das colunas** — você escreve no chat, na ordem da esquerda para a direita do print:
   - **Coluna 1** = [seu nome ou 22CM] [campeão]
   - **Coluna 2** = [nome do jogador 2] [campeão]
   - **Coluna 3** = …
   - até a última coluna.

Exemplo de mensagem:

```text
Partida m-print-1 (ou "a primeira partida da lista"):
Coluna 1 = 22cm50kmes190cm Irelia
Coluna 2 = yGarCiaZz Veigar
Coluna 3 = Don Godoy Morgana
Coluna 4 = Ran D Ex Camille
Coluna 5 = PRQ Lulu Kayle
Coluna 6 = SrSinist Aatrox
```

### O que eu faço com isso

- **Leio os números** do print (KDA, dano, cura, etc.) para cada coluna.
- **Atribuo cada coluna** ao jogador e ao campeão que você informou.
- **Atualizo** o `ranking.json`: `picks`, `kda` e `matchExtendedStats` da partida com os valores corretos.

Assim o histórico, o Hall of Fame, as estatísticas individuais e os campeões mais usados passam a bater com a realidade. Você **não precisa** digitar todos os números; basta o print + o mapeamento (quem é cada coluna e qual campeão).
