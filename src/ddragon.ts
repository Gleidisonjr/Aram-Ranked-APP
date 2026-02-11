/**
 * Data Dragon (Riot CDN) — ícones e nomes de campeões, sem API key.
 * https://ddragon.leagueoflegends.com
 */

const VERSIONS_URL = 'https://ddragon.leagueoflegends.com/api/versions.json'
const CHAMPION_LIST_URL = (version: string) =>
  `https://ddragon.leagueoflegends.com/cdn/${version}/data/pt_BR/champion.json`

let cachedVersion: string | null = null
let cachedChampions: Map<string, string> | null = null
/** Mapeia nome normalizado → ID canônico (ex: "varus" → "Varus") para estatísticas case-insensitive. */
let cachedChampionIds: Map<string, string> | null = null

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/'/g, '')
    .replace(/\./g, '')
}

/** Carrega versão atual e lista de campeões (cache em memória). */
export async function loadChampionData(): Promise<void> {
  if (cachedChampions) return
  try {
    const versionsRes = await fetch(VERSIONS_URL)
    const versions = (await versionsRes.json()) as string[]
    const version = versions[0]
    if (!version) return
    cachedVersion = version
    const champRes = await fetch(CHAMPION_LIST_URL(version))
    const data = (await champRes.json()) as {
      data: Record<string, { id: string; name: string; image?: { full: string } }>
    }
    const map = new Map<string, string>()
    const idMap = new Map<string, string>()
    for (const key of Object.keys(data.data || {})) {
      const champ = data.data[key]
      const id = champ.id
      const name = champ.name || id
      const imageName = champ.image?.full || `${id}.png`
      map.set(id, imageName)
      map.set(normalize(id), imageName)
      map.set(name, imageName)
      map.set(normalize(name), imageName)
      idMap.set(normalize(id), id)
      idMap.set(normalize(name), id)
    }
    cachedChampions = map
    cachedChampionIds = idMap
  } catch (_) {
    cachedChampions = new Map()
    cachedChampionIds = new Map()
  }
}

/**
 * Retorna o nome canônico do campeão (case-insensitive).
 * Ex: "varus", "VARUS" → "Varus". Usar ao salvar para que estatísticas e OTP funcionem corretamente.
 */
export function getCanonicalChampionName(input: string): string {
  const trimmed = input?.trim()
  if (!trimmed) return ''
  if (cachedChampionIds) {
    const canonical = cachedChampionIds.get(normalize(trimmed))
    if (canonical) return canonical
  }
  return trimmed
}

/**
 * Retorna a URL do ícone do campeão (ou null se não encontrar).
 * Aceita nome em PT-BR ou ID em inglês (ex: "Aatrox", "Lulu", "Aurelion Sol").
 */
export function getChampionIconUrl(championName: string): string | null {
  if (!championName || !cachedVersion || !cachedChampions) return null
  const trimmed = championName.trim()
  if (!trimmed) return null
  const byExact = cachedChampions.get(trimmed) ?? cachedChampions.get(normalize(trimmed))
  if (byExact)
    return `https://ddragon.leagueoflegends.com/cdn/${cachedVersion}/img/champion/${byExact}`
  return null
}

/** Retorna o nome do arquivo do ícone (ex: "Lulu.png") para uso em img alt. */
export function getChampionIconFilename(championName: string): string | null {
  if (!championName || !cachedChampions) return null
  const trimmed = championName.trim()
  if (!trimmed) return null
  return cachedChampions.get(trimmed) ?? cachedChampions.get(normalize(trimmed)) ?? null
}

/**
 * Retorna o ID do campeão no Data Dragon (ex: "Ahri", "MonkeyKing") ou null.
 */
export function getChampionId(championName: string): string | null {
  if (!championName || !cachedChampions) return null
  const trimmed = championName.trim()
  if (!trimmed) return null
  const imageFull = cachedChampions.get(trimmed) ?? cachedChampions.get(normalize(trimmed))
  if (!imageFull) return null
  const id = imageFull.replace(/\.png$/i, '')
  return id || null
}

/**
 * URL da splash art do campeão (tela de loading / arte completa).
 * Aceita nome em PT-BR ou ID (ex: "Malzahar", "Alistar"). skinIndex 0 = clássica.
 * Fonte: Riot Data Dragon (ddragon.leagueoflegends.com).
 */
export function getChampionSplashUrl(championName: string, skinIndex: number = 0): string | null {
  const id = getChampionId(championName)
  if (!id) return null
  return `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${id}_${skinIndex}.jpg`
}

/**
 * Retorna URL da splash preferida e URL de fallback (skin 0) para usar com onerror.
 * Útil para campeões que podem não ter skin N (ex.: Aurelion Sol, Briar, Naafiri).
 */
export function getChampionSplashUrls(championName: string, preferredSkinIndex: number): { primary: string; fallback: string } | null {
  const primary = getChampionSplashUrl(championName, preferredSkinIndex)
  const fallback = getChampionSplashUrl(championName, 0)
  if (!primary || !fallback) return primary ? { primary, fallback: primary } : null
  return { primary, fallback }
}

export type ChampionSkin = { num: number; name: string; splashUrl: string }

let cachedSkins: Map<string, ChampionSkin[]> = new Map()

/**
 * Lista todas as skins do campeão com nome e URL da splash art.
 * Requer loadChampionData() já chamado. Resultado é cacheado por campeão.
 * Fonte: Riot Data Dragon (JSON por campeão).
 */
export async function getChampionSkins(championName: string): Promise<ChampionSkin[]> {
  const id = getChampionId(championName)
  if (!id || !cachedVersion) return []
  const cacheKey = id.toLowerCase()
  const hit = cachedSkins.get(cacheKey)
  if (hit) return hit
  try {
    const url = `https://ddragon.leagueoflegends.com/cdn/${cachedVersion}/data/en_US/champion/${id}.json`
    const res = await fetch(url)
    if (!res.ok) return []
    const json = (await res.json()) as {
      data?: Record<string, { skins?: Array<{ num: number; name: string }> }>
    }
    const champ = json.data?.[id]
    const skins = champ?.skins ?? []
    const list: ChampionSkin[] = skins.map((s) => ({
      num: s.num,
      name: s.name,
      splashUrl: `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${id}_${s.num}.jpg`,
    }))
    cachedSkins.set(cacheKey, list)
    return list
  } catch {
    return []
  }
}

/**
 * Ícones de ELO (patente) — arte estilo LoL (jsDelivr CDN).
 * Fonte: https://github.com/magisteriis/lol-icons-and-emblems (ranked-emblems)
 */
const RANK_EMBLEM_BASE = 'https://cdn.jsdelivr.net/gh/magisteriis/lol-icons-and-emblems@master/ranked-emblems'
const TIER_TO_EMBLEM: Record<string, string> = {
  ferro: 'Iron',
  bronze: 'Bronze',
  prata: 'Silver',
  ouro: 'Gold',
  platina: 'Platinum',
  esmeralda: 'Emerald', /* imagem local em public/ranked-emblem/Emblem_Emerald.png */
  diamante: 'Diamond',
  mestre: 'Master',
  'grao-mestre': 'Grandmaster',
  challenger: 'Challenger',
}

/** Base URL do app (ex.: '' ou '/Aram-Ranked-APP/') para assets locais. */
function getBaseUrl(): string {
  try {
    return (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? ''
  } catch {
    return ''
  }
}

/** Retorna a URL do emblema de patente (ELO) do LoL, ou null se o tier não for reconhecido. */
export function getRankEmblemUrl(patenteTier: string | undefined): string | null {
  if (!patenteTier) return null
  const tier = patenteTier.toLowerCase()
  if (tier === 'boss') {
    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="bossGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f0fdfa"/>
      <stop offset="30%" stop-color="#ccfbf1"/>
      <stop offset="60%" stop-color="#5eead4"/>
      <stop offset="100%" stop-color="#2dd4bf"/>
    </linearGradient>
  </defs>
  <rect x="6" y="6" width="116" height="116" rx="18" fill="#0c4a6e" stroke="url(#bossGrad)" stroke-width="6"/>
  <rect x="18" y="18" width="92" height="92" rx="14" fill="url(#bossGrad)" stroke="#0c4a6e" stroke-width="4"/>
  <text x="64" y="70" font-size="28" font-family="Outfit, Arial, sans-serif" font-weight="800" text-anchor="middle" dominant-baseline="middle" fill="#0c4a6e">BOSS</text>
</svg>`
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
  }
  const name = TIER_TO_EMBLEM[tier]
  if (!name) return null
  /* Esmeralda: usar imagem local que o usuário adicionou */
  if (tier === 'esmeralda') {
    const base = getBaseUrl().replace(/\/+$/, '')
    return `${base ? base + '/' : ''}ranked-emblem/Emblem_Emerald.png`
  }
  return `${RANK_EMBLEM_BASE}/Emblem_${name}.png`
}

