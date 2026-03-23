export type Direction = 'up' | 'down' | 'left' | 'right';

export type Position = {
  row: number;
  col: number;
};

export type Status = 'playing' | 'clear' | 'gameover';

export type TurnResult = {
  playerDirection: Direction;
  enemyDirection: Direction;
  event: string;
};

export type GameState = {
  player: Position;
  enemies: Position[];
  status: Status;
  message: string;
  turnResult: TurnResult | null;
};
