<template>
  <div class="quotation-page p-4 space-y-4">
    <div v-if="isMobile" class="mobile-top-bar">
      <div class="mobile-top-bar-left">
        <el-button text type="primary" @click="showMobileFilters = !showMobileFilters">
          {{ showMobileFilters ? '收起筛选' : '展开筛选' }}
        </el-button>
      </div>
      <div class="view-mode-switch">
        <span class="view-mode-switch__label">视图</span>
        <el-radio-group v-model="viewMode" size="small">
          <el-radio-button value="card">卡片</el-radio-button>
          <el-radio-button value="table">表格</el-radio-button>
        </el-radio-group>
      </div>
    </div>

    <!-- 查询表单 -->
    <el-form
      :model="queryForm"
      :inline="!isMobile"
      :label-width="isMobile ? 'auto' : '90px'"
      :label-position="isMobile ? 'top' : 'right'"
      class="query-form rounded-lg bg-[var(--el-bg-color-overlay)] p-4 shadow-sm"
      :class="{ 'query-form--mobile': isMobile }"
      v-show="!isMobile || showMobileFilters"
    >
      <el-form-item label="模糊查询">
        <el-input
          v-model="queryForm.keyword"
          placeholder="请输入报价单号 / 客户名称 / 更改通知单号 / 模具编号 / 加工零件名称"
          clearable
          :style="{ width: isMobile ? '100%' : '320px' }"
          @keyup.enter="handleSearch"
        />
      </el-form-item>
      <el-form-item label="加工日期">
        <el-date-picker
          v-model="queryForm.processingDate"
          type="date"
          placeholder="请选择加工日期"
          value-format="YYYY-MM-DD"
          :style="{ width: isMobile ? '100%' : '180px' }"
          clearable
        />
      </el-form-item>
      <el-form-item class="query-form__actions">
        <div class="query-actions">
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
          <el-button type="success" @click="handleCreate">新增报价单</el-button>
        </div>
      </el-form-item>
    </el-form>

    <!-- 报价单列表 -->
    <!-- 手机端卡片视图 -->
    <div v-if="isMobile && viewMode === 'card'" class="qt-mobile-list" v-loading="loading">
      <el-empty v-if="!quotations.length && !loading" description="暂无报价单" />
      <template v-else>
        <el-card v-for="row in pagedQuotations" :key="row.id" class="qt-mobile-card" shadow="hover">
          <div class="qt-mobile-card__header">
            <div>
              <div class="qt-mobile-card__quotation-no">
                报价单号：{{ row.quotationNo || '-' }}
              </div>
              <div class="qt-mobile-card__date">
                报价日期：{{ formatDate(row.quotationDate) || '-' }}
              </div>
              <div class="qt-mobile-card__customer">{{ row.customerName || '-' }}</div>
            </div>
          </div>
          <div class="qt-mobile-card__meta">
            <div>
              <span class="label">更改通知单号</span>
              <span class="value">{{ row.changeOrderNo || '-' }}</span>
            </div>
            <div>
              <span class="label">模具编号</span>
              <span class="value">{{ row.moldNo || '-' }}</span>
            </div>
            <div>
              <span class="label">加工零件名称</span>
              <span class="value">{{ row.partName || '-' }}</span>
            </div>
            <div>
              <span class="label">经办人</span>
              <span class="value">{{ row.operator || '-' }}</span>
            </div>
          </div>
          <div class="qt-mobile-card__stats">
            <div class="stat">
              <div class="stat-label">加工数量</div>
              <div class="stat-value">{{ row.quantity || 0 }}</div>
            </div>
            <div class="stat">
              <div class="stat-label">含税价格(元)</div>
              <div class="stat-value">{{ formatAmount(calcTaxIncludedPrice(row)) }}</div>
            </div>
          </div>
          <div class="qt-mobile-card__actions">
            <el-button type="success" size="small" @click="handleView(row)">查看</el-button>
            <el-button type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button type="danger" size="small" @click="handleDelete(row)">删除</el-button>
          </div>
        </el-card>
      </template>
    </div>

    <!-- PC端表格视图 / 手机端表格视图 -->
    <div
      v-else-if="viewMode === 'table'"
      class="qt-table-wrapper"
      :class="{ 'qt-table-wrapper--mobile': isMobile }"
    >
      <el-table
        v-if="quotations.length"
        v-loading="loading"
        :data="pagedQuotations"
        border
        :height="isMobile ? undefined : 'calc(100vh - 320px)'"
        class="qt-table"
        row-key="id"
        @row-dblclick="handleRowDblClick"
      >
        <el-table-column type="index" label="序号" width="60" align="center" />
        <el-table-column
          prop="quotationNo"
          label="报价单号"
          min-width="150"
          show-overflow-tooltip
        />
        <el-table-column prop="quotationDate" label="报价日期" width="120" show-overflow-tooltip>
          <template #default="{ row }">
            {{ formatDate(row.quotationDate) }}
          </template>
        </el-table-column>
        <el-table-column
          prop="customerName"
          label="客户名称"
          min-width="180"
          show-overflow-tooltip
        />
        <el-table-column
          prop="changeOrderNo"
          label="更改通知单号"
          min-width="140"
          show-overflow-tooltip
        />
        <el-table-column
          prop="partName"
          label="加工零件名称"
          min-width="160"
          show-overflow-tooltip
        />
        <el-table-column prop="moldNo" label="模具编号" min-width="140" show-overflow-tooltip />
        <el-table-column prop="operator" label="经办人" width="120" show-overflow-tooltip />
        <el-table-column prop="taxIncludedPrice" label="含税价格" width="120" align="right">
          <template #default="{ row }">
            {{ formatAmount(calcTaxIncludedPrice(row)) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right" align="center">
          <template #default="{ row }">
            <div class="operation-buttons">
              <el-button type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
              <el-button type="success" size="small" @click="handleView(row)">查看</el-button>
              <el-button type="danger" size="small" @click="handleDelete(row)">删除</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 分页 -->
    <div
      v-if="quotations.length"
      class="pagination-footer"
      :class="{ 'pagination-footer--mobile': isMobile || viewMode === 'card' }"
    >
      <el-pagination
        background
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :total="total"
        :layout="paginationLayout"
        :pager-count="paginationPagerCount"
        :page-sizes="[10, 20, 50]"
        @size-change="handleSizeChange"
        @current-change="handleCurrentChange"
      />
    </div>

    <!-- 空状态 -->
    <el-empty
      v-if="!quotations.length && !loading && (viewMode === 'table' || !isMobile)"
      description="暂无报价单"
      class="rounded-lg bg-[var(--el-bg-color-overlay)] py-16"
      :image-size="180"
    />

    <!-- 新增报价单：选择弹窗（报价单号 / 报价日期 / 客户名称） -->
    <el-dialog
      v-model="preCreateDialogVisible"
      title="新增报价单"
      :width="isMobile ? '100%' : '620px'"
      :fullscreen="isMobile"
      :close-on-click-modal="false"
    >
      <el-form
        ref="preCreateFormRef"
        :model="preCreateForm"
        :rules="preCreateRules"
        :label-width="isMobile ? 'auto' : '110px'"
        :label-position="isMobile ? 'top' : 'right'"
      >
        <el-form-item label="报价类型" prop="quotationType">
          <el-radio-group v-model="preCreateForm.quotationType">
            <el-radio-button value="mold">改模报价单</el-radio-button>
            <el-radio-button value="part">零件报价单</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-row :gutter="12">
          <el-col :span="isMobile ? 24 : 14">
            <el-form-item label="报价单号" prop="quotationNo">
              <el-input v-model="preCreateForm.quotationNo" disabled placeholder="自动生成" />
            </el-form-item>
          </el-col>
          <el-col :span="isMobile ? 24 : 10">
            <el-form-item label="报价日期" prop="quotationDate">
              <el-date-picker
                v-model="preCreateForm.quotationDate"
                type="date"
                value-format="YYYY-MM-DD"
                placeholder="请选择报价日期"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="客户名称" prop="customerName">
          <el-select
            v-model="preCreateForm.customerName"
            placeholder="请选择客户名称"
            filterable
            allow-create
            default-first-option
            clearable
            :loading="customerLoading"
            style="width: 100%"
          >
            <el-option
              v-for="customer in customerList"
              :key="customer.id"
              :label="customer.customerName"
              :value="customer.customerName"
            />
          </el-select>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="preCreateDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleConfirmPreCreate">确定</el-button>
      </template>
    </el-dialog>

    <!-- 报价单编辑/查看对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :width="isMobile ? '100%' : '1130px'"
      :fullscreen="isMobile"
      :class="[
        'qt-edit-dialog',
        { 'qt-edit-dialog--part': quotationForm.quotationType === 'part' }
      ]"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      :show-close="false"
    >
      <template #header>
        <div class="qt-dialog-header">
          <span class="qt-dialog-header__title"></span>
        </div>
      </template>
      <el-form
        ref="formRef"
        :model="quotationForm"
        :rules="formRules"
        label-width="0"
        class="quotation-form"
      >
        <!-- 顶部字段：报价单号、报价日期、客户名称 -->
        <div class="quotation-top-fields">
          <template v-if="quotationForm.quotationType === 'part'">
            <div class="quotation-top-part">
              <div class="quotation-top-part__row">
                <el-form-item
                  prop="customerName"
                  class="quotation-top-field quotation-top-field--inline quotation-top-part__customer"
                  :show-message="false"
                >
                  <span class="field-required">*</span>
                  <span class="field-label-inline">客户名称：</span>
                  <el-select
                    v-model="quotationForm.customerName"
                    placeholder="请选择客户名称"
                    :disabled="isViewMode || dialogMode === 'create'"
                    filterable
                    clearable
                    :loading="customerLoading"
                    class="field-input-inline field-input-customer-name"
                  >
                    <el-option
                      v-for="customer in customerList"
                      :key="customer.id"
                      :label="customer.customerName"
                      :value="customer.customerName"
                    />
                  </el-select>
                </el-form-item>
              </div>

              <div class="quotation-top-part__row quotation-top-part__row--inline-fields">
                <el-form-item
                  prop="quotationNo"
                  class="quotation-top-field quotation-top-field--inline"
                >
                  <span class="field-label-inline">报价单号：</span>
                  <el-input
                    v-model="quotationForm.quotationNo"
                    :disabled="true"
                    placeholder="报价单号"
                    class="field-input-inline field-input-quotation-no"
                  />
                </el-form-item>

                <el-form-item
                  prop="quotationDate"
                  class="quotation-top-field quotation-top-field--inline"
                  :show-message="false"
                >
                  <span class="field-label-inline">报价日期：</span>
                  <el-date-picker
                    v-model="quotationForm.quotationDate"
                    type="date"
                    value-format="YYYY-MM-DD"
                    placeholder="请选择报价日期"
                    :disabled="isViewMode"
                    clearable
                    class="field-input-inline field-input-quotation-date"
                    style="width: 140px !important"
                  />
                </el-form-item>

                <el-form-item class="quotation-top-field quotation-top-field--inline">
                  <span class="field-label-inline">联系人：</span>
                  <el-input
                    v-model="quotationForm.contactName"
                    :disabled="isViewMode"
                    placeholder="联系人"
                    class="field-input-inline field-input-contact"
                  />
                </el-form-item>

                <el-form-item class="quotation-top-field quotation-top-field--inline">
                  <span class="field-label-inline">联系电话：</span>
                  <el-input
                    v-model="quotationForm.contactPhone"
                    :disabled="isViewMode"
                    placeholder="联系电话"
                    class="field-input-inline field-input-contact"
                  />
                </el-form-item>
              </div>

              <div class="quotation-top-part__row quotation-top-part__row--inline-fields">
                <el-form-item class="quotation-top-field quotation-top-field--inline">
                  <span class="field-label-inline">经办人：</span>
                  <el-input
                    v-model="quotationForm.operator"
                    :disabled="isViewMode"
                    placeholder="经办人"
                    class="field-input-inline field-input-contact"
                  />
                </el-form-item>
              </div>
            </div>
          </template>

          <template v-else>
            <div v-if="dialogMode === 'create'" class="quotation-top-summary">
              <div class="quotation-top-summary__item">
                <span class="field-label-inline">报价单号：</span>
                <span class="field-value-inline">{{ quotationForm.quotationNo || '-' }}</span>
              </div>
              <div class="quotation-top-summary__item">
                <span class="field-label-inline">客户名称：</span>
                <span class="field-value-inline">{{ quotationForm.customerName || '-' }}</span>
              </div>
              <div class="quotation-top-summary__item">
                <span class="field-label-inline">报价日期：</span>
                <span class="field-value-inline">{{ quotationForm.quotationDate || '-' }}</span>
              </div>
            </div>

            <div v-else class="quotation-top-left">
              <el-form-item
                prop="quotationNo"
                class="quotation-top-field quotation-top-field--inline"
              >
                <span class="field-label-inline">报价单号：</span>
                <el-input
                  v-model="quotationForm.quotationNo"
                  :disabled="true"
                  placeholder="报价单号"
                  class="field-input-inline field-input-quotation-no"
                />
              </el-form-item>

              <el-form-item
                prop="customerName"
                class="quotation-top-field quotation-top-field--inline"
                :show-message="false"
              >
                <span class="field-required">*</span>
                <span class="field-label-inline">客户名称：</span>
                <el-select
                  v-model="quotationForm.customerName"
                  placeholder="请选择客户名称"
                  :disabled="isViewMode"
                  filterable
                  clearable
                  :loading="customerLoading"
                  class="field-input-inline field-input-customer-name"
                >
                  <el-option
                    v-for="customer in customerList"
                    :key="customer.id"
                    :label="customer.customerName"
                    :value="customer.customerName"
                  />
                </el-select>
              </el-form-item>
            </div>

            <el-form-item
              v-if="dialogMode !== 'create'"
              prop="quotationDate"
              class="quotation-top-field quotation-top-field--inline"
              :show-message="false"
            >
              <span class="field-label-inline">报价日期：</span>
              <el-date-picker
                v-model="quotationForm.quotationDate"
                type="date"
                value-format="YYYY-MM-DD"
                placeholder="请选择报价日期"
                :disabled="isViewMode"
                clearable
                class="field-input-inline field-input-quotation-date"
                style="width: 140px !important"
              />
            </el-form-item>
          </template>
          <!-- 操作按钮 -->
          <div class="qt-dialog-actions">
            <el-button size="small" @click="handleCancelQuotationDialog">取消</el-button>
            <el-button v-if="!isViewMode" size="small" type="primary" @click="handleSubmit">
              保存
            </el-button>
            <el-button
              v-if="!isViewMode && quotationForm.quotationType !== 'part'"
              size="small"
              type="primary"
              plain
              :loading="importingProject"
              :disabled="importingProject"
              @click="handleImportFromProject"
            >
              项目代入
            </el-button>
            <el-button
              v-if="isViewMode && quotationForm.id"
              size="small"
              type="success"
              :loading="downloading"
              :disabled="downloading"
              @click="handleDownloadQuotationPdf"
            >
              {{ downloading ? '正在生成 PDF...' : '报价单下载' }}
            </el-button>
            <el-button
              v-if="isViewMode && quotationForm.id && quotationForm.quotationType !== 'part'"
              size="small"
              type="primary"
              :loading="downloading"
              :disabled="downloading"
              @click="handleDownloadCompletionPdf"
            >
              完工单下载
            </el-button>
          </div>
        </div>

        <div v-if="quotationForm.quotationType === 'mold'" class="quotation-sheet">
          <table class="qs-table">
            <tbody>
              <!-- 加工日期 / 更改通知单号 -->
              <tr>
                <td class="qs-label" colspan="2">加工日期</td>
                <td class="qs-input qs-manual" colspan="2">
                  <el-date-picker
                    v-model="quotationForm.processingDate"
                    type="date"
                    value-format="YYYY-MM-DD"
                    placeholder="请选择加工日期"
                    :disabled="isViewMode"
                    style="width: 100%"
                  />
                </td>
                <td class="qs-label" colspan="2">更改通知单号</td>
                <td class="qs-input qs-manual">
                  <el-input
                    v-model="quotationForm.changeOrderNo"
                    :disabled="isViewMode"
                    placeholder="请输入更改通知单号"
                    maxlength="50"
                  />
                </td>
              </tr>

              <!-- 加工零件名称 / 模具编号 -->
              <tr>
                <td class="qs-label" colspan="2">加工零件名称</td>
                <td class="qs-input qs-manual" colspan="2">
                  <el-input
                    v-model="quotationForm.partName"
                    :disabled="isViewMode"
                    placeholder="请输入加工零件名称"
                  />
                </td>
                <td class="qs-label" colspan="2">模具编号</td>
                <td class="qs-input qs-manual">
                  <el-input
                    v-model="quotationForm.moldNo"
                    :disabled="isViewMode"
                    placeholder="请输入模具编号"
                  />
                </td>
              </tr>

              <!-- 申请更改部门 / 申请更改人 -->
              <tr>
                <td class="qs-label" colspan="2">申请更改部门</td>
                <td class="qs-input qs-manual" colspan="2">
                  <el-input
                    v-model="quotationForm.department"
                    :disabled="isViewMode"
                    placeholder="请输入申请更改部门"
                  />
                </td>
                <td class="qs-label" colspan="2">申请更改人</td>
                <td class="qs-input qs-manual">
                  <el-input
                    v-model="quotationForm.applicant"
                    :disabled="isViewMode"
                    placeholder="请输入申请更改人"
                  />
                </td>
              </tr>

              <!-- 单位材料费表头 -->
              <tr>
                <td class="qs-label qs-vert-header" :rowspan="quotationForm.materials.length + 1">
                  单位材料费
                </td>
                <td class="qs-label">材料名称</td>
                <td class="qs-label">单价</td>
                <td class="qs-label">用量</td>
                <td class="qs-label">费用</td>
                <td class="qs-label" colspan="2">总价</td>
              </tr>

              <!-- 单位材料费明细 -->
              <tr
                v-for="(item, index) in quotationForm.materials"
                :key="`material-${index}`"
                class="qs-row-material"
              >
                <td class="qs-input qs-manual">
                  <el-input v-model="item.name" :disabled="isViewMode" placeholder="材料名称" />
                </td>
                <td class="qs-input qs-manual qs-number">
                  <el-input-number
                    v-model="item.unitPrice"
                    :disabled="isViewMode"
                    :min="0"
                    :precision="2"
                    :controls="false"
                    placeholder="单价"
                    style="width: 100%"
                  />
                </td>
                <td class="qs-input qs-manual qs-number">
                  <el-input-number
                    v-model="item.quantity"
                    :disabled="isViewMode"
                    :min="0"
                    :precision="0"
                    :controls="false"
                    placeholder="用量"
                    style="width: 100%"
                  />
                </td>
                <td class="qs-total qs-number">
                  {{ formatAmount(item.unitPrice * item.quantity) }}
                </td>
                <td
                  v-if="index === 0"
                  class="qs-total qs-number"
                  :rowspan="quotationForm.materials.length"
                  colspan="2"
                >
                  {{ formatAmount(materialsTotal) }}
                </td>
              </tr>

              <!-- 加工费用表头 -->
              <tr>
                <td class="qs-label qs-vert-header" :rowspan="quotationForm.processes.length + 1">
                  加工费用
                </td>
                <td class="qs-label">加工形工/工种</td>
                <td class="qs-label">含税单价</td>
                <td class="qs-label">用时（H）</td>
                <td class="qs-label">合计费用</td>
                <td class="qs-label" colspan="2">总价</td>
              </tr>

              <!-- 加工费用明细 -->
              <tr
                v-for="(item, index) in quotationForm.processes"
                :key="item.key"
                class="qs-row-process"
              >
                <td>{{ item.name }}</td>
                <td>{{ item.unitPriceLabel }}</td>
                <td class="qs-input qs-manual qs-number">
                  <el-input-number
                    v-model="item.hours"
                    :disabled="isViewMode"
                    :min="0"
                    :precision="1"
                    :controls="false"
                    placeholder="用时"
                    style="width: 100%"
                  />
                </td>
                <td class="qs-total qs-number">
                  {{ formatAmount(item.unitPrice * item.hours) }}
                </td>
                <td
                  v-if="index === 0"
                  class="qs-total qs-number"
                  :rowspan="quotationForm.processes.length"
                  colspan="2"
                >
                  {{ formatAmount(processingTotal) }}
                </td>
              </tr>

              <!-- 其他费用 -->
              <tr>
                <td class="qs-label" colspan="5">其他费用（焊、合模机、试模等）</td>
                <td class="qs-label">含税</td>
                <td class="qs-input qs-manual qs-number">
                  <el-input-number
                    v-model="quotationForm.otherFee"
                    :disabled="isViewMode"
                    :min="0"
                    :precision="2"
                    :controls="false"
                    placeholder="请输入其他费用"
                    style="width: 100%"
                  />
                </td>
              </tr>

              <!-- 运输费用 -->
              <tr>
                <td class="qs-label">运输费用</td>
                <td colspan="3">单价300元/吨</td>
                <td></td>
                <td class="qs-label">合计来回运输费用</td>
                <td class="qs-input qs-manual qs-number">
                  <el-input-number
                    v-model="quotationForm.transportFee"
                    :disabled="isViewMode"
                    :min="0"
                    :precision="2"
                    :controls="false"
                    placeholder="运输费用"
                    style="width: 100%"
                  />
                </td>
              </tr>

              <!-- 含税价格 -->
              <tr>
                <td class="qs-label">加工数量</td>
                <td class="qs-input qs-manual qs-number">
                  <el-input-number
                    v-model="quotationForm.quantity"
                    :disabled="isViewMode"
                    :min="1"
                    :precision="0"
                    :controls="false"
                    style="width: 100%"
                  />
                </td>
                <td colspan="3"></td>
                <td class="qs-label">含税价格</td>
                <td class="qs-total qs-number">
                  {{ formatAmount(effectiveTaxIncludedPrice) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-else class="quotation-sheet quotation-sheet--part">
          <div class="qt-card qt-part-items-card">
            <div class="qt-part-items__toolbar">
              <div class="qt-part-items__title">产品明细</div>
              <div class="qt-part-items__toolbar-right">
                <div class="qt-part-items__image-toggle">
                  <span class="qt-part-items__image-toggle-label">图示</span>
                  <el-switch v-model="quotationForm.enableImage" :disabled="isViewMode" />
                </div>
                <el-button
                  v-if="!isViewMode"
                  size="small"
                  type="primary"
                  plain
                  @click="handleAddPartItem"
                >
                  添加行
                </el-button>
              </div>
            </div>

            <el-table
              :data="quotationForm.partItems"
              border
              :class="[
                'qt-part-items-table',
                { 'qt-part-items-table--with-image': quotationForm.enableImage }
              ]"
              row-key="lineNo"
              :row-style="getPartItemsRowStyle"
            >
              <el-table-column type="index" label="序号" width="60" align="center" />
              <el-table-column label="产品名称" min-width="140">
                <template #default="{ row }">
                  <el-input v-model="row.partName" :disabled="isViewMode" placeholder="产品名称" />
                </template>
              </el-table-column>
              <el-table-column label="产品图号" min-width="120">
                <template #default="{ row }">
                  <el-input v-model="row.drawingNo" :disabled="isViewMode" placeholder="产品图号" />
                </template>
              </el-table-column>
              <el-table-column label="材质" min-width="100">
                <template #default="{ row }">
                  <el-input v-model="row.material" :disabled="isViewMode" placeholder="材质" />
                </template>
              </el-table-column>
              <el-table-column label="加工内容" min-width="100">
                <template #default="{ row }">
                  <el-input v-model="row.process" :disabled="isViewMode" placeholder="加工内容" />
                </template>
              </el-table-column>
              <el-table-column
                v-if="quotationForm.enableImage"
                label="图示"
                width="140"
                align="center"
              >
                <template #default="{ row }">
                  <div
                    class="qt-part-image-cell"
                    :class="{ 'qt-part-image-cell--readonly': isViewMode }"
                    tabindex="0"
                    @mousedown="handleFocusPartItemImageCell"
                    @paste="(e) => handlePartItemImagePaste(e, row)"
                    @dragover="handlePartItemImageDragOver"
                    @drop="(e) => handlePartItemImageDrop(e, row)"
                  >
                    <div v-if="partImageUploading[row.lineNo]" class="qt-part-image-cell__loading">
                      上传中
                    </div>
                    <template v-else>
                      <template v-if="row.imageUrl">
                        <el-image
                          class="qt-part-image-thumb"
                          :style="{ '--img-scale': String(row.imageScale || 1) }"
                          :src="toPartItemImageDisplayUrl(row.imageUrl)"
                          :preview-src-list="[toPartItemImageDisplayUrl(row.imageUrl)]"
                          :preview-teleported="true"
                          fit="contain"
                        />
                        <div class="qt-part-image-scale">
                          <el-dropdown
                            v-if="!isViewMode"
                            trigger="click"
                            @command="(cmd) => handlePartItemImageScaleCommand(row, cmd)"
                          >
                            <span class="qt-part-image-scale-badge">
                              {{ Math.round((row.imageScale || 1) * 100) }}%
                            </span>
                            <template #dropdown>
                              <el-dropdown-menu>
                                <el-dropdown-item
                                  v-for="opt in IMAGE_SCALE_OPTIONS"
                                  :key="opt.value"
                                  :command="opt.value"
                                >
                                  {{ opt.label }}
                                </el-dropdown-item>
                              </el-dropdown-menu>
                            </template>
                          </el-dropdown>
                        </div>
                        <button
                          v-if="!isViewMode"
                          type="button"
                          class="qt-part-image-remove"
                          @click.stop="handleRemovePartItemImage(row)"
                        >
                          ×
                        </button>
                        <button
                          v-if="!isViewMode"
                          type="button"
                          class="qt-part-image-pick"
                          title="选择文件"
                          @click.stop="handlePickPartItemImage(row)"
                        >
                          ⤒
                        </button>
                      </template>
                      <template v-else>
                        <div class="qt-part-image-empty">
                          <div class="qt-part-image-empty__text">粘贴/拖拽</div>
                        </div>
                        <button
                          v-if="!isViewMode"
                          type="button"
                          class="qt-part-image-pick"
                          title="选择文件"
                          @click.stop="handlePickPartItemImage(row)"
                        >
                          ⤒
                        </button>
                      </template>
                    </template>
                  </div>
                </template>
              </el-table-column>
              <el-table-column label="数量" width="90" align="right">
                <template #default="{ row }">
                  <el-input-number
                    v-model="row.quantity"
                    :disabled="isViewMode"
                    :min="1"
                    :precision="0"
                    :controls="false"
                    style="width: 100%"
                  />
                </template>
              </el-table-column>
              <el-table-column label="单价(元)" width="90" align="right">
                <template #default="{ row }">
                  <el-input
                    :model-value="
                      row.unitPriceText !== undefined
                        ? row.unitPriceText
                        : formatMoneyText(row.unitPrice)
                    "
                    :disabled="isViewMode"
                    placeholder="-"
                    class="qt-money-input"
                    @focus="
                      () => {
                        row.unitPriceText = toPlainMoneyText(row.unitPrice)
                      }
                    "
                    @update:model-value="(v: string) => (row.unitPriceText = v)"
                    @blur="
                      () => {
                        row.unitPrice = parseMoneyText(row.unitPriceText || '')
                        row.unitPriceText = undefined
                      }
                    "
                  />
                </template>
              </el-table-column>
              <el-table-column label="金额(元)" width="105" align="right">
                <template #default="{ row }">
                  {{
                    row.quantity === undefined || row.unitPrice === undefined
                      ? '-'
                      : formatAmount((row.quantity || 0) * (row.unitPrice || 0))
                  }}
                </template>
              </el-table-column>
              <el-table-column v-if="!isViewMode" label="操作" width="80" align="center">
                <template #default="{ $index }">
                  <el-button type="danger" size="small" @click="handleRemovePartItem($index)">
                    删除
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
            <input
              v-if="quotationForm.enableImage"
              ref="partImageFileInputRef"
              class="qt-part-image-file-input"
              type="file"
              accept="image/*"
              @change="handlePartItemImageFileChange"
            />
          </div>

          <div class="qt-part-summary-row">
            <div class="qt-part-summary-row__spacer"></div>
            <div class="qt-card qt-part-summary-card">
              <div class="qt-part-summary-item">
                <div class="qt-part-summary-label">其它费用</div>
                <div class="qt-part-summary-value">
                  <template v-if="isViewMode">
                    {{ formatMoneyDisplay(quotationForm.otherFee) }}
                  </template>
                  <el-input
                    v-else
                    :model-value="
                      otherFeeText !== undefined
                        ? otherFeeText
                        : formatMoneyText(quotationForm.otherFee)
                    "
                    placeholder="-"
                    class="qt-money-input"
                    @focus="() => (otherFeeText = toPlainMoneyText(quotationForm.otherFee))"
                    @update:model-value="(v: string) => (otherFeeText = v)"
                    @blur="
                      () => {
                        quotationForm.otherFee = parseMoneyText(otherFeeText || '')
                        otherFeeText = undefined
                      }
                    "
                  />
                </div>
              </div>
              <div class="qt-part-summary-item">
                <div class="qt-part-summary-label">运输费用</div>
                <div class="qt-part-summary-value">
                  <template v-if="isViewMode">
                    {{ formatMoneyDisplay(quotationForm.transportFee) }}
                  </template>
                  <el-input
                    v-else
                    :model-value="
                      transportFeeText !== undefined
                        ? transportFeeText
                        : formatMoneyText(quotationForm.transportFee)
                    "
                    placeholder="-"
                    class="qt-money-input"
                    @focus="() => (transportFeeText = toPlainMoneyText(quotationForm.transportFee))"
                    @update:model-value="(v: string) => (transportFeeText = v)"
                    @blur="
                      () => {
                        quotationForm.transportFee = parseMoneyText(transportFeeText || '')
                        transportFeeText = undefined
                      }
                    "
                  />
                </div>
              </div>
              <div class="qt-part-summary-item qt-part-summary-item--total">
                <div class="qt-part-summary-label">含税价格</div>
                <div class="qt-part-summary-value qt-part-summary-value--total">
                  {{ hasAnyPartMoney ? formatAmount(effectiveTaxIncludedPrice) : '-' }}
                </div>
              </div>

              <div class="qt-part-summary-item qt-part-summary-item--remark">
                <div class="qt-part-summary-label">备注</div>
                <div class="qt-part-summary-value qt-part-summary-value--remark">
                  <el-input
                    v-model="quotationForm.remark"
                    :disabled="isViewMode"
                    type="textarea"
                    :rows="1"
                    placeholder="请输入备注"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </el-form>
    </el-dialog>

    <!-- 项目代入对话框 -->
    <el-dialog
      v-model="projectImportDialogVisible"
      title="按项目代入"
      width="720px"
      :close-on-click-modal="false"
    >
      <div class="project-import-dialog">
        <el-input
          v-model="projectSearchKeyword"
          placeholder="请输入项目编号 / 产品名称 / 产品图号 / 客户模号 关键字（仅在分类为“塑胶模具”的项目中查询）"
          clearable
          class="project-import-search-input"
        />
        <el-table
          v-loading="projectSearchLoading"
          :data="projectSearchResults"
          border
          height="360"
          class="project-import-table"
          @row-dblclick="handleSelectProjectForImport"
        >
          <el-table-column prop="项目编号" label="项目编号" min-width="145" />
          <el-table-column
            prop="productDrawing"
            label="产品图号"
            min-width="150"
            show-overflow-tooltip
          />
          <el-table-column
            prop="productName"
            label="产品名称"
            min-width="150"
            show-overflow-tooltip
          />
          <el-table-column prop="客户模号" label="客户模号" min-width="120" show-overflow-tooltip />
          <el-table-column label="操作" width="90" align="center">
            <template #default="{ row }">
              <el-button
                size="small"
                type="primary"
                :loading="importingProject"
                :disabled="importingProject"
                @click.stop="handleSelectProjectForImport(row)"
              >
                代入
              </el-button>
            </template>
          </el-table-column>
        </el-table>
        <div v-if="projectSearchTotal > 0" class="project-import-pagination">
          <el-pagination
            background
            layout="total, prev, pager, next"
            :current-page="projectSearchPage"
            :page-size="projectSearchPageSize"
            :total="projectSearchTotal"
            @current-change="handleProjectImportPageChange"
          />
        </div>
        <div
          v-if="!projectSearchResults.length && projectSearchKeyword && !projectSearchLoading"
          class="project-import-empty"
        >
          在分类为「塑胶模具」的项目中未找到匹配的项目编号
        </div>
        <div class="project-import-tip">
          提示：在输入框中连续输入字符即可逐步缩小项目范围，双击行或点击“代入”按钮即可填充。
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import {
  ElButton,
  ElCard,
  ElDatePicker,
  ElDialog,
  ElDropdown,
  ElDropdownItem,
  ElDropdownMenu,
  ElEmpty,
  ElForm,
  ElFormItem,
  ElImage,
  ElInput,
  ElInputNumber,
  ElMessage,
  ElMessageBox,
  ElOption,
  ElPagination,
  ElRadioGroup,
  ElRadioButton,
  ElSelect,
  ElSwitch,
  ElTable,
  ElTableColumn
} from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { computed, nextTick, onMounted, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useAppStore } from '@/store/modules/app'
import { useUserStore } from '@/store/modules/user'

const userStore = useUserStore()
import { getCustomerListApi, type CustomerInfo } from '@/api/customer'
import { getProjectGoodsApi, getProjectListApi } from '@/api/project'
import {
  generateQuotationNoApi,
  createQuotationApi,
  updateQuotationApi,
  deleteQuotationApi,
  getQuotationListApi,
  downloadQuotationPdfApi,
  downloadQuotationCompletionPdfApi,
  uploadQuotationPartItemImageApi,
  deleteQuotationTempPartItemImageApi,
  type QuotationFormData
} from '@/api/quotation'
import type { QuotationRecord } from '@/api/quotation'

interface QuotationMaterialItem {
  name: string
  unitPrice: number
  quantity: number
}

interface QuotationProcessItem {
  key: string
  name: string
  unitPriceLabel: string
  unitPrice: number
  hours: number
}

interface QuotationFormModel {
  id: number | null
  quotationNo: string
  quotationDate: string | ''
  customerName: string
  quotationType: 'mold' | 'part'
  enableImage: boolean
  processingDate: string | ''
  changeOrderNo: string
  partName: string
  moldNo: string
  department: string
  applicant: string
  contactName: string
  contactPhone: string
  operator: string
  remark: string
  deliveryTerms: string
  paymentTerms: string
  validityDays: number | undefined
  partItems: Array<{
    lineNo: number
    partName: string
    drawingNo: string
    material: string
    process: string
    imageUrl: string
    imageScale: 0.5 | 0.75 | 1 | 1.25 | 1.5 | 2
    quantity: number | undefined
    unitPrice: number | undefined
    unitPriceText?: string
  }>
  materials: QuotationMaterialItem[]
  processes: QuotationProcessItem[]
  otherFee: number | undefined
  transportFee: number | undefined
  quantity: number
}

// QuotationRecord 类型已从 API 导入

interface QueryForm {
  keyword: string
  processingDate: string | ''
}

const appStore = useAppStore()
const isMobile = computed(() => appStore.getMobile)
const showMobileFilters = ref(true)

// 视图模式：手机端默认卡片视图，PC端默认表格视图
type ViewMode = 'table' | 'card'
const viewMode = ref<ViewMode>(isMobile.value ? 'card' : 'table')

// 客户列表
const customerList = ref<CustomerInfo[]>([])
const customerLoading = ref(false)

// 查询表单
const queryForm = reactive<QueryForm>({
  keyword: '',
  processingDate: ''
})

// 报价单列表
const quotations = ref<QuotationRecord[]>([])
const loading = ref(false)
const total = ref(0)

// 分页
const pagination = reactive({
  page: 1,
  pageSize: 20
})

const paginationLayout = computed(() =>
  isMobile.value || viewMode.value === 'card'
    ? 'total, prev, pager, next'
    : 'total, sizes, prev, pager, next, jumper'
)

const paginationPagerCount = computed(() => (isMobile.value || viewMode.value === 'card' ? 5 : 7))

// 直接使用后端返回的数据（后端已实现搜索和分页）
const pagedQuotations = computed(() => quotations.value)

// 表单 & 对话框
const dialogVisible = ref(false)
const dialogTitle = ref('新增报价单')
const dialogMode = ref<'create' | 'edit' | 'view'>('create')
const isViewMode = computed(() => dialogMode.value === 'view')
const formRef = ref<FormInstance>()
const downloading = ref(false)
const importingProject = ref(false)

// 项目代入对话框 & 查询状态
const projectImportDialogVisible = ref(false)
const projectSearchKeyword = ref('')
const projectSearchLoading = ref(false)
const projectSearchResults = ref<any[]>([])
const projectSearchPage = ref(1)
const projectSearchPageSize = ref(20)
const projectSearchTotal = ref(0)
let projectSearchDebounceTimer: any = null

const createEmptyForm = (): QuotationFormModel => ({
  id: null,
  quotationNo: '',
  quotationDate: '',
  customerName: '',
  quotationType: 'mold',
  enableImage: false,
  processingDate: '',
  changeOrderNo: '',
  partName: '',
  moldNo: '',
  department: '',
  applicant: '',
  contactName: '',
  contactPhone: '',
  operator:
    (userStore.getUserInfo as any)?.realName ||
    (userStore.getUserInfo as any)?.displayName ||
    userStore.getUserInfo?.username ||
    '',
  remark: '',
  deliveryTerms: '',
  paymentTerms: '',
  validityDays: undefined,
  partItems: [],
  materials: [
    { name: '紫铜电极', unitPrice: 0, quantity: 0 },
    { name: '配件', unitPrice: 0, quantity: 0 }
  ],
  processes: [
    { key: 'nc', name: '数控', unitPriceLabel: '35元/小时', unitPrice: 35, hours: 0 },
    { key: 'fastCut', name: '快速切割', unitPriceLabel: '12元/小时', unitPrice: 12, hours: 0 },
    { key: 'middleCut', name: '中丝切割', unitPriceLabel: '30元/小时', unitPrice: 30, hours: 0 },
    { key: 'slowCut', name: '慢丝切割', unitPriceLabel: '70元/小时', unitPrice: 70, hours: 0 },
    { key: 'cnc', name: 'CNC', unitPriceLabel: '70元/小时', unitPrice: 70, hours: 0 },
    { key: 'highSpeed', name: '高速铣', unitPriceLabel: '150元/小时', unitPrice: 150, hours: 0 },
    { key: 'spark', name: '电火花', unitPriceLabel: '60元/小时', unitPrice: 60, hours: 0 },
    { key: 'gantry', name: '龙门', unitPriceLabel: '90元/小时', unitPrice: 90, hours: 0 },
    { key: 'fitter', name: '钳工', unitPriceLabel: '35元/小时', unitPrice: 35, hours: 0 },
    { key: 'polish', name: '抛光', unitPriceLabel: '40元/小时', unitPrice: 40, hours: 0 }
  ],
  otherFee: 0,
  transportFee: 0,
  quantity: 1
})

const quotationForm = reactive<QuotationFormModel>(createEmptyForm())

const otherFeeText = ref<string | undefined>(undefined)
const transportFeeText = ref<string | undefined>(undefined)
const partImageUploading = reactive<Record<number, boolean>>({})
const partImageFileInputRef = ref<HTMLInputElement>()
const partImageFileTargetRow = ref<any>(null)
const TEMP_PART_IMAGE_PREFIX = '/uploads/_temp/quotation-images/'

const isTempPartImageUrl = (url: any) => String(url || '').startsWith(TEMP_PART_IMAGE_PREFIX)

const toPartItemImageDisplayUrl = (imageUrl: any) => {
  const url = String(imageUrl || '').trim()
  if (!url) return ''
  return `/api/quotation/part-item-image?url=${encodeURIComponent(url)}`
}

const deleteTempPartImageIfNeeded = async (imageUrl: any) => {
  const url = String(imageUrl || '').trim()
  if (!isTempPartImageUrl(url)) return
  try {
    await deleteQuotationTempPartItemImageApi(url)
  } catch (e) {
    console.warn('删除临时图示失败（忽略）:', e)
  }
}

const IMAGE_SCALE_OPTIONS: Array<{ label: string; value: 0.5 | 0.75 | 1 | 1.25 | 1.5 | 2 }> = [
  { label: '50%', value: 0.5 },
  { label: '75%', value: 0.75 },
  { label: '100%', value: 1 },
  { label: '125%', value: 1.25 },
  { label: '150%', value: 1.5 },
  { label: '200%', value: 2 }
]

const normalizeImageScale = (value: any): 0.5 | 0.75 | 1 | 1.25 | 1.5 | 2 => {
  if (value === 0.5 || value === '0.5' || value === '50%') return 0.5
  if (value === 0.75 || value === '0.75' || value === '75%') return 0.75
  if (value === 1.25 || value === '1.25' || value === '125%') return 1.25
  if (value === 1.5 || value === '1.5' || value === '150%') return 1.5
  if (value === 2 || value === '2' || value === '200%') return 2
  return 1
}

const getPartItemsRowStyle = () => (quotationForm.enableImage ? { height: '80px' } : {})

const uploadPartItemImage = async (file: File, row: any) => {
  if (!file) return
  if (isViewMode.value) return
  if (!quotationForm.quotationNo) {
    ElMessage.warning('请先生成/填写报价单号后再上传图示')
    return
  }

  const lineNo = Number(row?.lineNo || 0)
  if (lineNo) partImageUploading[lineNo] = true

  try {
    if (row?.imageUrl) {
      await deleteTempPartImageIfNeeded(row.imageUrl)
    }
    const resp: any = await uploadQuotationPartItemImageApi(String(quotationForm.quotationNo), file)
    const pr: any = resp
    const url = pr?.data?.url || pr?.data?.data?.url || ''
    if (!url) {
      ElMessage.error(pr?.message || '上传失败')
      return
    }
    row.imageUrl = url
    row.imageScale = normalizeImageScale(row.imageScale)
  } catch (error) {
    console.error('上传图示失败:', error)
    ElMessage.error('上传图示失败')
  } finally {
    if (lineNo) partImageUploading[lineNo] = false
  }
}

const handlePickPartItemImage = (row: any) => {
  if (isViewMode.value) return
  partImageFileTargetRow.value = row
  partImageFileInputRef.value?.click()
}

const handleFocusPartItemImageCell = (e: MouseEvent) => {
  const el = e.currentTarget as HTMLElement | null
  el?.focus?.()
}

const handlePartItemImageFileChange = async (e: Event) => {
  const input = e.target as HTMLInputElement | null
  const file = input?.files?.[0]
  const row = partImageFileTargetRow.value
  partImageFileTargetRow.value = null
  if (input) input.value = ''
  if (!file || !row) return
  await uploadPartItemImage(file, row)
}

const handlePartItemImagePaste = async (e: ClipboardEvent, row: any) => {
  if (isViewMode.value) return
  const items = e.clipboardData?.items ? Array.from(e.clipboardData.items) : []
  const imageItem = items.find((it) => String(it.type || '').startsWith('image/'))
  if (!imageItem) return
  const file = imageItem.getAsFile()
  if (!file) return
  e.preventDefault()
  await uploadPartItemImage(file, row)
}

const handlePartItemImageDragOver = (e: DragEvent) => {
  if (isViewMode.value) return
  e.preventDefault()
}

const handlePartItemImageDrop = async (e: DragEvent, row: any) => {
  if (isViewMode.value) return
  e.preventDefault()
  const file = e.dataTransfer?.files?.[0]
  if (!file) return
  if (!String(file.type || '').startsWith('image/')) {
    ElMessage.warning('仅支持拖拽图片文件')
    return
  }
  await uploadPartItemImage(file, row)
}

const handlePartItemImageScaleCommand = (row: any, cmd: any) => {
  if (isViewMode.value) return
  row.imageScale = normalizeImageScale(cmd)
}

const handleRemovePartItemImage = (row: any) => {
  if (isViewMode.value) return
  void deleteTempPartImageIfNeeded(row?.imageUrl)
  row.imageUrl = ''
}

const cleanupTempPartImagesInForm = async () => {
  if (quotationForm.quotationType !== 'part') return
  const urls = (quotationForm.partItems || []).map((x: any) => String(x?.imageUrl || '').trim())
  const uniq = Array.from(new Set(urls.filter((u) => isTempPartImageUrl(u))))
  if (!uniq.length) return
  await Promise.allSettled(uniq.map((u) => deleteTempPartImageIfNeeded(u)))
}

const handleCancelQuotationDialog = async () => {
  if (isViewMode.value) {
    dialogVisible.value = false
    return
  }
  await cleanupTempPartImagesInForm()
  dialogVisible.value = false
}

// 新增报价单：先选择 报价单号/报价日期/客户名称
const preCreateDialogVisible = ref(false)
const preCreateFormRef = ref<FormInstance>()
const preCreateForm = reactive({
  quotationType: 'mold' as 'mold' | 'part',
  quotationNo: '',
  quotationDate: '',
  customerName: ''
})

const preCreateRules: FormRules = {
  quotationType: [{ required: true, message: '请选择报价类型', trigger: 'change' }],
  quotationNo: [{ required: true, message: '报价单号不能为空', trigger: 'blur' }],
  quotationDate: [{ required: true, message: '请选择报价日期', trigger: 'change' }],
  customerName: [{ required: true, message: '请选择客户名称', trigger: 'change' }]
}

const formRules: FormRules = {
  // 报价日期、客户名称 为必填（其余字段按报价类型在提交时做额外校验）
  quotationDate: [{ required: true, message: '请选择报价日期', trigger: 'change' }],
  customerName: [{ required: true, message: '请选择客户名称', trigger: 'change' }]
}

// 金额计算
const materialsTotal = computed(() =>
  quotationForm.materials.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
)

const processingTotal = computed(() =>
  quotationForm.processes.reduce((sum, item) => sum + item.unitPrice * item.hours, 0)
)

const taxIncludedPrice = computed(() => {
  const otherFee = Number(quotationForm.otherFee || 0)
  const transportFee = Number(quotationForm.transportFee || 0)
  return materialsTotal.value + processingTotal.value + otherFee + transportFee
})

const partItemsTotal = computed(() =>
  quotationForm.partItems.reduce(
    (sum, item) => sum + (Number(item.unitPrice) || 0) * (Number(item.quantity) || 0),
    0
  )
)

const effectiveTaxIncludedPrice = computed(() => {
  if (quotationForm.quotationType === 'part') {
    const otherFee = Number(quotationForm.otherFee || 0)
    const transportFee = Number(quotationForm.transportFee || 0)
    return partItemsTotal.value + otherFee + transportFee
  }
  return taxIncludedPrice.value
})

const calcMaterialsTotal = (row: QuotationRecord) =>
  (row.materials || []).reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)

const calcProcessingTotal = (row: QuotationRecord) =>
  (row.processes || []).reduce((sum, item) => sum + item.unitPrice * item.hours, 0)

const calcTaxIncludedPrice = (row: QuotationRecord) => {
  if (row.quotationType === 'part') {
    const partTotal = (row.partItems || []).reduce(
      (sum, item) => sum + (item.unitPrice || 0) * (item.quantity || 0),
      0
    )
    return partTotal + (row.otherFee || 0) + (row.transportFee || 0)
  }
  return (
    calcMaterialsTotal(row) +
    calcProcessingTotal(row) +
    (row.otherFee || 0) +
    (row.transportFee || 0)
  )
}

const formatAmount = (value: number | null | undefined) => {
  if (value === null || value === undefined) return '-'
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return '-'
  return numericValue.toLocaleString('zh-CN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })
}

const formatMoneyDisplay = (value: number | null | undefined) => {
  if (value === null || value === undefined) return '-'
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return '-'
  return numericValue.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

const formatMoneyText = (value: number | null | undefined) => {
  if (value === null || value === undefined) return ''
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return ''
  return numericValue.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

const toPlainMoneyText = (value: number | null | undefined) => {
  if (value === null || value === undefined) return ''
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return ''
  return String(numericValue)
}

const parseMoneyText = (text: string) => {
  const normalized = String(text || '')
    .trim()
    .replace(/,/g, '')
  if (!normalized) return undefined
  const numericValue = Number(normalized)
  return Number.isFinite(numericValue) ? numericValue : undefined
}

const hasAnyPartMoney = computed(() => {
  if (quotationForm.quotationType !== 'part') return false
  const hasLineAmount = quotationForm.partItems.some(
    (item) => Number(item.quantity) > 0 && Number(item.unitPrice) > 0
  )
  const hasFees = Number(quotationForm.otherFee) > 0 || Number(quotationForm.transportFee) > 0
  return hasLineAmount || hasFees
})

// 格式化日期：YYYY-MM-DD
const formatDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return '-'
  // 如果已经是 YYYY-MM-DD 格式，直接返回
  if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr
  }
  // 如果是日期对象或其他格式，尝试转换
  try {
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return '-'
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  } catch {
    return dateStr || '-'
  }
}

// 获取客户列表
const fetchCustomerList = async () => {
  try {
    customerLoading.value = true
    const response = await getCustomerListApi({
      status: 'active',
      page: 1,
      pageSize: 10000
    })

    if (response && response.data && response.data.list) {
      customerList.value = response.data.list
    } else {
      ElMessage.error('获取客户列表失败')
    }
  } catch (error) {
    console.error('获取客户列表失败:', error)
    ElMessage.error('获取客户列表失败')
  } finally {
    customerLoading.value = false
  }
}

// 加载报价单列表
const loadQuotations = async () => {
  try {
    loading.value = true
    const response = await getQuotationListApi({
      keyword: queryForm.keyword,
      processingDate: queryForm.processingDate,
      page: pagination.page,
      pageSize: pagination.pageSize
    })

    const pr: any = response
    if (pr?.code === 0 || pr?.success === true) {
      quotations.value = pr.data?.list || []
      total.value = pr.data?.total || 0
    } else {
      ElMessage.error(pr?.message || '获取报价单列表失败')
    }
  } catch (error: any) {
    console.error('加载报价单列表失败:', error)
    ElMessage.error('加载报价单列表失败')
  } finally {
    loading.value = false
  }
}

// 查询
const handleSearch = () => {
  pagination.page = 1
  loadQuotations()
}

const handleReset = () => {
  queryForm.keyword = ''
  queryForm.processingDate = ''
  pagination.page = 1
  loadQuotations()
}

// 新增
const handleCreate = async () => {
  try {
    dialogMode.value = 'create'
    dialogTitle.value = '新增报价单'
    Object.assign(quotationForm, createEmptyForm())

    // 生成新的报价单编号
    const response = await generateQuotationNoApi()
    const raw: any = response
    const pr: any = raw?.data ?? raw
    const newQuotationNo = pr?.quotationNo || ''

    if (!newQuotationNo) {
      ElMessage.error('生成报价单号失败')
      return
    }

    await fetchCustomerList()

    // 先打开选择弹窗：报价单号 / 报价日期 / 客户名称
    preCreateForm.quotationType = 'mold'
    preCreateForm.quotationNo = newQuotationNo
    preCreateForm.customerName = ''
    const today = new Date()
    preCreateForm.quotationDate = today.toISOString().split('T')[0]
    preCreateDialogVisible.value = true
    await nextTick()
    preCreateFormRef.value?.clearValidate?.()
  } catch (error) {
    console.error('打开新建对话框失败:', error)
    ElMessage.error('打开新建对话框失败')
  }
}

const handleConfirmPreCreate = async () => {
  if (!preCreateFormRef.value) return
  try {
    await preCreateFormRef.value.validate()
  } catch {
    return
  }

  const typedCustomerName = (preCreateForm.customerName || '').trim()
  const isKnownCustomer =
    !typedCustomerName ||
    customerList.value.some((c) => (c.customerName || '').trim() === typedCustomerName)
  if (!isKnownCustomer) {
    try {
      await ElMessageBox.confirm(`客户【${typedCustomerName}】不在客户档案中，是否继续？`, '提示', {
        confirmButtonText: '继续',
        cancelButtonText: '取消',
        type: 'warning'
      })
    } catch {
      return
    }
  }

  quotationForm.quotationNo = preCreateForm.quotationNo
  quotationForm.quotationDate = preCreateForm.quotationDate
  quotationForm.customerName = typedCustomerName
  quotationForm.quotationType = preCreateForm.quotationType === 'part' ? 'part' : 'mold'
  quotationForm.enableImage = quotationForm.quotationType === 'part'

  preCreateDialogVisible.value = false
  dialogVisible.value = true

  if (quotationForm.quotationType === 'part' && quotationForm.partItems.length === 0) {
    quotationForm.otherFee = undefined
    quotationForm.transportFee = undefined
    otherFeeText.value = undefined
    transportFeeText.value = undefined
    handleAddPartItem()
  }
}

// 编辑
const handleEdit = async (row: QuotationRecord) => {
  dialogMode.value = 'edit'
  dialogTitle.value = '编辑报价单'
  const normalizedType = row.quotationType === 'part' ? 'part' : 'mold'
  const rawEnableImage = (row as any).enableImage
  const effectiveEnableImage =
    normalizedType === 'part'
      ? rawEnableImage === undefined
        ? true
        : Boolean(Number(rawEnableImage))
      : false
  Object.assign(quotationForm, {
    ...row,
    quotationType: normalizedType,
    enableImage: effectiveEnableImage,
    processingDate: row.processingDate || '',
    changeOrderNo: row.changeOrderNo || '',
    partName: row.partName || '',
    moldNo: row.moldNo || '',
    department: row.department || '',
    applicant: row.applicant || '',
    contactName: (row as any).contactName || '',
    contactPhone: (row as any).contactPhone || '',
    operator: (row as any).operator || '',
    remark: (row as any).remark || '',
    deliveryTerms: (row as any).deliveryTerms || '',
    paymentTerms: (row as any).paymentTerms || '',
    validityDays: (row as any).validityDays ?? undefined,
    partItems: (row.partItems || []).map((p, idx) => ({
      lineNo: idx + 1,
      partName: p.partName || '',
      drawingNo: p.drawingNo || '',
      material: p.material || '',
      process: (p as any).process || '',
      imageUrl: (p as any).imageUrl || '',
      imageScale: normalizeImageScale((p as any).imageScale),
      quantity: p.quantity === null || p.quantity === undefined ? undefined : Number(p.quantity),
      unitPrice: p.unitPrice === null || p.unitPrice === undefined ? undefined : Number(p.unitPrice)
    })),
    materials: (row.materials || []).map((m) => ({ ...m })),
    processes: (row.processes || []).map((p) => ({ ...p }))
  })
  await fetchCustomerList()
  dialogVisible.value = true
}

// 查看
const handleView = async (row: QuotationRecord) => {
  dialogMode.value = 'view'
  dialogTitle.value = '查看报价单'
  const normalizedType = row.quotationType === 'part' ? 'part' : 'mold'
  const rawEnableImage = (row as any).enableImage
  const effectiveEnableImage =
    normalizedType === 'part'
      ? rawEnableImage === undefined
        ? true
        : Boolean(Number(rawEnableImage))
      : false
  Object.assign(quotationForm, {
    ...row,
    quotationType: normalizedType,
    enableImage: effectiveEnableImage,
    processingDate: row.processingDate || '',
    changeOrderNo: row.changeOrderNo || '',
    partName: row.partName || '',
    moldNo: row.moldNo || '',
    department: row.department || '',
    applicant: row.applicant || '',
    contactName: (row as any).contactName || '',
    contactPhone: (row as any).contactPhone || '',
    operator: (row as any).operator || '',
    remark: (row as any).remark || '',
    deliveryTerms: (row as any).deliveryTerms || '',
    paymentTerms: (row as any).paymentTerms || '',
    validityDays: (row as any).validityDays ?? undefined,
    partItems: (row.partItems || []).map((p, idx) => ({
      lineNo: idx + 1,
      partName: p.partName || '',
      drawingNo: p.drawingNo || '',
      material: p.material || '',
      process: (p as any).process || '',
      imageUrl: (p as any).imageUrl || '',
      imageScale: normalizeImageScale((p as any).imageScale),
      quantity: p.quantity === null || p.quantity === undefined ? undefined : Number(p.quantity),
      unitPrice: p.unitPrice === null || p.unitPrice === undefined ? undefined : Number(p.unitPrice)
    })),
    materials: (row.materials || []).map((m) => ({ ...m })),
    processes: (row.processes || []).map((p) => ({ ...p }))
  })
  await fetchCustomerList()
  dialogVisible.value = true
}

// 下载当前报价单的 报价 PDF 文件
const handleDownloadQuotationPdf = async () => {
  if (!quotationForm.id) {
    ElMessage.warning('请先保存报价单后再下载')
    return
  }

  try {
    downloading.value = true
    ElMessage.info('正在生成报价单 PDF，请稍候...')

    const resp = await downloadQuotationPdfApi(quotationForm.id)
    const blob = (resp as any)?.data ?? resp
    const url = window.URL.createObjectURL(blob as Blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${quotationForm.quotationNo || '报价单'}报价.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  } catch (error) {
    console.error('下载报价单 PDF 失败:', error)
    ElMessage.error('下载报价单失败')
  } finally {
    downloading.value = false
  }
}

// 下载当前报价单的 完工单 PDF 文件
const handleDownloadCompletionPdf = async () => {
  if (!quotationForm.id) {
    ElMessage.warning('请先保存报价单后再下载')
    return
  }

  if (quotationForm.quotationType === 'part') {
    ElMessage.warning('零件报价单不支持完工单下载')
    return
  }

  const missingFields: string[] = []
  if (!quotationForm.processingDate) missingFields.push('加工日期')
  if (!quotationForm.partName || !quotationForm.partName.trim()) missingFields.push('加工零件名称')
  // 模具编号、申请更改部门改为非必填

  if (missingFields.length > 0) {
    ElMessage.error(`完工单下载前请先填写：${missingFields.join('、')}`)
    return
  }

  try {
    downloading.value = true
    ElMessage.info('正在生成完工单 PDF，请稍候...')

    const resp = await downloadQuotationCompletionPdfApi(quotationForm.id)
    const blob = (resp as any)?.data ?? resp
    const url = window.URL.createObjectURL(blob as Blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${quotationForm.quotationNo || '报价单'}完工单.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  } catch (error) {
    console.error('下载完工单 PDF 失败:', error)
    ElMessage.error('下载完工单失败')
  } finally {
    downloading.value = false
  }
}

const handleAddPartItem = () => {
  const nextLineNo =
    quotationForm.partItems.length > 0
      ? Math.max(...quotationForm.partItems.map((i) => i.lineNo || 0)) + 1
      : 1
  quotationForm.partItems.push({
    lineNo: nextLineNo,
    partName: '',
    drawingNo: '',
    material: '',
    process: '',
    imageUrl: '',
    imageScale: 1,
    quantity: undefined,
    unitPrice: undefined
  })
}

const handleRemovePartItem = (index: number) => {
  quotationForm.partItems.splice(index, 1)
  quotationForm.partItems = quotationForm.partItems.map((item, idx) => ({
    ...item,
    lineNo: idx + 1,
    unitPriceText: undefined
  }))
  Object.keys(partImageUploading).forEach((key) => {
    delete partImageUploading[Number(key)]
  })
}

// 项目代入对话框分页
const handleProjectImportPageChange = (page: number) => {
  projectSearchPage.value = page
  searchProjectsForImport()
}

// 查询项目列表（仅分类为「塑胶模具」，在货物信息表中按 项目编号 / 产品名称 / 产品图号 模糊查询）
const searchProjectsForImport = async () => {
  const keyword = projectSearchKeyword.value.trim()

  if (!keyword) {
    projectSearchResults.value = []
    projectSearchTotal.value = 0
    return
  }

  projectSearchLoading.value = true
  try {
    const listParams: any = {
      keyword,
      category: '塑胶模具',
      page: projectSearchPage.value,
      pageSize: projectSearchPageSize.value
    }

    const listResponse: any = await getProjectListApi(listParams)

    let projectList: any[] = []
    let total = 0

    if (listResponse?.data?.data) {
      const payload = listResponse.data.data
      projectList = payload.list || []
      total = payload.total || 0
      if (typeof payload.page === 'number') {
        projectSearchPage.value = payload.page
      }
      if (typeof payload.pageSize === 'number') {
        projectSearchPageSize.value = payload.pageSize
      }
    } else if (listResponse?.data?.list) {
      projectList = listResponse.data.list || []
      total = listResponse.data.total || projectList.length || 0
    } else if (Array.isArray(listResponse?.list)) {
      projectList = listResponse.list
      total = projectList.length
    }

    projectSearchResults.value = projectList || []
    projectSearchTotal.value = total
  } catch (error) {
    console.error('按项目代入查询失败:', error)
    ElMessage.error('按项目代入查询失败')
    projectSearchResults.value = []
    projectSearchTotal.value = 0
  } finally {
    projectSearchLoading.value = false
  }
}

// 根据项目编号代入项目信息（产品图号 → 加工零件名称，客户模号 → 模具编号）
const handleImportFromProject = async () => {
  projectSearchKeyword.value = ''
  projectSearchResults.value = []
  projectSearchPage.value = 1
  projectSearchTotal.value = 0
  projectImportDialogVisible.value = true
}

// 选中某个项目后代入到表单
const handleSelectProjectForImport = async (row: any) => {
  const projectCode = row?.项目编号 || row?.projectCode || ''
  if (!projectCode) {
    ElMessage.error('无法获取项目编号')
    return
  }

  try {
    importingProject.value = true

    const response: any = await getProjectGoodsApi(projectCode)

    let data: any = null
    if (response?.data?.data) {
      data = response.data.data
    } else if (response?.data) {
      data = response.data
    } else {
      data = response
    }

    if (!data) {
      ElMessage.warning('未找到对应的项目信息，请检查项目编号')
      return
    }

    const productDrawing: string = data.productDrawing || ''
    const productName: string = data.productName || ''
    const customerModelNo: string = data.customerModelNo || ''

    if (!productDrawing && !productName && !customerModelNo) {
      ElMessage.warning('该项目没有可用的“产品图号 / 产品名称 / 客户模号”信息')
      return
    }

    const partNameValue = [productDrawing, productName].filter((v) => v && v.trim()).join(' ')

    // 直接覆盖当前表单中的值
    quotationForm.partName = partNameValue
    quotationForm.moldNo = customerModelNo

    ElMessage.success('已根据项目编号代入：加工零件名称、模具编号')
    projectImportDialogVisible.value = false
  } catch (error) {
    console.error('按项目代入失败:', error)
    ElMessage.error('按项目代入失败')
  } finally {
    importingProject.value = false
  }
}

// 删除
const handleDelete = async (row: QuotationRecord) => {
  try {
    const message = `确定要删除报价单【${row.quotationNo}】吗？\n请输入 Y 确认删除：`
    const { value } = await ElMessageBox.prompt(message, '警告', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
      inputPattern: /^[Yy]$/,
      inputErrorMessage: '请输入 Y 确认删除'
    })

    if (value === 'Y' || value === 'y') {
      const resp = await deleteQuotationApi(row.id)
      const pr: any = resp

      if (pr?.code === 0 || pr?.success === true) {
        ElMessage.success(pr?.message || '删除成功')
        // 重新加载列表，确保与服务器数据一致
        await loadQuotations()
      } else {
        console.error('删除报价单失败，响应数据:', pr)
        ElMessage.error(pr?.message || '删除失败')
      }
    }
  } catch {
    // 用户取消或输入错误
  }
}

// 行双击查看
const handleRowDblClick = (row: QuotationRecord) => {
  handleView(row)
}

// 保存
const handleSubmit = async () => {
  if (!formRef.value) return

  try {
    // 客户名称必填：给出明确提示
    if (!quotationForm.customerName || !quotationForm.customerName.trim()) {
      ElMessage.error('请输入客户名称')
      return
    }

    await formRef.value.validate()

    if (quotationForm.quotationType === 'mold') {
      if (!quotationForm.partName || !quotationForm.partName.trim()) {
        ElMessage.error('请输入加工零件名称')
        return
      }
      // 模具编号、申请更改部门改为非必填
    } else {
      const cleanedPartItems = quotationForm.partItems
        .map((item) => ({
          partName: (item.partName || '').trim(),
          drawingNo: (item.drawingNo || '').trim(),
          material: (item.material || '').trim(),
          process: (item.process || '').trim(),
          imageUrl: (item.imageUrl || '').trim(),
          imageScale:
            item.imageScale === 0.5 || item.imageScale === 0.75 || item.imageScale === 1
              ? item.imageScale
              : 1,
          quantity:
            item.quantity === null || item.quantity === undefined
              ? undefined
              : Number(item.quantity),
          unitPrice: Number(item.unitPrice || 0)
        }))
        .filter((item) => {
          const hasText =
            !!item.partName ||
            !!item.drawingNo ||
            !!item.material ||
            !!item.process ||
            !!item.imageUrl
          const hasNumber = Number(item.quantity) > 0 || item.unitPrice > 0
          return hasText || hasNumber
        })

      if (cleanedPartItems.length === 0) {
        ElMessage.error('请至少填写一行零件明细')
        return
      }

      for (let i = 0; i < cleanedPartItems.length; i += 1) {
        const item = cleanedPartItems[i]
        const rowLabel = `第 ${i + 1} 行`

        if (!item.partName) {
          ElMessage.error(`${rowLabel}：产品名称不能为空`)
          return
        }
        if (!Number.isInteger(Number(item.quantity)) || Number(item.quantity) <= 0) {
          ElMessage.error(`${rowLabel}：数量必须为大于 0 的整数`)
          return
        }
        if (!Number.isFinite(item.unitPrice) || item.unitPrice <= 0) {
          ElMessage.error(`${rowLabel}：单价必须大于 0`)
          return
        }
      }

      quotationForm.partItems = cleanedPartItems.map((item, idx) => ({
        lineNo: idx + 1,
        ...item
      }))
    }

    const payload: QuotationFormData = {
      quotationNo: quotationForm.quotationNo?.trim() || '',
      quotationDate: quotationForm.quotationDate || '',
      customerName: quotationForm.customerName?.trim() || '',
      quotationType: quotationForm.quotationType,
      enableImage: quotationForm.quotationType === 'part' ? quotationForm.enableImage : false,
      processingDate: quotationForm.processingDate || '',
      changeOrderNo: quotationForm.changeOrderNo?.trim() || '',
      partName: quotationForm.partName?.trim() || '',
      moldNo: quotationForm.moldNo?.trim() || '',
      department: quotationForm.department?.trim() || '',
      applicant: quotationForm.applicant?.trim() || '',
      contactName: quotationForm.contactName?.trim() || '',
      contactPhone: quotationForm.contactPhone?.trim() || '',
      operator: quotationForm.operator?.trim() || '',
      remark: quotationForm.remark?.trim() || '',
      deliveryTerms: '',
      paymentTerms: '',
      validityDays: null,
      materials:
        quotationForm.quotationType === 'part'
          ? []
          : quotationForm.materials.map((m) => ({ ...m })),
      processes:
        quotationForm.quotationType === 'part'
          ? []
          : quotationForm.processes.map((p) => ({ ...p })),
      partItems:
        quotationForm.quotationType === 'part'
          ? quotationForm.partItems.map((item) => ({
              partName: item.partName,
              drawingNo: item.drawingNo,
              material: item.material,
              process: item.process,
              imageUrl: item.imageUrl,
              imageScale: normalizeImageScale(item.imageScale),
              quantity: Number(item.quantity),
              unitPrice: Number(item.unitPrice)
            }))
          : [],
      otherFee: quotationForm.otherFee || 0,
      transportFee: quotationForm.transportFee || 0,
      quantity: quotationForm.quantity || 1
    }

    console.log('准备保存报价单，数据:', JSON.stringify(payload, null, 2))

    if (dialogMode.value === 'create' || quotationForm.id == null) {
      // 创建新报价单
      const response = await createQuotationApi(payload)
      console.log('创建报价单响应:', response)

      // 响应拦截器已经返回了 response.data，所以 response 就是 { code, success, data, message }
      const pr: any = response
      console.log('处理后的响应数据:', pr)

      // 检查响应：code === 0 或 success === true 都表示成功
      if ((pr?.code === 0 || pr?.success === true) && pr?.data?.id) {
        ElMessage.success('新增报价单成功')
        dialogVisible.value = false
        // 重新加载列表
        await loadQuotations()
      } else {
        console.error('创建失败，响应数据:', pr)
        ElMessage.error(pr?.message || '新增报价单失败')
      }
    } else {
      // 更新报价单
      const response = await updateQuotationApi(quotationForm.id, payload)
      console.log('更新报价单响应:', response)

      // 响应拦截器已经返回了 response.data，所以 response 就是 { code, success, message }
      const pr: any = response
      console.log('处理后的响应数据:', pr)

      // 检查响应：code === 0 或 success === true 都表示成功
      if (pr?.code === 0 || pr?.success === true) {
        ElMessage.success('编辑报价单成功')
        dialogVisible.value = false
        // 重新加载列表
        await loadQuotations()
      } else {
        console.error('更新失败，响应数据:', pr)
        ElMessage.error(pr?.message || '编辑报价单失败')
      }
    }
  } catch (error: any) {
    console.error('保存报价单失败:', error)
    console.error('错误响应数据:', error?.response?.data)
    if (error?.response?.data?.message) {
      ElMessage.error(error.response.data.message)
    } else if (error?.message) {
      ElMessage.error(error.message)
    } else {
      ElMessage.error('保存报价单失败')
    }
  }
}

// 分页
const handleSizeChange = (size: number) => {
  pagination.pageSize = size
  pagination.page = 1
  loadQuotations()
}

const handleCurrentChange = (page: number) => {
  pagination.page = page
  loadQuotations()
}

// 监听移动端状态变化，自动切换视图模式
watch(isMobile, (mobile) => {
  if (mobile) {
    viewMode.value = 'card'
  } else {
    viewMode.value = 'table'
  }
})

// 监听项目编号关键字，输入后自动触发（防抖）查询，仅在分类为「塑胶模具」的项目中模糊搜索
watch(
  projectSearchKeyword,
  (val) => {
    if (projectSearchDebounceTimer) {
      clearTimeout(projectSearchDebounceTimer)
      projectSearchDebounceTimer = null
    }

    const keyword = (val || '').trim()
    if (!keyword) {
      projectSearchResults.value = []
      return
    }

    projectSearchDebounceTimer = setTimeout(() => {
      searchProjectsForImport()
    }, 300)
  },
  { flush: 'post' }
)

// ESC 键处理：当弹窗打开时，按 ESC 键相当于按取消按钮
const handleEscKey = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && dialogVisible.value) {
    event.preventDefault()
    event.stopPropagation()
    handleCancelQuotationDialog()
  }
}

// 监听弹窗打开/关闭，添加/移除 ESC 键监听器
watch(
  dialogVisible,
  (isOpen) => {
    if (isOpen) {
      // 弹窗打开时，添加 ESC 键监听器
      document.addEventListener('keydown', handleEscKey)
    } else {
      // 弹窗关闭时，移除 ESC 键监听器
      document.removeEventListener('keydown', handleEscKey)
    }
  },
  { immediate: true }
)

// 组件卸载时移除监听器
onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleEscKey)
})

// 页面加载时获取数据
onMounted(() => {
  loadQuotations()
  fetchCustomerList()
})
</script>

<style scoped>
@media (width <= 768px) {
  :deep(.qt-edit-dialog--part .el-dialog) {
    height: 100% !important;
    max-height: 100% !important;
  }

  :deep(.qt-edit-dialog) {
    width: 100% !important;
    max-width: 100% !important;
    margin: 0 !important;
  }

  :deep(.qt-edit-dialog .el-dialog__body) {
    padding: 2px 8px 8px;
    overflow: auto;
    -webkit-overflow-scrolling: touch;
  }

  :deep(.qt-edit-dialog .el-dialog__header),
  :deep(.qt-edit-dialog .el-dialog__footer) {
    padding-inline: 8px;
  }

  /* 手机端表格容器可滚动 */
  .quotation-sheet {
    width: 100%;
    overflow: auto;
    -webkit-overflow-scrolling: touch;
  }

  /* 确保表格可以横向滚动 */
  .qs-table {
    min-width: 800px;
  }
}

@media (width <= 768px) {
  .quotation-top-fields {
    flex-direction: column;
    gap: 12px;
  }

  .quotation-top-field--inline {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }

  .field-input-inline {
    width: 100% !important;
  }

  .query-form__actions {
    margin-top: 8px;
  }
}

@media (width <= 768px) {
  .qt-mobile-card__meta {
    grid-template-columns: repeat(1, minmax(0, 1fr));
  }
}

.quotation-page {
  position: relative;
}

.mobile-top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-top: 2px;
}

.mobile-top-bar-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.view-mode-switch {
  display: flex;
  align-items: center;
  gap: 8px;
}

.view-mode-switch__label {
  font-size: 13px;
  color: #606266;
}

.query-form {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}

:deep(.query-form .el-form-item) {
  margin-bottom: 0;
}

.query-form--mobile {
  padding: 12px;
}

:deep(.query-form--mobile .el-form-item) {
  width: 100%;
  margin-right: 0;
  margin-bottom: 8px;
}

:deep(.query-form--mobile .el-form-item .el-form-item__content) {
  width: 100%;
}

.query-form__actions {
  display: flex;
  margin-right: 12px;
  margin-bottom: 0;
  margin-left: auto;
  justify-content: flex-end;
  align-items: center;
}

.query-actions {
  display: flex;
  flex-wrap: nowrap;
  gap: 8px;
  justify-content: flex-end;
}

:deep(.query-form .el-form-item:not(.query-form__actions)) {
  margin-right: 18px;
  margin-bottom: 0;
}

.qt-table-wrapper {
  background: var(--el-bg-color);
  border-radius: 8px;
}

.qt-table-wrapper--mobile {
  padding-bottom: 8px;
  overflow-x: auto;
}

.qt-table-wrapper--mobile .qt-table {
  min-width: 960px;
}

/* 手机端卡片视图样式 */
.qt-mobile-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.qt-mobile-card {
  border-radius: 10px;
}

.qt-mobile-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}

.qt-mobile-card__quotation-no {
  font-size: 14px;
  font-weight: 600;
}

.qt-mobile-card__date {
  margin-top: 2px;
  font-size: 13px;
  color: #666;
}

.qt-mobile-card__customer {
  font-size: 13px;
  color: #666;
}

.qt-mobile-card__meta {
  display: grid;
  margin-top: 8px;
  font-size: 13px;
  color: #555;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px 12px;
}

.qt-mobile-card__meta .label {
  margin-right: 4px;
  color: #888;
}

.qt-mobile-card__stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin: 8px 0;
}

.qt-mobile-card__stats .stat {
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

.qt-mobile-card__actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 12px;
}

.operation-buttons {
  display: flex;
  gap: 4px;
  justify-content: center;
}

.pagination-footer {
  position: fixed;
  bottom: 10px;
  left: 50%;
  z-index: 10;
  display: flex;
  transform: translateX(-50%);
  justify-content: center;
}

.pagination-footer--mobile {
  position: static;
  left: auto;
  margin-top: 12px;
  transform: none;
  justify-content: center;
}

/* 报价单顶部字段样式 */
.quotation-top-fields {
  display: flex;
  padding: 0 12px 12px;
  margin-top: -8px;
  margin-bottom: 8px;
  background-color: var(--el-bg-color-overlay);
  border-radius: 4px;
  align-items: flex-start;
  gap: 16px;
}

.quotation-top-left {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.quotation-top-part {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.quotation-top-part__row {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.quotation-top-part__row--inline-fields {
  flex-wrap: nowrap;
  width: 100%;
}

.quotation-top-part__customer {
  flex: 1 1 auto;
}

.quotation-top-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  align-items: center;
  flex: 1 1 auto;
}

.quotation-top-summary__item {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.field-value-inline {
  font-weight: 500;
  color: #303133;
  word-break: break-word;
}

.quotation-top-field {
  position: relative;
  margin-bottom: 0;
  flex: 1;
}

.quotation-top-field .field-label {
  margin-bottom: 6px;
  font-size: 13px;
  font-weight: 500;
  color: #606266;
}

:deep(.quotation-top-field .el-form-item__content) {
  margin-left: 0 !important;
}

/* 内联字段样式 */
.quotation-top-field--inline {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
}

.quotation-top-field--inline :deep(.el-form-item__content) {
  width: auto;
  margin-left: 0 !important;
  flex: 0 0 auto;
}

.field-label-inline {
  display: inline-block;
  width: 78px;
  margin-left: 0;
  font-size: 13px;
  font-weight: 500;
  color: #606266;
  text-align: right;
  white-space: nowrap;
}

.field-required {
  position: absolute;
  left: 0;
  margin-right: 2px;
  color: var(--el-color-danger);
}

/* .field-input-inline 默认样式，具体宽度由子类定义 */

/* 报价单号输入框宽度 */
.field-input-inline.field-input-quotation-no {
  width: 140px !important;
  flex: 0 0 140px !important;
}

.field-input-inline.field-input-quotation-no :deep(.el-input__wrapper),
.field-input-inline.field-input-quotation-no :deep(.el-input) {
  width: 140px !important;
}

/* 报价日期选择器宽度 */
.field-input-inline.field-input-quotation-date {
  width: 140px !important;
  max-width: 140px !important;
  min-width: 140px !important;
  flex: 0 0 140px !important;
}

.field-input-inline.field-input-quotation-date :deep(.el-input__wrapper) {
  width: 140px !important;
  max-width: 140px !important;
  min-width: 140px !important;
}

.field-input-inline.field-input-quotation-date :deep(.el-input__inner) {
  width: 140px !important;
}

.field-input-inline.field-input-quotation-date :deep(.el-input) {
  width: 140px !important;
  max-width: 140px !important;
  min-width: 140px !important;
}

/* 客户名称选择框宽度 */
.field-input-inline.field-input-customer-name {
  width: 240px !important;
  flex: 0 0 240px !important;
}

.field-input-inline.field-input-customer-name :deep(.el-input__wrapper),
.field-input-inline.field-input-customer-name :deep(.el-input) {
  width: 240px !important;
}

.field-input-inline.field-input-contact {
  width: 160px !important;
  flex: 0 0 160px !important;
}

.field-input-inline.field-input-contact :deep(.el-input__wrapper),
.field-input-inline.field-input-contact :deep(.el-input) {
  width: 160px !important;
}

/* 报价单弹窗样式 */
.quotation-sheet {
  margin-top: -8px;
  font-size: 13px;
  color: #333;
}

.qt-card {
  padding: 12px;
  background: var(--el-bg-color-overlay);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}

.quotation-sheet--part {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.qt-part-items__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.qt-part-items__toolbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.qt-part-items__image-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
}

.qt-part-items__image-toggle-label {
  font-weight: 500;
  color: #606266;
  white-space: nowrap;
}

.qt-part-items__title {
  font-weight: 600;
  color: #303133;
}

/* 细竖线：保留 border，但用更浅的颜色 */
.qt-part-items-table :deep(.el-table__header-wrapper th) {
  font-weight: 600;
  color: #606266;
  background-color: #f5f7fa;
}

.qt-part-items-table :deep(.el-table--border) {
  border-color: #ebeef5;
}

.qt-part-items-table :deep(.el-table--border::after),
.qt-part-items-table :deep(.el-table--border::before),
.qt-part-items-table :deep(.el-table__inner-wrapper::before) {
  background-color: #ebeef5;
}

.qt-part-items-table :deep(.el-table td.el-table__cell),
.qt-part-items-table :deep(.el-table th.el-table__cell) {
  border-color: #ebeef5;
}

.qt-part-items-table--with-image :deep(.el-table__cell) {
  padding-top: 4px;
  padding-bottom: 4px;
  vertical-align: middle;
}

.qt-part-items-table--with-image :deep(.el-table__row) {
  height: 64px;
}

.qt-part-image-file-input {
  display: none;
}

.qt-part-image-cell {
  position: relative;
  display: flex;
  width: 100%;
  height: 64px;
  outline: none;
  box-sizing: border-box;
  align-items: center;
  justify-content: center;
}

.qt-part-image-cell--readonly {
  cursor: default;
}

.qt-part-image-cell__loading {
  display: flex;
  width: 100%;
  height: 64px;
  font-size: 12px;
  color: #909399;
  background: #f5f7fa;
  border: 1px dashed #dcdfe6;
  border-radius: 6px;
  box-sizing: border-box;
  align-items: center;
  justify-content: center;
}

.qt-part-image-empty {
  display: flex;
  width: 100%;
  height: 64px;
  font-size: 11px;
  color: #909399;
  background: #fafafa;
  border: 1px dashed #dcdfe6;
  border-radius: 6px;
  box-sizing: border-box;
  align-items: center;
  justify-content: center;
}

.qt-part-image-empty__text {
  line-height: 1.1;
  text-align: center;
  user-select: none;
}

.qt-part-image-thumb {
  width: 100%;
  height: 64px;
  overflow: hidden;
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  box-sizing: border-box;
}

.qt-part-image-thumb :deep(.el-image__inner) {
  width: 100%;
  height: 64px;
  object-fit: contain;
  transform: scale(var(--img-scale, 1));
  transform-origin: center;
}

.qt-part-image-scale {
  position: absolute;
  right: 2px;
  bottom: 2px;
}

.qt-part-image-scale-badge {
  display: inline-flex;
  height: 18px;
  min-width: 34px;
  padding: 0 4px;
  font-size: 11px;
  color: #303133;
  cursor: pointer;
  background: rgb(255 255 255 / 90%);
  border: 1px solid #dcdfe6;
  border-radius: 10px;
  user-select: none;
  align-items: center;
  justify-content: center;
}

.qt-part-image-remove {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  padding: 0;
  line-height: 14px;
  color: #606266;
  text-align: center;
  cursor: pointer;
  background: rgb(255 255 255 / 90%);
  border: 1px solid #dcdfe6;
  border-radius: 50%;
}

.qt-part-image-pick {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 16px;
  height: 16px;
  padding: 0;
  line-height: 14px;
  color: #606266;
  text-align: center;
  cursor: pointer;
  background: rgb(255 255 255 / 90%);
  border: 1px solid #dcdfe6;
  border-radius: 50%;
}

.qt-part-items-table :deep(.el-input-number .el-input__inner) {
  text-align: right;
}

.qt-part-summary-card :deep(.el-input-number .el-input__inner) {
  text-align: right;
}

.qt-money-input :deep(.el-input__inner) {
  text-align: right;
}

.qt-part-summary-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.qt-part-summary-row__spacer {
  flex: 1 1 auto;
}

.qt-part-summary-card {
  width: 360px;
  padding: 12px 14px;
}

.qt-part-summary-item {
  display: grid;
  grid-template-columns: 96px 1fr;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.qt-part-summary-item:last-child {
  border-bottom: none;
}

.qt-part-summary-label {
  font-weight: 500;
  color: #606266;
  text-align: right;
  white-space: nowrap;
}

.qt-part-summary-value {
  text-align: right;
}

.qt-part-summary-item--total {
  padding-top: 10px;
}

.qt-part-summary-value--total {
  padding: 6px 10px;
  font-size: 16px;
  font-weight: 700;
  color: #303133;
  background: #eaf7e9;
  border: 1px solid #d5f0d1;
  border-radius: 6px;
}

.qt-part-summary-item--remark {
  align-items: start;
  padding-top: 10px;
  border-bottom: none;
}

.qt-part-summary-value--remark {
  text-align: left;
}

.qt-part-summary-value--remark :deep(.el-textarea__inner) {
  resize: vertical;
}

.qs-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.qs-table td {
  padding: 6px 8px;
  border: 1px solid #000;
  box-sizing: border-box;
}

/* 单位材料费 / 加工费用明细行：行高略微减小 */
.qs-row-material td,
.qs-row-process td {
  padding-top: 4px;
  padding-bottom: 4px;
}

.qs-title {
  padding: 8px 0;
  font-size: 16px;
  font-weight: 600;
  text-align: center;
}

.qs-label {
  font-weight: 500;
  text-align: center;
  background-color: #f5f5f5;
}

.qs-section-title {
  font-weight: 600;
  text-align: center;
}

.qs-input.qs-manual {
  background-color: #fff7d6; /* 手工填写区域（接近 Excel 黄色） */
}

.qs-total {
  font-weight: 600;
  text-align: right;
  background-color: #d8f0d2; /* 合计区域（接近 Excel 绿色） */
}

.qs-text {
  text-align: center;
}

.qs-number {
  text-align: right;
}

.qs-vert-header {
  text-align: center;
}

.qs-footer {
  font-size: 12px;
  color: #666;
  text-align: center;
}

/* 弹窗整体高度控制（PC 端） */
:deep(.qt-edit-dialog--part.el-dialog),
:deep(.qt-edit-dialog--part .el-dialog) {
  display: flex;
  height: 850px;
  max-height: 850px;
  margin-top: 0;
  flex-direction: column;
}

:deep(.qt-edit-dialog--part.el-dialog .el-dialog__body),
:deep(.qt-edit-dialog--part .el-dialog__body) {
  position: relative;
  min-height: 0;
  padding: 0 12px 12px;
  overflow: hidden;
  flex: 1 1 auto;
}

:deep(.qt-edit-dialog .el-dialog__header) {
  height: 0;
  min-height: 0;
  padding: 0;
  margin-bottom: 0;
  overflow: hidden;
  border-bottom: none;
}

.qt-dialog-header {
  display: none;
}

.qt-dialog-header__title {
  font-weight: 600;
  text-align: center;
  flex: 1 1 auto;
}

.qt-edit-dialog--part .quotation-form {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
}

.qt-edit-dialog--part .quotation-sheet--part {
  flex: 1 1 auto;
  min-height: 0;
}

.qt-edit-dialog--part .qt-part-items-card {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
}

.qt-edit-dialog--part :deep(.qt-part-items-table) {
  height: 100%;
  min-height: 0;
  flex: 1 1 auto;
}

/* 操作按钮区域 - 与输入框同一行 */
.qt-dialog-actions {
  display: flex;
  padding: 0;
  margin-left: auto;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
}

:deep(.qt-edit-dialog .el-dialog__headerbtn) {
  position: static;
  margin-left: 8px;
}

/* 项目代入对话框样式 */
.project-import-dialog {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.project-import-search-input {
  max-width: 400px;
}

.project-import-table {
  margin-top: 4px;
}

.project-import-pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}

.project-import-empty {
  margin-top: 8px;
  font-size: 13px;
  color: #999;
}

.project-import-tip {
  margin-top: 8px;
  font-size: 12px;
  color: #888;
}
</style>
