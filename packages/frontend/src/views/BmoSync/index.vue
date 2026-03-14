<template>
  <div class="bmo-sync-page px-4 pt-0 pb-2 space-y-3">
    <div class="bmo-header-wrap">
      <div class="bmo-header">
        <div>
          <div class="bmo-title-line">
            <h3 class="bmo-title">BMO 数据采集</h3>
            <div class="bmo-title-status">
              <el-tag :type="connTagType" effect="plain">{{ connShortLabel }}</el-tag>
              <span v-if="lastDataSourceText" class="bmo-conn-meta"
                >数据来源：{{ lastDataSourceText }}</span
              >
              <span v-if="lastFetchedAtText" class="bmo-conn-meta"
                >最近抓取时间：{{ lastFetchedAtText }}</span
              >
              <span v-if="lastPersistedAtText" class="bmo-conn-meta"
                >最近获得新数据时间：{{ lastPersistedAtText }}</span
              >
              <span v-if="lastRefreshOutcomeText" class="bmo-conn-meta">{{
                lastRefreshOutcomeText
              }}</span>
            </div>
          </div>
          <p class="bmo-subtitle">通过 BMO 中转结果进行查看与立项</p>
        </div>
        <div class="bmo-actions">
          <el-button :disabled="!latestList.length" @click="exportCsv">导出CSV</el-button>
          <el-switch
            v-model="autoRefresh"
            active-text="自动刷新"
            inactive-text="手动"
            @change="handleAutoRefreshToggle"
          />
          <el-button :loading="manualRefreshing" @click="refreshAll">刷新</el-button>
        </div>
      </div>
    </div>

    <div class="bmo-section">
      <div class="bmo-section__title">最新采集数据</div>
      <el-table
        class="bmo-latest-table"
        v-loading="loadingLatest"
        :data="latestList"
        border
        size="small"
        max-height="600"
      >
        <el-table-column type="index" label="#" width="52" />
        <el-table-column
          prop="project_manager"
          label="项目经理"
          width="110"
          show-overflow-tooltip
        />
        <el-table-column prop="part_no" label="零部件图号" width="200" show-overflow-tooltip />
        <el-table-column prop="part_name" label="零部件名称" width="160" show-overflow-tooltip />
        <el-table-column prop="model" label="产品型号" width="170" show-overflow-tooltip />
        <el-table-column prop="mold_number" label="模具编号" width="130" show-overflow-tooltip />
        <el-table-column prop="bid_price_tax_incl" label="中标价格(含税)" width="140" align="right">
          <template #default="{ row }">
            {{ formatAmount(row.bid_price_tax_incl) }}
          </template>
        </el-table-column>
        <el-table-column prop="bid_time" label="中标时间" width="170">
          <template #default="{ row }">{{ formatTime(row.bid_time) }}</template>
        </el-table-column>
        <el-table-column prop="project_code" label="项目编号" width="140" show-overflow-tooltip>
          <template #default="{ row }">
            <el-tag
              v-if="row.project_code"
              :type="getStatusTagType(row.project_status)"
              :class="getStatusTagClass(row.project_status)"
              class="pm-status-tag--fixed bmo-project-code-tag"
            >
              {{ row.project_code }}
            </el-tag>
            <el-tag v-else type="info" class="bmo-project-code-tag">-</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <span>{{ getBmoRowStatusText(row) || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="170">
          <template #default="{ row }">
            <el-button link type="primary" @click="openViewDialog(row)">查看</el-button>
            <el-button
              v-if="canShowInitiateAction(row)"
              link
              type="primary"
              @click="openInitiateDialog(row)"
            >
              立项
            </el-button>
            <el-button
              v-else-if="hasProjectCode(row)"
              link
              type="primary"
              @click="openProjectManagementEdit(row.project_code)"
            >
              编辑
            </el-button>
            <el-button v-else link type="primary" @click="openInitiateDialog(row)"
              >查看立项</el-button
            >
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog
      v-model="initiateDialogVisible"
      class="bmo-initiate-dialog"
      :title="dialogMode === 'view' ? '查看（1.4-模具清单详情）' : '立项'"
      :width="isMobile ? '95vw' : '1400px'"
      :top="isMobile ? '4vh' : '2vh'"
      destroy-on-close
    >
      <div v-loading="initiateLoading" class="space-y-3">
        <el-descriptions :column="descriptionColumns" border size="small" title="表头信息">
          <el-descriptions-item label="零部件图号">
            {{ initiateRow?.part_no || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="零部件名称">
            {{ initiateRow?.part_name || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="产品型号">
            {{ initiateRow?.model || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="模具编号">
            {{ initiateRow?.mold_number || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="中标价格(含税)">
            {{ formatAmount(initiateRow?.bid_price_tax_incl ?? null) }}
          </el-descriptions-item>
          <el-descriptions-item label="中标时间">
            {{ formatTime(initiateRow?.bid_time || null) }}
          </el-descriptions-item>
        </el-descriptions>

        <div v-if="isViewMode" class="bmo-initiate-section">
          <div class="bmo-initiate-section__title">1.4-模具清单详情</div>

          <el-descriptions :column="descriptionColumns" border size="small">
            <el-descriptions-item label="提需类型">
              {{ initiateDetail?.demandType ?? '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="设计师">
              {{ initiateDetail?.designer ?? '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="BMO 记录ID">
              {{ initiateDetail?.fdId ?? initiateRow?.bmo_record_id ?? '-' }}
            </el-descriptions-item>
          </el-descriptions>

          <div class="bmo-initiate-subsection" style="margin-top: 12px">
            <div class="bmo-initiate-subsection__title">模具技术要求</div>
            <el-descriptions
              class="bmo-tech-desc"
              :column="techDescriptionColumns"
              :label-width="120"
              border
              size="small"
            >
              <el-descriptions-item
                v-for="field in initiateDetail?.tech?.fields || []"
                :key="field.name || field.label"
                :label="formatTechFieldLabel(field)"
                :span="isTechFieldFullRow(formatTechFieldLabel(field)) ? techDescriptionColumns : 1"
              >
                <div class="bmo-tech-value">
                  {{ formatTechFieldValue(field.value) }}
                </div>
              </el-descriptions-item>
            </el-descriptions>
            <el-collapse v-model="initiate14CollapseActive" class="bmo-initiate-collapse">
              <el-collapse-item name="attachments">
                <template #title>
                  <span class="bmo-initiate-subsection__title" style="margin: 0">技术要求附件</span>
                </template>
                <el-table
                  :data="initiateDetail?.tech?.attachments || []"
                  border
                  size="small"
                  max-height="220"
                >
                  <el-table-column
                    prop="fileName"
                    label="文件名"
                    min-width="320"
                    show-overflow-tooltip
                  />
                  <el-table-column prop="fileSize" label="大小" width="120" align="right">
                    <template #default="{ row }">{{ formatFileSize(row.fileSize) }}</template>
                  </el-table-column>
                  <el-table-column prop="createdAt" label="上传时间" width="180">
                    <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
                  </el-table-column>
                  <el-table-column label="操作" width="90" fixed="right">
                    <template #default="{ row }">
                      <el-button
                        v-if="row.id"
                        link
                        type="primary"
                        @click="downloadTechAttachment(row.id, row.fileName)"
                      >
                        下载
                      </el-button>
                      <span v-else>-</span>
                    </template>
                  </el-table-column>
                </el-table>
              </el-collapse-item>
            </el-collapse>
          </div>
        </div>

        <div v-if="!isViewMode" class="bmo-initiate-section">
          <div class="bmo-initiate-section__title">
            立项申请
            <el-tag v-if="initiateRequest?.status" class="ml-2" effect="plain">
              {{ getInitiationStatusText(initiateRequest) }}
            </el-tag>
            <el-tag v-if="initiationApplicantName !== '-'" class="ml-2" type="info" effect="plain">
              申请人：{{ initiationApplicantName }}
            </el-tag>
            <span v-if="initiateRequest?.rejected_reason" class="bmo-initiate-reject-reason">
              （驳回：{{ initiateRequest.rejected_reason }}）
            </span>
          </div>

          <div class="bmo-initiate-subsection">
            <div class="bmo-initiate-subsection__title">项目信息</div>
            <el-form :model="initiateProjectForm" label-width="96px" class="bmo-initiate-form">
              <el-row :gutter="12">
                <el-col :xs="24" :sm="6">
                  <el-form-item label="项目编号">
                    <el-input
                      v-model="initiateProjectForm.projectCode"
                      placeholder="请输入/编辑项目编号"
                      @input="handleInitiateProjectCodeInput"
                    >
                      <template #append>
                        <el-button
                          :loading="initiateRecommendingCode"
                          @click="recommendInitiateProjectCode"
                        >
                          推荐
                        </el-button>
                      </template>
                    </el-input>
                  </el-form-item>
                </el-col>
                <el-col :xs="24" :sm="6">
                  <el-form-item label="分类">
                    <el-select v-model="initiateProjectForm.projectCategory" style="width: 100%">
                      <el-option label="塑胶模具" value="01" />
                      <el-option label="零件加工" value="03" />
                      <el-option label="修改模具" value="05" />
                    </el-select>
                  </el-form-item>
                </el-col>
                <el-col :xs="24" :sm="6">
                  <el-form-item label="客户名称">
                    <el-select
                      v-model="initiateProjectForm.customerName"
                      placeholder="请选择客户名称"
                      style="width: 100%"
                      filterable
                      clearable
                      :loading="initiateCustomerLoading"
                      @change="handleInitiateCustomerNameChange"
                    >
                      <el-option
                        v-for="c in initiateCustomerOptions"
                        :key="c.id"
                        :label="c.customerName"
                        :value="c.customerName"
                      />
                    </el-select>
                  </el-form-item>
                </el-col>
                <el-col :xs="24" :sm="6">
                  <el-form-item label="客户模号">
                    <el-input
                      v-model="initiateProjectForm.customerModelNo"
                      placeholder="客户模号"
                    />
                  </el-form-item>
                </el-col>
              </el-row>

              <el-row :gutter="12">
                <el-col :xs="24" :sm="6">
                  <el-form-item label="产品名称">
                    <el-input v-model="initiateProjectForm.productName" placeholder="产品名称" />
                  </el-form-item>
                </el-col>
                <el-col :xs="24" :sm="6">
                  <el-form-item label="产品图号">
                    <el-input v-model="initiateProjectForm.productDrawing" placeholder="产品图号" />
                  </el-form-item>
                </el-col>
                <el-col :xs="24" :sm="6">
                  <el-form-item label="备注">
                    <el-input
                      v-model="initiateProjectForm.remarks"
                      type="textarea"
                      :rows="1"
                      placeholder="备注（可选）"
                    />
                  </el-form-item>
                </el-col>
                <el-col :xs="24" :sm="6" />
              </el-row>
            </el-form>
          </div>

          <div class="bmo-initiate-subsection">
            <div class="bmo-initiate-subsection__title">销售订单</div>
            <el-form :model="initiateSalesForm" label-width="96px" class="bmo-initiate-form">
              <el-row :gutter="12">
                <el-col :xs="24" :sm="6">
                  <el-form-item label="订单日期">
                    <el-date-picker
                      v-model="initiateSalesForm.orderDate"
                      type="date"
                      value-format="YYYY-MM-DD"
                      style="width: 100%"
                    />
                  </el-form-item>
                </el-col>
                <el-col :xs="24" :sm="6">
                  <el-form-item label="客户">
                    <el-select
                      v-model="initiateSalesForm.customerId"
                      placeholder="请选择客户"
                      style="width: 100%"
                      filterable
                      clearable
                      :loading="initiateCustomerLoading"
                    >
                      <el-option
                        v-for="c in initiateCustomerOptions"
                        :key="c.id"
                        :label="c.customerName"
                        :value="c.id"
                      />
                    </el-select>
                  </el-form-item>
                </el-col>
                <el-col :xs="24" :sm="6">
                  <el-form-item label="签订日期">
                    <el-date-picker
                      v-model="initiateSalesForm.signDate"
                      type="date"
                      value-format="YYYY-MM-DD"
                      style="width: 100%"
                      clearable
                    />
                  </el-form-item>
                </el-col>
                <el-col :xs="24" :sm="6">
                  <el-form-item label="合同号">
                    <el-input v-model="initiateSalesForm.contractNo" placeholder="合同号（可选）" />
                  </el-form-item>
                </el-col>
              </el-row>

              <el-row :gutter="12">
                <el-col :xs="24" :sm="6">
                  <el-form-item label="项目编号">
                    <el-input v-model="initiateSalesForm.detail.itemCode" />
                  </el-form-item>
                </el-col>
                <el-col :xs="24" :sm="6">
                  <el-form-item label="客户模号">
                    <el-input
                      v-model="initiateSalesForm.detail.customerPartNo"
                      placeholder="客户模号（可选）"
                    />
                  </el-form-item>
                </el-col>
                <el-col :xs="24" :sm="6">
                  <el-form-item label="数量">
                    <el-input-number
                      v-model="initiateSalesForm.detail.quantity"
                      :min="1"
                      :step="1"
                      style="width: 100%"
                    />
                  </el-form-item>
                </el-col>
                <el-col :xs="24" :sm="6">
                  <el-form-item label="单价(含税)">
                    <el-input-number
                      v-model="initiateSalesForm.detail.unitPrice"
                      :min="0"
                      :step="100"
                      style="width: 100%"
                    />
                  </el-form-item>
                </el-col>
              </el-row>

              <el-row :gutter="12">
                <el-col :xs="24" :sm="6">
                  <el-form-item label="总金额">
                    <el-input-number
                      v-model="initiateSalesForm.detail.totalAmount"
                      :min="0"
                      :step="100"
                      style="width: 100%"
                    />
                  </el-form-item>
                </el-col>
                <el-col :xs="24" :sm="6">
                  <el-form-item label="经办人">
                    <el-input
                      v-model="initiateSalesForm.detail.handler"
                      placeholder="经办人（可选）"
                    />
                  </el-form-item>
                </el-col>
                <el-col :xs="24" :sm="6">
                  <el-form-item label="费用出处">
                    <el-input
                      v-model="initiateSalesForm.detail.costSource"
                      placeholder="费用出处（可选）"
                    />
                  </el-form-item>
                </el-col>
                <el-col :xs="24" :sm="6">
                  <el-form-item label="备注">
                    <el-input
                      v-model="initiateSalesForm.detail.remark"
                      placeholder="备注（可选）"
                    />
                  </el-form-item>
                </el-col>
              </el-row>
            </el-form>
          </div>
        </div>
      </div>

      <template #footer>
        <el-button @click="initiateDialogVisible = false">关闭</el-button>
        <template v-if="!isViewMode">
          <el-button
            :disabled="isInitiationStatusLocked(initiateRequest?.status)"
            :loading="initiateSaving"
            @click="handleSaveInitiationDraft"
          >
            保存草稿</el-button
          >
          <el-button
            type="primary"
            :disabled="isInitiationStatusLocked(initiateRequest?.status)"
            :loading="initiateConfirming"
            @click="handleConfirmInitiation"
          >
            提交审核
          </el-button>
        </template>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import dayjs from 'dayjs'
import { useUserStoreWithOut } from '@/store/modules/user'
import {
  ensureBmoSessionApi,
  getBmoMouldProcurementApi,
  getBmoMouldProcurementRefreshApi,
  getBmoMouldProcurementDetailApi,
  getBmoInitiationCustomersApi,
  getBmoInitiationRequestApi,
  getBmoInitiationRequestByProjectApi,
  saveBmoInitiationDraftApi,
  confirmBmoInitiationRequestApi,
  type BmoMouldProcurementRow,
  type BmoMouldProcurementDetail,
  type BmoMouldProcurementDetailField,
  type BmoSyncStatusSummary,
  type BmoInitiationCustomerOption,
  type BmoInitiationRequestRow
} from '@/api/bmo'
import { getMaxSerialApi } from '@/api/goods'
import { refreshBmoMenuBadges } from '@/utils/bmoBadge'

const router = useRouter()
const userStore = useUserStoreWithOut()
const MOBILE_BREAKPOINT = 900

const openProjectManagementEdit = (projectCode: unknown) => {
  const code = String(projectCode || '').trim()
  if (!code) return
  // Prefer using ProjectManagement's return-context as a robust cross-page open signal,
  // since some navigation flows may lose query params (tabs/keep-alive).
  try {
    sessionStorage.setItem(
      'pm:return-context',
      JSON.stringify({ projectCode: code, tab: 'basic', at: Date.now() })
    )
  } catch (e) {
    // ignore
  }
  router.push({
    name: 'ProjectManagementIndex',
    query: { openProjectCode: code, openProjectTab: 'basic' }
  })
}

const getBmoRowStatusText = (row: Partial<BmoMouldProcurementRow> | null | undefined) => {
  if (!row) return ''
  if (String(row.project_code || '').trim()) return '项目执行中'

  const s = String((row as any).initiation_status || '').trim()
  if (s === 'APPLIED') return '已入库'
  if (s === 'PM_CONFIRMED' || s === 'SUBMITTED') return '审核中'
  return ''
}

const isInitiationStatusLocked = (status: unknown) => {
  const s = String(status || '').trim()
  return s === 'PM_CONFIRMED' || s === 'APPLIED'
}

const getInitiationStatusText = (row: Partial<BmoInitiationRequestRow> | null | undefined) => {
  if (!row) return '-'
  const statusText = String(row.status_text || '').trim()
  if (statusText) return statusText

  const s = String(row.status || '').trim()
  if (s === 'DRAFT') return '草稿'
  if (s === 'PM_CONFIRMED' || s === 'SUBMITTED') return '审核中'
  if (s === 'APPLIED') return '已入库'
  if (s === 'REJECTED') return '已驳回'
  return s || '-'
}

const initiationApplicantName = computed(() => {
  const requestRow = (initiateRequest.value || {}) as any
  const fromDisplayName = String(requestRow.created_by_display_name || '').trim()
  if (fromDisplayName) return fromDisplayName

  const fromUsername = String(requestRow.created_by || '').trim()
  if (!fromUsername) return '-'

  const currentUser = (userStore.getUserInfo || {}) as any
  const currentUsername = String(currentUser.username || '').trim()
  const currentDisplayName = String(currentUser.realName || currentUser.displayName || '').trim()
  if (currentDisplayName && currentUsername && fromUsername === currentUsername) {
    return currentDisplayName
  }
  return fromUsername
})

const canShowInitiateAction = (row: Partial<BmoMouldProcurementRow> | null | undefined) => {
  if (!row) return false
  if (hasProjectCode(row)) return false
  return !isInitiationStatusLocked((row as any).initiation_status)
}

const hasProjectCode = (row: Partial<BmoMouldProcurementRow> | null | undefined) => {
  return Boolean(String(row?.project_code || '').trim())
}

const TECH_FIELDS_FULL_ROW_LABELS = new Set<string>(['模具特殊需求及风险'])

const isTechFieldFullRow = (label: BmoMouldProcurementDetailField['label']) => {
  const normalized = (label ?? '').trim()
  return TECH_FIELDS_FULL_ROW_LABELS.has(normalized)
}

const formatTechFieldLabel = (field: BmoMouldProcurementDetailField) => {
  const normalized = (field?.label ?? '').trim()
  // Keep consistent with "1.4-模具清单详情" page display: show as "模具腔数".
  if (field?.name === 'fd_col_o527xg') return '模具腔数'
  return normalized || field?.name || '-'
}

const formatTechFieldValue = (value: BmoMouldProcurementDetailField['value']) => {
  if (value === null || value === undefined) return '-'
  const s = String(value).trim()
  return s.length ? s : '-'
}

const getStatusTagType = (status?: string | null) => {
  if (!status) return 'info'
  const statusTypeMap: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'primary'> = {
    T0: 'danger',
    T1: 'warning',
    T2: 'warning',
    设计中: 'warning',
    加工中: 'primary',
    表面处理: 'info',
    封样: 'primary',
    待移模: 'primary',
    已经移模: 'success'
  }
  return statusTypeMap[status] || 'info'
}

const statusClassMap: Record<string, string> = {
  T0: 'pm-status--t0',
  T1: 'pm-status--t1',
  T2: 'pm-status--t2',
  设计中: 'pm-status--designing',
  加工中: 'pm-status--processing',
  表面处理: 'pm-status--surface',
  封样: 'pm-status--sample',
  待移模: 'pm-status--pending-move',
  已经移模: 'pm-status--moved'
}

const getStatusTagClass = (status?: string | null) => {
  if (!status) return ''
  return statusClassMap[status] || ''
}

const loadingLatest = ref(false)
const manualRefreshing = ref(false)
const autoRefresh = ref(true)
const pollingTimer = ref<number | null>(null)
const isMobile = ref(false)
const SHANGHAI_TIME_ZONE = 'Asia/Shanghai'

const latestList = ref<BmoMouldProcurementRow[]>([])
const lastDataSource = ref<'live' | 'db' | null>(null)
const lastConnectionState = ref<'connected' | 'expired' | 'error' | null>(null)
const lastConnectionMessage = ref<string | null>(null)
const lastFetchedAt = ref<string | null>(null)
const lastPersistedAt = ref<string | null>(null)
const lastRefreshOutcomeText = ref('')

const initiateDialogVisible = ref(false)
const dialogMode = ref<'view' | 'initiate'>('initiate')
const isViewMode = computed(() => dialogMode.value === 'view')
const initiateLoading = ref(false)
const initiateRow = ref<BmoMouldProcurementRow | null>(null)
const initiateDetail = ref<BmoMouldProcurementDetail | null>(null)
const initiateRequest = ref<BmoInitiationRequestRow | null>(null)
const initiateSaving = ref(false)
const initiateConfirming = ref(false)
const initiateRecommendingCode = ref(false)
const initiateCustomerLoading = ref(false)
const initiateCustomerOptions = ref<BmoInitiationCustomerOption[]>([])
const initiate14CollapseActive = ref<string[]>([])

const DEFAULT_INITIATE_CUSTOMER_NAME = '长虹美菱股份有限公司'
const initiateProjectCodeAuto = ref(true)
const lastAutoSyncedProjectCode = ref('')

const initiateProjectForm = reactive({
  projectCode: '',
  projectCategory: '01',
  projectYear: '',
  projectSerial: '',
  partNumber: '',
  productName: '',
  productDrawing: '',
  customerModelNo: '',
  customerName: DEFAULT_INITIATE_CUSTOMER_NAME,
  remarks: ''
})

const initiateSalesForm = reactive({
  orderDate: '',
  signDate: '',
  contractNo: '',
  customerId: undefined as number | undefined,
  detail: {
    itemCode: '',
    customerPartNo: '',
    deliveryDate: '',
    quantity: 1,
    unitPrice: 0,
    totalAmount: 0,
    remark: '',
    costSource: '',
    handler: '',
    isInStock: false,
    isShipped: false,
    shippingDate: ''
  }
})

const connTagType = computed(() => {
  if (lastConnectionState.value === 'connected') return 'success'
  if (lastConnectionState.value === 'expired') return 'warning'
  if (lastConnectionState.value === 'error') return 'danger'
  return 'info'
})

const connShortLabel = computed(() => {
  if (lastConnectionState.value === 'connected') return '已连接'
  if (lastConnectionState.value === 'expired') return '会话过期'
  if (lastConnectionState.value === 'error') return '连接异常'
  return '未知状态'
})
const lastDataSourceText = computed(() => {
  if (lastDataSource.value === 'live') return '实时采集'
  if (lastDataSource.value === 'db') return '库内缓存'
  return ''
})
const lastFetchedAtText = computed(() => {
  return lastFetchedAt.value ? formatTime(lastFetchedAt.value) : ''
})
const lastPersistedAtText = computed(() =>
  lastPersistedAt.value ? formatTime(lastPersistedAt.value) : ''
)
const descriptionColumns = computed(() => (isMobile.value ? 1 : 3))
const techDescriptionColumns = computed(() => (isMobile.value ? 1 : 4))

const updateViewport = () => {
  if (typeof window === 'undefined') return
  isMobile.value = window.innerWidth < MOBILE_BREAKPOINT
}

const formatTime = (value: string | null | undefined) => {
  if (!value) return '-'
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) return value
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: SHANGHAI_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(date)
}

const formatAmount = (value: number | null | undefined) => {
  if (value === null || value === undefined) return '-'
  const amount = Number(value)
  return Number.isFinite(amount) ? amount.toLocaleString('zh-CN') : '-'
}

const formatFileSize = (bytes: number | null | undefined) => {
  const n = Number(bytes)
  if (!Number.isFinite(n) || n <= 0) return '-'
  const units = ['B', 'KB', 'MB', 'GB']
  let size = n
  let idx = 0
  while (size >= 1024 && idx < units.length - 1) {
    size /= 1024
    idx += 1
  }
  return `${size.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`
}

const serializeBmoListForCompare = (rows: BmoMouldProcurementRow[]) =>
  JSON.stringify(
    (rows || []).map((row) => ({
      bmo_record_id: row.bmo_record_id || null,
      project_manager: row.project_manager || null,
      part_no: row.part_no || null,
      part_name: row.part_name || null,
      model: row.model || null,
      mold_number: row.mold_number || null,
      project_code: row.project_code || null,
      project_status: row.project_status || null,
      initiation_status: row.initiation_status || null,
      bid_price_tax_incl: row.bid_price_tax_incl ?? null,
      bid_time: row.bid_time || null
    }))
  )

const applySyncStatus = (syncStatus: BmoSyncStatusSummary | null | undefined) => {
  const lastFinishedAt = String(syncStatus?.lastFinishedAt || '').trim()
  const lastStartedAt = String(syncStatus?.lastStartedAt || '').trim()
  const lastSuccessAt = String(syncStatus?.lastSuccessAt || '').trim()
  lastFetchedAt.value = lastFinishedAt || lastStartedAt || null
  lastPersistedAt.value = lastSuccessAt || null
}

const parseProjectCodeParts = (projectCode: string) => {
  const s = String(projectCode || '').trim()
  const match = s.match(/JH(\d{2})-(\d{2})-(\d{3})(\/(\d{2}))?/)
  if (!match) return null
  return {
    projectCategory: match[1],
    projectYear: match[2],
    projectSerial: match[3],
    partNumber: match[5] || ''
  }
}

const generateProjectCode = (input: {
  projectCategory: string
  projectYear: string
  projectSerial: string
  partNumber?: string
}) => {
  const projectCategory = String(input.projectCategory || '').trim()
  const projectYear = String(input.projectYear || '')
    .trim()
    .padStart(2, '0')
  const projectSerial = String(input.projectSerial || '')
    .trim()
    .padStart(3, '0')
  if (!projectCategory || !projectYear || !projectSerial) return ''

  let code = `JH${projectCategory}-${projectYear}-${projectSerial}`
  const trimmedPart = String(input.partNumber || '').trim()
  if (trimmedPart) {
    const partStr = trimmedPart.padStart(2, '0')
    code += `/${partStr}`
  }
  return code
}

watch(
  () => [
    initiateProjectForm.projectCategory,
    initiateProjectForm.projectYear,
    initiateProjectForm.projectSerial,
    initiateProjectForm.partNumber
  ],
  () => {
    if (!initiateProjectCodeAuto.value) return
    const next = generateProjectCode({
      projectCategory: initiateProjectForm.projectCategory,
      projectYear: initiateProjectForm.projectYear,
      projectSerial: initiateProjectForm.projectSerial,
      partNumber: initiateProjectForm.partNumber
    })
    if (next) initiateProjectForm.projectCode = next
  }
)

watch(
  () => [initiateSalesForm.detail.quantity, initiateSalesForm.detail.unitPrice],
  () => {
    const qty = Number(initiateSalesForm.detail.quantity || 0)
    const unit = Number(initiateSalesForm.detail.unitPrice || 0)
    const total = qty * unit
    initiateSalesForm.detail.totalAmount = Number.isFinite(total) ? total : 0
  }
)

watch(
  () => initiateProjectForm.projectCode,
  (next, prev) => {
    const nextCode = String(next || '').trim()
    const prevCode = String(prev || '').trim()
    const currentItemCode = String(initiateSalesForm.detail.itemCode || '').trim()
    if (
      !currentItemCode ||
      currentItemCode === prevCode ||
      currentItemCode === lastAutoSyncedProjectCode.value
    ) {
      initiateSalesForm.detail.itemCode = nextCode
      lastAutoSyncedProjectCode.value = nextCode
    }
  }
)

const handleInitiateProjectCodeInput = () => {
  initiateProjectCodeAuto.value = false
}

const isProjectCodeReservedByOtherInitiation = async (
  projectCode: string,
  currentBmoRecordId: string
) => {
  const code = String(projectCode || '').trim()
  if (!code) return false
  const resp = await getBmoInitiationRequestByProjectApi({ projectCode: code })
  const row = resp.data
  if (!row) return false

  const rowRecordId = String(row.bmo_record_id || '').trim()
  if (rowRecordId && rowRecordId === currentBmoRecordId) return false

  const status = String(row.status || '').trim()
  return status !== 'REJECTED'
}

const recommendInitiateProjectCode = async () => {
  initiateRecommendingCode.value = true
  try {
    // 规则：提需类型=新品/增量 -> 塑胶模具 -> category=01
    initiateProjectForm.projectCategory = '01'
    const yy = dayjs().format('YY')
    initiateProjectForm.projectYear = yy

    const res = await getMaxSerialApi('01')
    const nextSerial = res.data?.nextSerial ?? (res.data?.maxSerial ? res.data.maxSerial + 1 : null)
    if (nextSerial === null || nextSerial === undefined) {
      ElMessage.error('获取最大序号失败，无法推荐项目编号')
      return
    }
    const currentBmoRecordId = String(initiateRow.value?.bmo_record_id || '').trim()
    let serialCursor = Number(nextSerial) || 0
    let pickedCode = ''
    for (let i = 0; i < 200; i += 1) {
      const serialStr = String(serialCursor).padStart(3, '0')
      const candidate = generateProjectCode({
        projectCategory: initiateProjectForm.projectCategory,
        projectYear: initiateProjectForm.projectYear,
        projectSerial: serialStr,
        partNumber: initiateProjectForm.partNumber
      })
      if (!candidate) break
      const reserved = await isProjectCodeReservedByOtherInitiation(candidate, currentBmoRecordId)
      if (!reserved) {
        initiateProjectForm.projectSerial = serialStr
        pickedCode = candidate
        break
      }
      serialCursor += 1
    }
    if (!pickedCode) {
      ElMessage.error('推荐项目编号失败：未找到可用序号，请手动填写')
      return
    }
    initiateProjectCodeAuto.value = true
    initiateProjectForm.projectCode = pickedCode

    // 同步订单明细的项目编号
    initiateSalesForm.detail.itemCode = initiateProjectForm.projectCode
    lastAutoSyncedProjectCode.value = initiateProjectForm.projectCode
  } catch (e: any) {
    ElMessage.error(e?.message || '推荐项目编号失败')
  } finally {
    initiateRecommendingCode.value = false
  }
}

const loadInitiateCustomers = async () => {
  initiateCustomerLoading.value = true
  try {
    const res = await getBmoInitiationCustomersApi({ status: 'active' })
    initiateCustomerOptions.value = res.data?.list || []
  } catch (e: any) {
    initiateCustomerOptions.value = []
    ElMessage.error(e?.message || '读取客户列表失败')
  } finally {
    initiateCustomerLoading.value = false
  }
}

const handleInitiateCustomerNameChange = (name: string) => {
  const s = String(name || '').trim()
  const match = initiateCustomerOptions.value.find((x) => x.customerName === s)
  if (match?.id) initiateSalesForm.customerId = match.id
}

const applyDefaultsFromBmoRow = async (row: BmoMouldProcurementRow) => {
  initiateRequest.value = null
  initiateProjectCodeAuto.value = true

  initiateProjectForm.projectCategory = '01'
  initiateProjectForm.projectYear = dayjs().format('YY')
  initiateProjectForm.projectSerial = ''
  initiateProjectForm.partNumber = ''

  initiateProjectForm.productName = String(row.part_name || '').trim()
  initiateProjectForm.productDrawing = String(row.part_no || '').trim()
  initiateProjectForm.customerModelNo = String(row.mold_number || '').trim()
  initiateProjectForm.customerName = DEFAULT_INITIATE_CUSTOMER_NAME
  initiateProjectForm.remarks = ''

  initiateSalesForm.orderDate = dayjs().format('YYYY-MM-DD')
  initiateSalesForm.signDate = ''
  initiateSalesForm.contractNo = ''
  initiateSalesForm.customerId = undefined
  initiateSalesForm.detail.customerPartNo = initiateProjectForm.customerModelNo
  initiateSalesForm.detail.quantity = 1
  initiateSalesForm.detail.unitPrice = Number(row.bid_price_tax_incl || 0)
  initiateSalesForm.detail.remark = ''
  initiateSalesForm.detail.costSource = ''
  initiateSalesForm.detail.handler = ''

  // Load customers and set defaults
  if (!initiateCustomerOptions.value.length) await loadInitiateCustomers()
  const defaultCustomer = initiateCustomerOptions.value.find(
    (x) => x.customerName === DEFAULT_INITIATE_CUSTOMER_NAME
  )
  if (defaultCustomer?.id) initiateSalesForm.customerId = defaultCustomer.id

  await recommendInitiateProjectCode()
}

const applyRequestToForms = (row: BmoInitiationRequestRow) => {
  initiateRequest.value = row
  const goods = row.goods_draft || null
  const sales = row.sales_order_draft || null

  if (goods?.projectCode) {
    initiateProjectForm.projectCode = goods.projectCode
    const parts = parseProjectCodeParts(goods.projectCode)
    if (parts) {
      initiateProjectForm.projectCategory = parts.projectCategory
      initiateProjectForm.projectYear = parts.projectYear
      initiateProjectForm.projectSerial = parts.projectSerial
      initiateProjectForm.partNumber = parts.partNumber
    }
  }
  if (goods?.productName !== undefined)
    initiateProjectForm.productName = String(goods.productName || '')
  if (goods?.productDrawing !== undefined)
    initiateProjectForm.productDrawing = String(goods.productDrawing || '')
  if (goods?.customerModelNo !== undefined)
    initiateProjectForm.customerModelNo = String(goods.customerModelNo || '')
  if (goods?.customerName !== undefined)
    initiateProjectForm.customerName = String(goods.customerName || '')
  if (goods?.remarks !== undefined) initiateProjectForm.remarks = String(goods.remarks || '')

  if (sales?.orderDate !== undefined && sales.orderDate !== null) {
    initiateSalesForm.orderDate = String(sales.orderDate)
  }
  if (sales?.signDate !== undefined && sales.signDate !== null) {
    initiateSalesForm.signDate = String(sales.signDate)
  }
  if (sales?.contractNo !== undefined && sales.contractNo !== null) {
    initiateSalesForm.contractNo = String(sales.contractNo)
  }
  if (sales?.customerId !== undefined && sales.customerId !== null) {
    initiateSalesForm.customerId = Number(sales.customerId)
  }

  const d = Array.isArray(sales?.details) && sales?.details?.length ? sales.details[0] : null
  if (d) {
    if (d.itemCode !== undefined && d.itemCode !== null)
      initiateSalesForm.detail.itemCode = String(d.itemCode)
    if (d.customerPartNo !== undefined && d.customerPartNo !== null)
      initiateSalesForm.detail.customerPartNo = String(d.customerPartNo)
    if (d.deliveryDate !== undefined && d.deliveryDate !== null)
      initiateSalesForm.detail.deliveryDate = String(d.deliveryDate)
    if (d.quantity !== undefined && d.quantity !== null)
      initiateSalesForm.detail.quantity = Number(d.quantity) || 1
    if (d.unitPrice !== undefined && d.unitPrice !== null)
      initiateSalesForm.detail.unitPrice = Number(d.unitPrice) || 0
    if (d.totalAmount !== undefined && d.totalAmount !== null)
      initiateSalesForm.detail.totalAmount = Number(d.totalAmount) || 0
    if (d.remark !== undefined && d.remark !== null)
      initiateSalesForm.detail.remark = String(d.remark)
    if (d.costSource !== undefined && d.costSource !== null)
      initiateSalesForm.detail.costSource = String(d.costSource)
    if (d.handler !== undefined && d.handler !== null)
      initiateSalesForm.detail.handler = String(d.handler)
    if (d.isInStock !== undefined && d.isInStock !== null)
      initiateSalesForm.detail.isInStock = Boolean(d.isInStock)
    if (d.isShipped !== undefined && d.isShipped !== null)
      initiateSalesForm.detail.isShipped = Boolean(d.isShipped)
    if (d.shippingDate !== undefined && d.shippingDate !== null)
      initiateSalesForm.detail.shippingDate = String(d.shippingDate)
  }
}

const buildInitiationDraftPayload = () => {
  const bmo_record_id = String(initiateRow.value?.bmo_record_id || '').trim()
  const goods_draft = {
    projectCode: String(initiateProjectForm.projectCode || '').trim(),
    productDrawing: String(initiateProjectForm.productDrawing || '').trim() || null,
    productName: String(initiateProjectForm.productName || '').trim() || null,
    category: '塑胶模具',
    remarks: String(initiateProjectForm.remarks || '').trim() || null,
    customerName: String(initiateProjectForm.customerName || '').trim() || null,
    customerModelNo: String(initiateProjectForm.customerModelNo || '').trim() || null
  }
  const sales_order_draft = {
    orderDate: initiateSalesForm.orderDate || null,
    signDate: initiateSalesForm.signDate || null,
    contractNo: String(initiateSalesForm.contractNo || '').trim() || null,
    customerId: initiateSalesForm.customerId ?? null,
    details: [
      {
        itemCode:
          String(initiateSalesForm.detail.itemCode || '').trim() || goods_draft.projectCode || null,
        customerPartNo: String(initiateSalesForm.detail.customerPartNo || '').trim() || null,
        deliveryDate: null,
        totalAmount: Number(initiateSalesForm.detail.totalAmount || 0),
        unitPrice: Number(initiateSalesForm.detail.unitPrice || 0),
        quantity: Number(initiateSalesForm.detail.quantity || 0),
        remark: String(initiateSalesForm.detail.remark || '').trim() || null,
        costSource: String(initiateSalesForm.detail.costSource || '').trim() || null,
        handler: String(initiateSalesForm.detail.handler || '').trim() || null,
        isInStock: false,
        isShipped: false,
        shippingDate: null
      }
    ]
  }
  const tech_snapshot = {
    demandType: initiateDetail.value?.demandType ?? null,
    designer: initiateDetail.value?.designer ?? null,
    fdId: initiateDetail.value?.fdId ?? bmo_record_id ?? null,
    tech: initiateDetail.value?.tech ?? null
  }

  return {
    bmo_record_id,
    project_code_candidate: goods_draft.projectCode,
    goods_draft,
    sales_order_draft,
    tech_snapshot
  }
}

const ensureSessionOnOpen = async () => {
  try {
    const res = await ensureBmoSessionApi({ maxWaitMs: 2000, keeperTimeoutMs: 60000 })
    const data = res.data
    lastConnectionState.value = data?.state || null
    lastConnectionMessage.value = data?.message || null
  } catch (e: any) {
    lastConnectionState.value = 'error'
    lastConnectionMessage.value = e?.message || 'ensure session failed'
  }
}

const loadLatest = async () => {
  loadingLatest.value = true
  try {
    const res = await getBmoMouldProcurementApi({ limit: 200, timeout: 12000 })
    latestList.value = res.data?.list || []
    lastDataSource.value = 'db'
    applySyncStatus(res.data?.syncStatus)
    if (!lastPersistedAt.value) {
      lastPersistedAt.value = res.data?.latestUpdatedAt || null
    }
  } finally {
    loadingLatest.value = false
  }
}

const refreshAll = async () => {
  manualRefreshing.value = true
  try {
    const previousSnapshot = serializeBmoListForCompare(latestList.value)
    const res = await getBmoMouldProcurementRefreshApi({
      pageSize: 200,
      offset: 0,
      maxWaitMs: 60000,
      timeout: 70000
    })
    const nextList = res.data?.list || []
    latestList.value = nextList
    lastDataSource.value = res.data?.source || null
    lastConnectionState.value = res.data?.connection?.state || null
    lastConnectionMessage.value = res.data?.connection?.message || null
    applySyncStatus(res.data?.syncStatus)
    if (res.data?.fetchedAt) {
      lastFetchedAt.value = res.data.fetchedAt
    }
    if (!lastPersistedAt.value) {
      lastPersistedAt.value = res.data?.latestUpdatedAt || null
    }
    const changed = previousSnapshot !== serializeBmoListForCompare(nextList)
    lastRefreshOutcomeText.value = changed ? '本次刷新：发现数据变化' : '本次刷新：未发现数据变化'
    ElMessage.success('已刷新 BMO 数据')
  } catch (e: any) {
    lastRefreshOutcomeText.value = '本次刷新：失败'
    ElMessage.error(e?.message || '刷新 BMO 数据失败')
  } finally {
    manualRefreshing.value = false
  }
}

const openBmoDetailDialog = async (row: BmoMouldProcurementRow, mode: 'view' | 'initiate') => {
  const fdId = row.bmo_record_id
  if (!fdId) {
    ElMessage.warning('缺少 BMO 记录ID（bmo_record_id），无法读取 1.4 详情')
    return
  }

  dialogMode.value = mode
  initiateDialogVisible.value = true
  initiateRow.value = row
  initiateDetail.value = null
  initiateRequest.value = null
  initiateLoading.value = true
  try {
    // 并行：1.4 详情 + 立项申请单草稿 + 客户列表
    const [detailRes, requestRes] = await Promise.all([
      getBmoMouldProcurementDetailApi({ fdId }),
      getBmoInitiationRequestApi({ bmo_record_id: fdId })
    ])
    initiateDetail.value = detailRes.data || null
    const reqRow = (requestRes.data as any) || null
    if (reqRow) {
      applyRequestToForms(reqRow)
      // 若没有加载过客户列表，顺便加载，保证下拉可用
      if (!initiateCustomerOptions.value.length) void loadInitiateCustomers()
    } else if (mode !== 'view') {
      await applyDefaultsFromBmoRow(row)
    }
  } catch (e: any) {
    ElMessage.error(e?.message || '读取 1.4 详情失败')
    if (mode !== 'view') {
      await applyDefaultsFromBmoRow(row)
    }
  } finally {
    initiateLoading.value = false
  }
}

const openViewDialog = async (row: BmoMouldProcurementRow) => {
  await openBmoDetailDialog(row, 'view')
}

const openInitiateDialog = async (row: BmoMouldProcurementRow) => {
  await openBmoDetailDialog(row, 'initiate')
}

const handleSaveInitiationDraft = async () => {
  const payload = buildInitiationDraftPayload()
  if (!payload.bmo_record_id) {
    ElMessage.error('缺少 bmo_record_id，无法保存草稿')
    return
  }
  if (!payload.goods_draft.projectCode) {
    ElMessage.error('项目编号不能为空')
    return
  }
  initiateSaving.value = true
  try {
    const res = await saveBmoInitiationDraftApi(payload)
    const row = (res.data as any) || null
    initiateRequest.value = row
    ElMessage.success('草稿已保存')
  } catch (e: any) {
    ElMessage.error(e?.message || '保存草稿失败')
  } finally {
    initiateSaving.value = false
  }
}

const handleConfirmInitiation = async () => {
  if (isInitiationStatusLocked(initiateRequest.value?.status)) {
    ElMessage.warning('当前状态不可重复提交审核')
    return
  }
  const payload = buildInitiationDraftPayload()
  if (!payload.bmo_record_id) {
    ElMessage.error('缺少 bmo_record_id，无法提交审核')
    return
  }
  if (!payload.goods_draft.projectCode) {
    ElMessage.error('项目编号不能为空')
    return
  }
  if (!payload.sales_order_draft.customerId) {
    ElMessage.error('请选择客户（销售订单）')
    return
  }
  initiateConfirming.value = true
  try {
    const res = await confirmBmoInitiationRequestApi(payload)
    const row = (res.data as any) || null
    initiateRequest.value = row
    await refreshBmoMenuBadges()
    ElMessage.success('已提交审核')
  } catch (e: any) {
    ElMessage.error(e?.message || '提交审核失败')
  } finally {
    initiateConfirming.value = false
  }
}

const downloadTechAttachment = (attachmentId: string, fileName?: string | null) => {
  const fdId = String(initiateDetail.value?.fdId || initiateRow.value?.bmo_record_id || '').trim()
  if (!fdId) {
    ElMessage.error('缺少 fdId，无法下载附件')
    return
  }
  const params = new URLSearchParams()
  params.set('fdId', fdId)
  const safeFileName = String(fileName || '').trim()
  if (safeFileName) params.set('fileName', safeFileName)
  const url = `/api/bmo/attachment/download/${encodeURIComponent(attachmentId)}?${params.toString()}`
  window.open(url, '_blank')
}

const exportCsv = () => {
  if (!latestList.value.length) {
    ElMessage.warning('暂无可导出数据')
    return
  }
  const headers = [
    '序号',
    '项目经理',
    '零部件图号',
    '零部件名称',
    '产品型号',
    '模具编号',
    '中标价格（含税）',
    '中标时间',
    '项目编号'
  ]
  const escapeCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`
  const lines = [
    headers.join(','),
    ...latestList.value.map((row, idx) =>
      [
        idx + 1,
        row.project_manager,
        row.part_no,
        row.part_name,
        row.model,
        row.mold_number,
        row.bid_price_tax_incl ?? '',
        formatTime(row.bid_time),
        row.project_code ?? ''
      ]
        .map(escapeCell)
        .join(',')
    )
  ]
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `bmo-latest-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const startPolling = () => {
  if (pollingTimer.value !== null) return
  pollingTimer.value = window.setInterval(async () => {
    if (loadingLatest.value) return
    await loadLatest()
  }, 60000)
}

const stopPolling = () => {
  if (pollingTimer.value !== null) {
    window.clearInterval(pollingTimer.value)
    pollingTimer.value = null
  }
}

const handleAutoRefreshToggle = (enabled: boolean) => {
  if (enabled) {
    startPolling()
  } else {
    stopPolling()
  }
}

onMounted(() => {
  updateViewport()
  window.addEventListener('resize', updateViewport, { passive: true })
  void ensureSessionOnOpen()
  void loadLatest()
  if (autoRefresh.value) startPolling()
})

onBeforeUnmount(() => {
  stopPolling()
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', updateViewport)
  }
})
</script>

<style scoped lang="less">
.bmo-sync-page {
  :deep(.bmo-initiate-dialog .el-dialog__body) {
    max-height: calc(100vh - 180px);
    overflow: auto;
  }

  .bmo-header-wrap {
    padding: 12px 15px;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 10px;
  }

  .bmo-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .bmo-title {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    line-height: 1.2;
  }

  .bmo-title-line {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .bmo-title-status {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .bmo-subtitle {
    margin: 4px 0 0;
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }

  .bmo-conn {
    display: flex;
    margin-top: 8px;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .bmo-conn-meta {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .bmo-actions {
    display: flex;
    gap: 8px;
  }

  .bmo-section {
    padding: 12px 15px;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 10px;
  }

  .bmo-section__title {
    margin-bottom: 10px;
    font-size: 14px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .bmo-initiate-section {
    padding: 12px 15px;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 10px;
  }

  .bmo-initiate-section__title {
    margin-bottom: 10px;
    font-size: 14px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .bmo-initiate-subsection {
    padding: 10px 12px;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
  }

  .bmo-initiate-subsection + .bmo-initiate-subsection {
    margin-top: 12px;
  }

  .bmo-initiate-subsection__title {
    margin-bottom: 10px;
    font-size: 13px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .bmo-initiate-collapse {
    :deep(.el-collapse-item__header) {
      height: 34px;
      padding: 0;
      font-weight: 600;
      line-height: 34px;
    }

    :deep(.el-collapse-item__wrap) {
      border-bottom: none;
    }
  }

  .bmo-initiate-reject-reason {
    margin-left: 8px;
    font-size: 12px;
    font-weight: 400;
    color: var(--el-color-danger);
  }

  .bmo-initiate-form {
    :deep(.el-form-item) {
      margin-bottom: 10px;
    }
  }

  .bmo-tech-value {
    line-height: 1.35;
    word-break: break-word;
    white-space: pre-wrap;
  }

  /* 模具技术要求：4 列时避免列宽抖动，统一 label 宽度，内容可换行 */
  .bmo-tech-desc {
    :deep(.el-descriptions__table) {
      width: 100%;
      table-layout: fixed;
    }

    :deep(.el-descriptions__label) {
      white-space: nowrap;
    }

    :deep(.el-descriptions__content) {
      overflow: hidden;
    }
  }

  /* 对齐“项目管理-项目状态”的 tag 风格 */
  :deep(.el-tag) {
    font-weight: 500;
    letter-spacing: 0.5px;
    border-radius: 4px;
    box-shadow: 0 1px 3px rgb(0 0 0 / 10%);
  }

  :deep(.el-tag.pm-status--t0) {
    color: #f5222d !important;
    background-color: rgb(245 34 45 / 12%) !important;
    border-color: rgb(245 34 45 / 45%) !important;
  }

  :deep(.el-tag.pm-status--t1) {
    color: #fa541c !important;
    background-color: rgb(250 84 28 / 12%) !important;
    border-color: rgb(250 84 28 / 45%) !important;
  }

  :deep(.el-tag.pm-status--t2) {
    color: #faad14 !important;
    background-color: rgb(250 173 20 / 12%) !important;
    border-color: rgb(250 173 20 / 45%) !important;
  }

  :deep(.el-tag.pm-status--designing) {
    color: #67c23a !important;
    background-color: rgb(103 194 58 / 12%) !important;
    border-color: rgb(103 194 58 / 45%) !important;
  }

  :deep(.el-tag.pm-status--processing) {
    color: #e6a23c !important;
    background-color: rgb(230 162 60 / 12%) !important;
    border-color: rgb(230 162 60 / 45%) !important;
  }

  :deep(.el-tag.pm-status--surface) {
    color: #13c2c2 !important;
    background-color: rgb(19 194 194 / 12%) !important;
    border-color: rgb(19 194 194 / 45%) !important;
  }

  :deep(.el-tag.pm-status--sample) {
    color: #2f54eb !important;
    background-color: rgb(47 84 235 / 12%) !important;
    border-color: rgb(47 84 235 / 45%) !important;
  }

  :deep(.el-tag.pm-status--pending-move) {
    color: #eb2f96 !important;
    background-color: rgb(235 47 150 / 12%) !important;
    border-color: rgb(235 47 150 / 45%) !important;
  }

  :deep(.el-tag.pm-status--moved) {
    color: #52c41a !important;
    background-color: rgb(82 196 26 / 12%) !important;
    border-color: rgb(82 196 26 / 45%) !important;
  }

  :deep(.el-tag.pm-status-tag--fixed) {
    display: inline-flex;
    width: 80px;
    text-align: center;
    white-space: nowrap;
    box-sizing: border-box;
    justify-content: center;
  }

  /* 采集表：项目编号 tag 背景宽度 +15px */
  :deep(.el-tag.pm-status-tag--fixed.bmo-project-code-tag) {
    width: 95px;
  }

  .bmo-project-code-tag {
    max-width: 100%;
  }

  /* 最新采集数据表：字体加大一号（12px -> 13px） */
  :deep(.bmo-latest-table .el-table__cell .cell) {
    font-size: 14px;
  }
}

@media (width <= 900px) {
  .bmo-sync-page {
    :deep(.bmo-initiate-dialog .el-dialog__body) {
      max-height: calc(100vh - 140px);
      padding: 10px 12px;
    }

    :deep(.bmo-initiate-dialog .el-dialog__footer) {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: flex-end;
      padding-top: 10px;
    }

    :deep(.bmo-initiate-dialog .el-dialog__footer .el-button) {
      margin-left: 0;
    }

    :deep(.bmo-tech-desc .el-descriptions__label) {
      width: 96px;
      min-width: 96px;
    }

    .bmo-initiate-section,
    .bmo-initiate-subsection {
      padding: 10px;
    }
  }
}
</style>
