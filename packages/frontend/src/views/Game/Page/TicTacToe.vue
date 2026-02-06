<script setup lang="ts">
import { ContentWrap } from '@/components/ContentWrap'
import { computed, onMounted, ref, watch } from 'vue'
import { ElButton, ElCard, ElTable, ElTableColumn, ElTag } from 'element-plus'
import { getGameLeaderboardApi, submitGameScoreApi } from '@/api/game'
import { createGame, pickAiMove, placeMove, startGame, type GameState } from './ticTacToeGame'

defineOptions({
  name: 'GameTicTacToe'
})

const GAME_CODE = 'tictactoe'

const createRng = (seed: number) => {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0xffffffff
  }
}

const seed = ref(Date.now())
const rng = ref(createRng(seed.value))
const state = ref<GameState>(createGame())

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
  state.value = createGame()
}

const handleCellClick = (index: number) => {
  if (state.value.status === 'ready') {
    state.value = startGame(state.value)
  }
  if (state.value.status !== 'running') return
  if (state.value.current !== 'X') return

  const afterPlayer = placeMove(state.value, index, 'X')
  state.value = afterPlayer

  if (afterPlayer.status !== 'running') return

  const aiMove = pickAiMove(afterPlayer.board, rng.value)
  if (aiMove >= 0) {
    state.value = placeMove(afterPlayer, aiMove, 'O')
  }
}

const statusLabel = computed(() => {
  if (state.value.status === 'ready') return '准备就绪'
  if (state.value.status === 'running') return '进行中'
  if (state.value.winner === 'X') return '你赢了'
  if (state.value.winner === 'O') return '你输了'
  if (state.value.winner === 'draw') return '平局'
  return '游戏结束'
})

const statusType = computed(() => {
  if (state.value.status === 'running') return 'success'
  if (state.value.status === 'ready') return 'info'
  return state.value.winner === 'X' ? 'success' : 'danger'
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
    if (next === 'over' && prev !== 'over' && state.value.winner === 'X') {
      submitScore(state.value.score)
    }
  }
)
</script>

<template>
  <ContentWrap>
    <ElCard class="game-card" shadow="never">
      <div class="game-header">
        <div class="game-title">井字棋</div>
        <div class="game-meta">
          <span>胜场：{{ state.score }}</span>
          <ElTag :type="statusType" effect="light">{{ statusLabel }}</ElTag>
        </div>
      </div>

      <div class="game-body">
        <div class="game-main">
          <div class="board">
            <button
              v-for="(cell, index) in state.board"
              :key="index"
              class="board-cell"
              :class="{ filled: !!cell }"
              @click="handleCellClick(index)"
            >
              {{ cell || '' }}
            </button>
          </div>

          <div class="game-actions">
            <ElButton type="primary" @click="state = startGame(state)">开始</ElButton>
            <ElButton @click="resetGame">重新开始</ElButton>
          </div>

          <div class="game-hint">你执 X，电脑执 O。点击格子落子。</div>
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
  --cell-size: 86px;
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
  grid-template-columns: repeat(3, var(--cell-size));
  gap: 8px;
  padding: 12px;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
}

.board-cell {
  width: var(--cell-size);
  height: var(--cell-size);
  font-size: 32px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  cursor: pointer;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
}

.board-cell.filled {
  cursor: default;
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
    --cell-size: 64px;
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
