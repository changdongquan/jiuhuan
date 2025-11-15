/**
 * 检查 LDAP 服务账号权限的脚本
 *
 * 使用方法：
 * node backend/scripts/check-ldap-permissions.js
 */

const ldap = require('ldapjs')

// 尝试从环境文件读取密码
const fs = require('fs')
const path = require('path')

let bindPassword = process.env.LDAP_BIND_PASSWORD

// 如果环境变量未设置，尝试从环境文件读取
if (!bindPassword) {
  const envFile = '/etc/jh-craftsys/secrets/ldap_bind.env'
  if (fs.existsSync(envFile)) {
    try {
      const envContent = fs.readFileSync(envFile, 'utf8')
      const match = envContent.match(/LDAP_BIND_PASSWORD=(.+)/)
      if (match) {
        bindPassword = match[1].trim().replace(/^["']|["']$/g, '')
      }
    } catch (error) {
      console.warn('无法读取环境文件:', error.message)
    }
  }
}

// LDAP 配置
const LDAP_CONFIG = {
  url: process.env.LDAP_URL || 'ldap://AD2016-1.jiuhuan.local:389',
  baseDN: process.env.LDAP_BASE_DN || 'DC=JIUHUAN,DC=LOCAL',
  bindDN: process.env.LDAP_BIND_DN || 'CN=CraftSys Service Account,CN=Users,DC=JIUHUAN,DC=LOCAL',
  bindPassword: bindPassword
}

if (!LDAP_CONFIG.bindPassword) {
  console.error('错误: LDAP_BIND_PASSWORD 未设置')
  console.log('请设置环境变量: export LDAP_BIND_PASSWORD="your_password"')
  console.log('或确保文件存在: /etc/jh-craftsys/secrets/ldap_bind.env')
  process.exit(1)
}

async function testLdapPermissions() {
  console.log('='.repeat(60))
  console.log('LDAP 服务账号权限检查')
  console.log('='.repeat(60))
  console.log('服务账号:', LDAP_CONFIG.bindDN)
  console.log('LDAP 服务器:', LDAP_CONFIG.url)
  console.log('基础 DN:', LDAP_CONFIG.baseDN)
  console.log('')

  const client = ldap.createClient({ url: LDAP_CONFIG.url })

  try {
    // 1. 测试绑定
    console.log('[1/5] 测试服务账号绑定...')
    await new Promise((resolve, reject) => {
      client.bind(LDAP_CONFIG.bindDN, LDAP_CONFIG.bindPassword, (err) => {
        if (err) {
          console.error('  ❌ 绑定失败:', err.message)
          return reject(err)
        }
        console.log('  ✅ 绑定成功')
        resolve()
      })
    })

    // 2. 测试查询整个域
    console.log('\n[2/5] 测试查询整个域 (DC=JIUHUAN,DC=LOCAL)...')
    try {
      const entries1 = await ldapSearch(
        client,
        LDAP_CONFIG.baseDN,
        '(objectClass=user)',
        ['sAMAccountName'],
        { sizeLimit: 5 }
      )
      console.log(`  ✅ 查询成功，找到 ${entries1.length} 个用户（限制5个）`)
    } catch (error) {
      console.error('  ❌ 查询失败:', error.message)
      console.error('  错误代码:', error.code)
    }

    // 3. 测试查询 Users OU
    console.log('\n[3/5] 测试查询 Users OU (CN=Users,DC=JIUHUAN,DC=LOCAL)...')
    try {
      const usersOU = `CN=Users,${LDAP_CONFIG.baseDN}`
      const entries2 = await ldapSearch(client, usersOU, '(objectClass=user)', ['sAMAccountName'], {
        sizeLimit: 5
      })
      console.log(`  ✅ 查询成功，找到 ${entries2.length} 个用户（限制5个）`)
    } catch (error) {
      console.error('  ❌ 查询失败:', error.message)
      console.error('  错误代码:', error.code)
    }

    // 4. 测试查询特定用户
    console.log('\n[4/5] 测试查询特定用户 (sAMAccountName=changdq)...')
    try {
      const userFilter = '(sAMAccountName=changdq)'
      const entries3 = await ldapSearch(
        client,
        LDAP_CONFIG.baseDN,
        userFilter,
        ['sAMAccountName', 'displayName', 'mail'],
        { sizeLimit: 1 }
      )
      if (entries3.length > 0 && entries3[0]) {
        const user = entries3[0]
        console.log('  ✅ 查询成功，找到用户:', user.sAMAccountName || 'N/A')
        console.log('  显示名称:', user.displayName || 'N/A')
        console.log('  邮箱:', user.mail || 'N/A')
      } else {
        console.log('  ⚠️  查询成功，但未找到用户 changdq')
      }
    } catch (error) {
      console.error('  ❌ 查询失败:', error.message)
      console.error('  错误代码:', error.code)
    }

    // 5. 测试查询组
    console.log('\n[5/5] 测试查询组 (objectClass=group)...')
    try {
      const entries4 = await ldapSearch(client, LDAP_CONFIG.baseDN, '(objectClass=group)', ['cn'], {
        sizeLimit: 5
      })
      console.log(`  ✅ 查询成功，找到 ${entries4.length} 个组（限制5个）`)
    } catch (error) {
      console.error('  ❌ 查询失败:', error.message)
      console.error('  错误代码:', error.code)
    }

    client.unbind(() => {})
    console.log('\n' + '='.repeat(60))
    console.log('权限检查完成')
    console.log('='.repeat(60))
  } catch (error) {
    client.unbind(() => {})
    console.error('\n❌ 权限检查失败:', error.message)
    process.exit(1)
  }
}

function ldapSearch(client, searchBase, searchFilter, attributes = [], options = {}) {
  return new Promise((resolve, reject) => {
    const entries = []

    client.search(
      searchBase,
      {
        filter: searchFilter,
        scope: 'sub',
        attributes: attributes,
        sizeLimit: options.sizeLimit || 1000,
        timeLimit: options.timeLimit || 10
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

if (require.main === module) {
  testLdapPermissions()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('执行失败:', error)
      process.exit(1)
    })
}

module.exports = { testLdapPermissions }
