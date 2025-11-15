const express = require('express')
const router = express.Router()
const { query } = require('../database')

// 尝试动态加载 ldapjs（用于域用户验证）
let ldap = null
try {
  ldap = require('ldapjs')
} catch (e) {
  // ldapjs 未安装
}

// LDAP 配置（从环境变量或默认值）
const LDAP_CONFIG = {
  url: process.env.LDAP_URL || 'ldap://AD2016-1.jiuhuan.local:389',
  baseDN: process.env.LDAP_BASE_DN || 'DC=JIUHUAN,DC=LOCAL',
  bindDN: process.env.LDAP_BIND_DN, // 可选：服务账号
  bindPassword: process.env.LDAP_BIND_PASSWORD // 可选：服务账号密码
}

// 检测是否是开发环境
const isDev =
  process.env.NODE_ENV === 'development' || !process.env.NODE_ENV || process.env.NODE_ENV === 'dev'

/**
 * 获取所有权限列表（树形结构）
 * GET /api/permission/list
 */
router.get('/list', async (req, res) => {
  try {
    const permissions = await query(`
      SELECT 
        id,
        route_name,
        route_path,
        page_title,
        parent_route
      FROM permissions
      ORDER BY parent_route, page_title
    `)

    res.json({
      code: 0,
      success: true,
      data: permissions
    })
  } catch (error) {
    console.error('获取权限列表失败:', error)
    res.status(500).json({
      code: 500,
      success: false,
      message: '获取权限列表失败: ' + error.message
    })
  }
})

/**
 * 获取用户的所有权限（包含直接权限和组权限）
 * GET /api/permission/user/:username
 */
router.get('/user/:username', async (req, res) => {
  try {
    const { username } = req.params

    // admin 拥有所有权限
    if (username === 'admin') {
      const allPermissions = await query(`
        SELECT route_name FROM permissions
      `)
      return res.json({
        code: 0,
        success: true,
        data: allPermissions.map((p) => p.route_name)
      })
    }

    // 查询用户直接分配的权限
    const userPermissions = await query(
      `
      SELECT DISTINCT p.route_name
      FROM permissions p
      INNER JOIN user_permissions up ON p.id = up.permission_id
      WHERE up.username = @username
    `,
      { username }
    )

    // 查询用户所属组，然后查询组权限
    let groupPermissions = []
    try {
      // 查询用户所属组（通过 AD API 或直接查询）
      if (ldap) {
        const client = await createLdapClient()
        try {
          const userFilter = `(sAMAccountName=${username})`
          const userEntries = await ldapSearch(client, LDAP_CONFIG.baseDN, userFilter, ['memberOf'])

          if (userEntries.length > 0 && userEntries[0].memberOf) {
            const memberOf = Array.isArray(userEntries[0].memberOf)
              ? userEntries[0].memberOf
              : [userEntries[0].memberOf]

            // 查询每个组的权限
            if (memberOf.length > 0) {
              try {
                // 构建参数化查询
                const params = {}
                const placeholders = memberOf
                  .map((dn, i) => {
                    const key = `groupDn${i}`
                    params[key] = dn
                    return `@${key}`
                  })
                  .join(',')

                // 查询组权限（使用 group_dn）
                const groupPerms = await query(
                  `
                  SELECT DISTINCT p.route_name
                  FROM permissions p
                  INNER JOIN group_permissions gp ON p.id = gp.permission_id
                  WHERE gp.group_dn IN (${placeholders})
                `,
                  params
                )

                groupPermissions = groupPerms.map((p) => p.route_name)
              } catch (err) {
                console.warn('查询组权限失败（继续使用直接权限）:', err.message)
              }
            }
          }
          client.unbind(() => {})
        } catch (error) {
          client.unbind(() => {})
          console.warn('查询用户所属组失败（继续使用直接权限）:', error.message)
        }
      }
    } catch (error) {
      console.warn('查询组权限失败（继续使用直接权限）:', error.message)
    }

    // 合并直接权限和组权限（去重）
    const allPermissions = [
      ...new Set([...userPermissions.map((p) => p.route_name), ...groupPermissions])
    ]

    res.json({
      code: 0,
      success: true,
      data: allPermissions
    })
  } catch (error) {
    console.error('获取用户权限失败:', error)
    res.status(500).json({
      code: 500,
      success: false,
      message: '获取用户权限失败: ' + error.message
    })
  }
})

/**
 * 获取组的权限
 * GET /api/permission/group/:groupName
 */
router.get('/group/:groupName', async (req, res) => {
  try {
    const { groupName } = req.params

    // TODO: 需要 groupName 转换为 group_dn
    // 暂时使用 groupName 查询（后续需要 AD 查询支持）

    const groupPermissions = await query(
      `
      SELECT DISTINCT p.route_name
      FROM permissions p
      INNER JOIN group_permissions gp ON p.id = gp.permission_id
      WHERE gp.group_name = @groupName
    `,
      { groupName }
    )

    const permissionList = groupPermissions.map((p) => p.route_name)

    res.json({
      code: 0,
      success: true,
      data: permissionList
    })
  } catch (error) {
    console.error('获取组权限失败:', error)
    res.status(500).json({
      code: 500,
      success: false,
      message: '获取组权限失败: ' + error.message
    })
  }
})

/**
 * 分配用户权限
 * POST /api/permission/user/:username/assign
 * Body: { permissionIds: [1, 2, 3] }
 */
router.post('/user/:username/assign', async (req, res) => {
  try {
    const { username } = req.params
    const { permissionIds } = req.body

    if (!Array.isArray(permissionIds) || permissionIds.length === 0) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '权限ID列表不能为空'
      })
    }

    // 检查权限是否存在
    const permissions = await query(
      `
      SELECT id FROM permissions WHERE id IN (${permissionIds.map((_, i) => `@id${i}`).join(',')})
    `,
      Object.fromEntries(permissionIds.map((id, i) => [`id${i}`, id]))
    )

    if (permissions.length !== permissionIds.length) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '部分权限ID不存在'
      })
    }

    // 批量插入（忽略重复）
    const insertPromises = permissionIds.map((permissionId) =>
      query(
        `
        IF NOT EXISTS (SELECT 1 FROM user_permissions WHERE username = @username AND permission_id = @permissionId)
        BEGIN
          INSERT INTO user_permissions (username, permission_id)
          VALUES (@username, @permissionId)
        END
      `,
        { username, permissionId }
      )
    )

    await Promise.all(insertPromises)

    res.json({
      code: 0,
      success: true,
      message: '权限分配成功'
    })
  } catch (error) {
    console.error('分配用户权限失败:', error)
    res.status(500).json({
      code: 500,
      success: false,
      message: '分配用户权限失败: ' + error.message
    })
  }
})

/**
 * 移除用户权限
 * DELETE /api/permission/user/:username/remove
 * Body: { permissionIds: [1, 2, 3] }
 */
router.delete('/user/:username/remove', async (req, res) => {
  try {
    const { username } = req.params
    const { permissionIds } = req.body

    if (!Array.isArray(permissionIds) || permissionIds.length === 0) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '权限ID列表不能为空'
      })
    }

    await query(
      `
      DELETE FROM user_permissions
      WHERE username = @username AND permission_id IN (${permissionIds.map((_, i) => `@id${i}`).join(',')})
    `,
      { username, ...Object.fromEntries(permissionIds.map((id, i) => [`id${i}`, id])) }
    )

    res.json({
      code: 0,
      success: true,
      message: '权限移除成功'
    })
  } catch (error) {
    console.error('移除用户权限失败:', error)
    res.status(500).json({
      code: 500,
      success: false,
      message: '移除用户权限失败: ' + error.message
    })
  }
})

/**
 * 分配组权限
 * POST /api/permission/group/:groupName/assign
 * Body: { permissionIds: [1, 2, 3], groupDn: 'CN=组名,OU=模具,DC=JIUHUAN,DC=LOCAL' }
 */
router.post('/group/:groupName/assign', async (req, res) => {
  try {
    const { groupName } = req.params
    const { permissionIds, groupDn } = req.body

    if (!Array.isArray(permissionIds) || permissionIds.length === 0) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '权限ID列表不能为空'
      })
    }

    if (!groupDn) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '组DN不能为空'
      })
    }

    // 检查权限是否存在
    const permissions = await query(
      `
      SELECT id FROM permissions WHERE id IN (${permissionIds.map((_, i) => `@id${i}`).join(',')})
    `,
      Object.fromEntries(permissionIds.map((id, i) => [`id${i}`, id]))
    )

    if (permissions.length !== permissionIds.length) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '部分权限ID不存在'
      })
    }

    // 批量插入（忽略重复）
    const insertPromises = permissionIds.map((permissionId) =>
      query(
        `
        IF NOT EXISTS (SELECT 1 FROM group_permissions WHERE group_dn = @groupDn AND permission_id = @permissionId)
        BEGIN
          INSERT INTO group_permissions (group_dn, group_name, permission_id)
          VALUES (@groupDn, @groupName, @permissionId)
        END
      `,
        { groupDn, groupName, permissionId }
      )
    )

    await Promise.all(insertPromises)

    res.json({
      code: 0,
      success: true,
      message: '组权限分配成功'
    })
  } catch (error) {
    console.error('分配组权限失败:', error)
    res.status(500).json({
      code: 500,
      success: false,
      message: '分配组权限失败: ' + error.message
    })
  }
})

/**
 * 移除组权限
 * DELETE /api/permission/group/:groupName/remove
 * Body: { permissionIds: [1, 2, 3] }
 */
router.delete('/group/:groupName/remove', async (req, res) => {
  try {
    const { groupName } = req.params
    const { permissionIds, groupDn } = req.body

    if (!Array.isArray(permissionIds) || permissionIds.length === 0) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '权限ID列表不能为空'
      })
    }

    if (!groupDn) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '组DN不能为空'
      })
    }

    await query(
      `
      DELETE FROM group_permissions
      WHERE group_dn = @groupDn AND permission_id IN (${permissionIds.map((_, i) => `@id${i}`).join(',')})
    `,
      { groupDn, ...Object.fromEntries(permissionIds.map((id, i) => [`id${i}`, id])) }
    )

    res.json({
      code: 0,
      success: true,
      message: '组权限移除成功'
    })
  } catch (error) {
    console.error('移除组权限失败:', error)
    res.status(500).json({
      code: 500,
      success: false,
      message: '移除组权限失败: ' + error.message
    })
  }
})

/**
 * 同步路由到权限表
 * POST /api/permission/sync-routes
 */
router.post('/sync-routes', async (req, res) => {
  try {
    const { syncRoutesToPermissions } = require('../scripts/sync-routes-to-permissions')
    await syncRoutesToPermissions()

    res.json({
      code: 0,
      success: true,
      message: '路由同步成功'
    })
  } catch (error) {
    console.error('同步路由失败:', error)
    res.status(500).json({
      code: 500,
      success: false,
      message: '同步路由失败: ' + error.message
    })
  }
})

/**
 * 转义 LDAP 过滤条件中的特殊字符
 */
function escapeLdapFilter(str) {
  if (!str) return ''
  return str
    .replace(/\\/g, '\\5c')
    .replace(/\*/g, '\\2a')
    .replace(/\(/g, '\\28')
    .replace(/\)/g, '\\29')
    .replace(/\//g, '\\2f')
    .replace(/\0/g, '\\00')
}

/**
 * LDAP 搜索辅助函数
 */
function ldapSearch(client, searchBase, searchFilter, attributes = [], options = {}) {
  return new Promise((resolve, reject) => {
    const entries = []

    client.search(
      searchBase,
      {
        filter: searchFilter,
        scope: options.scope || 'sub',
        attributes: attributes,
        sizeLimit: options.sizeLimit || 1000, // 限制返回结果数量
        timeLimit: options.timeLimit || 10 // 限制查询时间（秒）
      },
      (err, res) => {
        if (err) {
          return reject(err)
        }

        res.on('searchEntry', (entry) => {
          entries.push(entry.object)
        })

        res.on('error', (err) => {
          reject(err)
        })

        res.on('end', (result) => {
          if (result.status !== 0) {
            return reject(new Error(`LDAP 搜索失败: ${result.status}`))
          }
          resolve(entries)
        })
      }
    )
  })
}

/**
 * 创建 LDAP 客户端（带服务账号绑定）
 */
async function createLdapClient() {
  if (!ldap) {
    throw new Error('LDAP 库未安装')
  }

  const client = ldap.createClient({
    url: LDAP_CONFIG.url
  })

  // 如果有服务账号配置，先绑定
  if (LDAP_CONFIG.bindDN && LDAP_CONFIG.bindPassword) {
    await new Promise((resolve, reject) => {
      client.bind(LDAP_CONFIG.bindDN, LDAP_CONFIG.bindPassword, (err) => {
        if (err) {
          client.unbind(() => {})
          return reject(new Error('LDAP 服务账号绑定失败: ' + err.message))
        }
        resolve()
      })
    })
  }

  return client
}

/**
 * 查询 AD 用户列表
 * GET /api/permission/ad/users?keyword=xxx&page=1&pageSize=10
 */
router.get('/ad/users', async (req, res) => {
  try {
    const { keyword = '', page = 1, pageSize = 10 } = req.query

    if (!ldap) {
      // 开发环境：返回模拟数据
      if (isDev) {
        const mockUsers = [
          {
            username: 'changdq',
            displayName: '常东强',
            email: 'changdq@jiuhuan.local',
            dn: 'CN=changdq,CN=Users,DC=JIUHUAN,DC=LOCAL'
          },
          {
            username: 'admin',
            displayName: '管理员',
            email: 'admin@jiuhuan.local',
            dn: 'CN=admin,CN=Users,DC=JIUHUAN,DC=LOCAL'
          },
          {
            username: 'testuser',
            displayName: '测试用户',
            email: 'testuser@jiuhuan.local',
            dn: 'CN=testuser,CN=Users,DC=JIUHUAN,DC=LOCAL'
          }
        ]

        const filtered = keyword
          ? mockUsers.filter(
              (u) =>
                u.username.toLowerCase().includes(keyword.toLowerCase()) ||
                (u.displayName && u.displayName.includes(keyword))
            )
          : mockUsers

        return res.json({
          code: 0,
          success: true,
          data: {
            list: filtered,
            total: filtered.length,
            page: parseInt(page),
            pageSize: parseInt(pageSize)
          }
        })
      }

      return res.status(503).json({
        code: 503,
        success: false,
        message: 'LDAP 库未安装'
      })
    }

    const client = await createLdapClient()

    try {
      // 构建搜索过滤条件
      // 查询用户对象（objectClass=user 且 !objectClass=computer）
      let filter = '(&(objectClass=user)(!(objectClass=computer)))'
      if (keyword) {
        // 转义关键字中的特殊字符
        const escapedKeyword = escapeLdapFilter(keyword)
        filter = `(&(objectClass=user)(!(objectClass=computer))(|(sAMAccountName=*${escapedKeyword}*)(displayName=*${escapedKeyword}*)(mail=*${escapedKeyword}*)))`
      }

      console.log('[AD用户查询] 开始查询，过滤条件:', filter)

      // 搜索用户（限制在 Users OU 下，避免查询整个域）
      const searchBase = LDAP_CONFIG.baseDN
      const entries = await ldapSearch(
        client,
        searchBase,
        filter,
        ['sAMAccountName', 'displayName', 'mail', 'distinguishedName', 'memberOf'],
        { sizeLimit: 500, timeLimit: 10 }
      )

      console.log('[AD用户查询] 查询到用户数量:', entries.length)

      // 格式化用户数据
      const users = entries.map((entry) => ({
        username: entry.sAMAccountName || '',
        displayName: entry.displayName || entry.sAMAccountName || '',
        email: entry.mail || '',
        dn: entry.distinguishedName || '',
        groups: entry.memberOf || []
      }))

      // 分页
      const total = users.length
      const start = (parseInt(page) - 1) * parseInt(pageSize)
      const end = start + parseInt(pageSize)
      const list = users.slice(start, end)

      client.unbind(() => {})

      res.json({
        code: 0,
        success: true,
        data: {
          list,
          total,
          page: parseInt(page),
          pageSize: parseInt(pageSize)
        }
      })
    } catch (error) {
      client.unbind(() => {})
      console.error('[AD用户查询] LDAP 查询错误:', error)
      console.error('[AD用户查询] 错误详情:', {
        message: error.message,
        name: error.name,
        code: error.code,
        dn: error.dn,
        stack: error.stack
      })
      throw error
    }
  } catch (error) {
    console.error('[AD用户查询] 查询 AD 用户列表失败:', error)
    console.error('[AD用户查询] 错误堆栈:', error.stack)

    // 提供更友好的错误信息
    let errorMessage = error.message || '未知错误'
    if (error.message && error.message.includes('Operations Error')) {
      errorMessage = 'LDAP 查询操作失败，可能是权限不足或查询条件有误'
    } else if (error.message && error.message.includes('bind')) {
      errorMessage = 'LDAP 服务账号绑定失败，请检查配置'
    }

    res.status(500).json({
      code: 500,
      success: false,
      message: '查询 AD 用户列表失败: ' + errorMessage
    })
  }
})

/**
 * 查询 AD 组列表
 * GET /api/permission/ad/groups?keyword=xxx&page=1&pageSize=10
 */
router.get('/ad/groups', async (req, res) => {
  try {
    const { keyword = '', page = 1, pageSize = 10 } = req.query

    if (!ldap) {
      // 开发环境：返回模拟数据
      if (isDev) {
        const mockGroups = [
          {
            name: 'Domain Admins',
            dn: 'CN=Domain Admins,CN=Users,DC=JIUHUAN,DC=LOCAL',
            description: '域管理员组'
          },
          {
            name: 'Domain Users',
            dn: 'CN=Domain Users,CN=Users,DC=JIUHUAN,DC=LOCAL',
            description: '域用户组'
          },
          {
            name: 'Administrators',
            dn: 'CN=Administrators,CN=Builtin,DC=JIUHUAN,DC=LOCAL',
            description: '管理员组'
          }
        ]

        const filtered = keyword
          ? mockGroups.filter(
              (g) =>
                g.name.toLowerCase().includes(keyword.toLowerCase()) ||
                (g.description && g.description.includes(keyword))
            )
          : mockGroups

        return res.json({
          code: 0,
          success: true,
          data: {
            list: filtered,
            total: filtered.length,
            page: parseInt(page),
            pageSize: parseInt(pageSize)
          }
        })
      }

      return res.status(503).json({
        code: 503,
        success: false,
        message: 'LDAP 库未安装'
      })
    }

    const client = await createLdapClient()

    try {
      // 构建搜索过滤条件
      // 查询组对象（objectClass=group）
      let filter = '(objectClass=group)'
      if (keyword) {
        // 转义关键字中的特殊字符
        const escapedKeyword = escapeLdapFilter(keyword)
        filter = `(&(objectClass=group)(|(cn=*${escapedKeyword}*)(description=*${escapedKeyword}*)))`
      }

      console.log('[AD组查询] 开始查询，过滤条件:', filter)

      // 搜索组
      const entries = await ldapSearch(
        client,
        LDAP_CONFIG.baseDN,
        filter,
        ['cn', 'name', 'description', 'distinguishedName', 'member'],
        { sizeLimit: 500, timeLimit: 10 }
      )

      console.log('[AD组查询] 查询到组数量:', entries.length)

      // 格式化组数据
      const groups = entries.map((entry) => ({
        name: entry.cn || entry.name || '',
        dn: entry.distinguishedName || '',
        description: entry.description || '',
        memberCount: entry.member ? (Array.isArray(entry.member) ? entry.member.length : 1) : 0
      }))

      // 分页
      const total = groups.length
      const start = (parseInt(page) - 1) * parseInt(pageSize)
      const end = start + parseInt(pageSize)
      const list = groups.slice(start, end)

      client.unbind(() => {})

      res.json({
        code: 0,
        success: true,
        data: {
          list,
          total,
          page: parseInt(page),
          pageSize: parseInt(pageSize)
        }
      })
    } catch (error) {
      client.unbind(() => {})
      console.error('[AD组查询] LDAP 查询错误:', error)
      throw error
    }
  } catch (error) {
    console.error('[AD组查询] 查询 AD 组列表失败:', error)
    console.error('[AD组查询] 错误堆栈:', error.stack)

    // 提供更友好的错误信息
    let errorMessage = error.message || '未知错误'
    if (error.message && error.message.includes('Operations Error')) {
      errorMessage = 'LDAP 查询操作失败，可能是权限不足或查询条件有误'
    }

    res.status(500).json({
      code: 500,
      success: false,
      message: '查询 AD 组列表失败: ' + errorMessage
    })
  }
})

/**
 * 查询用户所属组
 * GET /api/permission/ad/user/:username/groups
 */
router.get('/ad/user/:username/groups', async (req, res) => {
  try {
    const { username } = req.params

    if (!ldap) {
      // 开发环境：返回模拟数据
      if (isDev) {
        const mockGroups = [
          {
            name: 'Domain Users',
            dn: 'CN=Domain Users,CN=Users,DC=JIUHUAN,DC=LOCAL',
            description: '域用户组'
          }
        ]
        return res.json({
          code: 0,
          success: true,
          data: mockGroups
        })
      }

      return res.status(503).json({
        code: 503,
        success: false,
        message: 'LDAP 库未安装'
      })
    }

    const client = await createLdapClient()

    try {
      // 先查找用户（转义用户名中的特殊字符）
      const escapedUsername = escapeLdapFilter(username)
      const userFilter = `(sAMAccountName=${escapedUsername})`
      const userEntries = await ldapSearch(
        client,
        LDAP_CONFIG.baseDN,
        userFilter,
        ['sAMAccountName', 'memberOf', 'distinguishedName'],
        { sizeLimit: 10, timeLimit: 5 }
      )

      if (userEntries.length === 0) {
        client.unbind(() => {})
        return res.status(404).json({
          code: 404,
          success: false,
          message: '用户不存在'
        })
      }

      const user = userEntries[0]
      const memberOf = user.memberOf || []

      // 如果没有组，直接返回
      if (!Array.isArray(memberOf) || memberOf.length === 0) {
        client.unbind(() => {})
        return res.json({
          code: 0,
          success: true,
          data: []
        })
      }

      // 查询组详细信息
      const groups = []
      for (const groupDN of memberOf) {
        // 转义 DN 中的特殊字符
        const escapedDN = escapeLdapFilter(groupDN)
        const groupFilter = `(distinguishedName=${escapedDN})`
        const groupEntries = await ldapSearch(
          client,
          LDAP_CONFIG.baseDN,
          groupFilter,
          ['cn', 'name', 'description', 'distinguishedName'],
          { sizeLimit: 1, timeLimit: 2 }
        )

        if (groupEntries.length > 0) {
          const group = groupEntries[0]
          groups.push({
            name: group.cn || group.name || '',
            dn: group.distinguishedName || groupDN,
            description: group.description || ''
          })
        }
      }

      client.unbind(() => {})

      res.json({
        code: 0,
        success: true,
        data: groups
      })
    } catch (error) {
      client.unbind(() => {})
      console.error('[用户组查询] LDAP 查询错误:', error)
      throw error
    }
  } catch (error) {
    console.error('[用户组查询] 查询用户所属组失败:', error)
    console.error('[用户组查询] 错误堆栈:', error.stack)

    res.status(500).json({
      code: 500,
      success: false,
      message: '查询用户所属组失败: ' + (error.message || '未知错误')
    })
  }
})

module.exports = router
