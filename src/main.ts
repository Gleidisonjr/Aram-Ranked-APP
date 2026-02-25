/**
 * Aranked Cabaré — versão simplificada (sem KDA, sem campeões).
 * Visual e UX iguais ao Cabaré v1; lógica simplificada.
 * Projeto completo está em main-cabare-v1.ts.
 */

import './style.css'
import type { Player, PlayerStats, Match } from './types'
import {
  loadPlayers,
  savePlayers,
  loadMatches,
  saveMatches,
  loadDeletedMatchIds,
  saveDeletedMatchIds,
  computeRanking,
  loadFromFile,
  mergeRankingData,
  saveRankingToServer,
  loadSeason,
  getEloByStep,
  computePlayerEvolution,
  computeHeadToHead,
} from './store'
import { getChampionSplashUrl, getRankEmblemUrl, loadChampionData } from './ddragon'

const BR_TIMEZONE = 'America/Cuiaba'

function escapeHtml(s: string): string {
  const div = document.createElement('div')
  div.textContent = s
  return div.innerHTML
}

function getPlayerBadgeHtml(player: Pick<Player, 'badge'>): string {
  if (player.badge === 'creator') return ' <span class="player-badge-boss">Boss</span>'
  if (player.badge === 'troll') return ' <span class="player-badge-troll">Troll</span>'
  return ''
}

function playSound(name: string): void {
  try {
    const base = (import.meta.env.BASE_URL ?? '').replace(/\/+$/, '')
    const url = `${base ? base + '/' : '/'}sounds/${name}.mp3`
    const audio = new Audio(url)
    audio.volume = 0.7
    audio.play().catch(() => {})
  } catch {}
}

let players = loadPlayers()
let matches = loadMatches()

async function init() {
  let file = await loadFromFile()
  if (!file) {
    await new Promise((r) => setTimeout(r, 500))
    file = await loadFromFile()
  }
  const merged = mergeRankingData(file, loadPlayers(), loadMatches())
  players = merged.players
  matches = merged.matches
  savePlayers(players)
  saveMatches(matches)
  await loadChampionData()
  rerender()
}

function rerender() {
  const ranking = computeRanking(players, matches)
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

function getTodayInBrazil(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: BR_TIMEZONE })
}

async function persistRankingToServer(): Promise<void> {
  const result = await saveRankingToServer({ players, matches })
  if (!result.ok) {
    const el = document.getElementById('save-error-toast') || (() => {
      const div = document.createElement('div')
      div.id = 'save-error-toast'
      div.className = 'save-error-toast'
      div.setAttribute('role', 'alert')
      document.body.appendChild(div)
      return div
    })()
    el.textContent = `Falha ao salvar no servidor: ${result.error ?? 'erro desconhecido'}. Seus dados estão salvos localmente.`
    el.classList.add('show')
    setTimeout(() => el.classList.remove('show'), 6000)
  }
}

function addMatchFromSortear(winnerIds: string[], loserIds: string[], createdAtDate?: string, options?: { skipRerender?: boolean }): void {
  const createdAt = createdAtDate?.trim()
    ? (() => {
        const [y, m, d] = createdAtDate.slice(0, 10).split('-').map(Number)
        if (y && m && d) return new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0)).toISOString()
        return new Date().toISOString()
      })()
    : new Date().toISOString()
  const match: Match = {
    id: `m-${Date.now()}`,
    winnerIds,
    loserIds,
    createdAt,
  }
  matches = [match, ...matches]
  saveMatches(matches)
  savePlayers(players)
  persistRankingToServer()
  if (!options?.skipRerender) rerender()
}

function deleteMatch(matchId: string): void {
  if (!confirm('Remover esta partida do histórico? Ela deixará de contar para o ranking.')) return
  matches = matches.filter((m) => m.id !== matchId)
  saveMatches(matches)
  const deletedIds = [...new Set([...loadDeletedMatchIds(), matchId])]
  saveDeletedMatchIds(deletedIds)
  persistRankingToServer()
  rerender()
}

function invertMatch(matchId: string): void {
  const match = matches.find((m) => m.id === matchId)
  if (!match) return
  if (!confirm('Inverter resultado? O time vencedor passará a perdedor e o perdedor a vencedor.')) return
  ;[match.winnerIds, match.loserIds] = [match.loserIds, match.winnerIds]
  saveMatches(matches)
  persistRankingToServer()
  rerender()
}

function renderApp(ranking: PlayerStats[]) {
  const app = document.querySelector<HTMLDivElement>('#app')!
  app.innerHTML = ''
  app.appendChild(createLayout(ranking))
}

function createLayout(ranking: PlayerStats[]) {
  const el = document.createElement('div')
  el.className = 'layout'
  const modal = createProfileModal()
  const createMatchModal = createCreateMatchModal()
  el.append(
    createHeader(),
    createToolbar(),
    createRankingSection(ranking),
    createSortearSection(ranking),
    createHistorySection(),
    createComparePlayersSection(ranking),
    createGraphicsSection(ranking),
    modal,
    createMatchModal
  )
  return el
}

function createHeader() {
  const h = document.createElement('header')
  h.className = 'header'
  h.innerHTML = `
    <h1>Aranked Cabaré</h1>
    <p class="subtitle">Ranking — vitórias, derrotas e ELO</p>
  `
  return h
}

function createToolbar() {
  const bar = document.createElement('div')
  bar.className = 'toolbar'
  const toolbarBgUrl = getChampionSplashUrl('Yasuo', 1) ?? ''
  const toolbarBgStyle = toolbarBgUrl ? ` style="background-image: url(${escapeHtml(toolbarBgUrl)})"` : ''
  bar.innerHTML = `
    <div class="toolbar-bg"${toolbarBgStyle} aria-hidden="true"></div>
    <div class="toolbar-overlay"></div>
    <div class="toolbar-inner">
      <span class="season-label">Temporada: <strong>${escapeHtml(loadSeason())}</strong></span>
    </div>
  `
  return bar
}

function createRankingSection(ranking: PlayerStats[]) {
  const section = document.createElement('section')
  section.className = 'card ranking-section'
  const rankingBgUrl = getChampionSplashUrl('Thresh', 1) ?? ''
  const rankingBgStyle = rankingBgUrl ? ` style="background-image: url(${escapeHtml(rankingBgUrl)})"` : ''
  const headers = ['Jogador', 'ELO', 'V/D', 'Últimos', 'Win%']
  const winrateClass = (winRateStr: string) => {
    const num = parseFloat(winRateStr)
    if (Number.isNaN(num)) return ''
    return num >= 75 ? 'winrate--elite' : num >= 50 ? 'winrate--pos' : 'winrate--neg'
  }
  const totalPlayers = ranking.length
  const rows = ranking
    .map((s, i) => {
      const pos = i + 1
      const name = escapeHtml(s.player.name)
      const badge = getPlayerBadgeHtml(s.player)
      const tierClass = s.patenteTier ? ` patente-${s.patenteTier}` : ''
      const nameInnerTierClass = s.patenteTier ? ` name-inner--${s.patenteTier}` : ' name-inner--unranked'
      const nameInnerClass = s.player.badge === 'creator' ? ' name-inner--boss' : nameInnerTierClass
      const leaderTag = pos === 1 ? ' <span class="player-badge-leader" title="Segui o líder!">Líder</span>' : ''
      const viceLeaderTag = pos === 2 ? ' <span class="player-badge-vice-leader" title="Vice-líder">Vice-líder</span>' : ''
      const lanternTag = pos === totalPlayers && totalPlayers > 0 ? ' <span class="player-badge-lantern" title="Lanterna do ranking">Lanterna</span>' : ''
      const rankEmblemUrl = getRankEmblemUrl(s.patenteTier ?? 'iron')
      const nameCellHtml = `<span class="name-inner${nameInnerClass}"><button type="button" class="name-btn-profile" title="Ver perfil">${name}</button>${badge}${leaderTag}${viceLeaderTag}${lanternTag}</span>`
      const nameCellWithEmblem = rankEmblemUrl
        ? `<span class="name-cell-with-emoji"><img class="patente-emblem patente-emblem--${s.patenteTier ?? 'none'}" src="${escapeHtml(rankEmblemUrl)}" alt="" width="28" height="28" /></span>${nameCellHtml}`
        : nameCellHtml
      const lastDots = (s.lastResults ?? [])
        .map((r) => `<span class="result-dot ${r === 'W' ? 'win' : 'loss'}" title="${r === 'W' ? 'Vitória' : 'Derrota'}">${r === 'W' ? 'V' : 'D'}</span>`)
        .join('')
      const wrClass = winrateClass(s.winRate)
      return `<tr data-player-id="${escapeHtml(s.player.id)}">
        <td class="name">${nameCellWithEmblem}</td>
        <td><div class="patente-cell"><span class="patente-badge${tierClass}">${escapeHtml(s.patente ?? '—')}</span></div></td>
        <td><div class="vd-cell"><span class="vd-wins">${s.wins}</span><span class="vd-sep"> — </span><span class="vd-losses">${s.losses}</span></div></td>
        <td><div class="last-results-cell">${lastDots || '—'}</div></td>
        <td class="winrate"><span class="winrate-val ${wrClass}">${s.winRate}%</span></td>
      </tr>`
    })
    .join('')
  section.innerHTML = `
    <div class="ranking-section-bg"${rankingBgStyle} aria-hidden="true"></div>
    <div class="ranking-section-overlay"></div>
    <div class="ranking-section-inner">
      <h2>Ranking</h2>
      <div class="table-wrap">
        <table class="ranking-table">
          <thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="ranking-cards" aria-label="Ranking em cards para celular" role="list"></div>
    </div>
  `
  const tbody = section.querySelector('tbody')
  tbody?.querySelectorAll('.name-btn-profile').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tr = (btn as HTMLElement).closest('tr')
      const id = tr?.getAttribute('data-player-id')
      if (id) showProfileModal(id, ranking)
    })
  })
  const cardsContainer = section.querySelector('.ranking-cards')
  if (cardsContainer) {
    const totalPlayers = ranking.length
    ranking.forEach((s, i) => {
      const card = document.createElement('div')
      card.className = 'ranking-card'
      card.setAttribute('role', 'listitem')
      const pos = i + 1
      const nameInnerTierClass = s.patenteTier ? ` name-inner--${s.patenteTier}` : ' name-inner--unranked'
      const nameInnerClass = s.player.badge === 'creator' ? ' name-inner--boss' : nameInnerTierClass
      const leaderTag = pos === 1 ? ' <span class="player-badge-leader" title="Líder">Líder</span>' : ''
      const viceLeaderTag = pos === 2 ? ' <span class="player-badge-vice-leader" title="Vice-líder">Vice-líder</span>' : ''
      const lanternTag = pos === totalPlayers && totalPlayers > 0 ? ' <span class="player-badge-lantern" title="Lanterna">Lanterna</span>' : ''
      const nameCellHtml = `<span class="name-inner${nameInnerClass}"><button type="button" class="name-btn-profile">${escapeHtml(s.player.name)}</button>${getPlayerBadgeHtml(s.player)}${leaderTag}${viceLeaderTag}${lanternTag}</span>`
      const rankEmblemUrl = getRankEmblemUrl(s.patenteTier ?? 'iron')
      const nameCellWithEmblem = rankEmblemUrl
        ? `<span class="name-cell-with-emoji"><img class="patente-emblem" src="${escapeHtml(rankEmblemUrl)}" alt="" width="24" height="24" /></span>${nameCellHtml}`
        : nameCellHtml
      const lastDots = (s.lastResults ?? []).map((r) => `<span class="result-dot ${r === 'W' ? 'win' : 'loss'}">${r === 'W' ? 'V' : 'D'}</span>`).join('')
      const wrClass = winrateClass(s.winRate)
      card.innerHTML = `
        <div class="ranking-card-header">
          <div class="ranking-card-name-wrap">${nameCellWithEmblem}</div>
        </div>
        <div class="ranking-card-body">
          <div class="ranking-card-row"><span class="ranking-card-label">V/D</span><span class="vd-wins">${s.wins}</span><span class="vd-sep"> — </span><span class="vd-losses">${s.losses}</span></div>
          <div class="ranking-card-row"><span class="ranking-card-label">Últimos</span><span class="last-results-cell">${lastDots || '—'}</span></div>
          <div class="ranking-card-row"><span class="ranking-card-label">Win%</span><span class="winrate-val ${wrClass}">${s.winRate}%</span></div>
        </div>
      `
      card.querySelector('.name-btn-profile')?.addEventListener('click', () => showProfileModal(s.player.id, ranking))
      cardsContainer.appendChild(card)
    })
  }
  return section
}

/** Jogadores na ordem do ranking (mais partidas / melhor posição primeiro). */
function playersInRankingOrder(ranking: PlayerStats[]): Player[] {
  const order = new Map(ranking.map((s, i) => [s.player.id, i]))
  return [...players].sort((a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999))
}

function sortearPillContent(p: Player, ranking: PlayerStats[], options: { showRemoveButton?: boolean } = {}): string {
  const stats = ranking.find((s) => s.player.id === p.id)
  const pos = stats ? ranking.indexOf(stats) + 1 : 0
  const total = ranking.length
  const leaderTag = pos === 1 ? ' <span class="player-badge-leader" title="Líder">Líder</span>' : ''
  const viceTag = pos === 2 ? ' <span class="player-badge-vice-leader" title="Vice-líder">Vice-líder</span>' : ''
  const lanternTag = pos === total && total > 0 ? ' <span class="player-badge-lantern" title="Lanterna">Lanterna</span>' : ''
  const tier = stats?.patenteTier ?? 'iron'
  const emblemUrl = getRankEmblemUrl(tier)
  const emblemHtml = emblemUrl
    ? `<img class="sortear-pill-emblem" src="${escapeHtml(emblemUrl)}" alt="" width="20" height="20" />`
    : ''
  const namePart = `${escapeHtml(p.name)}${getPlayerBadgeHtml(p)}${leaderTag}${viceTag}${lanternTag}`
  const removeBtn = options.showRemoveButton ? '<button type="button" class="sortear-bag-remove" aria-label="Remover do sorteio">×</button>' : ''
  return `${emblemHtml}<span class="sortear-pill-name">${namePart}</span>${removeBtn}`
}

function refreshSortearPool(section: Element, ranking: PlayerStats[]): void {
  const pool = section.querySelector('.sortear-pool')
  const bag = section.querySelector('.sortear-bag')
  if (!pool || !bag) return
  const inBag = new Set(Array.from(bag.querySelectorAll('.sortear-bag-pill')).map((el) => el.getAttribute('data-player-id')).filter(Boolean) as string[])
  const ordered = playersInRankingOrder(ranking)
  const toShow = ordered.filter((p) => !inBag.has(p.id))
  pool.innerHTML = toShow
    .map(
      (p) =>
        `<span class="sortear-pill" draggable="true" data-player-id="${escapeHtml(p.id)}" data-player-name="${escapeHtml(p.name)}" role="button" tabindex="0">${sortearPillContent(p, ranking)}</span>`
    )
    .join('')
  pool.querySelectorAll('.sortear-pill').forEach((pill) => {
    pill.setAttribute('draggable', 'true')
    pill.addEventListener('dragstart', (e) => {
      const ev = e as DragEvent
      pill.classList.add('dragging')
      ev.dataTransfer?.setData('application/json', JSON.stringify({ playerId: (pill as HTMLElement).dataset.playerId, playerName: (pill as HTMLElement).dataset.playerName }))
      ev.dataTransfer!.effectAllowed = 'move'
    })
    pill.addEventListener('dragend', () => pill.classList.remove('dragging'))
    ;(pill as HTMLElement).addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Enter' || (e as KeyboardEvent).key === ' ') {
        e.preventDefault()
        const bagEl = section.querySelector('.sortear-bag')
        if (bagEl) {
          const playerId = (pill as HTMLElement).dataset.playerId
          const playerName = (pill as HTMLElement).dataset.playerName
          const p = players.find((x) => x.id === playerId)
          if (p && playerId && playerName) addPlayerPillToBag(section, bagEl, p, ranking)
          refreshSortearPool(section, ranking)
        }
      }
    })
  })
}

function addPlayerPillToBag(section: Element, bag: Element, p: Player, ranking: PlayerStats[]): void {
  const pill = document.createElement('span')
  pill.className = 'sortear-bag-pill'
  pill.setAttribute('data-player-id', p.id)
  pill.innerHTML = sortearPillContent(p, ranking, { showRemoveButton: true })
  bag.appendChild(pill)
  pill.querySelector('.sortear-bag-remove')?.addEventListener('click', () => {
    pill.remove()
    refreshSortearPool(section, computeRanking(players, matches))
  })
}

function setupSortearBagDrop(section: Element, ranking: PlayerStats[]): void {
  const bag = section.querySelector('.sortear-bag')
  if (!bag) return
  bag.addEventListener('dragover', (e) => {
    e.preventDefault()
    ;(e as DragEvent).dataTransfer!.dropEffect = 'move'
    bag.classList.add('drag-over')
  })
  bag.addEventListener('dragleave', () => bag.classList.remove('drag-over'))
  bag.addEventListener('drop', (e) => {
    e.preventDefault()
    bag.classList.remove('drag-over')
    const ev = e as DragEvent
    const json = ev.dataTransfer?.getData('application/json')
    if (!json) return
    try {
      const { playerId } = JSON.parse(json) as { playerId: string; playerName: string }
      const p = players.find((x) => x.id === playerId)
      if (!p) return
      addPlayerPillToBag(section, bag, p, ranking)
      refreshSortearPool(section, ranking)
    } catch {
      // ignore
    }
  })
}

function createSortearSection(ranking: PlayerStats[]) {
  const section = document.createElement('section')
  section.className = 'card sortear-section'
  const sortearBgUrl = getChampionSplashUrl('Lux', 1) ?? ''
  const sortearBgStyle = sortearBgUrl ? ` style="background-image: url(${escapeHtml(sortearBgUrl)})"` : ''
  section.innerHTML = `
    <div class="sortear-section-bg"${sortearBgStyle} aria-hidden="true"></div>
    <div class="sortear-section-overlay"></div>
    <div class="sortear-section-inner">
      <h2>Sortear times</h2>
      <div class="sortear-add-player mb-4 flex flex-wrap gap-2 items-center">
        <input type="text" class="add-player-input rounded-lg px-3 py-2 bg-slate-800 border border-slate-600 text-white text-sm w-48" placeholder="Nome do jogador" />
        <button type="button" class="btn btn-secondary btn-sm add-player-btn">Adicionar jogador</button>
      </div>
      <p class="sortear-hint text-slate-400 text-sm mb-2">Arraste os jogadores para o baú para incluí-los no sorteio (mín. 6).</p>
      <div class="sortear-pool-wrap mb-3">
        <p class="text-slate-500 text-xs mb-1.5">Jogadores</p>
        <div class="sortear-pool"></div>
      </div>
      <div class="sortear-bag-wrap mb-4">
        <p class="text-slate-500 text-xs mb-1.5">No sorteio</p>
        <div class="sortear-bag" role="region" aria-label="Baú do sorteio"></div>
      </div>
      <button type="button" class="btn btn-primary sortear-btn">Sortear times</button>
      <div class="sortear-result mt-5 min-h-[2rem]" aria-live="polite"></div>
    </div>
  `
  const inner = section.querySelector('.sortear-section-inner')
  refreshSortearPool(section, ranking)
  setupSortearBagDrop(section, ranking)

  const addWrap = section.querySelector('.sortear-add-player')
  addWrap?.querySelector('.add-player-btn')?.addEventListener('click', () => {
    const input = addWrap.querySelector<HTMLInputElement>('.add-player-input')
    if (input?.value.trim()) {
      addPlayer(input.value.trim())
      input.value = ''
    }
  })
  addWrap?.querySelector('.add-player-input')?.addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Enter') (addWrap.querySelector('.add-player-btn') as HTMLButtonElement)?.click()
  })

  const resultEl = section.querySelector('.sortear-result')!
  const sortearBtn = section.querySelector('.sortear-btn')
  sortearBtn?.addEventListener('click', () => {
    const bagPills = section.querySelectorAll('.sortear-bag .sortear-bag-pill')
    const selectedPlayers = Array.from(bagPills)
      .map((el) => players.find((p) => p.id === el.getAttribute('data-player-id')))
      .filter((p): p is Player => !!p)
    if (selectedPlayers.length < 6) {
      resultEl.innerHTML = '<p class="sortear-error m-0 text-red-400 text-sm font-medium">Coloque pelo menos 6 jogadores no baú do sorteio.</p>'
      return
    }
    const shuffled = [...selectedPlayers].sort(() => Math.random() - 0.5)
    const mid = Math.ceil(shuffled.length / 2)
    const team1 = shuffled.slice(0, mid)
    const team2 = shuffled.slice(mid)
    const statsById = new Map(ranking.map((s) => [s.player.id, s]))
    const totalRank = ranking.length
    const sortearResultPlayerRow = (p: Player) => {
      const s = statsById.get(p.id)
      const pos = ranking.findIndex((x) => x.player.id === p.id) + 1
      const leaderTag = pos === 1 ? ' <span class="player-badge-leader" title="Líder">Líder</span>' : ''
      const viceTag = pos === 2 ? ' <span class="player-badge-vice-leader" title="Vice-líder">Vice-líder</span>' : ''
      const lanternTag = pos === totalRank && totalRank > 0 ? ' <span class="player-badge-lantern" title="Lanterna">Lanterna</span>' : ''
      const tier = s?.patenteTier ?? 'iron'
      const emblemUrl = getRankEmblemUrl(tier)
      const emblemHtml = emblemUrl ? `<img class="sortear-result-emblem" src="${escapeHtml(emblemUrl)}" alt="" width="22" height="22" />` : ''
      const namePart = `${escapeHtml(p.name)}${getPlayerBadgeHtml(p)}${leaderTag}${viceTag}${lanternTag}`
      const lastFive = (s?.lastResults ?? []).slice(0, 5).map((r) => `<span class="result-dot ${r === 'W' ? 'win' : 'loss'}" title="${r === 'W' ? 'Vitória' : 'Derrota'}">${r === 'W' ? 'V' : 'D'}</span>`).join('')
      const lastGamesHtml = lastFive ? `<span class="sortear-result-last-wrap">Últimos: <span class="sortear-result-last-dots">${lastFive}</span></span>` : ''
      return `<span class="min-w-0 flex flex-col gap-0.5"><span class="flex items-center gap-2">${emblemHtml}<span>${namePart}</span></span>${lastGamesHtml}</span>`
    }
    playSound('sortear-start')
    setTimeout(() => {
      playSound('sortear-done')
      resultEl.innerHTML = `
        <div class="sortear-result-header mb-4 pb-3 border-b border-slate-600">
          <p class="m-0 text-slate-400 text-sm font-medium">Resultado do sorteio</p>
        </div>
        <div class="sortear-teams flex flex-wrap items-stretch gap-5 mb-4">
          <div class="sortear-team sortear-team--1 flex-1 min-w-[180px] rounded-2xl border-2 border-sky-500/40 bg-gradient-to-b from-slate-800/90 to-slate-800/50 p-5 shadow-lg ring-1 ring-slate-700/50">
            <h4 class="m-0 mb-4 text-sm font-bold uppercase tracking-widest text-sky-400/90">Equipe 1</h4>
            <ul class="m-0 p-0 list-none space-y-2.5">${team1.map((p) => `<li class="sortear-team-player py-2 px-3 rounded-xl bg-slate-700/50 text-slate-200 text-sm font-medium flex flex-wrap items-center justify-between gap-1.5">${sortearResultPlayerRow(p)}</li>`).join('')}</ul>
            <div class="mt-4 pt-4 border-t border-slate-600/50">
              <button type="button" class="sortear-win-1 btn w-full rounded-xl px-4 py-2.5 text-sm font-semibold bg-sky-600 hover:bg-sky-500 text-white">Equipe 1 venceu</button>
            </div>
          </div>
          <div class="sortear-vs flex items-center justify-center shrink-0 w-14 text-3xl font-black text-slate-400 drop-shadow-sm">vs</div>
          <div class="sortear-team sortear-team--2 flex-1 min-w-[180px] rounded-2xl border-2 border-amber-500/40 bg-gradient-to-b from-slate-800/90 to-slate-800/50 p-5 shadow-lg ring-1 ring-slate-700/50">
            <h4 class="m-0 mb-4 text-sm font-bold uppercase tracking-widest text-amber-400/90">Equipe 2</h4>
            <ul class="m-0 p-0 list-none space-y-2.5">${team2.map((p) => `<li class="sortear-team-player py-2 px-3 rounded-xl bg-slate-700/50 text-slate-200 text-sm font-medium flex flex-wrap items-center justify-between gap-1.5">${sortearResultPlayerRow(p)}</li>`).join('')}</ul>
            <div class="mt-4 pt-4 border-t border-slate-600/50">
              <button type="button" class="sortear-win-2 btn w-full rounded-xl px-4 py-2.5 text-sm font-semibold bg-amber-600 hover:bg-amber-500 text-slate-900">Equipe 2 venceu</button>
            </div>
          </div>
        </div>
        <div class="flex flex-wrap justify-center gap-3">
          <button type="button" class="sortear-invert-teams btn rounded-xl px-5 py-2.5 text-sm font-semibold bg-amber-600/80 hover:bg-amber-500/80 text-slate-900">⇅ Inverter times</button>
          <button type="button" class="sortear-again btn rounded-xl px-5 py-2.5 text-sm font-semibold bg-slate-600 hover:bg-slate-500 text-white">Sortear de novo</button>
        </div>
      `
      const resultDiv = resultEl as HTMLElement
      resultDiv.dataset.team1Ids = team1.map((p) => p.id).join(',')
      resultDiv.dataset.team2Ids = team2.map((p) => p.id).join(',')

      function attachSortearWinHandlers(): void {
        resultEl.querySelector('.sortear-win-1')?.addEventListener('click', () => {
          const t1 = (resultDiv.dataset.team1Ids ?? '').split(',').filter(Boolean)
          const t2 = (resultDiv.dataset.team2Ids ?? '').split(',').filter(Boolean)
          if (t1.length && t2.length && confirm('Confirmar resultado? Equipe 1 venceu. A partida será registrada.')) {
            addMatchFromSortear(t1, t2)
            resultDiv.innerHTML = ''
          }
        })
        resultEl.querySelector('.sortear-win-2')?.addEventListener('click', () => {
          const t1 = (resultDiv.dataset.team1Ids ?? '').split(',').filter(Boolean)
          const t2 = (resultDiv.dataset.team2Ids ?? '').split(',').filter(Boolean)
          if (t1.length && t2.length && confirm('Confirmar resultado? Equipe 2 venceu. A partida será registrada.')) {
            addMatchFromSortear(t2, t1)
            resultDiv.innerHTML = ''
          }
        })
      }

      function refreshSortearResultTeams(): void {
        const team1Ids = (resultDiv.dataset.team1Ids ?? '').split(',').filter(Boolean)
        const team2Ids = (resultDiv.dataset.team2Ids ?? '').split(',').filter(Boolean)
        const t1 = team1Ids.map((id) => players.find((p) => p.id === id)).filter((p): p is Player => !!p)
        const t2 = team2Ids.map((id) => players.find((p) => p.id === id)).filter((p): p is Player => !!p)
        const currentRanking = computeRanking(players, matches)
        const statsById = new Map(currentRanking.map((s) => [s.player.id, s]))
        const totalRank = currentRanking.length
        const rowHtml = (p: Player) => {
          const s = statsById.get(p.id)
          const pos = currentRanking.findIndex((x) => x.player.id === p.id) + 1
          const leaderTag = pos === 1 ? ' <span class="player-badge-leader" title="Líder">Líder</span>' : ''
          const viceTag = pos === 2 ? ' <span class="player-badge-vice-leader" title="Vice-líder">Vice-líder</span>' : ''
          const lanternTag = pos === totalRank && totalRank > 0 ? ' <span class="player-badge-lantern" title="Lanterna">Lanterna</span>' : ''
          const tier = s?.patenteTier ?? 'iron'
          const emblemUrl = getRankEmblemUrl(tier)
          const emblemHtml = emblemUrl ? `<img class="sortear-result-emblem" src="${escapeHtml(emblemUrl)}" alt="" width="22" height="22" />` : ''
          const namePart = `${escapeHtml(p.name)}${getPlayerBadgeHtml(p)}${leaderTag}${viceTag}${lanternTag}`
          const lastFive = (s?.lastResults ?? []).slice(0, 5).map((r) => `<span class="result-dot ${r === 'W' ? 'win' : 'loss'}" title="${r === 'W' ? 'Vitória' : 'Derrota'}">${r === 'W' ? 'V' : 'D'}</span>`).join('')
          const lastGamesHtml = lastFive ? `<span class="sortear-result-last-wrap">Últimos: <span class="sortear-result-last-dots">${lastFive}</span></span>` : ''
          return `<span class="min-w-0 flex flex-col gap-0.5"><span class="flex items-center gap-2">${emblemHtml}<span>${namePart}</span></span>${lastGamesHtml}</span>`
        }
        const team1Box = resultEl.querySelector('.sortear-team--1')
        const team2Box = resultEl.querySelector('.sortear-team--2')
        if (team1Box) {
          team1Box.innerHTML = `
            <h4 class="m-0 mb-4 text-sm font-bold uppercase tracking-widest text-sky-400/90">Equipe 1</h4>
            <ul class="m-0 p-0 list-none space-y-2.5">${t1.map((p) => `<li class="sortear-team-player py-2 px-3 rounded-xl bg-slate-700/50 text-slate-200 text-sm font-medium flex flex-wrap items-center justify-between gap-1.5">${rowHtml(p)}</li>`).join('')}</ul>
            <div class="mt-4 pt-4 border-t border-slate-600/50">
              <button type="button" class="sortear-win-1 btn w-full rounded-xl px-4 py-2.5 text-sm font-semibold bg-sky-600 hover:bg-sky-500 text-white">Equipe 1 venceu</button>
            </div>
          `
        }
        if (team2Box) {
          team2Box.innerHTML = `
            <h4 class="m-0 mb-4 text-sm font-bold uppercase tracking-widest text-amber-400/90">Equipe 2</h4>
            <ul class="m-0 p-0 list-none space-y-2.5">${t2.map((p) => `<li class="sortear-team-player py-2 px-3 rounded-xl bg-slate-700/50 text-slate-200 text-sm font-medium flex flex-wrap items-center justify-between gap-1.5">${rowHtml(p)}</li>`).join('')}</ul>
            <div class="mt-4 pt-4 border-t border-slate-600/50">
              <button type="button" class="sortear-win-2 btn w-full rounded-xl px-4 py-2.5 text-sm font-semibold bg-amber-600 hover:bg-amber-500 text-slate-900">Equipe 2 venceu</button>
            </div>
          `
        }
        attachSortearWinHandlers()
      }

      attachSortearWinHandlers()
      resultEl.querySelector('.sortear-invert-teams')?.addEventListener('click', () => {
        const t1 = resultDiv.dataset.team1Ids ?? ''
        const t2 = resultDiv.dataset.team2Ids ?? ''
        resultDiv.dataset.team1Ids = t2
        resultDiv.dataset.team2Ids = t1
        refreshSortearResultTeams()
      })
      resultEl.querySelector('.sortear-again')?.addEventListener('click', () => (sortearBtn as HTMLButtonElement).click())
    }, 300)
  })

  const createWrap = document.createElement('div')
  createWrap.className = 'sortear-create-manual px-6 pb-6 pt-4 border-t border-slate-600/50'
  createWrap.innerHTML = `
    <h3 class="text-sm font-bold text-slate-300 mb-1">Criar partida (manual)</h3>
    <p class="hint m-0 mb-3 text-slate-500 text-xs">Registre uma partida: escolha o time vencedor e o time perdedor.</p>
    <button type="button" class="btn btn-primary" id="sortear-section-create-match-btn">Criar partida</button>
  `
  createWrap.querySelector('#sortear-section-create-match-btn')?.addEventListener('click', () => showCreateMatchModal())
  inner?.appendChild(createWrap)
  return section
}

/** Lista de campeões para splash diferente em cada card do histórico (sem repetir). */
const HISTORY_SPLASH_CHAMPIONS = ['Lux', 'Ahri', 'Yasuo', 'Thresh', 'Jinx', 'Vi', 'Caitlyn', 'Ezreal', 'Sett', 'Zed', 'Katarina', 'Akali', 'Senna', 'Viego', 'Lee Sin', 'Morgana', 'Syndra', 'Kai\'Sa', 'Miss Fortune', 'Ashe']

function createHistorySection() {
  const section = document.createElement('section')
  section.className = 'card history-section'
  section.innerHTML = `
    <div class="history-section-content">
      <h2>Histórico de partidas</h2>
      <div class="history-list"></div>
    </div>
  `
  const list = section.querySelector('.history-list')!
  const nameById = new Map(players.map((p) => [p.id, p.name]))
  /* Só exibe no histórico as partidas consideradas (não desconsideradas). */
  const toShow = matches.filter((m) => !m.excludeFromStats).slice(0, 40)
  if (toShow.length === 0) {
    list.innerHTML = '<p class="empty-hint">Nenhuma partida considerada ainda.</p>'
  } else {
    const total = toShow.length
    toShow.forEach((m, i) => {
      const partidaNum = total - i
      const winnerNames = m.winnerIds.map((id) => nameById.get(id) ?? id).join(', ')
      const loserNames = m.loserIds.map((id) => nameById.get(id) ?? id).join(', ')
      const dateStr = m.createdAt
        ? new Date(m.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: BR_TIMEZONE })
        : '—'
      const champ = HISTORY_SPLASH_CHAMPIONS[i % HISTORY_SPLASH_CHAMPIONS.length]
      const splashUrl = getChampionSplashUrl(champ, 1) ?? ''
      const matchCardBgStyle = splashUrl ? ` style="background-image: url(${escapeHtml(splashUrl)})"` : ''
      const row = document.createElement('div')
      row.className = 'history-match-card history-match-card--collapsed'
      row.id = `match-${m.id}`
      row.setAttribute('data-match-id', m.id)
      row.innerHTML = `
        <div class="history-match-card-bg"${matchCardBgStyle} aria-hidden="true"></div>
        <div class="history-match-card-overlay"></div>
        <div class="history-match-header">
          <span class="history-match-toggle" aria-hidden="true"></span>
          <span class="history-num" title="Partida ${partidaNum} de ${total}">#${partidaNum}</span>
          <span class="history-date">${escapeHtml(dateStr)}</span>
          ${m.excludeFromStats ? '<span class="history-tag-excluded rounded px-2 py-0.5 text-xs font-medium bg-slate-600/60 text-slate-300 border border-slate-500/50" title="Não conta para vitórias, derrotas nem ranking">Não considerado</span>' : ''}
          <span class="history-teams-inline">
            <span class="history-winners text-emerald-400">${escapeHtml(winnerNames)}</span>
            <span class="text-slate-500"> vs </span>
            <span class="history-losers text-red-400/90">${escapeHtml(loserNames)}</span>
          </span>
          <button type="button" class="history-match-invert" aria-label="Inverter resultado (vencedor e perdedor)" title="Inverter resultado">⇅</button>
          <button type="button" class="history-match-delete" aria-label="Remover partida do histórico" title="Remover partida">×</button>
        </div>
      `
      list.appendChild(row)
      row.querySelector('.history-match-invert')?.addEventListener('click', (e) => {
        e.stopPropagation()
        invertMatch(m.id)
      })
      row.querySelector('.history-match-delete')?.addEventListener('click', (e) => {
        e.stopPropagation()
        deleteMatch(m.id)
      })
    })
  }
  return section
}

function createComparePlayersSection(ranking: PlayerStats[]) {
  const section = document.createElement('section')
  section.className = 'card compare-section'
  const cmpBg = getChampionSplashUrl('Sett', 1) ?? ''
  const cmpBgStyle = cmpBg ? ` style="background-image: url(${escapeHtml(cmpBg)})"` : ''
  const optionsHtml = players.map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`).join('')
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
    const h2h = computeHeadToHead(id1, id2, matches)
    const pos1 = ranking.findIndex((r) => r.player.id === id1) + 1
    const pos2 = ranking.findIndex((r) => r.player.id === id2) + 1
    const totalOpposite = h2h.p1WinsOpposite + h2h.p2WinsOpposite
    const leadOpposite = totalOpposite > 0 ? (h2h.p1WinsOpposite > h2h.p2WinsOpposite ? s1 : h2h.p2WinsOpposite > h2h.p1WinsOpposite ? s2 : null) : null
    const loserOpposite = totalOpposite > 0 && leadOpposite ? (leadOpposite.player.id === id1 ? s2 : s1) : null
    const nameSpan = (name: string, isWin: boolean, isLoss: boolean) => {
      if (isWin) return `<span class="compare-name compare-name--win">${escapeHtml(name)}</span>`
      if (isLoss) return `<span class="compare-name compare-name--loss">${escapeHtml(name)}</span>`
      return `<span class="compare-name">${escapeHtml(name)}</span>`
    }
    const oppositeText = totalOpposite > 0
      ? `<p class="compare-h2h"><strong>Em times opostos:</strong> ${nameSpan(s1.player.name, leadOpposite?.player.id === id1, loserOpposite?.player.id === id1)} <span class="compare-score">${h2h.p1WinsOpposite}</span> × <span class="compare-score">${h2h.p2WinsOpposite}</span> ${nameSpan(s2.player.name, leadOpposite?.player.id === id2, loserOpposite?.player.id === id2)}</p>
         ${leadOpposite && loserOpposite ? `<p class="compare-lead"><span class="compare-name compare-name--loss">${escapeHtml(loserOpposite.player.name)}</span> está perdendo para <span class="compare-name compare-name--win">${escapeHtml(leadOpposite.player.name)}</span>.</p>` : '<p class="compare-lead">Empate no confronto.</p>'}`
      : '<p class="compare-h2h empty">Nunca jogaram em times opostos.</p>'
    const togetherText = h2h.matchesTogether > 0
      ? `<p class="compare-together"><strong>Juntos no mesmo time:</strong> <span class="compare-name compare-name--win">${h2h.winsTogether} vitórias</span> e <span class="compare-name compare-name--loss">${h2h.matchesTogether - h2h.winsTogether} derrotas</span> em ${h2h.matchesTogether} partidas.</p>`
      : ''
    const posClass = (pos: number) => pos === 1 ? 'rank-num--gold' : pos === 2 ? 'rank-num--silver' : pos === 3 ? 'rank-num--bronze' : 'rank-num--white'
    const posDisplay = (pos: number) => pos === 1 ? '🥇 1º' : pos === 2 ? '🥈 2º' : pos === 3 ? '🥉 3º' : `${pos}º`
    const vdHtml = (wins: number, losses: number) => `<span class="compare-v">${wins}</span><span class="compare-sep"> — </span><span class="compare-d">${losses}</span>`
    const winrateHtml = (winRateStr: string) => {
      const num = parseFloat(winRateStr)
      const cls = !Number.isNaN(num) ? (num >= 75 ? 'compare-winrate--elite' : num >= 50 ? 'compare-winrate--pos' : 'compare-winrate--neg') : ''
      return `<span class="compare-winrate ${cls}">${winRateStr}%</span>`
    }
    const splash1 = getChampionSplashUrl('Jinx', 1) ?? ''
    const splash2 = getChampionSplashUrl('Vi', 1) ?? ''
    const splash3 = getChampionSplashUrl('Caitlyn', 1) ?? ''
    const cardHtml = (s: PlayerStats, pos: number, splash: string) => {
      const nameHtml = s.player.badge === 'creator' ? `<span class="player-name-boss">${escapeHtml(s.player.name)}</span>` : escapeHtml(s.player.name)
      const rankEmblemUrl = getRankEmblemUrl(s.patenteTier ?? 'iron')
      const emblemHtml = rankEmblemUrl ? `<img class="compare-player-emblem" src="${escapeHtml(rankEmblemUrl)}" alt="" width="28" height="28" />` : ''
      return `<div class="compare-card compare-card--splash">
        <div class="compare-card-bg" style="background-image: url(${escapeHtml(splash)})" aria-hidden="true"></div>
        <div class="compare-card-overlay"></div>
        <div class="compare-card-inner">
          <h3 class="compare-card-title-wrap">${emblemHtml}<span>${nameHtml}</span></h3>
          <div class="compare-stat"><span class="compare-label">Posição</span><span class="compare-pos ${posClass(pos)}">${posDisplay(pos)}</span></div>
          <div class="compare-stat"><span class="compare-label">V/D</span><span>${vdHtml(s.wins, s.losses)}</span></div>
          <div class="compare-stat"><span class="compare-label">Win%</span>${winrateHtml(s.winRate)}</div>
        </div>
      </div>`
    }
    resultEl.innerHTML = `
      <div class="compare-cards">
        ${cardHtml(s1, pos1, splash1)}
        <div class="compare-card compare-card-head compare-card--splash">
          <div class="compare-card-bg" style="background-image: url(${escapeHtml(splash2)})" aria-hidden="true"></div>
          <div class="compare-card-overlay"></div>
          <div class="compare-card-inner">
            <h3>Confronto direto</h3>
            ${oppositeText}
            ${togetherText}
          </div>
        </div>
        ${cardHtml(s2, pos2, splash3)}
      </div>
    `
  }
  select1.addEventListener('change', renderComparison)
  select2.addEventListener('change', renderComparison)
  renderComparison()
  return section
}

function createGraphicsSection(ranking: PlayerStats[]) {
  const section = document.createElement('section')
  section.className = 'card graphics-section'
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
      chartsEl.innerHTML = `<p class="empty-hint">${escapeHtml(s.player.name)} ainda não jogou partidas (contabilizadas).</p>`
      return
    }
    const rankEmblemUrl = getRankEmblemUrl(s.patenteTier ?? 'iron')
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

function createCreateMatchModal(): HTMLElement {
  const root = document.createElement('div')
  root.className = 'profile-modal edit-match-modal'
  root.id = 'create-match-modal'
  root.innerHTML = `
    <div class="profile-modal-overlay"></div>
    <div class="profile-modal-panel edit-match-panel">
      <button type="button" class="profile-modal-close" aria-label="Fechar">×</button>
      <div class="profile-modal-content edit-match-content">
        <h2 class="edit-match-title">Criar partida</h2>
        <p class="edit-match-hint mb-4 text-slate-400 text-sm">Escolha os jogadores do time vencedor e do time perdedor. A partida aparece no topo do histórico.</p>
        <div class="edit-match-form" id="create-match-form"></div>
        <div class="edit-match-actions mt-4 flex flex-wrap items-center gap-3">
          <button type="button" class="create-match-submit rounded-xl px-5 py-2.5 text-sm font-semibold bg-amber-500 hover:bg-amber-400 text-slate-900">Criar partida</button>
          <button type="button" class="create-match-cancel rounded-xl px-5 py-2.5 text-sm font-semibold bg-slate-600 hover:bg-slate-500 text-white">Cancelar</button>
        </div>
      </div>
    </div>
  `
  root.querySelector('.profile-modal-overlay')?.addEventListener('click', () => root.classList.remove('open'))
  root.querySelector('.profile-modal-close')?.addEventListener('click', () => root.classList.remove('open'))
  root.querySelector('.create-match-cancel')?.addEventListener('click', () => root.classList.remove('open'))

  root.addEventListener('click', (e) => {
    const formEl = root.querySelector('#create-match-form')
    if (!formEl) return
    const target = e.target as HTMLElement
    if (target.classList.contains('edit-match-remove')) {
      const row = target.closest('.edit-match-row')
      row?.remove()
      updateCreateMatchDropdowns(formEl)
      refreshCreateMatchPool(formEl, computeRanking(players, matches))
      return
    }
    if (target.classList.contains('edit-match-add-winner') || target.classList.contains('edit-match-add-loser')) {
      const team = target.classList.contains('edit-match-add-winner') ? 'winner' : 'loser'
      const select = (team === 'winner' ? formEl.querySelector('.edit-match-select-winner') : formEl.querySelector('.edit-match-select-loser')) as HTMLSelectElement
      const playerId = select?.value
      if (!playerId) return
      const p = players.find((x) => x.id === playerId)
      if (!p) return
      const container = team === 'winner' ? formEl.querySelector('.edit-match-winner-rows') : formEl.querySelector('.edit-match-loser-rows')
      const row = document.createElement('div')
      row.className = `edit-match-row edit-match-row--${team}`
      row.setAttribute('data-player-id', playerId)
      row.setAttribute('data-team', team)
      const ranking = computeRanking(players, matches)
      row.innerHTML = `${createMatchPlayerContent(p, ranking)}<button type="button" class="edit-match-remove" aria-label="Remover">×</button>`
      container?.appendChild(row)
      updateCreateMatchDropdowns(formEl)
      refreshCreateMatchPool(formEl, ranking)
    }
  })

  root.querySelector('.create-match-submit')?.addEventListener('click', () => {
    const formEl = root.querySelector('#create-match-form')
    if (!formEl) return
    const winnerIds: string[] = []
    const loserIds: string[] = []
    formEl.querySelectorAll('.edit-match-row[data-player-id][data-team]').forEach((row) => {
      const playerId = row.getAttribute('data-player-id') ?? ''
      const team = row.getAttribute('data-team') as 'winner' | 'loser'
      if (!playerId) return
      if (team === 'winner') winnerIds.push(playerId)
      else loserIds.push(playerId)
    })
    if (winnerIds.length === 0 || loserIds.length === 0) {
      alert('Adicione pelo menos um jogador em cada time (vencedores e perdedores).')
      return
    }
    const dateInput = formEl.querySelector('.create-match-date') as HTMLInputElement
    const dateStr = dateInput?.value?.trim() ?? ''
    addMatchFromSortear(winnerIds, loserIds, dateStr || undefined)
    root.classList.remove('open')
  })
  return root
}

function getAssignedPlayerIds(formEl: Element): Set<string> {
  const inForm = new Set<string>()
  formEl.querySelectorAll('.edit-match-row[data-player-id]').forEach((row) => {
    inForm.add(row.getAttribute('data-player-id') ?? '')
  })
  return inForm
}

/** Conteúdo do pill/row no modal Criar partida: emblema + nome + tags (Líder, Vice, Lanterna), sem caixa de ELO. */
function createMatchPlayerContent(p: Player, ranking: PlayerStats[]): string {
  const stats = ranking.find((s) => s.player.id === p.id)
  const pos = stats ? ranking.indexOf(stats) + 1 : 0
  const total = ranking.length
  const leaderTag = pos === 1 ? ' <span class="player-badge-leader" title="Líder">Líder</span>' : ''
  const viceTag = pos === 2 ? ' <span class="player-badge-vice-leader" title="Vice-líder">Vice-líder</span>' : ''
  const lanternTag = pos === total && total > 0 ? ' <span class="player-badge-lantern" title="Lanterna">Lanterna</span>' : ''
  const tier = stats?.patenteTier ?? 'iron'
  const emblemUrl = getRankEmblemUrl(tier)
  const emblemHtml = emblemUrl ? `<img class="create-match-emblem" src="${escapeHtml(emblemUrl)}" alt="" width="20" height="20" />` : ''
  const namePart = `${escapeHtml(p.name)}${getPlayerBadgeHtml(p)}${leaderTag}${viceTag}${lanternTag}`
  return `${emblemHtml}<span class="create-match-name">${namePart}</span>`
}

function updateCreateMatchDropdowns(formEl: Element): void {
  const inForm = getAssignedPlayerIds(formEl)
  const optionsHtml = players.filter((p) => !inForm.has(p.id)).map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`).join('')
  const selW = formEl.querySelector('.edit-match-select-winner') as HTMLSelectElement
  const selL = formEl.querySelector('.edit-match-select-loser') as HTMLSelectElement
  if (selW) { selW.innerHTML = '<option value="">— Escolher jogador —</option>' + optionsHtml; selW.value = '' }
  if (selL) { selL.innerHTML = '<option value="">— Escolher jogador —</option>' + optionsHtml; selL.value = '' }
}

function refreshCreateMatchPool(formEl: Element, ranking: PlayerStats[]): void {
  const poolEl = formEl.querySelector('#create-match-pool')
  if (!poolEl) return
  const assigned = getAssignedPlayerIds(formEl)
  const order = new Map(ranking.map((s, i) => [s.player.id, i]))
  const unassigned = players.filter((p) => !assigned.has(p.id)).sort((a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999))
  poolEl.innerHTML = unassigned
    .map(
      (p) =>
        `<span class="create-match-pill" draggable="true" data-player-id="${escapeHtml(p.id)}" data-player-name="${escapeHtml(p.name)}" role="button" tabindex="0">${createMatchPlayerContent(p, ranking)}</span>`
    )
    .join('')
  poolEl.querySelectorAll('.create-match-pill').forEach((pill) => {
    pill.addEventListener('dragstart', (e) => {
      const ev = e as DragEvent
      ev.dataTransfer?.setData('text/plain', (pill as HTMLElement).dataset.playerId ?? '')
      ev.dataTransfer?.setData('application/json', JSON.stringify({ playerId: (pill as HTMLElement).dataset.playerId, playerName: (pill as HTMLElement).dataset.playerName }))
      ev.dataTransfer!.effectAllowed = 'move'
      pill.classList.add('dragging')
    })
    pill.addEventListener('dragend', () => pill.classList.remove('dragging'))
  })
}

function setupCreateMatchDropZones(formEl: Element): void {
  const winnerRows = formEl.querySelector('.edit-match-winner-rows')
  const loserRows = formEl.querySelector('.edit-match-loser-rows')
  const setupZone = (zone: Element | null, team: 'winner' | 'loser') => {
    if (!zone) return
    zone.classList.add('create-match-drop-zone')
    zone.addEventListener('dragover', (e) => {
      e.preventDefault()
      ;(e as DragEvent).dataTransfer!.dropEffect = 'move'
      zone.classList.add('drag-over')
    })
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'))
    zone.addEventListener('drop', (e) => {
      e.preventDefault()
      zone.classList.remove('drag-over')
      const ev = e as DragEvent
      const json = ev.dataTransfer?.getData('application/json')
      if (!json) return
      try {
        const { playerId } = JSON.parse(json) as { playerId: string; playerName: string }
        const p = players.find((x) => x.id === playerId)
        if (!p) return
        const row = document.createElement('div')
        row.className = `edit-match-row edit-match-row--${team}`
        row.setAttribute('data-player-id', playerId)
        row.setAttribute('data-team', team)
        const ranking = computeRanking(players, matches)
        row.innerHTML = `${createMatchPlayerContent(p, ranking)}<button type="button" class="edit-match-remove" aria-label="Remover">×</button>`
        zone.appendChild(row)
        updateCreateMatchDropdowns(formEl)
        refreshCreateMatchPool(formEl, ranking)
      } catch {
        // ignore
      }
    })
  }
  setupZone(winnerRows, 'winner')
  setupZone(loserRows, 'loser')
}

function showCreateMatchModal(): void {
  const root = document.getElementById('create-match-modal')
  const formEl = root?.querySelector('#create-match-form')
  if (!root || !formEl) return
  const today = getTodayInBrazil()
  const allOptions = players.map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`).join('')
  formEl.innerHTML = `
    <div class="edit-match-top mb-4 flex flex-wrap items-end gap-4">
      <label class="flex flex-col gap-1">
        <span class="text-slate-500 text-sm">Data da partida</span>
        <input type="date" class="create-match-date rounded-lg px-3 py-1.5 text-sm border border-slate-600 bg-slate-800 text-white" value="${escapeHtml(today)}" />
      </label>
    </div>
    <div class="create-match-pool-wrap">
      <p class="text-slate-500 text-sm mb-2">Arraste os jogadores para os times abaixo (ou use os selects)</p>
      <div class="create-match-pool" id="create-match-pool"></div>
    </div>
    <div class="edit-match-body">
      <div class="edit-match-main flex flex-wrap gap-6">
        <div class="edit-match-col edit-match-col-winners">
          <h3 class="edit-match-col-title edit-match-col-title--winner">Time vencedor</h3>
          <div class="edit-match-winner-rows create-match-drop-zone"></div>
          <div class="edit-match-add-area flex flex-wrap items-center gap-2 mt-2">
            <select class="edit-match-select-winner rounded-lg px-3 py-1.5 text-sm border border-slate-600 bg-slate-800 text-white">
              <option value="">— Escolher jogador —</option>${allOptions}
            </select>
            <button type="button" class="edit-match-add-winner rounded-lg px-3 py-1.5 text-sm font-medium bg-emerald-700 hover:bg-emerald-600 text-white">Adicionar</button>
          </div>
        </div>
        <div class="edit-match-col edit-match-col-losers">
          <h3 class="edit-match-col-title edit-match-col-title--loser">Time perdedor</h3>
          <div class="edit-match-loser-rows create-match-drop-zone"></div>
          <div class="edit-match-add-area flex flex-wrap items-center gap-2 mt-2">
            <select class="edit-match-select-loser rounded-lg px-3 py-1.5 text-sm border border-slate-600 bg-slate-800 text-white">
              <option value="">— Escolher jogador —</option>${allOptions}
            </select>
            <button type="button" class="edit-match-add-loser rounded-lg px-3 py-1.5 text-sm font-medium bg-red-900/60 hover:bg-red-800 text-white">Adicionar</button>
          </div>
        </div>
      </div>
    </div>
  `
  const ranking = computeRanking(players, matches)
  refreshCreateMatchPool(formEl, ranking)
  setupCreateMatchDropZones(formEl)
  updateCreateMatchDropdowns(formEl)
  root.classList.add('open')
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
  root.querySelector('.profile-modal-overlay')?.addEventListener('click', () => root.classList.remove('open'))
  root.querySelector('.profile-modal-close')?.addEventListener('click', () => root.classList.remove('open'))
  return root
}

function showProfileModal(playerId: string, ranking: PlayerStats[]) {
  const s = ranking.find((r) => r.player.id === playerId)
  if (!s) return
  const root = document.getElementById('profile-modal')
  const content = root?.querySelector('.profile-modal-content')
  if (!root || !content) return
  const position = ranking.findIndex((p) => p.player.id === s.player.id) + 1
  const totalPlayers = ranking.length
  const badgeTag = getPlayerBadgeHtml(s.player)
  const leaderTag = position === 1 ? ' <span class="player-badge-leader" title="Segui o líder!">Líder</span>' : ''
  const lanternTag = position === totalPlayers && totalPlayers > 0 ? ' <span class="player-badge-lantern" title="Lanterna do ranking">Lanterna</span>' : ''
  const profileEmblemUrl = getRankEmblemUrl(s.patenteTier ?? 'iron')
  const profileEmblemHtml = profileEmblemUrl
    ? `<div class="profile-elo-border-wrap"><img class="profile-elo-emblem" src="${escapeHtml(profileEmblemUrl)}" alt="" width="40" height="40" /></div>`
    : ''
  const profileTagsHtml = [badgeTag, leaderTag, lanternTag].filter(Boolean).join('') || ''
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
      ${s.streak ? `<span>Sequência: ${s.streak.count}${s.streak.type}</span>` : ''}
      ${s.bestWinStreak ? `<span>Recorde: ${s.bestWinStreak}V seguidas</span>` : ''}
    </div>
  `
  root.classList.add('open')
}

init()
