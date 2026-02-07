/**
 * Proxy para a Riot Match v5 API.
 * Uso: GET /api/match?matchId=BR1_xxxxx&region=americas
 * Variável de ambiente: RIOT_API_KEY (obrigatória).
 *
 * Deploy: Vercel (pasta api/ é servida como serverless).
 * O app no GitHub Pages chama esta URL; a API key fica só no Vercel.
 */

const ROUTING = {
  americas: 'americas',
  europe: 'europe',
  asia: 'asia',
  sea: 'sea',
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

export default async function handler(req, res) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const key = process.env.RIOT_API_KEY
  if (!key) {
    return res.status(500).json({ error: 'RIOT_API_KEY not configured' })
  }

  const matchId = (req.query.matchId || '').trim()
  if (!matchId) {
    return res.status(400).json({ error: 'Missing matchId' })
  }

  const region = (req.query.region || 'americas').toLowerCase()
  const routing = ROUTING[region] || ROUTING.americas
  const url = `https://${routing}.api.riotgames.com/lol/match/v5/matches/${encodeURIComponent(matchId)}`

  try {
    const response = await fetch(url, {
      headers: { 'X-Riot-Token': key },
    })

    if (response.status === 404) {
      return res.status(404).json({ error: 'Match not found' })
    }
    if (response.status === 403) {
      return res.status(502).json({ error: 'Invalid or expired API key' })
    }
    if (response.status === 429) {
      return res.status(429).json({ error: 'Rate limit exceeded' })
    }
    if (!response.ok) {
      const text = await response.text()
      return res.status(response.status).json({ error: text || 'Riot API error' })
    }

    const data = await response.json()
    const info = data.info || {}
    const participants = info.participants || []
    const teams = info.teams || []

    const winningTeamId = teams.find((t) => t.win)?.teamId ?? null
    const losingTeamId = teams.find((t) => !t.win)?.teamId ?? null

    const normalized = participants.map((p) => ({
      gameName: p.riotIdGameName || p.summonerName || '',
      teamId: p.teamId,
      win: !!p.win,
      championName: p.championName || '',
      kills: p.kills ?? 0,
      deaths: p.deaths ?? 0,
      assists: p.assists ?? 0,
      totalDamageDealtToChampions: p.totalDamageDealtToChampions ?? 0,
    }))

    const gameCreation = info.gameCreation
      ? new Date(info.gameCreation).toISOString()
      : new Date().toISOString()

    return res.status(200).json({
      matchId: data.metadata?.matchId || matchId,
      participants: normalized,
      winningTeamId,
      losingTeamId,
      gameCreation,
      queueId: info.queueId,
      gameMode: info.gameMode,
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to fetch match' })
  }
}
