import request from '@/axios'

export interface SnakeLeaderboardEntry {
  username: string
  displayName: string
  score: number
  updatedAt: string
}

export const getGameLeaderboardApi = (gameCode: string) => {
  return request.get<{ list: SnakeLeaderboardEntry[] }>({
    url: '/api/game/leaderboard',
    params: { game: gameCode }
  })
}

export const submitGameScoreApi = (gameCode: string, score: number) => {
  return request.post<{ list: SnakeLeaderboardEntry[] }>({
    url: '/api/game/score',
    data: { game: gameCode, score }
  })
}
