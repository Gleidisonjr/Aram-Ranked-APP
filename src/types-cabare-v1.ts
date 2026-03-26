export interface Player {
  id: string
  name: string
  /** Tag exibida ao lado do nome (ex: criador do ranking, troll) */
  badge?: 'creator' | 'dev' | 'troll'
}

export interface ChampionPick {
  playerId: string
  champion: string
}

export interface KdaEntry {
  playerId: string
  kills: number
  deaths: number
  assists: number
}

/** Estatísticas estendidas por jogador por partida (dano, cura, ouro, objetivos). Preenchido a partir do print pós-partida. */
export interface MatchExtendedStat {
  playerId: string
  /** Dano total a campeões */
  damageToChampions?: number
  /** Dano total causado (geral) */
  totalDamageDealt?: number
  /** Dano físico/mágico/verdadeiro a campeões */
  physicalDamageToChampions?: number
  magicDamageToChampions?: number
  trueDamageToChampions?: number
  /** Dano recebido */
  damageReceived?: number
  physicalDamageReceived?: number
  magicDamageReceived?: number
  trueDamageReceived?: number
  /** Dano curado */
  damageHealed?: number
  /** Dano automitigado (quanto o jogador “tankou”) */
  damageSelfMitigated?: number
  /** Ouro recebido / gasto */
  goldEarned?: number
  goldSpent?: number
  /** Tropas abatidas (CS) */
  minionsKilled?: number
  /** Torres / inibidores destruídos */
  towersDestroyed?: number
  inhibitorsDestroyed?: number
  /** Dano total a torres */
  damageToTowers?: number
  /** Maior sequência de abates (kills sem morrer) */
  largestKillStreak?: number
  /** Maior multiabate: 2 = Double, 3 = Triple, 4 = Quadra, 5 = Penta */
  largestMultikill?: number
}

export interface Match {
  id: string
  winnerIds: string[]
  loserIds: string[]
  picks: ChampionPick[]
  kda?: KdaEntry[]
  /** Estatísticas de dano, cura, ouro etc. por jogador (do print pós-partida) */
  matchExtendedStats?: MatchExtendedStat[]
  /** URL ou data URL da imagem/print da partida (visível no histórico) */
  imageUrl?: string
  createdAt: string
  /** Se true, a partida fica visível no histórico mas não conta para vitórias, derrotas, KDA nem streaks (ex.: em observação/manutenção). */
  excludeFromStats?: boolean
}

export interface PlayerStats {
  player: Player
  wins: number
  losses: number
  winRate: string
  championPlays: { champion: string; count: number; wins: number; kills: number; deaths: number; assists: number; ratio: number; lastMatchCreatedAt?: string }[]
  /** KDA agregado (soma de todas as partidas com KDA preenchido) */
  kda?: { kills: number; deaths: number; assists: number; games: number }
  /** Média KDA formatada (ex: "5.2 / 4.1 / 8.0") */
  avgKda?: string
  /** Patente no sistema LoL (ex: "Ouro 2", "Prata 4") */
  patente?: string
  /** Tier para estilo do badge (ferro, bronze, prata, ouro, ...) */
  patenteTier?: string
  /** Sequência atual: tipo e quantidade (ex: 3V ou 2D) */
  streak?: { type: 'V' | 'D'; count: number }
  /** Maior sequência de vitórias */
  bestWinStreak?: number
  /** Conquistas desbloqueadas (id para buscar ícone e categoria) */
  achievements?: { id: string; name: string }[]
  /** Últimos resultados (mais recente primeiro): 'W' | 'L' */
  lastResults?: ('W' | 'L')[]
  /** Passo ELO (0 = Ferro 4, 1 = Ferro 3, ...) para desempate em destaques e ranking */
  eloStep?: number
}
