/**
 * Salva o ranking (players + matches) no repositório GitHub, atualizando public/ranking.json.
 * Uso: POST /api/save-ranking com body { players, matches }
 *
 * Variáveis de ambiente no Vercel:
 * - GITHUB_TOKEN: token com permissão repo (Settings > Developer settings > Personal access tokens)
 * - GITHUB_REPO: "owner/repo" (ex: Gleidisonjr/Aram-Ranked-APP)
 */

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

export default async function handler(req, res) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const token = process.env.GITHUB_TOKEN
  const repo = process.env.GITHUB_REPO || 'Gleidisonjr/Aram-Ranked-APP'
  if (!token) {
    return res.status(500).json({ error: 'GITHUB_TOKEN not configured in Vercel' })
  }

  let body
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' })
  }

  const { players, matches } = body
  if (!Array.isArray(players) || !Array.isArray(matches)) {
    return res.status(400).json({ error: 'Body must contain players and matches arrays' })
  }

  const data = { players, matches }
  const content = JSON.stringify(data, null, 2)
  const contentBase64 = Buffer.from(content, 'utf8').toString('base64')

  try {
    const auth = token.startsWith('ghp_') ? `Bearer ${token}` : `token ${token}`
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
        headers: {
          Authorization: auth,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: 'Atualizar ranking (edição manual)',
          content: contentBase64,
          sha: sha || undefined,
        }),
      }
    )

    if (!updateRes.ok) {
      const err = await updateRes.json()
      console.error('GitHub API error:', err)
      return res.status(updateRes.status).json({
        error: err.message || 'Failed to update file on GitHub',
      })
    }

    return res.status(200).json({ ok: true, message: 'Ranking salvo permanentemente' })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to save ranking' })
  }
}
