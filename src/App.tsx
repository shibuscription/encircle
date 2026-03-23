import { useEffect, useMemo, useRef, useState } from 'react';
import type { Direction, GameState, PendingTurn, Position, Status, TurnPhase } from './types';
import {
  BOARD_SIZE,
  DIRECTION_LABELS,
  createInitialState,
  getAvailableDirections,
  getRandomDirection,
  hasEnemy,
  isExit,
  isSamePosition,
  resolveTurn,
} from './utils/game';

const REVEAL_DURATION_MS = 750;
const AFTER_RESOLVE_DURATION_MS = 450;

type HighlightType = 'move' | 'spawn';

type BoardHighlight = {
  position: Position;
  type: HighlightType;
} | null;

function getStatusText(status: Status): string {
  switch (status) {
    case 'clear':
      return 'クリア！';
    case 'gameover':
      return 'ゲームオーバー';
    default:
      return 'あっちむいて・・・';
  }
}

function getStageText(phase: TurnPhase, status: Status): string {
  if (status === 'clear') {
    return 'クリア！';
  }

  if (status === 'gameover') {
    return 'ゲームオーバー';
  }

  if (phase === 'reveal') {
    return 'ホイ！';
  }

  return 'あっちむいて・・・';
}

function getCellContent(position: Position, state: GameState) {
  if (isSamePosition(position, state.player)) {
    return { className: 'cell player', icon: '🙂', label: 'プレイヤー' };
  }

  if (hasEnemy(position, state.enemies)) {
    return { className: 'cell enemy', icon: '👹', label: '敵' };
  }

  if (isExit(position)) {
    return { className: 'cell exit', icon: '🚪', label: '出口' };
  }

  return { className: 'cell', icon: '', label: '通常マス' };
}

function OverlayPointer({
  direction,
  active,
  position,
}: {
  direction: Direction | null;
  active: boolean;
  position: 'enemy' | 'player';
}) {
  return (
    <div className={`overlay-pointer ${position} ${active ? 'active' : ''}`}>
      {direction ? (
        <>
          <span className={`pointer-icon direction-${direction}`} aria-hidden="true">
            ☞
          </span>
          <span className="pointer-text">{DIRECTION_LABELS[direction]}</span>
        </>
      ) : null}
    </div>
  );
}

function getBoardHighlight(
  previousState: GameState,
  nextState: GameState,
  playerDirection: Direction,
  enemyDirection: Direction,
): BoardHighlight {
  if (previousState.status !== 'playing') {
    return null;
  }

  if (!isSamePosition(previousState.player, nextState.player)) {
    return {
      position: nextState.player,
      type: 'move',
    };
  }

  if (playerDirection === enemyDirection && nextState.enemies.length > previousState.enemies.length) {
    const spawnedEnemy = nextState.enemies.find(
      (enemy) => !previousState.enemies.some((existing) => isSamePosition(existing, enemy)),
    );

    if (spawnedEnemy) {
      return {
        position: spawnedEnemy,
        type: 'spawn',
      };
    }
  }

  return null;
}

export default function App() {
  const [gameState, setGameState] = useState<GameState>(() => createInitialState());
  const [phase, setPhase] = useState<TurnPhase>('awaitingInput');
  const [pendingTurn, setPendingTurn] = useState<PendingTurn | null>(null);
  const [boardHighlight, setBoardHighlight] = useState<BoardHighlight>(null);
  const timeoutsRef = useRef<number[]>([]);

  const availableDirections = getAvailableDirections(gameState.player, gameState.enemies);
  const canInput = phase === 'awaitingInput' && gameState.status === 'playing';

  const boardCells = useMemo(() => {
    const cells: Position[] = [];

    for (let row = 0; row < BOARD_SIZE; row += 1) {
      for (let col = 0; col < BOARD_SIZE; col += 1) {
        cells.push({ row, col });
      }
    }

    return cells;
  }, []);

  const clearScheduledTimeouts = () => {
    timeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    timeoutsRef.current = [];
  };

  useEffect(() => clearScheduledTimeouts, []);

  const handleRestart = () => {
    clearScheduledTimeouts();
    setPendingTurn(null);
    setBoardHighlight(null);
    setPhase('awaitingInput');
    setGameState(createInitialState());
  };

  const handleDirectionSelect = (playerDirection: Direction) => {
    if (!canInput || !availableDirections.includes(playerDirection)) {
      return;
    }

    clearScheduledTimeouts();

    const enemyDirection = getRandomDirection();
    const nextState = resolveTurn(gameState, playerDirection, enemyDirection);
    const nextHighlight = getBoardHighlight(gameState, nextState, playerDirection, enemyDirection);

    setPendingTurn({ playerDirection, enemyDirection });
    setBoardHighlight(null);
    setPhase('reveal');

    const revealTimeoutId = window.setTimeout(() => {
      setGameState(nextState);
      setBoardHighlight(nextHighlight);

      if (nextState.status !== 'playing') {
        setPendingTurn(null);
        setPhase('finished');
        return;
      }

      setPhase('resolve');

      const settleTimeoutId = window.setTimeout(() => {
        setPendingTurn(null);
        setBoardHighlight(null);
        setPhase('awaitingInput');
      }, AFTER_RESOLVE_DURATION_MS);

      timeoutsRef.current.push(settleTimeoutId);
    }, REVEAL_DURATION_MS);

    timeoutsRef.current.push(revealTimeoutId);
  };

  const stageText = getStageText(phase, gameState.status);
  const isReveal = phase === 'reveal';
  const showTopStage = gameState.status === 'playing';
  const showCenterStage = gameState.status !== 'playing';

  return (
    <main className="app">
      <section className={`panel status-${gameState.status}`}>
        <header className="header">
          <p className="title-mark">あっちむいて包囲</p>
        </header>

        <div className={`top-stage ${phase} ${gameState.status}`}>
          <span className={`top-stage-text ${isReveal ? 'is-reveal' : ''}`}>
            {showTopStage ? stageText : getStatusText(gameState.status)}
          </span>
        </div>

        <div className={`board-shell status-${gameState.status}`}>
          <div
            className={`board ${phase === 'resolve' ? 'board-resolving' : ''}`}
            style={{ gridTemplateColumns: `repeat(${BOARD_SIZE}, minmax(0, 1fr))` }}
          >
            {boardCells.map((cell) => {
              const content = getCellContent(cell, gameState);
              const isHighlighted =
                boardHighlight !== null && isSamePosition(boardHighlight.position, cell);

              return (
                <div
                  key={`${cell.row}-${cell.col}`}
                  className={`${content.className}${isHighlighted ? ` highlight ${boardHighlight?.type}` : ''}`}
                  aria-label={`row-${cell.row}-col-${cell.col}-${content.label}`}
                >
                  <span className="cell-icon" aria-hidden="true">
                    {content.icon}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="board-overlay" aria-hidden="true">
            <OverlayPointer
              direction={pendingTurn?.enemyDirection ?? null}
              active={isReveal}
              position="enemy"
            />
            {showCenterStage ? (
              <div className={`stage-overlay ${gameState.status} ${phase}`}>
                <span className="stage-text">{stageText}</span>
              </div>
            ) : null}
            <OverlayPointer
              direction={pendingTurn?.playerDirection ?? null}
              active={isReveal}
              position="player"
            />
          </div>
        </div>

        <div className="legend compact">
          <span><span className="legend-icon">🙂</span>プレイヤー</span>
          <span><span className="legend-icon">👹</span>敵</span>
          <span><span className="legend-icon">🚪</span>出口</span>
        </div>

        <div className="controls-cross">
          <button
            type="button"
            className="direction-button up"
            onClick={() => handleDirectionSelect('up')}
            disabled={!canInput || !availableDirections.includes('up')}
          >
            <span className="button-arrow" aria-hidden="true">↑</span>
            <span>上</span>
          </button>
          <button
            type="button"
            className="direction-button left"
            onClick={() => handleDirectionSelect('left')}
            disabled={!canInput || !availableDirections.includes('left')}
          >
            <span className="button-arrow" aria-hidden="true">←</span>
            <span>左</span>
          </button>
          <button
            type="button"
            className="direction-button right"
            onClick={() => handleDirectionSelect('right')}
            disabled={!canInput || !availableDirections.includes('right')}
          >
            <span className="button-arrow" aria-hidden="true">→</span>
            <span>右</span>
          </button>
          <button
            type="button"
            className="direction-button down"
            onClick={() => handleDirectionSelect('down')}
            disabled={!canInput || !availableDirections.includes('down')}
          >
            <span className="button-arrow" aria-hidden="true">↓</span>
            <span>下</span>
          </button>
        </div>

        <button type="button" className="restart-button" onClick={handleRestart}>
          リスタート
        </button>
      </section>
    </main>
  );
}
