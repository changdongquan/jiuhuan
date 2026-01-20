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
      <template v-else-if="projectData">
        <div class="paper" :style="paperPreviewStyle">
          <table class="trial-form-table" cellspacing="0" cellpadding="0">
            <colgroup>
              <!-- A-M: Excel template column widths -->
              <col style="width: calc(5.65% + 5px)" />
              <col style="width: 8.93%" />
              <col style="width: 10.27%" />
              <col style="width: 6.4%" />
              <col style="width: 6.84%" />
              <col style="width: 5.95%" />
              <col style="width: 6.84%" />
              <col style="width: 7.14%" />
              <col style="width: 6.4%" />
              <col style="width: 6.55%" />
              <col style="width: 8.18%" />
              <col style="width: 7.59%" />
              <col style="width: 13.25%" />
            </colgroup>

            <tbody>
              <!-- 模板第1行: 标题 (34pt) -->
              <tr class="trial-form-row" style="height: 34pt">
                <td colspan="13" class="trial-form-title-cell"
                  >合肥久环模具设备制造有限公司试模过程单</td
                >
              </tr>

              <!-- 模板第2-6行: 工程申请 (A列 rowspan=5) -->
              <!-- 模板第2行 (20pt): 项目编号 / 产品名称 / 模具穴数 -->
              <tr class="trial-form-row" style="height: 20pt">
                <td rowspan="5" class="trial-form-label-cell trial-form-vertical-text"
                  >工程<br />申请</td
                >
                <td class="trial-form-label-cell">项目编号</td>
                <td colspan="3" class="trial-form-value-cell" data-cell="C2">{{
                  projectData.项目编号 || '-'
                }}</td>
                <td colspan="2" class="trial-form-label-cell">产品名称</td>
                <td colspan="2" class="trial-form-value-cell" data-cell="H2">
                  {{ projectData.productName || projectData.产品名称 || '-' }}
                </td>
                <td colspan="2" class="trial-form-label-cell">模具穴数</td>
                <td colspan="2" class="trial-form-value-cell" data-cell="L2">{{
                  projectData.模具穴数 || '-'
                }}</td>
              </tr>

              <!-- 模板第3行 (20pt): 模具尺寸 / 模具重量 / 产品理论重量 -->
              <tr class="trial-form-row" style="height: 20pt">
                <td colspan="2" class="trial-form-label-cell">模具尺寸 宽长高/CM</td>
                <td colspan="2" class="trial-form-value-cell" data-cell="D3">{{
                  projectData.模具尺寸 || '-'
                }}</td>
                <td colspan="2" class="trial-form-label-cell">模具重量</td>
                <td colspan="2" class="trial-form-value-cell" data-cell="H3">
                  {{ projectData.模具重量 != null ? projectData.模具重量 : '-' }}
                </td>
                <td colspan="2" class="trial-form-label-cell">产品理论重量</td>
                <td colspan="2" class="trial-form-value-cell" data-cell="L3">
                  {{ projectData.产品重量 != null ? projectData.产品重量 : '-' }}
                </td>
              </tr>

              <!-- 模板第4行 (20pt): 产品材料 / 色母型号/颜色 / 试模类别 -->
              <tr class="trial-form-row" style="height: 20pt">
                <td colspan="2" class="trial-form-label-cell">产品材料</td>
                <td colspan="2" class="trial-form-value-cell" data-cell="D4">{{
                  projectData.产品材质 || '-'
                }}</td>
                <td colspan="2" class="trial-form-label-cell">色母型号/颜色</td>
                <td colspan="4" class="trial-form-value-cell" data-cell="H4">{{
                  projectData.产品颜色 || '-'
                }}</td>
                <td class="trial-form-label-cell">试模类别</td>
                <td class="trial-form-value-cell">试封样</td>
              </tr>

              <!-- 模板第5行 (20pt): 试模次数 / 试模产品数量 / 交样时间 -->
              <tr class="trial-form-row" style="height: 20pt">
                <td colspan="2" class="trial-form-label-cell">试模次数</td>
                <td colspan="2" class="trial-form-value-cell" data-cell="D5">{{
                  trialCount || '-'
                }}</td>
                <td colspan="2" class="trial-form-label-cell">试模产品数量</td>
                <td class="trial-form-value-cell">-</td>
                <td class="trial-form-label-cell">Pcs</td>
                <td colspan="2" class="trial-form-label-cell">交样时间</td>
                <td colspan="2" class="trial-form-value-cell">-</td>
              </tr>

              <!-- 模板第6行 (43pt): 试模目标 / 注意事项 / 试模要求 (合并) -->
              <tr class="trial-form-row" style="height: 43pt">
                <td colspan="2" class="trial-form-label-cell"
                  >试模目标<br />注意事项<br />试模要求</td
                >
                <td colspan="10" class="trial-form-value-cell"></td>
              </tr>

              <!-- 模板第7-10行: 生产 (A列 rowspan=4) -->
              <!-- 模板第7行 (20pt): 注塑/外协、试模时间、试模人员 -->
              <tr class="trial-form-row" style="height: 20pt">
                <td rowspan="4" class="trial-form-label-cell trial-form-vertical-text">生产</td>
                <td colspan="2" class="trial-form-label-cell">☐注塑试模 ☐外协试模</td>
                <td colspan="2" class="trial-form-label-cell">试模时间</td>
                <td colspan="2" class="trial-form-value-cell">-</td>
                <td class="trial-form-label-cell">试模人员</td>
                <td colspan="5" class="trial-form-value-cell">☐设计 ☐钳工 ☐检验 ☐客户</td>
              </tr>

              <!-- 模板第8行 (20pt): 注塑机大小 / 预计用料重量 -->
              <tr class="trial-form-row" style="height: 20pt">
                <td class="trial-form-label-cell">注塑机大小</td>
                <td class="trial-form-label-cell" style="text-align: right">T</td>
                <td colspan="2" class="trial-form-label-cell">预计用料重量</td>
                <td colspan="2" class="trial-form-value-cell">-</td>
                <td class="trial-form-label-cell">KG</td>
                <td colspan="5" class="trial-form-value-cell"></td>
              </tr>

              <!-- 模板第9行 (20pt): 实际领料重量 / 返还材料重量 / 实际用料重量 -->
              <tr class="trial-form-row" style="height: 20pt">
                <td colspan="2" class="trial-form-label-cell">实际领料重量</td>
                <td class="trial-form-value-cell">-</td>
                <td class="trial-form-label-cell">KG</td>
                <td colspan="2" class="trial-form-label-cell">返还材料重量</td>
                <td class="trial-form-value-cell">-</td>
                <td class="trial-form-label-cell">KG</td>
                <td colspan="2" class="trial-form-label-cell">实际用料重量</td>
                <td class="trial-form-value-cell">-</td>
                <td class="trial-form-label-cell">KG</td>
              </tr>

              <!-- 模板第10行 (20pt): 仓库确认 / 试模工时 -->
              <tr class="trial-form-row" style="height: 20pt">
                <td colspan="2" class="trial-form-label-cell">仓库确认</td>
                <td colspan="2" class="trial-form-value-cell">-</td>
                <td colspan="2" class="trial-form-label-cell">仓库确认</td>
                <td colspan="2" class="trial-form-value-cell">-</td>
                <td colspan="2" class="trial-form-label-cell">试模工时</td>
                <td class="trial-form-value-cell">-</td>
                <td class="trial-form-label-cell">H</td>
              </tr>

              <!-- 模板第11行 (20pt): 注塑成型工艺参数 -->
              <tr class="trial-form-row" style="height: 20pt">
                <td colspan="13" class="trial-form-label-cell trial-form-section-header"
                  >注塑成型工艺参数</td
                >
              </tr>

              <!-- 模板第12行 (20pt): 工艺参数表头 -->
              <tr class="trial-form-row" style="height: 20pt">
                <td class="trial-form-label-cell">名称</td>
                <td class="trial-form-label-cell">速度%</td>
                <td class="trial-form-label-cell">压力Bar</td>
                <td class="trial-form-label-cell">位置mm</td>
                <td class="trial-form-label-cell">时间S</td>
                <td class="trial-form-label-cell">名称</td>
                <td class="trial-form-label-cell">速度%</td>
                <td class="trial-form-label-cell">压力Bar</td>
                <td class="trial-form-label-cell">位置mm</td>
                <td class="trial-form-label-cell">时间S</td>
                <td colspan="3" class="trial-form-label-cell">其他部分</td>
              </tr>

              <!-- 模板第13-20行 (20pt): 工艺参数数据行 -->
              <tr
                v-for="(row, idx) in processRows"
                :key="'process-' + idx"
                class="trial-form-row"
                style="height: 20pt"
              >
                <td class="trial-form-label-cell">{{ row.leftName }}</td>
                <td class="trial-form-value-cell">-</td>
                <td class="trial-form-value-cell">-</td>
                <td class="trial-form-value-cell">-</td>
                <td class="trial-form-value-cell">-</td>
                <td class="trial-form-label-cell">{{ row.rightName }}</td>
                <td class="trial-form-value-cell">-</td>
                <td class="trial-form-value-cell">-</td>
                <td class="trial-form-value-cell">-</td>
                <td class="trial-form-value-cell">-</td>
                <td class="trial-form-label-cell">{{ row.other }}</td>
                <td class="trial-form-value-cell">{{ row.otherLeft ?? '-' }}</td>
                <td class="trial-form-value-cell">{{ row.otherRight ?? '-' }}</td>
              </tr>

              <!-- 模板第21行 (20pt): 温控部分参数（℃） -->
              <tr class="trial-form-row" style="height: 20pt">
                <td colspan="13" class="trial-form-label-cell trial-form-section-header"
                  >温控部分参数（℃）</td
                >
              </tr>

              <!-- 模板第22行 (32pt): 温控表头 -->
              <tr class="trial-form-row" style="height: 32pt">
                <td class="trial-form-label-cell">名称</td>
                <td class="trial-form-label-cell">射嘴</td>
                <td class="trial-form-label-cell">T1</td>
                <td class="trial-form-label-cell">T2</td>
                <td class="trial-form-label-cell">T3</td>
                <td class="trial-form-label-cell">T4</td>
                <td class="trial-form-label-cell">T5</td>
                <td class="trial-form-label-cell">油温</td>
                <td class="trial-form-label-cell">烘料<br />时间</td>
                <td class="trial-form-label-cell">烘料<br />温度</td>
                <td class="trial-form-label-cell">型腔<br />温度</td>
                <td class="trial-form-label-cell">前模<br />温度</td>
                <td class="trial-form-label-cell">后模<br />温度</td>
              </tr>

              <!-- 模板第23行 (35pt): 料筒 -->
              <tr class="trial-form-row" style="height: 35pt">
                <td class="trial-form-label-cell">料筒</td>
                <td class="trial-form-value-cell" style="text-align: right">℃</td>
                <td class="trial-form-value-cell" style="text-align: right">℃</td>
                <td class="trial-form-value-cell" style="text-align: right">℃</td>
                <td class="trial-form-value-cell" style="text-align: right">℃</td>
                <td class="trial-form-value-cell" style="text-align: right">℃</td>
                <td class="trial-form-value-cell" style="text-align: right">℃</td>
                <td class="trial-form-value-cell" style="text-align: right">℃</td>
                <td class="trial-form-value-cell" style="text-align: right">S</td>
                <td class="trial-form-value-cell" style="text-align: right">℃</td>
                <td class="trial-form-value-cell" style="text-align: right">℃</td>
                <td class="trial-form-value-cell" style="text-align: right">℃</td>
                <td class="trial-form-value-cell" style="text-align: right">℃</td>
              </tr>

              <!-- 模板第24行 (35pt): 温控箱、是否需要模温机、模温机温度 -->
              <tr class="trial-form-row" style="height: 35pt">
                <td class="trial-form-label-cell">温控箱</td>
                <td class="trial-form-value-cell" style="text-align: right">℃</td>
                <td class="trial-form-value-cell" style="text-align: right">℃</td>
                <td class="trial-form-value-cell" style="text-align: right">℃</td>
                <td class="trial-form-value-cell" style="text-align: right">℃</td>
                <td class="trial-form-value-cell" style="text-align: right">℃</td>
                <td class="trial-form-value-cell" style="text-align: right">℃</td>
                <td class="trial-form-value-cell" style="text-align: right">℃</td>
                <td colspan="2" class="trial-form-label-cell">是否需要<br />模温机</td>
                <td class="trial-form-value-cell">☐是 ☐否</td>
                <td class="trial-form-label-cell">模温<br />机温度</td>
                <td class="trial-form-value-cell" style="text-align: right">℃</td>
              </tr>

              <!-- 模板第25行 (20pt): 备注 -->
              <tr class="trial-form-row" style="height: 20pt">
                <td colspan="13" class="trial-form-value-cell trial-form-remark">
                  备注：以上注塑工艺参数变更由授权制定人员根据时间情况具体调整！但须经过产品确认判定！
                </td>
              </tr>

              <!-- 模板第26行 (20pt): 时间、顺序控制器表头 -->
              <tr class="trial-form-row" style="height: 20pt">
                <td rowspan="4" class="trial-form-label-cell trial-form-vertical-text"
                  >时间、顺序控制器</td
                >
                <td colspan="3" class="trial-form-label-cell">延时时间</td>
                <td colspan="3" class="trial-form-label-cell">控制时间</td>
                <td colspan="3" class="trial-form-label-cell">延时时间</td>
                <td colspan="3" class="trial-form-label-cell">控制时间</td>
              </tr>

              <!-- 模板第27-29行 (20pt): 时间、顺序控制器数据 -->
              <tr
                v-for="(row, idx) in timerRows"
                :key="'timer-' + idx"
                class="trial-form-row"
                style="height: 20pt"
              >
                <td colspan="2" class="trial-form-value-cell">{{ row.left }}</td>
                <td class="trial-form-value-cell">-</td>
                <td colspan="3" class="trial-form-value-cell">-</td>
                <td colspan="2" class="trial-form-value-cell">{{ row.right }}</td>
                <td class="trial-form-value-cell">-</td>
                <td colspan="3" class="trial-form-value-cell">-</td>
              </tr>

              <!-- 模板第30行 (86pt): 试模结果 -->
              <tr class="trial-form-row" style="height: 60.2pt">
                <td rowspan="2" class="trial-form-label-cell trial-form-vertical-text"
                  >试模<br />结果</td
                >
                <td colspan="2" class="trial-form-label-cell">具体描述或其他未尽之处</td>
                <td
                  colspan="10"
                  class="trial-form-value-cell trial-form-signature"
                  style="vertical-align: bottom"
                >
                  试模员：_______________________________________________ 日期：________________
                </td>
              </tr>

              <!-- 模板第31行 (61pt): 尺寸检验结果 -->
              <tr class="trial-form-row" style="height: 61pt">
                <td colspan="2" class="trial-form-label-cell">尺寸检验结果</td>
                <td
                  colspan="10"
                  class="trial-form-value-cell trial-form-signature"
                  style="vertical-align: bottom"
                >
                  检验员：_______________________________________________ 日期：________________
                </td>
              </tr>

              <!-- 模板第32行 (93pt): 综合结论 -->
              <tr class="trial-form-row" style="height: 65.1pt">
                <td class="trial-form-label-cell trial-form-vertical-text">综合<br />结论</td>
                <td
                  colspan="12"
                  class="trial-form-value-cell trial-form-signature"
                  style="vertical-align: bottom"
                >
                  工程主管：_______________________________________________ 日期：________________
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
      <template v-else>
        <div class="text-center py-10">
          <p class="text-lg text-gray-500">未找到项目数据</p>
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

type ProcessRow = {
  leftName: string
  rightName: string
  other: string
  otherLeft?: string
  otherRight?: string
}

const router = useRouter()
const route = useRoute()

const zoom = ref<number>(1)
const loading = ref(false)
const projectData = ref<any>(null)
const trialCount = ref<string>('')

const paperPreviewStyle = computed(() => ({ zoom: zoom.value }) as any)

const processRows: ProcessRow[] = [
  { leftName: '射胶1', rightName: '熔胶1', other: '射胶时间' },
  { leftName: '射胶2', rightName: '熔胶2', other: '冷却时间' },
  { leftName: '射胶3', rightName: '熔胶3', other: '前模水路' },
  { leftName: '射胶4', rightName: '松退', other: '后模水路' },
  { leftName: '射胶5', rightName: '入芯', other: '其他水路' },
  { leftName: '保压1', rightName: '退芯', other: '气路' },
  { leftName: '保压2', rightName: '', other: '成型周期' },
  { leftName: '保压3', rightName: '', other: '机台类型', otherLeft: '☐卧式', otherRight: '☐立式' }
]

const timerRows = [
  { left: '①', right: '④' },
  { left: '②', right: '⑤' },
  { left: '③', right: '⑥' }
]

const handlePrint = () => {
  window.print()
}

const handleBack = () => {
  if (window.history.length > 1) {
    router.back()
  } else {
    router.push('/project-management')
  }
}

const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    handleBack()
  }
}

const loadData = async () => {
  const projectCode = route.params.projectCode as string
  const trialCountParam = route.query.trialCount as string

  if (!projectCode) {
    ElMessage.error('项目编号不能为空')
    return
  }

  if (trialCountParam) {
    trialCount.value = trialCountParam
  }

  loading.value = true
  try {
    const response: any = await getProjectDetailApi(projectCode)
    const data = response?.data?.data || response?.data || response
    if (!data) {
      ElMessage.error('未找到项目数据')
      projectData.value = null
      return
    }

    projectData.value = data
  } catch (error) {
    console.error('加载试模单数据失败:', error)
    ElMessage.error('加载试模单数据失败')
    projectData.value = null
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
    width: 210mm;
    min-height: 297mm;
    padding: 2mm;
    margin: 0;
    overflow: visible;
    border-radius: 0;
    zoom: 1 !important;
    transform: none !important;
    box-shadow: none;
    box-sizing: border-box;
    page-break-inside: avoid;
  }

  .trial-form-table {
    /* Fit exactly into one A4 page (accounting for 2mm padding). */
    --trial-form-print-scale: 0.93;

    width: calc(100% / var(--trial-form-print-scale));
    margin-bottom: 0;
    font-size: 9px;
    line-height: 1.3;
    border: 2px solid #000;
    border-collapse: collapse;
    transform: scale(var(--trial-form-print-scale));
    table-layout: fixed;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    transform-origin: top center;
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .trial-form-table td {
    padding: 2px 3px;
    overflow: hidden;
    vertical-align: middle;
    border: 1px solid #000;
    overflow-wrap: break-word;
  }

  .trial-form-title-cell {
    padding: 4px;
    font-size: 14px;
    font-weight: bold;
    text-align: center;
  }

  .trial-form-row {
    height: auto;
  }

  .trial-form-label-cell {
    padding: 2px 3px;
    font-size: 9px;
    font-weight: 500;
    text-align: center;
    background-color: #f7f7f7;
  }

  .trial-form-value-cell {
    padding: 2px 4px;
    font-size: 9px;
  }

  .trial-form-signature {
    padding: 3px;
    font-size: 8px;
    line-height: 1.4;
  }

  .trial-form-vertical-text {
    writing-mode: vertical-rl;
    text-orientation: upright;
    font-size: 9px;
  }

  .trial-form-remark {
    font-size: 8px;
    line-height: 1.3;
  }

  .trial-form-section-header {
    padding: 3px;
    font-size: 9px;
    font-weight: bold;
    text-align: center;
    background-color: #ededed;
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

.paper {
  width: 210mm;
  min-height: 297mm;
  padding: 8mm;
  background: #fff;
  border-radius: 4px;
  box-shadow: 0 10px 28px rgb(0 0 0 / 12%);
  box-sizing: border-box;
  transform-origin: top center;
}

.trial-form-table {
  width: 100%;
  margin-top: 4px;
  font-size: 11px;
  line-height: 1.4;
  border: 2px solid #000;
  border-collapse: collapse;
  table-layout: fixed;
}

.trial-form-table td {
  padding: 2px 4px;
  overflow: hidden;
  vertical-align: middle;
  border: 1px solid #000;
  overflow-wrap: break-word;
}

.trial-form-title-cell {
  padding: 6px;
  font-size: 16px;
  font-weight: bold;
  text-align: center;
}

.trial-form-row {
  height: auto;
}

.trial-form-label-cell {
  padding: 2px 3px;
  font-size: 10px;
  font-weight: 500;
  text-align: center;
  background-color: #f7f7f7;
}

.trial-form-value-cell {
  padding: 2px 4px;
  font-size: 10px;
}

.trial-form-signature {
  padding: 4px;
  font-size: 9px;
  line-height: 1.4;
}

.trial-form-vertical-text {
  writing-mode: vertical-rl;
  text-orientation: upright;
  font-size: 10px;
}

.trial-form-remark {
  font-size: 9px;
  line-height: 1.3;
}

.trial-form-section-header {
  padding: 3px;
  font-size: 11px;
  font-weight: bold;
  text-align: center;
  background-color: #ededed;
}
</style>
