import type {
  Direction,
  GameState,
  Hand,
  HoiWinner,
  JankenResult,
  Position,
  TurnOutcome,
  TurnResult,
} from '../types';
import { canReachAnyExit } from './pathfinding';

export const BOARD_SIZE = 7;

export const DIRECTIONS: Direction[] = ['up', 'down', 'left', 'right'];

export const HANDS: Hand[] = ['rock', 'scissors', 'paper'];

export const DIRECTION_LABELS: Record<Direction, string> = {
  up: '上',
  down: '下',
  left: '左',
  right: '右',
};

export const HAND_LABELS: Record<Hand, string> = {
  rock: 'グー',
  scissors: 'チョキ',
  paper: 'パー',
};

export const HAND_ICONS: Record<Hand, string> = {
  rock: '✊',
  scissors: '✌️',
  paper: '✋',
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

export function getOppositeDirection(direction: Direction): Direction {
  switch (direction) {
    case 'up':
      return 'down';
    case 'down':
      return 'up';
    case 'left':
      return 'right';
    case 'right':
      return 'left';
  }
}

export function createInitialState(): GameState {
  return {
    player: { row: Math.floor(BOARD_SIZE / 2), col: Math.floor(BOARD_SIZE / 2) },
    enemies: [],
    status: 'playing',
    message: 'じゃんけんに勝って出口を目指そう。',
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

export function removeEnemyAt(position: Position, enemies: Position[]): Position[] {
  return enemies.filter((enemy) => !isSamePosition(enemy, position));
}

export function getAvailableDirections(player: Position, enemies: Position[]): Direction[] {
  return DIRECTIONS.filter((direction) => {
    const nextPosition = getNextPosition(player, direction);
    return isInsideBoard(nextPosition) && !hasEnemy(nextPosition, enemies);
  });
}

export function getRandomHand(): Hand {
  const index = Math.floor(Math.random() * HANDS.length);
  return HANDS[index];
}

export function getRandomAvailableDirection(directions: Direction[]): Direction {
  const index = Math.floor(Math.random() * directions.length);
  return directions[index];
}

export function resolveJanken(playerHand: Hand, enemyHand: Hand): JankenResult {
  if (playerHand === enemyHand) {
    return 'draw';
  }

  if (
    (playerHand === 'rock' && enemyHand === 'scissors') ||
    (playerHand === 'scissors' && enemyHand === 'paper') ||
    (playerHand === 'paper' && enemyHand === 'rock')
  ) {
    return 'playerWin';
  }

  return 'enemyWin';
}

export function evaluateGameOver(player: Position, enemies: Position[]): boolean {
  return !canReachAnyExit(player, enemies, EXIT_POSITIONS, BOARD_SIZE);
}

export function resolveHoiTurn(
  currentState: GameState,
  winner: HoiWinner,
  playerDirection: Direction,
  enemyDirection: Direction,
  janken: TurnResult['janken'],
): {
  nextState: GameState;
  outcome: TurnOutcome;
  matched: boolean;
  movePosition: Position | null;
  spawnPositions: Position[];
  needsEnemySelection: boolean;
} {
  const matched = playerDirection === enemyDirection;
  const playerTarget = getNextPosition(currentState.player, playerDirection);
  const enemyTarget = getNextPosition(currentState.player, enemyDirection);

  let nextPlayer = currentState.player;
  let nextEnemies = currentState.enemies;
  let movePosition: Position | null = null;
  let spawnPosition: Position | null = null;
  let outcome: TurnOutcome = 'none';
  let message = '何も起きなかった';
  let needsEnemySelection = false;

  if (winner === 'player') {
    nextPlayer = playerTarget;
    movePosition = playerTarget;
    outcome = matched ? 'moveAndSelect' : 'move';
    message = matched
      ? nextEnemies.length > 0
        ? '1マス進んだ！ 敵を1体選んでください'
        : '1マス進んだ！ 倒せる敵はいなかった'
      : '1マス進んだ';
  } else {
    const spawnTargets = matched
      ? [enemyTarget, getNextPosition(currentState.player, getOppositeDirection(enemyDirection))]
      : [enemyTarget];
    const placedPositions: Position[] = [];

    for (const target of spawnTargets) {
      if (!isInsideBoard(target) || hasEnemy(target, nextEnemies)) {
        continue;
      }

      nextEnemies = [...nextEnemies, target];
      placedPositions.push(target);
    }

    spawnPosition = placedPositions[0] ?? null;

    if (matched) {
      outcome = 'spawnOnly';
      message =
        placedPositions.length === 2
          ? '敵が2体あらわれた'
          : placedPositions.length === 1
            ? '敵があらわれた'
            : '敵を増やそうとしたが置けなかった';
    } else {
      outcome = 'spawnOnly';
      message =
        placedPositions.length === 1
          ? '敵があらわれた'
          : '敵を増やそうとしたが置けなかった';
    }
  }

  if (isSamePosition(nextPlayer, playerTarget) && isExit(nextPlayer)) {
    return {
      nextState: {
        player: nextPlayer,
        enemies: nextEnemies,
        status: 'clear',
        message: '出口に到達しました。',
        turnResult: {
          janken,
          hoi: {
            winner,
            playerDirection,
            enemyDirection,
            matched,
            outcome,
          },
          event: '出口へ到達してクリア',
        },
      },
      outcome,
      matched,
      movePosition,
      spawnPositions: spawnPosition ? [spawnPosition] : [],
      needsEnemySelection: false,
    };
  }

  if (winner === 'player' && matched && nextEnemies.length > 0) {
    needsEnemySelection = true;
  }

  const nextStatus =
    needsEnemySelection || !evaluateGameOver(nextPlayer, nextEnemies) ? 'playing' : 'gameover';

  if (nextStatus === 'gameover') {
    message = '出口が完全に塞がれた';
  }

  return {
    nextState: {
      player: nextPlayer,
      enemies: nextEnemies,
      status: nextStatus,
      message,
      turnResult: {
        janken,
        hoi: {
          winner,
          playerDirection,
          enemyDirection,
          matched,
          outcome,
        },
        event: message,
      },
    },
    outcome,
    matched,
    movePosition,
    spawnPositions: spawnPosition ? [spawnPosition] : [],
    needsEnemySelection,
  };
}
