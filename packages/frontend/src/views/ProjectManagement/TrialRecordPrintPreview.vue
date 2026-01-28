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
      <template v-if="loading">
        <div class="text-center py-10">
          <el-icon class="is-loading text-4xl"><Loading /></el-icon>
          <p class="mt-4">加载中...</p>
        </div>
      </template>
      <template v-else-if="trialRecordData">
        <div class="paper" :style="paperPreviewStyle">
          <div class="trial-record-page">
            <!-- 页眉（来自 Word 模板 Header） -->
            <div class="trial-record-page-header"
              >表格编号：{{ trialRecordData.form_no || '-' }}</div
            >

            <!-- 标题（与 Word 模板一致：两行居中） -->
            <div class="trial-record-title">
              <div class="trial-record-title-line">长虹美菱股份有限公司</div>
              <div class="trial-record-title-line">
                <span class="trial-record-title-product" v-text="productInfoText"></span>
                <span class="trial-record-title-suffix">模具试模记录表</span>
              </div>
            </div>

            <table class="trial-record-table" cellspacing="0" cellpadding="0">
              <colgroup>
                <!-- 根据 Word 模板（dxa -> mm）定义列宽：4列布局 -->
                <col style="width: 29.42mm" />
                <col style="width: 62.63mm" />
                <col style="width: 33.7mm" />
                <col style="width: 64.61mm" />
              </colgroup>

              <tbody>
                <!-- 第1行：合同约定模具交付时间 / 模具性质 -->
                <tr class="trial-record-row trial-record-row-1">
                  <td class="trial-record-label-cell trial-record-align-left"
                    >合同约定模具交付时间</td
                  >
                  <td class="trial-record-value-cell trial-record-align-center">
                    <div class="trial-record-date-line">
                      <span class="trial-record-underline trial-record-underline--year"></span
                      >年<span class="trial-record-underline trial-record-underline--month"></span
                      >月<span class="trial-record-underline trial-record-underline--day"></span
                      >日<span class="trial-record-underline trial-record-underline--hour"></span>时
                    </div>
                  </td>
                  <td class="trial-record-label-cell trial-record-align-center">模具性质</td>
                  <td
                    class="trial-record-value-cell trial-record-align-center trial-record-checkbox-cell"
                    >□新品模具 □复制模具 □改制模具</td
                  >
                </tr>

                <!-- 第2行：模具实际交付时间 / 模具编号 -->
                <tr class="trial-record-row trial-record-row-2">
                  <td class="trial-record-label-cell trial-record-align-left">模具实际交付时间</td>
                  <td class="trial-record-value-cell trial-record-align-center">
                    <div class="trial-record-date-line">
                      <span class="trial-record-underline trial-record-underline--year is-filled">{{
                        trialRecordData.outbound_date_year || ''
                      }}</span
                      >年<span
                        class="trial-record-underline trial-record-underline--month is-filled"
                        >{{ trialRecordData.outbound_date_month || '' }}</span
                      >月<span
                        class="trial-record-underline trial-record-underline--day is-filled"
                        >{{ trialRecordData.outbound_date_day || '' }}</span
                      >日<span class="trial-record-underline trial-record-underline--hour"></span>时
                    </div>
                  </td>
                  <td class="trial-record-label-cell trial-record-align-center">模具编号</td>
                  <td
                    class="trial-record-value-cell trial-record-align-center trial-record-mould-no"
                  >
                    {{ trialRecordData.mould_no || '-' }}
                  </td>
                </tr>

                <!-- 第3行：项目产品型号 / 试模起止时间 -->
                <tr class="trial-record-row trial-record-row-3">
                  <td class="trial-record-label-cell trial-record-align-center">项目产品型号</td>
                  <td class="trial-record-value-cell trial-record-align-center"></td>
                  <td class="trial-record-label-cell trial-record-align-center">试模起止时间</td>
                  <td class="trial-record-value-cell">
                    <div class="trial-record-datetime-line">
                      <span class="trial-record-underline trial-record-underline--year"></span
                      >年<span class="trial-record-underline trial-record-underline--month"></span
                      >月<span class="trial-record-underline trial-record-underline--day"></span
                      >日<span class="trial-record-underline trial-record-underline--hour"></span
                      >时<span class="trial-record-underline trial-record-underline--minute"></span
                      >分
                    </div>
                    <div class="trial-record-datetime-line">
                      <span class="trial-record-underline trial-record-underline--year"></span
                      >年<span class="trial-record-underline trial-record-underline--month"></span
                      >月<span class="trial-record-underline trial-record-underline--day"></span
                      >日<span class="trial-record-underline trial-record-underline--hour"></span
                      >时<span class="trial-record-underline trial-record-underline--minute"></span
                      >分
                    </div>
                  </td>
                </tr>

                <!-- 第4行：试模单位 / 模具供应商 -->
                <tr class="trial-record-row trial-record-row-4">
                  <td class="trial-record-label-cell trial-record-align-center">试模单位</td>
                  <td class="trial-record-value-cell trial-record-align-center">{{
                    trialRecordData.receiver_name || '-'
                  }}</td>
                  <td class="trial-record-label-cell trial-record-align-center">模具供应商</td>
                  <td class="trial-record-value-cell trial-record-align-center"
                    >合肥市久环模具设备制造有限公司</td
                  >
                </tr>

                <!-- 第5行：项目负责人 / 本次是该模具第几次试模 -->
                <tr class="trial-record-row trial-record-row-5">
                  <td class="trial-record-label-cell trial-record-align-center">项目负责人</td>
                  <td class="trial-record-value-cell trial-record-align-center"></td>
                  <td class="trial-record-label-cell trial-record-align-center"
                    >本次是该模具第几次试模</td
                  >
                  <td class="trial-record-value-cell trial-record-align-center"></td>
                </tr>

                <!-- 第6行：试模申请人 / 试模单位负责人 -->
                <tr class="trial-record-row trial-record-row-6">
                  <td class="trial-record-label-cell trial-record-align-center">试模申请人</td>
                  <td class="trial-record-value-cell trial-record-align-center"></td>
                  <td class="trial-record-label-cell trial-record-align-center">试模单位负责人</td>
                  <td class="trial-record-value-cell trial-record-align-center"></td>
                </tr>

                <!-- 第7行：本次试模情况及主要问题简述 -->
                <tr class="trial-record-row trial-record-row-7">
                  <td colspan="1" class="trial-record-label-cell trial-record-align-center"
                    >本次试模情况及主要问题简述（含工艺参数）（试模单位填写）</td
                  >
                  <td colspan="3" class="trial-record-value-cell trial-record-align-center"></td>
                </tr>

                <!-- 第8行：本次试模主要问题拟解决后交货时间 -->
                <tr class="trial-record-row trial-record-row-8">
                  <td colspan="1" class="trial-record-label-cell trial-record-align-left"
                    >本次试模主要问题拟解决后交货时间（模具制造商填写、并署名）</td
                  >
                  <td colspan="3" class="trial-record-value-cell trial-record-align-center"></td>
                </tr>

                <!-- 第9行：研究院/品质部意见 -->
                <tr class="trial-record-row trial-record-row-9">
                  <td colspan="1" class="trial-record-label-cell trial-record-align-left"
                    >研究院/品质部意见（填写并签字）</td
                  >
                  <td colspan="3" class="trial-record-value-cell trial-record-align-center"></td>
                </tr>

                <!-- 第10行：模具主管部门意见 -->
                <tr class="trial-record-row trial-record-row-10">
                  <td colspan="1" class="trial-record-label-cell trial-record-align-left"
                    >模具主管部门意见</td
                  >
                  <td colspan="3" class="trial-record-value-cell trial-record-align-center"></td>
                </tr>
              </tbody>
            </table>

            <!-- 记录日期 / 编号（按需求：放在表格下方、注意事项上方） -->
            <div class="trial-record-meta">
              <div class="trial-record-meta-left">
                <span>记录日期：</span>
                <span class="trial-record-meta-date-line">
                  <span class="trial-record-underline trial-record-underline--record-year"></span>年
                  <span class="trial-record-underline trial-record-underline--record-month"></span
                  >月
                  <span class="trial-record-underline trial-record-underline--record-day"></span>日
                </span>
              </div>
              <div class="trial-record-meta-right">编号：</div>
            </div>

            <!-- 注意（与 Word 模板一致：表格下方） -->
            <div class="trial-record-note">
              注意：1、试模结束时项目负责人组织填写，此表是模具移交的资料之一。
            </div>
          </div>
        </div>
      </template>
      <template v-else>
        <div class="text-center py-10">
          <p class="text-lg text-gray-500">未找到数据</p>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft, Loading, Printer } from '@element-plus/icons-vue'
import { getProjectDetailApi } from '@/api/project'
import { getOutboundDocumentListApi } from '@/api/outbound-document'

const router = useRouter()
const route = useRoute()

const zoom = ref<number>(1)
const loading = ref(false)
const trialRecordData = ref<any>(null)

const paperPreviewStyle = computed(() => ({ zoom: zoom.value }) as any)

const productInfoText = computed(() => {
  const data = trialRecordData.value
  const drawing = String(data?.product_drawing || '').trim()
  const name = String(data?.product_name || '').trim()
  const text = `${drawing} ${name}`.trim()
  return text || ' '
})

const handlePrint = () => {
  window.print()
}

const handleBack = () => {
  const fromPath = route.query.from as string
  if (fromPath) {
    router.push(fromPath)
  } else {
    router.back()
  }
}

const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    handleBack()
  }
}

const formatDate = (val: any) => {
  if (!val) return ''
  const text = String(val)
  if (text.includes('T')) return text.split('T')[0]
  if (text.includes(' ')) return text.split(' ')[0]
  return text
}

const loadData = async () => {
  const projectCode = route.params.projectCode as string
  if (!projectCode) {
    ElMessage.error('项目编号不能为空')
    return
  }

  loading.value = true
  try {
    // 1. 获取项目数据
    const projectResponse: any = await getProjectDetailApi(projectCode)
    const projectData = projectResponse?.data?.data || projectResponse?.data || projectResponse

    if (!projectData) {
      ElMessage.error('未找到项目数据')
      trialRecordData.value = null
      return
    }

    // 2. 查询项目关联的出库单（通过项目编号查询）
    let outboundData: any = {
      出库日期: null,
      收货方名称: ''
    }

    try {
      // 使用出库单列表 API，通过 keyword 查询项目编号
      const outboundResponse: any = await getOutboundDocumentListApi({
        keyword: projectCode,
        page: 1,
        pageSize: 1,
        sortField: '出库日期',
        sortOrder: 'desc' // 获取最新的出库单
      })

      const outboundList = outboundResponse?.data?.list || outboundResponse?.data || []
      if (outboundList.length > 0) {
        const latestOutbound = outboundList[0]
        outboundData = {
          出库日期: latestOutbound.出库日期,
          收货方名称: latestOutbound.收货方名称 || ''
        }
      }
    } catch (error) {
      console.warn('获取出库单数据失败，使用默认值', error)
    }

    // 3. 解析日期（无出库日期则保持空白，不使用当天日期兜底）
    const dateParts = outboundData.出库日期 ? formatDate(outboundData.出库日期).split('-') : []

    // 4. 构建数据（映射到占位符）
    trialRecordData.value = {
      form_no: 'ML78/297-1',
      outbound_date_year: dateParts[0] || '',
      outbound_date_month: dateParts[1] || '',
      outbound_date_day: dateParts[2] || '',
      product_drawing: projectData.productDrawing || projectData.产品图号 || '',
      product_name: projectData.productName || projectData.产品名称 || '',
      mould_no: projectData.客户模号 || '',
      receiver_name: outboundData.收货方名称 || projectData.客户名称 || ''
    }
  } catch (error) {
    console.error('加载试模记录单数据失败:', error)
    ElMessage.error('加载数据失败')
    trialRecordData.value = null
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void loadData()
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

<style scoped>
@media print {
  @page {
    margin: 0;
    margin-bottom: 0;
    size: a4;
  }

  html,
  body {
    padding: 0;
    margin: 0;
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
    height: auto;
    min-height: auto;
    padding: 0;
    margin: 0;
    overflow: visible;
    border-radius: 0;
    zoom: 1 !important;
    transform: none !important;
    box-shadow: none;
    box-sizing: border-box;
    page-break-inside: avoid;
  }

  .trial-record-page {
    padding: 0 4.39mm 4.6mm 4.2mm;
  }

  .trial-record-page-header {
    margin: 0;
    margin-left: 4.76mm;
    font-family: SimSun, '宋体', serif;
    font-size: 9pt;
    color: #000;
  }

  .trial-record-title {
    margin: 0;
    text-align: center;
  }

  .trial-record-title-line {
    font-family: SimSun, '宋体', serif;
    font-size: 15pt;
    font-weight: bold;
    line-height: 2;
  }

  .trial-record-title-product {
    display: inline-block;
    min-width: 70mm;
    padding: 0 2mm;
    margin-right: 6mm;
    text-align: center;
    border-bottom: 1px solid #000;
    box-sizing: border-box;
  }

  .trial-record-title-suffix {
    white-space: nowrap;
  }

  .trial-record-meta {
    display: flex;
    width: 190.36mm;
    margin: 2mm auto;
    font-family: SimSun, '宋体', serif;
    font-size: 9pt;
    color: #000;
    justify-content: space-between;
  }

  .trial-record-meta-left {
    margin-left: 0;
    text-align: left;
  }

  .trial-record-meta-right {
    position: relative;
    left: -100px;
  }

  .trial-record-table {
    width: 100%;
    margin: 0;
    margin-bottom: 0;
    font-family: SimSun, '宋体', serif;
    font-size: 9pt;
    line-height: 1.3;
    border: 0.5pt solid #000;
    border-collapse: collapse;
    table-layout: fixed;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .trial-record-table td {
    padding: 2pt 3pt;
    overflow: hidden;
    font-family: SimSun, '宋体', serif;
    font-size: 9pt;
    vertical-align: middle;
    border: 0.5pt solid #000;
    overflow-wrap: break-word;
  }

  .trial-record-row-1,
  .trial-record-row-2 {
    height: 35.05pt;
  }

  .trial-record-row-3,
  .trial-record-row-4,
  .trial-record-row-5,
  .trial-record-row-6 {
    height: 40.95pt;
  }

  .trial-record-row-7,
  .trial-record-row-8 {
    height: 81.25pt;
  }

  .trial-record-row-9 {
    height: 105.85pt;
  }

  .trial-record-row-10 {
    height: 95.25pt;
  }

  .trial-record-label-cell {
    font-size: 9pt;
  }

  .trial-record-value-cell {
    font-size: 9pt;
  }

  .trial-record-checkbox-cell {
    font-family: Arial, sans-serif;
  }

  .trial-record-table td.trial-record-mould-no {
    font-family: Arial, sans-serif;
    font-size: 20pt;
    font-weight: 400;
    letter-spacing: 0.5px;
  }

  .trial-record-date-line,
  .trial-record-datetime-line {
    line-height: 1.2;
    white-space: nowrap;
  }

  .trial-record-underline {
    position: relative;
    display: inline-flex;
    height: 14px;
    margin: 0 3px;
    line-height: 1;
    vertical-align: baseline;
    box-sizing: border-box;
    align-items: flex-end;
    justify-content: center;
  }

  .trial-record-underline::after {
    position: absolute;
    right: 0;
    bottom: 0;
    left: 0;
    border-bottom: 1px solid #000;
    content: '';
  }

  .trial-record-underline.is-filled {
    padding: 0 3px 2px;
  }

  .trial-record-underline--year {
    width: 10mm;
  }

  .trial-record-underline--month,
  .trial-record-underline--day {
    width: 7mm;
  }

  .trial-record-underline--hour,
  .trial-record-underline--minute {
    width: 7mm;
  }

  .trial-record-meta-date-line .trial-record-underline {
    margin: 0 8px;
  }

  .trial-record-underline--record-year {
    width: 18mm;
  }

  .trial-record-underline--record-month,
  .trial-record-underline--record-day {
    width: 14mm;
  }

  .trial-record-align-left {
    text-align: left;
  }

  .trial-record-align-center {
    text-align: center;
  }

  .trial-record-note {
    margin-top: 2mm;
    font-family: SimSun, '宋体', serif;
    font-size: 9pt;
    line-height: 1.5;
    color: #000;
    text-indent: 9.53mm;
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
  padding: 28px 16px;
  flex: 1;
  overflow: auto;
  align-items: flex-start;
}

.paper {
  display: flex;
  width: 210mm;
  height: 297mm;
  min-height: 297mm;
  padding: 4.6mm 4.39mm 4.6mm 4.2mm;
  background: #fff;
  border-radius: 4px;
  box-shadow: 0 10px 28px rgb(0 0 0 / 12%);
  box-sizing: border-box;
  transform-origin: top center;
  flex-direction: column;
}

.trial-record-page {
  margin: 0;
}

.trial-record-page-header {
  margin: 0;
  margin-left: 4.76mm;
  font-family: SimSun, '宋体', serif;
  font-size: 9pt;
  color: #000;
}

.trial-record-title {
  margin: 0;
  text-align: center;
}

.trial-record-title-line {
  font-family: SimSun, '宋体', serif;
  font-size: 15pt;
  font-weight: bold;
  line-height: 2;
}

.trial-record-title-product {
  display: inline-block;
  min-width: 70mm;
  padding: 0 2mm;
  margin-right: 6mm;
  text-align: center;
  border-bottom: 1px solid #000;
  box-sizing: border-box;
}

.trial-record-title-suffix {
  white-space: nowrap;
}

.trial-record-table {
  width: 190.36mm;
  margin: 2mm auto 0;
  font-family: SimSun, '宋体', serif;
  font-size: 9pt;
  line-height: 1.3;
  border: 0.5pt solid #000;
  border-collapse: collapse;
  table-layout: fixed;
}

.trial-record-table td {
  padding: 2pt 3pt;
  overflow: hidden;
  font-family: SimSun, '宋体', serif;
  font-size: 9pt;
  vertical-align: middle;
  border: 0.5pt solid #000;
  overflow-wrap: break-word;
}

.trial-record-row-1,
.trial-record-row-2 {
  height: 35.05pt;
}

.trial-record-row-3,
.trial-record-row-4,
.trial-record-row-5,
.trial-record-row-6 {
  height: 40.95pt;
}

.trial-record-row-7,
.trial-record-row-8 {
  height: 81.25pt;
}

.trial-record-row-9 {
  height: 105.85pt;
}

.trial-record-row-10 {
  height: 95.25pt;
}

.trial-record-label-cell {
  font-size: 9pt;
}

.trial-record-value-cell {
  font-size: 9pt;
}

.trial-record-checkbox-cell {
  font-family: Arial, sans-serif;
}

.trial-record-table td.trial-record-mould-no {
  font-family: Arial, sans-serif;
  font-size: 20pt;
  font-weight: 400;
  letter-spacing: 0.5px;
}

.trial-record-date-line,
.trial-record-datetime-line {
  line-height: 1.2;
  white-space: nowrap;
}

.trial-record-underline {
  position: relative;
  display: inline-flex;
  height: 14px;
  margin: 0 3px;
  line-height: 1;
  vertical-align: baseline;
  box-sizing: border-box;
  align-items: flex-end;
  justify-content: center;
}

.trial-record-underline::after {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  border-bottom: 1px solid #000;
  content: '';
}

.trial-record-underline.is-filled {
  padding: 0 3px 2px;
}

.trial-record-underline--year {
  width: 10mm;
}

.trial-record-underline--month,
.trial-record-underline--day {
  width: 7mm;
}

.trial-record-underline--hour,
.trial-record-underline--minute {
  width: 7mm;
}

.trial-record-meta-date-line .trial-record-underline {
  margin: 0 8px;
}

.trial-record-underline--record-year {
  width: 18mm;
}

.trial-record-underline--record-month,
.trial-record-underline--record-day {
  width: 14mm;
}

.trial-record-align-left {
  text-align: left;
}

.trial-record-align-center {
  text-align: center;
}

.trial-record-meta {
  display: flex;
  width: 100%;
  margin-top: 2mm;
  margin-bottom: 2mm;
  font-family: SimSun, '宋体', serif;
  font-size: 9pt;
  color: #000;
  justify-content: space-between;
}

.trial-record-meta-left {
  margin-left: 0;
  text-align: left;
}

.trial-record-meta-right {
  position: relative;
  left: -100px;
}

.trial-record-note {
  margin-top: 2mm;
  font-family: SimSun, '宋体', serif;
  font-size: 9pt;
  line-height: 1.5;
  color: #000;
  text-indent: 9.53mm;
}
</style>
