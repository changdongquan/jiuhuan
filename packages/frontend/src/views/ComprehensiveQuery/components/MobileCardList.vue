<template>
  <div class="cq-mobile-card-list">
    <article
      v-for="row in tableData"
      :key="row.projectCode"
      class="cq-mobile-card"
      @click="emit('row-click', row)"
    >
      <div class="cq-mobile-card__head">
        <div class="cq-mobile-card__hero">
          <div class="cq-mobile-card__code">{{ row.projectCode }}</div>
          <div class="cq-mobile-card__title">{{ row.customerName || '未命名客户' }}</div>
          <div class="cq-mobile-card__product">{{ row.productName || '-' }}</div>
        </div>
        <el-tag
          :type="getSettlementStatusTagType(row.settlementStatus)"
          class="cq-status-tag--fixed cq-mobile-card__status"
        >
          {{ row.settlementStatus || '-' }}
        </el-tag>
      </div>

      <div class="cq-mobile-card__strip">
        <span>{{ row.category || '未分类' }}</span>
        <span>{{ row.contractNo || '无合同号' }}</span>
        <span>{{ row.latestOrderDate || '无订单日期' }}</span>
      </div>

      <div class="cq-mobile-card__metrics">
        <div class="cq-mobile-metric">
          <span class="cq-mobile-metric__label">销售金额</span>
          <span class="cq-mobile-metric__value">{{ formatAmount(row.salesAmount) }}</span>
        </div>
        <div class="cq-mobile-metric">
          <span class="cq-mobile-metric__label">开票比例</span>
          <span class="cq-mobile-metric__value">{{ formatPercent(row.invoiceProgress) }}</span>
          <div class="cq-mobile-metric__track">
            <div
              class="cq-mobile-metric__bar cq-mobile-metric__bar--invoice"
              :style="buildProgressStyle(row.invoiceProgress)"
            ></div>
          </div>
        </div>
        <div class="cq-mobile-metric">
          <span class="cq-mobile-metric__label">订单欠款</span>
          <span class="cq-mobile-metric__value">{{ formatAmount(row.orderArrearsAmount) }}</span>
        </div>
        <div class="cq-mobile-metric">
          <span class="cq-mobile-metric__label">回款比例</span>
          <span class="cq-mobile-metric__value">{{ formatPercent(row.receiptProgress) }}</span>
          <div class="cq-mobile-metric__track">
            <div
              class="cq-mobile-metric__bar cq-mobile-metric__bar--receipt"
              :style="buildProgressStyle(row.receiptProgress)"
            ></div>
          </div>
        </div>
      </div>

      <div v-if="tableMode !== 'overview'" class="cq-mobile-card__finance">
        <div class="cq-mobile-pair">
          <span>开票金额</span>
          <strong>{{ formatAmount(row.invoiceAmount) }}</strong>
        </div>
        <div class="cq-mobile-pair">
          <span>回款金额</span>
          <strong>{{ formatAmount(row.receiptAmount) }}</strong>
        </div>
        <div class="cq-mobile-pair">
          <span>贴息金额</span>
          <strong>{{ formatAmount(row.discountAmount) }}</strong>
        </div>
        <div class="cq-mobile-pair">
          <span>未开票金额</span>
          <strong>{{ formatAmount(row.uninvoicedAmount) }}</strong>
        </div>
        <div class="cq-mobile-pair">
          <span>开票欠款</span>
          <strong>{{ formatAmount(row.unreceivedAmount) }}</strong>
        </div>
        <div v-if="row.anomalyType" class="cq-mobile-pair">
          <span>异常类型</span>
          <strong>{{ anomalyLabelMap[row.anomalyType] || row.anomalyType }}</strong>
        </div>
      </div>

      <div v-if="tableMode === 'full'" class="cq-mobile-card__detail">
        <div class="cq-mobile-pair">
          <span>产品图号</span>
          <strong>{{ row.productDrawing || '-' }}</strong>
        </div>
        <div class="cq-mobile-pair">
          <span>客户模号</span>
          <strong>{{ row.customerModelNo || '-' }}</strong>
        </div>
        <div class="cq-mobile-pair">
          <span>负责人</span>
          <strong>{{ row.owner || '-' }}</strong>
        </div>
        <div class="cq-mobile-pair">
          <span>合同号</span>
          <strong>{{ row.contractNo || '-' }}</strong>
        </div>
        <div class="cq-mobile-pair">
          <span>数量 / 单价</span>
          <strong>{{ formatNumber(row.orderQuantity) }} / {{ formatAmount(row.unitPrice) }}</strong>
        </div>
        <div class="cq-mobile-pair">
          <span>费用出处</span>
          <strong>{{ row.costSource || '-' }}</strong>
        </div>
      </div>

      <div class="cq-mobile-card__footer">
        <div class="cq-mobile-card__dates">
          <span>开票 {{ row.latestInvoiceDate || '-' }}</span>
          <span>回款 {{ row.latestReceiptDate || '-' }}</span>
          <span>出货 {{ row.latestOutboundDate || '-' }}</span>
        </div>
        <el-button type="primary" link @click.stop="emit('view-insight', row)">看洞察</el-button>
      </div>
    </article>

    <el-empty v-if="!loading && !tableData.length" description="暂无数据" :image-size="120" />
  </div>
</template>

<script setup lang="ts">
import { ElButton, ElEmpty, ElTag } from 'element-plus'
import type { PropType } from 'vue'
import type { ComprehensiveQueryRow } from '@/api/comprehensive-query'
import type { TableMode } from '../types'

type TagType = 'success' | 'warning' | 'info' | 'primary' | 'danger'

defineProps({
  loading: {
    type: Boolean,
    default: false
  },
  tableData: {
    type: Array as PropType<ComprehensiveQueryRow[]>,
    default: () => []
  },
  tableMode: {
    type: String as PropType<TableMode>,
    required: true
  },
  anomalyLabelMap: {
    type: Object as PropType<Record<string, string>>,
    default: () => ({})
  },
  formatAmount: {
    type: Function as PropType<(value: number) => string>,
    required: true
  },
  formatPercent: {
    type: Function as PropType<(value: number) => string>,
    required: true
  },
  formatNumber: {
    type: Function as PropType<(value: number) => string>,
    required: true
  },
  getSettlementStatusTagType: {
    type: Function as PropType<(status?: string) => TagType>,
    required: true
  }
})

const emit = defineEmits<{
  (e: 'row-click', row: ComprehensiveQueryRow): void
  (e: 'view-insight', row: ComprehensiveQueryRow): void
}>()

const buildProgressStyle = (value: number) => {
  const normalized = Math.max(0, Math.min(100, Number(value) || 0))
  return { width: `${normalized}%` }
}
</script>

<style scoped>
.cq-mobile-card-list {
  display: flex;
  padding-bottom: 10px;
  overflow: auto;
  gap: 12px;
  flex: 1;
  flex-direction: column;
}

.cq-mobile-card {
  display: flex;
  gap: 10px;
  flex-direction: column;
  padding: 14px;
  background:
    radial-gradient(circle at top right, rgb(17 138 178 / 10%), transparent 34%),
    linear-gradient(180deg, rgb(255 255 255 / 100%), rgb(248 251 253 / 98%));
  border: 1px solid #d9e4eb;
  border-radius: 20px;
  box-shadow: 0 14px 28px rgb(15 23 42 / 7%);
}

.cq-mobile-card__head,
.cq-mobile-card__footer {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  justify-content: space-between;
}

.cq-mobile-card__hero {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cq-mobile-card__code {
  font-size: 15px;
  font-weight: 800;
  color: #152130;
}

.cq-mobile-card__title {
  font-size: 13px;
  line-height: 1.4;
  color: #4e6174;
}

.cq-mobile-card__product {
  font-size: 14px;
  font-weight: 700;
  color: #1e2f3f;
}

.cq-mobile-card__status {
  flex-shrink: 0;
}

.cq-mobile-card__strip {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.cq-mobile-card__strip span {
  padding: 5px 8px;
  font-size: 10px;
  font-weight: 700;
  color: #5f7386;
  background: #f4f7fa;
  border: 1px solid #e0e8ee;
  border-radius: 999px;
}

.cq-mobile-card__metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.cq-mobile-metric {
  display: flex;
  gap: 4px;
  flex-direction: column;
  padding: 10px;
  background: #f6fafc;
  border: 1px solid #e1eaef;
  border-radius: 14px;
}

.cq-mobile-metric__label {
  font-size: 10px;
  font-weight: 600;
  color: #68798a;
}

.cq-mobile-metric__value {
  font-size: 13px;
  font-weight: 800;
  color: #162536;
}

.cq-mobile-metric__track {
  position: relative;
  height: 6px;
  margin-top: 4px;
  overflow: hidden;
  background: #e4edf2;
  border-radius: 999px;
}

.cq-mobile-metric__bar {
  height: 100%;
  border-radius: inherit;
}

.cq-mobile-metric__bar--invoice {
  background: linear-gradient(90deg, #f59e0b 0%, #f97316 100%);
}

.cq-mobile-metric__bar--receipt {
  background: linear-gradient(90deg, #06b6d4 0%, #0ea5e9 100%);
}

.cq-mobile-card__finance,
.cq-mobile-card__detail {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 10px;
}

.cq-mobile-pair {
  display: flex;
  gap: 4px;
  flex-direction: column;
  padding: 9px 10px;
  font-size: 11px;
  color: #637284;
  background: #f8fafc;
  border: 1px solid #e2eaf0;
  border-radius: 12px;
}

.cq-mobile-pair strong {
  font-size: 12px;
  font-weight: 700;
  color: #1a2d3f;
  text-align: left;
  word-break: break-word;
}

.cq-mobile-card__dates {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  font-size: 11px;
  color: #6f7f90;
}

.cq-mobile-card__footer {
  align-items: flex-end;
}
</style>
