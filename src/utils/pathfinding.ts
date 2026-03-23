import type { Position } from '../types';

function getPositionKey(position: Position): string {
  return `${position.row}:${position.col}`;
}

function isSamePosition(a: Position, b: Position): boolean {
  return a.row === b.row && a.col === b.col;
}

export function canReachAnyExit(
  start: Position,
  enemies: Position[],
  exits: Position[],
  boardSize: number,
): boolean {
  const blocked = new Set(enemies.map(getPositionKey));
  const visited = new Set<string>([getPositionKey(start)]);
  const queue: Position[] = [start];
  const deltas = [
    { row: -1, col: 0 },
    { row: 1, col: 0 },
    { row: 0, col: -1 },
    { row: 0, col: 1 },
  ];

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (exits.some((exit) => isSamePosition(exit, current))) {
      return true;
    }

    for (const delta of deltas) {
      const next = {
        row: current.row + delta.row,
        col: current.col + delta.col,
      };

      if (
        next.row < 0 ||
        next.row >= boardSize ||
        next.col < 0 ||
        next.col >= boardSize
      ) {
        continue;
      }

      const key = getPositionKey(next);
      if (blocked.has(key) || visited.has(key)) {
        continue;
      }

      visited.add(key);
      queue.push(next);
    }
  }

  return false;
}
