<template>
  <aside
    class="cq-sidebar"
    :class="{ 'cq-sidebar--mobile-collapsed': isMobile && !mobileFiltersExpanded }"
  >
    <section class="cq-panel cq-panel--primary">
      <div class="cq-panel__head">
        <div>
          <div class="cq-panel__eyebrow">Mobile Query Deck</div>
          <div class="cq-panel__title">查询输入</div>
          <div class="cq-panel__desc">先锁定项目，再叠加客户、票款和进度范围。</div>
        </div>
        <span class="cq-status-pill" :class="{ 'cq-status-pill--dirty': filtersDirty }">
          {{ draftStatusText }}
        </span>
      </div>

      <el-form :model="queryForm" label-position="top" class="cq-form">
        <el-form-item label="关键词">
          <el-input
            :model-value="queryForm.keyword"
            placeholder="项目编号 / 产品名称 / 产品图号"
            clearable
            @update:model-value="patchQueryForm({ keyword: normalizeText($event) })"
            @keyup.enter="emit('apply-search')"
          />
        </el-form-item>
        <div class="cq-mobile-filter-pills">
          <span class="cq-mobile-filter-pill">关键词优先</span>
          <span class="cq-mobile-filter-pill">票款二筛</span>
          <span class="cq-mobile-filter-pill">结果直达洞察</span>
        </div>
        <div class="cq-actions">
          <el-button
            type="primary"
            class="cq-action-btn cq-action-btn--apply"
            :loading="loading"
            @click="emit('apply-search')"
          >
            应用筛选
          </el-button>
          <el-button
            class="cq-action-btn cq-action-btn--restore"
            :disabled="!filtersDirty"
            @click="emit('restore-draft')"
          >
            还原草稿
          </el-button>
          <el-button class="cq-action-btn cq-action-btn--clear" @click="emit('reset-workspace')">
            清空
          </el-button>
        </div>
        <button
          v-if="isMobile"
          type="button"
          class="cq-mobile-filter-toggle"
          @click="emit('update:mobileFiltersExpanded', !mobileFiltersExpanded)"
        >
          {{ mobileFiltersExpanded ? '收起更多筛选' : '展开更多筛选' }}
        </button>
      </el-form>
    </section>

    <section v-show="!isMobile || mobileFiltersExpanded" class="cq-panel">
      <div class="cq-panel__head">
        <div>
          <div class="cq-panel__title">基础筛选</div>
          <div class="cq-panel__desc">优先缩小客户、分类和订单日期范围。</div>
        </div>
      </div>
      <el-form :model="queryForm" label-position="top" class="cq-form">
        <el-form-item label="客户">
          <el-select
            :model-value="queryForm.customerName"
            filterable
            clearable
            placeholder="全部客户"
            @update:model-value="patchQueryForm({ customerName: normalizeText($event) })"
          >
            <el-option v-for="item in customerOptions" :key="item" :label="item" :value="item" />
          </el-select>
        </el-form-item>
        <el-form-item label="分类">
          <el-select
            :model-value="queryForm.category"
            filterable
            clearable
            placeholder="全部分类"
            @update:model-value="patchQueryForm({ category: normalizeText($event) })"
          >
            <el-option v-for="item in categoryOptions" :key="item" :label="item" :value="item" />
          </el-select>
        </el-form-item>
        <el-form-item label="订单日期">
          <el-date-picker
            :model-value="queryForm.dateRange"
            type="daterange"
            value-format="YYYY-MM-DD"
            range-separator="~"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            clearable
            class="cq-date-picker"
            @update:model-value="patchDateRange($event)"
          />
        </el-form-item>
      </el-form>
    </section>

    <section v-show="!isMobile || mobileFiltersExpanded" class="cq-panel">
      <div class="cq-panel__head">
        <div>
          <div class="cq-panel__title">财务筛选</div>
          <div class="cq-panel__desc">按订单结款、开票状态和执行进度做财务收敛。</div>
        </div>
      </div>
      <el-form :model="queryForm" label-position="top" class="cq-form">
        <el-form-item label="结款状态">
          <el-select
            :model-value="queryForm.settlementStatus"
            clearable
            placeholder="全部"
            @update:model-value="patchQueryForm({ settlementStatus: normalizeText($event) })"
          >
            <el-option label="订单已结清" value="销售已结清" />
            <el-option label="订单未结清" value="销售未结清" />
          </el-select>
        </el-form-item>
        <el-form-item label="开票状态">
          <el-select
            :model-value="queryForm.invoiceStatus"
            clearable
            placeholder="全部"
            @update:model-value="patchQueryForm({ invoiceStatus: normalizeText($event) })"
          >
            <el-option label="未开票" value="未开票" />
            <el-option label="仅开部分发票" value="仅开部分发票" />
            <el-option label="已开全额发票" value="已开全额发票" />
          </el-select>
        </el-form-item>
        <el-form-item label="发票回款状态">
          <el-select
            :model-value="queryForm.receiptStatus"
            clearable
            placeholder="全部"
            @update:model-value="patchQueryForm({ receiptStatus: normalizeText($event) })"
          >
            <el-option label="待回款" value="待回款" />
            <el-option label="部分回款" value="部分回款" />
            <el-option label="已结清" value="已结清" />
          </el-select>
        </el-form-item>
        <el-form-item label="执行进度">
          <div class="cq-progress-range">
            <el-select
              :model-value="queryForm.progressType"
              clearable
              placeholder="选择指标"
              @update:model-value="patchQueryForm({ progressType: normalizeText($event) })"
            >
              <el-option
                label="开票百分比"
                value="invoice"
                :disabled="invoiceProgressTypeDisabled"
              />
              <el-option label="回款百分比" value="receipt" />
            </el-select>
            <div class="cq-progress-range__inputs">
              <el-input
                :model-value="queryForm.progressMin"
                placeholder="最小%"
                clearable
                inputmode="decimal"
                :disabled="progressRangeDisabled"
                @update:model-value="patchQueryForm({ progressMin: normalizeText($event) })"
              />
              <span class="cq-progress-range__divider">-</span>
              <el-input
                :model-value="queryForm.progressMax"
                placeholder="最大%"
                clearable
                inputmode="decimal"
                :disabled="progressRangeDisabled"
                @update:model-value="patchQueryForm({ progressMax: normalizeText($event) })"
              />
            </div>
          </div>
        </el-form-item>
      </el-form>
    </section>
  </aside>
</template>

<script setup lang="ts">
import {
  ElButton,
  ElDatePicker,
  ElForm,
  ElFormItem,
  ElInput,
  ElOption,
  ElSelect
} from 'element-plus'
import type { PropType } from 'vue'
import type { QueryForm } from '../types'

defineProps({
  queryForm: {
    type: Object as PropType<QueryForm>,
    required: true
  },
  loading: {
    type: Boolean,
    default: false
  },
  filtersDirty: {
    type: Boolean,
    default: false
  },
  draftStatusText: {
    type: String,
    default: ''
  },
  customerOptions: {
    type: Array as PropType<string[]>,
    default: () => []
  },
  categoryOptions: {
    type: Array as PropType<string[]>,
    default: () => []
  },
  isMobile: {
    type: Boolean,
    default: false
  },
  mobileFiltersExpanded: {
    type: Boolean,
    default: false
  },
  invoiceProgressTypeDisabled: {
    type: Boolean,
    default: false
  },
  progressRangeDisabled: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits<{
  (e: 'apply-search'): void
  (e: 'restore-draft'): void
  (e: 'reset-workspace'): void
  (e: 'update:mobileFiltersExpanded', value: boolean): void
  (e: 'patch-query-form', value: Partial<QueryForm>): void
}>()

const normalizeText = (value: unknown) => String(value ?? '')

const patchQueryForm = (value: Partial<QueryForm>) => {
  emit('patch-query-form', value)
}

const patchDateRange = (value: unknown) => {
  const dates =
    Array.isArray(value) && value.length === 2 ? [String(value[0]), String(value[1])] : []
  emit('patch-query-form', { dateRange: dates as QueryForm['dateRange'] })
}
</script>

<style scoped>
.cq-sidebar {
  display: flex;
  min-height: 0;
  padding-right: 2px;
  overflow: hidden auto;
  flex-direction: column;
  gap: 8px;
  scrollbar-gutter: stable;
}

.cq-sidebar--mobile-collapsed {
  overflow: visible;
}

.cq-panel {
  padding: 14px;
  background: rgb(255 255 255 / 88%);
  border: 1px solid rgb(214 223 231 / 90%);
  border-radius: 24px;
  box-shadow: 0 18px 40px rgb(15 23 42 / 7%);
  backdrop-filter: blur(12px);
}

.cq-panel--primary {
  background:
    linear-gradient(180deg, rgb(255 255 255 / 94%), rgb(247 251 253 / 92%)),
    linear-gradient(135deg, rgb(17 138 178 / 7%), transparent);
}

.cq-panel__head {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 10px;
}

.cq-panel__eyebrow {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.14em;
  color: #118ab2;
  text-transform: uppercase;
}

.cq-panel__title {
  font-size: 15px;
  font-weight: 700;
  color: #152130;
}

.cq-panel__desc {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.5;
  color: #6a7989;
}

.cq-status-pill {
  display: inline-flex;
  align-items: center;
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 600;
  color: #547184;
  background: #eef4f8;
  border-radius: 999px;
}

.cq-status-pill--dirty {
  color: #8f5e00;
  background: #fff5df;
}

.cq-form :deep(.el-form-item) {
  margin-bottom: 12px;
}

.cq-form :deep(.el-form-item__label) {
  font-size: 12px;
  font-weight: 600;
  color: #546678;
}

.cq-mobile-filter-pills {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin: -2px 0 12px;
}

.cq-mobile-filter-pill {
  padding: 5px 9px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: #35556b;
  background: linear-gradient(180deg, rgb(246 249 251 / 100%), rgb(235 242 246 / 100%));
  border: 1px solid #d7e3ea;
  border-radius: 999px;
}

.cq-actions {
  display: flex;
  gap: 8px;
  flex-wrap: nowrap;
  align-items: stretch;
}

.cq-actions :deep(.el-button) {
  margin: 0;
}

.cq-actions :deep(.el-button:not(.is-text)) {
  flex: 1;
  min-width: 0;
}

:deep(.cq-action-btn) {
  height: 36px;
  padding: 0 14px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.01em;
  border-width: 1px;
  border-radius: 12px;
  backdrop-filter: blur(10px);
}

:deep(.cq-action-btn--apply) {
  background: linear-gradient(135deg, #60a5fa, #3b82f6);
  border-color: #3b82f6;
  box-shadow: 0 10px 18px rgb(59 130 246 / 18%);
}

:deep(.cq-action-btn--restore) {
  color: #21485b;
  background: linear-gradient(180deg, rgb(244 248 251 / 96%), rgb(234 241 246 / 96%));
  border-color: #c9d7e2;
}

:deep(.cq-action-btn--clear) {
  flex: 0 0 auto;
  padding-inline: 12px;
  color: #8a5b5b;
  background: linear-gradient(180deg, rgb(255 250 249 / 100%), rgb(250 241 239 / 100%));
  border-color: rgb(234 209 204 / 95%);
}

.cq-mobile-filter-toggle {
  width: 100%;
  padding: 9px 12px;
  margin-top: 10px;
  font-size: 12px;
  font-weight: 700;
  color: #1b4f66;
  cursor: pointer;
  background: linear-gradient(180deg, rgb(236 245 249 / 96%), rgb(224 238 244 / 96%));
  border: 1px solid #c9dbe4;
  border-radius: 12px;
}

.cq-date-picker {
  width: 100%;
}

.cq-progress-range {
  display: grid;
  gap: 8px;
}

.cq-progress-range__inputs {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  gap: 8px;
  align-items: center;
}

.cq-progress-range__divider {
  font-size: 12px;
  color: #6a7989;
}

@media (width <= 768px) {
  .cq-sidebar {
    padding-right: 0;
    overflow: visible;
  }

  .cq-panel--primary {
    position: sticky;
    top: 0;
    z-index: 2;
  }

  .cq-panel {
    border-radius: 20px;
  }

  .cq-panel__head {
    align-items: flex-start;
    flex-direction: column;
  }

  .cq-status-pill {
    align-self: flex-start;
  }
}
</style>
