import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export type InventoryLevel = 'healthy' | 'low' | 'over'

export interface InventoryItem {
  id: number
  materialCode: string
  materialName: string
  category: string
  warehouse: string
  location: string
  quantity: number
  safetyStock: number
  maxStock: number
  level: InventoryLevel
  remark: string
}

export interface InboundRecord {
  id: number
  documentNo: string
  supplier: string
  materialCode: string
  materialName: string
  category: string
  warehouse: string
  quantity: number
  arrivalDate: string
  status: 'waiting' | 'received'
}

export interface OutboundRecord {
  id: number
  documentNo: string
  target: string
  materialCode: string
  materialName: string
  category: string
  warehouse: string
  quantity: number
  deliveryDate: string
  status: 'allocated' | 'shipped'
}

export interface TransferRecord {
  id: number
  documentNo: string
  fromWarehouse: string
  toWarehouse: string
  materialCode: string
  materialName: string
  category: string
  quantity: number
  transferDate: string
  status: 'inTransit' | 'completed'
}

export interface StocktakeRecord {
  id: number
  planName: string
  range: string
  executor: string
  materialCode: string
  materialName: string
  warehouse: string
  countedQuantity: number
  difference: number
  status: 'onGoing' | 'completed'
  scheduledDate: string
}

const resolveLevel = (item: InventoryItem): InventoryLevel => {
  if (item.quantity < item.safetyStock) return 'low'
  if (item.quantity > item.maxStock) return 'over'
  return 'healthy'
}

export const useInventoryStore = defineStore('inventory', () => {
  const inventory = ref<InventoryItem[]>([
    {
      id: 1,
      materialCode: 'RM-001',
      materialName: '铝合金板材',
      category: 'raw',
      warehouse: '一号仓',
      location: 'A1-03',
      quantity: 620,
      safetyStock: 400,
      maxStock: 1000,
      level: 'healthy',
      remark: '用于结构件加工'
    },
    {
      id: 2,
      materialCode: 'PT-310',
      materialName: '高压接头组件',
      category: 'parts',
      warehouse: '二号仓',
      location: 'B2-11',
      quantity: 120,
      safetyStock: 200,
      maxStock: 600,
      level: 'low',
      remark: '需求增长，需要跟进补货'
    },
    {
      id: 3,
      materialCode: 'FG-9001',
      materialName: '电控成套箱',
      category: 'finished',
      warehouse: '成品仓',
      location: 'C3-05',
      quantity: 80,
      safetyStock: 60,
      maxStock: 120,
      level: 'healthy',
      remark: '等待发运至客户'
    },
    {
      id: 4,
      materialCode: 'PT-256',
      materialName: '密封垫片',
      category: 'parts',
      warehouse: '备件仓',
      location: 'D1-09',
      quantity: 950,
      safetyStock: 400,
      maxStock: 800,
      level: 'over',
      remark: '采购量偏大，需要暂停补货'
    }
  ])

  const inboundIdSeed = ref(3)
  const outboundIdSeed = ref(3)
  const transferIdSeed = ref(3)
  const stocktakeIdSeed = ref(3)
  const inventoryIdSeed = ref(inventory.value.length + 1)

  const inboundRecords = ref<InboundRecord[]>([
    {
      id: 1,
      documentNo: 'GRN-202403-001',
      supplier: '苏州精工版材',
      materialCode: 'RM-001',
      materialName: '铝合金板材',
      category: 'raw',
      warehouse: '一号仓',
      quantity: 280,
      arrivalDate: '2024-03-26',
      status: 'waiting'
    },
    {
      id: 2,
      documentNo: 'GRN-202403-012',
      supplier: '华东塑胶件',
      materialCode: 'PT-310',
      materialName: '高压接头组件',
      category: 'parts',
      warehouse: '二号仓',
      quantity: 120,
      arrivalDate: '2024-03-20',
      status: 'received'
    }
  ])

  const outboundRecords = ref<OutboundRecord[]>([
    {
      id: 1,
      documentNo: 'OD-202403-020',
      target: '装配线 A01',
      materialCode: 'PT-310',
      materialName: '高压接头组件',
      category: 'parts',
      warehouse: '二号仓',
      quantity: 64,
      deliveryDate: '2024-03-21',
      status: 'allocated'
    },
    {
      id: 2,
      documentNo: 'SO-202403-015',
      target: '客户-远航国际',
      materialCode: 'FG-9001',
      materialName: '电控成套箱',
      category: 'finished',
      warehouse: '成品仓',
      quantity: 18,
      deliveryDate: '2024-03-22',
      status: 'shipped'
    }
  ])

  const transferRecords = ref<TransferRecord[]>([
    {
      id: 1,
      documentNo: 'TR-202403-006',
      fromWarehouse: '一号仓',
      toWarehouse: '备件仓',
      materialCode: 'PT-256',
      materialName: '密封垫片',
      category: 'parts',
      quantity: 200,
      transferDate: '2024-03-23',
      status: 'inTransit'
    },
    {
      id: 2,
      documentNo: 'TR-202403-004',
      fromWarehouse: '二号仓',
      toWarehouse: '成品仓',
      materialCode: 'FG-9001',
      materialName: '电控成套箱',
      category: 'finished',
      quantity: 12,
      transferDate: '2024-03-18',
      status: 'completed'
    }
  ])

  const stocktakeRecords = ref<StocktakeRecord[]>([
    {
      id: 1,
      planName: '一季度原材料盘点',
      range: '一号仓 (A区-B区)',
      executor: '李倩',
      materialCode: 'RM-001',
      materialName: '铝合金板材',
      warehouse: '一号仓',
      countedQuantity: 622,
      difference: 2,
      status: 'onGoing',
      scheduledDate: '2024-03-28'
    },
    {
      id: 2,
      planName: '备件仓抽盘',
      range: '备件仓 (D区)',
      executor: '孙晨',
      materialCode: 'PT-256',
      materialName: '密封垫片',
      warehouse: '备件仓',
      countedQuantity: 949,
      difference: -1,
      status: 'completed',
      scheduledDate: '2024-03-12'
    }
  ])

  const totals = computed(() => {
    const result = {
      totalSku: inventory.value.length,
      totalQty: 0,
      lowStock: 0,
      overStock: 0
    }
    inventory.value.forEach((item) => {
      result.totalQty += item.quantity
      if (item.level === 'low') result.lowStock += 1
      if (item.level === 'over') result.overStock += 1
    })
    return result
  })

  const warehouses = computed(() =>
    Array.from(new Set(inventory.value.map((item) => item.warehouse))).sort()
  )

  const findInventoryItem = (materialCode: string, warehouse?: string) =>
    inventory.value.find(
      (item) => item.materialCode === materialCode && (!warehouse || item.warehouse === warehouse)
    )

  const upsertInventory = (payload: {
    materialCode: string
    materialName: string
    category: string
    warehouse?: string
    location?: string
    quantity: number
  }) => {
    const warehouse = payload.warehouse
    let target = findInventoryItem(payload.materialCode, warehouse)
    if (!target) {
      target = {
        id: inventoryIdSeed.value++,
        materialCode: payload.materialCode,
        materialName: payload.materialName,
        category: payload.category,
        warehouse: warehouse || '一号仓',
        location: payload.location || '新建库位',
        quantity: payload.quantity,
        safetyStock: 100,
        maxStock: 800,
        level: 'healthy',
        remark: ''
      }
      inventory.value.unshift(target)
    } else {
      target.quantity = payload.quantity
      if (payload.warehouse) target.warehouse = payload.warehouse
      if (payload.location) target.location = payload.location
      if (payload.materialName) target.materialName = payload.materialName
      if (payload.category) target.category = payload.category
    }
    target.level = resolveLevel(target)
  }

  const addInboundRecord = (
    record: Omit<InboundRecord, 'id' | 'status'> & { status?: InboundRecord['status'] }
  ) => {
    const status = record.status ?? 'received'
    const warehouse = record.warehouse
    const existing = findInventoryItem(record.materialCode, warehouse)
    const targetWarehouse = warehouse || existing?.warehouse || '一号仓'
    const targetLocation = existing?.location
    const newQty = (existing?.quantity || 0) + record.quantity
    upsertInventory({
      materialCode: record.materialCode,
      materialName: record.materialName,
      category: record.category,
      warehouse: targetWarehouse,
      location: targetLocation,
      quantity: newQty
    })
    const id = inboundIdSeed.value++
    inboundRecords.value.unshift({
      ...record,
      status,
      warehouse: targetWarehouse,
      id
    })
    return id
  }

  const addOutboundRecord = (
    record: Omit<OutboundRecord, 'id'>,
    options: { allowNegative?: boolean } = {}
  ) => {
    const source = findInventoryItem(record.materialCode, record.warehouse)
    if (!source) {
      throw new Error('inventory.notFound')
    }
    if (!options.allowNegative && source.quantity < record.quantity) {
      throw new Error('inventory.notEnough')
    }
    source.quantity = source.quantity - record.quantity
    source.level = resolveLevel(source)
    const id = outboundIdSeed.value++
    outboundRecords.value.unshift({
      ...record,
      id
    })
    return id
  }

  const addTransferRecord = (record: {
    documentNo: string
    fromWarehouse: string
    toWarehouse: string
    materialCode: string
    materialName: string
    category: string
    quantity: number
    transferDate: string
    status?: TransferRecord['status']
  }) => {
    if (record.fromWarehouse === record.toWarehouse) {
      throw new Error('inventory.transferSameWarehouse')
    }
    const source = findInventoryItem(record.materialCode, record.fromWarehouse)
    if (!source) {
      throw new Error('inventory.transferFromNotFound')
    }
    if (source.quantity < record.quantity) {
      throw new Error('inventory.notEnough')
    }
    source.quantity -= record.quantity
    source.level = resolveLevel(source)

    const target = findInventoryItem(record.materialCode, record.toWarehouse)
    const destinationQuantity = (target?.quantity || 0) + record.quantity
    upsertInventory({
      materialCode: record.materialCode,
      materialName: record.materialName,
      category: record.category,
      warehouse: record.toWarehouse,
      location: target?.location || '待分配',
      quantity: destinationQuantity
    })

    const id = transferIdSeed.value++
    transferRecords.value.unshift({
      id,
      documentNo: record.documentNo,
      fromWarehouse: record.fromWarehouse,
      toWarehouse: record.toWarehouse,
      materialCode: record.materialCode,
      materialName: record.materialName,
      category: record.category,
      quantity: record.quantity,
      transferDate: record.transferDate,
      status: record.status ?? 'completed'
    })
    return id
  }

  const addStocktakeRecord = (record: {
    planName: string
    range: string
    executor: string
    materialCode: string
    materialName?: string
    warehouse?: string
    countedQuantity: number
    scheduledDate: string
    status?: StocktakeRecord['status']
  }) => {
    const target = findInventoryItem(record.materialCode, record.warehouse)
    if (!target) {
      throw new Error('inventory.notFound')
    }
    const difference = record.countedQuantity - target.quantity
    target.quantity = record.countedQuantity
    target.level = resolveLevel(target)
    if (record.materialName) {
      target.materialName = record.materialName
    }
    const id = stocktakeIdSeed.value++
    stocktakeRecords.value.unshift({
      id,
      planName: record.planName,
      range: record.range,
      executor: record.executor,
      materialCode: target.materialCode,
      materialName: target.materialName,
      warehouse: target.warehouse,
      countedQuantity: record.countedQuantity,
      difference,
      status: record.status ?? 'completed',
      scheduledDate: record.scheduledDate
    })
    return id
  }

  return {
    inventory,
    inboundRecords,
    outboundRecords,
    transferRecords,
    stocktakeRecords,
    totals,
    warehouses,
    addInboundRecord,
    addOutboundRecord,
    addTransferRecord,
    addStocktakeRecord
  }
})
