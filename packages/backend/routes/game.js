const express = require('express')
const router = express.Router()
const { query } = require('../database')

const decodeHeaderValue = (value) => {
  if (!value) return ''
  try {
    return decodeURIComponent(String(value))
  } catch (e) {
    return String(value)
  }
}

const normalizeUsername = (value) => String(value || '').trim()

const getLeaderboard = async (gameCode) => {
  const rows = await query(
    `
    SELECT TOP 10 username, display_name, score, updated_at
    FROM game_leaderboard
    WHERE game_code = @gameCode
    ORDER BY score DESC, updated_at DESC
  `,
    { gameCode }
  )

  return rows.map((row) => ({
    username: row.username,
    displayName: row.display_name || row.username,
    score: row.score,
    updatedAt: row.updated_at
  }))
}

const handleGetLeaderboard = async (req, res) => {
  try {
    const gameCode = String(req.query?.game || '').trim()
    if (!gameCode) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '缺少游戏标识'
      })
    }

    const list = await getLeaderboard(gameCode)
    return res.json({
      code: 0,
      success: true,
      data: {
        list
      }
    })
  } catch (error) {
    console.error('获取贪吃蛇排行榜失败:', error)
    return res.status(500).json({
      code: 500,
      success: false,
      message: '获取排行榜失败: ' + (error.message || '未知错误')
    })
  }
}

router.get('/leaderboard', handleGetLeaderboard)

// Backward-compatible endpoints for old snake routes
router.get('/snake/leaderboard', (req, res) => {
  req.query.game = 'snake'
  return handleGetLeaderboard(req, res)
})

const handleSubmitScore = async (req, res) => {
  try {
    const gameCode = String(req.body?.game || '').trim()
    const username = normalizeUsername(req.headers['x-username'])
    const displayName = decodeHeaderValue(req.headers['x-display-name'])
    const score = Number(req.body?.score)

    if (!gameCode) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '缺少游戏标识'
      })
    }

    if (!username) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '缺少用户信息'
      })
    }

    if (!Number.isFinite(score) || score < 0) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '分数不合法'
      })
    }

    await query(
      `
      MERGE game_leaderboard AS target
      USING (SELECT @gameCode AS game_code, @username AS username, @displayName AS display_name, @score AS score) AS source
      ON target.game_code = source.game_code AND target.username = source.username
      WHEN MATCHED THEN
        UPDATE SET
          display_name = CASE
            WHEN source.display_name IS NOT NULL AND source.display_name <> '' THEN source.display_name
            ELSE target.display_name
          END,
          score = CASE
            WHEN source.score > target.score THEN source.score
            ELSE target.score
          END,
          updated_at = CASE
            WHEN source.score > target.score THEN GETDATE()
            ELSE target.updated_at
          END
      WHEN NOT MATCHED THEN
        INSERT (game_code, username, display_name, score, created_at, updated_at)
        VALUES (source.game_code, source.username, source.display_name, source.score, GETDATE(), GETDATE());
      `,
      {
        gameCode,
        username,
        displayName: displayName || null,
        score
      }
    )

    const list = await getLeaderboard(gameCode)

    return res.json({
      code: 0,
      success: true,
      data: {
        list
      }
    })
  } catch (error) {
    console.error('提交贪吃蛇分数失败:', error)
    return res.status(500).json({
      code: 500,
      success: false,
      message: '提交分数失败: ' + (error.message || '未知错误')
    })
  }
}

router.post('/score', handleSubmitScore)

router.post('/snake/score', (req, res) => {
  req.body = { ...(req.body || {}), game: 'snake' }
  return handleSubmitScore(req, res)
})

module.exports = router
