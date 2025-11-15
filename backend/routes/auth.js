const express = require('express')
const router = express.Router()
const { query } = require('../database')

// 检测是否是开发环境
const isDev =
  process.env.NODE_ENV === 'development' || !process.env.NODE_ENV || process.env.NODE_ENV === 'dev'

// 尝试动态加载 ldapjs（用于域用户验证）
let ldap = null
try {
  ldap = require('ldapjs')
} catch (e) {
  // ldapjs 未安装，将使用模拟验证（仅开发环境）
  if (!isDev) {
    console.warn('警告: ldapjs 未安装，域用户登录功能将不可用')
  }
}

// LDAP 配置（生产环境需要配置）
const LDAP_CONFIG = {
  url: process.env.LDAP_URL || 'ldap://AD2016-1.jiuhuan.local:389',
  baseDN: process.env.LDAP_BASE_DN || 'DC=JIUHUAN,DC=LOCAL',
  bindDN: process.env.LDAP_BIND_DN, // 可选：服务账号
  bindPassword: process.env.LDAP_BIND_PASSWORD // 可选：服务账号密码
}

// 默认域配置（域外用户可以直接输入用户名，无需前缀）
const DEFAULT_DOMAIN = process.env.DEFAULT_DOMAIN || 'jiuhuan.local'

// 本地账号白名单（这些账号优先作为本地账号处理，不使用域验证）
const LOCAL_ACCOUNTS = ['admin']

/**
 * 解析用户名格式
 * 支持：
 * - domain\username (域用户，显式指定域)
 * - username@domain.com (域用户，UPN 格式)
 * - username (纯用户名)
 *   - 如果在本地账号白名单中 → 本地账号
 *   - 如果不在白名单中，且配置了默认域 → 域用户（使用默认域）
 *   - 如果不在白名单中，且没有默认域 → 本地账号
 */
function parseUsername(input) {
  if (!input) return { username: null, domain: null, isDomainUser: false }

  // 格式：domain\username
  // 尝试多种方式匹配反斜杠
  // 1. 直接检查是否包含反斜杠字符（字面反斜杠）
  const backslashIndex = input.indexOf('\\')
  if (backslashIndex > 0 && backslashIndex < input.length - 1) {
    // 找到了反斜杠，分割用户名和域名
    const domain = input.substring(0, backslashIndex)
    const username = input.substring(backslashIndex + 1)
    return {
      username: username,
      domain: domain,
      isDomainUser: true,
      fullUsername: input
    }
  }

  // 2. 使用正则表达式匹配（处理转义情况）
  const backslashMatch = input.match(/^([^\\]+)\\([^\\]+)$/)
  if (backslashMatch) {
    return {
      username: backslashMatch[2],
      domain: backslashMatch[1],
      isDomainUser: true,
      fullUsername: input
    }
  }

  // 格式：username@domain.com
  if (input.includes('@')) {
    const parts = input.split('@')
    return {
      username: parts[0],
      domain: parts[1],
      isDomainUser: true,
      fullUsername: input
    }
  }

  // 纯用户名（无 \ 和 @）
  // 检查是否在本地账号白名单中（不区分大小写）
  const usernameLower = input.toLowerCase()
  if (LOCAL_ACCOUNTS.some((account) => account.toLowerCase() === usernameLower)) {
    // 在白名单中，作为本地账号处理
    return {
      username: input,
      domain: null,
      isDomainUser: false,
      fullUsername: input
    }
  }

  // 不在白名单中，如果配置了默认域，作为域用户处理
  if (DEFAULT_DOMAIN) {
    return {
      username: input,
      domain: DEFAULT_DOMAIN,
      isDomainUser: true,
      fullUsername: `${input}@${DEFAULT_DOMAIN}`
    }
  }

  // 没有配置默认域，作为普通账号处理
  return {
    username: input,
    domain: null,
    isDomainUser: false,
    fullUsername: input
  }
}

/**
 * LDAP 验证域用户（生产环境）
 */
async function verifyDomainUser(username, password, domain) {
  if (!ldap) {
    throw new Error('LDAP 库未安装')
  }

  return new Promise((resolve, reject) => {
    const client = ldap.createClient({
      url: LDAP_CONFIG.url
    })

    // 构建用户 DN（Distinguished Name）
    // 格式：CN=username,CN=Users,DC=domain,DC=com
    const userDN = `CN=${username},CN=Users,${LDAP_CONFIG.baseDN}`
    // 或者尝试 UPN 格式：username@domain.com
    const upn = domain
      ? `${username}@${domain}`
      : `${username}@${LDAP_CONFIG.baseDN.replace(/DC=/g, '').replace(/,/g, '.')}`

    // 尝试绑定（验证密码）
    client.bind(upn, password, (err) => {
      client.unbind(() => {}) // 关闭连接

      if (err) {
        // 如果 UPN 失败，尝试 userDN
        const client2 = ldap.createClient({ url: LDAP_CONFIG.url })
        client2.bind(userDN, password, (err2) => {
          client2.unbind(() => {})

          if (err2) {
            reject(new Error('域用户验证失败: ' + (err2.message || '用户名或密码错误')))
          } else {
            resolve({ username, domain, isValid: true })
          }
        })
      } else {
        resolve({ username, domain, isValid: true })
      }
    })
  })
}

/**
 * 模拟 LDAP 验证（开发环境）
 */
async function mockVerifyDomainUser(username, password) {
  // 开发环境：模拟验证逻辑
  // 这里可以设置一些测试账号
  const mockDomainUsers = {
    changdq: 'password123', // 域用户测试账号（使用默认域）
    testuser: 'password123', // 支持 username 格式（最常用）
    'domain\\testuser': 'password123', // 支持 domain\username 格式
    'testuser@domain.com': 'password123', // 支持 username@domain.com 格式
    'changdq@jiuhuan.local': 'password123' // 支持默认域格式
  }

  console.log('[域用户验证] 开始验证:', {
    username,
    passwordLength: password ? password.length : 0
  })

  // 尝试多种匹配方式
  let matchedKey = null

  // 1. 直接匹配 username（最优先）
  if (mockDomainUsers[username]) {
    matchedKey = username
    console.log('[域用户验证] 直接匹配成功:', { username, matchedKey })
  }
  // 2. 匹配用户名部分（提取用户名进行匹配）
  else {
    // 尝试匹配用户名部分（去掉域名后的部分）
    matchedKey = Object.keys(mockDomainUsers).find((k) => {
      // 提取用户名部分
      let kUsername = k
      if (k.includes('\\')) {
        const parts = k.split('\\')
        kUsername = parts[parts.length - 1] // 取最后一部分
      } else if (k.includes('@')) {
        kUsername = k.split('@')[0]
      }

      const usernameLower = username.toLowerCase()
      const kUsernameLower = kUsername.toLowerCase()

      // 精确匹配用户名部分
      if (kUsernameLower === usernameLower) {
        console.log('[域用户验证] 用户名部分匹配:', { k, kUsername, username })
        return true
      }
      return false
    })
  }

  if (matchedKey && mockDomainUsers[matchedKey] === password) {
    console.log('[域用户验证] 验证成功:', { username, matchedKey, passwordMatch: true })
    return { username, domain: 'DOMAIN', isValid: true }
  }

  console.log('[域用户验证] 验证失败:', {
    username,
    matchedKey,
    passwordMatch: matchedKey ? mockDomainUsers[matchedKey] === password : false,
    availableKeys: Object.keys(mockDomainUsers),
    expectedPassword: matchedKey ? mockDomainUsers[matchedKey] : null
  })
  throw new Error('域用户验证失败: 用户名或密码错误（开发模式）')
}

/**
 * 验证普通账号（从数据库查询）
 */
async function verifyLocalUser(username, password) {
  try {
    // 这里假设有一个用户表，如果没有可以先从员工表查询
    // 先检查是否有专门的用户表
    let result = null

    try {
      // 尝试查询用户表（如果存在）
      result = await query(
        `
        SELECT username, password, role, roleId 
        FROM users 
        WHERE username = @username AND password = @password
      `,
        { username, password }
      )
    } catch (e) {
      // 如果没有用户表，检查是否是 admin（硬编码验证）
      if (username === 'admin' && password === 'admin') {
        return {
          username: 'admin',
          role: 'admin',
          roleId: '1',
          isValid: true
        }
      }
      throw new Error('用户名或密码错误')
    }

    if (result && result.length > 0) {
      return {
        username: result[0].username,
        role: result[0].role,
        roleId: result[0].roleId,
        isValid: true
      }
    }

    throw new Error('用户名或密码错误')
  } catch (error) {
    throw new Error(error.message || '验证失败')
  }
}

/**
 * 自动登录接口 - 从 Apache 传递的头部读取域用户名
 * GET /api/auth/auto-login
 */
router.get('/auto-login', (req, res) => {
  // 开发环境：返回模拟数据
  if (isDev) {
    console.log('[DEV] 模拟自动登录，返回测试用户')
    return res.json({
      code: 0,
      success: true,
      data: {
        username: 'dev-user',
        displayName: '开发测试用户',
        domain: 'DEV',
        roles: [],
        role: 'test',
        roleId: '2'
      },
      token: 'DEV_AUTO_LOGIN'
    })
  }

  // 生产环境：从 Apache 传递的头部读取真实域用户
  console.log('[SSO] 收到自动登录请求头:', {
    'x-remote-user': req.headers['x-remote-user'],
    'remote-user': req.headers['remote-user'],
    authorization: req.headers.authorization,
    host: req.headers.host,
    'user-agent': req.headers['user-agent']
  })
  const remoteUser = req.headers['x-remote-user'] || req.headers['remote-user']

  if (!remoteUser) {
    // 返回 401，但使用特殊的错误码，让前端知道这是正常的 SSO 失败（不在域环境中）
    return res.status(401).json({
      code: 401,
      success: false,
      message: '未获取到域用户信息，请确保已配置 Apache Kerberos 认证',
      // 标记为 SSO 失败，前端可以据此判断是否显示错误提示
      ssoFailed: true
    })
  }

  // 解析用户名
  const parsed = parseUsername(remoteUser)

  res.json({
    code: 0,
    success: true,
    data: {
      username: parsed.username,
      displayName: parsed.username,
      domain: parsed.domain || null,
      roles: [],
      role: 'user',
      roleId: '3'
    },
    token: 'SSO_AUTO_LOGIN'
  })
})

/**
 * 手动登录接口 - 支持普通账号和域用户
 * POST /api/auth/login
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body

    // 开发环境调试日志
    if (isDev) {
      console.log('[登录请求] 收到登录请求:', {
        username,
        usernameType: typeof username,
        usernameLength: username ? username.length : 0,
        usernameCharCodes: username ? Array.from(username).map((c) => c.charCodeAt(0)) : [],
        passwordLength: password ? password.length : 0,
        body: req.body,
        rawBody: JSON.stringify(req.body)
      })
    }

    if (!username || !password) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '用户名和密码不能为空'
      })
    }

    // 解析用户名格式
    const parsed = parseUsername(username)

    // 开发环境调试日志
    if (isDev) {
      console.log('[登录] 用户名解析:', {
        input: username,
        inputCharCodes: Array.from(username).map((c) => c.charCodeAt(0)),
        parsed: parsed
      })
    }

    let userInfo = null

    if (parsed.isDomainUser) {
      // 域用户：通过 LDAP 验证
      try {
        if (isDev) {
          // 开发环境：模拟验证
          console.log('[登录] 开始域用户验证:', {
            parsedUsername: parsed.username,
            parsedDomain: parsed.domain,
            password: password
          })
          const verified = await mockVerifyDomainUser(parsed.username, password)
          userInfo = {
            username: parsed.fullUsername,
            displayName: parsed.username,
            domain: parsed.domain,
            roles: [],
            role: 'user',
            roleId: '3',
            isValid: true
          }
        } else {
          // 生产环境：真实 LDAP 验证
          await verifyDomainUser(parsed.username, password, parsed.domain)
          userInfo = {
            username: parsed.fullUsername,
            displayName: parsed.username,
            domain: parsed.domain,
            roles: [],
            role: 'user',
            roleId: '3',
            isValid: true
          }
        }
      } catch (error) {
        return res.status(401).json({
          code: 401,
          success: false,
          message: error.message || '域用户验证失败'
        })
      }
    } else {
      // 普通账号：从数据库验证
      try {
        const verified = await verifyLocalUser(username, password)
        userInfo = {
          username: verified.username,
          displayName: verified.username,
          domain: null,
          roles: [],
          role: verified.role || 'user',
          roleId: verified.roleId || '3',
          isValid: true
        }
      } catch (error) {
        return res.status(401).json({
          code: 401,
          success: false,
          message: error.message || '用户名或密码错误'
        })
      }
    }

    // 返回用户信息和 token
    res.json({
      code: 0,
      success: true,
      data: userInfo,
      token: parsed.isDomainUser ? 'DOMAIN_LOGIN' : 'LOCAL_LOGIN'
    })
  } catch (error) {
    console.error('登录失败:', error)
    res.status(500).json({
      code: 500,
      success: false,
      message: '登录处理失败: ' + error.message
    })
  }
})

module.exports = router
