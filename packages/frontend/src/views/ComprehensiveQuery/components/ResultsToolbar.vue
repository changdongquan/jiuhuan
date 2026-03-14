<template>
  <div class="cq-results__toolbar">
    <div class="cq-results__intro">
      <div class="cq-results__eyebrow">Mobile Workbench</div>
      <div class="cq-results__title">结果工作台</div>
      <div class="cq-results__desc">统一查看列表、财务字段与项目阶段时间线。</div>
      <div v-if="isMobile && hasAppliedSearch" class="cq-mobile-results-meta">
        <span>{{ total }} 条结果</span>
        <span>当前视图：{{ activeView === 'table' ? '列表' : '洞察' }}</span>
        <span v-if="activeView === 'table'">信息层级：{{ mobileTableModeText }}</span>
      </div>
    </div>
    <div class="cq-results__actions">
      <el-button
        class="cq-action-btn cq-action-btn--export"
        :disabled="!hasAppliedSearch"
        :loading="exporting"
        @click="emit('export')"
      >
        导出 Excel
      </el-button>
      <div class="cq-switch-group">
        <button
          type="button"
          class="cq-switch-chip"
          :class="{ 'cq-switch-chip--active': activeView === 'table' }"
          @click="emit('update:activeView', 'table')"
        >
          列表工作台
        </button>
        <button
          type="button"
          class="cq-switch-chip"
          :class="{ 'cq-switch-chip--active': activeView === 'insights' }"
          @click="emit('update:activeView', 'insights')"
        >
          阶段洞察
        </button>
      </div>

      <div v-if="activeView === 'table'" class="cq-switch-group cq-switch-group--compact">
        <button
          type="button"
          class="cq-switch-chip cq-switch-chip--compact"
          :class="{ 'cq-switch-chip--active': tableMode === 'overview' }"
          @click="emit('update:tableMode', 'overview')"
        >
          概览
        </button>
        <button
          type="button"
          class="cq-switch-chip cq-switch-chip--compact"
          :class="{ 'cq-switch-chip--active': tableMode === 'finance' }"
          @click="emit('update:tableMode', 'finance')"
        >
          财务
        </button>
        <button
          type="button"
          class="cq-switch-chip cq-switch-chip--compact"
          :class="{ 'cq-switch-chip--active': tableMode === 'full' }"
          @click="emit('update:tableMode', 'full')"
        >
          全量字段
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ElButton } from 'element-plus'
import type { PropType } from 'vue'
import type { TableMode } from '../types'

defineProps({
  activeView: {
    type: String as PropType<'table' | 'insights'>,
    required: true
  },
  tableMode: {
    type: String as PropType<TableMode>,
    required: true
  },
  hasAppliedSearch: {
    type: Boolean,
    default: false
  },
  exporting: {
    type: Boolean,
    default: false
  },
  total: {
    type: Number,
    default: 0
  },
  isMobile: {
    type: Boolean,
    default: false
  },
  mobileTableModeText: {
    type: String,
    default: ''
  }
})

const emit = defineEmits<{
  (e: 'export'): void
  (e: 'update:activeView', value: 'table' | 'insights'): void
  (e: 'update:tableMode', value: TableMode): void
}>()
</script>

<style scoped>
.cq-results__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 6px;
  flex-shrink: 0;
}

.cq-results__intro {
  display: flex;
  flex-direction: column;
}

.cq-results__eyebrow {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.14em;
  color: #118ab2;
  text-transform: uppercase;
}

.cq-results__title {
  font-size: 13px;
  font-weight: 700;
  color: #152130;
}

.cq-results__desc {
  display: none;
}

.cq-mobile-results-meta {
  display: flex;
  gap: 6px;
  margin-top: 8px;
  flex-wrap: wrap;
}

.cq-mobile-results-meta span {
  padding: 4px 9px;
  font-size: 10px;
  font-weight: 600;
  color: #4f6476;
  background: linear-gradient(180deg, #f6fafc 0%, #edf3f7 100%);
  border: 1px solid #dce6ed;
  border-radius: 999px;
}

.cq-results__actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.cq-switch-group {
  display: inline-flex;
  gap: 6px;
  padding: 4px;
  background: linear-gradient(180deg, #f5f8fb 0%, #edf2f6 100%);
  border: 1px solid #dae2e8;
  border-radius: 999px;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 75%);
}

.cq-switch-group--compact {
  background: #fbfcfd;
}

.cq-switch-chip {
  padding: 6px 10px;
  font-size: 10px;
  font-weight: 600;
  color: #556273;
  cursor: pointer;
  background: transparent;
  border: none;
  border-radius: 999px;
  transition: all 0.2s ease;
}

.cq-switch-chip--compact {
  padding: 4px 8px;
}

.cq-switch-chip--active {
  color: #152130;
  background: linear-gradient(180deg, #fff 0%, #f8fbfd 100%);
  box-shadow: 0 6px 16px rgb(15 23 42 / 9%);
}

:deep(.cq-action-btn--export) {
  color: #18303a;
  background: linear-gradient(180deg, rgb(242 247 248 / 98%), rgb(229 238 240 / 98%));
  border-color: #bed0d6;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 76%),
    0 10px 18px rgb(64 104 116 / 10%);
}

@media (width <= 768px) {
  .cq-results__toolbar {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }

  .cq-results__actions {
    justify-content: flex-start;
  }

  :deep(.cq-action-btn--export) {
    width: 100%;
  }

  .cq-switch-group {
    width: 100%;
    justify-content: flex-start;
    overflow: auto hidden;
    scrollbar-width: none;
  }

  .cq-switch-chip {
    flex: 0 0 auto;
    min-width: max-content;
  }
}
</style>
