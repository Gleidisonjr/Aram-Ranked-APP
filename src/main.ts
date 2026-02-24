import './style.css'
import type { Match, ChampionPick, PlayerStats, KdaEntry, Player } from './types'
import {
  loadPlayers,
  savePlayers,
  loadMatches,
  saveMatches,
  computeRanking,
  loadFromFile,
  mergeRankingData,
  loadSeason,
  saveSeason,
  getAchievementDef,
  getEloByStep,
  findPlayerByName,
  saveRankingToServer,
  extractMatchFromImage,
  type ExtractedMatchData,
} from './store'
// import type { ImportPrintData } from './store' // usado na createPrintImportSection (comentada)
import { loadChampionData, getChampionIconUrl, getRankEmblemUrl, getChampionSplashUrl, getChampionSplashUrls, getCanonicalChampionName } from './ddragon'

/** Toca um som opcional da pasta public/sounds/. Use para sortear: "sortear-start" (ao clicar) e "sortear-done" (ao exibir resultado). */
function playSound(name: string): void {
  try {
    const base = (import.meta.env.BASE_URL ?? '').replace(/\/+$/, '')
    const url = `${base ? base + '/' : '/'}sounds/${name}.mp3`
    const audio = new Audio(url)
    audio.volume = 0.7
    audio.play().catch(() => {})
  } catch {
    // ignore
  }
}

/** Retorna o HTML da tag de badge do jogador (Boss, Troll, etc.). */
function getPlayerBadgeHtml(player: Pick<Player, 'badge'>): string {
  if (player.badge === 'creator') return ' <span class="player-badge-boss">Boss</span>'
  if (player.badge === 'troll') return ' <span class="player-badge-troll">Troll</span>'
  return ''
}

let players = loadPlayers()
let matches = loadMatches()
let matchLimit: number | null = null

async function init() {
  const file = await loadFromFile()
  const merged = mergeRankingData(file, loadPlayers(), loadMatches())
  players = merged.players
  matches = merged.matches
  savePlayers(players)
  saveMatches(matches)
  await loadChampionData()
  rerender()
}

async function restoreFromFile() {
  const file = await loadFromFile()
  if (!file) {
    alert('Não foi possível carregar o arquivo ranking.json.')
    return
  }
  // Usa apenas as partidas do arquivo (ignora partidas que existem só no localStorage),
  // para que "Restaurar dados" reflita exatamente o que está no ranking.json.
  const merged = mergeRankingData(file, loadPlayers(), [])
  players = merged.players
  matches = merged.matches
  savePlayers(players)
  saveMatches(matches)
  rerender()
  alert(`Dados restaurados: ${players.length} jogadores e ${matches.length} partidas.`)
}

function startNewSeason() {
  if (!confirm('Iniciar nova temporada? Todas as partidas serão apagadas. Os jogadores são mantidos.')) return
  if (!confirm('Última confirmação: isso apagará todo o histórico de partidas. Tem certeza?')) return
  matches = []
  saveMatches(matches)
  const now = new Date()
  const label = `${['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][now.getMonth()]} ${now.getFullYear()}`
  saveSeason(label)
  rerender()
}

function rerender() {
  const filtered = matchLimit != null ? matches.slice(0, matchLimit) : matches
  const ranking = computeRanking(players, filtered)
  renderApp(ranking)
}

function addPlayer(name: string) {
  const trimmed = name.trim()
  if (!trimmed) return
  if (players.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) return
  const id = `p-${Date.now()}-${trimmed.replace(/\s/g, '-').toLowerCase()}`
  players = [...players, { id, name: trimmed }]
  savePlayers(players)
  rerender()
}

function addMatch(winnerIds: string[], loserIds: string[], picks: ChampionPick[], kda?: KdaEntry[]): Match | null {
  if (winnerIds.length === 0 || loserIds.length === 0) return null
  const match: Match = {
    id: `m-${Date.now()}`,
    winnerIds,
    loserIds,
    picks,
    kda: kda?.length ? kda : undefined,
    createdAt: new Date().toISOString(),
  }
  matches = [match, ...matches]
  saveMatches(matches)
  rerender()
  return match
}

async function updateMatch(matchId: string, picks: ChampionPick[], kda: KdaEntry[], imageUrl?: string) {
  const idx = matches.findIndex((m) => m.id === matchId)
  if (idx < 0) return
  matches = [...matches]
  matches[idx] = { ...matches[idx], picks, kda: kda.length ? kda : undefined, imageUrl: imageUrl?.trim() || undefined }
  saveMatches(matches)
  rerender()
  const result = await saveRankingToServer({ players, matches })
  if (!result.ok) {
    console.warn('Salvo localmente. Persistência no servidor falhou:', result.error)
  }
}

function renderApp(ranking: PlayerStats[]) {
  const app = document.querySelector<HTMLDivElement>('#app')!
  app.innerHTML = ''
  app.appendChild(createLayout(ranking))
}

export type HighlightBadge = { label: string; theme: 'positive' | 'negative' }
export type HighlightsData = {
  mostKills: PlayerStats | null
  mostDeaths: PlayerStats | null
  mostAssists: PlayerStats | null
  mostWins: PlayerStats | null
  mostLosses: PlayerStats | null
  bestKd: PlayerStats | null
  worstKd: PlayerStats | null
  bestKdRatio: string
  worstKdRatio: string
  mostWinsChamp: { name: string; wins: number } | null
  mostLosingChamp: { name: string; losses: number } | null
}

let lastHighlightsData: HighlightsData | null = null

function computeHighlightsData(ranking: PlayerStats[], filteredMatches: Match[]): HighlightsData {
  const championStats: Record<string, { wins: number; games: number; kills: number; deaths: number; assists: number }> = {}
  filteredMatches.forEach((m) => {
    const winnerSet = new Set(m.winnerIds)
    const kdaByPlayer = new Map((m.kda ?? []).map((e) => [e.playerId, e]))
    m.picks.forEach(({ playerId, champion }) => {
      const key = champion.trim() || '—'
      if (!championStats[key]) championStats[key] = { wins: 0, games: 0, kills: 0, deaths: 0, assists: 0 }
      championStats[key].games++
      if (winnerSet.has(playerId)) championStats[key].wins++
      const k = kdaByPlayer.get(playerId)
      if (k) {
        championStats[key].kills += k.kills
        championStats[key].deaths += k.deaths
        championStats[key].assists += k.assists
      }
    })
  })
  const MIN_GAMES_CHAMPION = 2
  const championEntries = Object.entries(championStats).filter(([, s]) => s.games >= MIN_GAMES_CHAMPION)
  const mostWinsChamp = championEntries.reduce<{ name: string; wins: number } | null>((best, [name, s]) => {
    if (!best) return { name, wins: s.wins }
    return s.wins > best.wins ? { name, wins: s.wins } : best
  }, null)
  const mostLosingChamp = championEntries.reduce<{ name: string; losses: number } | null>((best, [name, s]) => {
    const losses = s.games - s.wins
    if (!best) return { name, losses }
    return losses > best.losses ? { name, losses } : best
  }, null)
  const elo = (s: PlayerStats) => s.eloStep ?? -1
  // Positivos: em empate, maior ELO fica com o badge. Negativos: em empate, menor ELO fica com o badge.
  const mostKills = ranking.reduce<PlayerStats | null>((best, s) => {
    const k = s.kda?.kills ?? 0
    const bestK = best?.kda?.kills ?? 0
    if (!best) return k > 0 ? s : null
    if (k > bestK) return s
    if (k === bestK && elo(s) > elo(best)) return s
    return best
  }, null)
  const mostDeaths = ranking.reduce<PlayerStats | null>((best, s) => {
    const d = s.kda?.deaths ?? 0
    const bestD = best?.kda?.deaths ?? 0
    if (!best) return d > 0 ? s : null
    if (d > bestD) return s
    if (d === bestD && elo(s) < elo(best)) return s
    return best
  }, null)
  const mostAssists = ranking.reduce<PlayerStats | null>((best, s) => {
    const a = s.kda?.assists ?? 0
    const bestA = best?.kda?.assists ?? 0
    if (!best) return a > 0 ? s : null
    if (a > bestA) return s
    if (a === bestA && elo(s) > elo(best)) return s
    return best
  }, null)
  const mostWins = ranking.reduce<PlayerStats | null>((best, s) => {
    if (!best) return s.wins > 0 ? s : null
    if (s.wins > best.wins) return s
    if (s.wins === best.wins && elo(s) > elo(best)) return s
    return best
  }, null)
  const mostLosses = ranking.reduce<PlayerStats | null>((best, s) => {
    if (!best) return s.losses > 0 ? s : null
    if (s.losses > best.losses) return s
    if (s.losses === best.losses && elo(s) < elo(best)) return s
    return best
  }, null)
  const bestKd = ranking.reduce<PlayerStats | null>((best, s) => {
    if (!s.kda?.games) return best
    const d = Math.max(s.kda.deaths ?? 0, 1)
    const ratio = (s.kda.kills + s.kda.assists) / d
    if (!best) return s
    const bestD = Math.max(best.kda?.deaths ?? 0, 1)
    const bestRatio = ((best.kda?.kills ?? 0) + (best.kda?.assists ?? 0)) / bestD
    if (ratio > bestRatio) return s
    if (ratio === bestRatio && elo(s) > elo(best)) return s
    return best
  }, null)
  const worstKd = ranking.reduce<PlayerStats | null>((worst, s) => {
    if (!s.kda?.games) return worst
    const ratio = (s.kda.kills + s.kda.assists) / Math.max(s.kda.deaths, 1)
    if (!worst) return s
    const wRatio = (worst.kda!.kills + worst.kda!.assists) / Math.max(worst.kda!.deaths, 1)
    if (ratio < wRatio) return s
    if (ratio === wRatio && elo(s) < elo(worst)) return s
    return worst
  }, null)
  const bestKdRatio = bestKd?.kda ? ((bestKd.kda.kills + bestKd.kda.assists) / Math.max(bestKd.kda.deaths, 1)).toFixed(1) : '—'
  const worstKdRatio = worstKd?.kda ? ((worstKd.kda.kills + worstKd.kda.assists) / Math.max(worstKd.kda.deaths, 1)).toFixed(1) : '—'
  return {
    mostKills, mostDeaths, mostAssists, mostWins, mostLosses, bestKd, worstKd,
    bestKdRatio, worstKdRatio, mostWinsChamp, mostLosingChamp,
  }
}

/* Ordem dos badges: linha 1 (positivos) Mais vitórias, Melhor K/D, Mais abates, Mais assistências; linha 2 (negativos) Mais derrotas, Pior K/D, Mais mortes */
function getHighlightBadgesForPlayer(h: HighlightsData | null, playerId: string): HighlightBadge[] {
  if (!h) return []
  const badges: HighlightBadge[] = []
  if (h.mostWins?.player.id === playerId) badges.push({ label: 'Mais vitórias', theme: 'positive' })
  if (h.bestKd?.player.id === playerId) badges.push({ label: 'Melhor K/D', theme: 'positive' })
  if (h.mostKills?.player.id === playerId) badges.push({ label: 'Mais abates', theme: 'positive' })
  if (h.mostAssists?.player.id === playerId) badges.push({ label: 'Mais assistências', theme: 'positive' })
  if (h.mostLosses?.player.id === playerId) badges.push({ label: 'Mais derrotas', theme: 'negative' })
  if (h.worstKd?.player.id === playerId) badges.push({ label: 'Pior K/D', theme: 'negative' })
  if (h.mostDeaths?.player.id === playerId) badges.push({ label: 'Mais mortes', theme: 'negative' })
  return badges
}

/** Destaques por partida: MVP, dano/cura/torres, maior sequência de abates, maior multiabate, mais assistências. */
export type MatchHighlightIds = {
  mvpPlayerId: string | null
  topAssistsPlayerId: string | null
  topDamageToChampionsPlayerId: string | null
  topDamageReceivedPlayerId: string | null
  topHealedPlayerId: string | null
  topSelfMitigatedPlayerId: string | null
  topDamageToTowersPlayerId: string | null
  topKillStreakPlayerId: string | null
  topMultikillPlayerId: string | null
}

function getMatchHighlightIds(m: Match): MatchHighlightIds {
  const winnerSet = new Set(m.winnerIds)
  const kdaList = m.kda ?? []
  const stats = m.matchExtendedStats ?? []
  const result: MatchHighlightIds = {
    mvpPlayerId: null,
    topAssistsPlayerId: null,
    topDamageToChampionsPlayerId: null,
    topDamageReceivedPlayerId: null,
    topHealedPlayerId: null,
    topSelfMitigatedPlayerId: null,
    topDamageToTowersPlayerId: null,
    topKillStreakPlayerId: null,
    topMultikillPlayerId: null,
  }
  const allPlayerIds = [...m.winnerIds, ...m.loserIds]
  if (allPlayerIds.length === 0) return result

  let maxDamage = 0
  let maxReceived = 0
  let maxHealed = 0
  let maxMitigated = 0
  let maxTowers = 0
  let maxKillStreak = 0
  let maxMultikill = 0
  stats.forEach((s) => {
    const d = s.damageToChampions ?? 0
    const r = s.damageReceived ?? 0
    const h = s.damageHealed ?? 0
    const mit = s.damageSelfMitigated ?? 0
    const tow = s.damageToTowers ?? 0
    const streak = s.largestKillStreak ?? 0
    const multi = s.largestMultikill ?? 0
    if (d > maxDamage) {
      maxDamage = d
      result.topDamageToChampionsPlayerId = s.playerId
    }
    if (r > maxReceived) {
      maxReceived = r
      result.topDamageReceivedPlayerId = s.playerId
    }
    if (h > maxHealed) {
      maxHealed = h
      result.topHealedPlayerId = s.playerId
    }
    if (mit > maxMitigated) {
      maxMitigated = mit
      result.topSelfMitigatedPlayerId = s.playerId
    }
    if (tow > maxTowers) {
      maxTowers = tow
      result.topDamageToTowersPlayerId = s.playerId
    }
    if (streak > maxKillStreak) {
      maxKillStreak = streak
      result.topKillStreakPlayerId = s.playerId
    }
    if (multi > maxMultikill) {
      maxMultikill = multi
      result.topMultikillPlayerId = s.playerId
    }
  })

  // Mais assistências na partida (do KDA)
  if (kdaList.length > 0) {
    const maxAssists = Math.max(...kdaList.map((e) => e.assists))
    if (maxAssists > 0) {
      const top = kdaList.find((e) => e.assists === maxAssists)
      if (top) result.topAssistsPlayerId = top.playerId
    }
  }

  // MVP = maior ratio KDA (sem usar dano/cura — não temos esses dados do print)
  let bestMvpScore = -1
  for (const playerId of allPlayerIds) {
    const kda = kdaList.find((e) => e.playerId === playerId)
    const d = Math.max(kda?.deaths ?? 0, 1)
    const ratio = kda ? (kda.kills + kda.assists) / d : 0
    const isWinner = winnerSet.has(playerId)
    const mvpScore = ratio * (isWinner ? 1.5 : 0.5)
    if (mvpScore > bestMvpScore) {
      bestMvpScore = mvpScore
      result.mvpPlayerId = playerId
    }
  }
  if (kdaList.length === 0) result.mvpPlayerId = null
  // Não usamos topDamageToChampions — não temos dados de dano do print
  result.topDamageToChampionsPlayerId = null
  return result
}

function createLayout(ranking: PlayerStats[]) {
  const el = document.createElement('div')
  el.className = 'layout'
  const modal = createProfileModal()
  const otpModal = createOtpDetailModal()
  const editMatchModal = createEditMatchModal()
  const filteredMatches = matchLimit != null ? matches.slice(0, matchLimit) : matches
  const highlightsData = computeHighlightsData(ranking, filteredMatches)
  lastHighlightsData = highlightsData
  // Ordem: Ranking → Sortear times → Destaques → Recordes → Histórico → Comparar jogadores → Comparar campeões → OTP por campeão → Estatísticas por campeão → Gráficos
  el.append(
    createHeader(),
    createToolbar(),
    createRankingSection(ranking, highlightsData),
    createSortearTimesSection(),
    createHighlightsSection(ranking, highlightsData),
    createRecordsSection(filteredMatches, ranking),
    createHistorySection(),
    createAddMatchSection(),
    createComparePlayersSection(ranking, filteredMatches, highlightsData),
    createCompareChampionsSection(ranking, filteredMatches),
    createBestPlayerPerChampionSection(ranking, matches),
    createChampionStatsSection(ranking),
    createGraphicsSection(ranking, filteredMatches),
    // createDamageStatsSection(matches, ranking), // Estatísticas individuais — comentado para implementar com mais dados depois
    // createHallOfFameSection(matches, ranking), // Hall of Fame — comentado para implementar com mais calma depois
    modal,
    otpModal,
    editMatchModal
  )
  // Referências para seções comentadas (evita noUnusedLocals)
  if (false) void (_createRiotMatchSection_removed(), createDamageStatsSection(matches, ranking), createHallOfFameSection(matches, ranking))
  return el
}

function createProfileModal(): HTMLElement {
  const root = document.createElement('div')
  root.className = 'profile-modal'
  root.id = 'profile-modal'
  root.innerHTML = `
    <div class="profile-modal-overlay"></div>
    <div class="profile-modal-panel">
      <button type="button" class="profile-modal-close" aria-label="Fechar">×</button>
      <div class="profile-modal-content"></div>
    </div>
  `
  root.querySelector('.profile-modal-overlay')!.addEventListener('click', () => root.classList.remove('open'))
  root.querySelector('.profile-modal-close')!.addEventListener('click', () => root.classList.remove('open'))
  return root
}

function showProfileModal(s: PlayerStats, ranking: PlayerStats[]) {
  const root = document.getElementById('profile-modal')
  const content = root?.querySelector('.profile-modal-content')
  if (!root || !content) return
  const position = ranking.findIndex((p) => p.player.id === s.player.id) + 1
  const totalPlayers = ranking.length
  const achievements = (s.achievements ?? []).map((a) => {
    const def = getAchievementDef(a.id)
    return def ? { ...a, icon: def.icon, category: def.category } : null
  }).filter(Boolean) as { id: string; name: string; icon: string; category: string }[]
  const byCategory = new Map<string, typeof achievements>()
  achievements.forEach((a) => {
    if (!byCategory.has(a.category)) byCategory.set(a.category, [])
    byCategory.get(a.category)!.push(a)
  })
  const categoriesHtml = Array.from(byCategory.entries())
    .map(([cat, list]) => `
      <div class="profile-achievements-group">
        <h4>${escapeHtml(cat)}</h4>
        <div class="profile-badges">
          ${list.map((a) => `<span class="profile-badge" title="${escapeHtml(a.name)}"><span class="profile-badge-icon">${a.icon}</span> ${escapeHtml(a.name)}</span>`).join('')}
        </div>
      </div>
    `).join('')
  const totalKda = s.kda ? `${s.kda.kills} / ${s.kda.deaths} / ${s.kda.assists}` : '—'
  const badgeTag = getPlayerBadgeHtml(s.player)
  const leaderTag = position === 1 ? ' <span class="player-badge-leader" title="Segui o líder!">Líder</span>' : ''
  const lanternTag = position === totalPlayers && totalPlayers > 0 ? ' <span class="player-badge-lantern" title="Lanterna do ranking">Lanterna</span>' : ''
  const profileEmblemUrl = getRankEmblemUrl(s.patenteTier)
  const tierAttr = s.patenteTier ? ` data-tier="${escapeHtml(s.patenteTier.toLowerCase())}"` : ''
  const profileEmblemHtml = profileEmblemUrl
    ? `<div class="profile-elo-border-wrap"${tierAttr}><img class="profile-elo-emblem" src="${escapeHtml(profileEmblemUrl)}" alt="" width="40" height="40" /></div>`
    : ''
  const highlightBadges = getHighlightBadgesForPlayer(lastHighlightsData, s.player.id)
  const highlightBadgesHtml = highlightBadges.length > 0
    ? `<div class="profile-highlights">
        <h4>Destaques atuais</h4>
        <div class="profile-highlight-badges">
          ${highlightBadges.map((b) => `<span class="profile-highlight-badge profile-highlight-badge--${b.theme}" title="${escapeHtml(b.label)}">${escapeHtml(b.label)}</span>`).join('')}
        </div>
      </div>`
    : ''
  const profileTagsHtml = [badgeTag, leaderTag, lanternTag].filter(Boolean).join('') || ''
  const mostPlayed = s.championPlays[0]
  const bestChamp = s.championPlays.filter((c) => c.count >= 1).reduce<typeof s.championPlays[0] | null>(
    (best, c) => {
      const rate = c.wins / c.count
      if (!best) return c
      const bestRate = best.wins / best.count
      if (rate > bestRate) return c
      if (rate < bestRate) return best
      return (c.ratio ?? 0) >= (best.ratio ?? 0) ? c : best
    },
    null
  )
  const mostPlayedIcon = mostPlayed ? getChampionIconUrl(mostPlayed.champion) : null
  const bestChampIcon = bestChamp ? getChampionIconUrl(bestChamp.champion) : null
  const championsHtml = (mostPlayed || bestChamp)
    ? `<div class="profile-champions">
        <h4>Campeões mais utilizados</h4>
        <div class="profile-champion-rows">
          ${mostPlayed ? `<div class="profile-champion-row"><span class="profile-champion-label">Mais jogado</span>${mostPlayedIcon ? `<img class="profile-champion-icon" src="${escapeHtml(mostPlayedIcon)}" alt="" width="28" height="28" />` : ''}<span>${escapeHtml(mostPlayed.champion)}</span> <span class="profile-champion-count">${mostPlayed.count}x</span></div>` : ''}
          ${bestChamp ? `<div class="profile-champion-row"><span class="profile-champion-label">Melhor (win rate)</span>${bestChampIcon ? `<img class="profile-champion-icon" src="${escapeHtml(bestChampIcon)}" alt="" width="28" height="28" />` : ''}<span>${escapeHtml(bestChamp.champion)}</span> <span class="profile-champion-count">${((bestChamp.wins / bestChamp.count) * 100).toFixed(0)}%</span></div>` : ''}
        </div>
      </div>`
    : ''
  content.innerHTML = `
    <div class="profile-header">
      ${profileEmblemHtml}
      <div class="profile-header-text">
        <h3>${s.player.badge === 'creator' ? `<span class="player-name-boss">${escapeHtml(s.player.name)}</span>` : escapeHtml(s.player.name)}${profileTagsHtml}</h3>
        <span class="profile-elo">${escapeHtml(s.patente ?? '—')}</span>
      </div>
    </div>
    <div class="profile-stats">
      <span>${s.wins}V</span>
      <span>${s.losses}D</span>
      <span>${s.winRate}% win</span>
      <span>KDA total: ${totalKda}</span>
      ${s.streak ? `<span>Sequência: ${s.streak.count}${s.streak.type}</span>` : ''}
      ${s.bestWinStreak ? `<span>Recorde: ${s.bestWinStreak}V seguidas</span>` : ''}
    </div>
    ${highlightBadgesHtml}
    ${championsHtml}
    <div class="profile-achievements">
      <h4>Conquistas (${achievements.length})</h4>
      ${achievements.length > 0 ? categoriesHtml : '<p class="empty-hint">Nenhuma conquista ainda.</p>'}
    </div>
  `
  root.classList.add('open')
}

function isAdminMode(): boolean {
  return /\badmin=1\b/.test(window.location.search) || window.location.hash === '#admin' || window.location.hash.startsWith('#admin')
}

function createToolbar() {
  const bar = document.createElement('div')
  bar.className = 'toolbar'
  const toolbarBgUrl = getChampionSplashUrl('Yasuo', 1) ?? ''
  const toolbarBgStyle = toolbarBgUrl ? ` style="background-image: url(${escapeHtml(toolbarBgUrl)})"` : ''
  const adminToolsHtml = isAdminMode()
    ? `<button type="button" class="btn btn-secondary btn-sm btn-restore" title="Recarregar jogadores e partidas do ranking.json">Restaurar dados</button>
       <button type="button" class="btn btn-secondary btn-sm btn-save-server" title="Enviar dados atuais para o servidor (atualiza ranking.json no GitHub)">Salvar no servidor</button>
       <button type="button" class="btn btn-secondary btn-sm btn-new-season">Nova temporada</button>`
    : ''
  bar.innerHTML = `
    <div class="toolbar-bg"${toolbarBgStyle} aria-hidden="true"></div>
    <div class="toolbar-overlay"></div>
    <div class="toolbar-inner">
      <span class="season-label">Temporada: <strong>${escapeHtml(loadSeason())}</strong></span>
      <button type="button" class="btn btn-secondary btn-sm btn-refresh" title="Buscar atualizações do servidor (novas partidas)">Atualizar</button>
      ${adminToolsHtml}
    </div>
  `
  bar.querySelector('.btn-refresh')?.addEventListener('click', async () => {
    const btn = bar.querySelector('.btn-refresh')
    if (btn instanceof HTMLButtonElement) {
      btn.disabled = true
      btn.textContent = 'Atualizando…'
      const file = await loadFromFile()
      const merged = mergeRankingData(file, loadPlayers(), loadMatches())
      players = merged.players
      matches = merged.matches
      savePlayers(players)
      saveMatches(matches)
      rerender()
      btn.disabled = false
      btn.textContent = 'Atualizar'
    }
  })
  bar.querySelector('.btn-restore')?.addEventListener('click', () => restoreFromFile())
  bar.querySelector('.btn-save-server')?.addEventListener('click', async () => {
    const btn = bar.querySelector('.btn-save-server')
    if (btn instanceof HTMLButtonElement) {
      btn.disabled = true
      btn.textContent = 'Salvando…'
      const result = await saveRankingToServer({ players, matches })
      btn.disabled = false
      btn.textContent = 'Salvar no servidor'
      if (result.ok) alert('Ranking salvo no servidor.')
      else alert(`Erro ao salvar: ${result.error}`)
    }
  })
  bar.querySelector('.btn-new-season')?.addEventListener('click', startNewSeason)
  return bar
}

function createSortearTimesSection() {
  const section = document.createElement('section')
  section.className = 'card sortear-section no-print rounded-2xl border border-slate-600/50 bg-slate-800/40 shadow-xl overflow-hidden'
  const sortearBgUrl = getChampionSplashUrl('Lux', 1) ?? ''
  const sortearBgStyle = sortearBgUrl ? ` style="background-image: url(${escapeHtml(sortearBgUrl)})"` : ''
  section.innerHTML = `
    <div class="sortear-section-bg"${sortearBgStyle} aria-hidden="true"></div>
    <div class="sortear-section-overlay"></div>
    <div class="sortear-section-inner">
    <div class="px-6 pt-6 pb-1">
      <h2 class="text-xl font-bold text-white tracking-tight mb-1">Sortear times</h2>
      <p class="text-slate-400 text-sm mb-5">Marque pelo menos 5 jogadores (ARAM) e clique em Sortear para dividir em dois times aleatórios.</p>
      <div class="sortear-add-wrap flex flex-wrap items-center gap-3 mb-5">
        <input type="text" class="sortear-add-input min-w-[14rem] rounded-xl border border-slate-600 bg-slate-800/80 text-white placeholder-slate-500 px-4 py-2.5 text-sm focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 focus:outline-none transition" placeholder="Nome do jogador" maxlength="80" />
        <button type="button" class="sortear-add-btn rounded-xl px-4 py-2.5 text-sm font-semibold bg-slate-600 hover:bg-slate-500 text-white transition shadow">Adicionar ao sorteio</button>
      </div>
      <div class="sortear-checkboxes flex flex-wrap gap-2 mb-5"></div>
      <button type="button" class="sortear-btn rounded-xl px-6 py-3 text-sm font-bold bg-amber-500 hover:bg-amber-400 text-slate-900 transition shadow-lg hover:shadow-amber-500/20">Sortear times</button>
    </div>
    <div class="sortear-result px-6 pb-6 pt-2 min-h-[2rem]" aria-live="polite"></div>
    </div>
  `
  const checkboxesEl = section.querySelector('.sortear-checkboxes')!
  const resultEl = section.querySelector('.sortear-result')!
  const sortearBtn = section.querySelector('.sortear-btn')!
  const addInput = section.querySelector<HTMLInputElement>('.sortear-add-input')!
  const addBtn = section.querySelector<HTMLButtonElement>('.sortear-add-btn')!

  function renderCheckboxes() {
    checkboxesEl.innerHTML = ''
    players.forEach((p) => {
      const label = document.createElement('label')
      label.className = 'checkbox-label inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-700/40 px-3 py-2 text-sm text-slate-200 cursor-pointer hover:bg-slate-600/50 hover:border-slate-500 transition has-[:checked]:border-amber-500 has-[:checked]:bg-amber-500/15 has-[:checked]:ring-1 has-[:checked]:ring-amber-500/50'
      const badgeHtml = getPlayerBadgeHtml(p)
      const nameHtml = p.badge === 'creator' ? `<span class="player-name-boss">${escapeHtml(p.name)}</span>${badgeHtml}` : `${escapeHtml(p.name)}${badgeHtml}`
      label.innerHTML = `<input type="checkbox" class="sortear-player rounded border-slate-500 text-amber-500 focus:ring-amber-500/50" value="${p.id}" /> <span>${nameHtml}</span>`
      checkboxesEl.appendChild(label)
    })
  }
  renderCheckboxes()

  addBtn.addEventListener('click', () => {
    const trimmed = addInput.value.trim()
    if (!trimmed) {
      addInput.focus()
      return
    }
    if (players.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) {
      addInput.value = ''
      addInput.focus()
      return
    }
    addPlayer(trimmed)
    addInput.value = ''
  })
  addInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addBtn.click()
    }
  })

  sortearBtn.addEventListener('click', () => {
    const selected = Array.from(section.querySelectorAll<HTMLInputElement>('input.sortear-player:checked')).map((c) => c.value)
    const selectedPlayers = players.filter((p) => selected.includes(p.id))
    if (selectedPlayers.length < 5) {
      resultEl.innerHTML = '<p class="sortear-error m-0 text-red-400 text-sm font-medium">Selecione pelo menos 5 jogadores (ARAM).</p>'
      return
    }
    const ranking = computeRanking(players, matches)
    const statsById = new Map(ranking.map((s) => [s.player.id, s]))
    const leaderId = ranking.length > 0 ? ranking[0].player.id : ''
    const lanternId = ranking.length > 0 ? ranking[ranking.length - 1].player.id : ''
    function playerWithTagsHtml(p: { id: string; name: string; badge?: 'creator' | 'dev' | 'troll' }) {
      const tags: string[] = []
      const badgeHtml = getPlayerBadgeHtml(p)
      if (badgeHtml) tags.push(badgeHtml.trim())
      if (p.id === leaderId) tags.push('<span class="player-badge-leader" title="Segui o líder!">Líder</span>')
      if (p.id === lanternId) tags.push('<span class="player-badge-lantern" title="Lanterna do ranking">Lanterna</span>')
      const tagsHtml = tags.length > 0 ? ' ' + tags.join(' ') : ''
      const nameHtml = p.badge === 'creator' ? `<span class="player-name-boss">${escapeHtml(p.name)}</span>` : escapeHtml(p.name)
      return `${nameHtml}${tagsHtml}`
    }
    function eloBadgeHtml(playerId: string) {
      const s = statsById.get(playerId)
      const patente = s?.patente ?? '—'
      const tierClass = s?.patenteTier ? ` patente-${s.patenteTier}` : ' patente-none'
      return `<span class="sortear-elo patente-badge${tierClass} text-xs shrink-0">${escapeHtml(patente)}</span>`
    }
    const shuffled = [...selectedPlayers].sort(() => Math.random() - 0.5)
    const mid = Math.ceil(shuffled.length / 2)
    const team1 = shuffled.slice(0, mid)
    const team2 = shuffled.slice(mid)
    const sortearBtnEl = sortearBtn as HTMLButtonElement
    const originalBtnText = sortearBtnEl.textContent
    sortearBtnEl.disabled = true
    sortearBtnEl.textContent = 'Sortando...'
    playSound('sortear-start')
    setTimeout(() => {
      playSound('sortear-done')
      sortearBtnEl.disabled = false
      sortearBtnEl.textContent = originalBtnText
      const playerRowDelay = (base: number, i: number) => `${base + i * 0.04}s`
      resultEl.innerHTML = `
        <div class="sortear-result-header mb-4 pb-3 border-b border-slate-600">
          <p class="m-0 text-slate-400 text-sm font-medium">Resultado do sorteio</p>
        </div>
        <div class="sortear-teams flex flex-wrap items-stretch gap-5 mb-5">
          <div class="sortear-team flex-1 min-w-[180px] rounded-2xl border-2 border-amber-500/30 bg-gradient-to-b from-slate-800/80 to-slate-800/40 p-5 shadow-lg ring-1 ring-slate-700/50">
            <h4 class="m-0 mb-4 text-sm font-bold uppercase tracking-widest text-amber-400/90">Equipe 1</h4>
            <ul class="m-0 p-0 list-none space-y-2.5">${team1.map((p, i) => `<li class="py-2 px-3 rounded-xl bg-slate-700/50 text-slate-200 text-sm font-medium flex flex-wrap items-center justify-between gap-1.5" style="animation-delay: ${playerRowDelay(0.08, i)}"><span class="min-w-0">${playerWithTagsHtml(p)}</span>${eloBadgeHtml(p.id)}</li>`).join('')}</ul>
          </div>
          <div class="sortear-vs flex items-center justify-center shrink-0 w-14 text-3xl font-black text-amber-400 drop-shadow-sm">vs</div>
          <div class="sortear-team flex-1 min-w-[180px] rounded-2xl border-2 border-amber-500/30 bg-gradient-to-b from-slate-800/80 to-slate-800/40 p-5 shadow-lg ring-1 ring-slate-700/50">
            <h4 class="m-0 mb-4 text-sm font-bold uppercase tracking-widest text-amber-400/90">Equipe 2</h4>
            <ul class="m-0 p-0 list-none space-y-2.5">${team2.map((p, i) => `<li class="py-2 px-3 rounded-xl bg-slate-700/50 text-slate-200 text-sm font-medium flex flex-wrap items-center justify-between gap-1.5" style="animation-delay: ${playerRowDelay(0.28, i)}"><span class="min-w-0">${playerWithTagsHtml(p)}</span>${eloBadgeHtml(p.id)}</li>`).join('')}</ul>
          </div>
        </div>
        <div class="sortear-champions mt-5 pt-5 border-t border-slate-600">
          <h4 class="m-0 mb-1 text-sm font-bold text-slate-300">Campeão por jogador</h4>
          <p class="hint m-0 mb-3 text-slate-500 text-xs">Preencha manualmente para referência ao registrar a partida.</p>
          <div class="champion-inputs">
            ${[...team1, ...team2].map((p) => `<div class="champion-row">
              <span class="champion-name">${escapeHtml(p.name)}</span>
              <input type="text" class="champion-input" placeholder="Campeão" data-player-id="${escapeHtml(p.id)}" />
            </div>`).join('')}
          </div>
        </div>
        <div class="sortear-actions flex flex-wrap gap-3 mt-5">
          <button type="button" class="sortear-again rounded-xl px-5 py-2.5 text-sm font-semibold bg-amber-500 hover:bg-amber-400 text-slate-900 transition shadow">Sortear de novo</button>
          <button type="button" class="sortear-voltar rounded-xl px-5 py-2.5 text-sm font-semibold bg-slate-600 hover:bg-slate-500 text-white transition">Voltar</button>
        </div>
      `
      resultEl.querySelector('.sortear-again')?.addEventListener('click', () => (sortearBtn as HTMLButtonElement).click())
      resultEl.querySelector('.sortear-voltar')?.addEventListener('click', () => { resultEl.innerHTML = '' })
    }, 320)
  })

  return section
}

function createHeader() {
  const h = document.createElement('header')
  h.className = 'header'
  h.innerHTML = `
    <h1>ARAM Cabaré 100 Kenga</h1>
    <p class="subtitle">Aram Desordem, 3x3, 4x4, 5x5</p>
  `
  return h
}

function createHighlightsSection(ranking: PlayerStats[], h: HighlightsData) {
  const section = document.createElement('section')
  section.className = 'card highlights-section'
  if (ranking.length === 0 && !h.mostWinsChamp && !h.mostLosingChamp) {
    section.innerHTML = '<h2>Destaques</h2><p class="empty-hint">Nenhum dado ainda.</p>'
    return section
  }
  /* Campeão usado como fundo temático para cada destaque (quando não é destaque de campeão). */
  const THEME_SPLASH: Record<string, string> = {
    'Mais vitórias': 'Lux',
    'Melhor K/D': 'Ivern',
    'Mais abates': 'Katarina',
    'Mais assistências': 'Sona',
    'Mais derrotas': 'Thresh',
    'Pior K/D': 'Mordekaiser',
    'Mais mortes': 'Aatrox',
  }
  type HighlightItem = { label: string; name: string; valueStr: string; type: 'player' | 'champion'; theme: 'positive' | 'negative'; badgeLabel: string }
  /* Linha 1: Mais vitórias, Melhor K/D, Mais abates, Mais assistências, Campeão mais vencedor. Linha 2: Mais derrotas, Pior K/D, Mais mortes, Campeão mais perdedor. */
  const items: HighlightItem[] = [
    { label: 'Mais vitórias', name: h.mostWins?.player.name ?? '—', valueStr: String(h.mostWins?.wins ?? '—'), type: 'player', theme: 'positive', badgeLabel: 'Mais vitórias' },
    { label: 'Melhor K/D', name: h.bestKd?.player.name ?? '—', valueStr: h.bestKdRatio, type: 'player', theme: 'positive', badgeLabel: 'Melhor K/D' },
    { label: 'Mais abates', name: h.mostKills?.player.name ?? '—', valueStr: String(h.mostKills?.kda?.kills ?? '—'), type: 'player', theme: 'positive', badgeLabel: 'Mais abates' },
    { label: 'Mais assistências', name: h.mostAssists?.player.name ?? '—', valueStr: String(h.mostAssists?.kda?.assists ?? '—'), type: 'player', theme: 'positive', badgeLabel: 'Mais assistências' },
    { label: 'Campeão mais vencedor', name: h.mostWinsChamp?.name ?? '—', valueStr: h.mostWinsChamp ? `${h.mostWinsChamp.wins} vitórias` : '—', type: 'champion', theme: 'positive', badgeLabel: 'Campeão mais vencedor' },
    { label: 'Mais derrotas', name: h.mostLosses?.player.name ?? '—', valueStr: String(h.mostLosses?.losses ?? '—'), type: 'player', theme: 'negative', badgeLabel: 'Mais derrotas' },
    { label: 'Pior K/D', name: h.worstKd?.player.name ?? '—', valueStr: h.worstKdRatio, type: 'player', theme: 'negative', badgeLabel: 'Pior K/D' },
    { label: 'Mais mortes', name: h.mostDeaths?.player.name ?? '—', valueStr: String(h.mostDeaths?.kda?.deaths ?? '—'), type: 'player', theme: 'negative', badgeLabel: 'Mais mortes' },
    { label: 'Campeão mais perdedor', name: h.mostLosingChamp?.name ?? '—', valueStr: h.mostLosingChamp ? `${h.mostLosingChamp.losses} derrotas` : '—', type: 'champion', theme: 'negative', badgeLabel: 'Campeão mais perdedor' },
  ]
  const itemsHtml = items
    .map(
      (item) => {
        let bgUrl: string | null = null
        if (item.label === 'Mais vitórias') bgUrl = getRankEmblemUrl('challenger')
        else if (item.label === 'Mais derrotas') bgUrl = getRankEmblemUrl('ferro')
        else if (item.type === 'champion' && item.name !== '—') bgUrl = getChampionSplashUrl(item.name, 1)
        else bgUrl = getChampionSplashUrl(THEME_SPLASH[item.label] ?? 'Lux', 1)
        const bgStyle = bgUrl ? ` style="background-image: url(${escapeHtml(bgUrl)})"` : ''
        const badgeHtml = item.name !== '—' && item.badgeLabel
          ? `<span class="highlight-badge highlight-badge--${item.theme}" title="${escapeHtml(item.badgeLabel)}">${escapeHtml(item.badgeLabel)}</span>`
          : ''
        return `<div class="highlight-item highlight-item--${item.type} highlight-item--${item.theme}">
          <div class="highlight-item-bg"${bgStyle} aria-hidden="true"></div>
          <div class="highlight-item-overlay"></div>
          <span class="highlight-label">${escapeHtml(item.label)}</span>
          <div class="highlight-content">
            ${item.name !== '—' ? `<span class="highlight-name">${escapeHtml(item.name)} ${badgeHtml}</span><span class="highlight-num">${escapeHtml(item.valueStr)}</span>` : '<span class="highlight-empty">—</span>'}
          </div>
        </div>`
      }
    )
    .join('')
  const highlightsBgUrl = getChampionSplashUrl('Ahri', 1) ?? ''
  const highlightsBgStyle = highlightsBgUrl ? ` style="background-image: url(${escapeHtml(highlightsBgUrl)})"` : ''
  section.innerHTML = `<div class="highlights-section-bg"${highlightsBgStyle} aria-hidden="true"></div><div class="highlights-section-overlay"></div><h2>Destaques</h2><div class="highlights-grid">${itemsHtml}</div>`
  return section
}

function createRankingSection(ranking: PlayerStats[], highlightsData: HighlightsData) {
  const section = document.createElement('section')
  section.className = 'card ranking-section ranking-card-print'
  const rankingBgUrl = getChampionSplashUrl('Thresh', 1) ?? ''
  const rankingBgStyle = rankingBgUrl ? ` style="background-image: url(${escapeHtml(rankingBgUrl)})"` : ''
  section.innerHTML = `
    <div class="ranking-section-bg"${rankingBgStyle} aria-hidden="true"></div>
    <div class="ranking-section-overlay"></div>
    <div class="ranking-section-inner">
    <h2>Ranking</h2>
    <div class="table-wrap" aria-hidden="false">
      <table class="ranking-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Jogador</th>
            <th>ELO</th>
            <th>V/D</th>
            <th>Últimos</th>
            <th>Win%</th>
            <th>KDA</th>
            <th>Ratio</th>
            <th>Mais jogado</th>
            <th>Melhor</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    </div>
    <div class="ranking-cards" aria-label="Ranking em cards para leitura no celular" role="list"></div>
    </div>
  `
  const tbody = section.querySelector('tbody')!
  const cardsContainer = section.querySelector('.ranking-cards')!
  ranking.forEach((s, i) => {
    const pos = i + 1
    const tr = document.createElement('tr')
    const mostPlayed = s.championPlays[0]
    const bestByWinRate = s.championPlays
      .filter((c) => c.count >= 1)
      .reduce<typeof s.championPlays[0] | null>((best, c) => {
        const rate = c.wins / c.count
        if (!best) return c
        const bestRate = best.wins / best.count
        if (rate > bestRate) return c
        if (rate < bestRate) return best
        return (c.ratio ?? 0) >= (best.ratio ?? 0) ? c : best
      }, null)
    const tierClass = s.patenteTier ? ` patente-${s.patenteTier}` : ''
    const rankEmblemUrl = getRankEmblemUrl(s.patenteTier)
    const lastDots = (s.lastResults ?? [])
      .map((r) => `<span class="result-dot ${r === 'W' ? 'win' : 'loss'}" title="${r === 'W' ? 'Vitória' : 'Derrota'}">${r === 'W' ? 'V' : 'D'}</span>`)
      .join('')
    const badgeHtml = getPlayerBadgeHtml(s.player)
    const leaderBadgeHtml = pos === 1 ? ' <span class="player-badge-leader" title="Segui o líder!">Líder</span>' : ''
    const lastPos = ranking.length
    const lanternBadgeHtml = pos === lastPos ? ' <span class="player-badge-lantern" title="Lanterna do ranking">Lanterna</span>' : ''
    const mainBadgeHtml = (s.achievements ?? []).some((a) => a.id === 'main' || a.id === 'otp') ? ' <span class="player-badge-main" title="Main/OTP">Main</span>' : ''
    const highlightBadges = getHighlightBadgesForPlayer(highlightsData, s.player.id)
    const badgeSpan = (b: HighlightBadge) => `<span class="player-badge-highlight player-badge-highlight--${b.theme}" title="${escapeHtml(b.label)}">${escapeHtml(b.label)}</span>`
    const badgesHtml = highlightBadges.length > 0 ? highlightBadges.map(badgeSpan).join(' ') : ''
    const nameInnerClass = s.player.badge === 'creator' ? ' name-inner--boss' : ''
    const nameCellHtml = `<span class="name-inner${nameInnerClass}"><button type="button" class="name-btn-profile" title="Ver perfil e conquistas">${escapeHtml(s.player.name)}</button>${badgeHtml}${leaderBadgeHtml}${lanternBadgeHtml}${mainBadgeHtml} ${badgesHtml}</span>`
    const kdaHtml = s.kda
      ? `<span class="kda-k">${s.kda.kills}</span> / <span class="kda-d">${s.kda.deaths}</span> / <span class="kda-a">${s.kda.assists}</span>`
      : '—'
    const ratio = s.kda && s.kda.deaths > 0 ? (s.kda.kills + s.kda.assists) / s.kda.deaths : 0
    const kdaRatioStr = ratio > 0 ? ratio.toFixed(1) : '—'
    const kdaRatioClass = ratio >= 3 ? 'kda-ratio--elite' : ratio >= 1 ? 'kda-ratio--pos' : ratio > 0 ? 'kda-ratio--neg' : ''
    const winrateNum = parseFloat(s.winRate)
    const winrateClass = !Number.isNaN(winrateNum)
      ? winrateNum >= 75
        ? 'winrate--elite'
        : winrateNum >= 50
          ? 'winrate--pos'
          : 'winrate--neg'
      : ''
    const champBadge = (c: { champion: string; count: number; wins: number }, titleExtra?: string) => {
      const url = getChampionIconUrl(c.champion)
      const title = titleExtra ?? `${escapeHtml(c.champion)} (${c.count}x)`
      return `<span class="champ-badge" title="${title}">${url ? `<img class="champ-icon" src="${escapeHtml(url)}" alt="" width="24" height="24" /> ` : ''}${escapeHtml(c.champion)}</span>`
    }
    const mostPlayedHtml = mostPlayed ? champBadge(mostPlayed) : '—'
    const bestHtml = bestByWinRate
      ? champBadge(bestByWinRate, `${escapeHtml(bestByWinRate.champion)} · ${((bestByWinRate.wins / bestByWinRate.count) * 100).toFixed(0)}% vitórias`)
      : '—'
    const nameCellWithEmblem = rankEmblemUrl
      ? `<span class="name-cell-with-emoji"><img class="patente-emblem patente-emblem--${s.patenteTier ?? 'none'}" src="${escapeHtml(rankEmblemUrl)}" alt="" width="28" height="28" /></span>${nameCellHtml}`
      : nameCellHtml
    const rankNumClass = pos === 1 ? 'rank-num--gold' : pos === 2 ? 'rank-num--silver' : pos === 3 ? 'rank-num--bronze' : 'rank-num--white'
    const rankDisplay = pos === 1 ? '<span class="rank-medal" aria-hidden="true">🥇</span>' : pos === 2 ? '<span class="rank-medal" aria-hidden="true">🥈</span>' : pos === 3 ? '<span class="rank-medal" aria-hidden="true">🥉</span>' : String(pos)
    tr.innerHTML = `
      <td class="rank-num ${rankNumClass}">${rankDisplay}</td>
      <td class="name">${nameCellWithEmblem}</td>
      <td><div class="patente-cell"><span class="patente-badge${tierClass}" title="ELO: 1 vitória = sobe 1 divisão · 1 derrota = desce 1 (piso Ferro 4)">${escapeHtml(s.patente ?? '—')}</span></div></td>
      <td><div class="vd-cell"><span class="vd-wins">${s.wins}</span><span class="vd-sep"> — </span><span class="vd-losses">${s.losses}</span></div></td>
      <td><div class="last-results-cell">${lastDots || '—'}</div></td>
      <td class="winrate"><span class="winrate-val ${winrateClass}">${s.winRate}%</span></td>
      <td class="kda">${kdaHtml}</td>
      <td class="kda-ratio" title="(K+A)/D"><span class="kda-ratio-val ${kdaRatioClass}">${kdaRatioStr}</span></td>
      <td class="top-champ">${mostPlayedHtml}</td>
      <td class="top-champ">${bestHtml}</td>
    `
    tbody.appendChild(tr)
    tr.querySelector('.name-btn-profile')?.addEventListener('click', () => showProfileModal(s, ranking))

    const card = document.createElement('div')
    card.className = 'ranking-card'
    card.setAttribute('role', 'listitem')
    const cardNameWithEmblem = rankEmblemUrl
      ? `<span class="name-cell-with-emoji"><img class="patente-emblem patente-emblem--${s.patenteTier ?? 'none'}" src="${escapeHtml(rankEmblemUrl)}" alt="" width="24" height="24" /></span>${nameCellHtml}`
      : nameCellHtml
    const cardRankClass = pos === 1 ? 'rank-num--gold' : pos === 2 ? 'rank-num--silver' : pos === 3 ? 'rank-num--bronze' : 'rank-num--white'
    const cardRankDisplay = pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : String(pos)
    card.innerHTML = `
      <div class="ranking-card-header">
        <span class="ranking-card-rank rank-num ${cardRankClass}">${cardRankDisplay}</span>
        <div class="ranking-card-name-wrap">${cardNameWithEmblem}</div>
        <span class="ranking-card-elo"><span class="patente-badge${tierClass}">${escapeHtml(s.patente ?? '—')}</span></span>
      </div>
      <div class="ranking-card-body">
        <div class="ranking-card-row"><span class="ranking-card-label">V/D</span><span class="vd-wins">${s.wins}</span><span class="vd-sep"> — </span><span class="vd-losses">${s.losses}</span></div>
        <div class="ranking-card-row"><span class="ranking-card-label">Últimos</span><span class="last-results-cell">${lastDots || '—'}</span></div>
        <div class="ranking-card-row"><span class="ranking-card-label">Win%</span><span class="winrate-val ${winrateClass}">${s.winRate}%</span></div>
        <div class="ranking-card-row"><span class="ranking-card-label">KDA</span><span class="kda-colored">${kdaHtml}</span></div>
        <div class="ranking-card-row"><span class="ranking-card-label">Ratio</span><span class="kda-ratio-val ${kdaRatioClass}">${kdaRatioStr}</span></div>
        <div class="ranking-card-row"><span class="ranking-card-label">Mais jogado</span><span class="top-champ">${mostPlayedHtml}</span></div>
        <div class="ranking-card-row"><span class="ranking-card-label">Melhor</span><span class="top-champ">${bestHtml}</span></div>
      </div>
    `
    cardsContainer.appendChild(card)
    card.querySelector('.name-btn-profile')?.addEventListener('click', () => showProfileModal(s, ranking))
  })
  return section
}

/* TODO: Reativar depois com features corretas (partidas por dia, alinhado ao histórico).
function createActivitySection() {
  const section = document.createElement('section')
  section.className = 'card activity-section no-print'
  const WEEKS = 52
  const DAYS_PER_WEEK = 7
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const startDate = new Date(today)
  startDate.setDate(startDate.getDate() - WEEKS * DAYS_PER_WEEK)
  const dayOfWeek = (d: Date) => (d.getDay() + 6) % 7
  const startMonday = new Date(startDate)
  startMonday.setDate(startMonday.getDate() - dayOfWeek(startMonday))
  const toYMD = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
  const countsByDay = new Map<string, number>()
  matches.forEach((m) => {
    const raw = m.createdAt?.trim()
    if (!raw) return
    let d: Date
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      const [y, mo, day] = raw.split('-').map(Number)
      d = new Date(y, mo - 1, day)
    } else {
      d = new Date(raw)
    }
    if (Number.isNaN(d.getTime())) return
    const key = toYMD(d)
    countsByDay.set(key, (countsByDay.get(key) ?? 0) + 1)
  })
  const maxCount = Math.max(1, ...countsByDay.values())
  const getLevel = (count: number): number => {
    if (count <= 0) return 0
    if (maxCount <= 1) return 1
    if (count >= maxCount) return 4
    const t = count / maxCount
    if (t <= 0.25) return 1
    if (t <= 0.5) return 2
    if (t <= 0.75) return 3
    return 4
  }
  const monthLabels: { col: number; label: string }[] = []
  let lastMonth = -1
  for (let col = 0; col < WEEKS; col++) {
    const d = new Date(startMonday)
    d.setDate(d.getDate() + col * 7)
    const m = d.getMonth()
    if (m !== lastMonth) {
      monthLabels.push({ col, label: d.toLocaleDateString('pt-BR', { month: 'short' }) })
      lastMonth = m
    }
  }
  const monthLabelSpans = monthLabels.map(({ col, label }) => `<span class="activity-month" style="grid-column: ${col + 1}">${escapeHtml(label)}</span>`).join('')
  const dayLabels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
  let bodyRows = ''
  for (let row = 0; row < DAYS_PER_WEEK; row++) {
    bodyRows += `<span class="activity-day-label">${escapeHtml(dayLabels[row])}</span>`
    for (let col = 0; col < WEEKS; col++) {
      const cellDate = new Date(startMonday)
      cellDate.setDate(cellDate.getDate() + col * 7 + row)
      const key = toYMD(cellDate)
      const count = countsByDay.get(key) ?? 0
      const level = getLevel(count)
      const isFuture = cellDate > today
      const title = isFuture ? '' : count > 0 ? `${count} partida(s) em ${key}` : `Nenhuma partida em ${key}`
      bodyRows += `<span class="activity-cell activity-level-${level} ${isFuture ? 'activity-future' : ''}" title="${escapeHtml(title)}" data-date="${escapeHtml(key)}" data-count="${count}"></span>`
    }
  }
  section.innerHTML = `
    <h2>Atividade</h2>
    <p class="activity-subtitle">Partidas por dia</p>
    <div class="activity-graph">
      <div class="activity-months">${monthLabelSpans}</div>
      <div class="activity-body">${bodyRows}</div>
    </div>
    <div class="activity-legend">
      <span class="activity-legend-text">Menos</span>
      <span class="activity-cell activity-level-0"></span>
      <span class="activity-cell activity-level-1"></span>
      <span class="activity-cell activity-level-2"></span>
      <span class="activity-cell activity-level-3"></span>
      <span class="activity-cell activity-level-4"></span>
      <span class="activity-legend-text">Mais</span>
    </div>
  `
  return section
}
*/

function createHistorySection() {
  const section = document.createElement('section')
  section.className = 'card history-section no-print'
  section.innerHTML = `<div class="history-section-content"><h2>Histórico de partidas</h2><div class="history-list"></div></div>`
  const list = section.querySelector('.history-list')!
  const nameById = new Map(players.map((p) => [p.id, p.name]))
  if (matches.length === 0) {
    list.innerHTML = '<p class="empty-hint">Nenhuma partida ainda.</p>'
  } else {
    const total = matches.length
    const toShow = matches.slice(0, 20)
    toShow.forEach((m, i) => {
      const winnerNames = m.winnerIds.map((id) => nameById.get(id) ?? id)
      const loserNames = m.loserIds.map((id) => nameById.get(id) ?? id)
      const partidaNum = total - i
      const dateStr = m.createdAt
        ? new Date(m.createdAt).toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
            timeZone: 'America/Sao_Paulo',
          })
        : '—'
      const kdaList = m.kda ?? []
      const pickByPlayer = new Map(m.picks.map((p) => [p.playerId, p.champion]))
      let bestRatioPlayerId: string | null = null
      let bestRatio = -1
      let worstRatioPlayerId: string | null = null
      let worstRatio = Infinity
      let mostKillsPlayerId: string | null = null
      let mostKills = -1
      let mostDeathsPlayerId: string | null = null
      let mostDeaths = -1
      kdaList.forEach((e) => {
        const ratio = (e.kills + e.assists) / Math.max(e.deaths, 1)
        if (ratio > bestRatio) {
          bestRatio = ratio
          bestRatioPlayerId = e.playerId
        }
        if (ratio < worstRatio && e.deaths > 0) {
          worstRatio = ratio
          worstRatioPlayerId = e.playerId
        }
        if (e.kills > mostKills) {
          mostKills = e.kills
          mostKillsPlayerId = e.playerId
        }
        if (e.deaths > mostDeaths) {
          mostDeaths = e.deaths
          mostDeathsPlayerId = e.playerId
        }
      })
      const matchHighlights = getMatchHighlightIds(m)
      const allPlayerIds = [...m.winnerIds, ...m.loserIds]
      const kdaByPlayer = new Map(kdaList.map((e) => [e.playerId, e]))
      const playerRows = allPlayerIds.map((playerId) => {
        const name = nameById.get(playerId) ?? playerId
        const champ = pickByPlayer.get(playerId) ?? '—'
        const kda = kdaByPlayer.get(playerId)
        const kdaStr = kda ? `${kda.kills}/${kda.deaths}/${kda.assists}` : '—'
        const ratioStr = kda && kda.deaths > 0 ? ((kda.kills + kda.assists) / kda.deaths).toFixed(1) : '—'
        const badges: { label: string; theme: 'positive' | 'negative' }[] = []
        if (playerId === matchHighlights.mvpPlayerId) badges.push({ label: 'MVP', theme: 'positive' })
        if (playerId === bestRatioPlayerId) badges.push({ label: 'Melhor KDA', theme: 'positive' })
        if (playerId === mostKillsPlayerId) badges.push({ label: 'Mais abates', theme: 'positive' })
        if (playerId === matchHighlights.topAssistsPlayerId) badges.push({ label: 'Mais assistências', theme: 'positive' })
        if (playerId === matchHighlights.topHealedPlayerId) badges.push({ label: 'Mais curou', theme: 'positive' })
        if (playerId === matchHighlights.topSelfMitigatedPlayerId) badges.push({ label: 'Mais tankou', theme: 'positive' })
        if (playerId === worstRatioPlayerId) badges.push({ label: 'Pior KDA', theme: 'negative' })
        if (playerId === mostDeathsPlayerId) badges.push({ label: 'Mais mortes', theme: 'negative' })
        if (playerId === matchHighlights.topDamageReceivedPlayerId) badges.push({ label: 'Mais dano recebido', theme: 'negative' })
        if (playerId === matchHighlights.topDamageToTowersPlayerId) badges.push({ label: 'Mais dano a torres', theme: 'positive' })
        if (playerId === matchHighlights.topKillStreakPlayerId) badges.push({ label: 'Maior sequência de abates', theme: 'positive' })
        if (playerId === matchHighlights.topMultikillPlayerId) badges.push({ label: 'Maior multiabate', theme: 'positive' })
        const badgeHtml = badges.length > 0 ? badges.map((b) => `<span class="history-player-badge history-player-badge--${b.theme}">${escapeHtml(b.label)}</span>`).join(' ') : ''
        return `<tr><td class="history-player-name">${escapeHtml(name)}</td><td class="history-player-champ">${escapeHtml(champ)}</td><td class="history-player-kda">${kdaStr}</td><td class="history-player-ratio">${ratioStr}</td><td class="history-player-badges">${badgeHtml}</td></tr>`
      }).join('')
      const firstPickChamp = m.picks?.[0]?.champion
      const matchCardBgUrl = firstPickChamp ? getChampionSplashUrl(firstPickChamp, 1) : null
      const matchCardBgStyle = matchCardBgUrl ? ` style="background-image: url(${escapeHtml(matchCardBgUrl)})"` : ''
      const row = document.createElement('div')
      row.className = 'history-match-card history-match-card--collapsed'
      row.innerHTML = `
        <div class="history-match-card-bg"${matchCardBgStyle} aria-hidden="true"></div>
        <div class="history-match-card-overlay"></div>
        <div class="history-match-header" role="button" tabindex="0" aria-expanded="false" aria-label="Expandir detalhes da partida">
          <span class="history-match-toggle" aria-hidden="true"></span>
          <span class="history-num" title="Partida ${partidaNum} de ${total}">#${partidaNum}</span>
          <span class="history-date">${escapeHtml(dateStr)}</span>
          ${isAdminMode() ? `<button type="button" class="history-edit-btn rounded-lg px-2 py-1 text-xs font-medium bg-slate-600 hover:bg-slate-500 text-white" title="Editar campeão e KDA" data-match-id="${escapeHtml(m.id)}">Editar</button>` : ''}
        </div>
        <div class="history-match-body">
          ${m.imageUrl ? `
          <div class="history-match-image-wrap">
            <a href="${escapeHtml(m.imageUrl)}" target="_blank" rel="noopener noreferrer" class="history-match-image-link">
              <img src="${escapeHtml(m.imageUrl)}" alt="Print da partida" class="history-match-image" loading="lazy" />
            </a>
            <p class="history-match-image-hint">Print da partida — clique para ampliar</p>
          </div>
          ` : ''}
          <div class="history-match-teams">
            <div class="history-team history-team-winner">
              <span class="history-team-label">Vencedores</span>
              <span class="history-team-names">${winnerNames.map((n) => escapeHtml(n)).join(', ')}</span>
            </div>
            <div class="history-team history-team-loser">
              <span class="history-team-label">Perdedores</span>
              <span class="history-team-names">${loserNames.map((n) => escapeHtml(n)).join(', ')}</span>
            </div>
          </div>
          ${kdaList.length > 0 ? `
          <div class="history-match-kda">
            <table class="history-kda-table">
              <thead><tr><th>Jogador</th><th>Campeão</th><th>K/D/A</th><th>Ratio</th><th>Destaques</th></tr></thead>
              <tbody>${playerRows}</tbody>
            </table>
          </div>
          ` : ''}
        </div>
      `
      const header = row.querySelector('.history-match-header')!
      const editBtn = row.querySelector('.history-edit-btn')
      editBtn?.addEventListener('click', (e) => {
        e.stopPropagation()
        const matchId = (editBtn as HTMLElement).dataset.matchId
        const match = matches.find((m) => m.id === matchId)
        if (match) showEditMatchModal(match)
      })
      header.addEventListener('click', () => {
        const collapsed = row.classList.toggle('history-match-card--collapsed')
        header.setAttribute('aria-expanded', String(!collapsed))
      })
      header.addEventListener('keydown', (e) => {
        const ev = e as KeyboardEvent
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault()
          ;(header as HTMLElement).click()
        }
      })
      list.appendChild(row)
    })
    if (matches.length > 20) {
      const hint = document.createElement('p')
      hint.className = 'hint'
      hint.textContent = `Mostrando as 20 mais recentes (${matches.length} no total).`
      list.appendChild(hint)
    }
  }
  return section
}

/** URL fixa da API no Vercel (proxy Riot). Altere aqui se o deploy tiver outra URL. */
const RIOT_PROXY_BASE_URL = 'https://aram-ranked-hoxuicu3j-gleidisonjrs-projects.vercel.app'

/** Prefixos das Americas (BR, NA, LAN, LAS). Quando o usuário cola só o número, tentamos cada um. */
const AMERICAS_PREFIXES = ['BR1', 'NA1', 'LA1', 'LA2'] as const

/** Gera IDs para tentativa: se for só número, retorna lista BR1_, NA1_, etc.; senão retorna [input]. */
function getMatchIdsToTry(input: string): string[] {
  const trimmed = input.trim()
  if (/^\d+$/.test(trimmed)) return AMERICAS_PREFIXES.map((p) => `${p}_${trimmed}`)
  return [trimmed]
}

/* createRiotMatchSection — Removido por enquanto. Reativar quando for usar "Adicionar partida" via Match ID.
   A seção permitia buscar partida pela API da Riot e adicionar ao histórico. */
function _createRiotMatchSection_removed() {
  const section = document.createElement('section')
  section.className = 'card riot-match-section no-print'
  const riotSectionBgUrl = getChampionSplashUrl('Jinx', 1) ?? ''
  const riotSectionBgStyle = riotSectionBgUrl ? ` style="background-image: url(${escapeHtml(riotSectionBgUrl)})"` : ''
  const baseUrl = RIOT_PROXY_BASE_URL.replace(/\/+$/, '')
  section.innerHTML = `
    <div class="riot-match-section-bg"${riotSectionBgStyle} aria-hidden="true"></div>
    <div class="riot-match-section-overlay"></div>
    <div class="riot-match-section-inner">
    <h2>Adicionar partida</h2>
    <p class="hint">Informe o ID da partida. O app busca os dados e adiciona a partida ao histórico. <strong>Somente partidas normais ou ranqueadas</strong> — a API da Riot não retorna partidas personalizadas (custom).</p>
    <div class="riot-match-form">
      <div class="riot-match-field">
        <label for="riot-match-id">Match ID</label>
        <input type="text" id="riot-match-id" placeholder="Ex.: 3201828449 ou BR1_3201828449" />
      </div>
      <button type="button" class="btn btn-primary" id="riot-fetch-btn">Buscar e adicionar partida</button>
      <p class="riot-match-status" id="riot-match-status" aria-live="polite"></p>
    </div>
    </div>
  `
  const matchIdInput = section.querySelector<HTMLInputElement>('#riot-match-id')!
  const fetchBtn = section.querySelector<HTMLButtonElement>('#riot-fetch-btn')!
  const statusEl = section.querySelector<HTMLParagraphElement>('#riot-match-status')!

  fetchBtn.addEventListener('click', async () => {
    const raw = (matchIdInput.value || '').trim()
    if (!raw) {
      statusEl.textContent = 'Informe o ID da partida.'
      statusEl.className = 'riot-match-status riot-match-status--error'
      return
    }
    const idsToTry = getMatchIdsToTry(raw)
    statusEl.textContent = 'Buscando partida...'
    statusEl.className = 'riot-match-status'
    fetchBtn.disabled = true
    try {
      let res: Response | null = null
      let data: Record<string, unknown> = {}
      for (const matchId of idsToTry) {
        const url = `${baseUrl}/api/match?matchId=${encodeURIComponent(matchId)}&region=americas`
        const r = await fetch(url)
        const d = await r.json().catch(() => ({}))
        if (r.ok) {
          res = r
          data = d as Record<string, unknown>
          break
        }
        if (r.status === 404) continue
        const msg = (d as { error?: string }).error || ''
        statusEl.textContent = msg || `Erro ${r.status}. Tente novamente.`
        statusEl.className = 'riot-match-status riot-match-status--error'
        return
      }
      if (!res || !res.ok) {
        statusEl.textContent = 'Partida não encontrada. A API da Riot não retorna partidas personalizadas (custom) — só normais ou ranqueadas. Confira se o ID está correto e se a partida foi em um servidor das Américas (BR, NA, LAN, LAS).'
        statusEl.className = 'riot-match-status riot-match-status--error'
        return
      }
      const participants = (data.participants || []) as Array<{ gameName: string; teamId: number; win: boolean; championName: string; kills: number; deaths: number; assists: number }>
      if (participants.length === 0) {
        statusEl.textContent = 'Partida sem participantes na resposta.'
        statusEl.className = 'riot-match-status riot-match-status--error'
        return
      }
      const seenNames = new Set<string>()
      participants.forEach((p: { gameName: string }) => {
        const name = (p.gameName || '').trim()
        if (name && !seenNames.has(name.toLowerCase())) {
          seenNames.add(name.toLowerCase())
          const existing = findPlayerByName(players, name)
          if (!existing) addPlayer(name)
        }
      })
      players = loadPlayers()
      const winnerIds: string[] = []
      const loserIds: string[] = []
      const picks: ChampionPick[] = []
      const kda: KdaEntry[] = []
      participants.forEach((p: { gameName: string; teamId: number; win: boolean; championName: string; kills: number; deaths: number; assists: number }) => {
        const name = (p.gameName || '').trim()
        const player = findPlayerByName(players, name)
        if (!player) return
        if (p.win) winnerIds.push(player.id)
        else loserIds.push(player.id)
        picks.push({ playerId: player.id, champion: p.championName || '' })
        kda.push({ playerId: player.id, kills: p.kills ?? 0, deaths: p.deaths ?? 0, assists: p.assists ?? 0 })
      })
      if (winnerIds.length === 0 || loserIds.length === 0) {
        statusEl.textContent = 'Não foi possível determinar vencedores/perdedores (verifique os nomes na partida).'
        statusEl.className = 'riot-match-status riot-match-status--error'
        return
      }
      const match = addMatch(winnerIds, loserIds, picks, kda)
      if (match) {
        statusEl.textContent = `Partida adicionada (${winnerIds.length} vencedores, ${loserIds.length} perdedores).`
        statusEl.className = 'riot-match-status riot-match-status--success'
        matchIdInput.value = ''
      } else {
        statusEl.textContent = 'Erro ao salvar a partida.'
        statusEl.className = 'riot-match-status riot-match-status--error'
      }
    } catch (err) {
      statusEl.textContent = 'Falha ao buscar partida. Tente de novo ou confira sua conexão.'
      statusEl.className = 'riot-match-status riot-match-status--error'
    } finally {
      fetchBtn.disabled = false
    }
  })

  return section
}

/** Reduz o tamanho da imagem para caber no limite da API (base64). */
function resizeImageToBase64(file: File, maxWidth: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      let { width, height } = img
      if (width > maxWidth) {
        height = (height * maxWidth) / width
        width = maxWidth
      }
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas not supported'))
        return
      }
      ctx.drawImage(img, 0, 0, width, height)
      try {
        const dataUrl = canvas.toDataURL('image/jpeg', quality)
        resolve(dataUrl)
      } catch (e) {
        reject(e)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image'))
    }
    img.src = url
  })
}

/** Seção: adicionar partida enviando o print — extração por IA e confirmação. */
function createAddMatchSection() {
  const section = document.createElement('section')
  section.className = 'card add-match-section no-print'
  section.innerHTML = `
    <h2>Adicionar partida</h2>
    <p class="add-match-hint">Envie o <strong>print da tela pós-jogo</strong> (VITÓRIA/DERROTA). A IA extrai jogadores, campeões e KDA e a partida é criada automaticamente.</p>
    <div class="add-match-upload">
      <input type="file" id="add-match-file" accept="image/*" class="add-match-file-input" />
      <button type="button" class="btn btn-primary" id="add-match-select-btn">Selecionar print</button>
    </div>
    <p class="add-match-status" id="add-match-status" aria-live="polite"></p>
    <div class="add-match-preview" id="add-match-preview" hidden>
      <h3 class="add-match-preview-title">Confirme os dados extraídos</h3>
      <div class="add-match-preview-teams" id="add-match-preview-teams"></div>
      <button type="button" class="btn btn-primary" id="add-match-confirm-btn">Confirmar e adicionar partida</button>
    </div>
  `
  const fileInput = section.querySelector<HTMLInputElement>('#add-match-file')!
  const selectBtn = section.querySelector<HTMLButtonElement>('#add-match-select-btn')!
  const statusEl = section.querySelector<HTMLParagraphElement>('#add-match-status')!
  const previewEl = section.querySelector<HTMLDivElement>('#add-match-preview')!
  const previewTeamsEl = section.querySelector<HTMLDivElement>('#add-match-preview-teams')!
  const confirmBtn = section.querySelector<HTMLButtonElement>('#add-match-confirm-btn')!

  let lastExtracted: ExtractedMatchData | null = null

  function nameToPlayerId(name: string): string {
    const trimmed = (name || '').trim()
    if (!trimmed) return ''
    let p = findPlayerByName(players, trimmed)
    if (!p) {
      addPlayer(trimmed)
      players = loadPlayers()
      p = findPlayerByName(players, trimmed)
    }
    return p?.id ?? ''
  }

  selectBtn.addEventListener('click', () => fileInput.click())

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0]
    if (!file) return
    statusEl.textContent = 'Redimensionando imagem…'
    statusEl.className = 'add-match-status'
    previewEl.hidden = true
    lastExtracted = null
    try {
      const dataUrl = await resizeImageToBase64(file, 1200, 0.85)
      const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '')
      statusEl.textContent = 'Analisando print com IA…'
      const result = await extractMatchFromImage(base64)
      if (!result.ok) {
        statusEl.textContent = result.error
        statusEl.className = 'add-match-status error'
        return
      }
      lastExtracted = result.data
      const d = result.data
      previewTeamsEl.innerHTML = `
        <div class="add-match-team add-match-team--win">
          <strong>Vitória</strong>
          <ul>${d.winningTeam.map((p) => `<li>${escapeHtml(p.summonerName)} — ${escapeHtml(p.championName)} — ${p.kills}/${p.deaths}/${p.assists}</li>`).join('')}</ul>
        </div>
        <div class="add-match-team add-match-team--loss">
          <strong>Derrota</strong>
          <ul>${d.losingTeam.map((p) => `<li>${escapeHtml(p.summonerName)} — ${escapeHtml(p.championName)} — ${p.kills}/${p.deaths}/${p.assists}</li>`).join('')}</ul>
        </div>
      `
      previewEl.hidden = false
      statusEl.textContent = 'Revise e confirme para adicionar a partida.'
      statusEl.className = 'add-match-status success'
    } catch (e) {
      statusEl.textContent = `Erro: ${String(e)}`
      statusEl.className = 'add-match-status error'
    }
    fileInput.value = ''
  })

  confirmBtn.addEventListener('click', () => {
    if (!lastExtracted) return
    const d = lastExtracted
    const winnerIds = d.winningTeam.map((p) => nameToPlayerId(p.summonerName)).filter(Boolean)
    const loserIds = d.losingTeam.map((p) => nameToPlayerId(p.summonerName)).filter(Boolean)
    if (winnerIds.length === 0 || loserIds.length === 0) {
      statusEl.textContent = 'Não foi possível identificar jogadores. Verifique os nomes no print.'
      statusEl.className = 'add-match-status error'
      return
    }
    const allPlayers = [...d.winningTeam, ...d.losingTeam]
    const picks: ChampionPick[] = allPlayers
      .map((p) => ({ playerId: nameToPlayerId(p.summonerName), champion: (p.championName || '—').trim() }))
      .filter((x) => x.playerId)
    const kda: KdaEntry[] = allPlayers.map((p) => ({
      playerId: nameToPlayerId(p.summonerName),
      kills: p.kills ?? 0,
      deaths: p.deaths ?? 0,
      assists: p.assists ?? 0,
    })).filter((e) => e.playerId)
    const match = addMatch(winnerIds, loserIds, picks, kda)
    if (match) {
      const extStats: Match['matchExtendedStats'] = []
      allPlayers.forEach((p) => {
        const pid = nameToPlayerId(p.summonerName)
        if (pid && p.damageToChampions != null && p.damageToChampions > 0) {
          extStats.push({ playerId: pid, damageToChampions: p.damageToChampions })
        }
      })
      if (extStats.length > 0) {
        const idx = matches.findIndex((m) => m.id === match.id)
        if (idx >= 0) {
          matches = [...matches]
          matches[idx] = { ...matches[idx], matchExtendedStats: extStats }
          saveMatches(matches)
          rerender()
        }
      }
      previewEl.hidden = true
      lastExtracted = null
      statusEl.textContent = `Partida adicionada. Clique em "Salvar no servidor" na barra superior para atualizar o ranking online.`
      statusEl.className = 'add-match-status success'
    } else {
      statusEl.textContent = 'Erro ao salvar a partida.'
      statusEl.className = 'add-match-status error'
    }
  })

  return section
}

/* Adicionar partida (print) — desativado: partidas entram só via chat (eu adiciono no ranking.json). Descomente a chamada no layout e esta função para reativar.
function createPrintImportSection() {
  const section = document.createElement('section')
  section.className = 'card import-section no-print'
  section.innerHTML = `
    <h2>Adicionar partida (print)</h2>
    <p class="hint">Envie o <strong>print da tela pós-jogo</strong> no chat. Cole aqui o JSON que você receber e clique em Adicionar.</p>
    <div class="import-form">
      <textarea class="import-textarea" id="import-print-json" placeholder='{"equipe1":["Nome1","Nome2",...],"equipe2":["Nome3",...],"vencedor":"equipe1","picks":[{"nome":"Nome1","campeao":"Champ"}],"kda":[{"nome":"Nome1","kills":5,"deaths":3,"assists":10}]}' rows="6"></textarea>
      <button type="button" class="btn btn-primary" id="import-print-btn">Adicionar partida</button>
      <p class="import-status" id="import-print-status" aria-live="polite"></p>
    </div>
  `
  const textarea = section.querySelector<HTMLTextAreaElement>('#import-print-json')!
  const btn = section.querySelector<HTMLButtonElement>('#import-print-btn')!
  const statusEl = section.querySelector<HTMLParagraphElement>('#import-print-status')!

  function nameToPlayerId(name: string): string {
    const trimmed = (name || '').trim()
    if (!trimmed) return ''
    let p = findPlayerByName(players, trimmed)
    if (!p) {
      addPlayer(trimmed)
      players = loadPlayers()
      p = findPlayerByName(players, trimmed)
    }
    return p?.id ?? ''
  }

  btn.addEventListener('click', () => {
    const raw = textarea.value.trim()
    if (!raw) {
      statusEl.textContent = 'Cole o JSON da partida.'
      statusEl.className = 'import-status error'
      return
    }
    let data: ImportPrintData
    try {
      data = JSON.parse(raw) as ImportPrintData
    } catch {
      statusEl.textContent = 'JSON inválido. Verifique o texto colado.'
      statusEl.className = 'import-status error'
      return
    }
    const eq1 = Array.isArray(data.equipe1) ? data.equipe1 : []
    const eq2 = Array.isArray(data.equipe2) ? data.equipe2 : []
    const vencedor = data.vencedor === 'equipe2' ? 'equipe2' : 'equipe1'
    if (eq1.length === 0 && eq2.length === 0) {
      statusEl.textContent = 'Informe equipe1 e equipe2 no JSON.'
      statusEl.className = 'import-status error'
      return
    }
    const winnerIds = (vencedor === 'equipe1' ? eq1 : eq2).map(nameToPlayerId).filter(Boolean)
    const loserIds = (vencedor === 'equipe1' ? eq2 : eq1).map(nameToPlayerId).filter(Boolean)
    if (winnerIds.length === 0 || loserIds.length === 0) {
      statusEl.textContent = 'Não foi possível definir vencedores e perdedores (verifique os nomes).'
      statusEl.className = 'import-status error'
      return
    }
    const picks: ChampionPick[] = (data.picks || []).map(({ nome, campeao }) => ({
      playerId: nameToPlayerId(nome),
      champion: (campeao || '').trim() || '—',
    })).filter((p) => p.playerId)
    const kda: KdaEntry[] = (data.kda || []).map(({ nome, kills, deaths, assists }) => ({
      playerId: nameToPlayerId(nome),
      kills: Number(kills) || 0,
      deaths: Number(deaths) || 0,
      assists: Number(assists) || 0,
    })).filter((e) => e.playerId)
    const match = addMatch(winnerIds, loserIds, picks, kda)
    if (match) {
      statusEl.textContent = `Partida adicionada (${winnerIds.length} vencedores, ${loserIds.length} perdedores).`
      statusEl.className = 'import-status success'
      textarea.value = ''
    } else {
      statusEl.textContent = 'Erro ao salvar a partida.'
      statusEl.className = 'import-status error'
    }
  })

  return section
}
*/

/** Confronto direto entre dois campeões: em times opostos (X vitórias vs Y) ou juntos. */
function computeChampionHeadToHead(champKey1: string, champKey2: string, matchList: Match[]) {
  let champ1WinsVs = 0
  let champ2WinsVs = 0
  let matchesTogether = 0
  let winsTogether = 0
  const k1 = champKey1.toLowerCase()
  const k2 = champKey2.toLowerCase()
  for (const m of matchList) {
    const pickByPlayer = new Map((m.picks ?? []).map((p) => [p.playerId, p.champion.trim().toLowerCase()]))
    const getChampTeam = (champK: string) => {
      for (const pid of [...m.winnerIds, ...m.loserIds]) {
        if (pickByPlayer.get(pid) === champK) return { playerId: pid, won: m.winnerIds.includes(pid) }
      }
      return null
    }
    const t1 = getChampTeam(k1)
    const t2 = getChampTeam(k2)
    if (!t1 || !t2) continue
    const opposite = (m.winnerIds.includes(t1.playerId) && m.loserIds.includes(t2.playerId)) ||
      (m.loserIds.includes(t1.playerId) && m.winnerIds.includes(t2.playerId))
    const together = (m.winnerIds.includes(t1.playerId) && m.winnerIds.includes(t2.playerId)) ||
      (m.loserIds.includes(t1.playerId) && m.loserIds.includes(t2.playerId))
    if (opposite) {
      if (t1.won) champ1WinsVs++
      else champ2WinsVs++
    }
    if (together) {
      matchesTogether++
      if (t1.won && t2.won) winsTogether++
    }
  }
  return { champ1WinsVs, champ2WinsVs, matchesTogether, winsTogether }
}

/** Confronto direto: quando jogaram em times opostos ou juntos. */
function computeHeadToHead(playerId1: string, playerId2: string, matchList: Match[]) {
  let p1WinsOpposite = 0
  let p2WinsOpposite = 0
  let matchesTogether = 0
  let winsTogether = 0
  for (const m of matchList) {
    const p1InWinner = m.winnerIds.includes(playerId1)
    const p1InLoser = m.loserIds.includes(playerId1)
    const p2InWinner = m.winnerIds.includes(playerId2)
    const p2InLoser = m.loserIds.includes(playerId2)
    const p1Played = p1InWinner || p1InLoser
    const p2Played = p2InWinner || p2InLoser
    if (!p1Played || !p2Played) continue
    const opposite = (p1InWinner && p2InLoser) || (p1InLoser && p2InWinner)
    const together = (p1InWinner && p2InWinner) || (p1InLoser && p2InLoser)
    if (opposite) {
      if (p1InWinner) p1WinsOpposite++
      else p2WinsOpposite++
    }
    if (together) {
      matchesTogether++
      if (p1InWinner && p2InWinner) winsTogether++
    }
  }
  return { p1WinsOpposite, p2WinsOpposite, matchesTogether, winsTogether }
}

function createComparePlayersSection(ranking: PlayerStats[], matchList: Match[], highlightsData: HighlightsData) {
  const section = document.createElement('section')
  section.className = 'card compare-section'
  const cmpBgUrl = getChampionSplashUrl('Sett', 1) ?? ''
  const cmpBgStyle = cmpBgUrl ? ` style="background-image: url(${escapeHtml(cmpBgUrl)})"` : ''
  const totalPlayers = ranking.length
  const optionsHtml = ranking.map((s) => `<option value="${escapeHtml(s.player.id)}">${escapeHtml(s.player.name)}</option>`).join('')

  function playerTagsHtml(s: PlayerStats, pos: number) {
    const parts: string[] = []
    const badgeHtml = getPlayerBadgeHtml(s.player)
    if (badgeHtml) parts.push(badgeHtml.trim())
    if (pos === 1) parts.push('<span class="player-badge-leader" title="Segui o líder!">Líder</span>')
    if (pos === totalPlayers && totalPlayers > 0) parts.push('<span class="player-badge-lantern" title="Lanterna">Lanterna</span>')
    if ((s.achievements ?? []).some((a) => a.id === 'main' || a.id === 'otp')) parts.push('<span class="player-badge-main" title="Main/OTP">Main</span>')
    const badges = getHighlightBadgesForPlayer(highlightsData, s.player.id)
    badges.forEach((b) => parts.push(`<span class="player-badge-highlight player-badge-highlight--${b.theme}" title="${escapeHtml(b.label)}">${escapeHtml(b.label)}</span>`))
    return parts.length > 0 ? ' ' + parts.join(' ') : ''
  }
  function posDisplay(pos: number) {
    if (pos === 1) return '<span class="rank-medal" aria-hidden="true">🥇</span>'
    if (pos === 2) return '<span class="rank-medal" aria-hidden="true">🥈</span>'
    if (pos === 3) return '<span class="rank-medal" aria-hidden="true">🥉</span>'
    return String(pos)
  }
  function posClass(pos: number) {
    return pos === 1 ? 'rank-num--gold' : pos === 2 ? 'rank-num--silver' : pos === 3 ? 'rank-num--bronze' : 'rank-num--white'
  }
  function vdHtml(wins: number, losses: number) {
    return `<span class="compare-v">${wins}</span><span class="compare-sep"> — </span><span class="compare-d">${losses}</span>`
  }
  function winrateHtml(winRate: string) {
    const num = parseFloat(winRate)
    const cls = !Number.isNaN(num)
      ? num >= 75
        ? 'compare-winrate--elite'
        : num >= 50
          ? 'compare-winrate--pos'
          : 'compare-winrate--neg'
      : ''
    return `<span class="compare-winrate ${cls}">${winRate}%</span>`
  }
  function ratioHtml(s: PlayerStats) {
    const ratio = s.kda && s.kda.deaths > 0 ? (s.kda.kills + s.kda.assists) / s.kda.deaths : 0
    const str = ratio > 0 ? ratio.toFixed(1) : '—'
    const cls = ratio >= 3 ? 'compare-ratio--elite' : ratio >= 1 ? 'compare-ratio--pos' : ratio > 0 ? 'compare-ratio--neg' : ''
    return `<span class="compare-ratio ${cls}">${str}</span>`
  }
  function kdaHtml(s: PlayerStats) {
    if (!s.kda) return '—'
    return `<span class="compare-k">${s.kda.kills}</span> / <span class="compare-d">${s.kda.deaths}</span> / <span class="compare-a">${s.kda.assists}</span>`
  }

  section.innerHTML = `
    <div class="compare-section-bg"${cmpBgStyle} aria-hidden="true"></div>
    <div class="compare-section-overlay"></div>
    <div class="compare-section-inner">
      <h2>Comparar jogadores</h2>
      <p class="compare-hint">Compare estatísticas e confronto direto entre dois jogadores.</p>
      <div class="compare-selects">
        <select class="compare-select compare-select-1" aria-label="Jogador 1">
          <option value="">— Selecionar —</option>${optionsHtml}
        </select>
        <span class="compare-vs">vs</span>
        <select class="compare-select compare-select-2" aria-label="Jogador 2">
          <option value="">— Selecionar —</option>${optionsHtml}
        </select>
      </div>
      <div class="compare-result" aria-live="polite"></div>
    </div>
  `
  const select1 = section.querySelector<HTMLSelectElement>('.compare-select-1')!
  const select2 = section.querySelector<HTMLSelectElement>('.compare-select-2')!
  const resultEl = section.querySelector('.compare-result')!

  function renderComparison() {
    const id1 = select1.value
    const id2 = select2.value
    if (!id1 || !id2 || id1 === id2) {
      resultEl.innerHTML = id1 === id2 && id1 ? '<p class="empty-hint">Selecione jogadores diferentes.</p>' : ''
      return
    }
    const s1 = ranking.find((r) => r.player.id === id1)!
    const s2 = ranking.find((r) => r.player.id === id2)!
    const h2h = computeHeadToHead(id1, id2, matchList)
    const pos1 = ranking.findIndex((r) => r.player.id === id1) + 1
    const pos2 = ranking.findIndex((r) => r.player.id === id2) + 1
    const totalOpposite = h2h.p1WinsOpposite + h2h.p2WinsOpposite
    const leadOpposite = totalOpposite > 0 ? (h2h.p1WinsOpposite > h2h.p2WinsOpposite ? s1 : h2h.p2WinsOpposite > h2h.p1WinsOpposite ? s2 : null) : null
    const loserOpposite = totalOpposite > 0 && leadOpposite ? (leadOpposite.player.id === id1 ? s2 : s1) : null
    const nameSpan = (name: string, isWinner: boolean, isLoser: boolean) => {
      if (isWinner) return `<span class="compare-name compare-name--win">${escapeHtml(name)}</span>`
      if (isLoser) return `<span class="compare-name compare-name--loss">${escapeHtml(name)}</span>`
      return `<span class="compare-name">${escapeHtml(name)}</span>`
    }
    const oppositeText = totalOpposite > 0
      ? `<p class="compare-h2h"><strong>Em times opostos:</strong> ${nameSpan(s1.player.name, leadOpposite?.player.id === id1, loserOpposite?.player.id === id1)} <span class="compare-score">${h2h.p1WinsOpposite}</span> × <span class="compare-score">${h2h.p2WinsOpposite}</span> ${nameSpan(s2.player.name, leadOpposite?.player.id === id2, loserOpposite?.player.id === id2)}</p>
         ${leadOpposite && loserOpposite ? `<p class="compare-lead"><span class="compare-name compare-name--loss">${escapeHtml(loserOpposite.player.name)}</span> está perdendo para <span class="compare-name compare-name--win">${escapeHtml(leadOpposite.player.name)}</span>.</p>` : '<p class="compare-lead">Empate no confronto.</p>'}`
      : '<p class="compare-h2h empty">Nunca jogaram em times opostos.</p>'
    const togetherText = h2h.matchesTogether > 0
      ? `<p class="compare-together"><strong>Juntos no mesmo time:</strong> <span class="compare-name compare-name--win">${h2h.winsTogether} vitórias</span> e <span class="compare-name compare-name--loss">${h2h.matchesTogether - h2h.winsTogether} derrotas</span> em ${h2h.matchesTogether} partidas.</p>`
      : ''
    const splash1 = getChampionSplashUrl('Jinx', 1) ?? ''
    const splash2 = getChampionSplashUrl('Vi', 1) ?? ''
    const splash3 = getChampionSplashUrl('Caitlyn', 1) ?? ''
    const card1 = (s: PlayerStats, pos: number, splash: string) => {
      const nameHtml = s.player.badge === 'creator' ? `<span class="player-name-boss">${escapeHtml(s.player.name)}</span>` : escapeHtml(s.player.name)
      const rankEmblemUrl = getRankEmblemUrl(s.patenteTier)
      const emblemHtml = rankEmblemUrl ? `<img class="compare-player-emblem" src="${escapeHtml(rankEmblemUrl)}" alt="" width="28" height="28" />` : ''
      return `<div class="compare-card compare-card--splash">
        <div class="compare-card-bg" style="background-image: url(${escapeHtml(splash)})" aria-hidden="true"></div>
        <div class="compare-card-overlay"></div>
        <div class="compare-card-inner">
          <h3 class="compare-card-title-wrap">${emblemHtml}<span>${nameHtml}${playerTagsHtml(s, pos)}</span></h3>
          <div class="compare-stat"><span class="compare-label">Posição</span><span class="compare-pos ${posClass(pos)}">${posDisplay(pos)}</span></div>
          <div class="compare-stat"><span class="compare-label">V/D</span><span>${vdHtml(s.wins, s.losses)}</span></div>
          <div class="compare-stat"><span class="compare-label">Win%</span>${winrateHtml(s.winRate)}</div>
          <div class="compare-stat"><span class="compare-label">KDA</span><span>${kdaHtml(s)}</span></div>
          <div class="compare-stat"><span class="compare-label">Ratio</span>${ratioHtml(s)}</div>
        </div>
      </div>`
    }
    resultEl.innerHTML = `
      <div class="compare-cards">
        ${card1(s1, pos1, splash1)}
        <div class="compare-card compare-card-head compare-card--splash">
          <div class="compare-card-bg" style="background-image: url(${escapeHtml(splash2)})" aria-hidden="true"></div>
          <div class="compare-card-overlay"></div>
          <div class="compare-card-inner">
            <h3>Confronto direto</h3>
            ${oppositeText}
            ${togetherText}
          </div>
        </div>
        ${card1(s2, pos2, splash3)}
      </div>
    `
  }

  select1.addEventListener('change', renderComparison)
  select2.addEventListener('change', renderComparison)
  renderComparison()
  return section
}

function createCompareChampionsSection(ranking: PlayerStats[], matchList: Match[]) {
  const byChamp = new Map<string, { total: number; wins: number; bestPlayerId: string; bestPlayerName: string; bestWins: number }>()
  for (const s of ranking) {
    for (const c of s.championPlays) {
      const key = c.champion.trim().toLowerCase()
      if (!key) continue
      const cur = byChamp.get(key)
      if (!cur) {
        byChamp.set(key, {
          total: c.count,
          wins: c.wins,
          bestPlayerId: s.player.id,
          bestPlayerName: s.player.name,
          bestWins: c.wins,
        })
      } else {
        cur.total += c.count
        cur.wins += c.wins
        if (c.wins > cur.bestWins || (c.wins === cur.bestWins && c.count > 0)) {
          cur.bestPlayerId = s.player.id
          cur.bestPlayerName = s.player.name
          cur.bestWins = c.wins
        }
      }
    }
  }
  const champList = [...byChamp.entries()]
    .map(([key, v]) => {
      const display = ranking.flatMap((s) => s.championPlays).find((p) => p.champion.trim().toLowerCase() === key)?.champion?.trim() ?? key
      return { key, display, ...v }
    })
    .sort((a, b) => a.display.localeCompare(b.display))
  const optionsHtml = champList.map((c) => `<option value="${escapeHtml(c.key)}">${escapeHtml(c.display)}</option>`).join('')
  const section = document.createElement('section')
  section.className = 'card compare-champions-section no-print'
  const cmpChampBg = getChampionSplashUrl('Zed', 2) ?? ''
  const cmpChampBgStyle = cmpChampBg ? ` style="background-image: url(${escapeHtml(cmpChampBg)})"` : ''
  section.innerHTML = `
    <div class="compare-champions-bg"${cmpChampBgStyle} aria-hidden="true"></div>
    <div class="compare-champions-overlay"></div>
    <div class="compare-champions-inner">
      <h2>Comparar campeões</h2>
      <p class="compare-champions-hint">Compare estatísticas e confronto direto entre dois campeões.</p>
      <div class="compare-champions-selects">
        <select class="compare-champ-select compare-champ-select-1" aria-label="Campeão 1">
          <option value="">— Selecionar —</option>${optionsHtml}
        </select>
        <span class="compare-champ-vs">vs</span>
        <select class="compare-champ-select compare-champ-select-2" aria-label="Campeão 2">
          <option value="">— Selecionar —</option>${optionsHtml}
        </select>
      </div>
      <div class="compare-champions-result" aria-live="polite"></div>
    </div>
  `
  const select1 = section.querySelector<HTMLSelectElement>('.compare-champ-select-1')!
  const select2 = section.querySelector<HTMLSelectElement>('.compare-champ-select-2')!
  const resultEl = section.querySelector('.compare-champions-result')!
  function bestPlayerHtml(bestPlayerId: string, bestPlayerName: string) {
    const bestStats = ranking.find((r) => r.player.id === bestPlayerId)
    if (!bestStats) return escapeHtml(bestPlayerName)
    const emblemUrl = getRankEmblemUrl(bestStats.patenteTier)
    const emblemHtml = emblemUrl ? `<img class="compare-champ-elo-emblem" src="${escapeHtml(emblemUrl)}" alt="" width="24" height="24" />` : ''
    const tags: string[] = []
    const badgeHtml = getPlayerBadgeHtml(bestStats.player)
    if (badgeHtml) tags.push(badgeHtml.trim())
    const pos = ranking.findIndex((r) => r.player.id === bestPlayerId) + 1
    if (pos === 1) tags.push('<span class="player-badge-leader" title="Líder">Líder</span>')
    if (pos === ranking.length && ranking.length > 0) tags.push('<span class="player-badge-lantern" title="Lanterna">Lanterna</span>')
    if ((bestStats.achievements ?? []).some((a) => a.id === 'main' || a.id === 'otp')) tags.push('<span class="player-badge-main" title="Main">Main</span>')
    const tagsHtml = tags.length > 0 ? ' ' + tags.join(' ') : ''
    return `${emblemHtml}<span>${escapeHtml(bestPlayerName)}${tagsHtml}</span>`
  }
  function render() {
    const k1 = select1.value
    const k2 = select2.value
    if (!k1 || !k2 || k1 === k2) {
      resultEl.innerHTML = k1 === k2 && k1 ? '<p class="empty-hint">Selecione campeões diferentes.</p>' : ''
      return
    }
    const c1 = champList.find((c) => c.key === k1)!
    const c2 = champList.find((c) => c.key === k2)!
    const h2h = computeChampionHeadToHead(k1, k2, matchList)
    const winRate1 = c1.total > 0 ? ((c1.wins / c1.total) * 100).toFixed(1) : '0'
    const winRate2 = c2.total > 0 ? ((c2.wins / c2.total) * 100).toFixed(1) : '0'
    const totalOpposite = h2h.champ1WinsVs + h2h.champ2WinsVs
    const leadChamp = totalOpposite > 0 ? (h2h.champ1WinsVs > h2h.champ2WinsVs ? c1 : h2h.champ2WinsVs > h2h.champ1WinsVs ? c2 : null) : null
    const loserChamp = totalOpposite > 0 && leadChamp ? (leadChamp.key === k1 ? c2 : c1) : null
    const nameSpan = (display: string, isWinner: boolean, isLoser: boolean) => {
      if (isWinner) return `<span class="compare-name compare-name--win">${escapeHtml(display)}</span>`
      if (isLoser) return `<span class="compare-name compare-name--loss">${escapeHtml(display)}</span>`
      return `<span class="compare-name">${escapeHtml(display)}</span>`
    }
    const oppositeText = totalOpposite > 0
      ? `<p class="compare-champ-h2h"><strong>Em times opostos:</strong> ${nameSpan(c1.display, leadChamp?.key === k1, loserChamp?.key === k1)} <span class="compare-score">${h2h.champ1WinsVs}</span> × <span class="compare-score">${h2h.champ2WinsVs}</span> ${nameSpan(c2.display, leadChamp?.key === k2, loserChamp?.key === k2)}</p>
         ${leadChamp && loserChamp ? `<p class="compare-champ-lead"><span class="compare-name compare-name--loss">${escapeHtml(loserChamp.display)}</span> está perdendo para <span class="compare-name compare-name--win">${escapeHtml(leadChamp.display)}</span>.</p>` : '<p class="compare-champ-lead">Empate no confronto.</p>'}`
      : '<p class="compare-champ-h2h empty">Nunca jogaram em times opostos na mesma partida.</p>'
    const togetherText = h2h.matchesTogether > 0
      ? `<p class="compare-champ-together"><strong>Juntos no mesmo time:</strong> <span class="compare-name compare-name--win">${h2h.winsTogether} vitórias</span> e <span class="compare-name compare-name--loss">${h2h.matchesTogether - h2h.winsTogether} derrotas</span> em ${h2h.matchesTogether} partidas.</p>`
      : ''
    const icon1 = getChampionIconUrl(c1.display)
    const icon2 = getChampionIconUrl(c2.display)
    const iconHtml = (url: string | null) => url ? `<img class="compare-champ-icon" src="${escapeHtml(url)}" alt="" width="40" height="40" />` : ''
    const splash2 = getChampionSplashUrl('Vi', 1) ?? ''
    const splash1 = getChampionSplashUrl(c1.display, 1) ?? ''
    const splash3 = getChampionSplashUrl(c2.display, 1) ?? ''
    resultEl.innerHTML = `
      <div class="compare-champions-cards">
        <div class="compare-champ-card compare-champ-card--splash">
          <div class="compare-champ-card-bg" style="background-image: url(${escapeHtml(splash1)})" aria-hidden="true"></div>
          <div class="compare-champ-card-overlay"></div>
          <div class="compare-champ-card-inner">
            <div class="compare-champ-card-header">${iconHtml(icon1)}<span>${escapeHtml(c1.display)}</span></div>
          <div class="compare-champ-stat"><span class="compare-champ-label">Partidas</span><span>${c1.total}</span></div>
          <div class="compare-champ-stat"><span class="compare-champ-label">Vitórias</span><span>${c1.wins}</span></div>
          <div class="compare-champ-stat"><span class="compare-champ-label">Win rate</span><span class="winrate-val ${parseFloat(winRate1) >= 50 ? 'winrate--pos' : 'winrate--neg'}">${winRate1}%</span></div>
          <div class="compare-champ-stat compare-champ-best"><span class="compare-champ-label">Melhor jogador</span><span class="compare-champ-best-player">${bestPlayerHtml(c1.bestPlayerId, c1.bestPlayerName)}</span></div>
          </div>
        </div>
        <div class="compare-champ-card compare-champ-card-vs compare-champ-card-head">
          <div class="compare-champ-card-bg" style="background-image: url(${escapeHtml(splash2)})" aria-hidden="true"></div>
          <div class="compare-champ-card-overlay"></div>
          <div class="compare-champ-vs-content">
            <span class="compare-champ-vs-label">Confronto direto</span>
            ${oppositeText}
            ${togetherText}
          </div>
        </div>
        <div class="compare-champ-card compare-champ-card--splash">
          <div class="compare-champ-card-bg" style="background-image: url(${escapeHtml(splash3)})" aria-hidden="true"></div>
          <div class="compare-champ-card-overlay"></div>
          <div class="compare-champ-card-inner">
            <div class="compare-champ-card-header">${iconHtml(icon2)}<span>${escapeHtml(c2.display)}</span></div>
            <div class="compare-champ-stat"><span class="compare-champ-label">Partidas</span><span>${c2.total}</span></div>
            <div class="compare-champ-stat"><span class="compare-champ-label">Vitórias</span><span>${c2.wins}</span></div>
            <div class="compare-champ-stat"><span class="compare-champ-label">Win rate</span><span class="winrate-val ${parseFloat(winRate2) >= 50 ? 'winrate--pos' : 'winrate--neg'}">${winRate2}%</span></div>
            <div class="compare-champ-stat compare-champ-best"><span class="compare-champ-label">Melhor jogador</span><span class="compare-champ-best-player">${bestPlayerHtml(c2.bestPlayerId, c2.bestPlayerName)}</span></div>
          </div>
        </div>
      </div>
    `
  }
  select1.addEventListener('change', render)
  select2.addEventListener('change', render)
  render()
  return section
}

/** ELO e winrate por partida (ordem cronológica) para um jogador. */
function computePlayerEvolution(playerId: string, matches: Match[]) {
  const matchesAsc = [...matches].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
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

function createGraphicsSection(ranking: PlayerStats[], matches: Match[]) {
  const section = document.createElement('section')
  section.className = 'card graphics-section no-print'
  const gfxBg = getChampionSplashUrl('Lux', 2) ?? ''
  const gfxBgStyle = gfxBg ? ` style="background-image: url(${escapeHtml(gfxBg)})"` : ''
  const optionsHtml = ranking.map((s) => `<option value="${escapeHtml(s.player.id)}">${escapeHtml(s.player.name)}</option>`).join('')
  section.innerHTML = `
    <div class="graphics-section-bg"${gfxBgStyle} aria-hidden="true"></div>
    <div class="graphics-section-overlay"></div>
    <div class="graphics-section-inner">
      <h2>Gráficos</h2>
      <p class="graphics-hint">Evolução de ELO e win rate por jogador.</p>
      <div class="graphics-player-select">
        <label for="graphics-player-select">Jogador:</label>
        <select id="graphics-player-select" class="graphics-select" aria-label="Selecionar jogador">
          <option value="">— Selecionar —</option>${optionsHtml}
        </select>
      </div>
      <div class="graphics-charts" aria-live="polite"></div>
    </div>
  `
  const selectEl = section.querySelector<HTMLSelectElement>('#graphics-player-select')!
  const chartsEl = section.querySelector('.graphics-charts')!

  function renderCharts(playerId: string) {
    if (!playerId) {
      chartsEl.innerHTML = '<p class="empty-hint">Selecione um jogador para ver a evolução.</p>'
      return
    }
    const s = ranking.find((r) => r.player.id === playerId)
    if (!s) return
    const { eloSteps, winrates } = computePlayerEvolution(playerId, matches)
    if (eloSteps.length === 0) {
      chartsEl.innerHTML = `<p class="empty-hint">${escapeHtml(s.player.name)} ainda não jogou partidas.</p>`
      return
    }
    const rankEmblemUrl = getRankEmblemUrl(s.patenteTier)
    const emblemHtml = rankEmblemUrl ? `<img class="graphics-player-emblem" src="${escapeHtml(rankEmblemUrl)}" alt="" width="40" height="40" />` : ''
    const n = eloSteps.length
    const maxStep = 38
    const wrClass = (wr: number) => wr >= 75 ? 'graphics-wr-elite' : wr >= 50 ? 'graphics-wr-pos' : 'graphics-wr-neg'
    const lastElo = getEloByStep(eloSteps[eloSteps.length - 1] ?? 0)
    const lastWr = winrates[winrates.length - 1] ?? 0
    const winrateElite = lastWr >= 75
    const winratePos = lastWr >= 50
    chartsEl.innerHTML = `
      <div class="graphics-player-card">
        <div class="graphics-player-header">
          ${emblemHtml}
          <div class="graphics-player-info">
            <h3 class="graphics-player-name">${escapeHtml(s.player.name)}</h3>
            <p class="graphics-player-stats">
              <span class="graphics-stat">${escapeHtml(lastElo.label)}</span>
              <span class="graphics-stat ${winrateElite ? 'graphics-wr-elite' : winratePos ? 'graphics-wr-pos' : 'graphics-wr-neg'}">${lastWr.toFixed(1)}% win rate</span>
              <span class="graphics-stat">${s.wins}V ${s.losses}D</span>
            </p>
          </div>
        </div>
        <div class="graphics-chart-block">
          <h4 class="graphics-chart-title">Evolução do ELO</h4>
          <div class="graphics-chart-with-axes">
            <div class="graphics-y-axis graphics-y-elo">
              <span>38</span><span>20</span><span>10</span><span>0</span>
            </div>
            <div class="graphics-chart-inner">
              <div class="graphics-track graphics-track-elo">
                <svg class="graphics-line-svg" viewBox="0 0 100 100" preserveAspectRatio="none"><polyline class="graphics-polyline graphics-polyline-elo" fill="none" stroke="currentColor" stroke-width="2" points="${eloSteps.map((step, i) => {
                  const divisor = Math.max(1, n - 1)
                  const x = n <= 1 ? 50 : (i / divisor) * 100
                  const y = 100 - (maxStep > 0 ? (step / maxStep) * 100 : 0)
                  return `${x},${y}`
                }).join(' ')}" /></svg>
                ${eloSteps.map((step, i) => {
                  const { label, tier } = getEloByStep(step)
                  const divisor = Math.max(1, n - 1)
                  const leftPct = n <= 1 ? 50 : (i / divisor) * 100
                  const bottomPct = maxStep > 0 ? (step / maxStep) * 100 : 0
                  return `<div class="graphics-point-wrap" style="left: ${leftPct}%; bottom: ${bottomPct}%;" title="Partida ${i + 1}: ${escapeHtml(label)}">
                    <span class="graphics-point graphics-point-elo"></span>
                    <span class="graphics-point-label graphics-elo-label graphics-elo-label--${tier}">${escapeHtml(label)}</span>
                  </div>`
                }).join('')}
              </div>
              <div class="graphics-x-axis">
                <span class="graphics-x-label">Partida</span>
                ${Array.from({ length: n }, (_, i) => {
                  const divisor = Math.max(1, n - 1)
                  const leftPct = n <= 1 ? 50 : (i / divisor) * 100
                  return `<span class="graphics-x-tick" style="left: ${leftPct}%;">${i + 1}</span>`
                }).join('')}
              </div>
            </div>
          </div>
        </div>
        <div class="graphics-chart-block">
          <h4 class="graphics-chart-title">Evolução do win rate</h4>
          <div class="graphics-chart-with-axes">
            <div class="graphics-y-axis graphics-y-wr">
              <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
            </div>
            <div class="graphics-chart-inner">
              <div class="graphics-track graphics-track-wr">
                <svg class="graphics-line-svg" viewBox="0 0 100 100" preserveAspectRatio="none"><polyline class="graphics-polyline graphics-polyline-wr" fill="none" stroke="currentColor" stroke-width="2" points="${winrates.map((wr, i) => {
                  const divisor = Math.max(1, n - 1)
                  const x = n <= 1 ? 50 : (i / divisor) * 100
                  const y = 100 - wr
                  return `${x},${y}`
                }).join(' ')}" /></svg>
                ${winrates.map((wr, i) => {
                  const pct = wr.toFixed(0)
                  const divisor = Math.max(1, n - 1)
                  const leftPct = n <= 1 ? 50 : (i / divisor) * 100
                  const bottomPct = wr
                  return `<div class="graphics-point-wrap" style="left: ${leftPct}%; bottom: ${bottomPct}%;" title="Partida ${i + 1}: ${pct}%">
                    <span class="graphics-point graphics-point-wr ${wrClass(wr)}"></span>
                    <span class="graphics-point-label graphics-wr-label ${wrClass(wr)}">${pct}%</span>
                  </div>`
                }).join('')}
              </div>
              <div class="graphics-x-axis">
                <span class="graphics-x-label">Partida</span>
                ${Array.from({ length: n }, (_, i) => {
                  const divisor = Math.max(1, n - 1)
                  const leftPct = n <= 1 ? 50 : (i / divisor) * 100
                  return `<span class="graphics-x-tick" style="left: ${leftPct}%;">${i + 1}</span>`
                }).join('')}
              </div>
            </div>
          </div>
        </div>
      </div>
    `
  }

  selectEl.addEventListener('change', () => renderCharts(selectEl.value))
  renderCharts(selectEl.value)
  return section
}

function createChampionStatsSection(ranking: PlayerStats[]) {
  const section = document.createElement('section')
  section.className = 'card champion-section'
  const picksSplashUrl = getChampionSplashUrl('Ezreal', 2) ?? ''
  const picksSplashStyle = picksSplashUrl ? ` style="background-image: url(${escapeHtml(picksSplashUrl)})"` : ''
  section.innerHTML = `
    <div class="champion-section-bg"${picksSplashStyle} aria-hidden="true"></div>
    <div class="champion-section-overlay"></div>
    <div class="champion-section-inner">
      <h2>Campeões mais utilizados</h2>
      <div class="champion-grid"></div>
    </div>
  `
  const grid = section.querySelector('.champion-grid')!
  ranking.forEach((s) => {
    if (s.championPlays.length === 0) return
    const card = document.createElement('div')
    card.className = 'champion-card champion-card--collapsed'
    const sortedChamps = [...s.championPlays].sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count
      if (b.wins !== a.wins) return b.wins - a.wins
      const ratioA = typeof a.ratio === 'number' ? a.ratio : 0
      const ratioB = typeof b.ratio === 'number' ? b.ratio : 0
      if (ratioB !== ratioA) return ratioB - ratioA
      return a.champion.localeCompare(b.champion)
    })
    const mostPicked = sortedChamps[0]
    const cardBgUrl = mostPicked ? getChampionSplashUrl(mostPicked.champion, 1) : null
    const cardBgStyle = cardBgUrl ? ` style="background-image: url(${escapeHtml(cardBgUrl)})"` : ''
    const rows = sortedChamps
      .slice(0, 10)
      .map((c) => {
        const iconUrl = getChampionIconUrl(c.champion)
        const imgHtml = iconUrl ? `<img class="champ-icon champ-list-icon" src="${escapeHtml(iconUrl)}" alt="" width="24" height="24" />` : ''
        const wins = c.wins
        const losses = c.count - c.wins
        const winPct = c.count > 0 ? ((wins / c.count) * 100).toFixed(0) : '0'
        const winRateStr = `${winPct}% (${wins}V ${losses}D)`
        const winRateClass = c.count > 0 ? (wins / c.count >= 0.5 ? 'champ-winrate--positive' : 'champ-winrate--negative') : ''
        const ratioStr = typeof c.ratio === 'number' && !Number.isNaN(c.ratio) ? c.ratio.toFixed(1) : '—'
        const vdHtml = `<span class="champ-v champ-v-wins">${wins}</span><span class="champ-v-sep">–</span><span class="champ-v champ-v-losses">${losses}</span>`
        return `<div class="champ-row">${imgHtml}<span class="champ-name">${escapeHtml(c.champion)}</span><span class="champ-count">${c.count}x</span><span class="champ-vd">${vdHtml}</span><span class="champ-winrate ${winRateClass}" title="${escapeHtml(winRateStr)}">${winPct}%</span><span class="champ-ratio" title="(K+A)/D">${ratioStr}</span></div>`
      })
      .join('')
    const champBadgeHtml = getPlayerBadgeHtml(s.player)
    const nameHtml = s.player.badge === 'creator' ? `<span class="player-name-boss">${escapeHtml(s.player.name)}</span>${champBadgeHtml}` : `${escapeHtml(s.player.name)}${champBadgeHtml}`
    const champCount = sortedChamps.length
    card.innerHTML = `
      <div class="champion-card-bg"${cardBgStyle} aria-hidden="true"></div>
      <div class="champion-card-overlay"></div>
      <div class="champion-card-header" role="button" tabindex="0" aria-expanded="false" aria-label="Expandir piques de ${escapeHtml(s.player.name)}">
        <span class="champion-card-toggle" aria-hidden="true"></span>
        <h3 class="champion-card-title">${nameHtml}</h3>
        <span class="champion-card-count">${champCount} champion${champCount !== 1 ? 's' : ''}</span>
      </div>
      <div class="champion-card-body">
        <div class="champ-list">
          <div class="champ-row champ-row--header champ-row--white"><span class="champ-name">Champion</span><span class="champ-count">Picks</span><span class="champ-vd">V–D</span><span class="champ-winrate">Win</span><span class="champ-ratio">Ratio</span></div>
          ${rows}
        </div>
      </div>
    `
    const header = card.querySelector('.champion-card-header')!
    header.addEventListener('click', () => {
      const collapsed = card.classList.toggle('champion-card--collapsed')
      header.setAttribute('aria-expanded', String(!collapsed))
    })
    header.addEventListener('keydown', (e) => {
      const ev = e as KeyboardEvent
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault()
        ;(header as HTMLElement).click()
      }
    })
    grid.appendChild(card)
  })
  if (grid.children.length === 0) {
    const inner = section.querySelector('.champion-section-inner')
    if (inner) {
      const p = document.createElement('p')
      p.className = 'empty-hint'
      p.textContent = 'Nenhum pique registrado ainda. Preencha os campeões ao registrar partidas.'
      grid.appendChild(p)
    }
  }
  return section
}

/** ELO ladder size for OTP score (0 = Ferro 4, max = Challenger). */
const ELO_MAX_STEP = 38

type ChampHighlights = { mvp: number; bestKda: number; worstKda: number }

/** Por partida: conta MVP, melhor KDA e pior KDA por (playerId, championKey) só quando jogou aquele campeão. */
function computeChampHighlights(matchList: Match[]): Map<string, Map<string, ChampHighlights>> {
  const byChamp = new Map<string, Map<string, ChampHighlights>>()
  function get(playerId: string, champKey: string): ChampHighlights {
    let perChamp = byChamp.get(champKey)
    if (!perChamp) {
      perChamp = new Map()
      byChamp.set(champKey, perChamp)
    }
    let h = perChamp.get(playerId)
    if (!h) {
      h = { mvp: 0, bestKda: 0, worstKda: 0 }
      perChamp.set(playerId, h)
    }
    return h
  }
  for (const m of matchList) {
    const kdaList = m.kda ?? []
    const matchH = getMatchHighlightIds(m)
    const pickByPlayer = new Map(
      m.picks
        .filter((p) => p.champion.trim())
        .map((p) => [p.playerId, p.champion.trim().toLowerCase()] as [string, string])
    )
    let bestPlayerId: string | null = null
    let worstPlayerId: string | null = null
    if (kdaList.length > 0) {
      const withRatio = kdaList.map((e) => {
        const d = Math.max(e.deaths, 1)
        const ratio = (e.kills + e.assists) / d
        return { playerId: e.playerId, ratio }
      })
      bestPlayerId = withRatio.reduce((a, b) => (b.ratio > a.ratio ? b : a), withRatio[0]).playerId
      worstPlayerId = withRatio.reduce((a, b) => (b.ratio < a.ratio ? b : a), withRatio[0]).playerId
    }
    const allInMatch = [...m.winnerIds, ...m.loserIds]
    for (const playerId of allInMatch) {
      const champKey = pickByPlayer.get(playerId)
      if (!champKey) continue
      const h = get(playerId, champKey)
      if (playerId === matchH.mvpPlayerId) h.mvp++
      if (playerId === bestPlayerId) h.bestKda++
      if (playerId === worstPlayerId) h.worstKda++
    }
  }
  return byChamp
}

/** OTP score 0–100: elo, picks, win%, ratio + bônus MVP e melhor KDA, penalidade pior KDA (por partida com aquele campeão). */
function otpScore(
  entry: { count: number; wins: number; ratio: number },
  eloStep: number,
  highlights: ChampHighlights
): number {
  const eloNorm = eloStep >= 0 ? eloStep / ELO_MAX_STEP : 0
  const pickNorm = entry.count <= 0 ? 0 : Math.min(1, entry.count / 20)
  const winNorm = entry.count <= 0 ? 0 : entry.wins / entry.count
  const ratioNorm = Math.min(1, entry.ratio / 6)
  let base = eloNorm * 22 + pickNorm * 22 + winNorm * 22 + ratioNorm * 22
  const mvpBonus = Math.min(12, highlights.mvp * 2)
  const bestBonus = Math.min(6, highlights.bestKda * 1.5)
  const worstPenalty = Math.min(8, highlights.worstKda * 1.5)
  base += mvpBonus + bestBonus - worstPenalty
  return Math.max(0, Math.min(100, base))
}

/** OTP por campeão: melhor jogador por campeão; score 0–100 (ELO, partidas, vitória, ratio, MVP e destaques). */
function createBestPlayerPerChampionSection(ranking: PlayerStats[], matchList: Match[]) {
  const section = document.createElement('section')
  section.className = 'card best-per-champ-section'
  const otpBgUrl = getChampionSplashUrl('Jhin', 2) ?? ''
  const otpBgStyle = otpBgUrl ? ` style="background-image: url(${escapeHtml(otpBgUrl)})"` : ''
  const champHighlights = computeChampHighlights(matchList)
  type Entry = { playerId: string; playerName: string; count: number; wins: number; ratio: number }
  const byChamp = new Map<string, Entry[]>()
  for (const s of ranking) {
    for (const c of s.championPlays) {
      const key = c.champion.trim().toLowerCase()
      if (!key) continue
      const list = byChamp.get(key) ?? []
      const ratio = typeof c.ratio === 'number' && !Number.isNaN(c.ratio) ? c.ratio : 0
      list.push({
        playerId: s.player.id,
        playerName: s.player.name,
        count: c.count,
        wins: c.wins,
        ratio,
      })
      byChamp.set(key, list)
    }
  }
  const champNames = Array.from(byChamp.keys()).sort((a, b) => a.localeCompare(b))
  const totalPlayers = ranking.length
  const items: { champion: string; playerName: string; playerId: string; score100: number; tagsHtml: string }[] = []
  for (const key of champNames) {
    const list = byChamp.get(key)!
    const highlightsMap = champHighlights.get(key)
    const withScore = list.map((e) => {
      const stats = ranking.find((s) => s.player.id === e.playerId)
      const eloStep = stats?.eloStep ?? -1
      const h = highlightsMap?.get(e.playerId) ?? { mvp: 0, bestKda: 0, worstKda: 0 }
      return { ...e, score: otpScore(e, eloStep, h) }
    })
    withScore.sort((a, b) => b.score - a.score)
    const best = withScore[0]
    if (!best) continue
    const displayName = list[0] ? (ranking.find((s) => s.player.id === list[0].playerId)?.championPlays.find((p) => p.champion.trim().toLowerCase() === key)?.champion ?? key) : key
    const pos = ranking.findIndex((s) => s.player.id === best.playerId) + 1
    const bestStats = ranking.find((s) => s.player.id === best.playerId)
    const bossTag = bestStats ? getPlayerBadgeHtml(bestStats.player) : ''
    const leaderTag = pos === 1 ? ' <span class="player-badge-leader" title="Segui o líder!">Líder</span>' : ''
    const lanternTag = pos === totalPlayers && totalPlayers > 0 ? ' <span class="player-badge-lantern" title="Lanterna do ranking">Lanterna</span>' : ''
    const mainTag = (bestStats?.achievements ?? []).some((a) => a.id === 'main' || a.id === 'otp') ? ' <span class="player-badge-main" title="Main/OTP">Main</span>' : ''
    const tagsHtml = bossTag + leaderTag + lanternTag + mainTag
    const score100 = Math.round(Math.min(100, Math.max(0, best.score)))
    items.push({
      champion: displayName,
      playerName: best.playerName,
      playerId: best.playerId,
      score100,
      tagsHtml,
    })
  }
  if (items.length === 0) {
    section.innerHTML = `
      <div class="best-per-champ-section-bg"${otpBgStyle} aria-hidden="true"></div>
      <div class="best-per-champ-section-overlay"></div>
      <div class="best-per-champ-section-inner">
        <h2>OTP por campeão</h2>
        <p class="empty-hint">Jogue partidas com campeões preenchidos para ver quem é o melhor em cada um.</p>
      </div>
    `
    return section
  }
  const champOptions = [...new Map(items.map((i) => {
    const key = i.champion.trim().toLowerCase()
    return [key, { key, display: i.champion.trim() }]
  })).values()].sort((a, b) => a.display.localeCompare(b.display))
  const filterOptionsHtml = `<option value="">Todos os campeões</option>` + champOptions
    .map((c) => `<option value="${escapeHtml(c.key)}">${escapeHtml(c.display)}</option>`)
    .join('')
  const cardsHtml = items
    .map(
      (item) => {
        const iconUrl = getChampionIconUrl(item.champion)
        const iconHtml = iconUrl ? `<img class="best-champ-icon" src="${escapeHtml(iconUrl)}" alt="" width="32" height="32" />` : ''
        const urls = getChampionSplashUrls(item.champion, 2)
        const primaryUrl = urls?.primary ?? ''
        const fallbackUrl = urls?.fallback ?? primaryUrl
        const imgHtml =
          primaryUrl || fallbackUrl
            ? `<img class="best-champ-card-bg-img" src="${escapeHtml(primaryUrl)}" data-fallback="${escapeHtml(fallbackUrl)}" alt="" />`
            : ''
        return `<div class="best-champ-card" role="button" tabindex="0" data-champion="${escapeHtml(item.champion)}" data-player-id="${escapeHtml(item.playerId)}" data-player-name="${escapeHtml(item.playerName)}" title="Score OTP: ${item.score100}">
          <div class="best-champ-card-bg" aria-hidden="true">${imgHtml}</div>
          <div class="best-champ-card-overlay"></div>
          <div class="best-champ-card-inner">
            <div class="best-champ-card-header">
              ${iconHtml}
              <span class="best-champ-name">${escapeHtml(item.champion)}</span>
              <span class="best-champ-score-box" title="Score OTP 0–100"><span class="best-champ-score-label">Score</span><span class="best-champ-score">${item.score100}</span></span>
            </div>
            <div class="best-champ-player">${escapeHtml(item.playerName)}${item.tagsHtml}</div>
          </div>
        </div>`
      }
    )
    .join('')
  const gridId = 'otp-champ-grid'
  section.innerHTML = `
    <div class="best-per-champ-section-bg"${otpBgStyle} aria-hidden="true"></div>
    <div class="best-per-champ-section-overlay"></div>
    <div class="best-per-champ-section-inner">
      <h2>OTP por campeão</h2>
      <p class="best-champ-hint">Melhor jogador em cada campeão. Score 0–100 considera ELO, partidas, vitória, ratio, MVP e destaques. Clique no card para ver o histórico.</p>
      <div class="best-champ-filter">
        <label for="otp-champ-filter">Buscar campeão:</label>
        <select id="otp-champ-filter" class="best-champ-select" aria-label="Filtrar por campeão">
          ${filterOptionsHtml}
        </select>
      </div>
      <div class="best-champ-grid" id="${gridId}">${cardsHtml}</div>
    </div>
  `
  const filterSelect = section.querySelector<HTMLSelectElement>('#otp-champ-filter')!
  const gridEl = section.querySelector(`#${gridId}`)!
  filterSelect.addEventListener('change', () => {
    const key = filterSelect.value
    const filtered = key ? items.filter((i) => i.champion.trim().toLowerCase() === key) : items
    const filteredCardsHtml = filtered
      .map((item) => {
        const iconUrl = getChampionIconUrl(item.champion)
        const iconHtml = iconUrl ? `<img class="best-champ-icon" src="${escapeHtml(iconUrl)}" alt="" width="32" height="32" />` : ''
        const urls = getChampionSplashUrls(item.champion, 2)
        const primaryUrl = urls?.primary ?? ''
        const fallbackUrl = urls?.fallback ?? primaryUrl
        const imgHtml = primaryUrl || fallbackUrl ? `<img class="best-champ-card-bg-img" src="${escapeHtml(primaryUrl)}" data-fallback="${escapeHtml(fallbackUrl)}" alt="" />` : ''
        return `<div class="best-champ-card" role="button" tabindex="0" data-champion="${escapeHtml(item.champion)}" data-player-id="${escapeHtml(item.playerId)}" data-player-name="${escapeHtml(item.playerName)}" title="Score OTP: ${item.score100}">
          <div class="best-champ-card-bg" aria-hidden="true">${imgHtml}</div>
          <div class="best-champ-card-overlay"></div>
          <div class="best-champ-card-inner">
            <div class="best-champ-card-header">${iconHtml}<span class="best-champ-name">${escapeHtml(item.champion)}</span><span class="best-champ-score-box" title="Score OTP 0–100"><span class="best-champ-score-label">Score</span><span class="best-champ-score">${item.score100}</span></span></div>
            <div class="best-champ-player">${escapeHtml(item.playerName)}${item.tagsHtml}</div>
          </div>
        </div>`
      })
      .join('')
    gridEl.innerHTML = filteredCardsHtml || '<p class="empty-hint">Nenhum campeão encontrado.</p>'
    gridEl.querySelectorAll('.best-champ-card-bg-img').forEach((img) => {
      const el = img as HTMLImageElement
      el.onerror = function () {
        const fb = el.dataset.fallback
        if (fb) { el.onerror = null; el.src = fb }
      }
    })
    gridEl.querySelectorAll('.best-champ-card').forEach((card) => {
      card.addEventListener('click', () => {
        const champion = (card as HTMLElement).dataset.champion ?? ''
        const playerId = (card as HTMLElement).dataset.playerId ?? ''
        const playerName = (card as HTMLElement).dataset.playerName ?? ''
        showOtpDetailModal(champion, playerId, playerName, matchList, ranking)
      })
    })
  })
  section.querySelectorAll('.best-champ-card-bg-img').forEach((img) => {
    const el = img as HTMLImageElement
    el.onerror = function () {
      const fb = el.dataset.fallback
      if (fb) {
        el.onerror = null
        el.src = fb
      }
    }
  })
  section.querySelectorAll('.best-champ-card').forEach((card) => {
    card.addEventListener('click', () => {
      const champion = (card as HTMLElement).dataset.champion ?? ''
      const playerId = (card as HTMLElement).dataset.playerId ?? ''
      const playerName = (card as HTMLElement).dataset.playerName ?? ''
      showOtpDetailModal(champion, playerId, playerName, matchList, ranking)
    })
  })
  return section
}

function createOtpDetailModal(): HTMLElement {
  const root = document.createElement('div')
  root.className = 'profile-modal otp-detail-modal'
  root.id = 'otp-detail-modal'
  root.innerHTML = `
    <div class="profile-modal-overlay"></div>
    <div class="profile-modal-panel">
      <button type="button" class="profile-modal-close" aria-label="Fechar">×</button>
      <div class="profile-modal-content otp-detail-content"></div>
    </div>
  `
  root.querySelector('.profile-modal-overlay')!.addEventListener('click', () => root.classList.remove('open'))
  root.querySelector('.profile-modal-close')!.addEventListener('click', () => root.classList.remove('open'))
  return root
}

let currentEditMatch: Match | null = null

function createEditMatchModal(): HTMLElement {
  const root = document.createElement('div')
  root.className = 'profile-modal edit-match-modal'
  root.id = 'edit-match-modal'
  root.innerHTML = `
    <div class="profile-modal-overlay"></div>
    <div class="profile-modal-panel edit-match-panel">
      <button type="button" class="profile-modal-close" aria-label="Fechar">×</button>
      <div class="profile-modal-content edit-match-content">
        <h2 class="edit-match-title">Editar partida</h2>
        <p class="edit-match-hint mb-4 text-slate-400 text-sm">Ajuste campeão e K/D/A de cada jogador.</p>
        <div class="edit-match-form"></div>
        <div class="edit-match-actions mt-4 flex gap-3">
          <button type="button" class="edit-match-save rounded-xl px-5 py-2.5 text-sm font-semibold bg-amber-500 hover:bg-amber-400 text-slate-900">Salvar</button>
          <button type="button" class="edit-match-cancel rounded-xl px-5 py-2.5 text-sm font-semibold bg-slate-600 hover:bg-slate-500 text-white">Cancelar</button>
        </div>
      </div>
    </div>
  `
  root.querySelector('.profile-modal-overlay')!.addEventListener('click', () => root.classList.remove('open'))
  root.querySelector('.profile-modal-close')!.addEventListener('click', () => root.classList.remove('open'))
  root.querySelector('.edit-match-cancel')!.addEventListener('click', () => root.classList.remove('open'))
  root.querySelector('.edit-match-save')!.addEventListener('click', async () => {
    const m = currentEditMatch
    if (!m) return
    const formEl = root.querySelector('.edit-match-form')
    if (!formEl) return
    const picks: ChampionPick[] = []
    const kda: KdaEntry[] = []
    const imageUrlInput = formEl.querySelector('.edit-match-image-url') as HTMLInputElement
    const imageUrl = imageUrlInput?.value?.trim() ?? ''
    formEl.querySelectorAll('.edit-match-row').forEach((row) => {
      const champInput = row.querySelector('.edit-match-champ') as HTMLInputElement
      const playerId = champInput?.dataset?.playerId ?? ''
      const champRaw = champInput?.value?.trim() ?? ''
      const champ = champRaw ? getCanonicalChampionName(champRaw) : ''
      const k = parseInt((row.querySelector('.edit-match-k') as HTMLInputElement)?.value ?? '0', 10) || 0
      const d = parseInt((row.querySelector('.edit-match-d') as HTMLInputElement)?.value ?? '0', 10) || 0
      const a = parseInt((row.querySelector('.edit-match-a') as HTMLInputElement)?.value ?? '0', 10) || 0
      if (playerId) {
        picks.push({ playerId, champion: champ })
        kda.push({ playerId, kills: k, deaths: d, assists: a })
      }
    })
    await updateMatch(m.id, picks, kda, imageUrl)
    currentEditMatch = null
    root.classList.remove('open')
  })
  return root
}

function showEditMatchModal(m: Match) {
  const root = document.getElementById('edit-match-modal')
  const formEl = root?.querySelector('.edit-match-form')
  if (!root || !formEl) return
  currentEditMatch = m
  const nameById = new Map(players.map((p) => [p.id, p.name]))
  const allPlayerIds = [...m.winnerIds, ...m.loserIds]
  const pickByPlayer = new Map(m.picks.map((p) => [p.playerId, p.champion]))
  const kdaByPlayer = new Map((m.kda ?? []).map((e) => [e.playerId, e]))
  const rows = allPlayerIds.map((playerId) => {
    const name = nameById.get(playerId) ?? playerId
    const champ = pickByPlayer.get(playerId) ?? ''
    const kda = kdaByPlayer.get(playerId)
    const k = kda?.kills ?? 0
    const d = kda?.deaths ?? 0
    const a = kda?.assists ?? 0
    return `<div class="edit-match-row flex flex-wrap items-center gap-3 py-2 border-b border-slate-700/50">
      <span class="edit-match-player-name min-w-[8rem] text-slate-200">${escapeHtml(name)}</span>
      <label class="flex items-center gap-2"><span class="text-slate-500 text-sm">Campeão</span><input type="text" class="edit-match-champ rounded-lg px-3 py-1.5 text-sm border border-slate-600 bg-slate-800 text-white" data-player-id="${escapeHtml(playerId)}" value="${escapeHtml(champ)}" placeholder="Campeão" /></label>
      <label class="flex items-center gap-2"><span class="text-slate-500 text-sm">K</span><input type="number" class="edit-match-k rounded-lg px-2 py-1.5 text-sm border border-slate-600 bg-slate-800 text-white w-14" data-player-id="${escapeHtml(playerId)}" value="${k}" min="0" /></label>
      <label class="flex items-center gap-2"><span class="text-slate-500 text-sm">D</span><input type="number" class="edit-match-d rounded-lg px-2 py-1.5 text-sm border border-slate-600 bg-slate-800 text-white w-14" data-player-id="${escapeHtml(playerId)}" value="${d}" min="0" /></label>
      <label class="flex items-center gap-2"><span class="text-slate-500 text-sm">A</span><input type="number" class="edit-match-a rounded-lg px-2 py-1.5 text-sm border border-slate-600 bg-slate-800 text-white w-14" data-player-id="${escapeHtml(playerId)}" value="${a}" min="0" /></label>
    </div>`
  }).join('')
  const imageUrlVal = m.imageUrl ?? ''
  formEl.innerHTML = `
    <div class="edit-match-row flex flex-wrap items-start gap-3 py-2 border-b border-slate-700/50">
      <label class="flex flex-col gap-1 w-full max-w-md">
        <span class="text-slate-500 text-sm">URL da imagem / print da partida (opcional)</span>
        <input type="url" class="edit-match-image-url rounded-lg px-3 py-1.5 text-sm border border-slate-600 bg-slate-800 text-white" value="${escapeHtml(imageUrlVal)}" placeholder="https://... ou data:image/..." />
        <span class="text-slate-600 text-xs">Cole a URL ou data URL da imagem. Deixe vazio para remover.</span>
      </label>
    </div>
    ${rows}
  `
  root.classList.add('open')
}

function showOtpDetailModal(
  champion: string,
  playerId: string,
  playerName: string,
  matchList: Match[],
  ranking: PlayerStats[]
) {
  const root = document.getElementById('otp-detail-modal')
  const content = root?.querySelector('.otp-detail-content')
  if (!root || !content) return
  const nameById = new Map<string, string>()
  ranking.forEach((s) => nameById.set(s.player.id, s.player.name))
  const champKey = champion.trim().toLowerCase()
  const matchesWithChamp = matchList.filter((m) => {
    const pick = m.picks?.find((p) => p.playerId === playerId)
    return pick && pick.champion.trim().toLowerCase() === champKey
  })
  const iconUrl = getChampionIconUrl(champion)
  const iconHtml = iconUrl ? `<img class="otp-detail-champ-icon" src="${escapeHtml(iconUrl)}" alt="" width="48" height="48" />` : ''
  let rowsHtml = ''
  for (let i = matchesWithChamp.length - 1; i >= 0; i--) {
    const m = matchesWithChamp[i]
    const winnerSet = new Set(m.winnerIds)
    const won = winnerSet.has(playerId)
    const kdaList = m.kda ?? []
    const kdaByPlayer = new Map(kdaList.map((e) => [e.playerId, e]))
    const kda = kdaByPlayer.get(playerId)
    const kdaStr = kda ? `${kda.kills}/${kda.deaths}/${kda.assists}` : '—'
    const ratioStr = kda && kda.deaths > 0 ? ((kda.kills + kda.assists) / kda.deaths).toFixed(1) : '—'
    const dateStr = m.createdAt
      ? new Date(m.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Sao_Paulo' })
      : '—'
    const matchH = getMatchHighlightIds(m)
    const badges: string[] = []
    if (playerId === matchH.mvpPlayerId) badges.push('<span class="history-player-badge history-player-badge--positive">MVP</span>')
    if (kdaList.length > 0) {
      const withRatio = kdaList.map((e) => ({ playerId: e.playerId, ratio: (e.kills + e.assists) / Math.max(e.deaths, 1) }))
      const best = withRatio.reduce((a, b) => (b.ratio > a.ratio ? b : a), withRatio[0])
      const worst = withRatio.reduce((a, b) => (b.ratio < a.ratio ? b : a), withRatio[0])
      if (playerId === best?.playerId) badges.push('<span class="history-player-badge history-player-badge--positive">Melhor KDA</span>')
      if (playerId === worst?.playerId) badges.push('<span class="history-player-badge history-player-badge--negative">Pior KDA</span>')
    }
    if (playerId === matchH.topAssistsPlayerId) badges.push('<span class="history-player-badge history-player-badge--positive">Mais assistências</span>')
    if (playerId === matchH.topHealedPlayerId) badges.push('<span class="history-player-badge history-player-badge--positive">Mais curou</span>')
    if (playerId === matchH.topSelfMitigatedPlayerId) badges.push('<span class="history-player-badge history-player-badge--positive">Mais tankou</span>')
    if (playerId === matchH.topDamageReceivedPlayerId) badges.push('<span class="history-player-badge history-player-badge--negative">Mais dano recebido</span>')
    if (playerId === matchH.topDamageToTowersPlayerId) badges.push('<span class="history-player-badge history-player-badge--positive">Mais dano a torres</span>')
    if (playerId === matchH.topKillStreakPlayerId) badges.push('<span class="history-player-badge history-player-badge--positive">Maior sequência</span>')
    if (playerId === matchH.topMultikillPlayerId) badges.push('<span class="history-player-badge history-player-badge--positive">Maior multiabate</span>')
    const badgeHtml = badges.length > 0 ? badges.join(' ') : '—'
    rowsHtml += `<tr>
      <td class="otp-detail-date">${escapeHtml(dateStr)}</td>
      <td class="otp-detail-result">${won ? '<span class="vd-wins">V</span>' : '<span class="vd-losses">D</span>'}</td>
      <td class="otp-detail-kda">${kdaStr}</td>
      <td class="otp-detail-ratio">${ratioStr}</td>
      <td class="otp-detail-badges">${badgeHtml}</td>
    </tr>`
  }
  content.innerHTML = `
    <div class="otp-detail-header">
      ${iconHtml}
      <div>
        <h2 class="otp-detail-title">${escapeHtml(champion)} <span class="otp-detail-subtitle">— ${escapeHtml(playerName)}</span></h2>
        <p class="otp-detail-hint">Partidas com ${escapeHtml(champion)} e destaques por partida.</p>
      </div>
    </div>
    ${matchesWithChamp.length === 0 ? '<p class="empty-hint">Nenhuma partida registrada com este campeão.</p>' : `
    <div class="otp-detail-table-wrap">
      <table class="otp-detail-table">
        <thead><tr><th>Data</th><th>Resultado</th><th>K/D/A</th><th>Ratio</th><th>Destaques</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
    `}
  `
  root.classList.add('open')
}

/** Recordes: quantas vezes cada jogador foi destaque na partida. */
function computeRecordsCounts(matchList: Match[], ranking: PlayerStats[]) {
  const initMap = () => {
    const m = new Map<string, number>()
    ranking.forEach((s) => m.set(s.player.id, 0))
    return m
  }
  const mostKillsCount = initMap()
  const mostDeathsCount = initMap()
  const mostAssistsCount = initMap()
  const mvpCount = initMap()
  const bestKdaCount = initMap()
  const worstKdaCount = initMap()
  const topDamageCount = initMap()
  const topDamageReceivedCount = initMap()
  const topHealedCount = initMap()
  const topMitigatedCount = initMap()
  const topDamageToTowersCount = initMap()
  const topKillStreakCount = initMap()
  const topMultikillCount = initMap()
  const topGoldCount = initMap()
  const topCsCount = initMap()

  for (const m of matchList) {
    const kdaList = m.kda ?? []
    const h = getMatchHighlightIds(m)

    if (kdaList.length > 0) {
      const maxKills = Math.max(...kdaList.map((e) => e.kills))
      const maxDeaths = Math.max(...kdaList.map((e) => e.deaths))
      const maxAssists = Math.max(...kdaList.map((e) => e.assists))
      kdaList.forEach((e) => {
        if (e.kills === maxKills) mostKillsCount.set(e.playerId, (mostKillsCount.get(e.playerId) ?? 0) + 1)
        if (e.deaths === maxDeaths) mostDeathsCount.set(e.playerId, (mostDeathsCount.get(e.playerId) ?? 0) + 1)
        if (e.assists === maxAssists) mostAssistsCount.set(e.playerId, (mostAssistsCount.get(e.playerId) ?? 0) + 1)
      })
      const withRatio = kdaList.map((e) => ({ playerId: e.playerId, ratio: (e.kills + e.assists) / Math.max(e.deaths, 1) }))
      const best = withRatio.reduce((a, b) => (b.ratio > a.ratio ? b : a), withRatio[0])
      const worst = withRatio.reduce((a, b) => (b.ratio < a.ratio ? b : a), withRatio[0])
      if (best) bestKdaCount.set(best.playerId, (bestKdaCount.get(best.playerId) ?? 0) + 1)
      if (worst) worstKdaCount.set(worst.playerId, (worstKdaCount.get(worst.playerId) ?? 0) + 1)
    }
    if (h.mvpPlayerId) mvpCount.set(h.mvpPlayerId, (mvpCount.get(h.mvpPlayerId) ?? 0) + 1)
    if (h.topDamageReceivedPlayerId) topDamageReceivedCount.set(h.topDamageReceivedPlayerId, (topDamageReceivedCount.get(h.topDamageReceivedPlayerId) ?? 0) + 1)
    if (h.topHealedPlayerId) topHealedCount.set(h.topHealedPlayerId, (topHealedCount.get(h.topHealedPlayerId) ?? 0) + 1)
    if (h.topSelfMitigatedPlayerId) topMitigatedCount.set(h.topSelfMitigatedPlayerId, (topMitigatedCount.get(h.topSelfMitigatedPlayerId) ?? 0) + 1)
    if (h.topDamageToTowersPlayerId) topDamageToTowersCount.set(h.topDamageToTowersPlayerId, (topDamageToTowersCount.get(h.topDamageToTowersPlayerId) ?? 0) + 1)
    if (h.topKillStreakPlayerId) topKillStreakCount.set(h.topKillStreakPlayerId, (topKillStreakCount.get(h.topKillStreakPlayerId) ?? 0) + 1)
    if (h.topMultikillPlayerId) topMultikillCount.set(h.topMultikillPlayerId, (topMultikillCount.get(h.topMultikillPlayerId) ?? 0) + 1)
    const stats = m.matchExtendedStats ?? []
    if (stats.length > 0) {
      let maxDmg = 0
      let maxGold = 0
      let maxCs = 0
      let topDmgId: string | null = null
      let topGoldId: string | null = null
      let topCsId: string | null = null
      stats.forEach((s) => {
        const d = s.damageToChampions ?? 0
        const g = s.goldEarned ?? 0
        const cs = s.minionsKilled ?? 0
        if (d > maxDmg) { maxDmg = d; topDmgId = s.playerId }
        if (g > maxGold) { maxGold = g; topGoldId = s.playerId }
        if (cs > maxCs) { maxCs = cs; topCsId = s.playerId }
      })
      if (topDmgId) topDamageCount.set(topDmgId, (topDamageCount.get(topDmgId) ?? 0) + 1)
      if (topGoldId) topGoldCount.set(topGoldId, (topGoldCount.get(topGoldId) ?? 0) + 1)
      if (topCsId) topCsCount.set(topCsId, (topCsCount.get(topCsId) ?? 0) + 1)
    }
  }
  return {
    mostKillsCount,
    mostDeathsCount,
    mostAssistsCount,
    mvpCount,
    bestKdaCount,
    worstKdaCount,
    topDamageCount,
    topDamageReceivedCount,
    topHealedCount,
    topMitigatedCount,
    topDamageToTowersCount,
    topKillStreakCount,
    topMultikillCount,
    topGoldCount,
    topCsCount,
  }
}

/** Splash art por tipo de recorde (campeões ainda não usados em Destaques/Ranking/OTP). */
const RECORD_SPLASH: Record<string, string> = {
  'Mais abates na partida': 'Katarina',
  'Mais mortes na partida': 'Aatrox',
  'Mais assistências na partida': 'Sona',
  'Mais MVP': 'Ahri',
  'Mais dano na partida': 'Zed',
  'Melhor KDA na partida': 'Riven',
  'Pior KDA na partida': 'Mordekaiser',
  'Mais dano recebido': 'Garen',
  'Mais curou': 'Soraka',
  'Mais tankou': 'Malphite',
  'Mais dano a torres': 'Tristana',
  'Maior sequência de abates': 'Pyke',
  'Maior multiabate': 'Darius',
  'Mais ouro na partida': 'Gangplank',
  'Mais CS na partida': 'Sivir',
}

function createRecordsSection(matchList: Match[], ranking: PlayerStats[]) {
  const section = document.createElement('section')
  section.className = 'card records-section'
  const recBgUrl = getChampionSplashUrl('Jhin', 2) ?? ''
  const recBgStyle = recBgUrl ? ` style="background-image: url(${escapeHtml(recBgUrl)})"` : ''
  const nameById = new Map<string, string>()
  ranking.forEach((s) => nameById.set(s.player.id, s.player.name))

  const counts = computeRecordsCounts(matchList, ranking)
  const toSorted = (map: Map<string, number>) => [...map.entries()].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1])
  const getTop = (entries: [string, number][]): { playerId: string; count: number } | null => {
    if (entries.length === 0) return null
    const [playerId, count] = entries[0]
    return { playerId, count }
  }
  type RecordDef = { label: string; entries: [string, number][]; theme: 'positive' | 'negative' | 'neutral' }
  const records: RecordDef[] = [
    { label: 'Mais abates na partida', entries: toSorted(counts.mostKillsCount), theme: 'positive' },
    { label: 'Mais mortes na partida', entries: toSorted(counts.mostDeathsCount), theme: 'negative' },
    { label: 'Mais assistências na partida', entries: toSorted(counts.mostAssistsCount), theme: 'positive' },
    { label: 'Mais MVP', entries: toSorted(counts.mvpCount), theme: 'positive' },
    { label: 'Mais dano na partida', entries: toSorted(counts.topDamageCount), theme: 'positive' },
    { label: 'Melhor KDA na partida', entries: toSorted(counts.bestKdaCount), theme: 'positive' },
    { label: 'Pior KDA na partida', entries: toSorted(counts.worstKdaCount), theme: 'negative' },
    { label: 'Mais dano recebido', entries: toSorted(counts.topDamageReceivedCount), theme: 'negative' },
    { label: 'Mais curou', entries: toSorted(counts.topHealedCount), theme: 'positive' },
    { label: 'Mais tankou', entries: toSorted(counts.topMitigatedCount), theme: 'positive' },
    { label: 'Mais dano a torres', entries: toSorted(counts.topDamageToTowersCount), theme: 'positive' },
    { label: 'Maior sequência de abates', entries: toSorted(counts.topKillStreakCount), theme: 'positive' },
    { label: 'Maior multiabate', entries: toSorted(counts.topMultikillCount), theme: 'positive' },
    { label: 'Mais ouro na partida', entries: toSorted(counts.topGoldCount), theme: 'neutral' },
    { label: 'Mais CS na partida', entries: toSorted(counts.topCsCount), theme: 'neutral' },
  ]
  const itemsHtml = records
    .map((r) => {
      const top = getTop(r.entries)
      const bgChamp = RECORD_SPLASH[r.label] ?? 'Lux'
      const bgUrl = getChampionSplashUrl(bgChamp, 1) ?? ''
      const bgStyle = bgUrl ? ` style="background-image: url(${escapeHtml(bgUrl)})"` : ''
      const theme = r.theme
      const badgeClass = theme === 'positive' ? 'highlight-badge--positive' : theme === 'negative' ? 'highlight-badge--negative' : 'highlight-badge--neutral'
      const content =
        top && top.count > 0
          ? `<span class="records-name">${escapeHtml(nameById.get(top.playerId) ?? top.playerId)}</span><span class="records-count highlight-badge ${badgeClass}">${top.count}x</span>`
          : '<span class="records-empty">—</span>'
      return `<div class="records-item records-item--${theme}">
        <div class="records-item-bg"${bgStyle} aria-hidden="true"></div>
        <div class="records-item-overlay"></div>
        <span class="records-label">${escapeHtml(r.label)}</span>
        <div class="records-content">${content}</div>
      </div>`
    })
    .join('')

  section.innerHTML = `
    <div class="records-section-bg"${recBgStyle} aria-hidden="true"></div>
    <div class="records-section-overlay"></div>
    <h2>Recordes</h2>
    <p class="records-hint">Jogador que mais vezes foi destaque em cada categoria (dados do histórico de partidas).</p>
    <div class="records-grid">${itemsHtml}</div>
  `
  return section
}

/** Conta quantas vezes cada jogador teve cada destaque (MVP, melhor KDA, etc.). */
function computeIndividualHighlightCounts(matchList: Match[], ranking: PlayerStats[]) {
  const counts: Record<string, Record<string, number>> = {}
  const labels = ['MVP', 'Melhor KDA', 'Pior KDA', 'Mais assist.', 'Mais dano', 'Mais dano rec.', 'Mais curou', 'Mais tankou', 'Mais dano torres', 'Maior sequência', 'Maior multiabate'] as const
  ranking.forEach((s) => {
    counts[s.player.id] = {}
    labels.forEach((l) => { counts[s.player.id][l] = 0 })
  })
  for (const m of matchList) {
    const h = getMatchHighlightIds(m)
    const kdaList = m.kda ?? []
    let bestPlayerId: string | null = null
    let worstPlayerId: string | null = null
    if (kdaList.length > 0) {
      const withRatio = kdaList.map((e) => ({ playerId: e.playerId, ratio: (e.kills + e.assists) / Math.max(e.deaths, 1) }))
      bestPlayerId = withRatio.reduce((a, b) => (b.ratio > a.ratio ? b : a), withRatio[0]).playerId
      worstPlayerId = withRatio.reduce((a, b) => (b.ratio < a.ratio ? b : a), withRatio[0]).playerId
    }
    const inc = (id: string | null, key: (typeof labels)[number]) => {
      if (id && counts[id]) counts[id][key] = (counts[id][key] ?? 0) + 1
    }
    inc(h.mvpPlayerId, 'MVP')
    inc(bestPlayerId, 'Melhor KDA')
    inc(worstPlayerId, 'Pior KDA')
    inc(h.topAssistsPlayerId, 'Mais assist.')
    inc(h.topDamageReceivedPlayerId, 'Mais dano rec.')
    inc(h.topHealedPlayerId, 'Mais curou')
    inc(h.topSelfMitigatedPlayerId, 'Mais tankou')
    inc(h.topDamageToTowersPlayerId, 'Mais dano torres')
    inc(h.topKillStreakPlayerId, 'Maior sequência')
    inc(h.topMultikillPlayerId, 'Maior multiabate')
  }
  return { counts, labels }
}

function createDamageStatsSection(matchList: Match[], ranking: PlayerStats[]) {
  const section = document.createElement('section')
  section.className = 'card damage-stats-section individual-stats-section'
  const dmgBgUrl = getChampionSplashUrl('Caitlyn', 2) ?? ''
  const dmgBgStyle = dmgBgUrl ? ` style="background-image: url(${escapeHtml(dmgBgUrl)})"` : ''
  const { counts, labels } = computeIndividualHighlightCounts(matchList, ranking)
  const rows = ranking
    .map((s) => {
      const c = counts[s.player.id] ?? {}
      const cells = labels.map((label) => {
        const n = c[label] ?? 0
        const cls = n > 0 ? 'individual-stat-cell individual-stat-has' : 'individual-stat-cell'
        return `<td class="${cls}">${n > 0 ? n : '—'}</td>`
      }).join('')
      return `<tr><td class="individual-stat-name">${escapeHtml(s.player.name)}</td>${cells}</tr>`
    })
    .join('')
  const headerCells = labels.map((l) => `<th class="individual-stat-th">${escapeHtml(l)}</th>`).join('')
  const hintText = 'Quantas vezes cada jogador foi destaque na partida: MVP, melhor/pior KDA, mais dano, mais curou, mais tankou, mais dano a torres, maior sequência de abates e maior multiabate.'
  section.innerHTML = `
    <div class="damage-stats-section-bg"${dmgBgStyle} aria-hidden="true"></div>
    <div class="damage-stats-section-overlay"></div>
    <div class="damage-stats-section-inner">
      <h2>Estatísticas individuais</h2>
      <p class="hint">${hintText}</p>
      <div class="individual-stats-table-wrap">
        <table class="individual-stats-table">
          <thead><tr><th class="individual-stat-th-name">Jogador</th>${headerCells}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `
  return section
}

/** Hall of Fame: por partida — melhor KDA, pior KDA, MVP; totais por jogador. */
function createHallOfFameSection(matchList: Match[], ranking: PlayerStats[]) {
  const section = document.createElement('section')
  section.className = 'card hall-of-fame-section'
  const hofBgUrl = getChampionSplashUrl('Lee Sin', 2) ?? ''
  const hofBgStyle = hofBgUrl ? ` style="background-image: url(${escapeHtml(hofBgUrl)})"` : ''
  const nameById = new Map<string, string>()
  ranking.forEach((s) => nameById.set(s.player.id, s.player.name))
  const mvpCount = new Map<string, number>()
  const bestKdaCount = new Map<string, number>()
  const worstKdaCount = new Map<string, number>()
  ranking.forEach((s) => {
    mvpCount.set(s.player.id, 0)
    bestKdaCount.set(s.player.id, 0)
    worstKdaCount.set(s.player.id, 0)
  })
  const topDamageCount = new Map<string, number>()
  const topDamageReceivedCount = new Map<string, number>()
  const topHealedCount = new Map<string, number>()
  const topMitigatedCount = new Map<string, number>()
  const topDamageToTowersCount = new Map<string, number>()
  const topKillStreakCount = new Map<string, number>()
  const topMultikillCount = new Map<string, number>()
  ranking.forEach((s) => {
    topDamageCount.set(s.player.id, 0)
    topDamageReceivedCount.set(s.player.id, 0)
    topHealedCount.set(s.player.id, 0)
    topMitigatedCount.set(s.player.id, 0)
    topDamageToTowersCount.set(s.player.id, 0)
    topKillStreakCount.set(s.player.id, 0)
    topMultikillCount.set(s.player.id, 0)
  })
  for (const m of matchList) {
    const kdaList = m.kda ?? []
    const h = getMatchHighlightIds(m)
    if (h.mvpPlayerId != null) mvpCount.set(h.mvpPlayerId, (mvpCount.get(h.mvpPlayerId) ?? 0) + 1)
    if (kdaList.length > 0) {
      const withRatio = kdaList.map((e) => {
        const d = Math.max(e.deaths, 1)
        const ratio = (e.kills + e.assists) / d
        return { playerId: e.playerId, ratio }
      })
      const best = withRatio.reduce((a, b) => (b.ratio > a.ratio ? b : a), withRatio[0])
      const worst = withRatio.reduce((a, b) => (b.ratio < a.ratio ? b : a), withRatio[0])
      if (best) bestKdaCount.set(best.playerId, (bestKdaCount.get(best.playerId) ?? 0) + 1)
      if (worst) worstKdaCount.set(worst.playerId, (worstKdaCount.get(worst.playerId) ?? 0) + 1)
    }
    if (h.topDamageToChampionsPlayerId) topDamageCount.set(h.topDamageToChampionsPlayerId, (topDamageCount.get(h.topDamageToChampionsPlayerId) ?? 0) + 1)
    if (h.topDamageReceivedPlayerId) topDamageReceivedCount.set(h.topDamageReceivedPlayerId, (topDamageReceivedCount.get(h.topDamageReceivedPlayerId) ?? 0) + 1)
    if (h.topHealedPlayerId) topHealedCount.set(h.topHealedPlayerId, (topHealedCount.get(h.topHealedPlayerId) ?? 0) + 1)
    if (h.topSelfMitigatedPlayerId) topMitigatedCount.set(h.topSelfMitigatedPlayerId, (topMitigatedCount.get(h.topSelfMitigatedPlayerId) ?? 0) + 1)
    if (h.topDamageToTowersPlayerId) topDamageToTowersCount.set(h.topDamageToTowersPlayerId, (topDamageToTowersCount.get(h.topDamageToTowersPlayerId) ?? 0) + 1)
    if (h.topKillStreakPlayerId) topKillStreakCount.set(h.topKillStreakPlayerId, (topKillStreakCount.get(h.topKillStreakPlayerId) ?? 0) + 1)
    if (h.topMultikillPlayerId) topMultikillCount.set(h.topMultikillPlayerId, (topMultikillCount.get(h.topMultikillPlayerId) ?? 0) + 1)
  }
  const mvpSorted = [...mvpCount.entries()].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1])
  const bestKdaSorted = [...bestKdaCount.entries()].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1])
  const worstKdaSorted = [...worstKdaCount.entries()].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1])
  const topDamageSorted = [...topDamageCount.entries()].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1])
  const topReceivedSorted = [...topDamageReceivedCount.entries()].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1])
  const topHealedSorted = [...topHealedCount.entries()].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1])
  const topMitigatedSorted = [...topMitigatedCount.entries()].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1])
  const topTowersSorted = [...topDamageToTowersCount.entries()].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1])
  const topKillStreakSorted = [...topKillStreakCount.entries()].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1])
  const topMultikillSorted = [...topMultikillCount.entries()].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1])
  const block = (title: string, entries: [string, number][]) =>
    entries.length === 0 ? `<div class="hof-block"><h3 class="hof-block-title">${title}</h3><p class="empty-hint">—</p></div>` : `<div class="hof-block"><h3 class="hof-block-title">${title}</h3>${entries.slice(0, 5).map(([id, n]) => `<div class="hof-row"><span class="hof-value">${escapeHtml(nameById.get(id) ?? id)}</span><span class="hof-count">${n}x</span></div>`).join('')}</div>`
  const html = `
    <div class="hall-of-fame-section-bg"${hofBgStyle} aria-hidden="true"></div>
    <div class="hall-of-fame-section-overlay"></div>
    <div class="hall-of-fame-section-inner">
      <h2>Hall of Fame</h2>
      <p class="hof-hint">Destaques por partida: MVP (KDA + vitória + dano/cura), melhor e pior KDA, dano/cura/torres e combate (sequência e multiabate).</p>
      <div class="hof-grid">
        ${block('Mais MVPs', mvpSorted)}
        ${block('Melhor KDA na partida', bestKdaSorted)}
        ${block('Pior KDA na partida', worstKdaSorted)}
        ${block('Mais dano a campeões', topDamageSorted)}
        ${block('Mais dano recebido', topReceivedSorted)}
        ${block('Mais curou', topHealedSorted)}
        ${block('Mais tankou (automitigado)', topMitigatedSorted)}
        ${block('Mais dano a torres', topTowersSorted)}
        ${block('Maior sequência de abates', topKillStreakSorted)}
        ${block('Maior multiabate', topMultikillSorted)}
      </div>
    </div>
  `
  section.innerHTML = html
  return section
}

function escapeHtml(s: string): string {
  const div = document.createElement('div')
  div.textContent = s
  return div.innerHTML
}

init()
