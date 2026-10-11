import { Chess } from 'chess.js';
import type { OpeningRepertoire, RepertoireMove, PieceColor, GameRecord } from '../types/chess';

export interface DeviationResult {
  repertoireId: string;
  repertoireName: string;
  ply: number;
  fenBefore: string;
  playedSan: string;
  repertoireSan: string;
  repertoireMoveId: string;
}

export function createDefaultRepertoire(
  id: string,
  name: string,
  color: PieceColor,
  sideAgainst?: 'e4' | 'd4' | 'other'
): OpeningRepertoire {
  return {
    id,
    name,
    color,
    sideAgainst,
    description: `Personal ${color} repertoire${sideAgainst ? ` against 1.${sideAgainst}` : ''}`,
    rootMoves: [],
    allMoves: {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// Add a line of SAN moves into a repertoire tree
export function addLineToRepertoire(
  repertoire: OpeningRepertoire,
  movesSan: string[],
  comment?: string
): OpeningRepertoire {
  const updated: OpeningRepertoire = {
    ...repertoire,
    allMoves: { ...repertoire.allMoves },
    rootMoves: [...repertoire.rootMoves],
    updatedAt: Date.now(),
  };

  const chess = new Chess();
  let parentId: string | null = null;

  for (let i = 0; i < movesSan.length; i++) {
    const san = movesSan[i];
    const fenBefore = chess.fen();
    const move = chess.move(san);
    if (!move) break;

    const uci = `${move.from}${move.to}${move.promotion || ''}`;
    const moveColor = move.color === 'w' ? 'white' : 'black';
    const isUserMove = moveColor === repertoire.color;

    // Create a deterministic node ID based on parent and move
    const nodeId: string = parentId ? `${parentId}_${uci}` : `root_${uci}`;

    if (!updated.allMoves[nodeId]) {
      const newNode: RepertoireMove = {
        id: nodeId,
        parentId,
        fen: fenBefore,
        san: move.san,
        uci,
        color: moveColor,
        ply: i + 1,
        comment: i === movesSan.length - 1 ? comment : undefined,
        isUserMove,
        children: [],
      };

      updated.allMoves[nodeId] = newNode;

      if (parentId) {
        const parent: RepertoireMove | undefined = updated.allMoves[parentId];
        if (parent && !parent.children.includes(nodeId)) {
          parent.children.push(nodeId);
        }
      } else {
        if (!updated.rootMoves.includes(nodeId)) {
          updated.rootMoves.push(nodeId);
        }
      }
    }

    parentId = nodeId;
  }

  return updated;
}

// Import PGN lines directly into repertoire
export function importPgnToRepertoire(
  repertoire: OpeningRepertoire,
  pgnText: string
): OpeningRepertoire {
  try {
    const chess = new Chess();
    chess.loadPgn(pgnText);
    const history = chess.history();
    return addLineToRepertoire(repertoire, history);
  } catch {
    return repertoire;
  }
}

// Detect where a played game deviated from user's repertoire
export function detectGameDeviations(
  game: GameRecord,
  repertoires: OpeningRepertoire[]
): DeviationResult[] {
  const deviations: DeviationResult[] = [];
  if (!game.userColor) return deviations;

  const relevantRepertoires = repertoires.filter(r => r.color === game.userColor);
  if (relevantRepertoires.length === 0) return deviations;

  try {
    const chess = new Chess();
    chess.loadPgn(game.pgn);
    const movesVerbose = chess.history({ verbose: true });

    for (const rep of relevantRepertoires) {
      let currentRepNodeId: string | null = null;
      let inRepertoire = true;

      for (let ply = 0; ply < movesVerbose.length; ply++) {
        if (!inRepertoire) break;

        const move = movesVerbose[ply];
        const isUserTurn = (move.color === 'w' && game.userColor === 'white') ||
                           (move.color === 'b' && game.userColor === 'black');

        // Look for matching node in repertoire
        const candidateChildrenIds: string[] = currentRepNodeId
          ? (rep.allMoves[currentRepNodeId]?.children || [])
          : rep.rootMoves;

        const matchingChildId: string | undefined = candidateChildrenIds.find((childId: string) => {
          const repNode = rep.allMoves[childId];
          return repNode && repNode.san === move.san;
        });

        if (matchingChildId) {
          currentRepNodeId = matchingChildId;
        } else {
          // If this was user's turn and the repertoire had planned moves here, it's a deviation!
          if (isUserTurn && candidateChildrenIds.length > 0) {
            const preferredRepMove = rep.allMoves[candidateChildrenIds[0]];
            if (preferredRepMove) {
              deviations.push({
                repertoireId: rep.id,
                repertoireName: rep.name,
                ply: ply + 1,
                fenBefore: move.before,
                playedSan: move.san,
                repertoireSan: preferredRepMove.san,
                repertoireMoveId: preferredRepMove.id,
              });
            }
          }
          // Once user or opponent diverged, no longer tracking this line
          inRepertoire = false;
        }
      }
    }
  } catch {
    // ignore
  }

  return deviations;
}
