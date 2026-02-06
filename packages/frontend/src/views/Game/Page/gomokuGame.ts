export type Player = 'black' | 'white'
export type Cell = Player | null
export type GameStatus = 'ready' | 'running' | 'over'

export interface GameState {
  size: number
  board: Cell[][]
  current: Player
  status: GameStatus
  winner: Player | 'draw' | null
  score: number
}

export const createRng = (seed: number) => {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0xffffffff
  }
}

export const createGame = (size = 15): GameState => ({
  size,
  board: Array.from({ length: size }, () => Array.from({ length: size }, () => null)),
  current: 'black',
  status: 'ready',
  winner: null,
  score: 0
})

export const startGame = (state: GameState): GameState => {
  if (state.status === 'running') return state
  if (state.status === 'over') return state
  return { ...state, status: 'running' }
}

export const placeMove = (state: GameState, x: number, y: number, player: Player): GameState => {
  if (state.status !== 'running') return state
  if (state.board[y][x]) return state

  const board = state.board.map((row) => row.slice())
  board[y][x] = player

  const winner = getWinner(board, x, y)
  if (winner) {
    const score = winner === 'black' ? state.score + 1 : state.score
    return { ...state, board, status: 'over', winner, score }
  }

  if (board.every((row) => row.every((cell) => cell))) {
    return { ...state, board, status: 'over', winner: 'draw' }
  }

  return { ...state, board, current: player === 'black' ? 'white' : 'black' }
}

export const pickAiMove = (state: GameState, rng: () => number) => {
  const { size, board } = state
  const empty: { x: number; y: number }[] = []
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (!board[y][x]) empty.push({ x, y })
    }
  }
  if (empty.length === 0) return { x: -1, y: -1 }

  const center = Math.floor(size / 2)
  if (!board[center][center]) return { x: center, y: center }

  const pick = Math.floor(rng() * empty.length)
  return empty[pick]
}

const getWinner = (board: Cell[][], x: number, y: number): Player | null => {
  const player = board[y][x]
  if (!player) return null

  const directions = [
    { dx: 1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 1, dy: 1 },
    { dx: 1, dy: -1 }
  ]

  for (const { dx, dy } of directions) {
    let count = 1
    count += countDirection(board, player, x, y, dx, dy)
    count += countDirection(board, player, x, y, -dx, -dy)
    if (count >= 5) return player
  }

  return null
}

const countDirection = (
  board: Cell[][],
  player: Player,
  x: number,
  y: number,
  dx: number,
  dy: number
) => {
  let count = 0
  let cx = x + dx
  let cy = y + dy
  while (board[cy] && board[cy][cx] === player) {
    count += 1
    cx += dx
    cy += dy
  }
  return count
}
