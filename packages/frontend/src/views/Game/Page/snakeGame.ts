export type Direction = 'up' | 'down' | 'left' | 'right'
export type GameStatus = 'ready' | 'running' | 'paused' | 'over'

export interface Point {
  x: number
  y: number
}

export interface GameConfig {
  width: number
  height: number
  initialLength: number
  startDirection: Direction
}

export interface GameState {
  width: number
  height: number
  snake: Point[]
  direction: Direction
  nextDirection: Direction
  food: Point | null
  score: number
  status: GameStatus
  reason?: 'collision' | 'wall' | 'win'
}

const DEFAULT_CONFIG: GameConfig = {
  width: 20,
  height: 20,
  initialLength: 3,
  startDirection: 'right'
}

export const createRng = (seed: number) => {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0xffffffff
  }
}

export const createGame = (config: Partial<GameConfig>, rng: () => number): GameState => {
  const merged = { ...DEFAULT_CONFIG, ...config }
  const { width, height, initialLength, startDirection } = merged
  const startX = Math.max(0, Math.min(width - 1, Math.floor(width / 2)))
  const startY = Math.max(0, Math.min(height - 1, Math.floor(height / 2)))
  const snake: Point[] = []
  for (let i = 0; i < initialLength; i += 1) {
    const offset = i
    if (startDirection === 'right') {
      snake.push({ x: startX - offset, y: startY })
    } else if (startDirection === 'left') {
      snake.push({ x: startX + offset, y: startY })
    } else if (startDirection === 'down') {
      snake.push({ x: startX, y: startY - offset })
    } else {
      snake.push({ x: startX, y: startY + offset })
    }
  }
  const food = spawnFood(width, height, snake, rng)

  return {
    width,
    height,
    snake,
    direction: startDirection,
    nextDirection: startDirection,
    food,
    score: 0,
    status: 'ready'
  }
}

export const canTurn = (current: Direction, next: Direction) => {
  if (current === 'up' && next === 'down') return false
  if (current === 'down' && next === 'up') return false
  if (current === 'left' && next === 'right') return false
  if (current === 'right' && next === 'left') return false
  return true
}

export const setDirection = (state: GameState, next: Direction): GameState => {
  if (!canTurn(state.direction, next)) return state
  return {
    ...state,
    nextDirection: next
  }
}

export const startGame = (state: GameState): GameState => {
  if (state.status === 'running') return state
  if (state.status === 'over') return state
  return {
    ...state,
    status: 'running'
  }
}

export const pauseGame = (state: GameState): GameState => {
  if (state.status !== 'running') return state
  return {
    ...state,
    status: 'paused'
  }
}

export const resumeGame = (state: GameState): GameState => {
  if (state.status !== 'paused') return state
  return {
    ...state,
    status: 'running'
  }
}

export const stepGame = (state: GameState, rng: () => number): GameState => {
  if (state.status !== 'running') return state
  const direction = state.nextDirection
  const head = state.snake[0]
  const next = getNextHead(head, direction)
  const ateFood = state.food ? samePoint(next, state.food) : false

  if (next.x < 0 || next.x >= state.width || next.y < 0 || next.y >= state.height) {
    return {
      ...state,
      status: 'over',
      reason: 'wall'
    }
  }

  const body = state.snake
  const bodyToCheck = ateFood ? body : body.slice(0, -1)
  const hitSelf = bodyToCheck.some((segment, index) => index !== 0 && samePoint(segment, next))
  if (hitSelf) {
    return {
      ...state,
      status: 'over',
      reason: 'collision'
    }
  }
  const nextSnake = [next, ...body]
  if (!ateFood) {
    nextSnake.pop()
  }

  let nextFood = state.food
  let nextScore = state.score
  let reason: GameState['reason']
  if (ateFood) {
    nextScore += 1
    nextFood = spawnFood(state.width, state.height, nextSnake, rng)
    if (!nextFood) {
      reason = 'win'
    }
  }

  return {
    ...state,
    snake: nextSnake,
    direction,
    nextDirection: direction,
    food: nextFood,
    score: nextScore,
    status: reason === 'win' ? 'over' : state.status,
    reason: reason || state.reason
  }
}

const spawnFood = (width: number, height: number, snake: Point[], rng: () => number) => {
  const occupied = new Set(snake.map((point) => `${point.x},${point.y}`))
  const available: Point[] = []
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const key = `${x},${y}`
      if (!occupied.has(key)) {
        available.push({ x, y })
      }
    }
  }
  if (available.length === 0) return null
  const index = Math.floor(rng() * available.length)
  return available[index]
}

const getNextHead = (head: Point, direction: Direction): Point => {
  if (direction === 'up') return { x: head.x, y: head.y - 1 }
  if (direction === 'down') return { x: head.x, y: head.y + 1 }
  if (direction === 'left') return { x: head.x - 1, y: head.y }
  return { x: head.x + 1, y: head.y }
}

const samePoint = (a: Point, b: Point) => a.x === b.x && a.y === b.y
