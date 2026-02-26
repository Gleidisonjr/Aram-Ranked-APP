/**
 * Store para Aranked Cabaré — versão simplificada (só vitórias/derrotas, ELO, sem KDA/campeões).
 * Projeto completo está em store-cabare-v1.ts.
 */

import type { Player, Match, PlayerStats } from './types'

const PLAYERS_KEY = 'aram-ranked-2-players'
const MATCHES_KEY = 'aram-ranked-2-matches'
const SEASON_KEY = 'aram-ranked-2-season'
const DELETED_MATCH_IDS_KEY = 'aram-ranked-2-deleted-match-ids'

/** Partidas #22 em diante (#22 a #34) não contam para o ranking. Consideradas: 1 a 21. Mantidas no histórico com tag "Não considerado". */
const EXCLUDED_MATCH_NUMBERS = new Set(
  Array.from({ length: 13 }, (_, i) => 22 + i) /* 22..34 */
)

function matchNumberFromId(id: string): number | null {
  const m = id.match(/m-print-(\d+)/) || id.match(/m-(\d+)/)
  if (!m) return null
  const n = parseInt(m[1], 10)
  return Number.isNaN(n) ? null : n
}

function normalizeMatch(m: { id: string; winnerIds?: string[]; loserIds?: string[]; createdAt?: string; excludeFromStats?: boolean }): Match {
  const num = matchNumberFromId(m.id)
  /* Sempre pelo número: 1–20 consideradas, 21–34 não consideradas. Ignora valor salvo para ids numéricos. */
  const excludeFromStats = num !== null
    ? EXCLUDED_MATCH_NUMBERS.has(num)
    : (m.excludeFromStats ?? false)
  return {
    id: m.id,
    winnerIds: m.winnerIds ?? [],
    loserIds: m.loserIds ?? [],
    createdAt: m.createdAt ?? new Date().toISOString(),
    excludeFromStats: excludeFromStats || undefined,
  }
}

export interface RankingData {
  players: Player[]
  matches: Match[]
}

const REMOVED_PLAYER_NAMES = new Set<string>([])

const basePath = (import.meta.env.BASE_URL ?? '').replace(/\/+$/, '')
const getOrigin = () => (typeof location !== 'undefined' ? location.origin : '')
const RANKING_JSON_URL = `${getOrigin()}${basePath ? basePath + '/' : '/'}ranking.json`
const API_BASE = (import.meta as { env?: { VITE_API_BASE?: string } }).env?.VITE_API_BASE?.trim()?.replace(/\/+$/, '') ?? ''
const SAVE_RANKING_API_URL = API_BASE ? `${API_BASE}/api/save-ranking` : ''

export async function saveRankingToServer(data: RankingData): Promise<{ ok: boolean; error?: string }> {
  if (!SAVE_RANKING_API_URL) return { ok: true }
  const payload = {
    players: data.players,
    matches: data.matches.map((m) => ({ ...m, picks: [], kda: [] })),
  }
  try {
    const res = await fetch(SAVE_RANKING_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await res.json().catch(() => ({}))
    if (res.ok) return { ok: true }
    return { ok: false, error: (json as { error?: string }).error || `Erro ${res.status}` }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

export async function loadFromFile(): Promise<RankingData | null> {
  const tryLoad = async (): Promise<RankingData | null> => {
    const url = `${RANKING_JSON_URL}?t=${Date.now()}`
    const res = await fetch(url, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' } })
    if (!res.ok) return null
    const data = await res.json()
    if (!Array.isArray(data.players) || !Array.isArray(data.matches)) return null
    const matches: Match[] = data.matches.map((raw: { id: string; winnerIds?: string[]; loserIds?: string[]; createdAt?: string; excludeFromStats?: boolean }) =>
      normalizeMatch(raw)
    )
    return { players: data.players, matches }
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
  } catch {}
  return []
}

export function savePlayers(players: Player[]): void {
  localStorage.setItem(PLAYERS_KEY, JSON.stringify(players))
}

export function loadMatches(): Match[] {
  try {
    const raw = localStorage.getItem(MATCHES_KEY)
    if (raw) {
      const list = JSON.parse(raw) as Match[]
      return list.map((m) => normalizeMatch(m))
    }
  } catch {}
  return []
}

export function saveMatches(matches: Match[]): void {
  localStorage.setItem(MATCHES_KEY, JSON.stringify(matches))
}

/** IDs de partidas que o usuário removeu aqui; mantidos para que, após F5, continuem fora mesmo se o servidor ainda as devolver. */
export function loadDeletedMatchIds(): string[] {
  try {
    const raw = localStorage.getItem(DELETED_MATCH_IDS_KEY)
    if (raw) {
      const list = JSON.parse(raw) as string[]
      return Array.isArray(list) ? list : []
    }
  } catch {}
  return []
}

export function saveDeletedMatchIds(ids: string[]): void {
  localStorage.setItem(DELETED_MATCH_IDS_KEY, JSON.stringify(ids))
}

export function loadSeason(): string {
  return localStorage.getItem(SEASON_KEY) ?? 'Temporada 1'
}

export function saveSeason(label: string): void {
  localStorage.setItem(SEASON_KEY, label)
}

/** Mescla arquivo com localStorage. Preserva excludeFromStats. Partidas só no localStorage (ex.: criadas manualmente) são mantidas. */
export function mergeRankingData(
  file: RankingData | null,
  localPlayers: Player[],
  localMatches: Match[]
): { players: Player[]; matches: Match[] } {
  const filePlayers = file?.players ?? []
  const fileMatches = (file?.matches ?? []).map(normalizeMatch)
  const idsFromFile = new Set(filePlayers.map((p) => p.id))
  const localById = new Map(localMatches.map((m) => [m.id, m]))
  const fileMatchIds = new Set(fileMatches.map((m) => m.id))

  const players: Player[] = []
  filePlayers.forEach((p) => { if (!REMOVED_PLAYER_NAMES.has(p.name.trim())) players.push(p) })
  localPlayers.forEach((p) => { if (!idsFromFile.has(p.id) && !REMOVED_PLAYER_NAMES.has(p.name.trim())) players.push(p) })

  /* União: partidas do arquivo + partidas que existem só no localStorage (ex.: criadas manualmente). */
  const localOnly = localMatches.filter((m) => !fileMatchIds.has(m.id)).map(normalizeMatch)
  const allMatches = [...fileMatches, ...localOnly]
  const merged: Match[] = allMatches.map((m) => {
    const num = matchNumberFromId(m.id)
    const excludeFromStats = num !== null
      ? EXCLUDED_MATCH_NUMBERS.has(num)
      : (localById.get(m.id)?.excludeFromStats ?? m.excludeFromStats)
    return { ...m, excludeFromStats: excludeFromStats || undefined }
  })
  merged.sort((a, b) => {
    const da = a.createdAt ? new Date(a.createdAt).getTime() : 0
    const db = b.createdAt ? new Date(b.createdAt).getTime() : 0
    return db - da
  })
  /* Esconde partidas que o usuário removeu aqui, mesmo que o servidor ainda as devolva (ex.: após F5 com save falho). */
  const deletedIds = new Set(loadDeletedMatchIds())
  const filtered = merged.filter((m) => !deletedIds.has(m.id))
  return { players, matches: filtered }
}

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

export function getEloByStep(step: number): { label: string; tier: string } {
  const idx = Math.max(0, Math.min(ELO_LADDER.length - 1, step))
  return ELO_LADDER[idx]
}

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

export function computeRanking(players: Player[], matches: Match[]): PlayerStats[] {
  const countingMatches = matches.filter((m) => !m.excludeFromStats)
  const wins = new Map<string, number>()
  const losses = new Map<string, number>()
  players.forEach((p) => { wins.set(p.id, 0); losses.set(p.id, 0) })

  const matchesAsc = [...countingMatches].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
  matchesAsc.forEach((m) => {
    m.winnerIds.forEach((id) => wins.set(id, (wins.get(id) ?? 0) + 1))
    m.loserIds.forEach((id) => losses.set(id, (losses.get(id) ?? 0) + 1))
  })

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

  const LAST_N = 10
  return players
    .map((player) => {
      const w = wins.get(player.id) ?? 0
      const l = losses.get(player.id) ?? 0
      const total = w + l
      const winRate = total > 0 ? ((w / total) * 100).toFixed(1) : '—'
      const eloStep = total > 0 ? (eloStepByPlayer.get(player.id) ?? 0) : -1
      const { label, tier } = eloStep >= 0 ? getEloByStep(eloStep) : { label: '—', tier: 'unranked' }
      const { streak, bestWinStreak, lastResults } = computeStreakAndLastResults(player.id, matchesAsc, LAST_N)
      return {
        player,
        wins: w,
        losses: l,
        winRate,
        eloStep,
        patente: label,
        patenteTier: tier,
        lastResults: lastResults.length > 0 ? lastResults : undefined,
        streak: streak && streak.count > 0 ? streak : undefined,
        bestWinStreak: bestWinStreak > 0 ? bestWinStreak : undefined,
      }
    })
    .sort((a, b) => {
      if (b.eloStep !== a.eloStep) return b.eloStep - a.eloStep
      if (b.wins !== a.wins) return b.wins - a.wins
      return (a.losses ?? 0) - (b.losses ?? 0)
    })
}

export function findPlayerByName(players: Player[], name: string): Player | undefined {
  const n = name.trim().toLowerCase()
  return players.find((p) => p.name.trim().toLowerCase() === n)
}

/** Evolução de ELO e win rate por partida (apenas partidas que contam). */
export function computePlayerEvolution(playerId: string, matches: Match[]): { eloSteps: number[]; winrates: number[] } {
  const counting = matches.filter((m) => !m.excludeFromStats)
  const matchesAsc = [...counting].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
  const eloSteps: number[] = []
  const winrates: number[] = []
  let step = 0
  let wins = 0
  let losses = 0
  const maxStep = 38
  for (const m of matchesAsc) {
    const won = m.winnerIds.includes(playerId)
    const played = won || m.loserIds.includes(playerId)
    if (!played) continue
    if (won) {
      step = Math.min(step + 1, maxStep)
      wins++
    } else {
      step = Math.max(step - 1, 0)
      losses++
    }
    eloSteps.push(step)
    const total = wins + losses
    winrates.push(total > 0 ? (wins / total) * 100 : 0)
  }
  return { eloSteps, winrates }
}

/** Confronto direto: vitórias em times opostos e partidas juntos (apenas partidas que contam). */
export function computeHeadToHead(
  player1Id: string,
  player2Id: string,
  matches: Match[]
): { p1WinsOpposite: number; p2WinsOpposite: number; matchesTogether: number; winsTogether: number } {
  const counting = matches.filter((m) => !m.excludeFromStats)
  let p1WinsOpposite = 0
  let p2WinsOpposite = 0
  let matchesTogether = 0
  let winsTogether = 0
  for (const m of counting) {
    const p1Won = m.winnerIds.includes(player1Id)
    const p2Won = m.winnerIds.includes(player2Id)
    const p1Played = p1Won || m.loserIds.includes(player1Id)
    const p2Played = p2Won || m.loserIds.includes(player2Id)
    if (!p1Played || !p2Played) continue
    const sameTeam = (m.winnerIds.includes(player1Id) && m.winnerIds.includes(player2Id)) || (m.loserIds.includes(player1Id) && m.loserIds.includes(player2Id))
    if (sameTeam) {
      matchesTogether++
      if (p1Won && p2Won) winsTogether++
    } else {
      if (p1Won) p1WinsOpposite++
      if (p2Won) p2WinsOpposite++
    }
  }
  return { p1WinsOpposite, p2WinsOpposite, matchesTogether, winsTogether }
}
