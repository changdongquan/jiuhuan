<script setup lang="ts">
import { ContentWrap } from '@/components/ContentWrap'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { ElButton, ElCard, ElTable, ElTableColumn, ElTag } from 'element-plus'
import { useEventListener } from '@vueuse/core'
import { getGameLeaderboardApi, submitGameScoreApi } from '@/api/game'
import {
  createGame,
  createRng,
  hardDrop,
  moveDown,
  moveLeft,
  moveRight,
  pauseGame,
  resumeGame,
  rotate,
  startGame,
  step,
  type GameState
} from './tetrisGame'

defineOptions({
  name: 'GameTetris'
})

const GAME_CODE = 'tetris'
const WIDTH = 10
const HEIGHT = 20
const TICK_MS = 500

const seed = ref(Date.now())
const rng = ref(createRng(seed.value))
const state = ref<GameState>(createGame(WIDTH, HEIGHT, rng.value))

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
  state.value = createGame(WIDTH, HEIGHT, rng.value)
}

const runTick = () => {
  state.value = step(state.value, rng.value)
}

let timer: number | undefined
onMounted(() => {
  timer = window.setInterval(runTick, TICK_MS)
  fetchLeaderboard()
})

onUnmounted(() => {
  if (timer) window.clearInterval(timer)
})

const ensureRunning = () => {
  if (state.value.status === 'ready') {
    state.value = startGame(state.value)
  } else if (state.value.status === 'paused') {
    state.value = resumeGame(state.value)
  }
}

const handleKey = (event: KeyboardEvent) => {
  const target = event.target as HTMLElement | null
  if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return

  switch (event.key) {
    case 'ArrowLeft':
    case 'a':
    case 'A':
      event.preventDefault()
      ensureRunning()
      state.value = moveLeft(state.value)
      break
    case 'ArrowRight':
    case 'd':
    case 'D':
      event.preventDefault()
      ensureRunning()
      state.value = moveRight(state.value)
      break
    case 'ArrowDown':
    case 's':
    case 'S':
      event.preventDefault()
      ensureRunning()
      state.value = moveDown(state.value, rng.value)
      break
    case 'ArrowUp':
    case 'w':
    case 'W':
      event.preventDefault()
      ensureRunning()
      state.value = rotate(state.value)
      break
    case ' ':
      event.preventDefault()
      ensureRunning()
      state.value = hardDrop(state.value, rng.value)
      break
    case 'p':
    case 'P':
      event.preventDefault()
      if (state.value.status === 'running') state.value = pauseGame(state.value)
      else if (state.value.status === 'paused') state.value = resumeGame(state.value)
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

const displayBoard = computed(() => {
  const board = state.value.board.map((row) => row.slice())
  const current = state.value.current
  if (!current) return board
  const { matrix, x, y, id } = current
  for (let row = 0; row < matrix.length; row += 1) {
    for (let col = 0; col < matrix[row].length; col += 1) {
      if (!matrix[row][col]) continue
      const boardY = y + row
      const boardX = x + col
      if (boardY >= 0 && boardY < state.value.height && boardX >= 0 && boardX < state.value.width) {
        board[boardY][boardX] = id
      }
    }
  }
  return board
})

const statusLabel = computed(() => {
  if (state.value.status === 'ready') return '准备就绪'
  if (state.value.status === 'running') return '进行中'
  if (state.value.status === 'paused') return '已暂停'
  return '游戏结束'
})

const statusType = computed(() => {
  if (state.value.status === 'running') return 'success'
  if (state.value.status === 'paused') return 'warning'
  if (state.value.status === 'ready') return 'info'
  return 'danger'
})

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
    // ignore submit errors
  }
}

watch(
  () => state.value.status,
  (next, prev) => {
    if (next === 'over' && prev !== 'over') {
      submitScore(state.value.score)
    }
  }
)
</script>

<template>
  <ContentWrap>
    <ElCard class="game-card" shadow="never">
      <div class="game-header">
        <div class="game-title">俄罗斯方块</div>
        <div class="game-meta">
          <span>得分：{{ state.score }}</span>
          <span>行数：{{ state.lines }}</span>
          <ElTag :type="statusType" effect="light">{{ statusLabel }}</ElTag>
        </div>
      </div>

      <div class="game-body">
        <div class="game-main">
          <div class="board">
            <div v-for="(row, rowIndex) in displayBoard" :key="rowIndex" class="row">
              <div
                v-for="(cell, colIndex) in row"
                :key="colIndex"
                class="cell"
                :class="`cell-${cell}`"
              ></div>
            </div>
          </div>

          <div class="game-actions">
            <ElButton type="primary" @click="state = startGame(state)">开始</ElButton>
            <ElButton
              @click="state = state.status === 'paused' ? resumeGame(state) : pauseGame(state)"
              :disabled="state.status === 'ready' || state.status === 'over'"
            >
              {{ state.status === 'paused' ? '继续' : '暂停' }}
            </ElButton>
            <ElButton @click="resetGame">重新开始</ElButton>
          </div>

          <div class="game-hint">方向键/WASD 移动，空格硬降，P 暂停，Enter 重新开始。</div>
        </div>

        <div class="game-leaderboard">
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
    </ElCard>
  </ContentWrap>
</template>

<style scoped>
.game-card {
  --cell-size: 22px;
}

.game-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  gap: 12px;
}

.game-title {
  font-size: 18px;
  font-weight: 600;
}

.game-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--el-text-color-regular);
}

.game-body {
  display: flex;
  align-items: flex-start;
  gap: 24px;
}

.game-main {
  display: flex;
  flex-direction: column;
}

.board {
  display: grid;
  gap: 2px;
  padding: 12px;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
}

.row {
  display: grid;
  grid-template-columns: repeat(10, var(--cell-size));
  gap: 2px;
}

.cell {
  width: var(--cell-size);
  height: var(--cell-size);
  background: var(--el-bg-color);
  border-radius: 3px;
}

.cell-1 {
  background: #6ccff6;
}

.cell-2 {
  background: #f6d365;
}

.cell-3 {
  background: #c99bff;
}

.cell-4 {
  background: #7fd1ae;
}

.cell-5 {
  background: #ff9aa2;
}

.cell-6 {
  background: #f4b183;
}

.cell-7 {
  background: #82b1ff;
}

.game-actions {
  display: flex;
  margin-top: 16px;
  gap: 8px;
}

.game-hint {
  margin-top: 12px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.game-leaderboard {
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

@media (width <= 768px) {
  .game-card {
    --cell-size: 18px;
  }

  .game-body {
    flex-direction: column;
  }

  .game-leaderboard {
    width: 100%;
    padding-top: 16px;
    padding-left: 0;
    border-top: 1px solid var(--el-border-color);
    border-left: none;
  }
}
</style>
