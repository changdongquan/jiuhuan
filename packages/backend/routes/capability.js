const express = require('express')
const { requireAdmin } = require('../middleware/auth')
const { recordPermissionAudit } = require('../services/permissionAudit')
const {
  listCapabilities,
  addUserCapabilityKeys,
  removeUserCapabilityKeys,
  getGroupCapabilityKeys,
  addGroupCapabilityKeys,
  removeGroupCapabilityKeys,
  getEffectiveCapabilityKeys
} = require('../services/capabilityAccess')

const router = express.Router()

router.use(requireAdmin)

const resolveOperator = (req) => {
  const username = String(req?.auth?.username || req?.headers?.['x-username'] || '').trim()
  const displayName = String(req?.auth?.displayName || '').trim() || username
  return { username, displayName }
}

router.get('/actions', async (req, res) => {
  try {
    const includeDisabled = String(req.query.includeDisabled || '1') !== '0'
    const rows = await listCapabilities({ includeDisabled })
    return res.json({ code: 0, success: true, data: rows })
  } catch (error) {
    console.error('获取模块能力列表失败:', error)
    return res.status(500).json({ code: 500, success: false, message: '获取模块能力列表失败' })
  }
})

router.get('/user/:username', async (req, res) => {
  try {
    const { username } = req.params
    const data = await getEffectiveCapabilityKeys(username)
    return res.json({ code: 0, success: true, data })
  } catch (error) {
    console.error('获取用户模块能力失败:', error)
    return res.status(500).json({ code: 500, success: false, message: '获取用户模块能力失败' })
  }
})

router.post('/user/:username/assign', async (req, res) => {
  try {
    const { username } = req.params
    const { capabilityKeys } = req.body || {}
    if (!Array.isArray(capabilityKeys) || !capabilityKeys.length) {
      return res.status(400).json({ code: 400, success: false, message: 'capabilityKeys 不能为空' })
    }
    await addUserCapabilityKeys(username, capabilityKeys)
    const operator = resolveOperator(req)
    await recordPermissionAudit({
      actionType: 'ASSIGN_USER_CAPABILITY',
      moduleCode: 'CAPABILITY',
      targetType: 'USER',
      targetKey: username,
      detail: { capabilityKeys },
      operatorUsername: operator.username,
      operatorDisplayName: operator.displayName
    })
    return res.json({ code: 0, success: true, message: '用户模块能力分配成功' })
  } catch (error) {
    console.error('分配用户模块能力失败:', error)
    return res.status(500).json({ code: 500, success: false, message: '分配用户模块能力失败' })
  }
})

router.delete('/user/:username/remove', async (req, res) => {
  try {
    const { username } = req.params
    const { capabilityKeys } = req.body || {}
    if (!Array.isArray(capabilityKeys) || !capabilityKeys.length) {
      return res.status(400).json({ code: 400, success: false, message: 'capabilityKeys 不能为空' })
    }
    await removeUserCapabilityKeys(username, capabilityKeys)
    const operator = resolveOperator(req)
    await recordPermissionAudit({
      actionType: 'REMOVE_USER_CAPABILITY',
      moduleCode: 'CAPABILITY',
      targetType: 'USER',
      targetKey: username,
      detail: { capabilityKeys },
      operatorUsername: operator.username,
      operatorDisplayName: operator.displayName
    })
    return res.json({ code: 0, success: true, message: '用户模块能力移除成功' })
  } catch (error) {
    console.error('移除用户模块能力失败:', error)
    return res.status(500).json({ code: 500, success: false, message: '移除用户模块能力失败' })
  }
})

router.get('/group/:groupDn', async (req, res) => {
  try {
    const { groupDn } = req.params
    const data = await getGroupCapabilityKeys(groupDn)
    return res.json({ code: 0, success: true, data })
  } catch (error) {
    console.error('获取组模块能力失败:', error)
    return res.status(500).json({ code: 500, success: false, message: '获取组模块能力失败' })
  }
})

router.post('/group/:groupDn/assign', async (req, res) => {
  try {
    const { groupDn } = req.params
    const { capabilityKeys, groupName } = req.body || {}
    if (!Array.isArray(capabilityKeys) || !capabilityKeys.length) {
      return res.status(400).json({ code: 400, success: false, message: 'capabilityKeys 不能为空' })
    }
    await addGroupCapabilityKeys(groupDn, groupName, capabilityKeys)
    const operator = resolveOperator(req)
    await recordPermissionAudit({
      actionType: 'ASSIGN_GROUP_CAPABILITY',
      moduleCode: 'CAPABILITY',
      targetType: 'GROUP',
      targetKey: groupDn,
      detail: { groupName, capabilityKeys },
      operatorUsername: operator.username,
      operatorDisplayName: operator.displayName
    })
    return res.json({ code: 0, success: true, message: '组模块能力分配成功' })
  } catch (error) {
    console.error('分配组模块能力失败:', error)
    return res.status(500).json({ code: 500, success: false, message: '分配组模块能力失败' })
  }
})

router.delete('/group/:groupDn/remove', async (req, res) => {
  try {
    const { groupDn } = req.params
    const { capabilityKeys } = req.body || {}
    if (!Array.isArray(capabilityKeys) || !capabilityKeys.length) {
      return res.status(400).json({ code: 400, success: false, message: 'capabilityKeys 不能为空' })
    }
    await removeGroupCapabilityKeys(groupDn, capabilityKeys)
    const operator = resolveOperator(req)
    await recordPermissionAudit({
      actionType: 'REMOVE_GROUP_CAPABILITY',
      moduleCode: 'CAPABILITY',
      targetType: 'GROUP',
      targetKey: groupDn,
      detail: { capabilityKeys },
      operatorUsername: operator.username,
      operatorDisplayName: operator.displayName
    })
    return res.json({ code: 0, success: true, message: '组模块能力移除成功' })
  } catch (error) {
    console.error('移除组模块能力失败:', error)
    return res.status(500).json({ code: 500, success: false, message: '移除组模块能力失败' })
  }
})

router.get('/effective/:username', async (req, res) => {
  try {
    const data = await getEffectiveCapabilityKeys(req.params.username)
    return res.json({ code: 0, success: true, data })
  } catch (error) {
    console.error('获取用户生效模块能力失败:', error)
    return res.status(500).json({ code: 500, success: false, message: '获取用户生效模块能力失败' })
  }
})

module.exports = router
