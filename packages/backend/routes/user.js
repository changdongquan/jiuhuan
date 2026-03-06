const express = require('express')
const fs = require('fs')
const path = require('path')
let ldap = null
try {
  ldap = require('ldapjs')
} catch (_e) {
  ldap = null
}

const router = express.Router()

const LOCAL_USERS_FILE = path.join(__dirname, '..', 'local-users.json')
const LOCAL_USERS_EXAMPLE_FILE = path.join(__dirname, '..', 'local-users.json.example')

const isDev =
  process.env.NODE_ENV === 'development' || !process.env.NODE_ENV || process.env.NODE_ENV === 'dev'

const LDAP_CONFIG = {
  url: process.env.LDAP_URL || 'ldap://AD2016-1.jiuhuan.local:389',
  baseDN: process.env.LDAP_BASE_DN || 'DC=JIUHUAN,DC=LOCAL',
  bindDN: process.env.LDAP_BIND_DN,
  bindPassword: process.env.LDAP_BIND_PASSWORD
}

const escapeLdapFilter = (str) => {
  if (!str) return ''
  return String(str)
    .replace(/\\/g, '\\5c')
    .replace(/\*/g, '\\2a')
    .replace(/\(/g, '\\28')
    .replace(/\)/g, '\\29')
    .replace(/\//g, '\\2f')
    .replace(/\0/g, '\\00')
}

const normalizeSam = (value) => {
  const raw = String(value || '').trim()
  if (!raw) return ''
  return raw.split('\\').pop().split('@')[0].trim()
}

const fetchAdDisplayName = async (username) => {
  if (!ldap) return null
  const sam = normalizeSam(username)
  if (!sam) return null

  const client = ldap.createClient({ url: LDAP_CONFIG.url })
  client.on('error', () => {})

  try {
    if (LDAP_CONFIG.bindDN && LDAP_CONFIG.bindPassword) {
      await new Promise((resolve, reject) => {
        client.bind(LDAP_CONFIG.bindDN, LDAP_CONFIG.bindPassword, (err) => {
          if (err) return reject(err)
          resolve()
        })
      })
    }

    const escapedSam = escapeLdapFilter(sam)
    const entries = await new Promise((resolve, reject) => {
      const rows = []
      client.search(
        LDAP_CONFIG.baseDN,
        {
          filter: `(&(objectClass=user)(!(objectClass=computer))(sAMAccountName=${escapedSam}))`,
          scope: 'sub',
          attributes: ['displayName', 'cn'],
          sizeLimit: 5,
          timeLimit: 8
        },
        (err, res) => {
          if (err) return reject(err)
          res.on('searchEntry', (entry) => {
            const obj = entry?.object || (typeof entry?.toObject === 'function' ? entry.toObject() : null)
            if (obj) rows.push(obj)
          })
          res.on('error', reject)
          res.on('end', (result) => {
            if (result?.status && result.status !== 0) {
              return reject(new Error(`LDAP 搜索失败: ${result.status}`))
            }
            resolve(rows)
          })
        }
      )
    })

    const row = Array.isArray(entries) ? entries[0] : null
    const displayName = String(row?.displayName || row?.cn || '').trim()
    return displayName || null
  } catch (_e) {
    return null
  } finally {
    try {
      client.unbind(() => {})
    } catch (_e) {
      // ignore
    }
  }
}

function readLocalUsers() {
  try {
    // 如果文件不存在，尝试从示例文件复制
    if (!fs.existsSync(LOCAL_USERS_FILE)) {
      if (fs.existsSync(LOCAL_USERS_EXAMPLE_FILE)) {
        try {
          const exampleContent = fs.readFileSync(LOCAL_USERS_EXAMPLE_FILE, 'utf-8')
          fs.writeFileSync(LOCAL_USERS_FILE, exampleContent, 'utf-8')
          console.log('[LocalUser] 已从示例文件创建 local-users.json')
        } catch (e) {
          console.warn('[LocalUser] 从示例文件创建失败:', e.message)
        }
      }
    }

    const content = fs.readFileSync(LOCAL_USERS_FILE, 'utf-8')
    return JSON.parse(content || '{}')
  } catch (e) {
    if (isDev) {
      console.warn('[LocalUser] 读取 local-users.json 失败，将使用空对象:', e.message)
    }
    return {}
  }
}

function writeLocalUsers(users) {
  fs.writeFileSync(LOCAL_USERS_FILE, JSON.stringify(users, null, 2), 'utf-8')
}

function isDomainUserFromHeader(req) {
  const username = req.headers['x-username'] || ''
  if (!username) return false
  return username.includes('\\') || username.includes('@')
}

function getCurrentLocalUser(req) {
  const username = req.headers['x-username'] || ''
  if (!username) return null
  if (isDomainUserFromHeader(req)) return null

  const users = readLocalUsers()
  const key = Object.keys(users).find((k) => k.toLowerCase() === username.toLowerCase())
  if (!key) return null
  return { key, user: users[key] }
}

router.get('/profile', (req, res) => {
  if (isDomainUserFromHeader(req)) {
    return res.status(400).json({
      code: 400,
      success: false,
      message: '域用户信息由域系统维护，不能在此修改'
    })
  }

  const current = getCurrentLocalUser(req)
  if (!current) {
    return res.status(404).json({
      code: 404,
      success: false,
      message: '未找到本地用户信息'
    })
  }

  const { key, user } = current

  return res.json({
    code: 0,
    success: true,
    data: {
      username: key,
      realName: user.displayName || key,
      displayName: user.displayName || key,
      email: user.email || '',
      phoneNumber: user.phoneNumber || '',
      role: user.role || 'user',
      roleId: user.roleId || '3'
    }
  })
})

router.get('/display-name', async (req, res) => {
  const username = String(req?.auth?.username || req?.headers?.['x-username'] || '').trim()
  const authDisplayName = String(req?.auth?.displayName || '').trim()
  if (!username) {
    return res.status(400).json({ code: 400, success: false, message: '缺少用户信息' })
  }

  const adDisplayName = await fetchAdDisplayName(username)
  const displayName = adDisplayName || authDisplayName || normalizeSam(username) || username
  return res.json({
    code: 0,
    success: true,
    data: {
      username,
      displayName
    }
  })
})

router.put('/profile', (req, res) => {
  if (isDomainUserFromHeader(req)) {
    return res.status(400).json({
      code: 400,
      success: false,
      message: '域用户基本信息由域系统维护，不能在此修改'
    })
  }

  const current = getCurrentLocalUser(req)
  if (!current) {
    return res.status(404).json({
      code: 404,
      success: false,
      message: '未找到本地用户信息'
    })
  }

  const { key, user } = current
  const { realName, displayName, email, phoneNumber } = req.body || {}

  const users = readLocalUsers()
  users[key] = {
    ...user,
    displayName: displayName || realName || user.displayName || key,
    email: typeof email === 'string' ? email : user.email || '',
    phoneNumber: typeof phoneNumber === 'string' ? phoneNumber : user.phoneNumber || ''
  }
  writeLocalUsers(users)

  return res.json({
    code: 0,
    success: true,
    message: '基本信息已更新',
    data: {
      username: key,
      realName: users[key].displayName || key,
      displayName: users[key].displayName || key,
      email: users[key].email || '',
      phoneNumber: users[key].phoneNumber || '',
      role: users[key].role || 'user',
      roleId: users[key].roleId || '3'
    }
  })
})

router.post('/change-password', (req, res) => {
  if (isDomainUserFromHeader(req)) {
    return res.status(400).json({
      code: 400,
      success: false,
      message: '域用户密码需在域账号系统中修改，不能在此修改'
    })
  }

  const current = getCurrentLocalUser(req)
  if (!current) {
    return res.status(404).json({
      code: 404,
      success: false,
      message: '未找到本地用户信息'
    })
  }

  const { key, user } = current
  const { oldPassword, newPassword } = req.body || {}

  if (!oldPassword || !newPassword) {
    return res.status(400).json({
      code: 400,
      success: false,
      message: '旧密码和新密码不能为空'
    })
  }

  if (String(oldPassword) !== String(user.password || '')) {
    return res.status(400).json({
      code: 400,
      success: false,
      message: '旧密码不正确'
    })
  }

  const users = readLocalUsers()
  users[key] = {
    ...user,
    password: String(newPassword)
  }
  writeLocalUsers(users)

  return res.json({
    code: 0,
    success: true,
    message: '密码修改成功，请使用新密码重新登录'
  })
})

module.exports = router
