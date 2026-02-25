/**
 * Tipos para Aranked Cabaré — versão simplificada (sem KDA, sem campeões).
 * Projeto completo (Cabaré v1) está em types-cabare-v1.ts.
 */

export interface Player {
  id: string
  name: string
  badge?: 'creator' | 'dev' | 'troll'
}

/** Partida simples: só vencedores, perdedores e data. Sem picks nem KDA. */
export interface Match {
  id: string
  winnerIds: string[]
  loserIds: string[]
  createdAt: string
  /** Se true, aparece no histórico mas não conta para ranking/ELO (ex.: em observação). */
  excludeFromStats?: boolean
}

export interface PlayerStats {
  player: Player
  wins: number
  losses: number
  winRate: string
  /** Degrau na escada ELO (0 = Ferro 4, +1 por vitória, -1 por derrota). */
  eloStep: number
  /** Label do ELO (ex: "Ouro 2") para exibição. */
  patente?: string
  /** Tier para estilo/emblem (ferro, bronze, ouro, ...). */
  patenteTier?: string
  /** Últimos resultados (mais recente primeiro): 'W' | 'L'. */
  lastResults?: ('W' | 'L')[]
  /** Sequência atual (ex: 3V ou 2D). */
  streak?: { type: 'V' | 'D'; count: number }
  /** Maior sequência de vitórias. */
  bestWinStreak?: number
}
