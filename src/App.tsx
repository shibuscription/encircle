import { useState } from 'react';
import type { Direction, GameState, Position, Status } from './types';
import {
  BOARD_SIZE,
  DIRECTION_LABELS,
  createInitialState,
  evaluateGameOver,
  getAvailableDirections,
  getNextPosition,
  getRandomDirection,
  hasEnemy,
  isExit,
  isSamePosition,
} from './utils/game';

function getStatusText(status: Status): string {
  switch (status) {
    case 'clear':
      return 'クリア';
    case 'gameover':
      return 'ゲームオーバー';
    default:
      return 'プレイ中';
  }
}

function getCellClassName(position: Position, state: GameState): string {
  if (isSamePosition(position, state.player)) {
    return 'cell player';
  }

  if (hasEnemy(position, state.enemies)) {
    return 'cell enemy';
  }

  if (isExit(position)) {
    return 'cell exit';
  }

  return 'cell';
}

function getCellLabel(position: Position, state: GameState): string {
  if (isSamePosition(position, state.player)) {
    return '自';
  }

  if (hasEnemy(position, state.enemies)) {
    return '敵';
  }

  if (isExit(position)) {
    return '出';
  }

  return '';
}

export default function App() {
  const [gameState, setGameState] = useState<GameState>(() => createInitialState());

  const availableDirections = getAvailableDirections(gameState.player, gameState.enemies);

  const boardCells: Position[] = [];
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      boardCells.push({ row, col });
    }
  }

  const handleRestart = () => {
    setGameState(createInitialState());
  };

  const handleDirectionSelect = (playerDirection: Direction) => {
    setGameState((currentState) => {
      if (currentState.status !== 'playing') {
        return currentState;
      }

      const currentAvailableDirections = getAvailableDirections(
        currentState.player,
        currentState.enemies,
      );

      if (!currentAvailableDirections.includes(playerDirection)) {
        return currentState;
      }

      const currentPosition = currentState.player;
      const nextPosition = getNextPosition(currentPosition, playerDirection);
      const enemyDirection = getRandomDirection();

      if (isExit(nextPosition)) {
        return {
          ...currentState,
          player: nextPosition,
          status: 'clear',
          message: '出口に到達しました。',
          turnResult: {
            playerDirection,
            enemyDirection,
            event: '出口へ到達してクリア',
          },
        };
      }

      if (enemyDirection !== playerDirection) {
        const nextEnemies = currentState.enemies;
        const nextStatus: Status = evaluateGameOver(nextPosition, nextEnemies)
          ? 'gameover'
          : 'playing';

        return {
          player: nextPosition,
          enemies: nextEnemies,
          status: nextStatus,
          message:
            nextStatus === 'gameover'
              ? 'どの出口にもたどり着けなくなりました。'
              : '移動しました。',
          turnResult: {
            playerDirection,
            enemyDirection,
            event: '移動成功',
          },
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
      const nextStatus: Status = evaluateGameOver(currentPosition, nextEnemies)
        ? 'gameover'
        : 'playing';

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
        turnResult: {
          playerDirection,
          enemyDirection,
          event: canSpawn ? '敵が出現' : '敵の出現は無効',
        },
      };
    });
  };

  return (
    <main className="app">
      <section className="panel">
        <header className="header">
          <p className="eyebrow">Prototype</p>
          <h1>あっちむいて包囲</h1>
          <p className="subtitle">出口を目指して、包囲される前に逃げ切るパズルゲーム</p>
        </header>

        <div className="status-panel">
          <p className={`status-badge ${gameState.status}`}>{getStatusText(gameState.status)}</p>
          <p className="message">{gameState.message}</p>
          <p className="turn-log">
            {gameState.turnResult
              ? `プレイヤー: ${DIRECTION_LABELS[gameState.turnResult.playerDirection]} / 敵: ${
                  DIRECTION_LABELS[gameState.turnResult.enemyDirection]
                } / ${gameState.turnResult.event}`
              : 'まだターンは進行していません。'}
          </p>
        </div>

        <div
          className="board"
          style={{ gridTemplateColumns: `repeat(${BOARD_SIZE}, minmax(0, 1fr))` }}
        >
          {boardCells.map((cell) => (
            <div
              key={`${cell.row}-${cell.col}`}
              className={getCellClassName(cell, gameState)}
              aria-label={`row-${cell.row}-col-${cell.col}`}
            >
              {getCellLabel(cell, gameState)}
            </div>
          ))}
        </div>

        <div className="legend">
          <span>自: プレイヤー</span>
          <span>敵: 障害物</span>
          <span>出: 出口</span>
        </div>

        <div className="controls">
          <button
            type="button"
            className="direction-button"
            onClick={() => handleDirectionSelect('up')}
            disabled={gameState.status !== 'playing' || !availableDirections.includes('up')}
          >
            上
          </button>
          <div className="middle-row">
            <button
              type="button"
              className="direction-button"
              onClick={() => handleDirectionSelect('left')}
              disabled={gameState.status !== 'playing' || !availableDirections.includes('left')}
            >
              左
            </button>
            <button
              type="button"
              className="direction-button"
              onClick={() => handleDirectionSelect('right')}
              disabled={gameState.status !== 'playing' || !availableDirections.includes('right')}
            >
              右
            </button>
          </div>
          <button
            type="button"
            className="direction-button"
            onClick={() => handleDirectionSelect('down')}
            disabled={gameState.status !== 'playing' || !availableDirections.includes('down')}
          >
            下
          </button>
        </div>

        <button type="button" className="restart-button" onClick={handleRestart}>
          リスタート
        </button>
      </section>
    </main>
  );
}
