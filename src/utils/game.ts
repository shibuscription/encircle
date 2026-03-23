import type { Direction, GameState, Position, TurnResult } from '../types';
import { canReachAnyExit } from './pathfinding';

export const BOARD_SIZE = 7;

export const DIRECTIONS: Direction[] = ['up', 'down', 'left', 'right'];

export const DIRECTION_LABELS: Record<Direction, string> = {
  up: '上',
  down: '下',
  left: '左',
  right: '右',
};

const DIRECTION_DELTAS: Record<Direction, Position> = {
  up: { row: -1, col: 0 },
  down: { row: 1, col: 0 },
  left: { row: 0, col: -1 },
  right: { row: 0, col: 1 },
};

export const EXIT_POSITIONS: Position[] = [
  { row: 0, col: 0 },
  { row: 0, col: BOARD_SIZE - 1 },
  { row: BOARD_SIZE - 1, col: 0 },
  { row: BOARD_SIZE - 1, col: BOARD_SIZE - 1 },
];

export function createInitialState(): GameState {
  return {
    player: { row: Math.floor(BOARD_SIZE / 2), col: Math.floor(BOARD_SIZE / 2) },
    enemies: [],
    status: 'playing',
    message: '出口を目指して進みましょう。',
    turnResult: null,
  };
}

export function getNextPosition(position: Position, direction: Direction): Position {
  const delta = DIRECTION_DELTAS[direction];

  return {
    row: position.row + delta.row,
    col: position.col + delta.col,
  };
}

export function isInsideBoard(position: Position): boolean {
  return (
    position.row >= 0 &&
    position.row < BOARD_SIZE &&
    position.col >= 0 &&
    position.col < BOARD_SIZE
  );
}

export function isSamePosition(a: Position, b: Position): boolean {
  return a.row === b.row && a.col === b.col;
}

export function isExit(position: Position): boolean {
  return EXIT_POSITIONS.some((exit) => isSamePosition(exit, position));
}

export function hasEnemy(position: Position, enemies: Position[]): boolean {
  return enemies.some((enemy) => isSamePosition(enemy, position));
}

export function getAvailableDirections(player: Position, enemies: Position[]): Direction[] {
  return DIRECTIONS.filter((direction) => {
    const nextPosition = getNextPosition(player, direction);
    return isInsideBoard(nextPosition) && !hasEnemy(nextPosition, enemies);
  });
}

export function getRandomDirection(): Direction {
  const index = Math.floor(Math.random() * DIRECTIONS.length);
  return DIRECTIONS[index];
}

export function evaluateGameOver(player: Position, enemies: Position[]): boolean {
  return !canReachAnyExit(player, enemies, EXIT_POSITIONS, BOARD_SIZE);
}

export function resolveTurn(
  currentState: GameState,
  playerDirection: Direction,
  enemyDirection: Direction,
): GameState {
  const currentPosition = currentState.player;
  const nextPosition = getNextPosition(currentPosition, playerDirection);

  if (isExit(nextPosition)) {
    const turnResult: TurnResult = {
      playerDirection,
      enemyDirection,
      event: '出口へ到達してクリア',
    };

    return {
      ...currentState,
      player: nextPosition,
      status: 'clear',
      message: '出口に到達しました。',
      turnResult,
    };
  }

  if (enemyDirection !== playerDirection) {
    const nextStatus = evaluateGameOver(nextPosition, currentState.enemies)
      ? 'gameover'
      : 'playing';
    const turnResult: TurnResult = {
      playerDirection,
      enemyDirection,
      event: '移動成功',
    };

    return {
      player: nextPosition,
      enemies: currentState.enemies,
      status: nextStatus,
      message:
        nextStatus === 'gameover'
          ? 'どの出口にもたどり着けなくなりました。'
          : '移動しました。',
      turnResult,
    };
  }

  const spawnPosition = nextPosition;
  const canSpawn =
    !isExit(spawnPosition) &&
    !hasEnemy(spawnPosition, currentState.enemies) &&
    !isSamePosition(spawnPosition, currentPosition);
  const nextEnemies = canSpawn
    ? [...currentState.enemies, spawnPosition]
    : currentState.enemies;
  const nextStatus = evaluateGameOver(currentPosition, nextEnemies) ? 'gameover' : 'playing';
  const turnResult: TurnResult = {
    playerDirection,
    enemyDirection,
    event: canSpawn ? '敵が出現' : '敵の出現は無効',
  };

  return {
    player: currentPosition,
    enemies: nextEnemies,
    status: nextStatus,
    message:
      nextStatus === 'gameover'
        ? '包囲され、どの出口にもたどり着けなくなりました。'
        : canSpawn
          ? '敵が出現しました。'
          : '敵の出現は無効でした。',
    turnResult,
  };
}
