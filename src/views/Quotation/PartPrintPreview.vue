<template>
  <div class="print-page">
    <div class="print-toolbar">
      <div class="print-toolbar__left">
        <el-button @click="handleBack">返回</el-button>
        <el-button type="primary" @click="handlePrint">打印</el-button>
      </div>
      <div class="print-toolbar__right">
        <span class="print-toolbar__label">缩放</span>
        <el-select v-model="zoom" size="small" style="width: 110px">
          <el-option :value="0.75" label="75%" />
          <el-option :value="1" label="100%" />
          <el-option :value="1.25" label="125%" />
        </el-select>
      </div>
    </div>

    <div class="print-canvas">
      <div class="paper" :style="paperStyle">
        <div class="doc-header">
          <div class="doc-title">零件报价单</div>
          <div class="doc-subtitle">
            <div class="doc-subtitle__item">报价单号：{{ doc.quotationNo }}</div>
            <div class="doc-subtitle__item">报价日期：{{ doc.quotationDate }}</div>
          </div>
        </div>

        <div class="doc-info">
          <div class="doc-info__row">
            <div class="doc-info__item">
              <span class="label">客户名称：</span>
              <span class="value">{{ doc.customerName }}</span>
            </div>
            <div class="doc-info__item">
              <span class="label">联系人：</span>
              <span class="value">{{ doc.contactName || '-' }}</span>
            </div>
            <div class="doc-info__item">
              <span class="label">联系电话：</span>
              <span class="value">{{ doc.contactPhone || '-' }}</span>
            </div>
          </div>
          <div class="doc-info__row">
            <div class="doc-info__item">
              <span class="label">交货方式：</span>
              <span class="value">{{ doc.deliveryTerms || '-' }}</span>
            </div>
            <div class="doc-info__item">
              <span class="label">付款方式：</span>
              <span class="value">{{ doc.paymentTerms || '-' }}</span>
            </div>
            <div class="doc-info__item">
              <span class="label">报价有效期：</span>
              <span class="value">{{ doc.validityDays ? `${doc.validityDays}天` : '-' }}</span>
            </div>
          </div>
        </div>

        <div class="doc-table">
          <table class="print-table">
            <colgroup>
              <col style="width: 45px" />
              <col style="width: 160px" />
              <col style="width: 120px" />
              <col style="width: 90px" />
              <col style="width: 140px" />
              <col style="width: 70px" />
              <col style="width: 85px" />
              <col style="width: 95px" />
              <col style="width: 95px" />
            </colgroup>
            <thead>
              <tr>
                <th>序号</th>
                <th>零件名称</th>
                <th>图号/规格</th>
                <th>材质</th>
                <th>工艺/表面处理</th>
                <th class="cell-right">数量</th>
                <th>单位</th>
                <th class="cell-right">单价(元)</th>
                <th class="cell-right">金额(元)</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, index) in doc.items" :key="item.lineNo">
                <td class="cell-center">{{ index + 1 }}</td>
                <td class="cell-wrap">{{ item.partName }}</td>
                <td class="cell-wrap">{{ item.drawingNo || '-' }}</td>
                <td class="cell-wrap">{{ item.material || '-' }}</td>
                <td class="cell-wrap">{{ item.process || '-' }}</td>
                <td class="cell-right">{{ item.quantity }}</td>
                <td class="cell-center">{{ item.unit || '-' }}</td>
                <td class="cell-right">{{ formatMoney(item.unitPrice) }}</td>
                <td class="cell-right">{{ formatMoney(item.amount) }}</td>
              </tr>
              <tr>
                <td class="cell-center" colspan="8">合计</td>
                <td class="cell-right">{{ formatMoney(totals.totalAmount) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="doc-notes">
          <div class="doc-notes__title">备注</div>
          <div class="doc-notes__content">
            <div v-for="(line, idx) in notes" :key="idx" class="doc-notes__line">{{ line }}</div>
          </div>
        </div>

        <div class="doc-footer">
          <div class="doc-company">
            <div class="doc-company__name">{{ doc.companyName }}</div>
            <div class="doc-company__meta">{{ doc.companyAddress }}</div>
            <div class="doc-company__meta">电话：{{ doc.companyPhone }}</div>
          </div>
          <div class="doc-sign">
            <div class="doc-sign__item">报价人：</div>
            <div class="doc-sign__item">审核：</div>
            <div class="doc-sign__item">客户确认：</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const zoom = ref<number>(1)
const paperStyle = computed(() => ({
  transform: `scale(${zoom.value})`
}))

const handleBack = () => {
  router.back()
}

const handlePrint = () => {
  window.print()
}

type PartQuotationLine = {
  lineNo: number
  partName: string
  drawingNo?: string
  material?: string
  process?: string
  quantity: number
  unit?: string
  unitPrice: number
  amount: number
}

const doc = {
  quotationNo: 'BJ-20260101-001',
  quotationDate: '2026-01-01',
  customerName: '示例客户有限公司',
  contactName: '张三',
  contactPhone: '13800000000',
  deliveryTerms: '含税含运（送货上门）',
  paymentTerms: '月结30天',
  validityDays: 15,
  companyName: '九环模具（示例）',
  companyAddress: '江苏省××市××区××路××号',
  companyPhone: '0512-00000000',
  items: [
    {
      lineNo: 1,
      partName: '定位销',
      drawingNo: 'JH-P-001',
      material: 'SKD11',
      process: '精磨 / 热处理 HRC58-60',
      quantity: 20,
      unit: '件',
      unitPrice: 18.5,
      amount: 370
    },
    {
      lineNo: 2,
      partName: '滑块镶件',
      drawingNo: 'JH-P-002',
      material: 'NAK80',
      process: 'CNC / 抛光',
      quantity: 2,
      unit: '件',
      unitPrice: 560,
      amount: 1120
    },
    {
      lineNo: 3,
      partName: '支撑柱',
      drawingNo: 'JH-P-003',
      material: 'S45C',
      process: '车削 / 发黑',
      quantity: 12,
      unit: '件',
      unitPrice: 22,
      amount: 264
    }
  ] satisfies PartQuotationLine[]
}

const totals = computed(() => {
  const totalAmount = doc.items.reduce((sum, i) => sum + Number(i.amount || 0), 0)
  return { totalAmount }
})

const formatMoney = (value: unknown) => {
  const num = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(num)) return '-'
  return num.toLocaleString('zh-Hans-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

const notes = [
  '1. 以上报价为含税价（默认13%增值税专票），如税率/开票类型不同请提前说明。',
  '2. 交期以双方确认图纸/样件及实际排产为准。',
  '3. 若有特殊检测、包装、表面处理或材质要求，请在下单前明确。',
  '4. 本报价单仅用于报价确认，不作为合同文本；如需合同请另行签署。'
]
</script>

<style scoped>
.print-page {
  min-height: 100vh;
  background: #f5f7fa;
}

.print-toolbar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: var(--el-bg-color-overlay);
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.print-toolbar__left,
.print-toolbar__right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.print-toolbar__label {
  font-size: 13px;
  color: var(--el-text-color-regular);
}

.print-canvas {
  display: flex;
  justify-content: center;
  padding: 18px 16px 36px;
}

.paper {
  width: 210mm;
  min-height: 297mm;
  padding: 12mm;
  background: #fff;
  border-radius: 4px;
  box-shadow: 0 10px 28px rgb(0 0 0 / 12%);
  box-sizing: border-box;
  transform-origin: top center;
}

.doc-header {
  padding-bottom: 10px;
  text-align: center;
  border-bottom: 1px solid #000;
}

.doc-title {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 1px;
  color: #303133;
}

.doc-subtitle {
  display: flex;
  margin-top: 6px;
  font-size: 13px;
  color: #606266;
  justify-content: center;
  gap: 22px;
  flex-wrap: wrap;
}

.doc-info {
  display: grid;
  margin-top: 12px;
  font-size: 13px;
  color: #303133;
  gap: 8px;
}

.doc-info__row {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 10px;
}

.doc-info__item {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.doc-info__item .label {
  color: #606266;
  text-align: right;
  white-space: nowrap;
  flex: 0 0 76px;
}

.doc-info__item .value {
  flex: 1 1 auto;
  min-width: 0;
  word-break: break-word;
}

.doc-table {
  margin-top: 14px;
}

.print-table {
  width: 100%;
  font-size: 12px;
  color: #303133;
  border-collapse: collapse;
  table-layout: fixed;
}

.print-table th,
.print-table td {
  padding: 6px;
  vertical-align: top;
  border: 1px solid #000;
}

.print-table thead th {
  font-weight: 700;
  text-align: center;
  background: #fafafa;
}

.cell-center {
  text-align: center;
}

.cell-right {
  text-align: right;
}

.cell-wrap {
  word-break: break-word;
  white-space: normal;
  overflow-wrap: anywhere;
}

.doc-notes {
  padding: 10px 12px;
  margin-top: 14px;
  border: 1px solid #000;
}

.doc-notes__title {
  font-size: 13px;
  font-weight: 700;
  color: #303133;
}

.doc-notes__content {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.6;
  color: #303133;
}

.doc-notes__line {
  margin-top: 2px;
}

.doc-footer {
  display: flex;
  margin-top: 18px;
  gap: 16px;
  justify-content: space-between;
  align-items: flex-end;
}

.doc-company__name {
  font-size: 13px;
  font-weight: 700;
  color: #303133;
}

.doc-company__meta {
  margin-top: 4px;
  font-size: 12px;
  color: #606266;
}

.doc-sign {
  display: flex;
  gap: 20px;
  color: #606266;
}

.doc-sign__item {
  min-width: 86px;
  padding-top: 8px;
  font-size: 12px;
  text-align: center;
  border-top: 1px solid #000;
}

@media print {
  @page {
    margin: 12mm;
    size: a4;
  }

  .print-page {
    background: #fff;
  }

  .print-toolbar {
    display: none !important;
  }

  .print-canvas {
    padding: 0;
  }

  .paper {
    width: auto;
    min-height: auto;
    padding: 0;
    border-radius: 0;
    transform: none !important;
    box-shadow: none;
  }
}
</style>
