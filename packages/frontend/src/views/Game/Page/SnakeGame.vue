<script setup lang="ts">
import { ContentWrap } from '@/components/ContentWrap'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { ElButton, ElCard, ElTag, ElTable, ElTableColumn } from 'element-plus'
import { useEventListener } from '@vueuse/core'
import { getGameLeaderboardApi, submitGameScoreApi } from '@/api/game'
import {
  createGame,
  createRng,
  pauseGame,
  resumeGame,
  setDirection,
  startGame,
  stepGame,
  type Direction,
  type GameState
} from './snakeGame'

defineOptions({
  name: 'ExampleSnakeGame'
})

const GRID_WIDTH = 20
const GRID_HEIGHT = 20
const TICK_MS = 140
const GAME_CODE = 'snake'

const seed = ref(Date.now())
const rng = ref(createRng(seed.value))
const state = ref<GameState>(createGame({ width: GRID_WIDTH, height: GRID_HEIGHT }, rng.value))
const leaderboard = ref<
  {
    rank: number
    username: string
    displayName: string
    score: number
  }[]
>([])
const leaderboardLoading = ref(false)

const resetGame = () => {
  seed.value = Date.now()
  rng.value = createRng(seed.value)
  state.value = createGame({ width: GRID_WIDTH, height: GRID_HEIGHT }, rng.value)
}

const runTick = () => {
  state.value = stepGame(state.value, rng.value)
}

let timer: number | undefined
onMounted(() => {
  timer = window.setInterval(runTick, TICK_MS)
  fetchLeaderboard()
})

onUnmounted(() => {
  if (timer) {
    window.clearInterval(timer)
  }
})

const ensureRunning = () => {
  if (state.value.status === 'ready') {
    state.value = startGame(state.value)
  } else if (state.value.status === 'paused') {
    state.value = resumeGame(state.value)
  }
}

const handleDirection = (direction: Direction) => {
  state.value = setDirection(state.value, direction)
  ensureRunning()
}

const togglePause = () => {
  if (state.value.status === 'running') {
    state.value = pauseGame(state.value)
  } else if (state.value.status === 'paused') {
    state.value = resumeGame(state.value)
  }
}

const handleKey = (event: KeyboardEvent) => {
  const target = event.target as HTMLElement | null
  if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return

  switch (event.key) {
    case 'ArrowUp':
    case 'w':
    case 'W':
      event.preventDefault()
      handleDirection('up')
      break
    case 'ArrowDown':
    case 's':
    case 'S':
      event.preventDefault()
      handleDirection('down')
      break
    case 'ArrowLeft':
    case 'a':
    case 'A':
      event.preventDefault()
      handleDirection('left')
      break
    case 'ArrowRight':
    case 'd':
    case 'D':
      event.preventDefault()
      handleDirection('right')
      break
    case ' ':
    case 'p':
    case 'P':
      event.preventDefault()
      togglePause()
      break
    case 'Enter':
      event.preventDefault()
      resetGame()
      break
    default:
      break
  }
}

useEventListener(window, 'keydown', handleKey)

const fetchLeaderboard = async () => {
  leaderboardLoading.value = true
  try {
    const res = await getGameLeaderboardApi(GAME_CODE)
    const list = res?.data?.list || []
    leaderboard.value = list.map((item, index) => ({
      rank: index + 1,
      username: item.username,
      displayName: item.displayName || item.username,
      score: item.score
    }))
  } finally {
    leaderboardLoading.value = false
  }
}

const submitScore = async (score: number) => {
  if (score <= 0) return
  try {
    const res = await submitGameScoreApi(GAME_CODE, score)
    const list = res?.data?.list || []
    leaderboard.value = list.map((item, index) => ({
      rank: index + 1,
      username: item.username,
      displayName: item.displayName || item.username,
      score: item.score
    }))
  } catch (e) {
    // ignore submit errors to avoid breaking gameplay
  }
}

watch(
  () => state.value.status,
  (next, prev) => {
    if (next === 'over' && prev !== 'over') {
      submitScore(state.value.score)
    }
    if (next === 'ready' && prev === 'over') {
      fetchLeaderboard()
    }
  }
)

const cellCount = computed(() => state.value.width * state.value.height)
const snakeSet = computed(() => {
  const set = new Set<string>()
  state.value.snake.forEach((segment) => {
    set.add(`${segment.x},${segment.y}`)
  })
  return set
})

const headKey = computed(() => {
  const head = state.value.snake[0]
  return `${head.x},${head.y}`
})

const foodKey = computed(() => {
  if (!state.value.food) return ''
  return `${state.value.food.x},${state.value.food.y}`
})

const statusLabel = computed(() => {
  if (state.value.status === 'ready') return '准备就绪'
  if (state.value.status === 'running') return '进行中'
  if (state.value.status === 'paused') return '已暂停'
  if (state.value.reason === 'win') return '通关'
  return '游戏结束'
})

const statusType = computed(() => {
  if (state.value.status === 'running') return 'success'
  if (state.value.status === 'paused') return 'warning'
  if (state.value.status === 'ready') return 'info'
  return 'danger'
})

const getCellClass = (index: number) => {
  const x = index % state.value.width
  const y = Math.floor(index / state.value.width)
  const key = `${x},${y}`
  if (key === foodKey.value) return 'cell cell-food'
  if (key === headKey.value) return 'cell cell-head'
  if (snakeSet.value.has(key)) return 'cell cell-snake'
  return 'cell'
}
</script>

<template>
  <ContentWrap>
    <ElCard class="snake-card" shadow="never">
      <div class="snake-header">
        <div class="snake-title">贪吃蛇</div>
        <div class="snake-meta">
          <span>得分：{{ state.score }}</span>
          <ElTag :type="statusType" effect="light">{{ statusLabel }}</ElTag>
        </div>
      </div>

      <div class="snake-body">
        <div class="snake-main">
          <div
            class="snake-board"
            :style="{
              gridTemplateColumns: `repeat(${state.width}, var(--snake-cell-size))`,
              gridTemplateRows: `repeat(${state.height}, var(--snake-cell-size))`
            }"
          >
            <div v-for="index in cellCount" :key="index" :class="getCellClass(index - 1)" />
          </div>

          <div class="snake-actions">
            <ElButton type="primary" @click="state = startGame(state)">开始</ElButton>
            <ElButton
              @click="togglePause"
              :disabled="state.status === 'ready' || state.status === 'over'"
            >
              {{ state.status === 'paused' ? '继续' : '暂停' }}
            </ElButton>
            <ElButton @click="resetGame">重新开始</ElButton>
          </div>

          <div class="snake-hint"> 使用方向键或 WASD 移动。空格或 P 暂停，Enter 重新开始。 </div>
        </div>

        <div class="snake-leaderboard">
          <div class="leaderboard-title">排行榜（前 10）</div>
          <ElTable
            :data="leaderboard"
            size="small"
            stripe
            :border="false"
            :loading="leaderboardLoading"
          >
            <ElTableColumn prop="rank" label="名次" width="70" />
            <ElTableColumn prop="displayName" label="用户名称" min-width="140" />
            <ElTableColumn prop="score" label="得分" width="80" />
          </ElTable>
        </div>
      </div>

      <div class="snake-pad">
        <ElButton class="pad-btn" @click="handleDirection('up')">▲</ElButton>
        <div class="pad-row">
          <ElButton class="pad-btn" @click="handleDirection('left')">◀</ElButton>
          <ElButton class="pad-btn" @click="handleDirection('down')">▼</ElButton>
          <ElButton class="pad-btn" @click="handleDirection('right')">▶</ElButton>
        </div>
      </div>
    </ElCard>
  </ContentWrap>
</template>

<style scoped>
.snake-card {
  --snake-cell-size: 18px;
}

.snake-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  gap: 12px;
}

.snake-title {
  font-size: 18px;
  font-weight: 600;
}

.snake-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--el-text-color-regular);
}

.snake-board {
  display: grid;
  width: fit-content;
  padding: 12px;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  gap: 2px;
}

.cell {
  width: var(--snake-cell-size);
  height: var(--snake-cell-size);
  background: var(--el-bg-color);
  border-radius: 3px;
}

.cell-snake {
  background: var(--el-color-primary-light-5);
}

.cell-head {
  background: var(--el-color-primary);
}

.cell-food {
  background: var(--el-color-danger-light-3);
}

.snake-actions {
  display: flex;
  margin-top: 16px;
  gap: 8px;
}

.snake-body {
  display: flex;
  align-items: flex-start;
  gap: 24px;
}

.snake-main {
  display: flex;
  flex-direction: column;
}

.snake-hint {
  margin-top: 12px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.snake-leaderboard {
  min-width: 280px;
  padding-left: 24px;
  margin-left: auto;
  border-left: 1px solid var(--el-border-color);
}

.leaderboard-title {
  margin-bottom: 8px;
  font-weight: 500;
  color: var(--el-text-color-regular);
}

.snake-pad {
  display: none;
  margin-top: 16px;
  align-items: center;
  flex-direction: column;
  gap: 8px;
}

.pad-row {
  display: flex;
  gap: 8px;
}

.pad-btn {
  width: 48px;
}

@media (width <= 768px) {
  .snake-card {
    --snake-cell-size: 14px;
  }

  .snake-body {
    flex-direction: column;
  }

  .snake-leaderboard {
    width: 100%;
    padding-top: 16px;
    padding-left: 0;
    border-top: 1px solid var(--el-border-color);
    border-left: none;
  }

  .snake-pad {
    display: flex;
  }
}
</style>
