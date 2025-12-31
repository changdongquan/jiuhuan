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
          <el-option :value="0.5" label="50%" />
          <el-option :value="0.75" label="75%" />
          <el-option :value="1" label="100%" />
        </el-select>
      </div>
    </div>

    <div class="print-canvas">
      <div class="paper" :style="paperStyle">
        <div v-if="loading" class="paper__loading">
          <el-skeleton :rows="8" animated />
        </div>

        <template v-else>
          <div v-if="!documentData" class="paper__empty">
            <el-empty description="暂无出库单数据" />
          </div>

          <div v-else class="paper__content">
            <div class="doc-header">
              <div class="doc-title">出库单</div>
              <div class="doc-subtitle">出库单号：{{ documentData.出库单号 || '-' }}</div>
            </div>

            <div class="doc-info">
              <div class="doc-info__row">
                <div class="doc-info__item">
                  <span class="label">客户名称：</span>
                  <span class="value">{{ documentData.客户名称 || '-' }}</span>
                </div>
                <div class="doc-info__item">
                  <span class="label">出库类型：</span>
                  <span class="value">{{ documentData.出库类型 || '-' }}</span>
                </div>
                <div class="doc-info__item">
                  <span class="label">仓库：</span>
                  <span class="value">{{ documentData.仓库 || '-' }}</span>
                </div>
              </div>
              <div class="doc-info__row">
                <div class="doc-info__item">
                  <span class="label">出库日期：</span>
                  <span class="value">{{ formatDate(documentData.出库日期) || '-' }}</span>
                </div>
                <div class="doc-info__item">
                  <span class="label">经办人：</span>
                  <span class="value">{{ documentData.经办人 || '-' }}</span>
                </div>
                <div class="doc-info__item">
                  <span class="label">备注：</span>
                  <span class="value">{{ documentData.备注 || '-' }}</span>
                </div>
              </div>
            </div>

            <div class="doc-table">
              <el-table :data="documentData.details" border style="width: 100%" size="small">
                <el-table-column prop="项目编号" label="项目编号" min-width="110" />
                <el-table-column
                  prop="产品名称"
                  label="产品名称"
                  min-width="160"
                  show-overflow-tooltip
                />
                <el-table-column
                  prop="产品图号"
                  label="产品图号"
                  min-width="120"
                  show-overflow-tooltip
                />
                <el-table-column
                  prop="客户模号"
                  label="客户模号"
                  min-width="120"
                  show-overflow-tooltip
                />
                <el-table-column prop="出库数量" label="出库数量" width="90" align="right" />
                <el-table-column prop="备注" label="备注" min-width="120" show-overflow-tooltip />
              </el-table>
            </div>

            <div class="doc-footer">
              <div class="doc-total">
                <span class="label">合计数量：</span>
                <span class="value">{{ totalQuantity }}</span>
              </div>
              <div class="doc-sign">
                <div class="doc-sign__item">制单：</div>
                <div class="doc-sign__item">审核：</div>
                <div class="doc-sign__item">签收：</div>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { getOutboundDocumentDetailApi } from '@/api/outbound-document'

const router = useRouter()
const route = useRoute()

const zoom = ref<number>(0.75)
const loading = ref(false)
const documentData = ref<any>(null)

const totalQuantity = computed(() => {
  const details = Array.isArray(documentData.value?.details) ? documentData.value.details : []
  const total = details.reduce((sum: number, row: any) => sum + Number(row?.出库数量 || 0), 0)
  return Number.isFinite(total) ? total : 0
})

const formatDate = (val: any) => {
  if (!val) return ''
  const text = String(val)
  if (text.includes('T')) return text.split('T')[0]
  if (text.includes(' ')) return text.split(' ')[0]
  return text
}

const fromPath = computed(() => {
  const raw = route.query.from
  return typeof raw === 'string' ? raw : ''
})

const paperStyle = computed(() => ({
  transform: `scale(${zoom.value})`
}))

const handleBack = () => {
  if (fromPath.value) {
    void router.push(fromPath.value)
    return
  }
  router.back()
}

const handlePrint = () => {
  window.print()
}

const loadData = async () => {
  const documentNo = String(route.params.documentNo || '').trim()
  if (!documentNo) {
    ElMessage.error('缺少出库单号')
    return
  }

  loading.value = true
  try {
    const response: any = await getOutboundDocumentDetailApi(documentNo)
    const data = response?.data?.data || response?.data || null
    const details = Array.isArray(data?.details) ? data.details : []
    documentData.value = data ? { ...data, details } : null
  } catch (error) {
    console.error('加载出库单打印数据失败:', error)
    ElMessage.error('加载出库单数据失败')
    documentData.value = null
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void loadData()
})
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

.paper__loading,
.paper__empty {
  padding: 16px;
}

.doc-header {
  padding-bottom: 10px;
  text-align: center;
  border-bottom: 1px solid #dcdfe6;
}

.doc-title {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 2px;
  color: #303133;
}

.doc-subtitle {
  margin-top: 6px;
  font-size: 13px;
  color: #606266;
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

.doc-info__item .label {
  color: #606266;
}

.doc-info__item .value {
  color: #303133;
}

.doc-table {
  margin-top: 14px;
}

.doc-footer {
  display: flex;
  margin-top: 14px;
  font-size: 13px;
  color: #303133;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
}

.doc-total .label {
  color: #606266;
}

.doc-sign {
  display: flex;
  gap: 26px;
  color: #606266;
}

.doc-sign__item {
  min-width: 70px;
  padding-top: 8px;
  text-align: center;
  border-top: 1px solid #dcdfe6;
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
