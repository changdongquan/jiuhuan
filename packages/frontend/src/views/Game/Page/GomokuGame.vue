<script setup lang="ts">
import { ContentWrap } from '@/components/ContentWrap'
import { computed, onMounted, ref, watch } from 'vue'
import { ElButton, ElCard, ElTable, ElTableColumn, ElTag } from 'element-plus'
import { getGameLeaderboardApi, submitGameScoreApi } from '@/api/game'
import {
  createGame,
  createRng,
  pickAiMove,
  placeMove,
  startGame,
  type GameState
} from './gomokuGame'

defineOptions({
  name: 'GameGomoku'
})

const GAME_CODE = 'gomoku'
const BOARD_SIZE = 15

const seed = ref(Date.now())
const rng = ref(createRng(seed.value))
const state = ref<GameState>(createGame(BOARD_SIZE))

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
  state.value = createGame(BOARD_SIZE)
}

const handleCellClick = (x: number, y: number) => {
  if (state.value.status === 'ready') {
    state.value = startGame(state.value)
  }
  if (state.value.status !== 'running') return
  if (state.value.current !== 'black') return

  const afterPlayer = placeMove(state.value, x, y, 'black')
  state.value = afterPlayer
  if (afterPlayer.status !== 'running') return

  const aiMove = pickAiMove(afterPlayer, rng.value)
  if (aiMove.x >= 0) {
    state.value = placeMove(afterPlayer, aiMove.x, aiMove.y, 'white')
  }
}

const statusLabel = computed(() => {
  if (state.value.status === 'ready') return '准备就绪'
  if (state.value.status === 'running') return '进行中'
  if (state.value.winner === 'black') return '你赢了'
  if (state.value.winner === 'white') return '你输了'
  if (state.value.winner === 'draw') return '平局'
  return '游戏结束'
})

const statusType = computed(() => {
  if (state.value.status === 'running') return 'success'
  if (state.value.status === 'ready') return 'info'
  return state.value.winner === 'black' ? 'success' : 'danger'
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

onMounted(() => {
  fetchLeaderboard()
})

watch(
  () => state.value.status,
  (next, prev) => {
    if (next === 'over' && prev !== 'over' && state.value.winner === 'black') {
      submitScore(state.value.score)
    }
  }
)
</script>

<template>
  <ContentWrap>
    <ElCard class="game-card" shadow="never">
      <div class="game-header">
        <div class="game-title">五子棋</div>
        <div class="game-meta">
          <span>胜场：{{ state.score }}</span>
          <ElTag :type="statusType" effect="light">{{ statusLabel }}</ElTag>
        </div>
      </div>

      <div class="game-body">
        <div class="game-main">
          <div class="board">
            <div v-for="(row, y) in state.board" :key="y" class="board-row">
              <button
                v-for="(cell, x) in row"
                :key="`${x}-${y}`"
                class="board-cell"
                :class="{ black: cell === 'black', white: cell === 'white' }"
                @click="handleCellClick(x, y)"
              >
                <span v-if="cell" class="stone" />
              </button>
            </div>
          </div>

          <div class="game-actions">
            <ElButton type="primary" @click="state = startGame(state)">开始</ElButton>
            <ElButton @click="resetGame">重新开始</ElButton>
          </div>

          <div class="game-hint">你执黑先行，电脑执白。点击棋盘落子。</div>
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
            <ElTableColumn prop="score" label="胜场" width="80" />
          </ElTable>
        </div>
      </div>
    </ElCard>
  </ContentWrap>
</template>

<style scoped>
.game-card {
  --cell-size: 28px;
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
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 12px;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
}

.board-row {
  display: flex;
  gap: 2px;
}

.board-cell {
  display: flex;
  width: var(--cell-size);
  height: var(--cell-size);
  padding: 0;
  cursor: pointer;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  align-items: center;
  justify-content: center;
}

.board-cell.black {
  background: #2d2d2d;
}

.board-cell.white {
  background: #f2f2f2;
}

.stone {
  width: calc(var(--cell-size) - 8px);
  height: calc(var(--cell-size) - 8px);
  background: currentcolor;
  border-radius: 999px;
}

.board-cell.black .stone {
  color: #121212;
}

.board-cell.white .stone {
  color: #fff;
  border: 1px solid #d9d9d9;
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
    --cell-size: 22px;
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
