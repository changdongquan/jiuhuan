const express = require('express')
const {
  listReviewActions,
  upsertReviewAction,
  getUserActionKeys,
  addUserActionKeys,
  removeUserActionKeys,
  getGroupActionKeys,
  addGroupActionKeys,
  removeGroupActionKeys
} = require('../services/reviewAcl')

const router = express.Router()

router.get('/actions', async (req, res) => {
  try {
    const includeDisabled = String(req.query.includeDisabled || '1') !== '0'
    const rows = await listReviewActions({ includeDisabled })
    return res.json({ code: 0, success: true, data: rows })
  } catch (error) {
    console.error('获取审核动作列表失败:', error)
    return res.status(500).json({ code: 500, success: false, message: '获取审核动作列表失败' })
  }
})

router.post('/actions/upsert', async (req, res) => {
  try {
    const { actionKey, actionName, moduleCode, enabled } = req.body || {}
    await upsertReviewAction({ actionKey, actionName, moduleCode, enabled })
    return res.json({ code: 0, success: true, message: '保存审核动作成功' })
  } catch (error) {
    console.error('保存审核动作失败:', error)
    return res.status(400).json({
      code: 400,
      success: false,
      message: '保存审核动作失败: ' + (error?.message || '未知错误')
    })
  }
})

router.get('/user/:username', async (req, res) => {
  try {
    const { username } = req.params
    const data = await getUserActionKeys(username)
    return res.json({ code: 0, success: true, data })
  } catch (error) {
    console.error('获取用户审核权限失败:', error)
    return res.status(500).json({ code: 500, success: false, message: '获取用户审核权限失败' })
  }
})

router.post('/user/:username/assign', async (req, res) => {
  try {
    const { username } = req.params
    const { actionKeys } = req.body || {}
    if (!Array.isArray(actionKeys) || !actionKeys.length) {
      return res.status(400).json({ code: 400, success: false, message: 'actionKeys 不能为空' })
    }
    await addUserActionKeys(username, actionKeys)
    return res.json({ code: 0, success: true, message: '用户审核权限分配成功' })
  } catch (error) {
    console.error('分配用户审核权限失败:', error)
    return res.status(500).json({ code: 500, success: false, message: '分配用户审核权限失败' })
  }
})

router.delete('/user/:username/remove', async (req, res) => {
  try {
    const { username } = req.params
    const { actionKeys } = req.body || {}
    if (!Array.isArray(actionKeys) || !actionKeys.length) {
      return res.status(400).json({ code: 400, success: false, message: 'actionKeys 不能为空' })
    }
    await removeUserActionKeys(username, actionKeys)
    return res.json({ code: 0, success: true, message: '用户审核权限移除成功' })
  } catch (error) {
    console.error('移除用户审核权限失败:', error)
    return res.status(500).json({ code: 500, success: false, message: '移除用户审核权限失败' })
  }
})

router.get('/group/:groupDn', async (req, res) => {
  try {
    const { groupDn } = req.params
    const data = await getGroupActionKeys(groupDn)
    return res.json({ code: 0, success: true, data })
  } catch (error) {
    console.error('获取组审核权限失败:', error)
    return res.status(500).json({ code: 500, success: false, message: '获取组审核权限失败' })
  }
})

router.post('/group/:groupDn/assign', async (req, res) => {
  try {
    const { groupDn } = req.params
    const { actionKeys, groupName } = req.body || {}
    if (!Array.isArray(actionKeys) || !actionKeys.length) {
      return res.status(400).json({ code: 400, success: false, message: 'actionKeys 不能为空' })
    }
    await addGroupActionKeys(groupDn, groupName, actionKeys)
    return res.json({ code: 0, success: true, message: '组审核权限分配成功' })
  } catch (error) {
    console.error('分配组审核权限失败:', error)
    return res.status(500).json({ code: 500, success: false, message: '分配组审核权限失败' })
  }
})

router.delete('/group/:groupDn/remove', async (req, res) => {
  try {
    const { groupDn } = req.params
    const { actionKeys } = req.body || {}
    if (!Array.isArray(actionKeys) || !actionKeys.length) {
      return res.status(400).json({ code: 400, success: false, message: 'actionKeys 不能为空' })
    }
    await removeGroupActionKeys(groupDn, actionKeys)
    return res.json({ code: 0, success: true, message: '组审核权限移除成功' })
  } catch (error) {
    console.error('移除组审核权限失败:', error)
    return res.status(500).json({ code: 500, success: false, message: '移除组审核权限失败' })
  }
})

module.exports = router
