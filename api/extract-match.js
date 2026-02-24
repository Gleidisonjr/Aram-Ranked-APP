/**
 * Extrai dados de uma partida a partir do print da tela pós-jogo do League of Legends.
 * Uso: POST /api/extract-match com body { image: "base64..." } ou { image: "data:image/png;base64,..." }
 *
 * Variável de ambiente no Vercel: OPENAI_API_KEY
 * Retorna JSON: { winningTeam, losingTeam, matchDuration? }
 * Cada jogador: { summonerName, championName, kills, deaths, assists, damageToChampions? }
 */

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

export default async function handler(req, res) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return res.status(500).json({
      error: 'OPENAI_API_KEY not configured in Vercel. Add it in Project Settings > Environment Variables.',
    })
  }

  let body
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' })
  }

  let imageInput = body.image
  if (!imageInput || typeof imageInput !== 'string') {
    return res.status(400).json({ error: 'Body must contain image (base64 string)' })
  }

  // Strip data URL prefix if present
  const base64 = imageInput.replace(/^data:image\/\w+;base64,/, '')
  if (base64.length > 4 * 1024 * 1024) {
    return res.status(400).json({ error: 'Image too large. Use a smaller screenshot (e.g. max 1200px width).' })
  }

  const prompt = `You are analyzing a League of Legends end-game scoreboard (post-game screen). The image shows two teams with player names, champions, and KDA (kills/deaths/assists). There is usually a "VITÓRIA" (Victory) or "DERROTA" (Defeat) and team stats.

Extract and return ONLY a valid JSON object (no markdown, no code block) with this exact structure:
{
  "winningTeam": [
    { "summonerName": "exact name as shown", "championName": "Champion name", "kills": number, "deaths": number, "assists": number, "damageToChampions": number or null }
  ],
  "losingTeam": [
    { "summonerName": "exact name as shown", "championName": "Champion name", "kills": number, "deaths": number, "assists": number, "damageToChampions": number or null }
  ],
  "matchDuration": "MM:SS or null if not visible"
}

Rules:
- winningTeam = the team that won (VITÓRIA). losingTeam = the team that lost (DERROTA).
- Use the exact summoner names as displayed (e.g. "PaiN TelhoBranco", "22cm50kmes190cm").
- Champion names: use standard LoL names (e.g. "Dr. Mundo", "Kai'Sa", "Jarvan IV").
- KDA: integers. If a stat is not visible use 0.
- damageToChampions: number if visible (often with comma or dot as thousands separator), otherwise null.
- matchDuration: string like "18:56" if visible, else null.`

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt,
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${base64}`,
                },
              },
            ],
          },
        ],
      }),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      const msg = err.error?.message || response.statusText
      return res.status(response.status).json({
        error: `Vision API error: ${msg}`,
      })
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content?.trim()
    if (!content) {
      return res.status(502).json({ error: 'No content in Vision API response' })
    }

    // Strip possible markdown code fence
    const jsonStr = content.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '')
    const parsed = JSON.parse(jsonStr)

    if (!Array.isArray(parsed.winningTeam) || !Array.isArray(parsed.losingTeam)) {
      return res.status(502).json({
        error: 'Invalid structure: expected winningTeam and losingTeam arrays',
      })
    }

    return res.status(200).json(parsed)
  } catch (e) {
    if (e instanceof SyntaxError) {
      return res.status(502).json({ error: 'Could not parse extracted JSON from image' })
    }
    console.error(e)
    return res.status(500).json({ error: 'Failed to extract match data' })
  }
}
