const sql = require('mssql')

const SOFT_DELETED = '已删除'

const softDeleteByProjectCode = async ({ pool, tx, projectCode, actor }) => {
  const request = new sql.Request(tx)
  request.input('projectCode', sql.NVarChar, projectCode)
  request.input('actor', sql.NVarChar, actor || null)

  const applySoftDeleteSql = (table, whereSql) => `
    IF OBJECT_ID(N'${table}', N'U') IS NOT NULL
    BEGIN
      UPDATE ${table}
      SET
        删除前状态 = CASE
          WHEN (状态 IS NULL OR 状态 <> N'${SOFT_DELETED}') AND 删除前状态 IS NULL THEN 状态
          ELSE 删除前状态
        END,
        状态 = N'${SOFT_DELETED}',
        删除时间 = CASE
          WHEN (状态 IS NULL OR 状态 <> N'${SOFT_DELETED}') THEN SYSDATETIME()
          ELSE 删除时间
        END,
        删除人 = CASE
          WHEN (状态 IS NULL OR 状态 <> N'${SOFT_DELETED}') THEN @actor
          ELSE 删除人
        END
      WHERE ${whereSql};
    END
  `

  const batches = [
    // Core tables
    applySoftDeleteSql('货物信息', '项目编号 = @projectCode'),
    applySoftDeleteSql('项目管理', '项目编号 = @projectCode'),
    applySoftDeleteSql('生产任务', '项目编号 = @projectCode'),

    // Business documents
    applySoftDeleteSql('销售订单', '项目编号 = @projectCode'),
    applySoftDeleteSql('出库单明细', '项目编号 = @projectCode'),

    // Attachments (most tables store 项目编号)
    applySoftDeleteSql('销售订单附件', '项目编号 = @projectCode'),
    applySoftDeleteSql('出库单附件', '项目编号 = @projectCode'),
    applySoftDeleteSql('项目管理附件', '项目编号 = @projectCode'),
    applySoftDeleteSql('生产任务附件', '项目编号 = @projectCode'),

    // Trial process tables
    applySoftDeleteSql('dbo.试模过程', '项目编号 = @projectCode'),
    applySoftDeleteSql('dbo.试模过程附件', '项目编号 = @projectCode')
  ]

  for (const q of batches) {
    await request.batch(q)
  }
}

const restoreByProjectCode = async ({ pool, tx, projectCode }) => {
  const request = new sql.Request(tx)
  request.input('projectCode', sql.NVarChar, projectCode)

  const applyRestoreSql = (table, whereSql) => `
    IF OBJECT_ID(N'${table}', N'U') IS NOT NULL
    BEGIN
      UPDATE ${table}
      SET
        状态 = 删除前状态,
        删除前状态 = NULL,
        删除时间 = NULL,
        删除人 = NULL
      WHERE ${whereSql} AND 状态 = N'${SOFT_DELETED}';
    END
  `

  const batches = [
    applyRestoreSql('货物信息', '项目编号 = @projectCode'),
    applyRestoreSql('项目管理', '项目编号 = @projectCode'),
    applyRestoreSql('生产任务', '项目编号 = @projectCode'),

    applyRestoreSql('销售订单', '项目编号 = @projectCode'),
    applyRestoreSql('出库单明细', '项目编号 = @projectCode'),

    applyRestoreSql('销售订单附件', '项目编号 = @projectCode'),
    applyRestoreSql('出库单附件', '项目编号 = @projectCode'),
    applyRestoreSql('项目管理附件', '项目编号 = @projectCode'),
    applyRestoreSql('生产任务附件', '项目编号 = @projectCode'),

    applyRestoreSql('dbo.试模过程', '项目编号 = @projectCode'),
    applyRestoreSql('dbo.试模过程附件', '项目编号 = @projectCode')
  ]

  for (const q of batches) {
    await request.batch(q)
  }
}

module.exports = {
  SOFT_DELETED,
  softDeleteByProjectCode,
  restoreByProjectCode
}

