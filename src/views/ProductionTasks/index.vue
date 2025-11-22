<template>
  <div class="pt-page px-4 pt-1 pb-4 space-y-2">
    <div v-if="isMobile" class="mobile-top-bar">
      <el-button text type="primary" @click="showMobileFilters = !showMobileFilters">
        {{ showMobileFilters ? '收起筛选' : '展开筛选' }}
      </el-button>
      <div class="view-mode-switch">
        <span class="view-mode-switch__label">视图</span>
        <el-radio-group v-model="viewMode" size="small">
          <el-radio-button label="card">卡片</el-radio-button>
          <el-radio-button label="table">表格</el-radio-button>
        </el-radio-group>
      </div>
    </div>
    <el-form
      ref="queryFormRef"
      :model="queryForm"
      :label-width="isMobile ? 'auto' : '90px'"
      :label-position="isMobile ? 'top' : 'right'"
      :inline="!isMobile"
      class="query-form rounded-lg bg-[var(--el-bg-color-overlay)] p-4 shadow-sm"
      :class="{ 'query-form--mobile': isMobile }"
      v-show="!isMobile || showMobileFilters"
    >
      <el-form-item label="关键词">
        <el-input
          v-model="queryForm.keyword"
          placeholder="项目编号/产品名称/产品图号/客户模号"
          clearable
          :style="{ width: isMobile ? '100%' : '280px' }"
        />
      </el-form-item>
      <el-form-item label="生产状态">
        <el-select
          v-model="queryForm.status"
          placeholder="请选择生产状态"
          clearable
          :style="{ width: isMobile ? '100%' : '160px' }"
        >
          <el-option
            v-for="item in statusOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item class="query-form__actions">
        <div class="query-actions">
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </div>
      </el-form-item>
    </el-form>

    <!-- 统计卡片 -->
    <el-row :gutter="16">
      <el-col :xs="24" :sm="12" :lg="6">
        <el-card shadow="hover" class="summary-card summary-card--blue">
          <div class="summary-title">总任务数</div>
          <div class="summary-value">{{
            Math.max(0, (statistics.total || 0) - (statistics.completed || 0))
          }}</div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="6">
        <el-card shadow="hover" class="summary-card summary-card--green">
          <div class="summary-title">进行中</div>
          <div class="summary-value">{{ statistics.inProgress }}</div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="6">
        <el-card shadow="hover" class="summary-card summary-card--orange">
          <div class="summary-title">已完成</div>
          <div class="summary-value">{{ statistics.completed }}</div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="6">
        <el-card shadow="hover" class="summary-card summary-card--gray">
          <div class="summary-title">待开始</div>
          <div class="summary-value">{{ statistics.pending }}</div>
        </el-card>
      </el-col>
    </el-row>

    <div
      v-if="viewMode === 'table' || !isMobile"
      class="pt-table-wrapper"
      :class="{ 'pt-table-wrapper--mobile': isMobile }"
    >
      <el-table
        ref="tableRef"
        v-loading="loading"
        :data="tableData"
        border
        :height="tableHeight"
        row-key="项目编号"
        @row-dblclick="handleRowDblClick"
        class="pt-table"
      >
        <el-table-column type="index" label="序号" width="60" align="center" fixed="left" />
        <el-table-column
          prop="项目编号"
          label="项目编号"
          width="145"
          show-overflow-tooltip
          fixed="left"
        />
        <el-table-column
          prop="productName"
          label="产品名称"
          width="140"
          show-overflow-tooltip
          fixed="left"
        />
        <el-table-column
          prop="productDrawing"
          label="产品图号"
          width="140"
          show-overflow-tooltip
          fixed="left"
        />
        <el-table-column
          prop="客户模号"
          label="客户模号"
          width="115"
          show-overflow-tooltip
          fixed="left"
        />
        <el-table-column prop="产品材质" label="产品材质" width="100" show-overflow-tooltip />
        <el-table-column prop="图纸下发日期" label="图纸下发日期" width="115">
          <template #default="{ row }">
            {{ formatDate(row.图纸下发日期 as any) }}
          </template>
        </el-table-column>
        <el-table-column prop="计划首样日期" label="计划首样日期" width="145">
          <template #default="{ row }">
            <span>{{ formatDate(row.计划首样日期 as any) }}</span>
            <el-tag
              v-if="isDueSoon(row.计划首样日期 as any)"
              type="warning"
              size="small"
              effect="light"
              style="margin-left: 6px"
              >{{ daysUntil(row.计划首样日期 as any) }}天</el-tag
            >
          </template>
        </el-table-column>
        <el-table-column prop="负责人" label="负责人" width="80" />
        <el-table-column prop="生产状态" label="生产状态" width="85" align="center">
          <template #default="{ row }">
            <el-tag :type="getStatusTagType(row.生产状态)" size="small" class="pt-status-tag">
              {{ row.生产状态 || '-' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="开始日期" label="开始日期" width="110">
          <template #default="{ row }">
            {{ formatDate(row.开始日期) }}
          </template>
        </el-table-column>
        <el-table-column prop="结束日期" label="结束日期" width="110">
          <template #default="{ row }">
            {{ formatDate(row.结束日期) }}
          </template>
        </el-table-column>
        <el-table-column prop="投产数量" label="投产数量" width="90" align="right">
          <template #default="{ row }">
            {{ formatValue(row.投产数量) }}
          </template>
        </el-table-column>
        <el-table-column prop="已完成数量" label="已完成数量" width="105" align="right">
          <template #default="{ row }">
            {{ formatValue(row.已完成数量) }}
          </template>
        </el-table-column>

        <el-table-column label="操作" width="200" fixed="right" align="center">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button type="success" size="small" @click="handleView(row)">查看</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div v-else class="pt-mobile-list" v-loading="loading">
      <el-empty v-if="!tableData.length && !loading" description="暂无生产任务" />
      <template v-else>
        <el-card v-for="row in tableData" :key="row.项目编号" class="pt-mobile-card" shadow="hover">
          <div class="pt-mobile-card__header">
            <div>
              <div class="pt-mobile-card__code">项目编号：{{ row.项目编号 || '-' }}</div>
              <div class="pt-mobile-card__name">{{ row.productName || '-' }}</div>
            </div>
            <el-tag :type="getStatusTagType(row.生产状态)" size="small">
              {{ row.生产状态 || '未知' }}
            </el-tag>
          </div>
          <div class="pt-mobile-card__meta">
            <div>
              <span class="label">产品图号</span>
              <span class="value">{{ row.productDrawing || '-' }}</span>
            </div>
            <div>
              <span class="label">客户模号</span>
              <span class="value">{{ row.客户模号 || '-' }}</span>
            </div>
            <div>
              <span class="label">材质</span>
              <span class="value">{{ row.产品材质 || '-' }}</span>
            </div>
            <div>
              <span class="label">负责人</span>
              <span class="value">{{ row.负责人 || '-' }}</span>
            </div>
          </div>
          <div class="pt-mobile-card__dates">
            <div>
              <span class="label">首样</span>
              <span class="value">
                {{ formatDate(row.计划首样日期 as any) }}
                <el-tag
                  v-if="isDueSoon(row.计划首样日期 as any)"
                  type="warning"
                  size="small"
                  effect="light"
                  style="margin-left: 6px"
                >
                  {{ daysUntil(row.计划首样日期 as any) }}天
                </el-tag>
              </span>
            </div>
            <div>
              <span class="label">开始</span>
              <span class="value">{{ formatDate(row.开始日期) }}</span>
            </div>
            <div>
              <span class="label">结束</span>
              <span class="value">{{ formatDate(row.结束日期) }}</span>
            </div>
          </div>
          <div class="pt-mobile-card__stats">
            <div class="stat">
              <div class="stat-label">投产数量</div>
              <div class="stat-value">{{ formatValue(row.投产数量) }}</div>
            </div>
            <div class="stat">
              <div class="stat-label">已完成</div>
              <div class="stat-value">{{ formatValue(row.已完成数量) }}</div>
            </div>
          </div>
          <div class="pt-mobile-card__actions">
            <el-button size="small" type="primary" @click="handleView(row)">查看</el-button>
            <el-button size="small" @click="handleEdit(row)">编辑</el-button>
          </div>
        </el-card>
      </template>
    </div>

    <div
      class="pagination-footer"
      :class="{ 'pagination-footer--mobile': isMobile || viewMode === 'card' }"
    >
      <el-pagination
        background
        layout="total, sizes, prev, pager, next, jumper"
        :current-page="pagination.page"
        :page-size="pagination.size"
        :page-sizes="[10, 15, 20, 30, 50]"
        :total="total"
        @size-change="handleSizeChange"
        @current-change="handleCurrentChange"
      />
    </div>

    <!-- 编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      :width="isMobile ? '100%' : '1200px'"
      :fullscreen="isMobile"
      :close-on-click-modal="false"
      @closed="handleDialogClosed"
    >
      <!-- 查看模式：表格化展示 -->
      <div v-if="isViewMode" class="view-table-container">
        <el-row :gutter="12">
          <el-col
            :span="12"
            v-for="(section, sectionIndex) in viewTableSections"
            :key="sectionIndex"
            class="view-section-col"
          >
            <div class="view-section">
              <div class="table-section-header">{{ section.title }}</div>
              <!-- 工时信息特殊处理：两列显示 -->
              <div v-if="section.title === '工时信息'" class="work-hours-container">
                <el-row :gutter="6">
                  <el-col :span="12">
                    <el-table :data="section.data" border class="view-table" :show-header="false">
                      <el-table-column width="110" align="right" class-name="label-column">
                        <template #default="{ row }">
                          <strong>{{ row.label }}</strong>
                        </template>
                      </el-table-column>
                      <el-table-column class-name="value-column">
                        <template #default="{ row }">
                          <span>{{ row.value || '-' }}</span>
                        </template>
                      </el-table-column>
                    </el-table>
                  </el-col>
                  <el-col :span="12">
                    <el-table :data="section.data2" border class="view-table" :show-header="false">
                      <el-table-column width="110" align="right" class-name="label-column">
                        <template #default="{ row }">
                          <strong>{{ row.label }}</strong>
                        </template>
                      </el-table-column>
                      <el-table-column class-name="value-column">
                        <template #default="{ row }">
                          <span>{{ row.value || '-' }}</span>
                        </template>
                      </el-table-column>
                    </el-table>
                  </el-col>
                </el-row>
              </div>
              <!-- 其他分组正常显示 -->
              <el-table v-else :data="section.data" border class="view-table" :show-header="false">
                <el-table-column width="150" align="right" class-name="label-column">
                  <template #default="{ row }">
                    <strong>{{ row.label }}</strong>
                  </template>
                </el-table-column>
                <el-table-column class-name="value-column">
                  <template #default="{ row }">
                    <span v-if="row.tag">
                      <el-tag :type="getStatusTagType(row.value)">{{ row.value || '-' }}</el-tag>
                    </span>
                    <span v-else>{{ row.value || '-' }}</span>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </el-col>
        </el-row>
      </div>

      <!-- 编辑模式：表单展示 -->
      <el-form
        v-else
        ref="dialogFormRef"
        :model="dialogForm"
        :rules="dialogRules"
        label-width="120px"
        class="production-task-form"
      >
        <el-row :gutter="20">
          <el-col :span="6">
            <el-form-item label="项目编号" prop="项目编号">
              <el-input v-model="dialogForm.项目编号" placeholder="项目编号" disabled />
            </el-form-item>
            <el-form-item label="产品名称">
              <el-input v-model="dialogForm.productName" placeholder="产品名称" disabled />
            </el-form-item>
            <el-form-item label="产品图号">
              <el-input v-model="dialogForm.productDrawing" placeholder="产品图号" disabled />
            </el-form-item>
            <el-form-item label="客户模号">
              <el-input v-model="dialogForm.客户模号" placeholder="客户模号" disabled />
            </el-form-item>
            <el-form-item label="产品材质">
              <el-input v-model="dialogForm.产品材质" placeholder="产品材质" disabled />
            </el-form-item>
            <el-form-item label="图纸下发日期">
              <el-input
                :model-value="formatDate(dialogForm.图纸下发日期 as any)"
                placeholder="图纸下发日期"
                disabled
              />
            </el-form-item>
            <el-form-item label="计划首样日期">
              <el-input
                :model-value="formatDate(dialogForm.计划首样日期 as any)"
                placeholder="计划首样日期"
                disabled
              />
            </el-form-item>

            <el-form-item label="开始日期">
              <el-date-picker
                v-model="dialogForm.开始日期"
                type="date"
                value-format="YYYY-MM-DD"
                placeholder="开始日期"
                style="width: 100%"
              />
            </el-form-item>
            <el-form-item label="结束日期">
              <el-date-picker
                v-model="dialogForm.结束日期"
                type="date"
                value-format="YYYY-MM-DD"
                placeholder="结束日期"
                style="width: 100%"
              />
            </el-form-item>
            <el-form-item label="下达日期">
              <el-date-picker
                v-model="dialogForm.下达日期"
                type="date"
                value-format="YYYY-MM-DD"
                placeholder="下达日期"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="生产状态">
              <el-select
                v-model="dialogForm.生产状态"
                placeholder="请选择生产状态"
                style="width: 100%"
              >
                <el-option
                  v-for="item in statusOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="负责人">
              <el-select v-model="dialogForm.负责人" placeholder="请选择负责人" style="width: 100%">
                <el-option label="张晓龙" value="张晓龙" />
                <el-option label="丁忠寻" value="丁忠寻" />
              </el-select>
            </el-form-item>
            <el-form-item label="优先级">
              <el-select v-model="dialogForm.优先级" placeholder="请选择优先级" style="width: 100%">
                <el-option label="高" value="高" />
                <el-option label="中" value="中" />
                <el-option label="低" value="低" />
              </el-select>
            </el-form-item>
            <el-form-item label="投产数量">
              <el-input-number v-model="dialogForm.投产数量" :min="0" style="width: 100%" />
            </el-form-item>
            <el-form-item label="已完成数量">
              <el-input-number v-model="dialogForm.已完成数量" :min="0" style="width: 100%" />
            </el-form-item>
            <el-form-item label="批次完成数量">
              <el-input-number v-model="dialogForm.批次完成数量" :min="0" style="width: 100%" />
            </el-form-item>
            <el-form-item label="批次完成时间">
              <el-date-picker
                v-model="dialogForm.批次完成时间"
                type="date"
                value-format="YYYY-MM-DD"
                placeholder="批次完成时间"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="加工中心工时">
              <el-input-number v-model="dialogForm.加工中心工时" :min="0" style="width: 100%" />
            </el-form-item>
            <el-form-item label="线切割工时">
              <el-input-number v-model="dialogForm.线切割工时" :min="0" style="width: 100%" />
            </el-form-item>
            <el-form-item label="放电工时">
              <el-input-number v-model="dialogForm.放电工时" :min="0" style="width: 100%" />
            </el-form-item>
            <el-form-item label="机加工时">
              <el-input-number v-model="dialogForm.机加工时" :min="0" style="width: 100%" />
            </el-form-item>
            <el-form-item label="抛光工时">
              <el-input-number v-model="dialogForm.抛光工时" :min="0" style="width: 100%" />
            </el-form-item>
            <el-form-item label="装配工时">
              <el-input-number v-model="dialogForm.装配工时" :min="0" style="width: 100%" />
            </el-form-item>
            <el-form-item label="试模工时">
              <el-input-number v-model="dialogForm.试模工时" :min="0" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">{{ isViewMode ? '关闭' : '取消' }}</el-button>
        <el-button
          v-if="!isViewMode"
          type="primary"
          :loading="dialogSubmitting"
          @click="submitDialogForm"
        >
          保存
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage, ElRadioButton, ElRadioGroup, ElEmpty } from 'element-plus'
import {
  getProductionTaskListApi,
  getProductionTaskDetailApi,
  updateProductionTaskApi,
  getProductionTaskStatisticsApi,
  type ProductionTaskInfo
} from '@/api/production-task'
import { useAppStore } from '@/store/modules/app'

const loading = ref(false)
const tableData = ref<Partial<ProductionTaskInfo>[]>([])
const total = ref(0)
const pagination = reactive({ page: 1, size: 20 })
const statistics = reactive({
  total: 0,
  inProgress: 0,
  completed: 0,
  pending: 0
})

const queryForm = reactive({ keyword: '', status: '' })
const statusOptions = [
  { label: '待开始', value: '待开始' },
  { label: '进行中', value: '进行中' },
  { label: '已完成', value: '已完成' },
  { label: '已暂停', value: '已暂停' },
  { label: '已取消', value: '已取消' }
]

type ViewMode = 'table' | 'card'

const appStore = useAppStore()
const isMobile = computed(() => appStore.getMobile)
const viewMode = ref<ViewMode>(isMobile.value ? 'card' : 'table')
const showMobileFilters = ref(true)
const tableHeight = computed(() => (isMobile.value ? undefined : 'calc(100vh - 340px)'))

const dialogVisible = ref(false)
const dialogTitle = ref('编辑生产任务')
const dialogSubmitting = ref(false)
const dialogFormRef = ref<FormInstance>()
const dialogForm = reactive<Partial<ProductionTaskInfo>>({})
const currentProjectCode = ref('')
const isViewMode = ref(false)

watch(isMobile, (mobile) => {
  viewMode.value = mobile ? 'card' : 'table'
  if (!mobile) {
    showMobileFilters.value = true
  }
})

// 查看模式的表格数据（分组展示）
const viewTableSections = computed(() => {
  if (!dialogForm || Object.keys(dialogForm).length === 0) return []

  return [
    {
      title: '基本信息',
      data: [
        { label: '项目编号', value: dialogForm.项目编号 },
        { label: '产品名称', value: dialogForm.productName },
        { label: '产品图号', value: dialogForm.productDrawing },
        { label: '客户模号', value: dialogForm.客户模号 },
        { label: '产品材质', value: dialogForm.产品材质 },
        { label: '图纸下发日期', value: formatDate(dialogForm.图纸下发日期 as any) },
        { label: '计划首样日期', value: formatDate(dialogForm.计划首样日期 as any) },
        { label: '负责人', value: dialogForm.负责人 },
        { label: '生产状态', value: dialogForm.生产状态, tag: true },
        { label: '优先级', value: dialogForm.优先级 }
      ]
    },
    {
      title: '数量信息',
      data: [
        { label: '投产数量', value: formatValue(dialogForm.投产数量) },
        { label: '已完成数量', value: formatValue(dialogForm.已完成数量) },
        { label: '批次完成数量', value: formatValue(dialogForm.批次完成数量) }
      ]
    },
    {
      title: '日期信息',
      data: [
        { label: '开始日期', value: formatDate(dialogForm.开始日期) },
        { label: '结束日期', value: formatDate(dialogForm.结束日期) },
        { label: '批次完成时间', value: formatDate(dialogForm.批次完成时间) },
        { label: '下达日期', value: formatDate(dialogForm.下达日期) }
      ]
    },
    {
      title: '工时信息',
      data: [
        { label: '放电工时', value: formatValue(dialogForm.放电工时) },
        { label: '试模工时', value: formatValue(dialogForm.试模工时) },
        { label: '抛光工时', value: formatValue(dialogForm.抛光工时) }
      ],
      data2: [
        { label: '机加工时', value: formatValue(dialogForm.机加工时) },
        { label: '装配工时', value: formatValue(dialogForm.装配工时) },
        { label: '加工中心工时', value: formatValue(dialogForm.加工中心工时) },
        { label: '线切割工时', value: formatValue(dialogForm.线切割工时) }
      ]
    }
  ]
})

const dialogRules: FormRules = {
  项目编号: [{ required: true, message: '项目编号不能为空', trigger: 'blur' }]
}

const formatDate = (date?: string | null) => {
  if (!date) return '-'

  // 处理 ISO 格式: 2025-10-02T00:00:00.000Z
  if (date.includes('T')) {
    return date.split('T')[0]
  }

  // 处理带时间的格式: 2024-01-01 12:00:00 或 2024-01-01 12:00:00.000
  if (date.includes(' ')) {
    return date.split(' ')[0]
  }

  // 如果已经是 YYYY-MM-DD 格式，直接返回
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date
  }

  return date
}

const formatValue = (value?: string | number | null) => {
  if (value === null || value === undefined || value === '') return '-'
  if (typeof value === 'number' && value === 0) return '-'
  return value
}

// 规范化为本地零点的日期，避免时区引起的天数误差
const normalizeToLocalDate = (date?: string | null) => {
  const ymd = formatDate(date)
  if (!ymd || ymd === '-') return null
  const [y, m, d] = ymd.split('-').map((v) => parseInt(v, 10))
  return new Date(y, (m || 1) - 1, d || 1)
}

// 返回今天到目标日期的天数（目标 - 今天），向下取整
const daysUntil = (date?: string | null) => {
  const target = normalizeToLocalDate(date)
  if (!target) return Infinity
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const diffMs = target.getTime() - today.getTime()
  return Math.floor(diffMs / (24 * 60 * 60 * 1000))
}

// 是否在未来7天内（含当天和第7天）
const isDueSoon = (date?: string | null) => {
  const d = daysUntil(date)
  return d >= 0 && d <= 7
}

const getStatusTagType = (status?: string) => {
  if (!status) return 'info'
  const statusMap: Record<string, 'success' | 'warning' | 'danger' | 'info'> = {
    待开始: 'info',
    进行中: 'warning',
    已完成: 'success',
    已暂停: 'danger',
    已取消: 'danger'
  }
  return statusMap[status] || 'info'
}

// 加载统计数据
const loadStatistics = async () => {
  try {
    const response: any = await getProductionTaskStatisticsApi()
    if (response?.code === 0 && response?.data) {
      statistics.total = response.data.total || 0
      statistics.inProgress = response.data.inProgress || 0
      statistics.completed = response.data.completed || 0
      statistics.pending = response.data.pending || 0
    }
  } catch (error: any) {
    console.error('获取统计数据失败:', error)
  }
}

const loadData = async () => {
  loading.value = true
  try {
    const params: any = {
      page: pagination.page,
      pageSize: pagination.size
    }
    if (queryForm.keyword) params.keyword = queryForm.keyword
    if (queryForm.status) params.status = queryForm.status

    const response: any = await getProductionTaskListApi(params)

    if (response?.data?.data) {
      tableData.value = response.data.data.list || []
      total.value = response.data.data.total || 0
    } else if (response?.data) {
      tableData.value = response.data.list || []
      total.value = response.data.total || 0
    }
  } catch (error: any) {
    console.error('获取数据失败:', error)
    ElMessage.error('获取数据失败: ' + (error.message || '未知错误'))
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  pagination.page = 1
  loadData()
  loadStatistics()
}

const handleReset = () => {
  queryForm.keyword = ''
  queryForm.status = ''
  handleSearch()
}

const handleSizeChange = (size: number) => {
  pagination.size = size
  pagination.page = 1
  loadData()
}

const handleCurrentChange = (page: number) => {
  pagination.page = page
  loadData()
}

const handleEdit = async (row: Partial<ProductionTaskInfo>) => {
  try {
    dialogTitle.value = '编辑生产任务'
    isViewMode.value = false
    currentProjectCode.value = row.项目编号 || ''

    // 获取详细信息
    const response: any = await getProductionTaskDetailApi(row.项目编号 || '')
    const detailData = response.data?.data || response.data || row

    Object.keys(dialogForm).forEach((key) => {
      delete dialogForm[key as keyof ProductionTaskInfo]
    })
    Object.assign(dialogForm, detailData)
    dialogVisible.value = true
  } catch (error: any) {
    ElMessage.error('加载数据失败: ' + (error.message || '未知错误'))
  }
}

const handleView = async (row: Partial<ProductionTaskInfo>) => {
  try {
    dialogTitle.value = '查看生产任务'
    isViewMode.value = true
    currentProjectCode.value = row.项目编号 || ''

    // 获取详细信息
    const response: any = await getProductionTaskDetailApi(row.项目编号 || '')
    const detailData = response.data?.data || response.data || row

    Object.keys(dialogForm).forEach((key) => {
      delete dialogForm[key as keyof ProductionTaskInfo]
    })
    Object.assign(dialogForm, detailData)
    dialogVisible.value = true
  } catch (error: any) {
    ElMessage.error('加载数据失败: ' + (error.message || '未知错误'))
  }
}

const handleRowDblClick = (row: Partial<ProductionTaskInfo>) => {
  handleEdit(row)
}

const submitDialogForm = async () => {
  if (!dialogFormRef.value) return

  try {
    await dialogFormRef.value.validate()
  } catch {
    return
  }

  dialogSubmitting.value = true
  try {
    // 过滤掉只读字段
    const { 项目编号, productName, productDrawing, 客户模号, ...updateData } = dialogForm

    await updateProductionTaskApi(currentProjectCode.value, updateData)
    ElMessage.success('更新成功')
    dialogVisible.value = false
    loadData()
    loadStatistics()
  } catch (error: any) {
    ElMessage.error('保存失败: ' + (error.message || '未知错误'))
  } finally {
    dialogSubmitting.value = false
  }
}

const handleDialogClosed = () => {
  isViewMode.value = false
  Object.keys(dialogForm).forEach((key) => {
    delete dialogForm[key as keyof ProductionTaskInfo]
  })
  currentProjectCode.value = ''
  dialogFormRef.value?.clearValidate()
}

onMounted(() => {
  loadStatistics()
  loadData()
})
</script>

<style scoped>
@media (width <= 768px) {
  .query-form--mobile {
    padding: 12px;
  }

  :deep(.query-form--mobile .el-form-item) {
    width: 100%;
    margin-right: 0;
    margin-bottom: 12px;
  }

  :deep(.query-form--mobile .el-form-item .el-form-item__content) {
    width: 100%;
  }

  :deep(.query-form--mobile .el-input),
  :deep(.query-form--mobile .el-select),
  :deep(.query-form--mobile .el-date-editor) {
    width: 100%;
  }

  .summary-card {
    height: auto;
    min-height: 70px;
  }

  .pt-mobile-card__meta {
    grid-template-columns: repeat(1, minmax(0, 1fr));
  }

  .pt-mobile-card__dates {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  :deep(.pt-table .el-table__body-wrapper tbody tr) {
    height: 42px !important;
  }

  :deep(.pt-table .el-table__body-wrapper .el-table__cell) {
    padding-top: 6px !important;
    padding-bottom: 6px !important;
  }
}

.pt-page {
  position: relative;
}

.mobile-top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 2px 6px 0;
}

.view-mode-switch {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.view-mode-switch__label {
  font-size: 12px;
  color: #666;
}

.query-form {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}

.query-form__actions {
  margin-left: auto;
}

.query-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

:deep(.query-form .el-form-item) {
  margin-bottom: 0;
}

.production-task-form :deep(.el-form-item) {
  margin-bottom: 18px;
}

/* 查看表格样式 - 紧凑布局 */
.view-table-container {
  padding: 3px 0;
}

.view-section-col {
  margin-bottom: 8px;
}

.view-section {
  margin-bottom: 0;
}

.view-table :deep(.label-column) {
  padding: 4px 8px !important;
  font-weight: 500;
  background-color: #f5f7fa;
  border-right: 1px solid #e4e7ed;
}

.view-table :deep(.value-column) {
  padding: 4px 8px !important;
  background-color: #fff;
}

.view-table :deep(.el-table__row) {
  transition: background-color 0.2s;
}

.view-table :deep(.el-table__row:hover) {
  background-color: #f5f7fa;
}

.view-table :deep(.el-table__cell) {
  padding: 0 !important;
}

.view-table :deep(.el-table--border) {
  overflow: hidden;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
}

.table-section-header {
  padding: 4px 0;
  margin-bottom: 4px;
  font-size: 12px;
  font-weight: 600;
  color: #409eff;
  border-bottom: 1px solid #409eff;
}

.view-table :deep(.label-column strong) {
  font-size: 12px;
  font-weight: 600;
  color: #606266;
  white-space: nowrap;
}

.view-table :deep(.value-column) {
  font-size: 12px;
  color: #303133;
}

.view-table :deep(.el-table__row) {
  height: 28px;
}

.view-table :deep(.el-table__body tr:hover > td) {
  background-color: #f5f7fa !important;
}

.view-table :deep(.el-table--border td) {
  border-right: 1px solid #ebeef5;
}

.view-table :deep(.el-table__body) {
  font-size: 12px;
}

.work-hours-container {
  width: 100%;
}

/* 工时信息标签列加宽，防止换行 */
.work-hours-container :deep(.label-column) {
  width: 110px !important;
  min-width: 110px;
}

/* 统计卡片样式 */
.summary-card {
  display: flex;
  height: 64px;
  border: none;
  transition: all 0.3s ease;
  align-items: stretch;
}

.summary-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgb(0 0 0 / 10%) !important;
}

/* 第一个卡片 - 蓝色 */
.summary-card--blue {
  background: linear-gradient(145deg, rgb(64 158 255 / 12%), rgb(64 158 255 / 6%));
}

.summary-card--blue .summary-title {
  color: #409eff;
}

.summary-card--blue .summary-value {
  color: #409eff;
}

/* 第二个卡片 - 绿色 */
.summary-card--green {
  background: linear-gradient(145deg, rgb(103 194 58 / 12%), rgb(103 194 58 / 6%));
}

.summary-card--green .summary-title {
  color: #67c23a;
}

.summary-card--green .summary-value {
  color: #67c23a;
}

/* 第三个卡片 - 橙色 */
.summary-card--orange {
  background: linear-gradient(145deg, rgb(230 162 60 / 12%), rgb(230 162 60 / 6%));
}

.summary-card--orange .summary-title {
  color: #e6a23c;
}

.summary-card--orange .summary-value {
  color: #e6a23c;
}

/* 第四个卡片 - 灰色 */
.summary-card--gray {
  background: linear-gradient(145deg, rgb(144 147 153 / 12%), rgb(144 147 153 / 6%));
}

.summary-card--gray .summary-title {
  color: #909399;
}

.summary-card--gray .summary-value {
  color: #909399;
}

.summary-title {
  font-size: 13px;
  font-weight: 500;
}

.summary-value {
  margin-top: 2px;
  font-size: 20px;
  font-weight: 600;
}

/* 表格所有单元格内容不换行，超出宽度省略显示 */
:deep(.el-table .cell),
:deep(.el-table .cell span),
:deep(.el-table .cell div) {
  white-space: nowrap !important;
}

/* 压缩数据行行高，仅作用于数据行 */
:deep(.el-table__body-wrapper .el-table__cell) {
  padding-top: 2px;
  padding-bottom: 2px;
}

/* 生产状态标签行高压缩，避免撑高整行 */
:deep(.pt-status-tag.el-tag) {
  height: 22px;
  padding-top: 0;
  padding-bottom: 0;
  margin-top: 0;
  margin-bottom: 0;
  line-height: 18px;
}

/* 分页固定在页面底部居中，靠近版权信息区域 */
.pagination-footer {
  position: fixed;
  right: 40px;
  bottom: 40px;
  left: auto;
  z-index: 10;
  display: flex;
  transform: none;
  justify-content: flex-end;
}

/* 统计卡片内容垂直居中 */
:deep(.summary-card .el-card__body) {
  display: flex;
  height: 100%;
  padding: 4px 12px;
  overflow: hidden;
  box-sizing: border-box;
  flex: 1;
  flex-direction: column;
  justify-content: center;
}

/* 统计卡片内容垂直居中 */
:deep(.summary-card .el-card__body) {
  display: flex;
  height: 100%;
  padding: 4px 12px;
  overflow: hidden;
  box-sizing: border-box;
  flex: 1;
  flex-direction: column;
  justify-content: center;
}

/* 额外覆盖：调整生产任务主表数据行高度，使在固定表高下正好显示 20 行 */
:deep(.pt-table .el-table__body-wrapper tbody tr) {
  height: 24px !important;
}

:deep(.pt-table .el-table__body-wrapper .el-table__cell) {
  padding-top: 3px !important;
  padding-bottom: 3px !important;
}

.pt-table-wrapper {
  background: var(--el-bg-color);
  border-radius: 8px;
}

.pt-table-wrapper--mobile {
  padding-bottom: 8px;
  overflow-x: auto;
}

.pt-table-wrapper--mobile .pt-table {
  min-width: 960px;
}

.pt-mobile-list {
  display: grid;
  gap: 12px;
}

.pt-mobile-card {
  border-radius: 10px;
}

.pt-mobile-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}

.pt-mobile-card__code {
  font-size: 14px;
  font-weight: 600;
}

.pt-mobile-card__name {
  font-size: 13px;
  color: #666;
}

.pt-mobile-card__meta {
  display: grid;
  font-size: 13px;
  color: #555;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px 12px;
}

.pt-mobile-card__meta .label {
  margin-right: 4px;
  color: #888;
}

.pt-mobile-card__dates {
  display: grid;
  margin: 8px 0;
  font-size: 13px;
  color: #555;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px 10px;
}

.pt-mobile-card__dates .label {
  margin-right: 4px;
  color: #888;
}

.pt-mobile-card__stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin: 6px 0;
}

.pt-mobile-card__stats .stat {
  padding: 8px 10px;
  background-color: #f6f7fb;
  border-radius: 8px;
}

.stat-label {
  font-size: 12px;
  color: #888;
}

.stat-value {
  margin-top: 4px;
  font-size: 16px;
  font-weight: 600;
}

.pt-mobile-card__actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 6px;
}

.pagination-footer--mobile {
  position: static;
  left: auto;
  margin-top: 12px;
  transform: none;
  justify-content: flex-end;
}
</style>
