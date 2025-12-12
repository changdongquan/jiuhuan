<template>
  <div class="pm-page px-4 pt-0 pb-1 space-y-2">
    <div v-if="isMobile" class="mobile-top-bar">
      <div class="mobile-top-bar-left">
        <el-button text type="primary" @click="showMobileFilters = !showMobileFilters">
          {{ showMobileFilters ? '收起筛选' : '展开筛选' }}
        </el-button>
        <el-button text type="primary" @click="showMobileSummary = !showMobileSummary">
          {{ showMobileSummary ? '收起卡片' : '展开卡片' }}
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
    <el-form
      ref="queryFormRef"
      :model="queryForm"
      :label-width="isMobile ? 'auto' : '90px'"
      :label-position="isMobile ? 'top' : 'right'"
      :inline="!isMobile"
      class="query-form rounded-lg bg-[var(--el-bg-color-overlay)] py-2 shadow-sm"
      :class="{ 'query-form--mobile': isMobile }"
      v-show="!isMobile || showMobileFilters"
    >
      <el-form-item label="关键词">
        <el-input
          v-model="queryForm.keyword"
          placeholder="项目编号/产品名称/产品图号/客户模号"
          clearable
          @keydown.enter.prevent="handleSearch"
          :style="{ width: isMobile ? '100%' : '280px' }"
        />
      </el-form-item>
      <el-form-item label="项目状态">
        <el-select
          v-model="queryForm.status"
          placeholder="请选择"
          clearable
          :style="{ width: isMobile ? '100%' : '160px' }"
        >
          <el-option
            v-for="item in projectStatusOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="分类">
        <el-select
          v-model="queryForm.category"
          placeholder="请选择"
          clearable
          :style="{ width: isMobile ? '100%' : '160px' }"
        >
          <el-option
            v-for="item in categoryOptions"
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

    <el-row :gutter="16" v-show="!isMobile || showMobileSummary">
      <el-col :xs="24" :sm="12" :lg="6">
        <el-card shadow="hover" class="summary-card summary-card--blue">
          <div class="summary-title">项目总数</div>
          <div class="summary-value">{{
            Math.max(0, (summary.totalProjects || 0) - (summary.completedProjects || 0))
          }}</div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="6">
        <el-card shadow="hover" class="summary-card summary-card--green">
          <div class="summary-title">设计中</div>
          <div class="summary-value">{{ summary.designingProjects }}</div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="6">
        <el-card shadow="hover" class="summary-card summary-card--orange">
          <div class="summary-title">加工中</div>
          <div class="summary-value">{{ summary.processingProjects }}</div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="6">
        <el-card shadow="hover" class="summary-card summary-card--purple">
          <div class="summary-title">已经移模</div>
          <div class="summary-value">{{ summary.completedProjects }}</div>
        </el-card>
      </el-col>
    </el-row>

    <div
      v-if="viewMode === 'table' || !isMobile"
      class="pm-table-wrapper"
      :class="{ 'pm-table-wrapper--mobile': isMobile }"
    >
      <el-table
        ref="tableRef"
        v-loading="loading"
        :data="tableData"
        border
        :height="tableHeight"
        @row-dblclick="handleEdit"
        @sort-change="handleSortChange"
        class="pm-table"
      >
        <el-table-column type="index" label="序号" width="55" align="center" fixed="left" />
        <el-table-column
          prop="项目编号"
          label="项目编号"
          width="145"
          show-overflow-tooltip
          sortable="custom"
          fixed="left"
        />
        <el-table-column
          prop="productName"
          label="产品名称"
          width="130"
          show-overflow-tooltip
          fixed="left"
        >
          <template #header>
            <div class="pm-name-header">
              <span>产品名称</span>
              <el-tooltip v-if="!isMobile" content="展开/折叠图号、模号列" placement="top">
                <span
                  class="pm-column-toggle-icon"
                  @click.stop="showExtraColumns = !showExtraColumns"
                >
                  <Icon
                    :size="16"
                    :icon="
                      showExtraColumns
                        ? 'vi-ant-design:menu-fold-outlined'
                        : 'vi-ant-design:menu-unfold-outlined'
                    "
                  />
                </span>
              </el-tooltip>
            </div>
          </template>
        </el-table-column>
        <el-table-column
          v-if="!isMobile && showExtraColumns"
          prop="productDrawing"
          label="产品图号"
          width="130"
          show-overflow-tooltip
          fixed="left"
        />
        <el-table-column
          v-if="!isMobile && showExtraColumns"
          prop="客户模号"
          label="客户模号"
          width="115"
          show-overflow-tooltip
          fixed="left"
        />
        <el-table-column prop="产品材质" label="产品材质" width="85" show-overflow-tooltip />
        <el-table-column prop="模具穴数" label="模具穴数" width="85" align="center" />
        <el-table-column
          prop="项目状态"
          label="项目状态"
          width="105"
          align="center"
          sortable="custom"
        >
          <template #default="{ row }">
            <el-tag
              :type="getStatusTagType(row.项目状态)"
              size="small"
              class="pm-status-tag pm-status-tag--fixed"
              :class="getStatusTagClass(row.项目状态)"
            >
              {{ row.项目状态 || '-' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="中标日期" label="中标日期" width="110">
          <template #default="{ row }">
            {{ formatDate(row.中标日期) }}
          </template>
        </el-table-column>
        <el-table-column prop="产品3D确认" label="产品3D确认" width="110">
          <template #default="{ row }">
            {{ formatDate(row.产品3D确认) }}
          </template>
        </el-table-column>
        <el-table-column prop="图纸下发日期" label="图纸下发日期" width="110">
          <template #default="{ row }">
            {{ formatDate(row.图纸下发日期) }}
          </template>
        </el-table-column>
        <el-table-column prop="计划首样日期" label="计划首样日期" width="160" sortable="custom">
          <template #default="{ row }">
            <div class="pm-plan-date-cell">
              <span class="pm-plan-date-text">{{ formatDate(row.计划首样日期) }}</span>
              <span class="pm-plan-date-tag">
                <el-tag
                  v-if="isDueSoon(row.计划首样日期)"
                  type="warning"
                  size="small"
                  effect="light"
                  class="pm-due-tag"
                  >{{ daysUntil(row.计划首样日期) }}天</el-tag
                >
                <el-tag
                  v-else-if="isOverdue(row.计划首样日期, row.首次送样日期)"
                  type="danger"
                  size="small"
                  effect="dark"
                  class="pm-due-tag"
                  >-{{ overdueDays(row.计划首样日期, row.首次送样日期) }}天</el-tag
                >
              </span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="首次送样日期" label="首次送样日期" width="110">
          <template #default="{ row }">
            {{ formatDate(row.首次送样日期) }}
          </template>
        </el-table-column>
        <el-table-column prop="移模日期" label="移模日期" width="110" sortable="custom">
          <template #default="{ row }">
            {{ formatDate(row.移模日期) }}
          </template>
        </el-table-column>
        <el-table-column
          prop="进度影响原因"
          label="进度影响原因"
          width="130"
          show-overflow-tooltip
        />
        <el-table-column label="操作" width="130" fixed="right" class-name="pm-op-column">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button type="success" size="small" @click="handleView(row)">查看</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div v-else class="pm-mobile-list" v-loading="loading">
      <el-empty v-if="!tableData.length && !loading" description="暂无项目" />
      <template v-else>
        <el-card v-for="row in tableData" :key="row.项目编号" class="pm-mobile-card" shadow="hover">
          <div class="pm-mobile-card__header">
            <div>
              <div class="pm-mobile-card__code">项目编号：{{ row.项目编号 || '-' }}</div>
              <div class="pm-mobile-card__name">{{ row.productName || '-' }}</div>
            </div>
            <el-tag
              :type="getStatusTagType(row.项目状态)"
              size="small"
              class="pm-status-tag pm-status-tag--fixed"
              :class="getStatusTagClass(row.项目状态)"
            >
              {{ row.项目状态 || '未知' }}
            </el-tag>
          </div>
          <div class="pm-mobile-card__meta">
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
              <span class="label">穴数</span>
              <span class="value">{{ row.模具穴数 ?? '-' }}</span>
            </div>
          </div>
          <div class="pm-mobile-card__dates">
            <div>
              <span class="label">首样</span>
              <span class="value">
                {{ formatDate(row.计划首样日期) }}
                <el-tag
                  v-if="isDueSoon(row.计划首样日期)"
                  type="warning"
                  size="small"
                  effect="light"
                  style="margin-left: 6px"
                >
                  {{ daysUntil(row.计划首样日期) }}天
                </el-tag>
                <el-tag
                  v-else-if="isOverdue(row.计划首样日期, row.首次送样日期)"
                  type="danger"
                  size="small"
                  effect="dark"
                  style="margin-left: 6px"
                >
                  -{{ overdueDays(row.计划首样日期, row.首次送样日期) }}天
                </el-tag>
              </span>
            </div>
            <div>
              <span class="label">移模</span>
              <span class="value">{{ formatDate(row.移模日期) }}</span>
            </div>
            <div>
              <span class="label">图纸下发</span>
              <span class="value">{{ formatDate(row.图纸下发日期) }}</span>
            </div>
          </div>
          <div v-if="row.进度影响原因" class="pm-mobile-card__impact">
            <span class="label">进度影响</span>
            <span class="value">{{ row.进度影响原因 }}</span>
          </div>
          <div class="pm-mobile-card__actions">
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
        :layout="paginationLayout"
        :current-page="pagination.page"
        :page-size="pagination.size"
        :page-sizes="[10, 15, 20, 30, 50]"
        :total="total"
        :pager-count="paginationPagerCount"
        @size-change="handleSizeChange"
        @current-change="handleCurrentChange"
      />
    </div>

    <!-- 查看详情对话框 -->
    <el-dialog
      v-model="viewDialogVisible"
      title="项目详情"
      :width="isMobile ? '100%' : '1200px'"
      :fullscreen="isMobile"
      class="pm-detail-dialog"
    >
      <div v-if="viewDetailSections.length" class="pm-detail-view">
        <div v-for="section in viewDetailSections" :key="section.title" class="detail-section">
          <div class="detail-section-header">{{ section.title }}</div>
          <div class="detail-grid">
            <div v-for="item in section.items" :key="item.label" class="detail-cell">
              <span class="detail-label">{{ item.label }}</span>
              <span class="detail-value">
                <template v-if="item.tag">
                  <el-tag
                    :type="getStatusTagType(item.value as string)"
                    class="pm-status-tag"
                    :class="getStatusTagClass(item.value as string)"
                  >
                    {{ item.value || '-' }}
                  </el-tag>
                </template>
                <template v-else>
                  {{ item.value || '-' }}
                </template>
              </span>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <el-button @click="viewDialogVisible = false">关闭</el-button>
        <el-button type="primary" @click="handleEditFromView">编辑</el-button>
      </template>
    </el-dialog>

    <!-- 编辑对话框 -->
    <el-dialog
      v-model="editDialogVisible"
      :title="editTitle"
      :width="isMobile ? '100%' : '1200px'"
      :fullscreen="isMobile"
      :close-on-click-modal="false"
      class="pm-edit-dialog"
      @closed="handleEditDialogClosed"
    >
      <div ref="editDialogBodyRef" class="pm-edit-body" :style="editDialogBodyStyle">
        <!-- 顶部关键信息（在最上方） -->
        <div class="pm-edit-header">
          <div class="pm-edit-header-main">
            <span class="pm-edit-header-code">{{
              editForm.项目编号 || currentProjectCode || '新项目'
            }}</span>
            <el-tag
              v-if="editForm.项目状态"
              :type="getStatusTagType(editForm.项目状态)"
              size="small"
              class="pm-edit-header-status pm-status-tag"
              :class="getStatusTagClass(editForm.项目状态)"
            >
              {{ editForm.项目状态 }}
            </el-tag>
          </div>
          <div class="pm-edit-header-sub">
            <span class="pm-edit-header-name">{{ editForm.productName || '-' }}</span>
            <span v-if="editForm.productDrawing" class="pm-edit-header-product">
              产品图号：{{ editForm.productDrawing }}
            </span>
            <span v-if="editForm.客户模号" class="pm-edit-header-product">
              客户模号：{{ editForm.客户模号 }}
            </span>
          </div>
        </div>

        <!-- 表单区域：页签 + 详细信息 -->
        <el-form
          ref="editFormRef"
          :model="editForm"
          :rules="editRules"
          :label-width="isMobile ? '100px' : '120px'"
          class="edit-form-container"
        >
          <div class="pm-edit-tabs-wrapper">
            <el-tabs v-model="editActiveTab" class="pm-edit-tabs" tab-position="top">
              <el-tab-pane name="basic">
                <template #label>
                  基本信息
                  <span v-if="basicTabCompleted" class="pm-tab-complete-dot"></span>
                </template>
                <div class="pm-edit-section">
                  <div class="pm-edit-section-title">基本信息</div>
                  <el-row :gutter="isMobile ? 8 : 12" justify="center">
                    <!-- 第1列：项目与客户 -->
                    <el-col :xs="24" :sm="12" :lg="6">
                      <el-form-item label="项目编号" prop="项目编号">
                        <el-input
                          v-model="editForm.项目编号"
                          placeholder="项目编号"
                          :disabled="!!currentProjectCode"
                          @change="handleProjectCodeBlur"
                        />
                      </el-form-item>
                      <el-form-item label="项目状态">
                        <el-select
                          v-model="editForm.项目状态"
                          placeholder="请选择项目状态"
                          clearable
                          style="width: 100%"
                        >
                          <el-option
                            v-for="item in projectStatusOptions"
                            :key="item.value"
                            :label="item.label"
                            :value="item.value"
                          />
                        </el-select>
                      </el-form-item>
                      <el-form-item label="项目名称" prop="项目名称">
                        <el-input v-model="editForm.项目名称" placeholder="项目名称" />
                      </el-form-item>
                      <el-form-item label="设计师">
                        <el-input v-model="editForm.设计师" placeholder="设计师" />
                      </el-form-item>
                      <el-form-item label="客户模号">
                        <el-input v-model="editForm.客户模号" placeholder="客户模号" />
                      </el-form-item>
                      <el-form-item label="制件厂家">
                        <el-input v-model="editForm.制件厂家" placeholder="制件厂家" />
                      </el-form-item>
                    </el-col>

                    <!-- 第2列：关键日期 -->
                    <el-col :xs="24" :sm="12" :lg="6">
                      <el-form-item label="中标日期">
                        <el-date-picker
                          v-model="editForm.中标日期"
                          type="date"
                          value-format="YYYY-MM-DD"
                          placeholder="中标日期"
                          style="width: 100%"
                        />
                      </el-form-item>
                      <el-form-item label="产品3D确认">
                        <el-date-picker
                          v-model="editForm.产品3D确认"
                          type="date"
                          value-format="YYYY-MM-DD"
                          placeholder="产品3D确认"
                          style="width: 100%"
                        />
                      </el-form-item>
                      <el-form-item label="图纸下发日期">
                        <el-date-picker
                          v-model="editForm.图纸下发日期"
                          type="date"
                          value-format="YYYY-MM-DD"
                          placeholder="图纸下发日期"
                          style="width: 100%"
                        />
                      </el-form-item>
                      <el-form-item label="计划首样日期">
                        <el-date-picker
                          v-model="editForm.计划首样日期"
                          type="date"
                          value-format="YYYY-MM-DD"
                          placeholder="计划首样日期"
                          style="width: 100%"
                        />
                      </el-form-item>
                      <el-form-item label="首次送样日期">
                        <el-date-picker
                          v-model="editForm.首次送样日期"
                          type="date"
                          value-format="YYYY-MM-DD"
                          placeholder="首次送样日期"
                          style="width: 100%"
                        />
                      </el-form-item>
                      <el-form-item label="封样时间">
                        <el-date-picker
                          v-model="editForm.封样时间"
                          type="date"
                          value-format="YYYY-MM-DD"
                          placeholder="封样时间"
                          style="width: 100%"
                        />
                      </el-form-item>
                      <el-form-item label="移模日期">
                        <el-date-picker
                          v-model="editForm.移模日期"
                          type="date"
                          value-format="YYYY-MM-DD"
                          placeholder="移模日期"
                          style="width: 100%"
                        />
                      </el-form-item>
                    </el-col>

                    <!-- 第3列：备注 -->
                    <el-col :xs="24" :sm="12" :lg="6">
                      <el-form-item label="进度影响原因">
                        <el-input v-model="editForm.进度影响原因" placeholder="进度影响原因" />
                      </el-form-item>
                      <el-form-item label="备注">
                        <el-input
                          v-model="editForm.备注"
                          type="textarea"
                          :rows="8"
                          placeholder="备注"
                        />
                      </el-form-item>
                    </el-col>
                  </el-row>
                </div>
              </el-tab-pane>

              <el-tab-pane name="part">
                <template #label>
                  零件信息
                  <span v-if="partTabCompleted" class="pm-tab-complete-dot"></span>
                </template>
                <div class="pm-edit-section">
                  <div class="pm-edit-section-title">零件信息</div>
                  <el-row :gutter="isMobile ? 8 : 12" justify="center">
                    <el-col :xs="24" :sm="12" :lg="6">
                      <el-form-item label="产品名称">
                        <el-input
                          v-model="editForm.productName"
                          placeholder="产品名称（自动填充）"
                          readonly
                        />
                      </el-form-item>
                      <el-form-item label="产品图号">
                        <el-input
                          v-model="editForm.productDrawing"
                          placeholder="产品图号（自动填充）"
                          readonly
                        />
                      </el-form-item>
                      <el-form-item label="产品尺寸">
                        <el-input v-model="editForm.产品尺寸" placeholder="产品尺寸" />
                      </el-form-item>
                      <el-form-item label="产品重量（克）">
                        <el-input-number
                          v-model="editForm.产品重量"
                          :min="0"
                          :precision="2"
                          :controls="false"
                          style="width: 100%"
                        />
                      </el-form-item>
                    </el-col>
                    <el-col :xs="24" :sm="12" :lg="6">
                      <el-form-item label="产品材质">
                        <el-input v-model="editForm.产品材质" placeholder="产品材质" />
                      </el-form-item>
                      <el-form-item label="产品颜色">
                        <el-input v-model="editForm.产品颜色" placeholder="产品颜色" />
                      </el-form-item>
                      <el-form-item label="收缩率">
                        <el-input-number
                          v-model="editForm.收缩率"
                          :min="0"
                          :precision="4"
                          :controls="false"
                          style="width: 100%"
                        />
                      </el-form-item>
                      <el-form-item label="料柄重量">
                        <el-input-number
                          v-model="editForm.料柄重量"
                          :min="0"
                          :precision="2"
                          :controls="false"
                          style="width: 100%"
                        />
                      </el-form-item>
                    </el-col>
                  </el-row>
                </div>
              </el-tab-pane>

              <el-tab-pane name="mould">
                <template #label>
                  模具与设备参数
                  <span v-if="mouldTabCompleted" class="pm-tab-complete-dot"></span>
                </template>
                <div class="pm-edit-section">
                  <div class="pm-edit-section-title">模具与设备参数</div>
                  <el-row :gutter="isMobile ? 8 : 12" justify="center">
                    <!-- 第1列：模具信息 -->
                    <el-col :xs="24" :sm="12" :lg="6">
                      <el-form-item label="模具穴数">
                        <el-input v-model="editForm.模具穴数" placeholder="模具穴数" />
                      </el-form-item>
                      <el-form-item label="模具尺寸">
                        <el-input v-model="editForm.模具尺寸" placeholder="模具尺寸" />
                      </el-form-item>
                      <el-form-item label="模具重量（吨）">
                        <el-input-number
                          v-model="editForm.模具重量"
                          :min="0"
                          :precision="2"
                          :controls="false"
                          style="width: 100%"
                        />
                      </el-form-item>
                      <el-form-item label="前模材质">
                        <el-input v-model="editForm.前模材质" placeholder="前模材质" />
                      </el-form-item>
                      <el-form-item label="后模材质">
                        <el-input v-model="editForm.后模材质" placeholder="后模材质" />
                      </el-form-item>
                      <el-form-item label="滑块材质">
                        <el-input v-model="editForm.滑块材质" placeholder="滑块材质" />
                      </el-form-item>
                    </el-col>

                    <!-- 第2列：流道/浇口 -->
                    <el-col :xs="24" :sm="12" :lg="6">
                      <el-form-item label="流道类型">
                        <el-input v-model="editForm.流道类型" placeholder="流道类型" />
                      </el-form-item>
                      <el-form-item label="流道数量">
                        <el-input-number
                          v-model="editForm.流道数量"
                          :min="0"
                          :controls="false"
                          style="width: 100%"
                        />
                      </el-form-item>
                      <el-form-item label="浇口类型">
                        <el-input v-model="editForm.浇口类型" placeholder="浇口类型" />
                      </el-form-item>
                      <el-form-item label="浇口数量">
                        <el-input-number
                          v-model="editForm.浇口数量"
                          :min="0"
                          :controls="false"
                          style="width: 100%"
                        />
                      </el-form-item>
                    </el-col>

                    <!-- 第3列：设备参数 -->
                    <el-col :xs="24" :sm="12" :lg="6">
                      <el-form-item label="机台吨位（吨）">
                        <el-input-number
                          v-model="editForm.机台吨位"
                          :min="0"
                          :controls="false"
                          style="width: 100%"
                        />
                      </el-form-item>
                      <el-form-item label="锁模力">
                        <el-input-number
                          v-model="editForm.锁模力"
                          :min="0"
                          :controls="false"
                          style="width: 100%"
                        />
                      </el-form-item>
                      <el-form-item label="定位圈">
                        <el-input-number
                          v-model="editForm.定位圈"
                          :min="0"
                          :controls="false"
                          style="width: 100%"
                        />
                      </el-form-item>
                      <el-form-item label="容模量">
                        <el-input v-model="editForm.容模量" placeholder="容模量" />
                      </el-form-item>
                      <el-form-item label="拉杆间距">
                        <el-input-number
                          v-model="editForm.拉杆间距"
                          :min="0"
                          :controls="false"
                          style="width: 100%"
                        />
                      </el-form-item>
                      <el-form-item label="成型周期（秒）">
                        <el-input-number
                          v-model="editForm.成型周期"
                          :min="0"
                          :controls="false"
                          style="width: 100%"
                        />
                      </el-form-item>
                    </el-col>
                  </el-row>
                </div>
              </el-tab-pane>
            </el-tabs>
          </div>
        </el-form>
      </div>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="editSubmitting" @click="handleSubmitEdit"
          >保存</el-button
        >
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage, ElRadioButton, ElRadioGroup, ElEmpty } from 'element-plus'
import {
  getProjectListApi,
  getProjectDetailApi,
  createProjectApi,
  updateProjectApi,
  getProjectGoodsApi,
  getProjectStatisticsApi,
  type ProjectInfo
} from '@/api/project'
import { getProductionTaskDetailApi } from '@/api/production-task'
import type { GoodsInfo } from '@/api/goods'
import { useAppStore } from '@/store/modules/app'

const loading = ref(false)
const tableData = ref<Partial<ProjectInfo>[]>([])
const total = ref(0)
const pagination = reactive({ page: 1, size: 20 })
const showExtraColumns = ref(true)
const sortState = reactive({
  prop: '',
  order: '' as '' | 'ascending' | 'descending'
})
const summary = reactive({
  totalProjects: 0,
  t0Projects: 0,
  designingProjects: 0,
  processingProjects: 0,
  surfaceTreatingProjects: 0,
  completedProjects: 0
})

type ViewMode = 'table' | 'card'

const appStore = useAppStore()
const isMobile = computed(() => appStore.getMobile)
const viewMode = ref<ViewMode>(isMobile.value ? 'card' : 'table')
const showMobileFilters = ref(false)
const showMobileSummary = ref(false)
const tableHeight = computed(() => (isMobile.value ? undefined : 'calc(100vh - 300px)'))

// 分页组件布局：PC 端保留完整布局，手机端精简，避免内容被遮挡
const paginationLayout = computed(() =>
  isMobile.value || viewMode.value === 'card'
    ? 'total, prev, pager, next'
    : 'total, sizes, prev, pager, next, jumper'
)

// 分页组件页码数量：手机端减少显示的数字页数，避免横向挤压
const paginationPagerCount = computed(() => (isMobile.value || viewMode.value === 'card' ? 5 : 7))

const queryForm = reactive({ keyword: '', status: '', category: '塑胶模具' })
const categoryOptions = [
  { label: '塑胶模具', value: '塑胶模具' },
  { label: '零件加工', value: '零件加工' },
  { label: '修改模具', value: '修改模具' }
]
const projectStatusOptions = [
  { label: 'T0', value: 'T0' },
  { label: 'T1', value: 'T1' },
  { label: 'T2', value: 'T2' },
  { label: '设计中', value: '设计中' },
  { label: '加工中', value: '加工中' },
  { label: '表面处理', value: '表面处理' },
  { label: '封样', value: '封样' },
  { label: '待移模', value: '待移模' },
  { label: '已经移模', value: '已经移模' }
]

const viewDialogVisible = ref(false)
const viewData = ref<Partial<ProjectInfo>>({})

const editDialogVisible = ref(false)
const editTitle = ref('编辑项目')
const editActiveTab = ref<'basic' | 'part' | 'mould'>('basic')
const editFormRef = ref<FormInstance>()
const editForm = reactive<Partial<ProjectInfo>>({})
const editSubmitting = ref(false)
const currentProjectCode = ref('')
const editDialogBodyRef = ref<HTMLElement>()
const editDialogBaseHeight = ref<number>()

const editDialogBodyStyle = computed(() =>
  editDialogBaseHeight.value
    ? { '--pm-edit-body-fixed-height': `${editDialogBaseHeight.value}px` }
    : {}
)

const setEditDialogBaseHeight = () => {
  const bodyEl = editDialogBodyRef.value
  if (!bodyEl) return

  const viewportLimit = Math.max(window.innerHeight - 80, 320)
  const contentHeight = bodyEl.scrollHeight
  editDialogBaseHeight.value = Math.min(contentHeight, viewportLimit)
}

const isFieldFilled = (value: unknown) => {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.trim().length > 0
  return true
}

const basicTabCompleted = computed(() => {
  // 除了 项目名称、设计师、进度影响原因、备注 以外的“基本信息”字段
  const fields: (keyof ProjectInfo | 'projectName')[] = [
    '项目编号',
    '项目状态',
    '客户模号',
    '制件厂家',
    '中标日期',
    '产品3D确认',
    '图纸下发日期',
    '计划首样日期',
    '首次送样日期',
    '封样时间',
    '移模日期'
  ]
  return fields.every((key) => isFieldFilled((editForm as any)[key]))
})

const partTabCompleted = computed(() => {
  const fields: (keyof ProjectInfo | 'productName' | 'productDrawing')[] = [
    'productName',
    'productDrawing',
    '产品尺寸',
    '产品重量',
    '产品材质',
    '产品颜色',
    '收缩率',
    '料柄重量'
  ]
  return fields.every((key) => isFieldFilled((editForm as any)[key]))
})

const mouldTabCompleted = computed(() => {
  const fields: (keyof ProjectInfo)[] = [
    '模具穴数',
    '模具尺寸',
    '模具重量',
    '前模材质',
    '后模材质',
    '滑块材质',
    '流道类型',
    '流道数量',
    '浇口类型',
    '浇口数量',
    '机台吨位',
    '锁模力',
    '定位圈',
    '容模量',
    '拉杆间距',
    '成型周期'
  ]
  return fields.every((key) => isFieldFilled((editForm as any)[key]))
})

const editRules: FormRules = {
  项目编号: [{ required: true, message: '请输入项目编号', trigger: 'blur' }]
}

watch(isMobile, (mobile) => {
  viewMode.value = mobile ? 'card' : 'table'
  if (!mobile) {
    showMobileFilters.value = true
  }
})

const loadData = async () => {
  loading.value = true
  try {
    const params: any = {
      page: pagination.page,
      pageSize: pagination.size
    }
    if (queryForm.keyword) params.keyword = queryForm.keyword
    if (queryForm.status) params.status = queryForm.status
    if (queryForm.category) params.category = queryForm.category
    if (sortState.prop && sortState.order) {
      params.sortField = sortState.prop
      params.sortOrder = sortState.order === 'ascending' ? 'asc' : 'desc'
    }

    const response: any = await getProjectListApi(params)
    console.log('API Response:', response)

    // 为保证记录完整性，这里不再做前端过滤，全部交给后端根据状态参数处理
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

const handleSortChange = (sort: { prop: string; order: 'ascending' | 'descending' | null }) => {
  sortState.prop = sort.order ? sort.prop : ''
  sortState.order = sort.order || ''
  pagination.page = 1
  loadData()
}

// 加载统计信息
const loadStatistics = async () => {
  try {
    const response: any = await getProjectStatisticsApi()
    if (response?.code === 0 && response?.data) {
      summary.totalProjects = response.data.totalProjects || 0
      summary.t0Projects = response.data.t0Projects || 0
      summary.designingProjects = response.data.designingProjects || 0
      summary.processingProjects = response.data.processingProjects || 0
      summary.surfaceTreatingProjects = response.data.surfaceTreatingProjects || 0
      summary.completedProjects = response.data.completedProjects || 0
    }
  } catch (error) {
    console.error('加载统计信息失败:', error)
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
  queryForm.category = ''
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

const getStatusTagType = (status?: string) => {
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

// 给每个项目状态分配唯一颜色（通过 class 覆盖 el-tag 默认配色）
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

const getStatusTagClass = (status?: string) => {
  if (!status) return ''
  return statusClassMap[status] || ''
}

// 格式化日期，只显示年月日
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

// 格式化值，处理空值显示
const formatValue = (value?: string | number | null) => {
  if (value === null || value === undefined || value === '') return '-'
  if (typeof value === 'number' && value === 0) return '-'
  return value
}

type DetailItem = {
  label: string
  value: string
  tag?: boolean
}

type DetailSection = {
  title: string
  items: DetailItem[]
}

const viewDetailSections = computed<DetailSection[]>(() => {
  const data = viewData.value || {}

  const v = (val?: string | number | null) => {
    const res = formatValue(val)
    return typeof res === 'number' ? String(res) : (res ?? '-')
  }

  const baseInfo: DetailItem[] = [
    { label: '项目编号', value: v(data.项目编号 ?? '') },
    { label: '项目状态', value: v(data.项目状态 ?? ''), tag: true },
    { label: '项目名称', value: v(data.项目名称 ?? '') },
    { label: '产品名称', value: v(data.productName ?? '') },
    { label: '产品图号', value: v(data.productDrawing ?? '') },
    { label: '客户模号', value: v(data.客户模号 ?? '') },
    { label: '制件厂家', value: v(data.制件厂家 ?? '') },
    { label: '进度影响原因', value: v(data.进度影响原因 ?? '') },
    { label: '备注', value: v(data.备注 ?? '') }
  ]

  const productInfo: DetailItem[] = [
    { label: '产品尺寸', value: v(data.产品尺寸 ?? '') },
    { label: '产品重量（克）', value: v(data.产品重量 ?? '') },
    { label: '产品材质', value: v(data.产品材质 ?? '') },
    { label: '产品颜色', value: v(data.产品颜色 ?? '') },
    { label: '收缩率', value: v(data.收缩率 ?? '') },
    { label: '料柄重量', value: v(data.料柄重量 ?? '') }
  ]

  const mouldInfo: DetailItem[] = [
    { label: '模具穴数', value: v(data.模具穴数 ?? '') },
    { label: '模具尺寸', value: v(data.模具尺寸 ?? '') },
    { label: '模具重量（吨）', value: v(data.模具重量 ?? '') },
    { label: '前模材质', value: v(data.前模材质 ?? '') },
    { label: '后模材质', value: v(data.后模材质 ?? '') },
    { label: '滑块材质', value: v(data.滑块材质 ?? '') },
    { label: '流道类型', value: v(data.流道类型 ?? '') },
    { label: '流道数量', value: v(data.流道数量 ?? '') },
    { label: '浇口类型', value: v(data.浇口类型 ?? '') },
    { label: '浇口数量', value: v(data.浇口数量 ?? '') }
  ]

  const equipmentInfo: DetailItem[] = [
    { label: '机台吨位（吨）', value: v(data.机台吨位 ?? '') },
    { label: '锁模力', value: v(data.锁模力 ?? '') },
    { label: '定位圈', value: v(data.定位圈 ?? '') },
    { label: '容模量', value: v(data.容模量 ?? '') },
    { label: '拉杆间距', value: v(data.拉杆间距 ?? '') },
    { label: '成型周期（秒）', value: v(data.成型周期 ?? '') }
  ]

  const dateInfo: DetailItem[] = [
    { label: '中标日期', value: formatDate(data.中标日期 ?? '') },
    { label: '产品3D确认', value: formatDate(data.产品3D确认 ?? '') },
    { label: '图纸下发日期', value: formatDate(data.图纸下发日期 ?? '') },
    { label: '计划首样日期', value: formatDate(data.计划首样日期 ?? '') },
    { label: '首次送样日期', value: formatDate(data.首次送样日期 ?? '') },
    { label: '移模日期', value: formatDate(data.移模日期 ?? '') },
    { label: '封样时间', value: formatDate(data.封样时间 ?? '') }
  ]

  return [
    { title: '基本信息', items: baseInfo },
    { title: '产品信息', items: productInfo },
    { title: '模具信息', items: mouldInfo },
    { title: '设备参数', items: equipmentInfo },
    { title: '时间信息', items: dateInfo }
  ]
})

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

// 是否已经逾期：
// - 如果有首次送样日期：首次送样日期 > 计划首样日期 时视为逾期
// - 如果首次送样日期为空：用系统当前日期与计划首样日期对比，当前日期 > 计划首样日期 时视为逾期
const isOverdue = (planDate?: string | null, firstSampleDate?: string | null) => {
  const plan = normalizeToLocalDate(planDate)
  if (!plan) return false

  const first = normalizeToLocalDate(firstSampleDate)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const compareDate = first || today

  const diffMs = compareDate.getTime() - plan.getTime()
  return diffMs > 0
}

// 逾期天数：
// - 如果有首次送样日期：首次送样日期 - 计划首样日期 的天数差（>0 时取正）
// - 如果首次送样日期为空：系统当前日期 - 计划首样日期 的天数差（>0 时取正）
const overdueDays = (planDate?: string | null, firstSampleDate?: string | null) => {
  const plan = normalizeToLocalDate(planDate)
  if (!plan) return 0

  const first = normalizeToLocalDate(firstSampleDate)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const compareDate = first || today

  const diffMs = compareDate.getTime() - plan.getTime()
  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000))
  return days > 0 ? days : 0
}

const handleView = async (row: Partial<ProjectInfo>) => {
  try {
    const response: any = await getProjectDetailApi(row.项目编号 || '')
    viewData.value = response.data?.data || response.data || row
    viewDialogVisible.value = true
  } catch (error: any) {
    ElMessage.error('获取详情失败')
  }
}

const handleEditFromView = () => {
  viewDialogVisible.value = false
  setTimeout(() => handleEdit(viewData.value), 100)
}

const handleEdit = (row: Partial<ProjectInfo>) => {
  editTitle.value = '编辑项目'
  currentProjectCode.value = row.项目编号 || ''
  Object.assign(editForm, row)

  // 编辑时自动加载货物信息
  if (row.项目编号) {
    handleProjectCodeBlur()
  }

  editDialogVisible.value = true
}

// 监听项目编号变化
watch(
  () => editForm.项目编号,
  (newVal, oldVal) => {
    if (newVal && newVal !== oldVal && !currentProjectCode.value) {
      console.log('项目编号变化:', newVal)
      handleProjectCodeBlur()
    }
  }
)

const handleSubmitEdit = async () => {
  if (!editFormRef.value) return

  try {
    await editFormRef.value.validate()
  } catch {
    return
  }

  // 当项目状态改为“已经移模”时，进行额外业务校验：
  // 1. 必须填写移模日期
  // 2. 对应生产任务的生产状态必须为“已完成”
  if (editForm.项目状态 === '已经移模') {
    if (!editForm.移模日期) {
      ElMessage.error('项目状态为“已经移模”时，必须填写移模日期')
      return
    }

    const projectCode = editForm.项目编号 || currentProjectCode.value
    if (!projectCode) {
      ElMessage.error('项目编号不能为空，无法校验生产任务状态')
      return
    }

    try {
      const response: any = await getProductionTaskDetailApi(projectCode)
      const taskData = response?.data?.data || response?.data || null

      if (!taskData) {
        ElMessage.error('未找到对应的生产任务，无法将项目状态设置为“已经移模”')
        return
      }

      const taskStatus = taskData.生产状态
      if (taskStatus !== '已完成') {
        ElMessage.error('生产任务状态必须为“已完成”才能将项目状态设置为“已经移模”')
        return
      }
    } catch (error: any) {
      ElMessage.error('校验生产任务状态失败，暂不能将项目状态设置为“已经移模”')
      return
    }
  }

  editSubmitting.value = true
  try {
    if (currentProjectCode.value) {
      // 过滤掉 productName 和 productDrawing，这两个字段不属于项目管理表
      const { productName, productDrawing, ...updateData } = editForm
      await updateProjectApi(currentProjectCode.value, updateData)
      ElMessage.success('更新成功')
    } else {
      // 确保项目编号存在
      if (!editForm.项目编号) {
        ElMessage.error('项目编号不能为空')
        return
      }
      // 过滤掉 productName 和 productDrawing
      const { productName, productDrawing, ...createData } = editForm
      await createProjectApi(createData as ProjectInfo)
      ElMessage.success('创建成功')
    }
    editDialogVisible.value = false
    loadData()
    loadStatistics()
  } catch (error: any) {
    ElMessage.error('保存失败: ' + (error.message || '未知错误'))
  } finally {
    editSubmitting.value = false
  }
}

const handleProjectCodeBlur = async () => {
  const projectCode = editForm.项目编号
  if (!projectCode) {
    console.log('项目编号为空')
    return
  }

  console.log('开始获取货物信息，项目编号:', projectCode)

  try {
    const response: any = await getProjectGoodsApi(projectCode)
    console.log('获取货物信息响应:', response)

    // 兼容不同的响应结构
    let goodsData: GoodsInfo | null = null
    if (response?.data?.data) {
      goodsData = response.data.data
    } else if (response?.data) {
      goodsData = response.data
    }

    console.log('提取的货物数据:', goodsData)

    if (goodsData) {
      // 使用 Object.assign 确保响应式更新
      Object.assign(editForm, {
        productName: goodsData.productName || '',
        productDrawing: goodsData.productDrawing || ''
      } as Partial<ProjectInfo>)

      console.log('填充后的 editForm:', editForm)
      console.log('productName:', editForm.productName, 'productDrawing:', editForm.productDrawing)
    } else {
      console.log('未找到货物信息')
      // 清空产品信息
      editForm.productName = ''
      editForm.productDrawing = ''
    }

    if (editDialogVisible.value) {
      nextTick(() => setEditDialogBaseHeight())
    }
  } catch (error) {
    console.error('获取货物信息失败:', error)
    editForm.productName = ''
    editForm.productDrawing = ''
  }
}

const handleEditDialogClosed = () => {
  editFormRef.value?.resetFields()
  Object.keys(editForm).forEach((key) => delete (editForm as any)[key])
  currentProjectCode.value = ''
}

watch(
  () => editDialogVisible.value,
  (visible) => {
    if (visible) {
      editActiveTab.value = 'basic'
      nextTick(() => setEditDialogBaseHeight())
    } else {
      editDialogBaseHeight.value = undefined
    }
  }
)

onMounted(() => {
  loadData()
  loadStatistics()
})
</script>

<style scoped>
@media (width <= 1200px) {
  .detail-grid {
    flex-wrap: wrap;
    background: transparent;
    border: none;
    border-radius: 0;
    box-shadow: none;
  }

  .detail-grid-col {
    flex: 0 0 50%;
    max-width: 50%;
    background: transparent;
    border-right: 1px solid #e4e7ed;
    border-bottom: 1px solid #e4e7ed;
  }

  .detail-cell {
    min-height: 40px;
    padding: 6px 8px;
  }

  .detail-label {
    flex: 0 0 90px;
    font-size: 12px;
  }

  .detail-value {
    font-size: 13px;
  }

  /* 每行右侧列去掉右边框，避免双线 */
  .detail-grid-col:nth-child(2n) {
    border-right: none;
  }

  /* 最后一行两列去掉下边框 */
  .detail-grid-col:nth-last-child(-n + 2) {
    border-bottom: none;
  }

  .detail-row-remark {
    background: transparent;
    border: none;
    border-radius: 0;
    box-shadow: none;
  }

  :deep(.el-dialog__body) {
    padding-right: 8px;
    padding-left: 8px;
  }
}

@media (width <= 768px) {
  /* 手机端项目详情对话框：尽量铺满且减少边距 */
  :deep(.el-dialog__body) {
    padding: 8px 4px 12px;
  }

  .detail-grid {
    width: 100%;
    border-right: none;
    border-left: none;
    border-radius: 0;
    box-shadow: none;
  }

  .detail-cell {
    min-height: 40px;
    padding: 6px 4px;
  }

  .detail-label {
    flex: 0 0 70px;
    font-size: 12px;
  }

  .detail-value {
    overflow: hidden;
    font-size: 13px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .detail-row-remark {
    border-right: none;
    border-left: none;
    border-radius: 0;
    box-shadow: none;
  }

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

  .pm-mobile-card__meta {
    grid-template-columns: repeat(1, minmax(0, 1fr));
  }

  .pm-mobile-card__dates {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  :deep(.pm-table .el-table__body-wrapper tbody tr) {
    height: 40px !important;
  }

  :deep(.pm-table .el-table__body-wrapper .el-table__cell) {
    padding-top: 6px !important;
    padding-bottom: 6px !important;
  }
}

/* 手机端详情两列 + 紧凑布局（仅项目详情弹窗） */
@media (width <= 768px) {
  /* 覆盖对话框本身的左右留白，尽量铺满 */
  :deep(.pm-detail-dialog) {
    width: 100% !important;
    max-width: 100% !important;
    margin: 0 !important;
    border-radius: 0;
  }

  /* 让查看弹窗更贴边、减少留白 */
  :deep(.pm-detail-dialog .el-dialog__body) {
    padding: 2px 0 6px;
  }

  :deep(.pm-detail-dialog .el-dialog__header) {
    padding-right: 6px;
    padding-left: 6px;
  }

  :deep(.pm-detail-dialog .el-dialog__footer) {
    padding-right: 6px;
    padding-left: 6px;
  }

  .pm-detail-view {
    gap: 8px;
  }

  .pm-detail-dialog .detail-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }

  .pm-detail-dialog .detail-cell {
    min-height: 22px;
    padding: 2px 4px;
  }

  .pm-detail-dialog .detail-label {
    padding-right: 4px;
    overflow: visible;
    font-size: 11px;
    text-overflow: unset;
    white-space: normal;
    flex: 0 0 auto;
  }

  .pm-detail-dialog .detail-value {
    font-size: 11px;
  }
}

@media (width <= 768px) {
  .query-form__actions {
    margin-top: 8px;
  }
}

/* PC 端编辑弹窗：拉高整体高度并收紧头/脚边距，主体自适应填充 */
@media (width >= 769px) {
  :deep(.pm-edit-dialog .el-dialog) {
    display: flex;
    height: 720px;
    max-height: 720px;
    min-height: 720px;
    margin: auto;
    flex-direction: column;
  }

  :deep(.pm-edit-dialog .el-dialog__body) {
    display: flex;
    min-height: 0;
    padding: 14px 16px;
    overflow: hidden;
    flex: 1;
    flex-direction: column;
  }

  :deep(.pm-edit-dialog .el-dialog__footer) {
    padding: 12px 16px 14px;
  }
}

.query-form {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
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

.pm-page {
  position: relative;
}

/* 编辑弹窗中所有输入框内容左对齐（覆盖默认样式，仅限该弹窗） */
:deep(.pm-edit-dialog .el-input__inner) {
  text-align: left;
}

/* 特别覆盖数字输入框默认居中样式 */
:deep(.pm-edit-dialog .el-input-number .el-input__inner) {
  text-align: left !important;
}

.pm-edit-body {
  display: flex;
  max-height: var(--pm-edit-body-fixed-height, none);
  min-height: var(--pm-edit-body-fixed-height, auto);
  overflow: hidden;
  flex: 1;
  flex-direction: column;
}

.pm-edit-tabs-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

:deep(.pm-edit-tabs) {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

:deep(.pm-edit-tabs .el-tabs__header) {
  order: 0;
}

:deep(.pm-edit-tabs .el-tabs__content) {
  min-height: 0;
  padding-right: 6px;
  overflow: auto;
  order: 1;
  flex: 1;
}

.pm-edit-header {
  display: flex;
  padding: 10px 14px;
  margin-bottom: 12px;
  background: #f5f7fa;
  border-radius: 6px;
  flex-direction: column;
  gap: 4px;
}

.pm-edit-header-main {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pm-edit-header-code {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.pm-edit-header-status {
  margin-left: 4px;
}

.pm-edit-header-sub {
  font-size: 13px;
  color: #606266;
}

.pm-edit-header-name {
  font-weight: 500;
}

.pm-edit-header-product {
  color: #909399;
}

.pm-edit-tabs {
  display: flex;
  height: 100%;
  margin-top: 4px;
  overflow: hidden;
  flex-direction: column;
}

/* 固定 tabs 内容区域高度，确保切换页签时弹窗高度不变 */
:deep(.pm-edit-tabs .el-tabs__content) {
  min-height: 0;
  overflow: hidden auto;
  flex: 1;
}

:deep(.pm-edit-tabs .el-tab-pane) {
  height: 100%;
}

.pm-edit-section {
  padding: 12px 14px 4px;
  margin-bottom: 12px;
  background-color: #fff;
  border: 1px solid #ebeef5;
  border-radius: 8px;
}

.pm-edit-section-title {
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #606266;
}

.pm-tab-complete-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  margin-left: 4px;
  background-color: var(--el-color-success);
  border-radius: 50%;
}

.mobile-top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 2px 6px 0;
}

.mobile-top-bar-left {
  display: flex;
  align-items: center;
  gap: 8px;
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
  margin-left: auto;
}

.query-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.pm-table-wrapper {
  background: var(--el-bg-color);
  border-radius: 8px;
}

.pm-table-wrapper--mobile {
  padding-bottom: 8px;
  overflow-x: auto;
}

.pm-table-wrapper--mobile .pm-table {
  min-width: 960px;
}

.pm-mobile-list {
  display: grid;
  gap: 12px;
}

.pm-mobile-card {
  border-radius: 10px;
}

.pm-mobile-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}

.pm-mobile-card__code {
  font-size: 14px;
  font-weight: 600;
}

.pm-mobile-card__name {
  font-size: 13px;
  color: #666;
}

.pm-name-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.pm-column-toggle-icon {
  display: inline-flex;
  width: 18px;
  height: 18px;
  margin-left: 4px;
  color: var(--el-text-color-placeholder);
  cursor: pointer;
  align-items: center;
  justify-content: center;
}

.pm-column-toggle-icon:hover {
  color: var(--el-color-primary);
}

.pm-mobile-card__meta {
  display: grid;
  font-size: 13px;
  color: #555;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px 12px;
}

.pm-mobile-card__meta .label {
  margin-right: 4px;
  color: #888;
}

.pm-mobile-card__dates {
  display: grid;
  margin: 8px 0;
  font-size: 13px;
  color: #555;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px 10px;
}

.pm-mobile-card__dates .label {
  margin-right: 4px;
  color: #888;
}

.pm-mobile-card__impact {
  margin: 6px 0;
  color: #666;
}

.pm-mobile-card__impact .label {
  margin-right: 6px;
  color: #888;
}

.pm-mobile-card__actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 6px;
}

.pm-plan-date-cell {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.pm-plan-date-text {
  flex: 1;
  min-width: 0;
}

.pm-plan-date-tag {
  flex: 0 0 auto;
  display: flex;
  justify-content: flex-end;
}

.pm-due-tag {
  min-width: 52px;
  text-align: center;
  justify-content: center;
}

.query-form {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}

:deep(.query-form .el-form-item) {
  margin-bottom: 0;
}

.edit-form-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 确保 el-form 不会撑开容器 */
:deep(.edit-form-container.el-form) {
  display: flex;
  height: 100%;
  overflow: hidden;
  flex-direction: column;
}

:deep(.el-descriptions__table) {
  table-layout: fixed;
}

:deep(.el-descriptions__table .el-descriptions__cell) {
  width: 25%;
}

/* 详情查看布局 */
.detail-grid {
  display: flex;
  flex-wrap: wrap;
  overflow: hidden;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgb(0 0 0 / 8%);
  gap: 0;
}

.detail-grid-col {
  max-width: 50%;
  background: linear-gradient(180deg, #fafbfc 0%, #fff 100%);
  border-right: 1px solid #e4e7ed;
  flex: 0 0 50%;
}

.detail-grid-col:last-child {
  border-right: none;
}

.detail-grid-col:nth-child(odd) {
  background: linear-gradient(180deg, #f5f7fa 0%, #fff 100%);
}

.pm-detail-view {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.detail-section {
  overflow: hidden;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.detail-section-header {
  padding: 6px 10px;
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #409eff;
  background-color: #f5f7fa;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.pm-detail-view .detail-grid {
  display: grid;
  background: transparent;
  border: none;
  border-radius: 0;
  box-shadow: none;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0;
}

.detail-cell {
  display: flex;
  min-height: 32px;
  padding: 6px 8px;
  border-right: 1px solid #f0f2f5;
  border-bottom: 1px solid #f0f2f5;
  align-items: center;
}

.detail-label {
  flex: 0 0 130px;
  padding-right: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #606266;
}

.detail-label::after {
  margin-left: 2px;
  color: #c0c4cc;
  content: ':';
}

.detail-value {
  flex: 1;
  font-size: 14px;
  color: #303133;
  word-break: break-word;
}

.detail-value:empty::before {
  font-style: italic;
  color: #c0c4cc;
  content: '-';
}

/* 标签样式优化 */
:deep(.el-tag) {
  font-weight: 500;
  letter-spacing: 0.5px;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgb(0 0 0 / 10%);
}

/* 项目状态颜色覆盖（每个状态独立配色） */
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
  color: #722ed1 !important;
  background-color: rgb(114 46 209 / 12%) !important;
  border-color: rgb(114 46 209 / 45%) !important;
}

:deep(.el-tag.pm-status--processing) {
  color: #1890ff !important;
  background-color: rgb(24 144 255 / 12%) !important;
  border-color: rgb(24 144 255 / 45%) !important;
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

/* 列表里的项目状态统一宽度 */
:deep(.el-tag.pm-status-tag--fixed) {
  display: inline-flex;
  width: 80px;
  text-align: center;
  white-space: nowrap;
  box-sizing: border-box;
  justify-content: center;
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

/* 分页固定在页面底部居中，靠近版权信息区域（与销售订单一致） */
.pagination-footer {
  position: fixed;
  bottom: 10px;
  left: 50%;
  z-index: 10;
  display: flex;
  transform: translateX(-50%);
  justify-content: center;
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

/* 第四个卡片 - 紫色 */
.summary-card--purple {
  background: linear-gradient(145deg, rgb(144 147 153 / 12%), rgb(144 147 153 / 6%));
}

.summary-card--purple .summary-title {
  color: #909399;
}

.summary-card--purple .summary-value {
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

/* 额外覆盖：调整项目管理主表数据行高度，使在固定表高下正好显示 20 行 */
:deep(.pm-table .el-table__body-wrapper tbody tr) {
  height: 22px !important;
}

:deep(.pm-table .el-table__body-wrapper .el-table__cell) {
  padding-top: 2px !important;
  padding-bottom: 2px !important;
}

:deep(.pm-op-column .cell) {
  display: flex;
  justify-content: center;
  padding-right: 2px !important;
  padding-left: 2px !important;
}

.pagination-footer--mobile {
  position: static;
  left: auto;
  margin-top: 12px;
  transform: none;
  justify-content: center;
}

/* 响应式优化 */
</style>
