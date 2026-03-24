import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  Direction,
  GameState,
  Hand,
  HoiWinner,
  JankenRound,
  PendingHoi,
  Position,
  Status,
  TurnOutcome,
  TurnPhase,
} from './types';
import {
  BOARD_SIZE,
  DIRECTION_LABELS,
  HAND_ICONS,
  HAND_LABELS,
  createInitialState,
  evaluateGameOver,
  getAvailableDirections,
  getRandomAvailableDirection,
  getRandomHand,
  hasEnemy,
  isExit,
  isSamePosition,
  removeEnemyAt,
  resolveHoiTurn,
  resolveJanken,
} from './utils/game';
import { playAudioCue, stopAllAudio } from './utils/audio';

const REVEAL_DURATION_MS = 1440;
const AFTER_RESOLVE_DURATION_MS = REVEAL_DURATION_MS;

type Screen = 'title' | 'game';
type HighlightType = 'move' | 'spawn' | 'defeat';
type BoardEffect = {
  position: Position;
  type: HighlightType;
};

function getOutcomeLabel(outcome: TurnOutcome): string {
  switch (outcome) {
    case 'move':
      return '1マス進んだ';
    case 'spawn':
    case 'spawnOnly':
      return '敵があらわれた';
    case 'moveAndSpawn':
      return '1マス進んで敵があらわれた';
    case 'moveAndSelect':
      return '1マス進んだ！ 敵を1体選んでください';
    case 'defeat':
      return '敵を1体倒した';
    default:
      return '何も起きなかった';
  }
}

function getStageText(
  phase: TurnPhase,
  status: Status,
  turnResult: GameState['turnResult'],
  message: string,
): string {
  if (status === 'clear') {
    return 'クリア！';
  }

  if (status === 'gameover') {
    return 'ゲームオーバー';
  }

  if (phase === 'resolve' || phase === 'enemySelect') {
    return message || (turnResult ? getOutcomeLabel(turnResult.hoi.outcome) : '何も起きなかった');
  }

  switch (phase) {
    case 'jankenInput':
      return 'じゃんけん';
    case 'jankenReveal':
      return 'ポン';
    case 'jankenRetryInput':
      return 'あいこで';
    case 'jankenRetryReveal':
      return 'しょ';
    case 'hoiInput':
      return 'あっちむいて';
    case 'hoiReveal':
      return 'ホイ';
    default:
      return 'じゃんけん';
  }
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

function OverlayBattleCard({
  icon,
  label,
  active,
  position,
  direction,
  verdict,
}: {
  icon: string | null;
  label: string | null;
  active: boolean;
  position: 'enemy' | 'player';
  direction?: Direction | null;
  verdict?: '勝ち' | '負け' | null;
}) {
  return (
    <div className={`overlay-pointer ${position} ${active ? 'active' : ''} ${verdict ? 'with-verdict' : ''}`}>
      {icon ? (
        <>
          <span
            className={`battle-icon${direction ? ` direction-${direction}` : ''}`}
            aria-hidden="true"
          >
            {icon}
          </span>
          <span className="pointer-text">{label}</span>
          {verdict ? (
            <span className={`verdict-badge ${verdict === '勝ち' ? 'win' : 'lose'}`}>{verdict}</span>
          ) : null}
        </>
      ) : verdict ? (
        <span className={`verdict-badge standalone ${verdict === '勝ち' ? 'win' : 'lose'}`}>{verdict}</span>
      ) : null}
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('title');
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [gameState, setGameState] = useState<GameState>(() => createInitialState());
  const [phase, setPhase] = useState<TurnPhase>('jankenInput');
  const [pendingJanken, setPendingJanken] = useState<JankenRound | null>(null);
  const [resolvedJanken, setResolvedJanken] = useState<JankenRound | null>(null);
  const [pendingHoi, setPendingHoi] = useState<PendingHoi | null>(null);
  const [hoiWinner, setHoiWinner] = useState<HoiWinner | null>(null);
  const [boardEffects, setBoardEffects] = useState<BoardEffect[]>([]);
  const timeoutsRef = useRef<number[]>([]);
  const lastPlayedPhaseRef = useRef<TurnPhase | null>(null);

  const availableDirections = getAvailableDirections(gameState.player, gameState.enemies);
  const canChooseHand =
    screen === 'game' &&
    gameState.status === 'playing' &&
    (phase === 'jankenInput' || phase === 'jankenRetryInput');
  const canChooseDirection =
    screen === 'game' && gameState.status === 'playing' && phase === 'hoiInput';
  const canSelectEnemy =
    screen === 'game' && gameState.status === 'playing' && phase === 'enemySelect';

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

  const queueNextTurn = () => {
    const settleTimeoutId = window.setTimeout(() => {
      setPendingHoi(null);
      setHoiWinner(null);
      setResolvedJanken(null);
      setBoardEffects([]);
      setPhase('jankenInput');
    }, AFTER_RESOLVE_DURATION_MS);

    timeoutsRef.current.push(settleTimeoutId);
  };

  const resetGame = () => {
    clearScheduledTimeouts();
    stopAllAudio();
    setPendingJanken(null);
    setResolvedJanken(null);
    setPendingHoi(null);
    setHoiWinner(null);
    setBoardEffects([]);
    lastPlayedPhaseRef.current = null;
    setPhase('jankenInput');
    setGameState(createInitialState());
  };

  useEffect(() => clearScheduledTimeouts, []);
  useEffect(() => stopAllAudio, []);

  useEffect(() => {
    if (screen !== 'game') {
      return;
    }

    const phaseAudioMap: Partial<
      Record<TurnPhase, 'janken' | 'pon' | 'aikode' | 'sho' | 'acchimuite' | 'hoi'>
    > = {
      jankenInput: 'janken',
      jankenReveal: 'pon',
      jankenRetryInput: 'aikode',
      jankenRetryReveal: 'sho',
      hoiInput: 'acchimuite',
      hoiReveal: 'hoi',
    };

    const cue = phaseAudioMap[phase];
    if (!cue || lastPlayedPhaseRef.current === phase) {
      return;
    }

    lastPlayedPhaseRef.current = phase;
    playAudioCue(cue);
  }, [phase, screen]);

  const handleStart = () => {
    resetGame();
    setScreen('game');
  };

  const handleOpenRules = () => {
    setIsRuleModalOpen(true);
  };

  const handleCloseRules = () => {
    setIsRuleModalOpen(false);
  };

  const handleRestart = () => {
    resetGame();
  };

  const handleHandSelect = (playerHand: Hand) => {
    if (!canChooseHand) {
      return;
    }

    clearScheduledTimeouts();

    const enemyHand = getRandomHand();
    const result = resolveJanken(playerHand, enemyHand);
    const jankenRound: JankenRound = { playerHand, enemyHand, result };
    const revealPhase = phase === 'jankenInput' ? 'jankenReveal' : 'jankenRetryReveal';

    setPendingJanken(jankenRound);
    setPhase(revealPhase);

    const revealTimeoutId = window.setTimeout(() => {
      if (result === 'draw') {
        setPendingJanken(null);
        setResolvedJanken(null);
        setPhase('jankenRetryInput');
        return;
      }

      const winner: HoiWinner = result === 'playerWin' ? 'player' : 'enemy';
      setHoiWinner(winner);
      setResolvedJanken(jankenRound);
      setPendingJanken(null);
      setPhase('hoiInput');
    }, REVEAL_DURATION_MS);

    timeoutsRef.current.push(revealTimeoutId);
  };

  const handleDirectionSelect = (playerDirection: Direction) => {
    if (!canChooseDirection || !availableDirections.includes(playerDirection) || !hoiWinner) {
      return;
    }

    if (!resolvedJanken) {
      return;
    }

    clearScheduledTimeouts();

    const enemyDirection = getRandomAvailableDirection(availableDirections);
    const pending: PendingHoi = {
      playerDirection,
      enemyDirection,
      winner: hoiWinner,
    };

    const { nextState, movePosition, spawnPositions, needsEnemySelection } = resolveHoiTurn(
      gameState,
      hoiWinner,
      playerDirection,
      enemyDirection,
      resolvedJanken,
    );

    const effects: BoardEffect[] = [];
    if (movePosition) {
      effects.push({ position: movePosition, type: 'move' });
    }
    effects.push(...spawnPositions.map((position) => ({ position, type: 'spawn' as const })));

    setPendingHoi(pending);
    setBoardEffects([]);
    setPhase('hoiReveal');

    const revealTimeoutId = window.setTimeout(() => {
      setGameState(nextState);
      setBoardEffects(effects);

      if (nextState.status !== 'playing') {
        setPendingHoi(null);
        setHoiWinner(null);
        setResolvedJanken(null);
        setPhase('finished');
        return;
      }

      if (needsEnemySelection) {
        setPhase('enemySelect');
        return;
      }

      setPhase('resolve');
      queueNextTurn();
    }, REVEAL_DURATION_MS);

    timeoutsRef.current.push(revealTimeoutId);
  };

  const handleEnemySelect = (position: Position) => {
    if (!canSelectEnemy || !hasEnemy(position, gameState.enemies) || !gameState.turnResult) {
      return;
    }

    clearScheduledTimeouts();

    const nextEnemies = removeEnemyAt(position, gameState.enemies);
    const nextStatus = evaluateGameOver(gameState.player, nextEnemies) ? 'gameover' : 'playing';

    setGameState({
      ...gameState,
      enemies: nextEnemies,
      status: nextStatus,
      message: nextStatus === 'gameover' ? '敵を倒しても出口がない' : '敵を1体倒した',
      turnResult: {
        ...gameState.turnResult,
        hoi: {
          ...gameState.turnResult.hoi,
          outcome: 'defeat',
        },
        event: '敵を1体倒した',
      },
    });
    setBoardEffects([{ position, type: 'defeat' }]);

    if (nextStatus !== 'playing') {
      setPendingHoi(null);
      setHoiWinner(null);
      setResolvedJanken(null);
      setPhase('finished');
      return;
    }

    setPhase('resolve');
    queueNextTurn();
  };

  const stageText = getStageText(phase, gameState.status, gameState.turnResult, gameState.message);
  const showCenterStage = gameState.status !== 'playing';
  const showJankenCards = phase === 'jankenReveal' || phase === 'jankenRetryReveal';
  const showHoiCards = phase === 'hoiReveal';
  const showVerdict = phase === 'hoiInput' && hoiWinner !== null;
  const activeOverlay = showJankenCards || showHoiCards || showVerdict;

  const topEnemyIcon = showJankenCards
    ? pendingJanken
      ? HAND_ICONS[pendingJanken.enemyHand]
      : null
    : showHoiCards
      ? '☞'
      : null;
  const topEnemyLabel = showJankenCards
    ? pendingJanken
      ? HAND_LABELS[pendingJanken.enemyHand]
      : null
    : showHoiCards && pendingHoi
      ? DIRECTION_LABELS[pendingHoi.enemyDirection]
      : null;
  const bottomPlayerIcon = showJankenCards
    ? pendingJanken
      ? HAND_ICONS[pendingJanken.playerHand]
      : null
    : showHoiCards
      ? '☞'
      : null;
  const bottomPlayerLabel = showJankenCards
    ? pendingJanken
      ? HAND_LABELS[pendingJanken.playerHand]
      : null
    : showHoiCards && pendingHoi
      ? DIRECTION_LABELS[pendingHoi.playerDirection]
      : null;

  const enemyVerdict = showVerdict ? (hoiWinner === 'enemy' ? '勝ち' : '負け') : null;
  const playerVerdict = showVerdict ? (hoiWinner === 'player' ? '勝ち' : '負け') : null;

  if (screen === 'title') {
    return (
      <main className="app">
        <section className="panel title-screen">
          <button type="button" className="rules-button" onClick={handleOpenRules}>
            ルール
          </button>
          <div className="title-content">
            <p className="title-mark">あっちむいてホイ × 包囲パズル</p>
            <h1 className="title-heading">あっちむいて包囲</h1>
            <button type="button" className="start-button" onClick={handleStart}>
              スタート
            </button>
          </div>
          <p className="credit-text">VOICEVOX:ずんだもん</p>
        </section>
        {isRuleModalOpen ? (
          <div className="modal-backdrop" onClick={handleCloseRules}>
            <section
              className="rules-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="rules-title"
              onClick={(event) => event.stopPropagation()}
            >
              <button type="button" className="modal-close" onClick={handleCloseRules}>
                ×
              </button>
              <h2 id="rules-title">ルール</h2>
              <div className="rules-content">
                <section>
                  <h3>基本の流れ</h3>
                  <ul>
                    <li>じゃんけんをして「あっちむいてホイ」をします</li>
                    <li>あいこなら、じゃんけんをもう一度やります</li>
                  </ul>
                </section>
                <section>
                  <h3>プレイヤーが勝ったとき</h3>
                  <ul>
                    <li>前に1マス進めます</li>
                    <li>ホイで揃うと、さらに敵を1体倒せます</li>
                  </ul>
                </section>
                <section>
                  <h3>敵が勝ったとき</h3>
                  <ul>
                    <li>敵が増えて、包囲されやすくなります</li>
                    <li>ホイで揃うと、さらに敵が1体増えてしまいます</li>
                  </ul>
                </section>
                <section>
                  <h3>クリア条件</h3>
                  <ul>
                    <li>四隅の出口のどれかにたどり着けばクリアです</li>
                    <li>どの出口にも行けなくなったらゲームオーバーです</li>
                  </ul>
                </section>
              </div>
            </section>
          </div>
        ) : null}
      </main>
    );
  }

  return (
    <main className="app">
      <section className={`panel status-${gameState.status}`}>
        <button type="button" className="rules-button" onClick={handleOpenRules}>
          ルール
        </button>
        <header className="header">
          <p className="title-mark">あっちむいて包囲</p>
        </header>

        <div className={`top-stage ${phase} ${gameState.status}`}>
          <span className={`top-stage-text ${phase.includes('Reveal') ? 'is-reveal' : ''}`}>
            {stageText}
          </span>
        </div>

        <div className={`board-shell status-${gameState.status}`}>
          <div
            className={`board ${phase === 'resolve' ? 'board-resolving' : ''}`}
            style={{ gridTemplateColumns: `repeat(${BOARD_SIZE}, minmax(0, 1fr))` }}
          >
            {boardCells.map((cell) => {
              const content = getCellContent(cell, gameState);
              const effect = boardEffects.find((entry) => isSamePosition(entry.position, cell));
              const selectable = canSelectEnemy && hasEnemy(cell, gameState.enemies);

              return (
                <button
                  key={`${cell.row}-${cell.col}`}
                  type="button"
                  className={`${content.className}${effect ? ` highlight ${effect.type}` : ''}${selectable ? ' selectable-enemy' : ''}`}
                  aria-label={`row-${cell.row}-col-${cell.col}-${content.label}`}
                  onClick={() => handleEnemySelect(cell)}
                  disabled={!selectable}
                >
                  <span className="cell-icon" aria-hidden="true">
                    {content.icon}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="board-overlay" aria-hidden="true">
            <OverlayBattleCard
              icon={topEnemyIcon}
              label={topEnemyLabel}
              active={activeOverlay}
              position="enemy"
              direction={showHoiCards && pendingHoi ? pendingHoi.enemyDirection : null}
              verdict={enemyVerdict}
            />
            {showCenterStage ? (
              <div className={`stage-overlay ${gameState.status} ${phase}`}>
                <span className="stage-text">{stageText}</span>
              </div>
            ) : null}
            <OverlayBattleCard
              icon={bottomPlayerIcon}
              label={bottomPlayerLabel}
              active={activeOverlay}
              position="player"
              direction={showHoiCards && pendingHoi ? pendingHoi.playerDirection : null}
              verdict={playerVerdict}
            />
          </div>
        </div>

        <div className="legend compact">
          <span><span className="legend-icon">🙂</span>プレイヤー</span>
          <span><span className="legend-icon">👹</span>敵</span>
          <span><span className="legend-icon">🚪</span>出口</span>
        </div>

        <div className="action-panel">
          <div className={`hand-controls ${canChooseHand ? 'visible' : ''}`}>
            <button
              type="button"
              className="hand-button"
              onClick={() => handleHandSelect('rock')}
              disabled={!canChooseHand}
            >
              <span className="hand-icon" aria-hidden="true">✊</span>
              <span>グー</span>
            </button>
            <button
              type="button"
              className="hand-button"
              onClick={() => handleHandSelect('scissors')}
              disabled={!canChooseHand}
            >
              <span className="hand-icon" aria-hidden="true">✌️</span>
              <span>チョキ</span>
            </button>
            <button
              type="button"
              className="hand-button"
              onClick={() => handleHandSelect('paper')}
              disabled={!canChooseHand}
            >
              <span className="hand-icon" aria-hidden="true">✋</span>
              <span>パー</span>
            </button>
          </div>

          <div className={`controls-cross ${canChooseDirection ? 'visible' : ''}`}>
            <button
              type="button"
              className="direction-button up"
              onClick={() => handleDirectionSelect('up')}
              disabled={!canChooseDirection || !availableDirections.includes('up')}
            >
              <span className="direction-hand direction-up" aria-hidden="true">☞</span>
              <span>上</span>
            </button>
            <button
              type="button"
              className="direction-button left"
              onClick={() => handleDirectionSelect('left')}
              disabled={!canChooseDirection || !availableDirections.includes('left')}
            >
              <span className="direction-hand direction-left" aria-hidden="true">☞</span>
              <span>左</span>
            </button>
            <button
              type="button"
              className="direction-button down"
              onClick={() => handleDirectionSelect('down')}
              disabled={!canChooseDirection || !availableDirections.includes('down')}
            >
              <span className="direction-hand direction-down" aria-hidden="true">☞</span>
              <span>下</span>
            </button>
            <button
              type="button"
              className="direction-button right"
              onClick={() => handleDirectionSelect('right')}
              disabled={!canChooseDirection || !availableDirections.includes('right')}
            >
              <span className="direction-hand direction-right" aria-hidden="true">☞</span>
              <span>右</span>
            </button>
          </div>
        </div>

        {gameState.status !== 'playing' ? (
          <button type="button" className="restart-button" onClick={handleRestart}>
            リスタート
          </button>
        ) : null}

        <p className="credit-text">VOICEVOX:ずんだもん</p>
      </section>
      {isRuleModalOpen ? (
        <div className="modal-backdrop" onClick={handleCloseRules}>
          <section
            className="rules-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rules-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" className="modal-close" onClick={handleCloseRules}>
              ×
            </button>
            <h2 id="rules-title">ルール</h2>
            <div className="rules-content">
              <section>
                <h3>基本の流れ</h3>
                <ul>
                  <li>じゃんけんをして「あっちむいてホイ」をします</li>
                  <li>あいこなら、じゃんけんをもう一度やります</li>
                </ul>
              </section>
              <section>
                <h3>プレイヤーが勝ったとき</h3>
                <ul>
                  <li>前に1マス進めます</li>
                  <li>ホイで揃うと、さらに敵を1体倒せます</li>
                </ul>
              </section>
              <section>
                <h3>敵が勝ったとき</h3>
                <ul>
                  <li>敵が増えて、包囲されやすくなります</li>
                  <li>ホイで揃うと、さらに敵が1体増えてしまいます</li>
                </ul>
              </section>
              <section>
                <h3>クリア条件</h3>
                <ul>
                  <li>四隅の出口のどれかにたどり着けばクリアです</li>
                  <li>どの出口にも行けなくなったらゲームオーバーです</li>
                </ul>
              </section>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
