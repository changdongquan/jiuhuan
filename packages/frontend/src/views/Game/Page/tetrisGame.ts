export type GameStatus = 'ready' | 'running' | 'paused' | 'over'

export interface Piece {
  id: number
  matrix: number[][]
  x: number
  y: number
}

export interface GameState {
  width: number
  height: number
  board: number[][]
  current: Piece | null
  score: number
  lines: number
  status: GameStatus
  reason?: 'collision'
}

const SHAPES: Record<number, number[][]> = {
  1: [[1, 1, 1, 1]],
  2: [
    [1, 1],
    [1, 1]
  ],
  3: [
    [0, 1, 0],
    [1, 1, 1]
  ],
  4: [
    [0, 1, 1],
    [1, 1, 0]
  ],
  5: [
    [1, 1, 0],
    [0, 1, 1]
  ],
  6: [
    [1, 0, 0],
    [1, 1, 1]
  ],
  7: [
    [0, 0, 1],
    [1, 1, 1]
  ]
}

const SCORE_TABLE: Record<number, number> = {
  1: 100,
  2: 300,
  3: 500,
  4: 800
}

export const createRng = (seed: number) => {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0xffffffff
  }
}

export const createGame = (width = 10, height = 20, rng: () => number): GameState => {
  const board = Array.from({ length: height }, () => Array.from({ length: width }, () => 0))
  const current = spawnPiece(width, rng)
  return {
    width,
    height,
    board,
    current,
    score: 0,
    lines: 0,
    status: 'ready'
  }
}

export const startGame = (state: GameState): GameState => {
  if (state.status === 'running') return state
  if (state.status === 'over') return state
  return { ...state, status: 'running' }
}

export const pauseGame = (state: GameState): GameState => {
  if (state.status !== 'running') return state
  return { ...state, status: 'paused' }
}

export const resumeGame = (state: GameState): GameState => {
  if (state.status !== 'paused') return state
  return { ...state, status: 'running' }
}

export const step = (state: GameState, rng: () => number): GameState => {
  if (state.status !== 'running') return state
  return moveDown(state, rng)
}

export const moveLeft = (state: GameState): GameState => moveHorizontal(state, -1)
export const moveRight = (state: GameState): GameState => moveHorizontal(state, 1)

export const moveDown = (state: GameState, rng: () => number): GameState => {
  if (!state.current) return state
  const next = { ...state.current, y: state.current.y + 1 }
  if (isValid(state, next)) {
    return { ...state, current: next }
  }
  return lockPiece(state, rng)
}

export const hardDrop = (state: GameState, rng: () => number): GameState => {
  if (!state.current) return state
  let next = { ...state.current }
  while (isValid(state, { ...next, y: next.y + 1 })) {
    next = { ...next, y: next.y + 1 }
  }
  return lockPiece({ ...state, current: next }, rng)
}

export const rotate = (state: GameState): GameState => {
  if (!state.current) return state
  const rotated = rotateMatrix(state.current.matrix)
  const next = { ...state.current, matrix: rotated }
  if (isValid(state, next)) {
    return { ...state, current: next }
  }
  return state
}

const moveHorizontal = (state: GameState, delta: number): GameState => {
  if (!state.current) return state
  const next = { ...state.current, x: state.current.x + delta }
  if (isValid(state, next)) {
    return { ...state, current: next }
  }
  return state
}

const spawnPiece = (width: number, rng: () => number): Piece => {
  const ids = Object.keys(SHAPES).map((value) => Number(value))
  const id = ids[Math.floor(rng() * ids.length)]
  const matrix = SHAPES[id]
  return {
    id,
    matrix,
    x: Math.floor((width - matrix[0].length) / 2),
    y: 0
  }
}

const lockPiece = (state: GameState, rng: () => number): GameState => {
  if (!state.current) return state
  const board = state.board.map((row) => row.slice())
  const { matrix, x, y, id } = state.current

  for (let row = 0; row < matrix.length; row += 1) {
    for (let col = 0; col < matrix[row].length; col += 1) {
      if (matrix[row][col]) {
        const boardY = y + row
        const boardX = x + col
        if (boardY >= 0 && boardY < state.height && boardX >= 0 && boardX < state.width) {
          board[boardY][boardX] = id
        }
      }
    }
  }

  const cleared = clearLines(board)
  const scoreGain = SCORE_TABLE[cleared.lines] || 0
  const nextPiece = spawnPiece(state.width, rng)
  const nextState: GameState = {
    ...state,
    board: cleared.board,
    current: nextPiece,
    score: state.score + scoreGain,
    lines: state.lines + cleared.lines
  }

  if (!isValid(nextState, nextPiece)) {
    return { ...nextState, status: 'over', reason: 'collision' }
  }

  return nextState
}

const clearLines = (board: number[][]) => {
  const remaining = board.filter((row) => row.some((cell) => cell === 0))
  const clearedLines = board.length - remaining.length
  const width = board[0]?.length || 0
  const newRows = Array.from({ length: clearedLines }, () => Array.from({ length: width }, () => 0))
  return {
    board: [...newRows, ...remaining],
    lines: clearedLines
  }
}

const isValid = (state: GameState, piece: Piece) => {
  const { matrix, x, y } = piece
  for (let row = 0; row < matrix.length; row += 1) {
    for (let col = 0; col < matrix[row].length; col += 1) {
      if (!matrix[row][col]) continue
      const boardX = x + col
      const boardY = y + row
      if (boardX < 0 || boardX >= state.width || boardY >= state.height) return false
      if (boardY >= 0 && state.board[boardY][boardX] !== 0) return false
    }
  }
  return true
}

const rotateMatrix = (matrix: number[][]) => {
  const rows = matrix.length
  const cols = matrix[0].length
  const rotated = Array.from({ length: cols }, () => Array.from({ length: rows }, () => 0))
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      rotated[x][rows - 1 - y] = matrix[y][x]
    }
  }
  return rotated
}
