/**
 * Cloudflare Worker: atualiza public/ranking.json no GitHub.
 * No Worker: Settings → Variables and Secrets → GITHUB_TOKEN (secret), GITHUB_REPO.
 * O app envia POST para esta URL + /api/save-ranking com body { players, matches }.
 */
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
