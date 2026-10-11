import type { GameRecord, GameAnalysis, WeaknessRecord, WeaknessExample } from '../types/chess';
import { db } from '../db/db';

const PATTERN_CONFIG: Record<string, { title: string; description: string; priority: 'high' | 'medium' | 'low' }> = {
  'Hanging Piece': {
    title: 'Hanging Pieces',
    description: 'Leaving friendly pieces undefended or moving them directly into opposing lines of attack.',
    priority: 'high',
  },
  'Unprotected Piece': {
    title: 'Unprotected Pieces (LPDO)',
    description: 'Failing to notice when a move leaves an existing piece vulnerable to capture.',
    priority: 'high',
  },
  'Missed Checkmate': {
    title: 'Overlooked Forced Mates',
    description: 'Missing immediate checkmate sequences and allowing the opponent back into the game.',
    priority: 'high',
  },
  'Missed Capture': {
    title: 'Missed Free Material',
    description: 'Overlooking free or hanging pieces offered by the opponent.',
    priority: 'medium',
  },
  'Tactical Fork': {
    title: 'Vulnerability to Forks',
    description: 'Allowing knights, pawns, or queens to attack two of your pieces simultaneously.',
    priority: 'medium',
  },
  'Back-Rank Vulnerability': {
    title: 'Back-Rank Weaknesses',
    description: 'Neglecting escape squares (luft) for the king, leading to heavy piece infiltration.',
    priority: 'medium',
  },
  'Compromised King Safety': {
    title: 'King Safety Insecurities',
    description: 'Weakening pawn shelters or opening lines towards the king without adequate defensive cover.',
    priority: 'high',
  },
  'Premature Queen Move': {
    title: 'Premature Queen Attacks',
    description: 'Bringing the queen into active play too early, conceding valuable tempos.',
    priority: 'low',
  },
  'Opening Principle': {
    title: 'Opening Development Lapses',
    description: 'Violating fundamental opening principles such as central control and rapid piece mobilization.',
    priority: 'low',
  },
};

export async function aggregateWeaknessesFromAnalyses(
  games: GameRecord[],
  analyses: GameAnalysis[]
): Promise<WeaknessRecord[]> {
  const map = new Map<string, { count: number; examples: WeaknessExample[]; lastSeen: number }>();
  const gameMap = new Map(games.map(g => [g.id, g]));

  for (const analysis of analyses) {
    const game = gameMap.get(analysis.gameId);
    const gameTitle = game ? `${game.white} vs ${game.black} (${game.date})` : 'Unknown Game';
    const gameDate = game ? game.date : new Date().toISOString().split('T')[0];

    for (const pos of analysis.positions) {
      if (pos.explanation && pos.explanation.motif) {
        const motif = pos.explanation.motif;
        if (!map.has(motif)) {
          map.set(motif, { count: 0, examples: [], lastSeen: 0 });
        }
        const record = map.get(motif)!;
        record.count++;
        record.lastSeen = Math.max(record.lastSeen, analysis.completedAt);

        if (record.examples.length < 5) {
          record.examples.push({
            gameId: analysis.gameId,
            gameTitle,
            fen: pos.fen,
            playedMove: pos.move?.san || 'Unknown',
            betterMove: pos.bestMoveSan || pos.bestMove,
            cpl: pos.cpl || 0,
            date: gameDate,
          });
        }
      }
    }
  }

  const result: WeaknessRecord[] = [];
  for (const [motif, data] of map.entries()) {
    const conf = PATTERN_CONFIG[motif] || {
      title: motif,
      description: `Recurring positional or tactical issue (${motif}).`,
      priority: 'medium',
    };

    result.push({
      id: `weakness_${motif.toLowerCase().replace(/\s+/g, '_')}`,
      pattern: motif,
      title: conf.title,
      description: conf.description,
      occurrences: data.count,
      lastSeen: data.lastSeen,
      examples: data.examples,
      improvementStatus: data.count <= 2 ? 'improving' : data.count >= 6 ? 'worsening' : 'stable',
      priority: conf.priority,
    });
  }

  // Sort by priority and occurrences
  result.sort((a, b) => {
    const pWeight = { high: 3, medium: 2, low: 1 };
    if (pWeight[b.priority] !== pWeight[a.priority]) {
      return pWeight[b.priority] - pWeight[a.priority];
    }
    return b.occurrences - a.occurrences;
  });

  // Save to Dexie
  await db.transaction('rw', db.weaknesses, async () => {
    await db.weaknesses.clear();
    for (const w of result) {
      await db.weaknesses.put(w);
    }
  });

  return result;
}
