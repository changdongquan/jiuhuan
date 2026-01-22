const { initDatabase, query, closeDatabase } = require('../../database')

async function testReadSalesOrders() {
  try {
    // 初始化数据库连接
    await initDatabase()
    console.log('数据库连接成功\n')

    // 测试1: 读取所有销售订单（前10条）
    console.log('测试1: 读取前10条销售订单...')
    const orders = await query(`
      SELECT TOP 10
        订单ID as id,
        订单编号 as orderNo,
        客户ID as customerId,
        项目编号 as itemCode,
        订单日期 as orderDate,
        交货日期 as deliveryDate,
        签订日期 as signDate,
        合同号 as contractNo,
        总金额 as totalAmount,
        单价 as unitPrice,
        数量 as quantity,
        备注 as remark,
        费用出处 as costSource,
        经办人 as handler,
        是否入库 as isInStock,
        是否出运 as isShipped,
        出运日期 as shippingDate
      FROM 销售订单
      ORDER BY 订单日期 DESC, 订单ID DESC
    `)

    console.log(`找到 ${orders.length} 条订单:\n`)
    orders.forEach((order, index) => {
      console.log(`订单 ${index + 1}:`)
      console.log(`  ID: ${order.id}`)
      console.log(`  订单编号: ${order.orderNo}`)
      console.log(`  客户ID: ${order.customerId}`)
      console.log(`  项目编号: ${order.itemCode}`)
      console.log(`  订单日期: ${order.orderDate}`)
      console.log(`  合同号: ${order.contractNo}`)
      console.log(`  总金额: ${order.totalAmount}`)
      console.log(`  数量: ${order.quantity}`)
      console.log(`  是否入库: ${order.isInStock}`)
      console.log(`  是否出运: ${order.isShipped}`)
      console.log('')
    })

    // 测试2: 按条件查询
    console.log('测试2: 按订单编号查询...')
    const filteredOrders = await query(
      `
      SELECT 
        订单ID as id,
        订单编号 as orderNo,
        客户ID as customerId,
        项目编号 as itemCode,
        订单日期 as orderDate,
        合同号 as contractNo,
        总金额 as totalAmount
      FROM 销售订单
      WHERE 订单编号 LIKE @orderNo
      ORDER BY 订单日期 DESC
    `,
      { orderNo: '%XS-20241202%' }
    )

    console.log(`找到 ${filteredOrders.length} 条匹配的订单`)
    filteredOrders.forEach((order) => {
      console.log(`  - ${order.orderNo} (客户ID: ${order.customerId}, 金额: ${order.totalAmount})`)
    })
    console.log('')

    // 测试3: 统计信息
    console.log('测试3: 统计信息...')
    const stats = await query(`
      SELECT 
        COUNT(*) as totalOrders,
        SUM(总金额) as totalAmount,
        SUM(数量) as totalQuantity,
        SUM(CASE WHEN 是否入库 = 1 THEN 1 ELSE 0 END) as inStockCount,
        SUM(CASE WHEN 是否出运 = 1 THEN 1 ELSE 0 END) as shippedCount
      FROM 销售订单
    `)

    const stat = stats[0]
    console.log(`  总订单数: ${stat.totalOrders}`)
    console.log(`  总金额: ${stat.totalAmount || 0}`)
    console.log(`  总数量: ${stat.totalQuantity || 0}`)
    console.log(`  已入库: ${stat.inStockCount}`)
    console.log(`  已出运: ${stat.shippedCount}`)
  } catch (error) {
    console.error('执行失败:', error)
  } finally {
    await closeDatabase()
  }
}

testReadSalesOrders()
