<template>
  <div class="sales-orders-page px-4 pt-0 pb-1 space-y-2">
    <div v-if="isMobile" class="mobile-top-bar">
      <el-button text type="primary" @click="showMobileFilters = !showMobileFilters">
        {{ showMobileFilters ? '收起筛选' : '展开筛选' }}
      </el-button>
      <div class="view-mode-switch">
        <span class="view-mode-switch__label">视图</span>
        <el-radio-group v-model="viewMode" size="small">
          <el-radio-button value="card">卡片</el-radio-button>
          <el-radio-button value="table">表格</el-radio-button>
        </el-radio-group>
      </div>
    </div>
    <!-- 手机端仍在内容区显示统计卡片，PC 端在顶部工具栏显示 -->
    <el-row :gutter="12" class="so-summary-row" v-if="isMobile">
      <el-col :xs="24" :sm="12" :lg="5">
        <el-card shadow="hover" class="summary-card summary-card--year">
          <div class="summary-title">当年订单累计金额</div>
          <div class="summary-value">{{ formatAmount(summary.yearTotalAmount) }}</div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="5">
        <el-card shadow="hover" class="summary-card summary-card--month">
          <div class="summary-title">本月订单累计金额</div>
          <div class="summary-value">{{ formatAmount(summary.monthTotalAmount) }}</div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="5">
        <el-card shadow="hover" class="summary-card summary-card--pending-in">
          <div class="summary-title">待入库</div>
          <div class="summary-value">{{ summary.pendingInStock || 0 }}</div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="5">
        <el-card shadow="hover" class="summary-card summary-card--pending-out">
          <div class="summary-title">待出运</div>
          <div class="summary-value">{{ summary.pendingShipped || 0 }}</div>
        </el-card>
      </el-col>
    </el-row>

    <el-form
      :model="queryForm"
      :label-width="isMobile ? 'auto' : '80px'"
      :label-position="isMobile ? 'top' : 'right'"
      :inline="!isMobile"
      class="query-form rounded-lg bg-[var(--el-bg-color-overlay)] px-4 py-2 shadow-sm"
      :class="{ 'query-form--mobile': isMobile }"
      v-show="!isMobile || showMobileFilters"
    >
      <el-form-item label="关键词">
        <el-input
          v-model="queryForm.searchText"
          placeholder="请输入项目编号/订单编号/客户模号/产品图号/产品名称"
          clearable
          @keydown.enter.prevent="handleSearch"
          :style="{ width: isMobile ? '100%' : '160px' }"
        />
      </el-form-item>
      <el-form-item label="客户名称">
        <el-select
          v-model="queryForm.customerName"
          placeholder="请选择客户"
          clearable
          filterable
          :style="{ width: isMobile ? '100%' : '160px' }"
        >
          <el-option
            v-for="customer in customerList"
            :key="customer.id"
            :label="customer.customerName"
            :value="customer.customerName"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="合同号">
        <el-input
          v-model="queryForm.contractNo"
          placeholder="请输入合同号"
          clearable
          :style="{ width: isMobile ? '100%' : '140px' }"
        />
      </el-form-item>
      <el-form-item label="下单日期">
        <el-date-picker
          v-model="queryForm.orderDateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          value-format="YYYY-MM-DD"
          clearable
          :style="{ width: isMobile ? '100%' : '240px' }"
        />
      </el-form-item>
      <el-form-item class="query-form__actions">
        <div class="query-actions">
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
          <el-button type="success" @click="handleCreate">新增</el-button>
        </div>
      </el-form-item>
    </el-form>

    <!-- PC 时间轴视图 -->
    <div v-if="!isMobile && viewMode === 'timeline'" class="so-timeline-layout">
      <div class="so-timeline-left">
        <div v-for="group in timelineGroups" :key="group.date" class="so-timeline-date-group">
          <div class="so-timeline-date-header">
            <span class="so-timeline-date-label">{{ group.date }}</span>
          </div>
          <div v-for="order in group.orders" :key="order.orderNo" class="so-timeline-order-block">
            <div
              class="so-timeline-order-header"
              :class="{ 'is-active': timelineActiveOrderNo === order.orderNo }"
              @click="handleTimelineOrderClick(order)"
            >
              <div class="so-timeline-order-main">
                <span class="so-timeline-order-no">{{ order.orderNo }}</span>
                <span class="so-timeline-order-customer">{{ order.customerName || '-' }}</span>
              </div>
              <div class="so-timeline-order-meta">
                <span>数量 {{ order.totalQuantity || 0 }}</span>
                <span>金额 {{ formatAmount(order.totalAmount) }}</span>
              </div>
            </div>
            <div v-if="order.details && order.details.length" class="so-timeline-order-details">
              <div
                v-for="detail in order.details"
                :key="detail.id || detail.itemCode || detail.productName"
                class="so-timeline-detail-row"
                :class="{ 'is-active': isTimelineActiveDetail(order.orderNo, detail) }"
                @click.stop="handleTimelineDetailClick(order, detail)"
              >
                <div class="so-timeline-detail-main">
                  {{ detail.itemCode || '' }} {{ detail.productName || '' }}
                </div>
                <div class="so-timeline-detail-meta">
                  <span v-if="detail.customerPartNo">模号 {{ detail.customerPartNo }}</span>
                  <span>数量 {{ detail.quantity || 0 }}</span>
                  <span v-if="detail.deliveryDate">交货 {{ formatDate(detail.deliveryDate) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div v-if="!timelineGroups.length" class="so-timeline-empty">
          <el-empty description="当前条件下暂无订单数据" />
        </div>
      </div>
      <div class="so-timeline-right">
        <div v-if="viewOrderData && timelineActiveOrderNo" class="so-timeline-detail-panel">
          <div class="view-dialog-section">
            <div class="view-dialog-section-header view-dialog-section-header--timeline">
              <div class="view-dialog-section-main">
                <h3 class="view-dialog-section-title">订单基本信息</h3>
                <div class="view-dialog-info-grid">
                  <div class="view-dialog-info-item">
                    <span class="view-dialog-info-label">订单编号：</span>
                    <span class="view-dialog-info-value">{{ viewOrderData.orderNo || '-' }}</span>
                  </div>
                  <div class="view-dialog-info-item">
                    <span class="view-dialog-info-label">客户名称：</span>
                    <span class="view-dialog-info-value">{{
                      viewOrderData.customerName || '-'
                    }}</span>
                  </div>
                  <div class="view-dialog-info-item">
                    <span class="view-dialog-info-label">合同编号：</span>
                    <span class="view-dialog-info-value">{{
                      viewOrderData.contractNo || '-'
                    }}</span>
                  </div>
                  <div class="view-dialog-info-item">
                    <span class="view-dialog-info-label">签订日期：</span>
                    <span class="view-dialog-info-value">{{
                      formatDate(viewOrderData.signDate) || '-'
                    }}</span>
                  </div>
                  <div class="view-dialog-info-item">
                    <span class="view-dialog-info-label">订单日期：</span>
                    <span class="view-dialog-info-value">{{
                      formatDate(viewOrderData.orderDate) || '-'
                    }}</span>
                  </div>
                  <div class="view-dialog-info-item">
                    <span class="view-dialog-info-label">总数量：</span>
                    <span class="view-dialog-info-value">{{
                      viewOrderData.totalQuantity || 0
                    }}</span>
                  </div>
                  <div class="view-dialog-info-item">
                    <span class="view-dialog-info-label">总金额：</span>
                    <span class="view-dialog-info-value">
                      {{ formatAmount(viewOrderData.totalAmount) }} 元
                    </span>
                  </div>
                </div>
              </div>
              <div class="so-timeline-header-actions">
                <el-button type="success" size="small" @click="handleTimelineView">查看</el-button>
                <el-button type="primary" size="small" @click="handleTimelineEdit">编辑</el-button>
                <el-button type="danger" size="small" @click="handleTimelineDelete">删除</el-button>
              </div>
            </div>
          </div>
          <div class="view-dialog-section">
            <h3 class="view-dialog-section-title">订单明细</h3>
            <div class="dialog-table-wrapper">
              <el-table
                :data="viewOrderData.details"
                border
                size="small"
                style="width: 100%"
                :row-class-name="viewDetailRowClassName"
              >
                <el-table-column type="index" label="序号" width="45" align="center" />
                <el-table-column prop="itemCode" label="项目编号" min-width="120" />
                <el-table-column
                  prop="productName"
                  label="产品名称"
                  min-width="120"
                  show-overflow-tooltip
                />
                <el-table-column
                  prop="productDrawingNo"
                  label="产品图号"
                  min-width="120"
                  show-overflow-tooltip
                />
                <el-table-column
                  prop="customerPartNo"
                  label="客户模号"
                  min-width="120"
                  show-overflow-tooltip
                />
                <el-table-column label="数量" width="50" align="center">
                  <template #default="{ row }">
                    {{ row.quantity || 0 }}
                  </template>
                </el-table-column>
                <el-table-column label="单价(元)" width="85" align="right">
                  <template #default="{ row }">
                    {{ formatAmount(row.unitPrice) }}
                  </template>
                </el-table-column>
                <el-table-column label="总金额(元)" width="85" align="right">
                  <template #default="{ row }">
                    {{ formatAmount(row.totalAmount) }}
                  </template>
                </el-table-column>
                <el-table-column label="交货日期" width="100" align="center">
                  <template #default="{ row }">
                    {{ formatDate(row.deliveryDate) }}
                  </template>
                </el-table-column>
                <el-table-column prop="remark" label="备注" min-width="120" show-overflow-tooltip />
                <el-table-column
                  prop="costSource"
                  label="费用出处"
                  min-width="120"
                  show-overflow-tooltip
                />
                <el-table-column label="是否入库" width="70" align="center">
                  <template #default="{ row }">
                    <el-tag :type="row.isInStock ? 'success' : 'info'" size="small">
                      {{ row.isInStock ? '是' : '否' }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="是否出运" width="70" align="center">
                  <template #default="{ row }">
                    <el-tag :type="row.isShipped ? 'success' : 'info'" size="small">
                      {{ row.isShipped ? '是' : '否' }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="出运日期" width="105" align="center">
                  <template #default="{ row }">
                    {{ formatDate(row.shippingDate) }}
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </div>
        </div>
        <div v-else class="so-timeline-detail-panel-empty">
          <el-empty description="请选择左侧时间轴中的订单" />
        </div>
      </div>
    </div>

    <div
      v-if="viewMode === 'table'"
      class="so-table-wrapper"
      :class="{ 'so-table-wrapper--mobile': isMobile }"
    >
      <el-table
        ref="tableRef"
        v-loading="loading"
        :data="tableData"
        border
        :height="tableHeight"
        row-key="orderNo"
        @row-dblclick="handleRowDblClick"
        :row-class-name="rowClassName"
        class="so-table"
        @expand-change="onExpandChange"
      >
        <el-table-column type="expand">
          <template #default="{ row }">
            <div class="so-expanded-wrap">
              <el-table :data="row.details" border size="small" row-key="id" style="width: 100%">
                <el-table-column type="index" label="序号" width="50" />
                <el-table-column prop="itemCode" label="项目编号" min-width="90" />
                <el-table-column prop="productName" label="产品名称" min-width="100" />
                <el-table-column prop="productDrawingNo" label="产品图号" min-width="100" />
                <el-table-column prop="customerPartNo" label="客户模号" min-width="100" />
                <el-table-column label="数量" width="60" align="center">
                  <template #default="{ row: detail }">
                    {{ detail.quantity || 0 }}
                  </template>
                </el-table-column>
                <el-table-column label="单价(元)" width="100" align="right">
                  <template #default="{ row: detail }">
                    {{ formatAmount(detail.unitPrice) }}
                  </template>
                </el-table-column>
                <el-table-column label="总金额(元)" width="100" align="right">
                  <template #default="{ row: detail }">
                    {{ formatAmount(detail.totalAmount) }}
                  </template>
                </el-table-column>
                <el-table-column label="交货日期" width="100">
                  <template #default="{ row: detail }">
                    {{ formatDate(detail.deliveryDate) }}
                  </template>
                </el-table-column>
                <el-table-column prop="remark" label="备注" min-width="140" show-overflow-tooltip />
                <el-table-column
                  prop="costSource"
                  label="费用出处"
                  min-width="120"
                  show-overflow-tooltip
                />
                <el-table-column label="是否入库" width="100" align="center">
                  <template #default="{ row: detail }">
                    <el-tag :type="detail.isInStock ? 'success' : 'info'" size="small">
                      {{ detail.isInStock ? '是' : '否' }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="是否出运" width="100" align="center">
                  <template #default="{ row: detail }">
                    <el-tag :type="detail.isShipped ? 'success' : 'info'" size="small">
                      {{ detail.isShipped ? '是' : '否' }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="出运日期" width="140">
                  <template #default="{ row: detail }">
                    {{ formatDate(detail.shippingDate) }}
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </template>
        </el-table-column>
        <el-table-column type="index" label="序号" width="55" align="center" fixed="left" />
        <el-table-column prop="orderNo" label="订单编号" min-width="90" show-overflow-tooltip />
        <el-table-column
          prop="customerName"
          label="客户名称"
          min-width="195"
          sortable
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <span class="so-cell-nowrap">
              {{ row.customerName || '-' }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="orderDate" label="订单日期" width="154" show-overflow-tooltip>
          <template #default="{ row }">
            {{ formatDate(row.orderDate) }}
          </template>
        </el-table-column>
        <el-table-column prop="signDate" label="签订日期" width="154" show-overflow-tooltip>
          <template #default="{ row }">
            {{ formatDate(row.signDate) }}
          </template>
        </el-table-column>
        <el-table-column
          prop="contractNo"
          label="合同号"
          min-width="90"
          sortable
          show-overflow-tooltip
        />
        <el-table-column label="明细数量" width="100" align="center" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.details.length }}
          </template>
        </el-table-column>
        <el-table-column label="总数量" width="100" align="center" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.totalQuantity || 0 }}
          </template>
        </el-table-column>
        <el-table-column label="总金额(元)" width="140" align="right" show-overflow-tooltip>
          <template #default="{ row }">
            {{ formatAmount(row.totalAmount) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="205" fixed="right">
          <template #default="{ row }">
            <div class="so-operation-buttons">
              <el-button type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
              <el-button type="success" size="small" @click="handleView(row)">查看</el-button>
              <el-button type="danger" size="small" @click="handleDelete(row)">删除</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div v-else-if="isMobile && viewMode === 'card'" class="so-mobile-list" v-loading="loading">
      <el-empty v-if="!tableData.length && !loading" description="暂无销售订单" />
      <template v-else>
        <el-card v-for="row in tableData" :key="row.orderNo" class="so-mobile-card" shadow="hover">
          <div class="so-mobile-card__header">
            <div>
              <div class="so-mobile-card__order">订单编号：{{ row.orderNo || '-' }}</div>
              <div class="so-mobile-card__date">
                订单日期：{{ formatDate(row.orderDate) || '-' }}
              </div>
              <div class="so-mobile-card__customer">{{ row.customerName || '-' }}</div>
            </div>
            <el-tag size="small" type="info">明细 {{ row.details.length }}</el-tag>
          </div>
          <div class="so-mobile-card__meta">
            <div>
              <span class="label">合同号</span>
              <span class="value">{{ row.contractNo || '-' }}</span>
            </div>
          </div>
          <div class="so-mobile-card__stats">
            <div class="stat">
              <div class="stat-label">总数量</div>
              <div class="stat-value">{{ row.totalQuantity || 0 }}</div>
            </div>
            <div class="stat">
              <div class="stat-label">总金额(元)</div>
              <div class="stat-value">{{ formatAmount(row.totalAmount) }}</div>
            </div>
          </div>
          <div v-if="row.details.length" class="so-mobile-card__details">
            <div
              v-for="detail in row.details.slice(0, 2)"
              :key="detail.id || detail.itemCode || detail.productName"
              class="detail-row"
            >
              <div class="detail-title">{{ detail.productName || detail.itemCode || '明细' }}</div>
              <div class="detail-meta">
                <span>{{ detail.itemCode || '-' }}</span>
                <span v-if="detail.productDrawingNo">产品图号 {{ detail.productDrawingNo }}</span>
                <span v-if="detail.customerPartNo">客户模号 {{ detail.customerPartNo }}</span>
                <span>数量 {{ detail.quantity || 0 }}</span>
                <span v-if="detail.deliveryDate">交付 {{ formatDate(detail.deliveryDate) }}</span>
              </div>
            </div>
            <div v-if="row.details.length > 2" class="detail-more">
              还有 {{ row.details.length - 2 }} 条明细...
            </div>
          </div>
          <div class="so-mobile-card__actions">
            <el-button type="success" size="small" @click="handleView(row)">查看</el-button>
            <el-button type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button type="danger" size="small" @click="handleDelete(row)">删除</el-button>
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

    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      :width="isMobile ? '100%' : '1500px'"
      :fullscreen="isMobile"
      :close-on-click-modal="false"
      class="so-dialog"
      @closed="handleDialogClosed"
    >
      <el-form
        ref="dialogFormRef"
        :model="dialogForm"
        :rules="dialogRules"
        label-width="auto"
        class="dialog-form-container"
      >
        <div class="dialog-form-columns">
          <div class="dialog-form-column dialog-form-column--left">
            <el-form-item label="订单编号" prop="orderNo">
              <el-input
                v-model="dialogForm.orderNo"
                placeholder="订单编号"
                disabled
                :style="{ width: dialogControlWidth }"
              />
            </el-form-item>
            <el-form-item label="订单日期">
              <el-date-picker
                v-model="dialogForm.orderDate"
                type="date"
                value-format="YYYY-MM-DD"
                placeholder="请选择订单日期"
                :style="{ width: dialogControlWidth }"
              />
            </el-form-item>
          </div>
          <div class="dialog-form-column dialog-form-column--right">
            <el-form-item label="客户名称" prop="customerId">
              <el-select
                v-model="dialogForm.customerId"
                placeholder="请选择客户"
                filterable
                clearable
                @change="handleCustomerChange"
                :style="{ width: dialogControlWidth }"
                :disabled="!isCreateMode"
              >
                <el-option
                  v-for="customer in customerList"
                  :key="customer.id"
                  :label="customer.customerName"
                  :value="customer.id"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="签订日期">
              <el-date-picker
                v-model="dialogForm.signDate"
                type="date"
                value-format="YYYY-MM-DD"
                placeholder="请选择签订日期"
                :style="{ width: dialogControlWidth }"
              />
            </el-form-item>
            <el-form-item label="合同编号">
              <el-input
                v-model="dialogForm.contractNo"
                placeholder="请输入合同编号"
                :style="{ width: dialogControlWidth }"
              />
            </el-form-item>
          </div>
        </div>

        <div class="dialog-product-section">
          <div v-if="isCreateMode" style="margin-bottom: 12px">
            <el-button type="primary" size="small" @click="openNewProductDialog">
              从新品中选择
            </el-button>
          </div>
          <div v-if="!isMobile" class="dialog-table-wrapper">
            <el-table
              :data="dialogForm.details"
              border
              size="small"
              row-key="id"
              style="width: 100%"
            >
              <el-table-column type="index" label="序号" width="45" />
              <el-table-column label="项目编号" min-width="140">
                <template #default="{ row }">
                  <el-input
                    v-model="row.itemCode"
                    placeholder="请输入项目编号"
                    :disabled="!isCreateMode"
                  />
                </template>
              </el-table-column>
              <el-table-column label="产品名称" min-width="150">
                <template #default="{ row }">
                  <el-input
                    v-model="row.productName"
                    placeholder="请输入产品名称"
                    :disabled="!isCreateMode"
                  />
                </template>
              </el-table-column>
              <el-table-column label="产品图号" min-width="130">
                <template #default="{ row }">
                  <el-input
                    v-model="row.productDrawingNo"
                    placeholder="请输入产品图号"
                    :disabled="!isCreateMode"
                  />
                </template>
              </el-table-column>
              <el-table-column label="客户模号" min-width="130">
                <template #default="{ row }">
                  <el-input v-model="row.customerPartNo" placeholder="请输入客户模号" />
                </template>
              </el-table-column>
              <el-table-column label="数量" width="140" align="center">
                <template #default="{ row }">
                  <el-input-number
                    v-model="row.quantity"
                    :min="0"
                    :step="1"
                    style="width: 100%"
                    @change="handleDetailQuantityChange(row)"
                  />
                </template>
              </el-table-column>
              <el-table-column label="单价(元)" width="120" align="right">
                <template #default="{ row }">
                  <el-input-number
                    v-model="row.unitPrice"
                    :min="0"
                    :step="100"
                    :precision="2"
                    :controls="false"
                    style="width: 100%"
                    @change="handleDetailUnitPriceChange(row)"
                  />
                </template>
              </el-table-column>
              <el-table-column label="金额(元)" width="80" align="right">
                <template #default="{ row }">
                  {{ formatAmount(row.totalAmount) }}
                </template>
              </el-table-column>
              <el-table-column label="交付日期" width="150">
                <template #default="{ row }">
                  <el-date-picker
                    v-model="row.deliveryDate"
                    type="date"
                    value-format="YYYY-MM-DD"
                    placeholder="请选择交付日期"
                    style="width: 130px"
                  />
                </template>
              </el-table-column>
              <el-table-column label="备注" min-width="150">
                <template #default="{ row }">
                  <el-input v-model="row.remark" placeholder="备注" />
                </template>
              </el-table-column>
              <el-table-column label="费用出处" min-width="145">
                <template #default="{ row }">
                  <el-input v-model="row.costSource" placeholder="费用出处" />
                </template>
              </el-table-column>
              <el-table-column v-if="isCreateMode" label="操作" width="55" fixed="right">
                <template #default="{ $index }">
                  <el-button type="danger" link @click="removeDetailRow($index)">删除</el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
          <div v-else class="dialog-mobile-details-list">
            <div
              v-for="(detail, index) in dialogForm.details"
              :key="detail.id || index"
              class="dialog-mobile-detail-card"
            >
              <div class="dialog-mobile-detail-header">
                <span class="dialog-mobile-detail-title">明细 {{ index + 1 }}</span>
                <el-button
                  v-if="isCreateMode"
                  type="danger"
                  text
                  size="small"
                  @click="removeDetailRow(index)"
                >
                  删除
                </el-button>
              </div>
              <div class="dialog-mobile-detail-body">
                <div class="dialog-mobile-detail-field">
                  <div class="dialog-mobile-detail-label">项目编号</div>
                  <el-input
                    v-model="detail.itemCode"
                    placeholder="请输入项目编号"
                    :disabled="!isCreateMode"
                  />
                </div>
                <div class="dialog-mobile-detail-field">
                  <div class="dialog-mobile-detail-label">产品名称</div>
                  <el-input
                    v-model="detail.productName"
                    placeholder="请输入产品名称"
                    :disabled="!isCreateMode"
                  />
                </div>
                <div class="dialog-mobile-detail-field">
                  <div class="dialog-mobile-detail-label">产品图号</div>
                  <el-input
                    v-model="detail.productDrawingNo"
                    placeholder="请输入产品图号"
                    :disabled="!isCreateMode"
                  />
                </div>
                <div class="dialog-mobile-detail-field">
                  <div class="dialog-mobile-detail-label">客户模号</div>
                  <el-input v-model="detail.customerPartNo" placeholder="请输入客户模号" />
                </div>
                <div class="dialog-mobile-detail-field">
                  <div class="dialog-mobile-detail-label">数量</div>
                  <el-input-number
                    v-model="detail.quantity"
                    :min="0"
                    :step="1"
                    style="width: 100%"
                    @change="handleDetailQuantityChange(detail)"
                  />
                </div>
                <div class="dialog-mobile-detail-field">
                  <div class="dialog-mobile-detail-label">单价(元)</div>
                  <el-input-number
                    v-model="detail.unitPrice"
                    :min="0"
                    :step="100"
                    :precision="2"
                    :controls="false"
                    style="width: 100%"
                    @change="handleDetailUnitPriceChange(detail)"
                  />
                </div>
                <div class="dialog-mobile-detail-field">
                  <div class="dialog-mobile-detail-label">金额(元)</div>
                  <div class="dialog-mobile-detail-text">
                    {{ formatAmount(detail.totalAmount) }}
                  </div>
                </div>
                <div class="dialog-mobile-detail-field">
                  <div class="dialog-mobile-detail-label">交付日期</div>
                  <el-date-picker
                    v-model="detail.deliveryDate"
                    type="date"
                    value-format="YYYY-MM-DD"
                    placeholder="请选择交付日期"
                    style="width: 100%"
                  />
                </div>
                <div class="dialog-mobile-detail-field">
                  <div class="dialog-mobile-detail-label">备注</div>
                  <el-input v-model="detail.remark" placeholder="备注" />
                </div>
                <div class="dialog-mobile-detail-field">
                  <div class="dialog-mobile-detail-label">费用出处</div>
                  <el-input v-model="detail.costSource" placeholder="费用出处" />
                </div>
              </div>
            </div>
          </div>

          <div class="dialog-product-summary">
            <el-button v-if="isCreateMode" type="primary" plain @click="addDetailRow"
              >新增明细行</el-button
            >
            <div>
              <span class="dialog-product-summary__item"
                >产品项数：{{ dialogForm.details.length }}</span
              >
              <span class="dialog-product-summary__item"
                >总数量：{{ dialogTotals.totalQuantity }}</span
              >
              <span>总金额：{{ formatAmount(dialogTotals.totalAmount) }}</span>
            </div>
          </div>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="dialogSubmitting" @click="submitDialogForm">
          保存
        </el-button>
      </template>
    </el-dialog>

    <!-- 新品选择对话框 -->
    <el-dialog
      v-model="newProductDialogVisible"
      title="选择新品货物"
      :width="isMobile ? '100%' : '1200px'"
      :fullscreen="isMobile"
      :close-on-click-modal="false"
      class="so-dialog"
    >
      <div
        v-if="selectedCustomerName"
        style="
          padding: 8px;
          margin-bottom: 12px;
          background-color: #f0f9ff;
          border: 1px solid #91d5ff;
          border-radius: 4px;
        "
      >
        <span style="font-weight: 500; color: #1890ff">
          已限制客户：{{ selectedCustomerName }}
        </span>
        <span style="margin-left: 8px; font-size: 12px; color: #666">
          （只能选择同一客户的货物）
        </span>
      </div>
      <div class="dialog-table-wrapper">
        <el-table
          ref="newProductTableRef"
          v-loading="newProductLoading"
          :data="newProductList"
          border
          @selection-change="handleProductSelectionChange"
          @select="handleProductSelect"
          max-height="500px"
          :row-class-name="getRowClassName"
        >
          <el-table-column type="selection" width="55" :selectable="checkSelectable" />
          <el-table-column prop="itemCode" label="项目编号" min-width="140">
            <template #default="{ row }">
              <span :style="{ color: isItemCodeExists(row.itemCode) ? '#999' : '#333' }">
                {{ row.itemCode || '-' }}
                <el-tag
                  v-if="isItemCodeExists(row.itemCode)"
                  type="info"
                  size="small"
                  style="margin-left: 8px"
                >
                  已添加
                </el-tag>
              </span>
            </template>
          </el-table-column>
          <el-table-column prop="productName" label="产品名称" min-width="160" />
          <el-table-column prop="productDrawingNo" label="产品图号" min-width="150" />
          <el-table-column prop="customerPartNo" label="客户模号" min-width="150" />
          <el-table-column prop="customerName" label="客户名称" min-width="160">
            <template #default="{ row }">
              <span
                :style="{ color: row.customerName === selectedCustomerName ? '#1890ff' : '#333' }"
              >
                {{ row.customerName || '-' }}
              </span>
            </template>
          </el-table-column>
          <el-table-column prop="category" label="分类" width="100" />
          <el-table-column prop="remarks" label="备注" min-width="140" show-overflow-tooltip />
        </el-table>
      </div>
      <template #footer>
        <el-button @click="newProductDialogVisible = false">取消</el-button>
        <el-button
          type="primary"
          @click="fillSelectedProducts"
          :disabled="selectedProducts.length === 0"
        >
          填充 ({{ selectedProducts.length }})
        </el-button>
      </template>
    </el-dialog>

    <!-- 查看对话框 -->
    <el-dialog
      v-model="viewDialogVisible"
      :title="''"
      :width="isMobile ? '100%' : '1500px'"
      :fullscreen="isMobile"
      :close-on-click-modal="false"
      class="so-dialog so-dialog-view"
    >
      <div v-if="viewOrderData" class="view-dialog-container">
        <!-- 订单基本信息 -->
        <div class="view-dialog-section">
          <h3 class="view-dialog-section-title">订单基本信息</h3>
          <!-- PC 端：保持原来的 4 列网格布局 -->
          <div v-if="!isMobile" class="view-dialog-info-grid">
            <div class="view-dialog-info-item">
              <span class="view-dialog-info-label">订单编号：</span>
              <span class="view-dialog-info-value">{{ viewOrderData.orderNo || '-' }}</span>
            </div>
            <div class="view-dialog-info-item">
              <span class="view-dialog-info-label">客户名称：</span>
              <span class="view-dialog-info-value">{{ viewOrderData.customerName || '-' }}</span>
            </div>
            <div class="view-dialog-info-item">
              <span class="view-dialog-info-label">合同编号：</span>
              <span class="view-dialog-info-value">{{ viewOrderData.contractNo || '-' }}</span>
            </div>
            <div class="view-dialog-info-item">
              <span class="view-dialog-info-label">签订日期：</span>
              <span class="view-dialog-info-value">{{
                formatDate(viewOrderData.signDate) || '-'
              }}</span>
            </div>
            <div class="view-dialog-info-item">
              <span class="view-dialog-info-label">订单日期：</span>
              <span class="view-dialog-info-value">{{
                formatDate(viewOrderData.orderDate) || '-'
              }}</span>
            </div>
            <div class="view-dialog-info-item">
              <span class="view-dialog-info-label">总数量：</span>
              <span class="view-dialog-info-value">{{ viewOrderData.totalQuantity || 0 }}</span>
            </div>
            <div class="view-dialog-info-item">
              <span class="view-dialog-info-label">总金额：</span>
              <span class="view-dialog-info-value">
                {{ formatAmount(viewOrderData.totalAmount) }} 元
              </span>
            </div>
          </div>

          <!-- 手机端：顶部主信息 + 二列网格 -->
          <div v-else class="view-dialog-mobile-basic">
            <div class="view-dialog-mobile-basic-main">
              <div class="view-dialog-mobile-order">
                <span class="label">订单编号：</span>
                <span class="value">{{ viewOrderData.orderNo || '-' }}</span>
              </div>
              <div class="view-dialog-mobile-customer">
                <span class="label">客户名称：</span>
                <span class="value">{{ viewOrderData.customerName || '-' }}</span>
              </div>
              <div class="view-dialog-mobile-contract">
                <span class="label">合同编号：</span>
                <span class="value">{{ viewOrderData.contractNo || '-' }}</span>
              </div>
            </div>
            <div class="view-dialog-info-grid view-dialog-info-grid--mobile">
              <div class="view-dialog-info-item">
                <span class="view-dialog-info-label">订单日期</span>
                <span class="view-dialog-info-value">{{
                  formatDate(viewOrderData.orderDate) || '-'
                }}</span>
              </div>
              <div class="view-dialog-info-item">
                <span class="view-dialog-info-label">签订日期</span>
                <span class="view-dialog-info-value">{{
                  formatDate(viewOrderData.signDate) || '-'
                }}</span>
              </div>
              <div class="view-dialog-info-item">
                <span class="view-dialog-info-label">总数量</span>
                <span class="view-dialog-info-value">{{ viewOrderData.totalQuantity || 0 }}</span>
              </div>
              <div class="view-dialog-info-item">
                <span class="view-dialog-info-label">总金额</span>
                <span class="view-dialog-info-value">
                  {{ formatAmount(viewOrderData.totalAmount) }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- 订单明细 -->
        <div class="view-dialog-section">
          <h3 class="view-dialog-section-title">订单明细</h3>
          <div v-if="!isMobile" class="dialog-table-wrapper">
            <el-table
              :data="viewOrderData.details"
              border
              size="small"
              style="width: 100%"
              :row-class-name="viewDetailRowClassName"
            >
              <el-table-column type="index" label="序号" width="45" align="center" />
              <el-table-column prop="itemCode" label="项目编号" min-width="120" />
              <el-table-column
                prop="productName"
                label="产品名称"
                min-width="120"
                show-overflow-tooltip
              />
              <el-table-column
                prop="productDrawingNo"
                label="产品图号"
                min-width="120"
                show-overflow-tooltip
              />
              <el-table-column
                prop="customerPartNo"
                label="客户模号"
                min-width="120"
                show-overflow-tooltip
              />
              <el-table-column label="数量" width="50" align="center">
                <template #default="{ row }">
                  {{ row.quantity || 0 }}
                </template>
              </el-table-column>
              <el-table-column label="单价(元)" width="80" align="right">
                <template #default="{ row }">
                  {{ formatAmount(row.unitPrice) }}
                </template>
              </el-table-column>
              <el-table-column label="总金额(元)" width="80" align="right">
                <template #default="{ row }">
                  {{ formatAmount(row.totalAmount) }}
                </template>
              </el-table-column>
              <el-table-column label="交货日期" width="110" align="center">
                <template #default="{ row }">
                  {{ formatDate(row.deliveryDate) }}
                </template>
              </el-table-column>
              <el-table-column prop="remark" label="备注" min-width="120" show-overflow-tooltip />
              <el-table-column
                prop="costSource"
                label="费用出处"
                min-width="120"
                show-overflow-tooltip
              />
              <el-table-column label="是否入库" width="80" align="center">
                <template #default="{ row }">
                  <el-tag :type="row.isInStock ? 'success' : 'info'" size="small">
                    {{ row.isInStock ? '是' : '否' }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="是否出运" width="80" align="center">
                <template #default="{ row }">
                  <el-tag :type="row.isShipped ? 'success' : 'info'" size="small">
                    {{ row.isShipped ? '是' : '否' }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="出运日期" width="105" align="center">
                <template #default="{ row }">
                  {{ formatDate(row.shippingDate) }}
                </template>
              </el-table-column>
            </el-table>
          </div>
          <div v-else class="view-dialog-mobile-details">
            <div
              v-for="(detail, index) in viewOrderData.details"
              :key="detail.id || index"
              class="view-dialog-mobile-detail-card"
            >
              <div class="view-dialog-mobile-detail-header">
                <div class="view-dialog-mobile-detail-title">
                  {{ detail.productName || detail.itemCode || '明细 ' + (index + 1) }}
                </div>
                <div class="view-dialog-mobile-detail-qty"> 数量 {{ detail.quantity || 0 }} </div>
              </div>
              <div class="view-dialog-mobile-detail-body">
                <div class="view-dialog-mobile-detail-row">
                  <span class="label">项目编号</span>
                  <span class="value">{{ detail.itemCode || '-' }}</span>
                </div>
                <div class="view-dialog-mobile-detail-row">
                  <span class="label">产品图号</span>
                  <span class="value">{{ detail.productDrawingNo || '-' }}</span>
                </div>
                <div class="view-dialog-mobile-detail-row">
                  <span class="label">客户模号</span>
                  <span class="value">{{ detail.customerPartNo || '-' }}</span>
                </div>
                <div class="view-dialog-mobile-detail-row">
                  <span class="label">单价(元)</span>
                  <span class="value">{{ formatAmount(detail.unitPrice) }}</span>
                </div>
                <div class="view-dialog-mobile-detail-row">
                  <span class="label">总金额(元)</span>
                  <span class="value">{{ formatAmount(detail.totalAmount) }}</span>
                </div>
                <div class="view-dialog-mobile-detail-row">
                  <span class="label">交货日期</span>
                  <span class="value">{{ formatDate(detail.deliveryDate) || '-' }}</span>
                </div>
                <div class="view-dialog-mobile-detail-row">
                  <span class="label">出运日期</span>
                  <span class="value">{{ formatDate(detail.shippingDate) || '-' }}</span>
                </div>
                <div class="view-dialog-mobile-detail-row">
                  <span class="label">是否入库</span>
                  <span class="value">{{ detail.isInStock ? '是' : '否' }}</span>
                </div>
                <div class="view-dialog-mobile-detail-row">
                  <span class="label">是否出运</span>
                  <span class="value">{{ detail.isShipped ? '是' : '否' }}</span>
                </div>
                <div class="view-dialog-mobile-detail-row" v-if="detail.costSource">
                  <span class="label">费用出处</span>
                  <span class="value">{{ detail.costSource }}</span>
                </div>
                <div class="view-dialog-mobile-detail-row" v-if="detail.handler">
                  <span class="label">经办人</span>
                  <span class="value">{{ detail.handler }}</span>
                </div>
                <div class="view-dialog-mobile-detail-row" v-if="detail.remark">
                  <span class="label">备注</span>
                  <span class="value">{{ detail.remark }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <el-button @click="viewDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { FormInstance } from 'element-plus'
import {
  ElButton,
  ElCard,
  ElCol,
  ElDatePicker,
  ElDialog,
  ElForm,
  ElFormItem,
  ElInput,
  ElInputNumber,
  ElMessage,
  ElMessageBox,
  ElPagination,
  ElRadioButton,
  ElRadioGroup,
  ElRow,
  ElSelect,
  ElOption,
  ElTable,
  ElTableColumn,
  ElTag,
  ElEmpty
} from 'element-plus'
import {
  getSalesOrdersListApi,
  getSalesOrderByOrderNoApi,
  updateSalesOrderApi,
  createSalesOrderApi,
  generateOrderNoApi,
  deleteSalesOrderApi,
  getSalesOrdersStatisticsApi,
  type SalesOrder,
  type SalesOrderQueryParams,
  type UpdateSalesOrderPayload,
  type CreateSalesOrderPayload,
  type SalesOrderStatistics
} from '@/api/sales-orders'
import { getCustomerListApi, type CustomerInfo } from '@/api/customer'
import { getNewProductsApi, type NewProductInfo } from '@/api/goods'
import { useAppStore } from '@/store/modules/app'

interface OrderQuery {
  searchText: string
  customerName: string
  contractNo: string
  orderDateRange: string[]
}

interface OrderTableRow extends SalesOrder {
  totalQuantity: number
  totalAmount: number
}

type ViewMode = 'table' | 'card' | 'timeline'

interface TimelineGroup {
  date: string
  orders: OrderTableRow[]
}

const appStore = useAppStore()
const isMobile = computed(() => appStore.getMobile)
const route = useRoute()
const router = useRouter()

const resolvePcViewModeFromRoute = (): ViewMode => {
  const v = route.query.view
  if (v === 'table' || v === 'timeline') return v as ViewMode
  return 'timeline'
}

const viewMode = ref<ViewMode>(isMobile.value ? 'card' : resolvePcViewModeFromRoute())
const showMobileFilters = ref(true)
// PC 端表格高度：窗口高度减去顶部/底部区域，数值越小表格越高
// 在原基础上再增加高度：从 300px 调整为 220px
const tableHeight = computed(() => (isMobile.value ? undefined : 'calc(100vh - 220px)'))
const dialogControlWidth = computed(() => (isMobile.value ? '100%' : '280px'))

// 日期格式化
const formatDate = (date: string | Date | null | undefined): string => {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return ''
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const queryForm = reactive<OrderQuery>({
  searchText: '',
  customerName: '',
  contractNo: '',
  orderDateRange: []
})

const pagination = reactive({
  page: 1,
  size: 20
})

const tableRef = ref<InstanceType<typeof ElTable>>()
const tableData = ref<OrderTableRow[]>([])
const total = ref(0)
const loading = ref(false)

const updateViewQuery = (mode: 'table' | 'timeline') => {
  const query = { ...route.query, view: mode }
  router.replace({ path: route.path, query })
}

// PC 端监听路由 query.view，同步到本地 viewMode（供标签页切换使用）
watch(
  () => route.query.view,
  (val) => {
    if (isMobile.value) return
    const mode = val === 'table' || val === 'timeline' ? (val as ViewMode) : 'timeline'
    if (viewMode.value !== mode) {
      viewMode.value = mode
    }
  }
)

watch(isMobile, (mobile) => {
  if (mobile) {
    viewMode.value = 'card'
  } else {
    const next = resolvePcViewModeFromRoute()
    viewMode.value = next
    if (!route.query.view) {
      updateViewQuery(next === 'card' ? 'timeline' : (next as 'table' | 'timeline'))
    }
    showMobileFilters.value = true
  }
})

// 统计数据
const summary = reactive<SalesOrderStatistics>({
  totalOrders: 0,
  totalAmount: 0,
  totalQuantity: 0,
  inStockCount: 0,
  shippedCount: 0,
  notInStockCount: 0,
  notShippedCount: 0,
  yearTotalAmount: 0,
  monthTotalAmount: 0,
  pendingInStock: 0,
  pendingShipped: 0
})

const timelineActiveOrderNo = ref<string | null>(null)
const timelineActiveDetailKey = ref<string | null>(null)

const timelineGroups = computed<TimelineGroup[]>(() => {
  const map = new Map<string, OrderTableRow[]>()
  for (const row of tableData.value) {
    const dateStr = formatDate(row.orderDate) || '未知日期'
    if (!map.has(dateStr)) {
      map.set(dateStr, [])
    }
    map.get(dateStr)!.push(row)
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, orders]) => ({
      date,
      orders: orders.slice().sort((a, b) => a.orderNo.localeCompare(b.orderNo))
    }))
})

// 对话框相关变量
const dialogVisible = ref(false)
const dialogTitle = ref('编辑销售订单')
const dialogFormRef = ref<FormInstance>()
const dialogSubmitting = ref(false)
const currentOrderNo = ref<string | null>(null)
const customerList = ref<CustomerInfo[]>([])
const isCreateMode = ref(false) // 标识是新建模式还是编辑模式

// 查看对话框相关变量
const viewDialogVisible = ref(false)
const viewOrderData = ref<SalesOrder | null>(null)

// 新品选择对话框相关变量
const newProductDialogVisible = ref(false)
const newProductList = ref<NewProductInfo[]>([])
const selectedProducts = ref<NewProductInfo[]>([])
const newProductLoading = ref(false)
const selectedCustomerName = ref<string>('')
const newProductTableRef = ref<InstanceType<typeof ElTable>>()
const dialogForm = reactive<any>({
  orderNo: '',
  orderDate: '',
  signDate: '',
  customerName: '',
  customerId: null,
  contractNo: '',
  details: []
})
const dialogRules = {}

// 记录展开的订单编号集合，用于高亮展开行
const expandedOrderNos = ref<Set<string>>(new Set())

const onExpandChange = (_row: OrderTableRow, expandedRows: OrderTableRow[]) => {
  expandedOrderNos.value = new Set(expandedRows.map((r) => r.orderNo))
}

const rowClassName = ({ row }: { row: OrderTableRow }) => {
  return expandedOrderNos.value.has(row.orderNo) ? 'so-row--expanded' : ''
}

const formatAmount = (value: number | null | undefined): string => {
  return Number(value ?? 0).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

const mapOrderToRow = (order: SalesOrder): OrderTableRow => {
  const sortedDetails = (order.details || [])
    .slice()
    .sort((a, b) => (a.itemCode || '').localeCompare(b.itemCode || ''))

  return {
    ...order,
    details: sortedDetails,
    totalQuantity: order.totalQuantity || 0,
    totalAmount: order.totalAmount || 0
  }
}

const loadData = async () => {
  loading.value = true
  try {
    const params: SalesOrderQueryParams = {
      page: pagination.page,
      pageSize: pagination.size
    }

    // 综合搜索：支持项目编号、订单编号、客户模号、产品图号、产品名称
    if (queryForm.searchText && queryForm.searchText.trim()) {
      params.searchText = queryForm.searchText.trim()
    }

    if (queryForm.customerName && queryForm.customerName.trim()) {
      params.customerName = queryForm.customerName.trim()
    }

    if (queryForm.contractNo && queryForm.contractNo.trim()) {
      params.contractNo = queryForm.contractNo.trim()
    }

    if (queryForm.orderDateRange.length === 2) {
      params.orderDateStart = queryForm.orderDateRange[0]
      params.orderDateEnd = queryForm.orderDateRange[1]
    }

    const response = await getSalesOrdersListApi(params)

    // 统一兼容多种响应结构格式
    const raw: any = response
    const pr: any = raw?.data ?? raw // IResponse.data 或直出
    const list = pr?.data?.list ?? pr?.list ?? []
    const totalCount = pr?.data?.total ?? pr?.total ?? 0

    if (Array.isArray(list)) {
      if (list.length > 0) {
        tableData.value = list.map(mapOrderToRow)
        total.value = Number(totalCount) || 0
      } else {
        tableData.value = []
        total.value = 0
        // 没有数据，但不显示错误消息
      }
    } else {
      tableData.value = []
      total.value = 0
      ElMessage.error(pr?.message || raw?.message || '获取数据失败：响应格式错误')
    }
  } catch (error) {
    console.error('加载数据失败:', error)
    ElMessage.error('加载数据失败')
    tableData.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  pagination.page = 1
  void loadData()
}

const handleReset = () => {
  queryForm.searchText = ''
  queryForm.customerName = ''
  queryForm.contractNo = ''
  queryForm.orderDateRange = []
  pagination.page = 1
  void loadData()
}

const handleSizeChange = (size: number) => {
  pagination.size = size
  pagination.page = 1
  void loadData()
}

const handleCurrentChange = (page: number) => {
  pagination.page = page
  void loadData()
}

// 加载统计信息
const loadStatistics = async () => {
  try {
    const response = await getSalesOrdersStatisticsApi()
    const raw: any = response
    const pr: any = raw?.data ?? raw
    const data = pr?.data ?? pr

    if (data) {
      summary.totalOrders = data.totalOrders || 0
      summary.totalAmount = data.totalAmount || 0
      summary.totalQuantity = data.totalQuantity || 0
      summary.inStockCount = data.inStockCount || 0
      summary.shippedCount = data.shippedCount || 0
      summary.notInStockCount = data.notInStockCount || 0
      summary.notShippedCount = data.notShippedCount || 0
      summary.yearTotalAmount = data.yearTotalAmount || 0
      summary.monthTotalAmount = data.monthTotalAmount || 0
      summary.pendingInStock = data.pendingInStock || 0
      summary.pendingShipped = data.pendingShipped || 0

      appStore.setSalesOrdersSummary({
        yearTotalAmount: summary.yearTotalAmount,
        monthTotalAmount: summary.monthTotalAmount,
        pendingInStock: summary.pendingInStock,
        pendingShipped: summary.pendingShipped
      })
    }
  } catch (error) {
    console.error('加载统计信息失败:', error)
  }
}

const setViewOrderData = (orderData: any) => {
  viewOrderData.value = {
    orderNo: orderData.orderNo || '',
    customerId: orderData.customerId || null,
    customerName: orderData.customerName || '',
    orderDate: orderData.orderDate ? formatDate(orderData.orderDate) : '',
    signDate: orderData.signDate ? formatDate(orderData.signDate) : '',
    contractNo: orderData.contractNo || '',
    totalQuantity: orderData.totalQuantity || 0,
    totalAmount: orderData.totalAmount || 0,
    details: (orderData.details || []).map((detail: any) => ({
      id: detail.id,
      itemCode: detail.itemCode || '',
      productName: detail.productName || '',
      productDrawingNo: detail.productDrawingNo || '',
      customerPartNo: detail.customerPartNo || '',
      quantity: detail.quantity || 0,
      unitPrice: detail.unitPrice || 0,
      totalAmount: detail.totalAmount || 0,
      deliveryDate: detail.deliveryDate ? formatDate(detail.deliveryDate) : null,
      remark: detail.remark || '',
      costSource: detail.costSource || '',
      handler: detail.handler || '',
      isInStock: detail.isInStock || false,
      isShipped: detail.isShipped || false,
      shippingDate: detail.shippingDate ? formatDate(detail.shippingDate) : null
    }))
  } as SalesOrder
}

const makeTimelineDetailKey = (orderNo: string, detail: any) => {
  const idPart = detail.id != null ? String(detail.id) : ''
  const codePart = detail.itemCode || ''
  return `${orderNo}-${idPart}-${codePart}`
}

const isTimelineActiveDetail = (orderNo: string, detail: any) => {
  if (!timelineActiveDetailKey.value) return false
  return timelineActiveDetailKey.value === makeTimelineDetailKey(orderNo, detail)
}

const viewDetailRowClassName = ({ row }: { row: any }) => {
  if (!viewOrderData.value) return ''
  if (!timelineActiveOrderNo.value || !timelineActiveDetailKey.value) return ''
  const key = makeTimelineDetailKey(viewOrderData.value.orderNo, row)
  return key === timelineActiveDetailKey.value ? 'so-view-detail-row--active' : ''
}

const loadOrderForTimeline = async (orderNo: string) => {
  try {
    if (viewOrderData.value && viewOrderData.value.orderNo === orderNo) {
      return
    }
    loading.value = true
    const response = await getSalesOrderByOrderNoApi(orderNo)
    const raw: any = response
    const pr: any = raw?.data ?? raw
    const orderData = pr?.data ?? pr

    if (!orderData) {
      ElMessage.error('获取订单信息失败')
      return
    }

    setViewOrderData(orderData)
  } catch (error) {
    console.error('加载订单信息失败:', error)
    ElMessage.error('加载订单信息失败')
  } finally {
    loading.value = false
  }
}

const handleTimelineOrderClick = async (order: OrderTableRow) => {
  timelineActiveOrderNo.value = order.orderNo
  timelineActiveDetailKey.value = null
  await loadOrderForTimeline(order.orderNo)
}

const handleTimelineDetailClick = async (order: OrderTableRow, detail: any) => {
  timelineActiveOrderNo.value = order.orderNo
  timelineActiveDetailKey.value = makeTimelineDetailKey(order.orderNo, detail)
  await loadOrderForTimeline(order.orderNo)
}

const buildOrderRowFromView = (): OrderTableRow | null => {
  if (!viewOrderData.value) return null
  return {
    ...(viewOrderData.value as SalesOrder),
    totalQuantity: viewOrderData.value.totalQuantity || 0,
    totalAmount: viewOrderData.value.totalAmount || 0,
    details: viewOrderData.value.details || []
  } as OrderTableRow
}

const handleTimelineEdit = () => {
  const row = buildOrderRowFromView()
  if (!row) return
  void handleEdit(row)
}

const handleTimelineView = () => {
  const row = buildOrderRowFromView()
  if (!row) return
  void handleView(row)
}

const handleTimelineDelete = () => {
  const row = buildOrderRowFromView()
  if (!row) return
  void handleDelete(row)
}

watch(viewMode, (mode) => {
  if (!isMobile.value && (mode === 'table' || mode === 'timeline')) {
    const currentView = route.query.view
    if (currentView !== mode) {
      updateViewQuery(mode)
    }
  }
  if (isMobile.value) return
  if (mode === 'timeline') {
    const first = tableData.value[0]
    if (first) {
      timelineActiveOrderNo.value = first.orderNo
      timelineActiveDetailKey.value = null
      void loadOrderForTimeline(first.orderNo)
    } else {
      timelineActiveOrderNo.value = null
      timelineActiveDetailKey.value = null
      viewOrderData.value = null
    }
  }
  if (mode === 'table') {
    timelineActiveOrderNo.value = null
    timelineActiveDetailKey.value = null
  }
})

watch(tableData, (rows) => {
  if (isMobile.value) return
  if (viewMode.value !== 'timeline') return
  const first = rows[0]
  if (first) {
    timelineActiveOrderNo.value = first.orderNo
    timelineActiveDetailKey.value = null
    void loadOrderForTimeline(first.orderNo)
  } else {
    timelineActiveOrderNo.value = null
    timelineActiveDetailKey.value = null
    viewOrderData.value = null
  }
})

const handleCreate = async () => {
  try {
    isCreateMode.value = true
    dialogTitle.value = '新建销售订单'
    currentOrderNo.value = null

    // 如果客户列表为空，先加载客户列表
    if (customerList.value.length === 0) {
      await loadCustomerList()
    }

    // 生成新的订单编号
    loading.value = true
    const response = await generateOrderNoApi()
    const raw: any = response
    const pr: any = raw?.data ?? raw
    const newOrderNo = pr?.orderNo || ''

    if (!newOrderNo) {
      ElMessage.error('生成订单编号失败')
      return
    }

    // 初始化表单
    dialogForm.orderNo = newOrderNo
    dialogForm.orderDate = formatDate(new Date())
    dialogForm.signDate = ''
    dialogForm.customerId = null
    dialogForm.customerName = ''
    dialogForm.contractNo = ''
    dialogForm.details = []

    dialogVisible.value = true
  } catch (error) {
    console.error('打开新建对话框失败:', error)
    ElMessage.error('打开新建对话框失败')
  } finally {
    loading.value = false
  }
}

const handleView = async (row: OrderTableRow) => {
  try {
    loading.value = true

    // 加载订单完整信息
    const response = await getSalesOrderByOrderNoApi(row.orderNo)
    const raw: any = response
    const pr: any = raw?.data ?? raw
    const orderData = pr?.data ?? pr

    if (!orderData) {
      ElMessage.error('获取订单信息失败')
      return
    }

    // 设置查看数据
    setViewOrderData(orderData)

    viewDialogVisible.value = true
  } catch (error) {
    console.error('加载订单信息失败:', error)
    ElMessage.error('加载订单信息失败')
  } finally {
    loading.value = false
  }
}

// 加载客户列表
const loadCustomerList = async () => {
  try {
    const response = await getCustomerListApi({ pageSize: 1000, status: 'active' })
    const raw: any = response
    const pr: any = raw?.data ?? raw
    const list = pr?.data?.list ?? pr?.list ?? []
    customerList.value = list.filter((c: CustomerInfo) => c.status === 'active')
  } catch (error) {
    console.error('加载客户列表失败:', error)
    customerList.value = []
  }
}

// 客户选择变化时的处理
const handleCustomerChange = (customerId: number | null) => {
  if (customerId) {
    const customer = customerList.value.find((c) => c.id === customerId)
    if (customer) {
      // 检查是否已有明细，如果有明细需要验证客户是否一致
      if (dialogForm.details.length > 0) {
        ElMessage.warning('更改客户将清空已添加的明细，请谨慎操作')
        // 可选：清空明细
        // dialogForm.details = []
      }
      dialogForm.customerName = customer.customerName
    }
  } else {
    dialogForm.customerName = ''
    dialogForm.customerId = null
  }
}

const handleEdit = async (row: OrderTableRow) => {
  try {
    isCreateMode.value = false
    currentOrderNo.value = row.orderNo
    dialogTitle.value = `编辑销售订单 - ${row.orderNo}`
    loading.value = true

    // 如果客户列表为空，先加载客户列表
    if (customerList.value.length === 0) {
      await loadCustomerList()
    }

    // 加载订单完整信息
    const response = await getSalesOrderByOrderNoApi(row.orderNo)
    const raw: any = response
    const pr: any = raw?.data ?? raw
    const orderData = pr?.data ?? pr

    if (!orderData) {
      ElMessage.error('获取订单信息失败')
      return
    }

    // 填充表单数据
    dialogForm.orderNo = orderData.orderNo || ''
    dialogForm.orderDate = orderData.orderDate ? formatDate(orderData.orderDate) : ''
    dialogForm.signDate = orderData.signDate ? formatDate(orderData.signDate) : ''
    dialogForm.customerId = orderData.customerId || null
    dialogForm.customerName = orderData.customerName || ''
    dialogForm.contractNo = orderData.contractNo || ''

    // 填充明细数据
    dialogForm.details = (orderData.details || []).map((detail: any) => ({
      id: detail.id,
      itemCode: detail.itemCode || '',
      productName: detail.productName || '',
      productDrawingNo: detail.productDrawingNo || '',
      customerPartNo: detail.customerPartNo || '',
      quantity: detail.quantity || 0,
      unitPrice: detail.unitPrice || 0,
      totalAmount: detail.totalAmount || 0,
      deliveryDate: detail.deliveryDate ? formatDate(detail.deliveryDate) : null,
      remark: detail.remark || '',
      costSource: detail.costSource || '',
      handler: detail.handler || '',
      isInStock: detail.isInStock || false,
      isShipped: detail.isShipped || false,
      shippingDate: detail.shippingDate ? formatDate(detail.shippingDate) : null
    }))

    dialogVisible.value = true
  } catch (error) {
    console.error('加载订单信息失败:', error)
    ElMessage.error('加载订单信息失败')
  } finally {
    loading.value = false
  }
}

const handleRowDblClick = (row: OrderTableRow) => {
  // 双击打开编辑对话框
  void handleEdit(row)
}

const handleDelete = async (row: OrderTableRow) => {
  try {
    // 显示确认对话框，要求输入 Y
    // 将提示信息分成两行，确保"请输入 Y 确认删除"始终在第二行
    const message = `<div style="line-height: 1.8;">
      <div>确定删除订单 ${row.orderNo} 吗？删除后将无法恢复！</div>
      <div style="margin-top: 8px;">请输入 "Y" 确认删除：</div>
    </div>`

    const { value } = await ElMessageBox.prompt(message, '警告', {
      confirmButtonText: '确定删除',
      cancelButtonText: '取消',
      type: 'warning',
      inputPattern: /^[Yy]$/,
      inputErrorMessage: '请输入字母 Y 才能确认删除',
      dangerouslyUseHTMLString: true
    })

    // 如果用户输入了 Y（不区分大小写），执行删除
    if (value && value.toUpperCase() === 'Y') {
      loading.value = true
      const resp = await deleteSalesOrderApi(row.orderNo)
      const raw: any = resp
      const success = raw?.success ?? raw?.code === 0

      if (success) {
        ElMessage.success(raw?.message || '删除成功')
        await Promise.all([loadData(), loadStatistics()])
      } else {
        ElMessage.error(raw?.message || '删除失败')
      }
    }
  } catch (err: any) {
    // 用户取消或发生错误
    if (err !== 'cancel') {
      console.error('删除订单失败:', err)
      ElMessage.error('删除订单失败')
    }
  } finally {
    loading.value = false
  }
}

// 计算对话框内的合计
const dialogTotals = computed(() => {
  const totalQuantity = (dialogForm.details || []).reduce(
    (sum: number, d: any) => sum + Number(d.quantity || 0),
    0
  )
  const totalAmount = (dialogForm.details || []).reduce(
    (sum: number, d: any) => sum + Number(d.totalAmount || 0),
    0
  )
  return { totalQuantity, totalAmount }
})

const recalcDetailAmount = (detail: any) => {
  const quantity = Number(detail.quantity || 0)
  const unitPrice = Number(detail.unitPrice || 0)
  detail.totalAmount = Number((quantity * unitPrice).toFixed(2))
}

const handleDetailQuantityChange = (detail: any) => {
  recalcDetailAmount(detail)
}

const handleDetailUnitPriceChange = (detail: any) => {
  recalcDetailAmount(detail)
}

const addDetailRow = () => {
  dialogForm.details.push({
    id: Date.now(),
    itemCode: '',
    productName: '',
    productDrawingNo: '',
    customerPartNo: '',
    quantity: 0,
    unitPrice: 0,
    totalAmount: 0,
    deliveryDate: null,
    remark: '',
    costSource: '',
    handler: '',
    isInStock: false,
    isShipped: false,
    shippingDate: null
  })
}

const removeDetailRow = (index: number) => {
  dialogForm.details.splice(index, 1)
}

const submitDialogForm = async () => {
  try {
    if (!dialogForm.orderNo) {
      ElMessage.error('订单编号不能为空')
      return
    }

    if (!dialogForm.customerId) {
      ElMessage.error('请选择客户')
      return
    }

    if (!dialogForm.details || dialogForm.details.length === 0) {
      ElMessage.error('请至少添加一条订单明细')
      return
    }

    // 验证明细行数量必填
    const emptyQuantityRows: number[] = []
    dialogForm.details.forEach((detail: any, index: number) => {
      if (!detail.quantity || detail.quantity <= 0) {
        emptyQuantityRows.push(index + 1)
      }
    })

    if (emptyQuantityRows.length > 0) {
      ElMessage.error(`第 ${emptyQuantityRows.join('、')} 行的数量不能为空或小于等于0`)
      return
    }

    dialogSubmitting.value = true

    if (isCreateMode.value) {
      // 新建模式
      const payload: CreateSalesOrderPayload = {
        orderNo: dialogForm.orderNo,
        orderDate: dialogForm.orderDate || undefined,
        signDate: dialogForm.signDate || undefined,
        contractNo: dialogForm.contractNo || undefined,
        customerId: dialogForm.customerId,
        details: dialogForm.details.map((d: any) => ({
          itemCode: d.itemCode || undefined,
          customerPartNo: d.customerPartNo || null,
          deliveryDate: d.deliveryDate || null,
          totalAmount: Number(d.totalAmount || 0),
          unitPrice: Number(d.unitPrice || 0),
          quantity: Number(d.quantity || 0),
          remark: d.remark || null,
          costSource: d.costSource || null,
          handler: d.handler || null,
          isInStock: !!d.isInStock,
          isShipped: !!d.isShipped,
          shippingDate: d.shippingDate || null
        }))
      }

      const resp = await createSalesOrderApi(payload)
      const raw: any = resp
      // 响应格式：{code: 0, success: true, message: '...', data: {...}}
      const success = raw?.success ?? raw?.code === 0
      if (success) {
        ElMessage.success(raw?.message || '创建成功')
        dialogVisible.value = false
        await Promise.all([loadData(), loadStatistics()])
      } else {
        ElMessage.error(raw?.message || '创建失败')
      }
    } else {
      // 编辑模式
      const payload: UpdateSalesOrderPayload = {
        orderNo: dialogForm.orderNo,
        orderDate: dialogForm.orderDate || undefined,
        signDate: dialogForm.signDate || undefined,
        contractNo: dialogForm.contractNo || undefined,
        customerId: dialogForm.customerId || undefined,
        details: dialogForm.details.map((d: any) => ({
          id: d.id,
          itemCode: d.itemCode || undefined,
          customerPartNo:
            d.customerPartNo !== undefined && d.customerPartNo !== null
              ? d.customerPartNo.trim
                ? d.customerPartNo.trim()
                : String(d.customerPartNo)
              : '',
          deliveryDate: d.deliveryDate || null,
          totalAmount: Number(d.totalAmount || 0),
          unitPrice: Number(d.unitPrice || 0),
          quantity: Number(d.quantity || 0),
          remark: d.remark || null,
          costSource: d.costSource || null,
          handler: d.handler || null,
          isInStock: !!d.isInStock,
          isShipped: !!d.isShipped,
          shippingDate: d.shippingDate || null
        }))
      }

      const resp = await updateSalesOrderApi(payload)
      const raw: any = resp
      const pr: any = raw?.data ?? raw
      const success = pr?.success ?? pr?.code === 0
      if (success) {
        ElMessage.success(pr?.message || '保存成功')
        dialogVisible.value = false
        await Promise.all([loadData(), loadStatistics()])
      } else {
        ElMessage.error(pr?.message || '保存失败')
      }
    }
  } catch (error) {
    console.error('保存失败:', error)
    ElMessage.error('保存失败')
  } finally {
    dialogSubmitting.value = false
  }
}

const handleDialogClosed = () => {
  dialogForm.orderNo = ''
  dialogForm.orderDate = ''
  dialogForm.signDate = ''
  dialogForm.customerId = null
  dialogForm.customerName = ''
  dialogForm.contractNo = ''
  dialogForm.details = []
  isCreateMode.value = false
  currentOrderNo.value = null
}

// 打开新品选择对话框
const openNewProductDialog = async () => {
  try {
    newProductLoading.value = true
    newProductDialogVisible.value = true
    selectedProducts.value = []

    // 检查订单是否已经选择了客户
    let orderCustomerName = ''
    if (dialogForm.customerId) {
      // 从客户列表中获取客户名称
      const customer = customerList.value.find((c) => c.id === dialogForm.customerId)
      if (customer) {
        orderCustomerName = customer.customerName
        selectedCustomerName.value = orderCustomerName
        ElMessage.info(`订单已选择客户"${orderCustomerName}"，只能选择该客户的货物`)
      }
    } else {
      // 检查明细中是否已有货物（可能是手动输入的）
      // 如果有明细，尝试从货物信息中获取客户
      if (dialogForm.details.length > 0) {
        // 从第一个明细的项目编号查找对应的客户
        const firstDetail = dialogForm.details[0]
        if (firstDetail.itemCode) {
          // 暂时清空限制，后续可以通过itemCode查询
          selectedCustomerName.value = ''
        }
      } else {
        selectedCustomerName.value = ''
      }
    }

    const response = await getNewProductsApi()
    const raw: any = response
    const pr: any = raw?.data ?? raw
    const list = pr?.list ?? []

    newProductList.value = list

    // 如果有客户限制，过滤列表
    if (orderCustomerName && list.length > 0) {
      const filteredList = list.filter((item) => item.customerName === orderCustomerName)
      if (filteredList.length === 0) {
        ElMessage.warning(`没有客户"${orderCustomerName}"的新品货物`)
      }
    }

    if (list.length === 0) {
      ElMessage.info('暂无新品货物')
    }
  } catch (error) {
    console.error('加载新品货物列表失败:', error)
    ElMessage.error('加载新品货物列表失败')
  } finally {
    newProductLoading.value = false
  }
}

// 检查项目编号是否已存在于明细中
const isItemCodeExists = (itemCode: string) => {
  if (!itemCode || !itemCode.trim()) return false
  return dialogForm.details.some((d: any) => d.itemCode === itemCode)
}

// 检查行是否可选
const checkSelectable = (row: NewProductInfo) => {
  // 如果项目编号已存在，不可选
  if (isItemCodeExists(row.itemCode)) {
    return false
  }
  // 如果还没有选择任何客户，所有行都可选
  if (!selectedCustomerName.value) {
    return true
  }
  // 如果已选择客户，只有同一客户的行可选
  return row.customerName === selectedCustomerName.value
}

// 获取行的class名称（用于样式）
const getRowClassName = ({ row }: { row: NewProductInfo }) => {
  if (isItemCodeExists(row.itemCode)) {
    return 'row-disabled'
  }
  return ''
}

// 处理单行选择
const handleProductSelect = (selection: NewProductInfo[], row: NewProductInfo) => {
  const isSelecting = selection.some((item) => item.id === row.id)

  if (isSelecting) {
    // 正在选择这一行
    if (!selectedCustomerName.value) {
      // 第一次选择，记录客户名称
      selectedCustomerName.value = row.customerName || ''
    } else if (row.customerName !== selectedCustomerName.value) {
      // 尝试选择不同客户的产品，阻止并提示
      ElMessage.warning(`只能选择客户"${selectedCustomerName.value}"的货物`)
      // 从选择中移除这个产品
      const index = selection.findIndex((item) => item.id === row.id)
      if (index > -1) {
        selection.splice(index, 1)
      }
      return
    }
  }
}

// 处理新品选择变化
const handleProductSelectionChange = async (selection: NewProductInfo[]) => {
  // 检查是否所有选中的产品都是同一个客户
  if (selection.length > 0) {
    const firstCustomer = selection[0].customerName
    const allSameCustomer = selection.every((item) => item.customerName === firstCustomer)

    if (!allSameCustomer) {
      // 如果有不同客户的产品，过滤掉不同客户的产品
      ElMessage.warning(`只能选择同一个客户的货物`)

      // 保留符合条件的产品
      const validSelection = selection.filter((item) => {
        return !selectedCustomerName.value || item.customerName === selectedCustomerName.value
      })

      // 更新表格选择状态
      await nextTick()
      if (newProductTableRef.value) {
        newProductTableRef.value.clearSelection()
        validSelection.forEach((row) => {
          newProductTableRef.value?.toggleRowSelection(row, true)
        })
      }

      selectedProducts.value = validSelection
      return
    }

    // 更新已选客户
    if (!selectedCustomerName.value) {
      selectedCustomerName.value = firstCustomer || ''
    }

    selectedProducts.value = selection
  } else {
    // 如果取消所有选择，清空客户名称限制
    selectedCustomerName.value = ''
    selectedProducts.value = []
  }
}

// 填充选中的产品到明细行
const fillSelectedProducts = () => {
  if (selectedProducts.value.length === 0) {
    ElMessage.warning('请先选择需要添加的产品')
    return
  }

  // 最终验证：确保所有选中产品都是同一个客户
  const customerName = selectedProducts.value[0]?.customerName
  const allSameCustomer = selectedProducts.value.every((item) => item.customerName === customerName)

  if (!allSameCustomer) {
    ElMessage.error('选中的产品必须是同一个客户，请重新选择')
    return
  }

  // 检查订单是否已经有客户，并且是否与选中产品的客户一致
  if (dialogForm.customerId) {
    const orderCustomer = customerList.value.find((c) => c.id === dialogForm.customerId)
    if (orderCustomer && orderCustomer.customerName !== customerName) {
      ElMessage.error(`订单已选择客户"${orderCustomer.customerName}"，不能添加其他客户的货物`)
      return
    }
  }

  // 检查明细中已有货物的客户（通过已填充的货物推断）
  if (dialogForm.details.length > 0) {
    // 如果订单已经有客户，检查是否一致
    if (dialogForm.customerId) {
      const orderCustomer = customerList.value.find((c) => c.id === dialogForm.customerId)
      if (orderCustomer && orderCustomer.customerName !== customerName) {
        ElMessage.error(
          `订单中已有客户"${orderCustomer.customerName}"的货物，不能添加其他客户的货物`
        )
        return
      }
    }
  }

  // 获取现有明细中的所有项目编号
  const existingItemCodes = new Set(
    dialogForm.details.map((d: any) => d.itemCode).filter((code: string) => code && code.trim())
  )

  // 检查要添加的产品中是否有重复的项目编号
  const duplicateProducts: string[] = []
  const validProducts: NewProductInfo[] = []

  selectedProducts.value.forEach((product) => {
    if (product.itemCode && existingItemCodes.has(product.itemCode)) {
      duplicateProducts.push(product.itemCode)
    } else {
      validProducts.push(product)
    }
  })

  // 如果有重复的项目编号，提示用户
  if (duplicateProducts.length > 0) {
    ElMessage.warning(`以下项目编号已存在，已自动跳过：${duplicateProducts.join('、')}`)
  }

  // 如果没有可添加的产品
  if (validProducts.length === 0) {
    ElMessage.error('所选产品的项目编号都已存在，无法添加')
    return
  }

  // 自动填充客户信息
  if (customerName && !dialogForm.customerId) {
    // 根据客户名称查找客户ID
    const customer = customerList.value.find((c) => c.customerName === customerName)
    if (customer) {
      dialogForm.customerId = customer.id
      dialogForm.customerName = customer.customerName
      ElMessage.success(`已自动选择客户：${customerName}`)
    }
  }

  // 将有效的产品添加到明细列表
  validProducts.forEach((product) => {
    dialogForm.details.push({
      id: Date.now() + Math.random(), // 生成唯一ID
      itemCode: product.itemCode || '',
      productName: product.productName || '',
      productDrawingNo: product.productDrawingNo || '',
      customerPartNo: product.customerPartNo || '',
      quantity: 0,
      unitPrice: 0,
      totalAmount: 0,
      deliveryDate: null,
      remark: product.remarks || '',
      costSource: '',
      handler: '',
      isInStock: false,
      isShipped: false,
      shippingDate: null
    })
  })

  if (validProducts.length > 0) {
    ElMessage.success(`已添加 ${validProducts.length} 条明细`)
  }

  newProductDialogVisible.value = false
  selectedProducts.value = []
  // 注意：不清空 selectedCustomerName，因为订单的客户已确定
}

onMounted(async () => {
  await Promise.all([loadCustomerList(), loadData(), loadStatistics()])
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

  /* 手机端：查询按钮与上方日期选择之间增加一点垂直间距 */
  :deep(.query-form--mobile .query-form__actions) {
    margin-top: 6px;
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

  .so-mobile-card__meta {
    grid-template-columns: repeat(1, minmax(0, 1fr));
  }

  .dialog-form-columns {
    flex-direction: column;
    gap: 12px;
  }

  .dialog-product-summary {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }

  .view-dialog-info-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 2px 0;
  }

  :deep(.so-table .el-table__body-wrapper tbody tr) {
    height: 42px !important;
  }

  :deep(.so-table .el-table__body-wrapper .el-table__cell) {
    padding-top: 6px !important;
    padding-bottom: 6px !important;
  }
}

.query-form {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}

.sales-orders-page {
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

.query-form__actions {
  display: flex;
  margin-right: -16px;
  margin-left: auto;
  justify-content: flex-end;
}

.query-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

:deep(.query-form .el-form-item) {
  /* 默认 inline 表单 item 间距约 20px，这里缩小 10% 左右 */
  margin-right: 18px;
  margin-bottom: 0;
}

.so-row--expanded {
  background-color: #f0f2f5 !important;
}

:deep(.so-view-detail-row--active) td {
  background-color: #ecf5ff !important;
}

:deep(.so-view-detail-row--active) .cell {
  color: #409eff !important;
}

:deep(.el-table__expanded-cell) .so-expanded-wrap {
  padding: 8px;
  background-color: #eef1f6 !important;
}

/* 展开行内明细表表头背景色 */
:deep(.so-expanded-wrap) .el-table__header-wrapper th {
  color: #333;
  background-color: #e6ebf3 !important;
}

.dialog-form-container {
  padding-top: 6px;
}

.dialog-form-columns {
  display: flex;
  gap: 24px;
}

.dialog-form-column {
  flex: 1;
}

.dialog-product-section {
  margin-top: 12px;
}

.dialog-product-summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 8px;
}

.dialog-product-summary__item {
  margin-right: 16px;
}

.view-dialog-section {
  margin-bottom: 16px;
}

.view-dialog-section-title {
  margin: 0;
  font-size: 14px;
}

.view-dialog-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.view-dialog-section-header--timeline {
  align-items: flex-start;
}

.view-dialog-section-main {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.view-dialog-info-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px 16px;
}

.view-dialog-info-label {
  color: #666;
}

.so-timeline-header-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}

.so-dialog-view {
  :deep(.el-dialog__header) {
    padding-top: 6px;
    padding-bottom: 4px;
  }

  :deep(.el-dialog__title) {
    display: none;
  }

  :deep(.el-dialog__body) {
    padding-top: 8px;
  }
}

.view-dialog-info-item--two-line .view-dialog-info-value {
  display: block;
  margin-top: 2px;
  white-space: nowrap;
}

.view-dialog-mobile-basic {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.view-dialog-mobile-basic-main {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 4px;
}

.view-dialog-mobile-order,
.view-dialog-mobile-customer,
.view-dialog-mobile-contract {
  font-size: 13px;
  line-height: 1.4;
}

.view-dialog-mobile-order .label,
.view-dialog-mobile-customer .label,
.view-dialog-mobile-contract .label {
  color: #666;
}

.view-dialog-mobile-order .value,
.view-dialog-mobile-customer .value,
.view-dialog-mobile-contract .value {
  font-weight: 600;
  color: #303133;
}

.view-dialog-info-grid--mobile {
  margin-top: 2px;
}

.view-dialog-info-grid--mobile .view-dialog-info-value {
  white-space: nowrap;
}

/* 手机端：订单基本信息对齐优化 */
.view-dialog-info-grid--mobile .view-dialog-info-item {
  text-align: left;
}

/* 第4项为“总金额”，整体右对齐 */
.view-dialog-info-grid--mobile .view-dialog-info-item:nth-child(4) {
  text-align: right;
}

/* 新品选择对话框 - 已添加的行样式 */
:deep(.row-disabled) {
  color: #999 !important;
  background-color: #f5f5f5 !important;
}

:deep(.row-disabled):hover {
  background-color: #f5f5f5 !important;
}

.summary-card {
  display: flex;
  height: 56px;
  border: none;
  transition: all 0.3s ease;
  align-items: stretch;
}

.desktop-view-bar {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}

.so-timeline-layout {
  display: flex;
  gap: 12px;
  margin-top: 8px;
}

.so-timeline-left {
  flex: 0 0 408px;
  max-height: calc(100vh - 220px);
  padding: 8px;
  overflow: auto;
  background-color: var(--el-bg-color);
  border-radius: 8px;
}

.so-timeline-right {
  flex: 1;
  max-height: calc(100vh - 220px);
  padding: 8px 12px;
  overflow: auto;
  background-color: var(--el-bg-color);
  border-radius: 8px;
}

.so-timeline-date-group + .so-timeline-date-group {
  margin-top: 12px;
}

.so-timeline-date-header {
  margin-bottom: 4px;
  font-weight: 600;
  color: #303133;
}

.so-timeline-order-block {
  padding-left: 10px;
  margin-left: 4px;
  border-left: 2px solid #e4e7ed;
}

.so-timeline-order-header {
  display: flex;
  padding: 6px 8px;
  margin: 4px 0;
  cursor: pointer;
  background-color: #f5f7fa;
  border-radius: 6px;
  justify-content: space-between;
  align-items: flex-start;
}

.so-timeline-order-header.is-active {
  background-color: #ecf5ff;
  border: 1px solid #409eff;
}

.so-timeline-order-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 13px;
}

.so-timeline-order-no {
  font-weight: 600;
}

.so-timeline-order-customer {
  font-size: 12px;
  color: #666;
}

.so-timeline-order-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  font-size: 12px;
  color: #666;
}

.so-timeline-order-details {
  padding-bottom: 4px;
  margin-left: 16px;
}

.so-timeline-detail-row {
  padding: 4px 6px;
  margin: 2px 0;
  font-size: 12px;
  cursor: pointer;
  border-radius: 4px;
}

.so-timeline-detail-row:hover {
  background-color: #f5f7fa;
}

.so-timeline-detail-row.is-active {
  background-color: #ecf5ff;
  border: 1px solid #409eff;
}

.so-timeline-detail-main {
  font-weight: 500;
  color: #333;
}

.so-timeline-detail-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 2px;
  color: #666;
}

.so-timeline-detail-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.so-timeline-detail-title {
  font-size: 14px;
  font-weight: 600;
}

.so-timeline-detail-panel-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.so-timeline-empty {
  margin-top: 16px;
}

.so-table-wrapper {
  background: var(--el-bg-color);
  border-radius: 8px;
}

.so-table-wrapper--mobile {
  padding-bottom: 8px;
  overflow-x: auto;
}

.so-table-wrapper--mobile .so-table {
  min-width: 960px;
}

.so-mobile-list {
  display: grid;
  gap: 12px;
}

.so-mobile-card {
  border-radius: 10px;
}

.so-mobile-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}

.so-mobile-card__order {
  font-size: 14px;
  font-weight: 600;
}

.so-mobile-card__date {
  margin-top: 2px;
  font-size: 13px;
  color: #666;
}

.so-mobile-card__customer {
  font-size: 13px;
  color: #666;
}

.so-mobile-card__meta {
  display: grid;
  font-size: 13px;
  color: #555;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px 12px;
}

.so-mobile-card__meta .label {
  margin-right: 4px;
  color: #888;
}

.so-mobile-card__stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin: 8px 0;
}

.so-mobile-card__stats .stat {
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

.so-mobile-card__details {
  padding: 8px 0;
  margin: 8px 0;
  border-top: 1px dashed #e5e6eb;
  border-bottom: 1px dashed #e5e6eb;
}

.detail-row + .detail-row {
  margin-top: 6px;
}

.detail-title {
  font-weight: 600;
  color: #333;
}

.detail-meta {
  display: flex;
  margin-top: 2px;
  font-size: 12px;
  color: #666;
  flex-wrap: wrap;
  gap: 8px;
}

.detail-more {
  margin-top: 8px;
  font-size: 12px;
  color: #888;
}

.so-mobile-card__actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 8px;
}

.dialog-table-wrapper {
  width: 100%;
  padding-bottom: 8px;
  overflow-x: auto;
}

.dialog-mobile-details-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
}

.dialog-mobile-detail-card {
  padding: 8px 10px;
  background-color: #f6f7fb;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
}

.dialog-mobile-detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.dialog-mobile-detail-title {
  font-size: 13px;
  font-weight: 600;
}

.dialog-mobile-detail-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.dialog-mobile-detail-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.dialog-mobile-detail-label {
  font-size: 12px;
  color: #888;
}

.dialog-mobile-detail-text {
  font-size: 13px;
  color: #333;
}

.view-dialog-mobile-details {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
}

.view-dialog-mobile-detail-card {
  padding: 8px 10px;
  background-color: #f6f7fb;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
}

.view-dialog-mobile-detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.view-dialog-mobile-detail-title {
  font-size: 13px;
  font-weight: 600;
}

.view-dialog-mobile-detail-qty {
  font-size: 12px;
  color: #888;
}

.view-dialog-mobile-detail-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
}

.view-dialog-mobile-detail-row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.view-dialog-mobile-detail-row .label {
  color: #888;
}

.view-dialog-mobile-detail-row .value {
  color: #333;
  text-align: right;
}

/* 分页固定在页面底部居中，靠近版权信息区域 */
.pagination-footer {
  position: fixed;
  bottom: 10px;
  left: 50%;
  z-index: 10;
  display: flex;
  transform: translateX(-50%);
  justify-content: center;
}

/* 压缩统计卡片高度，并垂直居中内容 */
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

.summary-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgb(0 0 0 / 10%) !important;
}

/* 当年订单累计金额 - 蓝色 */
.summary-card--year {
  background: linear-gradient(145deg, rgb(64 158 255 / 12%), rgb(64 158 255 / 6%));
}

.summary-card--year .summary-title {
  color: #409eff;
}

.summary-card--year .summary-value {
  color: #409eff;
}

/* 本月订单累计金额 - 绿色 */
.summary-card--month {
  background: linear-gradient(145deg, rgb(103 194 58 / 12%), rgb(103 194 58 / 6%));
}

.summary-card--month .summary-title {
  color: #67c23a;
}

.summary-card--month .summary-value {
  color: #67c23a;
}

/* 待入库 - 橙色 */
.summary-card--pending-in {
  background: linear-gradient(145deg, rgb(230 162 60 / 12%), rgb(230 162 60 / 6%));
}

.summary-card--pending-in .summary-title {
  color: #e6a23c;
}

.summary-card--pending-in .summary-value {
  color: #e6a23c;
}

/* 待出运 - 紫色 */
.summary-card--pending-out {
  background: linear-gradient(145deg, rgb(144 147 153 / 12%), rgb(144 147 153 / 6%));
}

.summary-card--pending-out .summary-title {
  color: #909399;
}

.summary-card--pending-out .summary-value {
  color: #909399;
}

.summary-title {
  font-size: 13px;
  font-weight: 500;
  line-height: 18px;
}

.summary-value {
  margin-top: 2px;
  font-size: 20px;
  font-weight: 600;
  line-height: 24px;
}

/* 表格所有单元格内容不换行，超出宽度省略显示 */
:deep(.so-table .el-table__cell .cell),
:deep(.so-table .el-table__cell .cell span),
:deep(.so-table .el-table__cell .cell div) {
  white-space: nowrap !important;
}

/* 销售订单表格中，显式控制不换行省略显示的单元格 */
:deep(.so-cell-nowrap) {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap !important;
}

/* 销售订单操作按钮布局，与项目信息页面风格统一（有背景色的小按钮） */
.so-operation-buttons {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

/* 控制销售订单表数据行整体高度，使在固定表高下正好显示 20 行 */
:deep(.so-table .el-table__body-wrapper tbody tr) {
  height: 20px !important;
}

/* 进一步减小单元格内边距，配合行高压缩 */
:deep(.so-table .el-table__body-wrapper .el-table__cell) {
  padding-top: 1px !important;
  padding-bottom: 1px !important;
}

.pagination-footer--mobile {
  position: static;
  left: auto;
  margin-top: 12px;
  transform: none;
  justify-content: flex-end;
}

/* 查询表单垂直居中对齐 */
</style>
