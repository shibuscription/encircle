export type Direction = 'up' | 'down' | 'left' | 'right';

export type Hand = 'rock' | 'scissors' | 'paper';

export type JankenResult = 'playerWin' | 'enemyWin' | 'draw';

export type HoiWinner = 'player' | 'enemy';

export type TurnOutcome =
  | 'move'
  | 'spawn'
  | 'moveAndSpawn'
  | 'moveAndSelect'
  | 'spawnOnly'
  | 'defeat'
  | 'none';

export type Position = {
  row: number;
  col: number;
};

export type Status = 'playing' | 'clear' | 'gameover';

export type TurnPhase =
  | 'jankenInput'
  | 'jankenReveal'
  | 'jankenRetryInput'
  | 'jankenRetryReveal'
  | 'hoiInput'
  | 'hoiReveal'
  | 'enemySelect'
  | 'resolve'
  | 'finished';

export type JankenRound = {
  playerHand: Hand;
  enemyHand: Hand;
  result: JankenResult;
};

export type PendingHoi = {
  playerDirection: Direction;
  enemyDirection: Direction;
  winner: HoiWinner;
};

export type TurnResult = {
  janken: JankenRound;
  hoi: {
    winner: HoiWinner;
    playerDirection: Direction;
    enemyDirection: Direction;
    matched: boolean;
    outcome: TurnOutcome;
  };
  event: string;
};

export type GameState = {
  player: Position;
  enemies: Position[];
  status: Status;
  message: string;
  turnResult: TurnResult | null;
};
