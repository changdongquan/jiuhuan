<template>
  <div class="print-page">
    <div class="print-toolbar">
      <div class="print-toolbar__left">
        <el-button type="primary" :icon="Printer" @click="handlePrint">打印</el-button>
        <el-button :icon="ArrowLeft" @click="handleBack">返回</el-button>
      </div>
      <div class="print-toolbar__right">
        <span class="print-toolbar__label">缩放：</span>
        <el-slider v-model="zoom" :min="0.5" :max="1.5" :step="0.1" :style="{ width: '200px' }" />
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
              <div class="doc-subtitle">客户名称：{{ documentData.客户名称 || '-' }}</div>
            </div>

            <div class="doc-info">
              <div class="doc-info__container">
                <div class="doc-info__left">
                  <div class="doc-info__row" v-if="documentData.收货方名称">
                    <div class="doc-info__item doc-info__item--full">
                      <span class="label">收货方：</span>
                      <span class="value">{{ documentData.收货方名称 || '-' }}</span>
                    </div>
                  </div>
                  <div class="doc-info__row" v-if="documentData.收货地址">
                    <div class="doc-info__item doc-info__item--full">
                      <span class="label">收货地址：</span>
                      <span class="value">{{ documentData.收货地址 || '-' }}</span>
                    </div>
                  </div>
                  <div class="doc-info__row" v-if="documentData.收货联系人">
                    <div class="doc-info__item doc-info__item--full">
                      <span class="label">联系人：</span>
                      <span class="value">{{ documentData.收货联系人 || '-' }}</span>
                    </div>
                  </div>
                  <div class="doc-info__row" v-if="documentData.收货联系电话">
                    <div class="doc-info__item doc-info__item--full">
                      <span class="label">联系电话：</span>
                      <span class="value">{{ documentData.收货联系电话 || '-' }}</span>
                    </div>
                  </div>
                </div>
                <div class="doc-info__right">
                  <div class="doc-info__row">
                    <div class="doc-info__item doc-info__item--full">
                      <span class="label">出库单号：</span>
                      <span class="value">{{ documentData.出库单号 || '-' }}</span>
                    </div>
                  </div>
                  <div class="doc-info__row">
                    <div class="doc-info__item doc-info__item--full">
                      <span class="label">出库日期：</span>
                      <span class="value">{{ formatDate(documentData.出库日期) || '-' }}</span>
                    </div>
                  </div>
                  <div class="doc-info__row">
                    <div class="doc-info__item doc-info__item--full">
                      <span class="label">仓库：</span>
                      <span class="value">{{ documentData.仓库 || '-' }}</span>
                    </div>
                  </div>
                  <div class="doc-info__row">
                    <div class="doc-info__item doc-info__item--full">
                      <span class="label">出库类型：</span>
                      <span class="value">{{ documentData.出库类型 || '-' }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="doc-table">
              <template v-if="isMeiling">
                <table class="print-table">
                  <colgroup>
                    <col style="width: 50px" />
                    <col style="width: 120px" />
                    <col style="width: 135px" />
                    <col style="width: 120px" />
                    <col style="width: 115px" />
                    <col style="width: 60px" />
                    <col style="width: 100px" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>序号</th>
                      <th>项目编号</th>
                      <th>产品名称</th>
                      <th>产品图号</th>
                      <th>客户模号</th>
                      <th class="cell-right">数量</th>
                      <th>备注</th>
                    </tr>
                  </thead>
                  <tbody>
                    <template v-for="(row, index) in documentData.details" :key="row?.id || index">
                      <tr>
                        <td class="cell-center">{{ Number(index) + 1 }}</td>
                        <td>{{ row?.项目编号 ?? '-' }}</td>
                        <td class="cell-ellipsis">{{ row?.产品名称 ?? '-' }}</td>
                        <td class="cell-ellipsis">{{ row?.产品图号 ?? '-' }}</td>
                        <td class="cell-ellipsis">{{ row?.客户模号 ?? '-' }}</td>
                        <td class="cell-right">{{ row?.出库数量 ?? '-' }}</td>
                        <td class="cell-ellipsis">{{ row?.备注 ?? '-' }}</td>
                      </tr>
                      <tr class="print-table__extra-row">
                        <td colspan="7">
                          <div class="meiling-extra-grid">
                            <div class="meiling-extra-grid__item">
                              <span class="meiling-extra-grid__label">模具穴数：</span>
                              <span class="meiling-extra-grid__value">{{
                                row?.模具穴数 ?? '-'
                              }}</span>
                            </div>
                            <div class="meiling-extra-grid__item">
                              <span class="meiling-extra-grid__label">产品材质：</span>
                              <span class="meiling-extra-grid__value">{{
                                row?.产品材质 ?? '-'
                              }}</span>
                            </div>
                            <div class="meiling-extra-grid__item">
                              <span class="meiling-extra-grid__label">模具尺寸：</span>
                              <span class="meiling-extra-grid__value">{{
                                row?.模具尺寸 ?? '-'
                              }}</span>
                            </div>
                            <div class="meiling-extra-grid__item">
                              <span class="meiling-extra-grid__label">模具重量：</span>
                              <span class="meiling-extra-grid__value">{{
                                row?.模具重量 ?? '-'
                              }}</span>
                            </div>
                            <div class="meiling-extra-grid__item">
                              <span class="meiling-extra-grid__label">流道类型：</span>
                              <span class="meiling-extra-grid__value">{{
                                row?.流道类型 ?? '-'
                              }}</span>
                            </div>
                            <div class="meiling-extra-grid__item">
                              <span class="meiling-extra-grid__label">流道数量：</span>
                              <span class="meiling-extra-grid__value">{{
                                row?.流道数量 ?? '-'
                              }}</span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    </template>
                  </tbody>
                </table>
              </template>

              <el-table v-else :data="documentData.details" border style="width: 100%" size="small">
                <el-table-column type="index" label="序号" width="50" align="center" />
                <el-table-column prop="项目编号" label="项目编号" width="120" />
                <el-table-column prop="产品名称" label="产品名称" width="135" />
                <el-table-column prop="产品图号" label="产品图号" width="120" />
                <el-table-column prop="客户模号" label="客户模号" width="115" />
                <el-table-column prop="出库数量" label="数量" width="60" align="right" />
                <el-table-column prop="备注" label="备注" width="100" />
              </el-table>

              <!-- 合计数量显示 -->
              <div class="doc-table-total">
                <span class="label">合计数量：</span>
                <span class="value">{{ totalQuantity }}</span>
              </div>
            </div>

            <div class="doc-footer">
              <div class="doc-sign doc-sign--operator">
                <div class="doc-sign__item">
                  <span class="doc-sign__label">经办人：</span>
                  <span class="doc-sign__line">{{ documentData.经办人 || '' }}</span>
                </div>
              </div>
              <div class="doc-sign doc-sign--receiver">
                <div class="doc-sign__item">
                  <span class="doc-sign__label">签收：</span>
                  <span class="doc-sign__line doc-sign__line--underline"
                    >&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span
                  >
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft, Printer } from '@element-plus/icons-vue'
import { getOutboundDocumentDetailApi } from '@/api/outbound-document'

const router = useRouter()
const route = useRoute()

const SPECIAL_PRINT_CUSTOMER_IDS = new Set<number>([51, 57])

const zoom = ref<number>(1)
const loading = ref(false)
const documentData = ref<any>(null)

const isMeiling = computed(() =>
  SPECIAL_PRINT_CUSTOMER_IDS.has(Number(documentData.value?.客户ID || 0))
)

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
  zoom: zoom.value
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

// 键盘事件处理
const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    handleBack()
  }
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
  // 添加键盘事件监听
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  // 移除键盘事件监听
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

<style scoped>
@media print {
  @page {
    margin: 0;
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
    zoom: 1 !important;
    transform: none !important;
    box-shadow: none;
  }
}

.print-page {
  display: flex;
  height: 100vh;
  min-height: 100vh;
  background: #f5f7fa;
  flex-direction: column;
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
  flex: 1;
  overflow: auto;
  align-items: flex-start;
}

.print-table {
  width: 100%;
  font-size: 12px;
  color: var(--el-text-color-primary);
  border-collapse: collapse;
  table-layout: fixed;
}

.print-table th,
.print-table td {
  padding: 6px 8px;
  vertical-align: top;
  border: 1px solid #000;
}

.print-table thead th {
  font-weight: 600;
  background: #fafafa;
}

.print-table__extra-row td {
  background: #fcfcfc;
}

.cell-center {
  text-align: center;
}

.cell-right {
  text-align: right;
}

.cell-ellipsis {
  word-break: break-word;
  white-space: normal;
  overflow-wrap: anywhere;
}

.meiling-extra-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px 12px;
  line-height: 1.5;
  color: var(--el-text-color-regular);
}

.meiling-extra-grid__item {
  display: flex;
  gap: 4px;
  min-width: 0;
}

.meiling-extra-grid__label {
  flex: 0 0 auto;
  color: var(--el-text-color-secondary);
}

.meiling-extra-grid__value {
  min-width: 0;
  word-break: break-word;
  white-space: normal;
  flex: 1 1 auto;
  overflow-wrap: anywhere;
}

:deep(.doc-table .el-table .cell) {
  line-height: 1.4;
  word-break: break-word;
  white-space: normal;
  overflow-wrap: anywhere;
}

/* 加粗 Element Plus 表格边框（仅打印预览页） */
:deep(.doc-table .el-table--border),
:deep(.doc-table .el-table--group) {
  border: 1px solid #000;
}

:deep(.doc-table .el-table--border::before) {
  height: 1px;
  background-color: #000;
}

:deep(.doc-table .el-table--border::after) {
  width: 1px;
  background-color: #000;
}

:deep(.doc-table .el-table--border .el-table__cell) {
  border-right: 1px solid #000 !important;
  border-bottom: 1px solid #000 !important;
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
  border-bottom: 1px solid #000;
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
  margin-top: 12px;
  font-size: 13px;
  color: #303133;
}

.doc-info__container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 40px;
}

.doc-info__left {
  display: grid;
  gap: 8px;
}

.doc-info__right {
  display: grid;
  gap: 8px;
  margin-left: 50px;
}

.doc-info__row {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}

.doc-info__item {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.doc-info__item--full {
  grid-column: 1;
}

.doc-info__item .label {
  color: #606266;
  text-align: right;
  white-space: nowrap;
  flex: 0 0 72px;
}

.doc-info__item .value {
  flex: 1 1 auto;
  min-width: 0;
  color: #303133;
}

.doc-table {
  margin-top: 14px;
}

.doc-table-total {
  margin-top: 12px;
  font-size: 13px;
  color: #303133;
  text-align: right;
}

.doc-table-total .label {
  margin-right: 8px;
  color: #606266;
}

.doc-table-total .value {
  color: #303133;
}

.doc-footer {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 40px;
  margin-top: 32px;
  font-size: 13px;
  color: #303133;
  align-items: flex-end;
}

.doc-footer > :last-child {
  /* 签收在右侧，对齐到 grid 第二列（与收货方对齐） */
  margin-left: 50px;
}

.doc-sign {
  display: flex;
  gap: 26px;
  color: #606266;
}

.doc-sign__item {
  display: flex;
  align-items: center;
  min-width: 70px;
  text-align: left;
}

.doc-sign__label {
  margin-right: 4px;
  text-align: right;
  white-space: nowrap;
  flex: 0 0 72px;
}

.doc-sign__line {
  display: inline-block;
  min-width: 120px;
  margin-bottom: 2px;
  line-height: 1.5;
  border-bottom: 1px solid #000;
  flex: 1;
}

.doc-sign__line--underline {
  display: inline-block;
  min-width: 120px;
  padding-bottom: 2px;
  letter-spacing: 0.05em;
  text-decoration: underline;
  border-bottom: none;
  text-decoration-color: #000;
  text-decoration-thickness: 1px;
  text-underline-offset: 0.15em;
}
</style>
