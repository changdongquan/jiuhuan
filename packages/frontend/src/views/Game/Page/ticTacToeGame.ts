export type Player = 'X' | 'O'
export type Cell = Player | null
export type GameStatus = 'ready' | 'running' | 'over'

export interface GameState {
  board: Cell[]
  current: Player
  status: GameStatus
  winner: Player | 'draw' | null
  score: number
}

export const createGame = (): GameState => ({
  board: Array.from({ length: 9 }, () => null),
  current: 'X',
  status: 'ready',
  winner: null,
  score: 0
})

export const startGame = (state: GameState): GameState => {
  if (state.status === 'running') return state
  if (state.status === 'over') return state
  return { ...state, status: 'running' }
}

export const placeMove = (state: GameState, index: number, player: Player): GameState => {
  if (state.status !== 'running') return state
  if (state.board[index]) return state
  const nextBoard = state.board.slice()
  nextBoard[index] = player
  const winner = getWinner(nextBoard)
  if (winner) {
    const score = winner === 'X' ? state.score + 1 : state.score
    return { ...state, board: nextBoard, status: 'over', winner, score }
  }
  if (nextBoard.every((cell) => cell)) {
    return { ...state, board: nextBoard, status: 'over', winner: 'draw' }
  }
  return { ...state, board: nextBoard, current: player === 'X' ? 'O' : 'X' }
}

export const getWinner = (board: Cell[]): Player | null => {
  const lines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6]
  ]
  for (const [a, b, c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a] as Player
    }
  }
  return null
}

export const pickAiMove = (board: Cell[], rng: () => number) => {
  const empty = board
    .map((cell, index) => (cell ? null : index))
    .filter((value) => value !== null) as number[]
  if (empty.length === 0) return -1

  // Try to win
  for (const index of empty) {
    const test = board.slice()
    test[index] = 'O'
    if (getWinner(test) === 'O') return index
  }

  // Block
  for (const index of empty) {
    const test = board.slice()
    test[index] = 'X'
    if (getWinner(test) === 'X') return index
  }

  // Center
  if (!board[4]) return 4

  // Random available
  const pick = Math.floor(rng() * empty.length)
  return empty[pick]
}
