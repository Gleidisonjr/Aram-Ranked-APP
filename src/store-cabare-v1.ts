import type { Player, Match, PlayerStats } from './types'

const PLAYERS_KEY = 'ranking-cabare-players'
const MATCHES_KEY = 'ranking-cabare-matches'
const SEASON_KEY = 'ranking-cabare-season'
const RIVALS_KEY = 'ranking-cabare-rivals'

/** Nomes antigos/duplicados que não devem aparecer no ranking. */
const REMOVED_PLAYER_NAMES = new Set([
  'Y. Garcia',
  'ZZ Don Godoy',
  'RANDEX',
  'PRK',
  'Lulu',
  'Sinist',
  'zezinho',
  'Zezinho',
  'MEU PIRU', // removido: nome incorreto, usar MEU P1RU (com número 1)
])

export interface RankingData {
  players: Player[]
  matches: Match[]
}

// Override temporário de ELO para testes visuais.
const TEST_ELO_OVERRIDES = new Map<string, { label: string; tier: string }>([
  ['p-2-22cm50kmes190cm', { label: 'Boss', tier: 'boss' }],
])

const basePath = (import.meta.env.BASE_URL ?? '').replace(/\/+$/, '')
const getOrigin = () => (typeof location !== 'undefined' ? location.origin : '')
/** Ranking: no GitHub Pages carrega do próprio site; em dev do local. */
const RANKING_JSON_URL = `${getOrigin()}${basePath ? basePath + '/' : '/'}ranking.json`
/** API que salva no GitHub (pasta api/ no Vercel ou outro). Configure VITE_API_BASE se usar outra URL. */
const API_BASE = (import.meta as { env?: { VITE_API_BASE?: string } }).env?.VITE_API_BASE?.replace(/\/+$/, '')
  ?? 'https://aram-ranked-hoxuicu3j-gleidisonjrs-projects.vercel.app'
const SAVE_RANKING_API_URL = `${API_BASE}/api/save-ranking`

/** Resposta da API de extração de partida a partir do print. */
export interface ExtractedMatchData {
  winningTeam: Array<{
    summonerName: string
    championName: string
    kills: number
    deaths: number
    assists: number
    damageToChampions?: number | null
  }>
  losingTeam: Array<{
    summonerName: string
    championName: string
    kills: number
    deaths: number
    assists: number
    damageToChampions?: number | null
  }>
  matchDuration?: string | null
}

const EXTRACT_MATCH_API_URL = `${API_BASE}/api/extract-match`

/** Envia o print (base64) para a API e retorna os dados extraídos da partida. */
export async function extractMatchFromImage(imageBase64: string): Promise<{ ok: true; data: ExtractedMatchData } | { ok: false; error: string }> {
  try {
    const res = await fetch(EXTRACT_MATCH_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: imageBase64 }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      return { ok: false, error: (json as { error?: string }).error || `Erro ${res.status}` }
    }
    const data = json as ExtractedMatchData
    if (!Array.isArray(data.winningTeam) || !Array.isArray(data.losingTeam)) {
      return { ok: false, error: 'Resposta inválida da API' }
    }
    return { ok: true, data }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

/** Salva players e matches no servidor (ranking.json no GitHub). Retorna true se sucesso. */
export async function saveRankingToServer(data: RankingData): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(SAVE_RANKING_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    const json = await res.json().catch(() => ({}))
    if (res.ok) return { ok: true }
    return { ok: false, error: (json as { error?: string }).error || `Erro ${res.status}` }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

/** Carrega ranking do site (ranking.json — no GitHub Pages vem do repositório). Tenta até 2x. Se falhar, retorna null e o app usa cache (localStorage). */
export async function loadFromFile(): Promise<RankingData | null> {
  const tryLoad = async (): Promise<RankingData | null> => {
    const url = `${RANKING_JSON_URL}?t=${Date.now()}`
    const res = await fetch(url, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
    })
    if (!res.ok) {
      console.warn(`ranking.json: HTTP ${res.status} em ${url}`)
      return null
    }
    const data = await res.json() as RankingData
    if (Array.isArray(data.players) && Array.isArray(data.matches)) return data
    console.warn('ranking.json: formato inválido (players/matches ausentes)')
    return null
  }
  const first = await tryLoad()
  if (first) return first
  await new Promise((r) => setTimeout(r, 800))
  return tryLoad()
}

export function loadPlayers(): Player[] {
  try {
    const raw = localStorage.getItem(PLAYERS_KEY)
    if (raw) {
      const list = JSON.parse(raw) as Player[]
      return list.filter((p) => !REMOVED_PLAYER_NAMES.has(p.name.trim()))
    }
  } catch (_) {}
  return getDefaultPlayers()
}

function getDefaultPlayers(): Player[] {
  const names = [
    'yGarCiaZz',
    'Don Godoy',
    '22cm50kmes190cm',
    'Ran D Ex',
    'PRQ Lulu',
    'SrSinist',
  ]
  return names.map((name, i) => ({
    id: `p-${i}-${name.replace(/\s/g, '-').toLowerCase()}`,
    name,
  }))
}

export function savePlayers(players: Player[]): void {
  localStorage.setItem(PLAYERS_KEY, JSON.stringify(players))
}

export function loadMatches(): Match[] {
  try {
    const raw = localStorage.getItem(MATCHES_KEY)
    if (raw) return JSON.parse(raw)
  } catch (_) {}
  return []
}

export function saveMatches(matches: Match[]): void {
  localStorage.setItem(MATCHES_KEY, JSON.stringify(matches))
}

export function loadSeason(): string {
  try {
    const s = localStorage.getItem(SEASON_KEY)
    if (s) return s
  } catch (_) {}
  const now = new Date()
  return `${['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][now.getMonth()]} ${now.getFullYear()}`
}

export function saveSeason(season: string): void {
  localStorage.setItem(SEASON_KEY, season)
}

/** Pares de rivais: [[id1, id2], ...] — ordem alfabética dos IDs para evitar duplicatas. */
export function loadRivals(): [string, string][] {
  try {
    const raw = localStorage.getItem(RIVALS_KEY)
    if (raw) {
      const arr = JSON.parse(raw) as unknown[]
      if (Array.isArray(arr)) {
        return arr.filter((x): x is [string, string] =>
          Array.isArray(x) && x.length === 2 && typeof x[0] === 'string' && typeof x[1] === 'string'
        ).map(([a, b]) => (a < b ? [a, b] : [b, a]))
      }
    }
  } catch (_) {}
  return []
}

export function saveRivals(rivals: [string, string][]): void {
  const normalized = rivals.map(([a, b]) => (a < b ? [a, b] : [b, a]))
  localStorage.setItem(RIVALS_KEY, JSON.stringify(normalized))
}

/**
 * Mescla dados do arquivo (ranking.json, atualizado pelo print) com localStorage.
 * - Jogador adicionado na plataforma: entra na lista e aparece no ranking e no sortear.
 * - Jogador que só aparece no print: é adicionado (vem do arquivo) e aparece em tudo.
 * - Mesmo nome com IDs diferentes (ex.: Hipnos do app + Hipnos do print): unifica por nome,
 *   escolhe um ID canônico e remapeia todas as partidas para não duplicar vitórias/derrotas.
 */
export function mergeRankingData(
  file: RankingData | null,
  localPlayers: Player[],
  localMatches: Match[]
): { players: Player[]; matches: Match[] } {
  const filePlayers = file?.players ?? []
  const fileMatches = file?.matches ?? []
  const idsFromFile = new Set(filePlayers.map((p) => p.id))

  const players: Player[] = []
  filePlayers.forEach((p) => {
    if (!REMOVED_PLAYER_NAMES.has(p.name.trim())) players.push(p)
  })
  localPlayers.forEach((p) => {
    if (!idsFromFile.has(p.id) && !REMOVED_PLAYER_NAMES.has(p.name.trim())) players.push(p)
  })

  const byId = new Map<string, Match>()
  const localById = new Map(localMatches.map((m) => [m.id, m]))
  const fileMatchIds = new Set(fileMatches.map((m) => m.id))
  // Partidas que vêm do ranking.json têm prioridade: sempre usamos picks/KDA/vencedores do arquivo,
  // para não mostrar dados antigos do localStorage (ex.: campeões/jogadores errados).
  const matchesToUse = fileMatches.length > 0 ? fileMatches : localMatches
  matchesToUse.forEach((m) => {
    const fromFile = fileMatchIds.has(m.id)
    if (fromFile) {
      const local = localById.get(m.id)
      // Se o usuário editou no navegador (campeões, KDA, imagem), preservar essas edições ao mesclar.
      const localHasMorePicks = local?.picks?.some((p) => (p.champion ?? '').trim()) ?? false
      const filePicksEmpty = (m.picks ?? []).every((p) => !(p.champion ?? '').trim())
      const localHasImage = !!(local?.imageUrl?.trim())
      if (local && (localHasMorePicks || (filePicksEmpty && (local.picks?.length ?? 0) > 0) || localHasImage)) {
        byId.set(m.id, {
          ...m,
          picks: local.picks ?? m.picks,
          kda: local.kda ?? m.kda,
          imageUrl: local.imageUrl ?? m.imageUrl,
          matchExtendedStats: local.matchExtendedStats ?? m.matchExtendedStats,
          excludeFromStats: local.excludeFromStats ?? m.excludeFromStats,
        })
      } else {
        byId.set(m.id, { ...m, excludeFromStats: local?.excludeFromStats ?? m.excludeFromStats })
      }
      return
    }
    const local = localById.get(m.id)
    const filePicks = m.picks ?? []
    const fileKda = m.kda ?? []
    const localPicks = local?.picks ?? []
    const localKda = local?.kda ?? []
    const useLocalPicks = localPicks.length > filePicks.length || (localPicks.length > 0 && filePicks.length === 0)
    const useLocalKda = localKda.length > fileKda.length || (localKda.length > 0 && fileKda.length === 0)
    const fileStats = m.matchExtendedStats ?? []
    const localStats = local?.matchExtendedStats ?? []
    const useLocalStats = localStats.length > fileStats.length
    const merged: Match = local && (useLocalPicks || useLocalKda || useLocalStats)
      ? {
          ...m,
          picks: useLocalPicks ? localPicks : filePicks,
          kda: useLocalKda ? localKda : fileKda,
          matchExtendedStats: useLocalStats ? localStats : fileStats,
          imageUrl: local?.imageUrl ?? m.imageUrl,
          excludeFromStats: local?.excludeFromStats ?? m.excludeFromStats,
        }
      : { ...m, excludeFromStats: local?.excludeFromStats ?? m.excludeFromStats }
    byId.set(merged.id, merged)
  })
  // Quando o arquivo tem partidas, usamos SOMENTE as do arquivo (ranking.json é a fonte da verdade).
  // Não misturamos partidas antigas do localStorage para evitar Don Godoy/Morgana etc. no histórico.
  if (fileMatches.length === 0) {
    localMatches.forEach((m) => {
      if (!byId.has(m.id)) byId.set(m.id, m)
    })
  }
  const rawMatches: Match[] = [...byId.values()]
  // Ordem por data: partida mais recente (maior createdAt) primeiro no histórico. Assim 26/02 fica à frente de 04/02.
  rawMatches.sort((a, b) => {
    const da = a.createdAt ? new Date(a.createdAt).getTime() : 0
    const db = b.createdAt ? new Date(b.createdAt).getTime() : 0
    return db - da
  })

  const winsById = new Map<string, number>()
  rawMatches.forEach((m) => {
    if (m.excludeFromStats) return
    m.winnerIds.forEach((id) => winsById.set(id, (winsById.get(id) ?? 0) + 1))
  })

  const byName = new Map<string, Player[]>()
  players.forEach((p) => {
    const n = normalizeName(p.name)
    if (!byName.has(n)) byName.set(n, [])
    byName.get(n)!.push(p)
  })

  const canonicalIdByName = new Map<string, string>()
  byName.forEach((list, name) => {
    if (list.length === 1) {
      canonicalIdByName.set(name, list[0].id)
      return
    }
    const withWins = list.map((p) => ({ p, wins: winsById.get(p.id) ?? 0 }))
    withWins.sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins
      return idsFromFile.has(b.p.id) ? 1 : idsFromFile.has(a.p.id) ? -1 : 0
    })
    canonicalIdByName.set(name, withWins[0].p.id)
  })

  const idToCanonical = new Map<string, string>()
  players.forEach((p) => {
    const canonical = canonicalIdByName.get(normalizeName(p.name))
    if (canonical) idToCanonical.set(p.id, canonical)
  })

  const remapId = (id: string) => idToCanonical.get(id) ?? id
  const matches: Match[] = rawMatches.map((m) => ({
    ...m,
    winnerIds: m.winnerIds.map(remapId),
    loserIds: m.loserIds.map(remapId),
    picks: (m.picks ?? []).map((p) => ({ ...p, playerId: remapId(p.playerId) })),
    kda: (m.kda ?? []).map((e) => ({ ...e, playerId: remapId(e.playerId) })),
    matchExtendedStats: (m.matchExtendedStats ?? []).map((s) => ({ ...s, playerId: remapId(s.playerId) })),
  }))

  const canonicalIds = new Set(canonicalIdByName.values())
  const playersFiltered = players.filter((p) => canonicalIds.has(p.id))

  return { players: playersFiltered, matches }
}

/** Formato para importar partida a partir do print (nomes como no jogo). */
export interface ImportPrintData {
  equipe1: string[]
  equipe2: string[]
  vencedor: 'equipe1' | 'equipe2'
  picks?: { nome: string; campeao: string }[]
  kda?: { nome: string; kills: number; deaths: number; assists: number }[]
}

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, '')
    .trim()
}

/** Encontra jogador por nome (flexível: ignora maiúsculas e espaços). */
export function findPlayerByName(players: Player[], name: string): Player | null {
  const n = normalizeName(name)
  if (!n) return null
  const exact = players.find((p) => normalizeName(p.name) === n)
  if (exact) return exact
  const contained = players.find(
    (p) =>
      normalizeName(p.name).includes(n) ||
      n.includes(normalizeName(p.name))
  )
  return contained ?? null
}

/** Para cada jogador: sequência atual, recorde de vitórias, últimos N resultados (mais recente primeiro). */
function computeStreakAndLastResults(
  playerId: string,
  matchesAsc: Match[],
  lastN: number
): { streak: { type: 'V' | 'D'; count: number } | undefined; bestWinStreak: number; lastResults: ('W' | 'L')[] } {
  const results: ('W' | 'L')[] = []
  for (const m of matchesAsc) {
    if (m.winnerIds.includes(playerId)) results.push('W')
    else if (m.loserIds.includes(playerId)) results.push('L')
  }
  let bestWin = 0
  let runW = 0
  for (const r of results) {
    if (r === 'W') {
      runW++
      bestWin = Math.max(bestWin, runW)
    } else runW = 0
  }
  let currentStreak: { type: 'V' | 'D'; count: number } | undefined
  if (results.length > 0) {
    const last = results[results.length - 1]
    let count = 0
    for (let i = results.length - 1; i >= 0 && results[i] === last; i--) count++
    currentStreak = { type: last === 'W' ? 'V' : 'D', count }
  }
  const lastResults = results.slice(-lastN).reverse()
  return { streak: currentStreak, bestWinStreak: bestWin, lastResults }
}

export interface AchievementDef {
  id: string
  name: string
  icon: string
  category: string
  check: (s: PlayerStats) => boolean
}

const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'kills10', name: '10 abates', icon: '🎯', category: 'Abates', check: (s) => (s.kda?.kills ?? 0) >= 10 },
  { id: 'kills25', name: '25 abates', icon: '🎯', category: 'Abates', check: (s) => (s.kda?.kills ?? 0) >= 25 },
  { id: 'kills50', name: '50 abates', icon: '🎯', category: 'Abates', check: (s) => (s.kda?.kills ?? 0) >= 50 },
  { id: 'kills100', name: '100 abates', icon: '💀', category: 'Abates', check: (s) => (s.kda?.kills ?? 0) >= 100 },
  { id: 'kills250', name: '250 abates', icon: '🔥', category: 'Abates', check: (s) => (s.kda?.kills ?? 0) >= 250 },
  { id: 'kills500', name: '500 abates', icon: '⚔️', category: 'Abates', check: (s) => (s.kda?.kills ?? 0) >= 500 },
  { id: 'kills1000', name: '1000 abates', icon: '👑', category: 'Abates', check: (s) => (s.kda?.kills ?? 0) >= 1000 },
  { id: 'deaths10', name: '10 mortes', icon: '😅', category: 'Mortes', check: (s) => (s.kda?.deaths ?? 0) >= 10 },
  { id: 'deaths50', name: '50 mortes', icon: '🪦', category: 'Mortes', check: (s) => (s.kda?.deaths ?? 0) >= 50 },
  { id: 'deaths100', name: '100 mortes', icon: '💀', category: 'Mortes', check: (s) => (s.kda?.deaths ?? 0) >= 100 },
  { id: 'deaths250', name: '250 mortes — Alvo fácil', icon: '🎪', category: 'Mortes', check: (s) => (s.kda?.deaths ?? 0) >= 250 },
  { id: 'deaths500', name: '500 mortes — Fed do inimigo', icon: '🍽️', category: 'Mortes', check: (s) => (s.kda?.deaths ?? 0) >= 500 },
  { id: 'deaths1000', name: '1000 mortes — Lenda do feed', icon: '🏴‍☠️', category: 'Mortes', check: (s) => (s.kda?.deaths ?? 0) >= 1000 },
  { id: 'assists10', name: '10 assistências', icon: '🤝', category: 'Assistências', check: (s) => (s.kda?.assists ?? 0) >= 10 },
  { id: 'assists50', name: '50 assistências', icon: '🤝', category: 'Assistências', check: (s) => (s.kda?.assists ?? 0) >= 50 },
  { id: 'assists100', name: '100 assistências', icon: '✨', category: 'Assistências', check: (s) => (s.kda?.assists ?? 0) >= 100 },
  { id: 'assists250', name: '250 assistências', icon: '🌟', category: 'Assistências', check: (s) => (s.kda?.assists ?? 0) >= 250 },
  { id: 'assists500', name: '500 assistências — Suporte de ouro', icon: '🛡️', category: 'Assistências', check: (s) => (s.kda?.assists ?? 0) >= 500 },
  { id: 'assists1000', name: '1000 assistências — Anjo da equipe', icon: '😇', category: 'Assistências', check: (s) => (s.kda?.assists ?? 0) >= 1000 },
  { id: 'wins1', name: 'Primeira vitória', icon: '🏆', category: 'Vitórias', check: (s) => s.wins >= 1 },
  { id: 'wins5', name: '5 vitórias', icon: '🥉', category: 'Vitórias', check: (s) => s.wins >= 5 },
  { id: 'wins10', name: '10 vitórias', icon: '🥈', category: 'Vitórias', check: (s) => s.wins >= 10 },
  { id: 'wins25', name: '25 vitórias', icon: '🥇', category: 'Vitórias', check: (s) => s.wins >= 25 },
  { id: 'wins50', name: '50 vitórias', icon: '🏅', category: 'Vitórias', check: (s) => s.wins >= 50 },
  { id: 'wins100', name: '100 vitórias', icon: '👑', category: 'Vitórias', check: (s) => s.wins >= 100 },
  { id: 'games5', name: '5 partidas', icon: '📊', category: 'Partidas', check: (s) => s.wins + s.losses >= 5 },
  { id: 'games10', name: '10 partidas', icon: '📈', category: 'Partidas', check: (s) => s.wins + s.losses >= 10 },
  { id: 'games25', name: '25 partidas', icon: '📉', category: 'Partidas', check: (s) => s.wins + s.losses >= 25 },
  { id: 'games50', name: '50 partidas — Viciado', icon: '🎮', category: 'Partidas', check: (s) => s.wins + s.losses >= 50 },
  { id: 'games100', name: '100 partidas', icon: '💪', category: 'Partidas', check: (s) => s.wins + s.losses >= 100 },
  { id: 'games250', name: '250 partidas — Veterano', icon: '🦁', category: 'Partidas', check: (s) => s.wins + s.losses >= 250 },
  { id: 'streak3', name: '3 vitórias seguidas', icon: '🔥', category: 'Sequência', check: (s) => (s.bestWinStreak ?? 0) >= 3 },
  { id: 'streak5', name: '5 vitórias seguidas', icon: '🔥', category: 'Sequência', check: (s) => (s.bestWinStreak ?? 0) >= 5 },
  { id: 'streak10', name: '10 vitórias seguidas — Imparável', icon: '⚡', category: 'Sequência', check: (s) => (s.bestWinStreak ?? 0) >= 10 },
  { id: 'winrate60', name: 'Win rate 60%+', icon: '📊', category: 'Win rate', check: (s) => s.winRate !== '—' && parseFloat(s.winRate) >= 60 },
  { id: 'winrate70', name: 'Win rate 70%+', icon: '💎', category: 'Win rate', check: (s) => s.winRate !== '—' && parseFloat(s.winRate) >= 70 },
  { id: 'winrate80', name: 'Win rate 80%+', icon: '🌟', category: 'Win rate', check: (s) => s.winRate !== '—' && parseFloat(s.winRate) >= 80 },
  { id: 'eternamente_ferro', name: 'Eternamente Ferro', icon: '🪨', category: 'Especiais', check: (s) => (s.patente?.startsWith('Ferro') ?? false) && s.wins + s.losses >= 20 },
  { id: 'subiu_ouro', name: 'Subiu pro Ouro', icon: '🟡', category: 'Especiais', check: (s) => (s.patente?.startsWith('Ouro') ?? false) || (s.patente?.startsWith('Platina') ?? false) || (s.patente?.startsWith('Diamante') ?? false) },
  { id: 'challenger', name: 'Challenger', icon: '👑', category: 'Especiais', check: (s) => s.patente === 'Challenger' },
  { id: 'carregou_time', name: 'Carregou o time', icon: '🦸', category: 'Especiais', check: (s) => (s.kda?.kills ?? 0) >= 50 && (s.kda?.assists ?? 0) >= 50 },
  { id: 'suporte_vital', name: 'Suporte vital', icon: '💚', category: 'Especiais', check: (s) => (s.kda?.assists ?? 0) >= 100 && (s.kda?.kills ?? 0) < 30 },
  { id: 'assassino', name: 'Assassino', icon: '🗡️', category: 'Especiais', check: (s) => (s.kda?.kills ?? 0) >= 100 && (s.kda?.deaths ?? 0) < 80 },
  { id: 'paciente', name: 'Paciente (100+ partidas)', icon: '🧘', category: 'Especiais', check: (s) => s.wins + s.losses >= 100 },
  { id: 'noob_saudavel', name: 'Noob saudável', icon: '🌱', category: 'Especiais', check: (s) => s.wins + s.losses >= 5 && s.wins + s.losses <= 15 },
  { id: 'cabo_guerra', name: 'Cabo de guerra', icon: '⚔️', category: 'Especiais', check: (s) => s.wins >= 10 && s.losses >= 10 },
  { id: 'quase_perfeito', name: 'Quase perfeito', icon: '✨', category: 'Especiais', check: (s) => s.winRate !== '—' && parseFloat(s.winRate) >= 90 },
  /* Win rate extremos */
  { id: 'winrate40', name: 'Win rate 40%+', icon: '📈', category: 'Win rate', check: (s) => s.winRate !== '—' && parseFloat(s.winRate) >= 40 },
  { id: 'winrate50', name: 'Win rate 50%+', icon: '⚖️', category: 'Win rate', check: (s) => s.winRate !== '—' && parseFloat(s.winRate) >= 50 },
  { id: 'winrate90', name: 'Win rate 90%+', icon: '💫', category: 'Win rate', check: (s) => s.winRate !== '—' && parseFloat(s.winRate) >= 90 },
  { id: 'winrate100', name: 'Invicto (100%)', icon: '🛡️', category: 'Win rate', check: (s) => s.winRate === '100.0' && s.wins >= 1 },
  /* Partidas */
  { id: 'games1', name: 'Primeira partida', icon: '🎮', category: 'Partidas', check: (s) => s.wins + s.losses >= 1 },
  { id: 'games500', name: '500 partidas — Lenda', icon: '🌟', category: 'Partidas', check: (s) => s.wins + s.losses >= 500 },
  { id: 'games1000', name: '1000 partidas — Mito', icon: '🔮', category: 'Partidas', check: (s) => s.wins + s.losses >= 1000 },
  /* Sequência */
  { id: 'streak2', name: '2 vitórias seguidas', icon: '🔥', category: 'Sequência', check: (s) => (s.bestWinStreak ?? 0) >= 2 },
  { id: 'streak7', name: '7 vitórias seguidas', icon: '💥', category: 'Sequência', check: (s) => (s.bestWinStreak ?? 0) >= 7 },
  { id: 'streak15', name: '15 vitórias seguidas — Lenda', icon: '👑', category: 'Sequência', check: (s) => (s.bestWinStreak ?? 0) >= 15 },
  { id: 'derrotas5', name: '5 derrotas seguidas', icon: '😢', category: 'Sequência', check: (s) => (s.lastResults ?? []).filter((r) => r === 'L').length >= 5 },
  /* Vitórias */
  { id: 'wins200', name: '200 vitórias', icon: '🏆', category: 'Vitórias', check: (s) => s.wins >= 200 },
  { id: 'wins500', name: '500 vitórias', icon: '👑', category: 'Vitórias', check: (s) => s.wins >= 500 },
  /* Abates */
  { id: 'kills2000', name: '2000 abates', icon: '💀', category: 'Abates', check: (s) => (s.kda?.kills ?? 0) >= 2000 },
  { id: 'kills5000', name: '5000 abates — Máquina', icon: '🤖', category: 'Abates', check: (s) => (s.kda?.kills ?? 0) >= 5000 },
  /* Mortes */
  { id: 'deaths2000', name: '2000 mortes', icon: '🪦', category: 'Mortes', check: (s) => (s.kda?.deaths ?? 0) >= 2000 },
  /* Assistências */
  { id: 'assists2000', name: '2000 assistências', icon: '😇', category: 'Assistências', check: (s) => (s.kda?.assists ?? 0) >= 2000 },
  /* KDA / desempenho */
  { id: 'kda_positivo', name: 'K/D positivo', icon: '✅', category: 'KDA', check: (s): boolean => !!(s.kda && s.kda.deaths > 0 && s.kda.kills >= s.kda.deaths) },
  { id: 'kda_2', name: 'KDA 2.0+', icon: '📊', category: 'KDA', check: (s): boolean => !!(s.kda && s.kda.deaths > 0 && (s.kda.kills + s.kda.assists) / s.kda.deaths >= 2) },
  { id: 'kda_3', name: 'KDA 3.0+', icon: '💎', category: 'KDA', check: (s): boolean => !!(s.kda && s.kda.deaths > 0 && (s.kda.kills + s.kda.assists) / s.kda.deaths >= 3) },
  { id: 'kda_4', name: 'KDA 4.0+', icon: '🌟', category: 'KDA', check: (s): boolean => !!(s.kda && s.kda.deaths > 0 && (s.kda.kills + s.kda.assists) / s.kda.deaths >= 4) },
  { id: 'poucas_mortes', name: 'Sobrevivente (50+ jogos, <3 mortes/jogo)', icon: '🛡️', category: 'KDA', check: (s): boolean => !!(s.kda && s.kda.games >= 50 && s.kda.deaths / s.kda.games < 3) },
  { id: 'muitas_assists', name: 'Jogador de equipe (5+ assists/jogo)', icon: '🤝', category: 'KDA', check: (s): boolean => !!(s.kda && s.kda.games >= 10 && s.kda.assists / s.kda.games >= 5) },
  /* ELO / patente */
  { id: 'ferro', name: 'Ferro', icon: '🪨', category: 'ELO', check: (s): boolean => Boolean(s.patente?.startsWith('Ferro')) },
  { id: 'bronze', name: 'Bronze', icon: '🥉', category: 'ELO', check: (s): boolean => Boolean(s.patente?.startsWith('Bronze')) },
  { id: 'prata', name: 'Prata', icon: '🥈', category: 'ELO', check: (s): boolean => Boolean(s.patente?.startsWith('Prata')) },
  { id: 'platina', name: 'Platina', icon: '💎', category: 'ELO', check: (s): boolean => Boolean(s.patente?.startsWith('Platina')) },
  { id: 'esmeralda', name: 'Esmeralda', icon: '💚', category: 'ELO', check: (s): boolean => Boolean(s.patente?.startsWith('Esmeralda')) },
  { id: 'diamante', name: 'Diamante', icon: '💠', category: 'ELO', check: (s): boolean => Boolean(s.patente?.startsWith('Diamante')) },
  { id: 'mestre', name: 'Mestre', icon: '🔮', category: 'ELO', check: (s): boolean => Boolean(s.patente?.startsWith('Mestre')) },
  { id: 'grao_mestre', name: 'Grão-Mestre', icon: '⭐', category: 'ELO', check: (s): boolean => Boolean(s.patente?.startsWith('Grão-Mestre')) },
  /* Especiais extras */
  { id: 'comeback', name: 'Comeback (10+ derrotas e win rate 50%+)', icon: '🔄', category: 'Especiais', check: (s) => s.losses >= 10 && s.winRate !== '—' && parseFloat(s.winRate) >= 50 },
  { id: 'destruidor', name: 'Destruidor (200+ abates)', icon: '⚔️', category: 'Especiais', check: (s) => (s.kda?.kills ?? 0) >= 200 },
  { id: 'tanque', name: 'Tanque (100+ mortes, 50+ assists)', icon: '🛡️', category: 'Especiais', check: (s) => (s.kda?.deaths ?? 0) >= 100 && (s.kda?.assists ?? 0) >= 50 },
  { id: 'suporte_puro', name: 'Suporte puro (assists > kills)', icon: '💚', category: 'Especiais', check: (s): boolean => !!(s.kda && s.kda.assists > s.kda.kills && s.kda.games >= 5) },
  { id: 'carry', name: 'Carry (kills > assists, 50+ kills)', icon: '🗡️', category: 'Especiais', check: (s): boolean => !!(s.kda && s.kda.kills > s.kda.assists && s.kda.kills >= 50) },
  { id: 'all_rounder', name: 'All-rounder (K+A similares)', icon: '🎯', category: 'Especiais', check: (s): boolean => !!(s.kda && s.kda.games >= 20 && Math.abs((s.kda.kills ?? 0) - (s.kda.assists ?? 0)) <= 30) },
  { id: 'iniciante', name: 'Iniciante (1–4 partidas)', icon: '🌱', category: 'Especiais', check: (s) => { const t = s.wins + s.losses; return t >= 1 && t <= 4 } },
  { id: 'dedicado', name: 'Dedicado (75+ partidas)', icon: '💪', category: 'Especiais', check: (s) => s.wins + s.losses >= 75 },
  { id: 'veterano_200', name: 'Veterano (200+ partidas)', icon: '🦁', category: 'Especiais', check: (s) => s.wins + s.losses >= 200 },
  /* Main / OTP */
  { id: 'main', name: 'Main (50%+ em um campeão)', icon: '⭐', category: 'Campeões', check: (s) => { const t = s.wins + s.losses; if (t < 10) return false; const plays = [...(s.championPlays ?? [])].sort((a, b) => b.count - a.count); const best = plays[0]; return !!best && best.count / t >= 0.5 } },
  { id: 'otp', name: 'OTP (70%+ em um campeão)', icon: '🎯', category: 'Campeões', check: (s) => { const t = s.wins + s.losses; if (t < 10) return false; const plays = [...(s.championPlays ?? [])].sort((a, b) => b.count - a.count); const best = plays[0]; return !!best && best.count / t >= 0.7 } },
  /* Extra */
  { id: 'winrate_75', name: 'Elite (75%+ win rate)', icon: '💜', category: 'Win rate', check: (s) => { const n = parseFloat(s.winRate); return !Number.isNaN(n) && n >= 75 && s.wins + s.losses >= 10 } },
  { id: 'ratio_3', name: 'Ratio 3.0+', icon: '💎', category: 'KDA', check: (s): boolean => !!(s.kda && s.kda.deaths > 0 && (s.kda.kills + s.kda.assists) / s.kda.deaths >= 3) },
]

export function getAchievementDef(id: string): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id)
}

export function getAllAchievementsByCategory(): Map<string, AchievementDef[]> {
  const map = new Map<string, AchievementDef[]>()
  ACHIEVEMENTS.forEach((a) => {
    if (!map.has(a.category)) map.set(a.category, [])
    map.get(a.category)!.push(a)
  })
  return map
}

export function computeRanking(players: Player[], matches: Match[]): PlayerStats[] {
  const countingMatches = matches.filter((m) => !m.excludeFromStats)
  const wins = new Map<string, number>()
  const losses = new Map<string, number>()
  type ChampStats = { count: number; wins: number; kills: number; deaths: number; assists: number; displayChampion?: string; lastMatchCreatedAt?: string }
  const championCount = new Map<string, Map<string, ChampStats>>()
  const kdaAgg = new Map<string, { kills: number; deaths: number; assists: number; games: number }>()

  players.forEach((p) => {
    wins.set(p.id, 0)
    losses.set(p.id, 0)
    championCount.set(p.id, new Map())
    kdaAgg.set(p.id, { kills: 0, deaths: 0, assists: 0, games: 0 })
  })

  const matchesChronological = [...countingMatches].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
  matchesChronological.forEach((m) => {
    m.winnerIds.forEach((id) => wins.set(id, (wins.get(id) ?? 0) + 1))
    m.loserIds.forEach((id) => losses.set(id, (losses.get(id) ?? 0) + 1))
    const winnerSet = new Set(m.winnerIds)
    const kdaByPlayer = new Map((m.kda ?? []).map((e) => [e.playerId, e]))
    m.picks.forEach(({ playerId, champion }) => {
      const map = championCount.get(playerId)
      if (map && champion.trim()) {
        const key = champion.trim().toLowerCase()
        const cur: ChampStats = map.get(key) ?? { count: 0, wins: 0, kills: 0, deaths: 0, assists: 0, displayChampion: '' }
        cur.count += 1
        if (winnerSet.has(playerId)) cur.wins += 1
        cur.lastMatchCreatedAt = m.createdAt ?? cur.lastMatchCreatedAt
        const kdaEntry = kdaByPlayer.get(playerId)
        if (kdaEntry) {
          cur.kills += kdaEntry.kills
          cur.deaths += kdaEntry.deaths
          cur.assists += kdaEntry.assists
        }
        if (!cur.displayChampion) cur.displayChampion = champion.trim()
        map.set(key, cur)
      }
    })
    ;(m.kda ?? []).forEach(({ playerId, kills, deaths, assists }) => {
      const agg = kdaAgg.get(playerId)
      if (agg) {
        agg.kills += kills
        agg.deaths += deaths
        agg.assists += assists
        agg.games += 1
      }
    })
  })

  const matchesAsc = [...countingMatches].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
  const LAST_N = 10

  const eloStepByPlayer = new Map<string, number>()
  players.forEach((p) => eloStepByPlayer.set(p.id, 0))
  const maxStep = ELO_LADDER.length - 1
  matchesAsc.forEach((m) => {
    m.winnerIds.forEach((id) => {
      const step = eloStepByPlayer.get(id) ?? 0
      eloStepByPlayer.set(id, Math.min(step + 1, maxStep))
    })
    m.loserIds.forEach((id) => {
      const step = eloStepByPlayer.get(id) ?? 0
      eloStepByPlayer.set(id, Math.max(0, step - 1))
    })
  })

  return players
    .map((player) => {
      const w = wins.get(player.id) ?? 0
      const l = losses.get(player.id) ?? 0
      const total = w + l
      const winRate = total > 0 ? ((w / total) * 100).toFixed(1) : '—'
      const champMap = championCount.get(player.id) ?? new Map()
      const championPlays = Array.from(champMap.entries())
        .map(([key, data]) => {
          const { count, wins, kills, deaths, assists, lastMatchCreatedAt } = data
          const displayChampion = data.displayChampion ?? ''
          const ratio = deaths > 0 ? (kills + assists) / deaths : kills + assists
          const champion = displayChampion || key
          return { champion, count, wins, kills, deaths, assists, ratio, lastMatchCreatedAt }
        })
        .sort((a, b) => {
          if (b.count !== a.count) return b.count - a.count
          const lastA = a.lastMatchCreatedAt ?? ''
          const lastB = b.lastMatchCreatedAt ?? ''
          return lastB.localeCompare(lastA)
        })
      const kda = kdaAgg.get(player.id)!
      const hasKda = kda.games > 0
      const avgKda = hasKda
        ? `${(kda.kills / kda.games).toFixed(1)} / ${(kda.deaths / kda.games).toFixed(1)} / ${(kda.assists / kda.games).toFixed(1)}`
        : undefined
      const { streak, bestWinStreak, lastResults } = computeStreakAndLastResults(player.id, matchesAsc, LAST_N)
      const eloStep = total > 0 ? (eloStepByPlayer.get(player.id) ?? 0) : -1
      return {
        player,
        wins: w,
        losses: l,
        winRate,
        championPlays,
        kda: hasKda ? kda : undefined,
        avgKda,
        streak,
        bestWinStreak: bestWinStreak > 0 ? bestWinStreak : undefined,
        lastResults: lastResults.length > 0 ? lastResults : undefined,
        eloStep,
      }
    })
    .sort((a, b) => {
      const winsA = Number(a.wins)
      const winsB = Number(b.wins)
      const lossesA = Number(a.losses)
      const lossesB = Number(b.losses)
      const stepA = a.eloStep
      const stepB = b.eloStep
      // 1) ELO (patente): maior degrau = melhor posição (Ferro 1 à frente de Ferro 2, etc.)
      if (stepB !== stepA) return stepB - stepA
      // 2) Desempate por ELO: mais vitórias = melhor posição
      if (winsB !== winsA) return winsB - winsA
      // 3) Menos derrotas = melhor posição
      if (lossesA !== lossesB) return lossesA - lossesB
      const kdaA = a.kda ? (a.kda.kills + a.kda.assists) / Math.max(a.kda.deaths, 1) : 0
      const kdaB = b.kda ? (b.kda.kills + b.kda.assists) / Math.max(b.kda.deaths, 1) : 0
      return kdaB - kdaA
    })
    .map((s) => {
      const override = TEST_ELO_OVERRIDES.get(s.player.id)
      const { label, tier } = override
        ? override
        : s.eloStep >= 0
          ? getEloByStep(s.eloStep)
          : { label: 'Unranked', tier: 'unranked' as const }
      const achievements = ACHIEVEMENTS.filter((a) => a.check(s)).map((a) => ({ id: a.id, name: a.name }))
      return {
        ...s,
        patente: label,
        patenteTier: tier,
        achievements: achievements.length > 0 ? achievements : undefined,
        eloStep: s.eloStep,
      }
    })
}

/**
 * Escada ELO estilo LoL: começa em Ferro 4 (índice 0).
 * Simulação partida a partida (ordem cronológica): cada vitória sobe 1 degrau, cada derrota desce 1.
 * Piso em Ferro 4 (não desce abaixo de 0). Teto no último degrau (Challenger).
 */
const ELO_LADDER: { label: string; tier: string }[] = [
  { label: 'Ferro 4', tier: 'ferro' },
  { label: 'Ferro 3', tier: 'ferro' },
  { label: 'Ferro 2', tier: 'ferro' },
  { label: 'Ferro 1', tier: 'ferro' },
  { label: 'Bronze 4', tier: 'bronze' },
  { label: 'Bronze 3', tier: 'bronze' },
  { label: 'Bronze 2', tier: 'bronze' },
  { label: 'Bronze 1', tier: 'bronze' },
  { label: 'Prata 4', tier: 'prata' },
  { label: 'Prata 3', tier: 'prata' },
  { label: 'Prata 2', tier: 'prata' },
  { label: 'Prata 1', tier: 'prata' },
  { label: 'Ouro 4', tier: 'ouro' },
  { label: 'Ouro 3', tier: 'ouro' },
  { label: 'Ouro 2', tier: 'ouro' },
  { label: 'Ouro 1', tier: 'ouro' },
  { label: 'Platina 4', tier: 'platina' },
  { label: 'Platina 3', tier: 'platina' },
  { label: 'Platina 2', tier: 'platina' },
  { label: 'Platina 1', tier: 'platina' },
  { label: 'Esmeralda 4', tier: 'esmeralda' },
  { label: 'Esmeralda 3', tier: 'esmeralda' },
  { label: 'Esmeralda 2', tier: 'esmeralda' },
  { label: 'Esmeralda 1', tier: 'esmeralda' },
  { label: 'Diamante 4', tier: 'diamante' },
  { label: 'Diamante 3', tier: 'diamante' },
  { label: 'Diamante 2', tier: 'diamante' },
  { label: 'Diamante 1', tier: 'diamante' },
  { label: 'Mestre', tier: 'mestre' },
  { label: 'Grão-Mestre', tier: 'grao-mestre' },
  { label: 'Challenger', tier: 'challenger' },
]

/** Retorna label e tier para um degrau da escada (0 = Ferro 4, 1 = Ferro 3, …). */
export function getEloByStep(step: number): { label: string; tier: string } {
  const idx = Math.max(0, Math.min(ELO_LADDER.length - 1, step))
  return ELO_LADDER[idx]
}

/** @deprecated Use a simulação por partidas (getEloByStep) no computeRanking. Mantido para referência. */
export function getPatenteElo(wins: number, losses: number, partidas: number): { label: string; tier: string } {
  if (partidas === 0) return { label: '—', tier: 'none' }
  const net = wins - losses
  const idx = Math.max(0, Math.min(ELO_LADDER.length - 1, net))
  return ELO_LADDER[idx]
}
