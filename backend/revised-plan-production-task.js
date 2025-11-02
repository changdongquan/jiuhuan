/**
 * 修订方案：货物信息 → 生产任务自动同步
 *
 * 需求：
 * 1. 像项目管理一样（参考货物信息 → 项目管理的逻辑）
 * 2. 只在新增货物信息时，单向在生产任务中新增项目编号
 * 3. 不用管删除操作
 * 4. 不要任务ID（不需要主键）
 * 5. 只需要同步项目编号
 */

console.log('='.repeat(60))
console.log('📋 修订后的实现方案')
console.log('='.repeat(60))

console.log(`
需求明确：
  ✅ 参考货物信息 → 项目管理的逻辑
  ✅ 只在新增货物信息时同步
  ✅ 单向：货物信息新增 → 生产任务自动新增项目编号
  ❌ 不需要处理删除操作
  ❌ 不需要任务ID（主键用项目编号）
  ✅ 只需要同步项目编号字段

实现方案：
`)

console.log('\n' + '='.repeat(60))
console.log('📝 第一步：数据库准备')
console.log('='.repeat(60))

console.log(`
-- 1.1 创建唯一索引（必需）
CREATE UNIQUE INDEX idx_货物信息_项目编号 
ON 货物信息(项目编号)
WHERE 项目编号 IS NOT NULL;

-- 1.2 创建生产任务表（参考项目管理表结构，但项目编号作为主键）
CREATE TABLE 生产任务 (
    项目编号 NVARCHAR(50) NOT NULL PRIMARY KEY,  -- 主键，不需要任务ID
    客户ID INT,
    客户模号 NVARCHAR(100),
    -- ... 其他字段（参考项目管理表的所有45个字段）
    费用出处 NVARCHAR(255)
);
-- 注意：项目编号既是主键，也是外键

-- 1.3 创建外键约束
ALTER TABLE 生产任务
ADD CONSTRAINT FK_生产任务_项目编号
FOREIGN KEY (项目编号) 
REFERENCES 货物信息(项目编号)
ON DELETE NO ACTION
ON UPDATE NO ACTION;

-- 1.4 创建索引（主键已自动创建索引，可以额外创建其他索引）
CREATE INDEX idx_生产任务_客户ID ON 生产任务(客户ID);
`)

console.log('\n' + '='.repeat(60))
console.log('📝 第二步：代码修改（仅在新增接口）')
console.log('='.repeat(60))

console.log(`
修改文件：backend/routes/goods.js
修改位置：POST /api/goods 接口（新增货物信息）

具体位置：在第274行（创建项目管理记录之后）插入以下代码：

// ========== 新增：生产任务同步逻辑 ==========
// 检查项目编号是否在生产任务表中存在
// 如果不存在，自动创建一条记录（只创建项目编号）
const checkProductionTaskRequest = pool.request()
checkProductionTaskRequest.input('projectCode', sql.NVarChar, projectCode)
const checkProductionTaskResult = await checkProductionTaskRequest.query(\`
  SELECT COUNT(*) as count 
  FROM 生产任务 
  WHERE 项目编号 = @projectCode
\`)

if (checkProductionTaskResult.recordset[0].count === 0) {
  // 如果生产任务表中不存在，只创建项目编号记录
  const createProductionTaskRequest = pool.request()
  createProductionTaskRequest.input('projectCode', sql.NVarChar, projectCode)
  
  await createProductionTaskRequest.query(\`
    INSERT INTO 生产任务 (项目编号)
    VALUES (@projectCode)
  \`)
  console.log(\`[自动创建] 已在生产任务表中创建项目编号: \${projectCode}\`)
} else {
  // 如果已存在，不做任何操作（因为只需要项目编号，不需要更新）
  console.log(\`[已存在] 生产任务表中已存在项目编号: \${projectCode}\`)
}

// 然后继续执行原有的货物信息插入逻辑...
`)

console.log('\n' + '='.repeat(60))
console.log('📋 代码插入位置示意图')
console.log('='.repeat(60))

console.log(`
backend/routes/goods.js (POST /api/goods)

... 前面的代码 ...
├─ 第227-274行：项目管理同步逻辑
│   └─ 检查并创建/更新项目管理记录
│
├─ 【在这里插入】生产任务同步逻辑（新增）
│   └─ 检查并创建生产任务记录（只创建项目编号）
│
└─ 第276-330行：插入货物信息记录
    └─ 原有的货物信息插入逻辑
`)

console.log('\n' + '='.repeat(60))
console.log('📋 完整代码片段')
console.log('='.repeat(60))

console.log(`
// ========== 新增：生产任务同步逻辑 ==========
// 只在新增货物信息时，自动在生产任务表中创建项目编号
const checkProductionTaskRequest = pool.request()
checkProductionTaskRequest.input('projectCode', sql.NVarChar, projectCode)
const checkProductionTaskResult = await checkProductionTaskRequest.query(\`
  SELECT COUNT(*) as count 
  FROM 生产任务 
  WHERE 项目编号 = @projectCode
\`)

if (checkProductionTaskResult.recordset[0].count === 0) {
  // 如果生产任务表中不存在，创建一条记录（只创建项目编号）
  const createProductionTaskRequest = pool.request()
  createProductionTaskRequest.input('projectCode', sql.NVarChar, projectCode)
  
  await createProductionTaskRequest.query(\`
    INSERT INTO 生产任务 (项目编号)
    VALUES (@projectCode)
  \`)
  console.log(\`[自动创建] 已在生产任务表中创建项目编号: \${projectCode}\`)
} else {
  console.log(\`[已存在] 生产任务表中已存在项目编号: \${projectCode}，跳过创建\`)
}

// 继续执行原有的货物信息插入逻辑...
`)

console.log('\n' + '='.repeat(60))
console.log('📊 与项目管理逻辑的对比')
console.log('='.repeat(60))

console.log(`
货物信息 → 项目管理逻辑（第227-274行）：
  ✅ 检查是否存在
  ✅ 如果不存在：创建记录（可能包含客户ID、客户模号）
  ✅ 如果存在：更新客户ID、客户模号

货物信息 → 生产任务逻辑（新增）：
  ✅ 检查是否存在
  ✅ 如果不存在：创建记录（只创建项目编号）
  ✅ 如果存在：不做任何操作（因为只需要项目编号）

关键差异：
  - 生产任务同步更简单（只创建项目编号）
  - 不更新已存在的记录
  - 不处理删除操作
`)

console.log('\n' + '='.repeat(60))
console.log('📋 执行步骤总结')
console.log('='.repeat(60))

console.log(`
阶段1：数据库准备
  1. 创建唯一索引：货物信息.项目编号
  2. 创建生产任务表（项目编号作为主键）
  3. 创建外键约束：生产任务.项目编号 → 货物信息.项目编号

阶段2：代码修改
  1. 修改 backend/routes/goods.js
  2. 在 POST /api/goods 接口中（第274行之后）
  3. 添加生产任务自动创建逻辑（只创建项目编号）

阶段3：测试验证
  1. 测试新增货物信息 → 检查生产任务是否自动创建项目编号
  2. 测试重复新增相同项目编号 → 验证不会报错（已存在则跳过）
`)

console.log('\n' + '='.repeat(60))
console.log('✅ 方案修订完成')
console.log('='.repeat(60))
