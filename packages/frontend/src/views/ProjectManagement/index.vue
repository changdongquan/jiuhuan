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
          <el-radio-button v-if="!isMobile" value="timeline">时间轴</el-radio-button>
        </el-radio-group>
      </div>
    </div>
    <!-- 统计卡片：手机端在内容区显示，PC端在顶部工具栏显示 -->
    <el-row :gutter="12" class="pm-summary-row" v-if="isMobile && showMobileSummary">
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
          <el-button @click="externalImportVisible = true">外部导入</el-button>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </div>
      </el-form-item>
    </el-form>

    <ExternalImportDialog v-model="externalImportVisible" @imported="loadData" />

    <!-- PC 时间轴视图 -->
    <div v-if="!isMobile && viewMode === 'timeline'" class="pm-timeline-layout">
      <div class="pm-timeline-left">
        <div v-for="group in projectGroups" :key="group.prefix" class="pm-group-block">
          <div class="pm-group-header">
            <span class="pm-group-label">{{ group.prefix }}</span>
            <span class="pm-group-count">({{ group.projects.length }}个项目)</span>
          </div>
          <div class="pm-project-list">
            <div
              v-for="project in group.projects"
              :key="project.项目编号"
              class="pm-project-card"
              :class="{ 'is-active': timelineActiveProjectCode === project.项目编号 }"
              @click="handleTimelineProjectClick(project)"
            >
              <div class="pm-project-grid">
                <div class="pm-project-field">
                  <span class="pm-field-label">项目编号：</span>
                  <span class="pm-field-value">{{ project.项目编号 || '-' }}</span>
                </div>
                <div class="pm-project-field">
                  <span class="pm-field-label">产品名称：</span>
                  <span class="pm-field-value">{{ project.productName || '-' }}</span>
                </div>
                <div class="pm-project-field">
                  <span class="pm-field-label">产品图号：</span>
                  <span class="pm-field-value">{{ project.productDrawing || '-' }}</span>
                </div>
                <div class="pm-project-field">
                  <span class="pm-field-label">客户模号：</span>
                  <span class="pm-field-value">{{ project.客户模号 || '-' }}</span>
                </div>
                <div class="pm-project-field">
                  <span class="pm-field-label">计划首样：</span>
                  <span class="pm-field-value">
                    {{ formatDate(project.计划首样日期) || '-' }}
                    <el-tag
                      v-if="isDueSoon(project.计划首样日期)"
                      type="warning"
                      size="small"
                      effect="light"
                      class="pm-due-tag"
                    >
                      {{ daysUntil(project.计划首样日期) }}天
                    </el-tag>
                    <el-tag
                      v-else-if="isOverdue(project.计划首样日期, project.首次送样日期)"
                      type="danger"
                      size="small"
                      effect="dark"
                      class="pm-due-tag"
                    >
                      -{{ overdueDays(project.计划首样日期, project.首次送样日期) }}天
                    </el-tag>
                  </span>
                </div>
                <div class="pm-project-field">
                  <span class="pm-field-label">项目状态：</span>
                  <span class="pm-field-value">
                    <el-tag
                      :type="getStatusTagType(project.项目状态)"
                      size="small"
                      class="pm-status-tag"
                      :class="getStatusTagClass(project.项目状态)"
                    >
                      {{ project.项目状态 || '-' }}
                    </el-tag>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div v-if="!projectGroups.length" class="pm-timeline-empty">
          <el-empty>
            <template #description>
              <div>
                <p>当前条件下暂无项目数据</p>
                <p style="margin-top: 8px; font-size: 12px; color: #999">
                  提示：时间轴视图需要产品图号字段有值才能进行分组
                </p>
                <p style="font-size: 12px; color: #999">
                  当前筛选结果：{{ tableData.length }} 条数据，分组数：{{ projectGroups.length }}
                </p>
              </div>
            </template>
          </el-empty>
        </div>
      </div>
      <div class="pm-timeline-right">
        <div v-if="viewProjectData && timelineActiveProjectCode" class="pm-timeline-detail-panel">
          <div class="view-dialog-section">
            <div class="view-dialog-section-header view-dialog-section-header--timeline">
              <div class="view-dialog-section-main">
                <h3 class="view-dialog-section-title">项目基本信息</h3>
                <div class="view-dialog-info-grid">
                  <div class="pm-timeline-basic-image">
                    <template v-if="viewProjectData.零件图示URL">
                      <el-image
                        class="pm-timeline-basic-image__img"
                        :src="toPartImageDisplayUrl(viewProjectData.零件图示URL)"
                        :preview-src-list="[toPartImageDisplayUrl(viewProjectData.零件图示URL)]"
                        :preview-teleported="true"
                        fit="contain"
                      />
                    </template>
                    <div v-else class="pm-timeline-basic-image__empty">暂无图示</div>
                  </div>
                  <div class="view-dialog-info-item">
                    <span class="view-dialog-info-label">项目名称：</span>
                    <span class="view-dialog-info-value">{{
                      viewProjectData.项目名称 || '-'
                    }}</span>
                  </div>
                  <div class="view-dialog-info-item">
                    <span class="view-dialog-info-label">项目编号：</span>
                    <span class="view-dialog-info-value">{{
                      viewProjectData.项目编号 || '-'
                    }}</span>
                  </div>
                  <div class="view-dialog-info-item">
                    <span class="view-dialog-info-label">产品名称：</span>
                    <span class="view-dialog-info-value">{{
                      viewProjectData.productName || '-'
                    }}</span>
                  </div>
                  <div class="view-dialog-info-item">
                    <span class="view-dialog-info-label">产品图号：</span>
                    <span class="view-dialog-info-value">{{
                      viewProjectData.productDrawing || '-'
                    }}</span>
                  </div>
                  <div class="view-dialog-info-item">
                    <span class="view-dialog-info-label">客户模号：</span>
                    <span class="view-dialog-info-value">{{
                      viewProjectData.客户模号 || '-'
                    }}</span>
                  </div>
                  <div class="view-dialog-info-item">
                    <span class="view-dialog-info-label">项目状态：</span>
                    <span class="view-dialog-info-value">{{
                      viewProjectData.项目状态 || '-'
                    }}</span>
                  </div>
                  <div class="view-dialog-info-item">
                    <span class="view-dialog-info-label">制件厂家：</span>
                    <span class="view-dialog-info-value">{{
                      viewProjectData.制件厂家 || '-'
                    }}</span>
                  </div>
                  <div class="view-dialog-info-item">
                    <span class="view-dialog-info-label">计划首样：</span>
                    <span class="view-dialog-info-value">{{
                      formatDate(viewProjectData.计划首样日期) || '-'
                    }}</span>
                  </div>
                  <div class="view-dialog-info-item">
                    <span class="view-dialog-info-label">中标日期：</span>
                    <span class="view-dialog-info-value">{{
                      formatDate(viewProjectData.中标日期) || '-'
                    }}</span>
                  </div>
                  <div class="view-dialog-info-item">
                    <span class="view-dialog-info-label">移模日期：</span>
                    <span class="view-dialog-info-value">{{
                      formatDate(viewProjectData.移模日期) || '-'
                    }}</span>
                  </div>
                  <div class="view-dialog-info-item">
                    <span class="view-dialog-info-label">封样单号：</span>
                    <span class="view-dialog-info-value">{{
                      viewProjectData.封样单号 || '-'
                    }}</span>
                  </div>
                  <div class="view-dialog-info-item">
                    <span class="view-dialog-info-label">进度影响原因：</span>
                    <span class="view-dialog-info-value">{{
                      viewProjectData.进度影响原因 || '-'
                    }}</span>
                  </div>
                  <div class="view-dialog-info-item">
                    <span class="view-dialog-info-label">备注：</span>
                    <span class="view-dialog-info-value">{{ viewProjectData.备注 || '-' }}</span>
                  </div>
                </div>
              </div>
              <div class="pm-timeline-header-actions">
                <el-button type="success" size="small" @click="handleTimelineView">查看</el-button>
                <el-button type="primary" size="small" @click="handleTimelineEdit">编辑</el-button>
              </div>
            </div>
          </div>
          <div v-if="timelineDetailSections.length" class="pm-timeline-detail-content">
            <div
              v-for="section in timelineDetailSections"
              :key="section.title"
              class="pm-timeline-detail-section"
            >
              <h3 class="pm-timeline-detail-section-title">{{ section.title }}</h3>
              <div class="pm-timeline-detail-table-wrapper">
                <table class="pm-timeline-detail-table">
                  <thead>
                    <tr>
                      <th
                        v-for="(item, index) in section.items"
                        :key="index"
                        class="pm-timeline-table-header"
                      >
                        {{ item.label }}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td
                        v-for="(item, index) in section.items"
                        :key="index"
                        class="pm-timeline-table-cell"
                      >
                        <template v-if="item.tag && item.value && item.value !== '-'">
                          <el-tag
                            :type="getStatusTagType(item.value as string)"
                            size="small"
                            class="pm-status-tag"
                            :class="getStatusTagClass(item.value as string)"
                          >
                            {{ item.value || '-' }}
                          </el-tag>
                        </template>
                        <template v-else>
                          {{ item.value || '-' }}
                        </template>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <el-empty v-else description="暂无详情" />
        </div>
        <div v-else class="pm-timeline-detail-panel-empty">
          <el-empty description="请选择左侧分组中的项目" />
        </div>
      </div>
    </div>

    <div
      v-if="viewMode === 'table'"
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
        />
        <el-table-column
          v-if="!isMobile && showExtraColumns"
          prop="客户模号"
          label="客户模号"
          width="115"
          show-overflow-tooltip
        />
        <el-table-column
          v-if="!isMobile && showExtraColumns"
          prop="设计师"
          label="设计师"
          width="90"
          show-overflow-tooltip
        />
        <el-table-column prop="产品材质" label="产品材质" width="85" show-overflow-tooltip />
        <el-table-column prop="模具穴数" label="模具穴数" width="120" align="left">
          <template #default="{ row }">
            <template v-if="row.模具穴数">
              <span>{{ parseCavityExpression(row.模具穴数) }}穴</span>
              <span
                v-if="String(row.模具穴数).includes('+') || String(row.模具穴数).includes('*')"
                style="margin-left: 4px; font-size: 12px; color: #909399"
              >
                ({{ row.模具穴数 }})
              </span>
            </template>
            <span v-else>-</span>
          </template>
        </el-table-column>
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
        <el-table-column prop="封样单号" label="封样单号" width="150" show-overflow-tooltip />
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

    <div v-if="isMobile && viewMode === 'card'" class="pm-mobile-list" v-loading="loading">
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
              <span class="label">设计师</span>
              <span class="value">{{ row.设计师 || '-' }}</span>
            </div>
            <div>
              <span class="label">材质</span>
              <span class="value">{{ row.产品材质 || '-' }}</span>
            </div>
            <div>
              <span class="label">穴数</span>
              <span class="value">
                <template v-if="row.模具穴数">
                  <span>{{ parseCavityExpression(row.模具穴数) }}穴</span>
                  <span
                    v-if="String(row.模具穴数).includes('+') || String(row.模具穴数).includes('*')"
                    style="margin-left: 4px; font-size: 12px; color: #909399"
                  >
                    ({{ row.模具穴数 }})
                  </span>
                </template>
                <span v-else>-</span>
              </span>
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

    <!-- 初始化对话框（编辑前，仅需一次）- 仅当分类为"塑胶模具"时显示 -->
    <ProjectInitDialog
      v-if="isPlasticMould"
      v-model="initDialogVisible"
      :project="editForm"
      :initial-groups="initDialogInitialGroups"
      :is-mobile="isMobile"
      @complete="handleInitComplete"
    />

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
            <div class="pm-edit-header-main-left">
              <span class="pm-edit-header-code">{{
                editForm.项目编号 || currentProjectCode || '新项目'
              }}</span>
              <span class="pm-edit-header-status-label">项目状态</span>
              <el-dropdown
                trigger="click"
                placement="bottom-start"
                popper-class="pm-edit-header-status-dropdown"
                @command="
                  (v) => {
                    editForm.项目状态 = v as any
                  }
                "
              >
                <span class="pm-edit-header-status-trigger">
                  <el-tag
                    :type="getStatusTagType(editForm.项目状态)"
                    class="pm-edit-header-status pm-status-tag pm-edit-header-status-tag"
                    :class="getStatusTagClass(editForm.项目状态)"
                  >
                    {{ editForm.项目状态 || '未设置' }}
                  </el-tag>
                  <span class="pm-edit-header-status-caret">▾</span>
                </span>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item
                      v-for="item in projectStatusOptions"
                      :key="item.value"
                      :command="item.value"
                    >
                      {{ item.label }}
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
            <div class="pm-edit-header-actions pm-edit-header-actions--pair">
              <el-button
                type="primary"
                size="small"
                :loading="trialFormGenerating"
                :disabled="
                  trialFormGenerating ||
                  editSubmitting ||
                  !(editForm.项目编号 || currentProjectCode)
                "
                @click="handleDownloadTrialFormXlsx"
              >
                生成试模单
              </el-button>
              <el-button
                type="primary"
                plain
                size="small"
                :disabled="
                  trialFormGenerating ||
                  editSubmitting ||
                  !(editForm.项目编号 || currentProjectCode)
                "
                @click="handlePrintTrialFormPreview"
              >
                打印试模单
              </el-button>
            </div>
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
                <!-- 左右并排布局：基本信息(3) : 图示(1) -->
                <el-row :gutter="isMobile ? 8 : 12" style="align-items: stretch">
                  <el-col :xs="24" :sm="24" :lg="15">
                    <div class="pm-edit-section">
                      <div class="pm-edit-section-title">基本信息</div>
                      <el-row :gutter="isMobile ? 8 : 12">
                        <!-- 第1列：项目与客户 -->
                        <el-col :xs="24" :sm="12" :lg="12">
                          <el-form-item label="项目名称" prop="项目名称">
                            <el-input v-model="editForm.项目名称" placeholder="项目名称" />
                          </el-form-item>
                          <el-form-item label="设计师">
                            <el-input v-model="editForm.设计师" placeholder="设计师" />
                          </el-form-item>
                          <el-form-item label="客户模号" prop="客户模号">
                            <el-input v-model="editForm.客户模号" placeholder="客户模号" />
                          </el-form-item>
                          <el-form-item label="制件厂家">
                            <el-input v-model="editForm.制件厂家" placeholder="制件厂家" />
                          </el-form-item>
                          <el-form-item label="封样单号">
                            <el-input v-model="editForm.封样单号" placeholder="封样单号" />
                          </el-form-item>
                          <el-form-item label="进度影响原因">
                            <el-input v-model="editForm.进度影响原因" placeholder="进度影响原因" />
                          </el-form-item>
                          <el-form-item label="备注">
                            <el-input
                              v-model="editForm.备注"
                              type="textarea"
                              :autosize="{ minRows: 1, maxRows: 1 }"
                              resize="none"
                              placeholder="备注"
                            />
                          </el-form-item>
                        </el-col>

                        <!-- 第2列：关键日期 -->
                        <el-col :xs="24" :sm="12" :lg="12">
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
                          <el-form-item label="首次送样日期" prop="首次送样日期">
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
                      </el-row>
                    </div>
                  </el-col>

                  <el-col :xs="24" :sm="24" :lg="9">
                    <div class="pm-edit-section">
                      <div class="pm-edit-section-title">图示</div>
                      <div
                        class="pm-part-image-container"
                        tabindex="0"
                        @mousedown="handleFocusPartImageCell"
                        @paste="handlePartImagePaste"
                        @dragover="handlePartImageDragOver"
                        @drop="handlePartImageDrop"
                      >
                        <div v-if="partImageUploading" class="pm-part-image-cell__loading">
                          上传中...
                        </div>
                        <template v-else>
                          <template v-if="editForm.零件图示URL">
                            <el-image
                              class="pm-part-image-thumb"
                              :src="toPartImageDisplayUrl(editForm.零件图示URL)"
                              :preview-src-list="[toPartImageDisplayUrl(editForm.零件图示URL)]"
                              :preview-teleported="true"
                              fit="contain"
                              @error="
                                (e) => {
                                  console.error('[图示预览] 图片加载失败:', e)
                                  console.error('[图示预览] 原始URL:', editForm.零件图示URL)
                                  console.error(
                                    '[图示预览] 显示URL:',
                                    toPartImageDisplayUrl(editForm.零件图示URL)
                                  )
                                }
                              "
                              @load="() => console.log('[图示预览] 图片加载成功')"
                            />
                            <button
                              type="button"
                              class="pm-part-image-remove"
                              @click.stop="handleRemovePartImage"
                            >
                              ×
                            </button>
                            <button
                              type="button"
                              class="pm-part-image-pick"
                              title="选择文件"
                              @click.stop="handlePickPartImage"
                            >
                              ⤒
                            </button>
                          </template>
                          <template v-else>
                            <div class="pm-part-image-empty">
                              <div class="pm-part-image-empty__text">粘贴/拖拽图片</div>
                            </div>
                            <button
                              type="button"
                              class="pm-part-image-pick"
                              title="选择文件"
                              @click.stop="handlePickPartImage"
                            >
                              ⤒
                            </button>
                          </template>
                        </template>
                      </div>
                      <!-- 隐藏的文件输入 -->
                      <input
                        ref="partImageFileInputRef"
                        type="file"
                        accept="image/*"
                        class="pm-part-image-file-input"
                        @change="handlePartImageFileChange"
                      />
                    </div>
                  </el-col>
                </el-row>
              </el-tab-pane>

              <el-tab-pane name="part">
                <template #label>
                  零件信息
                  <span v-if="partTabCompleted" class="pm-tab-complete-dot"></span>
                </template>
                <el-row :gutter="isMobile ? 8 : 12" style="align-items: stretch">
                  <el-col :xs="24" :sm="24" :lg="24">
                    <div class="pm-edit-section">
                      <div class="pm-edit-section-title">零件信息</div>
                      <el-row :gutter="isMobile ? 8 : 12" justify="center">
                        <el-col :xs="24" :sm="12" :lg="6">
                          <el-form-item label="产品材质" prop="产品材质">
                            <el-input v-model="editForm.产品材质" placeholder="产品材质" />
                          </el-form-item>
                        </el-col>

                        <el-col :xs="24" :sm="12" :lg="6">
                          <el-form-item label="产品颜色">
                            <el-input v-model="editForm.产品颜色" placeholder="产品颜色" />
                          </el-form-item>
                        </el-col>

                        <el-col :xs="24" :sm="12" :lg="6">
                          <el-form-item label="收缩率">
                            <el-input-number
                              v-model="editForm.收缩率"
                              :min="0"
                              :precision="4"
                              :controls="false"
                              style="width: 100%"
                            />
                          </el-form-item>
                        </el-col>

                        <el-col :xs="24" :sm="12" :lg="6">
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

                        <el-col :xs="24" :sm="24" :lg="24">
                          <!-- 始终显示产品列表（至少保留 1 行） -->
                          <el-form-item label="产品列表">
                            <div class="pm-product-drawing-list">
                              <el-table
                                :data="productDrawingListDisplay"
                                border
                                size="small"
                                style="width: 100%"
                              >
                                <el-table-column
                                  type="index"
                                  label="序号"
                                  width="60"
                                  align="center"
                                />
                                <el-table-column label="产品图号" min-width="150">
                                  <template #default="{ row, $index }">
                                    <el-input
                                      v-model="row.图号"
                                      :class="{
                                        'pm-cell-input--error': !!row.图号错误,
                                        'pm-cell-input--empty': !String(row.图号 || '').trim()
                                      }"
                                      placeholder="请输入产品图号"
                                      @blur="validateDrawingNumber($index)"
                                      @input="handleDrawingNumberChange($index, $event)"
                                    />
                                    <div v-if="row.图号错误" class="pm-error-text">{{
                                      row.图号错误
                                    }}</div>
                                  </template>
                                </el-table-column>
                                <el-table-column label="产品名称" min-width="160">
                                  <template #default="{ row, $index }">
                                    <el-input
                                      v-model="row.名称"
                                      :class="{
                                        'pm-cell-input--empty': !String(row.名称 || '').trim()
                                      }"
                                      placeholder="请输入产品名称"
                                      @input="handleProductNameChange($index, $event)"
                                    />
                                  </template>
                                </el-table-column>
                                <el-table-column label="产品尺寸" min-width="130">
                                  <template #default="{ row, $index }">
                                    <el-input
                                      v-model="row.尺寸"
                                      :class="{
                                        'pm-cell-input--empty': !String(row.尺寸 || '').trim()
                                      }"
                                      placeholder="请输入产品尺寸"
                                      @input="handleProductSizeChange($index, $event)"
                                    />
                                  </template>
                                </el-table-column>
                                <el-table-column label="产品重量" width="120" align="center">
                                  <template #default="{ row, $index }">
                                    <el-input-number
                                      v-model="row.重量"
                                      :min="0"
                                      :precision="2"
                                      :controls="false"
                                      style="width: 100%"
                                      @input="handleProductWeightChange($index, $event as any)"
                                    />
                                  </template>
                                </el-table-column>
                                <el-table-column label="产品数量" width="110" align="center">
                                  <template #default="{ row, $index }">
                                    <el-input-number
                                      v-model="row.数量"
                                      :min="0"
                                      :precision="0"
                                      :controls="false"
                                      style="width: 100%"
                                      @input="handleProductQtyChange($index, $event as any)"
                                    />
                                  </template>
                                </el-table-column>
                                <el-table-column label="操作" width="80" align="center">
                                  <template #default="{ $index }">
                                    <el-button
                                      type="danger"
                                      link
                                      size="small"
                                      :disabled="productDrawingListDisplay.length <= 1"
                                      @click="deleteDrawingRow($index)"
                                    >
                                      删除
                                    </el-button>
                                  </template>
                                </el-table-column>
                              </el-table>
                              <div style="margin-top: 8px">
                                <el-button type="primary" plain size="small" @click="addDrawingRow">
                                  + 添加行
                                </el-button>
                              </div>
                            </div>
                          </el-form-item>
                        </el-col>
                      </el-row>
                    </div>
                  </el-col>
                </el-row>
              </el-tab-pane>

              <el-tab-pane name="mould">
                <template #label>
                  模具信息
                  <span v-if="mouldTabCompleted" class="pm-tab-complete-dot"></span>
                </template>
                <div class="pm-edit-section">
                  <div class="pm-edit-section-title">模具信息</div>
                  <el-row class="pm-mould-grid-row" :gutter="isMobile ? 8 : 12" justify="center">
                    <el-col :xs="24" :sm="12" :lg="8">
                      <div class="pm-mould-group">
                        <div class="pm-mould-group__title">模具基本</div>
                        <el-form-item label="模具穴数" prop="模具穴数">
                          <el-input
                            v-model="editForm.模具穴数"
                            placeholder="例如：1*4 或 1*2+1*2 或 1*2+1*4"
                          >
                            <template #append>
                              <span
                                v-if="editForm.模具穴数"
                                style="font-size: 12px; color: #606266"
                              >
                                {{ parseCavityExpression(editForm.模具穴数) }}穴
                              </span>
                            </template>
                          </el-input>
                        </el-form-item>
                        <el-form-item label="模具尺寸" prop="模具尺寸">
                          <el-input v-model="editForm.模具尺寸" placeholder="模具尺寸" />
                        </el-form-item>
                        <el-form-item label="模具重量（吨）" prop="模具重量">
                          <el-input-number
                            v-model="editForm.模具重量"
                            :min="0"
                            :precision="2"
                            :controls="false"
                            style="width: 100%"
                          />
                        </el-form-item>
                      </div>
                    </el-col>

                    <el-col :xs="24" :sm="12" :lg="8">
                      <div class="pm-mould-group">
                        <div class="pm-mould-group__title">模具材质</div>
                        <el-form-item label="前模材质" prop="前模材质">
                          <el-autocomplete
                            v-model="frontMouldMaterialModel"
                            placeholder="请输入或选择"
                            clearable
                            :trigger-on-focus="true"
                            highlight-first-item
                            :fetch-suggestions="queryMouldMaterialSuggestions"
                            style="width: 100%"
                            @focus="materialUi.front.focus = true"
                            @blur="materialUi.front.focus = false"
                            @mouseenter="materialUi.front.hover = true"
                            @mouseleave="materialUi.front.hover = false"
                          >
                            <template #suffix>
                              <Icon
                                icon="vi-ep:arrow-down"
                                :size="14"
                                class="pm-autocomplete-caret"
                                v-show="
                                  showMaterialCaret(frontMouldMaterialModel, materialUi.front)
                                "
                                @mousedown.prevent="handleMaterialCaretMouseDown"
                              />
                            </template>
                          </el-autocomplete>
                        </el-form-item>
                        <el-form-item label="后模材质" prop="后模材质">
                          <el-autocomplete
                            v-model="rearMouldMaterialModel"
                            placeholder="请输入或选择"
                            clearable
                            :trigger-on-focus="true"
                            highlight-first-item
                            :fetch-suggestions="queryMouldMaterialSuggestions"
                            style="width: 100%"
                            @focus="materialUi.rear.focus = true"
                            @blur="materialUi.rear.focus = false"
                            @mouseenter="materialUi.rear.hover = true"
                            @mouseleave="materialUi.rear.hover = false"
                          >
                            <template #suffix>
                              <Icon
                                icon="vi-ep:arrow-down"
                                :size="14"
                                class="pm-autocomplete-caret"
                                v-show="showMaterialCaret(rearMouldMaterialModel, materialUi.rear)"
                                @mousedown.prevent="handleMaterialCaretMouseDown"
                              />
                            </template>
                          </el-autocomplete>
                        </el-form-item>
                        <el-form-item label="滑块材质" prop="滑块材质">
                          <el-autocomplete
                            v-model="sliderMouldMaterialModel"
                            placeholder="请输入或选择"
                            clearable
                            :trigger-on-focus="true"
                            highlight-first-item
                            :fetch-suggestions="queryMouldMaterialSuggestions"
                            style="width: 100%"
                            @focus="materialUi.slider.focus = true"
                            @blur="materialUi.slider.focus = false"
                            @mouseenter="materialUi.slider.hover = true"
                            @mouseleave="materialUi.slider.hover = false"
                          >
                            <template #suffix>
                              <Icon
                                icon="vi-ep:arrow-down"
                                :size="14"
                                class="pm-autocomplete-caret"
                                v-show="
                                  showMaterialCaret(sliderMouldMaterialModel, materialUi.slider)
                                "
                                @mousedown.prevent="handleMaterialCaretMouseDown"
                              />
                            </template>
                          </el-autocomplete>
                        </el-form-item>
                      </div>
                    </el-col>

                    <el-col v-if="isPlasticMould" :xs="24" :sm="12" :lg="8">
                      <div class="pm-mould-group pm-mould-group--light">
                        <div class="pm-mould-group__title">抽芯方式</div>
                        <el-form-item
                          v-for="opt in corePullMethodOptions"
                          :key="opt"
                          class="pm-core-pull-item"
                        >
                          <template #label>
                            <el-checkbox
                              class="pm-core-pull-item__checkbox"
                              :model-value="corePullSelected.includes(opt)"
                              @change="(checked) => handleCorePullToggle(opt, checked)"
                            >
                              {{ opt }}
                            </el-checkbox>
                          </template>
                          <el-input-number
                            :ref="(el) => setCorePullQtyInputRef(opt, el)"
                            v-model="corePullQty[opt]"
                            :min="0"
                            :precision="0"
                            :controls="false"
                            :disabled="!corePullSelected.includes(opt)"
                            class="pm-core-pull-item__qty"
                            @change="(v) => handleCorePullQtyChange(opt, v)"
                          />
                        </el-form-item>
                      </div>
                    </el-col>
                  </el-row>

                  <!-- 第二行：流道/浇口 + 顶出/复位 -->
                  <el-row class="pm-mould-grid-row" :gutter="isMobile ? 8 : 12" justify="center">
                    <el-col :xs="24" :sm="12" :lg="8">
                      <div class="pm-mould-group">
                        <div class="pm-mould-group__title">流道 / 浇口</div>
                        <el-form-item label="流道类型" prop="流道类型">
                          <el-select
                            v-model="runnerTypeModel"
                            placeholder="请选择"
                            clearable
                            style="width: 100%"
                          >
                            <el-option
                              v-for="opt in runnerTypeOptions"
                              :key="opt.value"
                              :label="opt.label"
                              :value="opt.value"
                            />
                          </el-select>
                        </el-form-item>
                        <el-form-item
                          label="流道数量"
                          prop="流道数量"
                          :required="!!editForm.流道类型"
                        >
                          <el-input-number
                            v-model="runnerCountModel"
                            :min="0"
                            :precision="0"
                            :disabled="!editForm.流道类型"
                            :controls="false"
                            style="width: 100%"
                            ref="runnerCountInputRef"
                            @change="handleRunnerCountChange"
                          />
                        </el-form-item>
                        <el-form-item label="浇口类型" prop="浇口类型">
                          <el-select
                            v-model="gateTypeModel"
                            placeholder="请选择"
                            clearable
                            style="width: 100%"
                          >
                            <el-option
                              v-for="opt in gateTypeOptions"
                              :key="opt.value"
                              :label="opt.label"
                              :value="opt.value"
                            />
                          </el-select>
                        </el-form-item>
                        <el-form-item
                          label="浇口数量"
                          prop="浇口数量"
                          :required="!!editForm.浇口类型"
                        >
                          <el-input-number
                            v-model="gateCountModel"
                            :min="0"
                            :precision="0"
                            :disabled="!editForm.浇口类型"
                            :controls="false"
                            style="width: 100%"
                            ref="gateCountInputRef"
                            @change="handleGateCountChange"
                          />
                        </el-form-item>
                      </div>
                    </el-col>

                    <el-col v-if="isPlasticMould" :xs="24" :sm="12" :lg="8">
                      <div class="pm-mould-group pm-mould-group--light">
                        <div class="pm-mould-group__title">顶出 / 复位</div>
                        <el-form-item label="顶出类型">
                          <el-checkbox-group v-model="ejectTypeModel" class="pm-multi-options">
                            <el-checkbox v-for="opt in ejectTypeOptions" :key="opt" :label="opt">
                              {{ opt }}
                            </el-checkbox>
                          </el-checkbox-group>
                        </el-form-item>
                        <el-form-item label="顶出方式">
                          <el-checkbox-group v-model="ejectWayModel" class="pm-multi-options">
                            <el-checkbox v-for="opt in ejectWayOptions" :key="opt" :label="opt">
                              {{ opt }}
                            </el-checkbox>
                          </el-checkbox-group>
                        </el-form-item>
                        <el-form-item label="复位方式">
                          <el-checkbox-group v-model="resetWayModel" class="pm-multi-options">
                            <el-checkbox v-for="opt in resetWayOptions" :key="opt" :label="opt">
                              {{ opt }}
                            </el-checkbox>
                          </el-checkbox-group>
                        </el-form-item>
                      </div>
                    </el-col>
                    <el-col v-if="isPlasticMould" :xs="0" :sm="0" :lg="8" />
                  </el-row>
                </div>
              </el-tab-pane>

              <el-tab-pane name="machine">
                <template #label>
                  设备与工艺参数
                  <span v-if="machineTabCompleted" class="pm-tab-complete-dot"></span>
                </template>
                <div class="pm-edit-section">
                  <div class="pm-edit-section-title">设备与工艺参数</div>
                  <el-row :gutter="isMobile ? 8 : 12" justify="center">
                    <el-col :xs="24" :sm="12" :lg="6">
                      <el-form-item label="机台吨位（吨）">
                        <el-select
                          v-model="machineTonnageModel"
                          placeholder="请选择机台吨位"
                          clearable
                          filterable
                          style="width: 100%"
                          @change="handleMachineTonnageChange"
                          @clear="handleMachineTonnageClear"
                        >
                          <el-option
                            v-for="opt in machineTonnageOptions"
                            :key="opt.tonnage"
                            :label="String(opt.tonnage)"
                            :value="opt.tonnage"
                          />
                        </el-select>
                      </el-form-item>
                      <el-form-item label="锁模力" prop="锁模力">
                        <el-input-number
                          v-model="editForm.锁模力"
                          :min="0"
                          :disabled="!machineSpecUnlocked"
                          :controls="false"
                          style="width: 100%"
                        />
                      </el-form-item>
                      <el-form-item label="定位圈" prop="定位圈">
                        <el-input-number
                          v-model="editForm.定位圈"
                          :min="0"
                          :disabled="!machineSpecUnlocked"
                          :controls="false"
                          style="width: 100%"
                        />
                      </el-form-item>
                      <el-form-item label="容模量" prop="容模量">
                        <el-input v-model="editForm.容模量" :disabled="!machineSpecUnlocked" />
                      </el-form-item>
                      <el-form-item label="拉杆间距" prop="拉杆间距">
                        <el-input
                          v-model="editForm.拉杆间距"
                          clearable
                          :disabled="!machineSpecUnlocked"
                        />
                      </el-form-item>
                      <el-form-item label="成型周期（秒）" prop="成型周期">
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

              <el-tab-pane label="附件 1" name="attachments">
                <div class="pm-attachments" v-loading="attachmentLoading">
                  <el-row class="pm-attachments-row" :gutter="isMobile ? 8 : 16">
                    <el-col :xs="24" :sm="12" class="pm-attachment-col">
                      <el-card shadow="never" class="pm-attachment-card">
                        <template #header>
                          <div style="display: flex; justify-content: space-between; gap: 8px">
                            <span>移模流程单</span>
                            <el-upload
                              :action="getAttachmentAction('relocation-process')"
                              :show-file-list="false"
                              accept=".xls,.xlsx,.pdf,image/*"
                              :before-upload="
                                (file) => beforeAttachmentUpload(file, 'relocation-process')
                              "
                              :on-success="handleAttachmentUploadSuccess"
                              :on-error="handleAttachmentUploadError"
                            >
                              <el-button type="primary" size="small">上传移模流程单</el-button>
                            </el-upload>
                          </div>
                        </template>
                        <el-table
                          :data="relocationProcessAttachments"
                          border
                          size="small"
                          style="width: calc(100% - 2px)"
                        >
                          <el-table-column type="index" label="序号" width="42" />
                          <el-table-column prop="storedFileName" label="文件名" min-width="155" />
                          <el-table-column label="大小" width="70" align="right">
                            <template #default="{ row }">{{
                              formatFileSize(row.fileSize)
                            }}</template>
                          </el-table-column>
                          <el-table-column label="上传时间" width="90">
                            <template #default="{ row }">{{ formatDate(row.uploadedAt) }}</template>
                          </el-table-column>
                          <el-table-column label="操作" width="135" align="center">
                            <template #default="{ row }">
                              <el-button
                                v-if="isImageFile(row)"
                                type="primary"
                                link
                                size="small"
                                @click="handleAttachmentPreview(row)"
                              >
                                预览
                              </el-button>
                              <el-button
                                v-if="isPdfFile(row)"
                                type="primary"
                                link
                                size="small"
                                @click="handleAttachmentPdfPreview(row)"
                              >
                                预览
                              </el-button>
                              <el-button
                                type="primary"
                                link
                                size="small"
                                @click="downloadAttachment(row)"
                              >
                                下载
                              </el-button>
                              <el-button
                                type="danger"
                                link
                                size="small"
                                @click="deleteAttachment(row)"
                              >
                                删除
                              </el-button>
                            </template>
                          </el-table-column>
                        </el-table>
                      </el-card>
                    </el-col>

                    <el-col :xs="24" :sm="12" class="pm-attachment-col">
                      <el-card shadow="never" class="pm-attachment-card">
                        <template #header>
                          <div style="display: flex; justify-content: space-between; gap: 8px">
                            <span>试模记录表</span>
                            <el-upload
                              :action="getAttachmentAction('trial-record')"
                              :show-file-list="false"
                              accept=".xls,.xlsx,.pdf,image/*"
                              :before-upload="
                                (file) => beforeAttachmentUpload(file, 'trial-record')
                              "
                              :on-success="handleAttachmentUploadSuccess"
                              :on-error="handleAttachmentUploadError"
                            >
                              <el-button type="primary" size="small">上传试模记录表</el-button>
                            </el-upload>
                          </div>
                        </template>
                        <el-table
                          :data="trialRecordAttachments"
                          border
                          size="small"
                          style="width: calc(100% - 2px)"
                        >
                          <el-table-column type="index" label="序号" width="42" />
                          <el-table-column prop="storedFileName" label="文件名" min-width="155" />
                          <el-table-column label="大小" width="70" align="right">
                            <template #default="{ row }">{{
                              formatFileSize(row.fileSize)
                            }}</template>
                          </el-table-column>
                          <el-table-column label="上传时间" width="90">
                            <template #default="{ row }">{{ formatDate(row.uploadedAt) }}</template>
                          </el-table-column>
                          <el-table-column label="操作" width="135" align="center">
                            <template #default="{ row }">
                              <el-button
                                v-if="isImageFile(row)"
                                type="primary"
                                link
                                size="small"
                                @click="handleAttachmentPreview(row)"
                              >
                                预览
                              </el-button>
                              <el-button
                                v-if="isPdfFile(row)"
                                type="primary"
                                link
                                size="small"
                                @click="handleAttachmentPdfPreview(row)"
                              >
                                预览
                              </el-button>
                              <el-button
                                type="primary"
                                link
                                size="small"
                                @click="downloadAttachment(row)"
                              >
                                下载
                              </el-button>
                              <el-button
                                type="danger"
                                link
                                size="small"
                                @click="deleteAttachment(row)"
                              >
                                删除
                              </el-button>
                            </template>
                          </el-table-column>
                        </el-table>
                      </el-card>
                    </el-col>

                    <el-col :xs="24" :sm="12" class="pm-attachment-col">
                      <el-card shadow="never" class="pm-attachment-card">
                        <template #header>
                          <div style="display: flex; justify-content: space-between; gap: 8px">
                            <span>封样单</span>
                            <el-button
                              type="primary"
                              size="small"
                              :loading="sealSampleGenerating"
                              :disabled="
                                sealSampleGenerating || !(editForm.项目编号 || currentProjectCode)
                              "
                              @click="handleGenerateSealSample"
                            >
                              {{ sealSampleGenerating ? '正在生成...' : '生成封样单' }}
                            </el-button>
                          </div>
                        </template>
                        <el-table
                          :data="sealSampleAttachments"
                          border
                          size="small"
                          style="width: calc(100% - 2px)"
                        >
                          <el-table-column type="index" label="序号" width="42" />
                          <el-table-column prop="storedFileName" label="文件名" min-width="155" />
                          <el-table-column label="大小" width="70" align="right">
                            <template #default="{ row }">{{
                              formatFileSize(row.fileSize)
                            }}</template>
                          </el-table-column>
                          <el-table-column label="上传时间" width="90">
                            <template #default="{ row }">{{ formatDate(row.uploadedAt) }}</template>
                          </el-table-column>
                          <el-table-column label="操作" width="135" align="center">
                            <template #default="{ row }">
                              <el-button
                                v-if="isImageFile(row)"
                                type="primary"
                                link
                                size="small"
                                @click="handleAttachmentPreview(row)"
                              >
                                预览
                              </el-button>
                              <el-button
                                v-if="isPdfFile(row)"
                                type="primary"
                                link
                                size="small"
                                @click="handleAttachmentPdfPreview(row)"
                              >
                                预览
                              </el-button>
                              <el-button
                                type="primary"
                                link
                                size="small"
                                @click="downloadAttachment(row)"
                              >
                                下载
                              </el-button>
                              <el-button
                                type="danger"
                                link
                                size="small"
                                @click="deleteAttachment(row)"
                              >
                                删除
                              </el-button>
                            </template>
                          </el-table-column>
                        </el-table>
                      </el-card>
                    </el-col>

                    <el-col :xs="24" :sm="12" class="pm-attachment-col">
                      <el-card shadow="never" class="pm-attachment-card">
                        <template #header>
                          <div style="display: flex; justify-content: space-between; gap: 8px">
                            <span>三方协议</span>
                            <el-button
                              type="primary"
                              size="small"
                              :loading="tripartiteAgreementDownloading"
                              :disabled="
                                tripartiteAgreementDownloading ||
                                !(editForm.项目编号 || currentProjectCode)
                              "
                              @click="handleGenerateTripartiteAgreement"
                            >
                              {{ tripartiteAgreementDownloading ? '正在生成...' : '生成三方协议' }}
                            </el-button>
                          </div>
                        </template>
                        <el-table
                          :data="tripartiteAgreementAttachments"
                          border
                          size="small"
                          style="width: calc(100% - 2px)"
                        >
                          <el-table-column type="index" label="序号" width="42" />
                          <el-table-column prop="storedFileName" label="文件名" min-width="155" />
                          <el-table-column label="大小" width="70" align="right">
                            <template #default="{ row }">{{
                              formatFileSize(row.fileSize)
                            }}</template>
                          </el-table-column>
                          <el-table-column label="上传时间" width="90">
                            <template #default="{ row }">{{ formatDate(row.uploadedAt) }}</template>
                          </el-table-column>
                          <el-table-column label="操作" width="135" align="center">
                            <template #default="{ row }">
                              <el-button
                                v-if="isImageFile(row)"
                                type="primary"
                                link
                                size="small"
                                @click="handleAttachmentPreview(row)"
                              >
                                预览
                              </el-button>
                              <el-button
                                v-if="isPdfFile(row)"
                                type="primary"
                                link
                                size="small"
                                @click="handleAttachmentPdfPreview(row)"
                              >
                                预览
                              </el-button>
                              <el-button
                                type="primary"
                                link
                                size="small"
                                @click="downloadAttachment(row)"
                              >
                                下载
                              </el-button>
                              <el-button
                                type="danger"
                                link
                                size="small"
                                @click="deleteAttachment(row)"
                              >
                                删除
                              </el-button>
                            </template>
                          </el-table-column>
                        </el-table>
                      </el-card>
                    </el-col>
                  </el-row>
                </div>
              </el-tab-pane>

              <el-tab-pane label="附件 2" name="attachments2">
                <!-- 生产任务附件 -->
                <div
                  class="pm-production-task-attachments"
                  v-loading="productionTaskAttachmentLoading"
                >
                  <el-row class="pm-attachments-row" :gutter="isMobile ? 8 : 16">
                    <el-col :xs="24" :sm="12" class="pm-attachment-col">
                      <el-card shadow="never" class="pm-attachment-card">
                        <template #header>
                          <div style="display: flex; justify-content: space-between; gap: 8px">
                            <span>照片</span>
                          </div>
                        </template>

                        <div style="margin: 4px 0 8px; font-weight: 600">模具外观</div>
                        <el-table
                          :data="productionTaskPhotoAppearanceAttachments"
                          border
                          size="small"
                          style="width: calc(100% - 2px); margin-bottom: 12px"
                        >
                          <el-table-column type="index" label="序号" width="42" />
                          <el-table-column prop="storedFileName" label="文件名" min-width="155" />
                          <el-table-column label="大小" width="70" align="right">
                            <template #default="{ row }">{{
                              formatFileSize(row.fileSize)
                            }}</template>
                          </el-table-column>
                          <el-table-column label="上传时间" width="90">
                            <template #default="{ row }">{{ formatDate(row.uploadedAt) }}</template>
                          </el-table-column>
                          <el-table-column label="操作" width="135" align="center">
                            <template #default="{ row }">
                              <el-button
                                v-if="isProductionTaskImageFile(row)"
                                type="primary"
                                link
                                size="small"
                                @click="handleProductionTaskAttachmentPreview(row)"
                              >
                                预览
                              </el-button>
                              <el-button
                                v-if="isProductionTaskPdfFile(row)"
                                type="primary"
                                link
                                size="small"
                                @click="handleProductionTaskAttachmentPdfPreview(row)"
                              >
                                预览
                              </el-button>
                              <el-button
                                type="primary"
                                link
                                size="small"
                                @click="downloadProductionTaskAttachment(row)"
                              >
                                下载
                              </el-button>
                            </template>
                          </el-table-column>
                        </el-table>

                        <div style="margin: 4px 0 8px; font-weight: 600">模具铭牌</div>
                        <el-table
                          :data="productionTaskPhotoNameplateAttachments"
                          border
                          size="small"
                          style="width: calc(100% - 2px)"
                        >
                          <el-table-column type="index" label="序号" width="42" />
                          <el-table-column prop="storedFileName" label="文件名" min-width="155" />
                          <el-table-column label="大小" width="70" align="right">
                            <template #default="{ row }">{{
                              formatFileSize(row.fileSize)
                            }}</template>
                          </el-table-column>
                          <el-table-column label="上传时间" width="90">
                            <template #default="{ row }">{{ formatDate(row.uploadedAt) }}</template>
                          </el-table-column>
                          <el-table-column label="操作" width="135" align="center">
                            <template #default="{ row }">
                              <el-button
                                v-if="isProductionTaskImageFile(row)"
                                type="primary"
                                link
                                size="small"
                                @click="handleProductionTaskAttachmentPreview(row)"
                              >
                                预览
                              </el-button>
                              <el-button
                                v-if="isProductionTaskPdfFile(row)"
                                type="primary"
                                link
                                size="small"
                                @click="handleProductionTaskAttachmentPdfPreview(row)"
                              >
                                预览
                              </el-button>
                              <el-button
                                type="primary"
                                link
                                size="small"
                                @click="downloadProductionTaskAttachment(row)"
                              >
                                下载
                              </el-button>
                            </template>
                          </el-table-column>
                        </el-table>
                      </el-card>
                    </el-col>

                    <el-col :xs="24" :sm="12" class="pm-attachment-col">
                      <el-card shadow="never" class="pm-attachment-card">
                        <template #header>
                          <div style="display: flex; justify-content: space-between; gap: 8px">
                            <span>文件</span>
                          </div>
                        </template>

                        <div style="margin: 4px 0 8px; font-weight: 600">塑胶模具检验记录单</div>
                        <el-table
                          :data="productionTaskInspectionAttachments"
                          border
                          size="small"
                          style="width: calc(100% - 2px)"
                        >
                          <el-table-column type="index" label="序号" width="42" />
                          <el-table-column prop="storedFileName" label="文件名" min-width="155" />
                          <el-table-column label="大小" width="70" align="right">
                            <template #default="{ row }">{{
                              formatFileSize(row.fileSize)
                            }}</template>
                          </el-table-column>
                          <el-table-column label="上传时间" width="90">
                            <template #default="{ row }">{{ formatDate(row.uploadedAt) }}</template>
                          </el-table-column>
                          <el-table-column label="操作" width="135" align="center">
                            <template #default="{ row }">
                              <el-button
                                v-if="isProductionTaskImageFile(row)"
                                type="primary"
                                link
                                size="small"
                                @click="handleProductionTaskAttachmentPreview(row)"
                              >
                                预览
                              </el-button>
                              <el-button
                                v-if="isProductionTaskPdfFile(row)"
                                type="primary"
                                link
                                size="small"
                                @click="handleProductionTaskAttachmentPdfPreview(row)"
                              >
                                预览
                              </el-button>
                              <el-button
                                type="primary"
                                link
                                size="small"
                                @click="downloadProductionTaskAttachment(row)"
                              >
                                下载
                              </el-button>
                            </template>
                          </el-table-column>
                        </el-table>
                      </el-card>
                    </el-col>
                  </el-row>
                </div>

                <!-- 试模单 -->
                <div class="pm-attachments" v-loading="attachmentLoading">
                  <el-row class="pm-attachments-row" :gutter="isMobile ? 8 : 16">
                    <el-col :xs="24" :sm="12" class="pm-attachment-col">
                      <el-card shadow="never" class="pm-attachment-card">
                        <template #header>
                          <div style="display: flex; justify-content: space-between; gap: 8px">
                            <span>试模单</span>
                            <el-upload
                              :action="getAttachmentAction('trial-form')"
                              :show-file-list="false"
                              accept=".xls,.xlsx,.pdf,image/*"
                              :on-success="handleAttachmentUploadSuccess"
                              :on-error="handleAttachmentUploadError"
                            >
                              <el-button type="primary" size="small">上传试模单</el-button>
                            </el-upload>
                          </div>
                        </template>
                        <el-table
                          :data="trialFormAttachments"
                          border
                          size="small"
                          style="width: calc(100% - 2px)"
                        >
                          <el-table-column type="index" label="序号" width="42" />
                          <el-table-column prop="storedFileName" label="文件名" min-width="155" />
                          <el-table-column label="大小" width="70" align="right">
                            <template #default="{ row }">{{
                              formatFileSize(row.fileSize)
                            }}</template>
                          </el-table-column>
                          <el-table-column label="上传时间" width="90">
                            <template #default="{ row }">{{ formatDate(row.uploadedAt) }}</template>
                          </el-table-column>
                          <el-table-column label="操作" width="135" align="center">
                            <template #default="{ row }">
                              <el-button
                                v-if="isImageFile(row)"
                                type="primary"
                                link
                                size="small"
                                @click="handleAttachmentPreview(row)"
                              >
                                预览
                              </el-button>
                              <el-button
                                v-if="isPdfFile(row)"
                                type="primary"
                                link
                                size="small"
                                @click="handleAttachmentPdfPreview(row)"
                              >
                                预览
                              </el-button>
                              <el-button
                                type="primary"
                                link
                                size="small"
                                @click="downloadAttachment(row)"
                              >
                                下载
                              </el-button>
                              <el-button
                                type="danger"
                                link
                                size="small"
                                @click="deleteAttachment(row)"
                              >
                                删除
                              </el-button>
                            </template>
                          </el-table-column>
                        </el-table>
                      </el-card>
                    </el-col>

                    <el-col :xs="24" :sm="12" class="pm-attachment-col">
                      <el-card shadow="never" class="pm-attachment-card">
                        <template #header>
                          <div style="display: flex; justify-content: space-between; gap: 8px">
                            <span>图档</span>
                            <el-upload
                              :action="getAttachmentAction('drawing')"
                              :show-file-list="false"
                              :multiple="true"
                              accept=".pdf,.dwg,.prt,.x_t,.x_b,.stp,.step,.igs,.iges,.sldprt,.sldasm,.asm,.par,.psm,.catpart,.catproduct"
                              :before-upload="(file) => beforeAttachmentUpload(file, 'drawing')"
                              :on-success="handleAttachmentUploadSuccess"
                              :on-error="handleAttachmentUploadError"
                            >
                              <el-button type="primary" size="small">上传图档</el-button>
                            </el-upload>
                          </div>
                        </template>
                        <el-table
                          :data="drawingAttachments"
                          border
                          size="small"
                          style="width: calc(100% - 2px)"
                        >
                          <el-table-column type="index" label="序号" width="42" />
                          <el-table-column prop="storedFileName" label="文件名" min-width="155" />
                          <el-table-column label="大小" width="70" align="right">
                            <template #default="{ row }">{{
                              formatFileSize(row.fileSize)
                            }}</template>
                          </el-table-column>
                          <el-table-column label="上传时间" width="90">
                            <template #default="{ row }">{{ formatDate(row.uploadedAt) }}</template>
                          </el-table-column>
                          <el-table-column label="操作" width="135" align="center">
                            <template #default="{ row }">
                              <el-button
                                v-if="isImageFile(row)"
                                type="primary"
                                link
                                size="small"
                                @click="handleAttachmentPreview(row)"
                              >
                                预览
                              </el-button>
                              <el-button
                                v-if="isPdfFile(row)"
                                type="primary"
                                link
                                size="small"
                                @click="handleAttachmentPdfPreview(row)"
                              >
                                预览
                              </el-button>
                              <el-button
                                type="primary"
                                link
                                size="small"
                                @click="downloadAttachment(row)"
                              >
                                下载
                              </el-button>
                              <el-button
                                type="danger"
                                link
                                size="small"
                                @click="deleteAttachment(row)"
                              >
                                删除
                              </el-button>
                            </template>
                          </el-table-column>
                        </el-table>
                      </el-card>
                    </el-col>
                  </el-row>
                </div>
              </el-tab-pane>
            </el-tabs>
          </div>
        </el-form>
      </div>
      <template #footer>
        <div class="pm-edit-footer">
          <el-button
            v-if="currentProjectCode && isPlasticMould"
            type="warning"
            plain
            :disabled="editSubmitting"
            @click="handleResetInit"
          >
            重置初始化
          </el-button>
          <div class="pm-edit-footer__right">
            <el-button
              v-if="editForm.项目编号 || currentProjectCode"
              type="primary"
              plain
              :disabled="editSubmitting || !(editForm.项目编号 || currentProjectCode)"
              @click="handlePrintTrialRecord"
            >
              打印试模记录单
            </el-button>
            <el-button @click="editDialogVisible = false">取消</el-button>
            <el-button type="primary" :loading="editSubmitting" @click="handleSubmitEdit"
              >保存</el-button
            >
          </div>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage, ElRadioButton, ElRadioGroup, ElEmpty, ElTag } from 'element-plus'
import ProjectInitDialog from './components/ProjectInitDialog.vue'
import {
  getProjectListApi,
  getProjectDetailApi,
  createProjectApi,
  updateProjectApi,
  getProjectGoodsApi,
  getProjectStatisticsApi,
  getProjectAttachmentsApi,
  downloadProjectAttachmentApi,
  deleteProjectAttachmentApi,
  downloadTrialFormXlsxApi,
  validateTrialFormApi,
  generateTripartiteAgreementPdfApi,
  generateSealSampleXlsxApi,
  uploadProjectPartImageApi,
  deleteProjectTempPartImageApi,
  type ProjectInfo,
  type ProjectAttachment,
  type ProjectAttachmentType
} from '@/api/project'
import { getProductionTaskDetailApi } from '@/api/production-task'
import {
  getProductionTaskAttachmentsApi,
  downloadProductionTaskAttachmentApi,
  type ProductionTaskAttachment
} from '@/api/production-task'
import type { GoodsInfo } from '@/api/goods'
import { useAppStore } from '@/store/modules/app'
import { createImageViewer } from '@/components/ImageViewer'
import { createPdfViewer } from '@/components/PdfViewer'
import { ElMessageBox } from 'element-plus'
import ExternalImportDialog from './components/ExternalImportDialog.vue'

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

type ViewMode = 'table' | 'card' | 'timeline'

interface ProjectGroup {
  prefix: string
  projects: Partial<ProjectInfo>[]
}

const appStore = useAppStore()
const route = useRoute()
const router = useRouter()
const isMobile = computed(() => appStore.getMobile)
const externalImportVisible = ref(false)

const resolvePcViewModeFromRoute = (): ViewMode => {
  const v = route.query.view
  if (v === 'table' || v === 'timeline') return v as ViewMode
  return 'table'
}

const viewMode = ref<ViewMode>(isMobile.value ? 'card' : resolvePcViewModeFromRoute())
const showMobileFilters = ref(false)
const showMobileSummary = ref(false)
// PC 端表格高度：对齐“销售订单”页面
const tableHeight = computed(() => (isMobile.value ? undefined : 'calc(100vh - 220px)'))

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

const updateViewQuery = (mode: 'table' | 'timeline') => {
  const query = { ...route.query, view: mode }
  router.replace({ path: route.path, query })
}

// PC 端监听路由 query.view，同步到本地 viewMode
watch(
  () => route.query.view,
  (val) => {
    if (isMobile.value) return
    const mode = val === 'table' || val === 'timeline' ? (val as ViewMode) : 'table'
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
      updateViewQuery(next === 'card' ? 'table' : (next as 'table' | 'timeline'))
    }
    showMobileFilters.value = true
  }
})

watch(viewMode, (val) => {
  if (isMobile.value) return
  if (val === 'table' || val === 'timeline') {
    updateViewQuery(val)
  }
})

// 时间轴相关状态
const timelineActiveProjectCode = ref<string | null>(null)
const viewProjectData = ref<Partial<ProjectInfo> | null>(null)

// 提取产品图号前缀
const extractDrawingPrefix = (productDrawing?: string): string => {
  if (!productDrawing || !productDrawing.trim()) {
    return '未分类'
  }

  const dotIndex = productDrawing.indexOf('.')
  if (dotIndex === -1) {
    return productDrawing.trim()
  }

  return productDrawing.substring(0, dotIndex).trim() || '未分类'
}

// 分组计算（所有分类）
const projectGroups = computed<ProjectGroup[]>(() => {
  const map = new Map<string, Partial<ProjectInfo>[]>()

  console.log('[时间轴分组] 总数据量:', tableData.value.length)
  let processedCount = 0
  const categoryStats = new Map<string, number>()

  // 先统计所有分类
  for (const project of tableData.value) {
    const category = project.分类 || '未分类'
    categoryStats.set(category, (categoryStats.get(category) || 0) + 1)
  }
  console.log('[时间轴分组] 分类统计:', Array.from(categoryStats.entries()))

  // 检查前几条数据的详细信息
  if (tableData.value.length > 0) {
    console.log('[时间轴分组] 前3条数据示例:')
    tableData.value.slice(0, 3).forEach((project, idx) => {
      console.log(`  数据${idx + 1}:`, {
        项目编号: project.项目编号,
        分类: project.分类,
        产品图号: project.productDrawing,
        产品图号2: project.产品图号
      })
    })
  }

  for (const project of tableData.value) {
    // 尝试多个字段名：productDrawing 和 产品图号
    const drawing = project.productDrawing || project.产品图号 || ''
    if (!drawing || !drawing.trim()) {
      console.log('[时间轴分组] 跳过无产品图号的项目:', project.项目编号)
      continue
    }

    processedCount++
    const prefix = extractDrawingPrefix(drawing)
    console.log(
      '[时间轴分组] 项目:',
      project.项目编号,
      '分类:',
      project.分类,
      '产品图号:',
      drawing,
      '前缀:',
      prefix
    )

    if (!map.has(prefix)) {
      map.set(prefix, [])
    }
    map.get(prefix)!.push(project)
  }

  console.log('[时间轴分组] 已处理项目数:', processedCount, '分组数:', map.size)

  // 排序：前缀按字母数字混合排序
  const result = Array.from(map.entries())
    .sort((a, b) =>
      a[0].localeCompare(b[0], undefined, {
        numeric: true,
        sensitivity: 'base'
      })
    )
    .map(([prefix, projects]) => ({
      prefix,
      projects: projects.sort((a, b) => (a.项目编号 || '').localeCompare(b.项目编号 || ''))
    }))

  console.log('[时间轴分组] 最终分组结果:', result)
  return result
})

// 时间轴交互函数
const loadProjectForTimeline = async (projectCode: string) => {
  if (!projectCode) return

  try {
    const response: any = await getProjectDetailApi(projectCode)
    const data = response.data?.data || response.data || response
    viewProjectData.value = data
  } catch (error) {
    console.error('加载项目详情失败:', error)
    ElMessage.error('加载项目详情失败')
  }
}

const handleTimelineProjectClick = async (project: Partial<ProjectInfo>) => {
  timelineActiveProjectCode.value = project.项目编号 || null
  await loadProjectForTimeline(project.项目编号 || '')
}

const handleTimelineView = () => {
  if (!viewProjectData.value) return
  viewData.value = viewProjectData.value
  viewDialogVisible.value = true
}

const handleTimelineEdit = () => {
  if (!viewProjectData.value) return
  handleEdit(viewProjectData.value)
}

const viewDialogVisible = ref(false)
const viewData = ref<Partial<ProjectInfo>>({})

const editDialogVisible = ref(false)
const editTitle = ref('编辑项目')
const editActiveTab = ref<'basic' | 'part' | 'mould' | 'machine' | 'attachments' | 'attachments2'>(
  'basic'
)
const editFormRef = ref<FormInstance>()
const editForm = reactive<Partial<ProjectInfo>>({})
const editSubmitting = ref(false)
const trialFormGenerating = ref(false)

const stableStringify = (input: any) => {
  const seen = new WeakSet()
  const normalize = (val: any): any => {
    if (val === undefined) return null
    if (val === null) return null
    if (typeof val !== 'object') return val
    if (typeof val === 'function') return null
    if (seen.has(val)) return null
    seen.add(val)
    if (Array.isArray(val)) return val.map(normalize)
    const out: Record<string, any> = {}
    Object.keys(val)
      .sort()
      .forEach((k) => {
        const v = (val as any)[k]
        if (typeof v === 'function') return
        out[k] = normalize(v)
      })
    return out
  }
  try {
    return JSON.stringify(normalize(input))
  } catch {
    return ''
  }
}

const editFormSnapshot = ref('')
const setEditFormSnapshot = () => {
  editFormSnapshot.value = stableStringify(editForm)
}
const isEditFormDirty = computed(
  () => !!editFormSnapshot.value && stableStringify(editForm) !== editFormSnapshot.value
)

// 产品列表相关逻辑
// 解析产品列表（兼容旧字段：产品图号列表）和产品尺寸（兼容旧数据）
const parseProductDrawingList = (value: any): string[] => {
  if (!value) return []
  if (Array.isArray(value)) return value
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

const getProductListRawFromEditForm = () =>
  (editForm as any).产品列表 ?? (editForm as any).产品图号列表

const parseProductSize = (value: any): string[] => {
  if (!value) return []
  const normalizeSizeItem = (item: any): string => {
    const raw = String(item ?? '').trim()
    if (!raw) return ''
    // 兼容“二次 JSON 序列化”的脏数据：["[\"170*...\"]"] 或类似
    if (raw.startsWith('[') && raw.endsWith(']')) {
      try {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          const parts = parsed.map((p) => String(p ?? '').trim()).filter(Boolean)
          if (parts.length === 1) return parts[0]
          if (parts.length > 1) return parts.join(' / ')
          return ''
        }
      } catch {
        // 兼容 SQL/导入导致的双引号转义（"" -> \\"）再尝试解析
        if (raw.includes('""')) {
          try {
            const repaired = raw.replace(/\"\"/g, '\\"')
            const parsed = JSON.parse(repaired)
            if (Array.isArray(parsed)) {
              const parts = parsed.map((p) => String(p ?? '').trim()).filter(Boolean)
              if (parts.length === 1) return parts[0]
              if (parts.length > 1) return parts.join(' / ')
              return ''
            }
          } catch {
            // ignore
          }
        }
      }
    }
    return raw
  }

  if (Array.isArray(value)) return value.map(normalizeSizeItem)
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) return parsed.map(normalizeSizeItem)
      // 旧格式：普通字符串，转为数组
      return value.trim() ? [normalizeSizeItem(value)] : []
    } catch {
      // 兼容类似：["[""170*106*68.3""]"]（双引号转义丢失）
      if (value.includes('""')) {
        try {
          const repaired = value.replace(/\"\"/g, '\\"')
          const parsed = JSON.parse(repaired)
          if (Array.isArray(parsed)) return parsed.map(normalizeSizeItem)
        } catch {
          // ignore
        }
      }
      // 解析失败，说明是旧格式（普通字符串）
      return value.trim() ? [normalizeSizeItem(value)] : []
    }
  }
  return []
}

const parseProductNameList = (value: any): string[] => {
  if (!value) return []
  if (Array.isArray(value)) return value.map((v) => String(v ?? '').trim())
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) return parsed.map((v) => String(v ?? '').trim())
      return value.trim() ? [value.trim()] : []
    } catch {
      return value.trim() ? [value.trim()] : []
    }
  }
  return []
}

const parseProductQtyList = (value: any): number[] => {
  if (value === null || value === undefined || value === '') return []
  const normalizeQty = (v: any) => {
    if (v === null || v === undefined || v === '') return null
    const n = typeof v === 'number' ? v : Number(String(v).trim())
    if (!Number.isFinite(n)) return null
    const i = Math.trunc(n)
    return i < 0 ? 0 : i
  }
  if (Array.isArray(value)) return value.map(normalizeQty).filter((x) => x !== null) as number[]
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed))
        return parsed.map(normalizeQty).filter((x) => x !== null) as number[]
      const single = normalizeQty(value)
      return single === null ? [] : [single]
    } catch {
      const single = normalizeQty(value)
      return single === null ? [] : [single]
    }
  }
  const single = normalizeQty(value)
  return single === null ? [] : [single]
}

const parseProductWeightList = (value: any): number[] => {
  if (value === null || value === undefined || value === '') return []
  const normalizeWeight = (v: any) => {
    if (v === null || v === undefined || v === '') return null
    const n = typeof v === 'number' ? v : Number(String(v).trim())
    if (!Number.isFinite(n)) return null
    return Math.max(0, n)
  }
  const normalizeArray = (arr: any[]) =>
    arr.map(normalizeWeight).filter((x) => x !== null) as number[]
  if (Array.isArray(value)) return normalizeArray(value)
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) return normalizeArray(parsed)
      const single = normalizeWeight(value)
      return single === null ? [] : [single]
    } catch {
      const single = normalizeWeight(value)
      return single === null ? [] : [single]
    }
  }
  const single = normalizeWeight(value)
  return single === null ? [] : [single]
}

const normalizeDrawingAndSizeLists = (
  drawingsRaw: string[],
  sizesRaw: string[],
  namesRaw: string[],
  qtyRaw: number[],
  weightRaw: number[],
  mainDrawingRaw: string,
  mainNameRaw: string
) => {
  const mainDrawing = String(mainDrawingRaw || '').trim()
  const mainName = String(mainNameRaw || '').trim()
  const drawings = (drawingsRaw || []).map((d) => String(d ?? '').trim())
  const sizes = (sizesRaw || []).map((s) => String(s ?? '').trim())
  const names = (namesRaw || []).map((n) => String(n ?? '').trim())
  const qty = (qtyRaw || []).map((q) => {
    const n = typeof q === 'number' ? q : Number(q)
    if (!Number.isFinite(n)) return 0
    return Math.max(0, Math.trunc(n))
  })
  const weights = (weightRaw || []).map((w) => {
    const n = typeof w === 'number' ? w : Number(w)
    if (!Number.isFinite(n)) return 0
    return Math.max(0, n)
  })

  // 至少保留 1 行
  if (drawings.length === 0) {
    drawings.push(mainDrawing || '')
  }

  // 长度对齐：保留更长的一侧，避免丢数据
  const maxLength = Math.max(
    1,
    drawings.length,
    sizes.length,
    names.length,
    qty.length,
    weights.length
  )
  while (drawings.length < maxLength) drawings.push('')
  while (sizes.length < maxLength) sizes.push('')
  while (names.length < maxLength) names.push('')
  while (qty.length < maxLength) qty.push(0)
  while (weights.length < maxLength) weights.push(0)

  // 若名称全为空且存在主名称，则首行自动补齐主名称（保持行为“尽量不空”但不强制）
  if (names.every((n) => !n) && mainName) {
    names[0] = mainName
  }

  return { drawings, sizes, names, qty, weights }
}

// 同步“产品列表/产品尺寸”：首行=主图号，至少一行，索引对齐
const syncMainDrawingRowToForm = () => {
  const mainDrawing = String(editForm.productDrawing || '').trim()
  const mainName = String(editForm.productName || '').trim()
  const drawingsRaw = parseProductDrawingList(getProductListRawFromEditForm())
  const sizesRaw = parseProductSize(editForm.产品尺寸)
  const namesRaw = parseProductNameList((editForm as any).产品名称列表)
  const qtyRaw = parseProductQtyList((editForm as any).产品数量列表)
  const weightRaw = parseProductWeightList((editForm as any).产品重量列表)
  const { drawings, sizes, names, qty, weights } = normalizeDrawingAndSizeLists(
    drawingsRaw,
    sizesRaw,
    namesRaw,
    qtyRaw,
    weightRaw,
    mainDrawing,
    mainName
  )
  ;(editForm as any).产品列表 = drawings
  editForm.产品尺寸 = sizes as any
  ;(editForm as any).产品名称列表 = names
  ;(editForm as any).产品数量列表 = qty
  ;(editForm as any).产品重量列表 = weights
}

const applyInitGroupsToProductDrawingList = (
  groups: Array<{
    productDrawing?: string
    productName?: string
    productSize?: string
    cavityCount?: number | undefined
  }>
) => {
  const mainDrawing = String(editForm.productDrawing || '').trim()
  const mainName = String(editForm.productName || '').trim()

  const extracted = (groups || [])
    .map((g) => ({
      drawing: String(g?.productDrawing || '').trim(),
      name: String(g?.productName || '').trim(),
      size: String(g?.productSize || '').trim(),
      qty: g?.cavityCount
    }))
    .filter((x) => Boolean(x.drawing))

  const nextDrawings: string[] = []
  const seen = new Set<string>()
  const groupNameByDrawing = new Map<string, string>()
  const groupQtyByDrawing = new Map<string, number>()
  const groupSizeByDrawing = new Map<string, string>()
  for (const { drawing, name } of extracted) {
    const key = drawing.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    nextDrawings.push(drawing)
    if (name && !groupNameByDrawing.has(key)) groupNameByDrawing.set(key, name)
  }
  for (const { drawing, size } of extracted) {
    const key = drawing.toLowerCase()
    if (groupSizeByDrawing.has(key)) continue
    if (!size) continue
    groupSizeByDrawing.set(key, size)
  }
  for (const { drawing, qty } of extracted) {
    const key = drawing.toLowerCase()
    if (groupQtyByDrawing.has(key)) continue
    const n = qty === undefined ? NaN : Number(qty)
    if (!Number.isFinite(n)) continue
    groupQtyByDrawing.set(key, Math.max(0, Math.trunc(n)))
  }

  if (nextDrawings.length === 0) {
    nextDrawings.push(mainDrawing || '')
  }

  const existingDrawings = parseProductDrawingList(getProductListRawFromEditForm()).map((d) =>
    String(d || '').trim()
  )
  const existingSizes = parseProductSize(editForm.产品尺寸).map((s) => String(s || '').trim())
  const existingNames = parseProductNameList((editForm as any).产品名称列表).map((n) =>
    String(n || '').trim()
  )
  const existingQty = parseProductQtyList((editForm as any).产品数量列表).map((q) => {
    const n = typeof q === 'number' ? q : Number(q)
    if (!Number.isFinite(n)) return 0
    return Math.max(0, Math.trunc(n))
  })
  const existingWeights = parseProductWeightList((editForm as any).产品重量列表).map((w) => {
    const n = typeof w === 'number' ? w : Number(w)
    if (!Number.isFinite(n)) return 0
    return Math.max(0, n)
  })

  const drawingToSize = new Map<string, string>()
  const drawingToName = new Map<string, string>()
  const drawingToQty = new Map<string, number>()
  const drawingToWeight = new Map<string, number>()
  for (
    let i = 0;
    i <
    Math.max(
      existingDrawings.length,
      existingSizes.length,
      existingNames.length,
      existingQty.length,
      existingWeights.length
    );
    i++
  ) {
    const d = String(existingDrawings[i] || '').trim()
    if (!d) continue
    const key = d.toLowerCase()

    const s = String(existingSizes[i] || '').trim()
    const n = String(existingNames[i] || '').trim()
    const q = Number.isFinite(existingQty[i] as any) ? Number(existingQty[i]) : 0
    const w = Number.isFinite(existingWeights[i] as any) ? Number(existingWeights[i]) : 0

    if (!drawingToSize.has(key) && s) drawingToSize.set(key, s)
    if (!drawingToName.has(key) && n) drawingToName.set(key, n)
    if (!drawingToQty.has(key) && q) drawingToQty.set(key, Math.max(0, Math.trunc(q)))
    if (!drawingToWeight.has(key) && w) drawingToWeight.set(key, Math.max(0, w))
  }

  const nextSizes = nextDrawings.map((d) => {
    const key = d.toLowerCase()
    return groupSizeByDrawing.get(key) || drawingToSize.get(key) || ''
  })
  const nextNames = nextDrawings.map((d, i) => {
    const key = d.toLowerCase()
    const fromGroup = groupNameByDrawing.get(key) || ''
    const fromExisting = drawingToName.get(key) || ''
    const fallback = i === 0 ? mainName : ''
    return fromGroup || fromExisting || fallback
  })
  const nextQty = nextDrawings.map((d) => {
    const key = d.toLowerCase()
    const fromGroup = groupQtyByDrawing.get(key) || 0
    if (fromGroup) return fromGroup
    return drawingToQty.get(key) || 0
  })
  const nextWeights = nextDrawings.map((d) => drawingToWeight.get(d.toLowerCase()) || 0)

  ;(editForm as any).产品列表 = nextDrawings
  editForm.产品尺寸 = nextSizes as any
  ;(editForm as any).产品名称列表 = nextNames
  ;(editForm as any).产品数量列表 = nextQty
  ;(editForm as any).产品重量列表 = nextWeights
  syncMainDrawingRowToForm()
}

const extractProjectNameFromProductDrawing = (drawing: unknown) => {
  const raw = String(drawing || '').trim()
  if (!raw) return ''
  const firstToken = raw.split(/[\s;\/]+/).filter(Boolean)[0] || ''
  if (!firstToken) return ''
  const prefix = firstToken.split('.')[0] || ''
  return prefix || firstToken
}

// 产品列表显示数据类型
interface ProductDrawingRow {
  图号: string
  名称: string
  尺寸: string
  重量: number
  数量: number
  图号错误: string
}

// 产品列表显示数据（用于表格）
const productDrawingListDisplay = computed<ProductDrawingRow[]>(() => {
  const mainDrawing = String(editForm.productDrawing || '').trim()
  const mainName = String(editForm.productName || '').trim()
  const {
    drawings: 图号列表,
    sizes: 尺寸列表,
    names: 名称列表,
    qty: 数量列表,
    weights: 重量列表
  } = normalizeDrawingAndSizeLists(
    parseProductDrawingList(getProductListRawFromEditForm()),
    parseProductSize(editForm.产品尺寸),
    parseProductNameList((editForm as any).产品名称列表),
    parseProductQtyList((editForm as any).产品数量列表),
    parseProductWeightList((editForm as any).产品重量列表),
    mainDrawing,
    mainName
  )

  const maxLength = Math.max(
    图号列表.length,
    尺寸列表.length,
    名称列表.length,
    数量列表.length,
    重量列表.length,
    1
  )
  const result: ProductDrawingRow[] = []

  for (let i = 0; i < maxLength; i++) {
    result.push({
      图号: 图号列表[i] || '',
      名称: 名称列表[i] || '',
      尺寸: 尺寸列表[i] || '',
      重量: 重量列表[i] ?? 0,
      数量: 数量列表[i] ?? 0,
      图号错误: ''
    })
  }

  return result
})

// 处理图号变化
const handleDrawingNumberChange = (index: number, val: string) => {
  syncMainDrawingRowToForm()

  const 图号列表 = parseProductDrawingList(getProductListRawFromEditForm())
  const 名称列表 = parseProductNameList((editForm as any).产品名称列表)
  const 数量列表 = parseProductQtyList((editForm as any).产品数量列表)
  const 重量列表 = parseProductWeightList((editForm as any).产品重量列表)
  while (图号列表.length <= index) {
    图号列表.push('')
  }
  图号列表[index] = val || ''

  // 确保尺寸数组长度一致
  const 尺寸列表 = parseProductSize(editForm.产品尺寸)
  while (尺寸列表.length < 图号列表.length) {
    尺寸列表.push('')
  }
  while (尺寸列表.length > 图号列表.length) {
    尺寸列表.pop()
  }

  while (名称列表.length < 图号列表.length) {
    名称列表.push('')
  }
  while (名称列表.length > 图号列表.length) {
    名称列表.pop()
  }

  while (数量列表.length < 图号列表.length) {
    数量列表.push(0)
  }
  while (数量列表.length > 图号列表.length) {
    数量列表.pop()
  }

  while (重量列表.length < 图号列表.length) {
    重量列表.push(0)
  }
  while (重量列表.length > 图号列表.length) {
    重量列表.pop()
  }

  ;(editForm as any).产品列表 = 图号列表
  editForm.产品尺寸 = 尺寸列表 as any
  ;(editForm as any).产品名称列表 = 名称列表
  ;(editForm as any).产品数量列表 = 数量列表
  ;(editForm as any).产品重量列表 = 重量列表

  // 清除错误提示
  if (productDrawingListDisplay.value[index]) {
    productDrawingListDisplay.value[index].图号错误 = ''
  }
}

// 处理产品名称列表中的名称变化
const handleProductNameChange = (index: number, val: string) => {
  syncMainDrawingRowToForm()

  const 名称列表 = parseProductNameList((editForm as any).产品名称列表)
  while (名称列表.length <= index) {
    名称列表.push('')
  }
  名称列表[index] = val || ''
  ;(editForm as any).产品名称列表 = 名称列表
}

// 处理产品数量列表中的数量变化
const handleProductQtyChange = (index: number, val: unknown) => {
  syncMainDrawingRowToForm()
  const 数量列表 = parseProductQtyList((editForm as any).产品数量列表)
  while (数量列表.length <= index) {
    数量列表.push(0)
  }
  const n = typeof val === 'number' ? val : Number(val)
  数量列表[index] = Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0
  ;(editForm as any).产品数量列表 = 数量列表
}

// 处理产品重量列表中的重量变化
const handleProductWeightChange = (index: number, val: unknown) => {
  syncMainDrawingRowToForm()
  const 重量列表 = parseProductWeightList((editForm as any).产品重量列表)
  while (重量列表.length <= index) {
    重量列表.push(0)
  }
  const n = typeof val === 'number' ? val : Number(val)
  重量列表[index] = Number.isFinite(n) ? Math.max(0, n) : 0
  ;(editForm as any).产品重量列表 = 重量列表
}

// 处理产品尺寸列表中的尺寸变化
const handleProductSizeChange = (index: number, val: string) => {
  syncMainDrawingRowToForm()

  const 尺寸列表 = parseProductSize(editForm.产品尺寸)
  while (尺寸列表.length <= index) {
    尺寸列表.push('')
  }
  尺寸列表[index] = val || ''
  editForm.产品尺寸 = 尺寸列表 as any
}

// 验证图号
const validateDrawingNumber = (index: number) => {
  const row = productDrawingListDisplay.value[index]
  if (!row) return

  const 图号 = row.图号?.trim() || ''
  const 图号列表 = parseProductDrawingList(getProductListRawFromEditForm())

  // 验证：不能与列表中其他图号重复
  const 其他图号 = 图号列表
    .map((图号, i) => (i !== index && 图号?.trim() ? 图号.trim() : null))
    .filter(Boolean) as string[]

  if (图号 && 其他图号.includes(图号)) {
    row.图号错误 = '图号不能重复'
    return
  }

  // 验证通过，清除错误
  row.图号错误 = ''
}

// 添加行
const addDrawingRow = () => {
  syncMainDrawingRowToForm()

  const 图号列表 = parseProductDrawingList(getProductListRawFromEditForm())
  const 尺寸列表 = parseProductSize(editForm.产品尺寸)
  const 名称列表 = parseProductNameList((editForm as any).产品名称列表)
  const 数量列表 = parseProductQtyList((editForm as any).产品数量列表)
  const 重量列表 = parseProductWeightList((editForm as any).产品重量列表)

  图号列表.push('')
  尺寸列表.push('')
  名称列表.push('')
  数量列表.push(0)
  重量列表.push(0)
  ;(editForm as any).产品列表 = 图号列表
  editForm.产品尺寸 = 尺寸列表 as any
  ;(editForm as any).产品名称列表 = 名称列表
  ;(editForm as any).产品数量列表 = 数量列表
  ;(editForm as any).产品重量列表 = 重量列表
}

// 删除行
const deleteDrawingRow = (index: number) => {
  syncMainDrawingRowToForm()

  const 图号列表 = parseProductDrawingList(getProductListRawFromEditForm())
  const 尺寸列表 = parseProductSize(editForm.产品尺寸)
  const 名称列表 = parseProductNameList((editForm as any).产品名称列表)
  const 数量列表 = parseProductQtyList((editForm as any).产品数量列表)
  const 重量列表 = parseProductWeightList((editForm as any).产品重量列表)

  if (图号列表.length <= 1) {
    ElMessage.warning('产品列表至少保留一行')
    return
  }

  图号列表.splice(index, 1)
  尺寸列表.splice(index, 1)
  名称列表.splice(index, 1)
  数量列表.splice(index, 1)
  重量列表.splice(index, 1)
  ;(editForm as any).产品列表 = 图号列表
  editForm.产品尺寸 = 尺寸列表 as any
  ;(editForm as any).产品名称列表 = 名称列表
  ;(editForm as any).产品数量列表 = 数量列表
  ;(editForm as any).产品重量列表 = 重量列表
}
const tripartiteAgreementDownloading = ref(false)
const sealSampleGenerating = ref(false)
const currentProjectCode = ref('')
const editDialogBodyRef = ref<HTMLElement>()
const editDialogBaseHeight = ref<number>()

type InitProductGroupPersisted = {
  id: string
  name: string
  cavityCount: number | undefined
  productDrawing?: string
  productName?: string
  productSize?: string
}

const initDialogVisible = ref(false)
const initDialogInitialGroups = ref<InitProductGroupPersisted[] | null>(null)

const isInitDone = (val: unknown) => {
  if (val === true) return true
  if (val === false) return false
  const n = Number(val)
  return Number.isFinite(n) ? n === 1 : false
}

const shouldShowInitDialog = (projectCode: string) => {
  if (!projectCode) return false
  // 只有分类为"塑胶模具"时才显示初始化弹窗
  const category = String((editForm as any).分类 || '').trim()
  if (category !== '塑胶模具') return false
  return !isInitDone((editForm as any).init_done)
}

const toSafeCavity = (value: unknown) => {
  const n = Number(value)
  if (!Number.isFinite(n)) return 1
  return Math.min(64, Math.max(1, Math.round(n)))
}

/**
 * 从产品组列表生成模具穴数表达式
 * 例如：[{cavityCount: 2}, {cavityCount: 2}] -> "1*2+1*2"
 *      [{cavityCount: 4}] -> "1*4"
 */
const generateCavityExpression = (groups: Array<{ cavityCount: number }>): string => {
  if (!groups || groups.length === 0) return '1*1'

  // 统一使用 1*穴数 格式，用 + 连接
  return groups.map((g) => `1*${toSafeCavity(g.cavityCount)}`).join('+')
}

/**
 * 解析模具穴数表达式，计算总穴数
 * 例如："2+2" -> 4
 *      "4" -> 4
 *      "1*2+1*2" -> 4（如果支持乘法格式）
 */
const parseCavityExpression = (expression: string | number | null | undefined): number => {
  if (expression === null || expression === undefined || expression === '') return 1

  // 如果是数字，直接返回
  if (typeof expression === 'number') {
    return toSafeCavity(expression)
  }

  const expr = String(expression).trim()
  if (!expr) return 1

  // 尝试解析为数字（纯数字格式，向后兼容）
  const num = Number(expr)
  if (Number.isFinite(num) && !expr.includes('+') && !expr.includes('*')) {
    return toSafeCavity(num)
  }

  // 解析表达式（支持 + 和 *）
  try {
    // 按 + 分割
    const parts = expr
      .split('+')
      .map((part) => part.trim())
      .filter(Boolean)

    let total = 0
    for (const part of parts) {
      // 检查是否包含 *
      if (part.includes('*')) {
        const [multiplier, count] = part.split('*').map((s) => Number(s.trim()))
        if (Number.isFinite(multiplier) && Number.isFinite(count)) {
          total += toSafeCavity(multiplier) * toSafeCavity(count)
        } else {
          // 如果解析失败，尝试作为单个数字
          const num = Number(part)
          if (Number.isFinite(num)) {
            total += toSafeCavity(num)
          }
        }
      } else {
        // 纯数字
        const num = Number(part)
        if (Number.isFinite(num)) {
          total += toSafeCavity(num)
        }
      }
    }

    return total > 0 ? total : 1
  } catch {
    // 解析失败，尝试作为单个数字
    const num = Number(expr)
    return Number.isFinite(num) ? toSafeCavity(num) : 1
  }
}

const buildDefaultInitGroups = (
  projectCode: string,
  fallbackCavity: unknown
): InitProductGroupPersisted[] => {
  const parseCavityExpressionToCounts = (expression: unknown): number[] => {
    if (expression === null || expression === undefined || expression === '') return []
    if (typeof expression === 'number') return [toSafeCavity(expression)]
    const raw = String(expression || '').trim()
    if (!raw) return []

    const num = Number(raw)
    if (Number.isFinite(num) && !raw.includes('+') && !raw.includes('*')) {
      return [toSafeCavity(num)]
    }

    const parts = raw
      .split('+')
      .map((p) => p.trim())
      .filter(Boolean)

    return parts.map((part) => {
      const token = part.includes('*') ? part.split('*').pop() || '' : part
      const n = Number(String(token).trim())
      return toSafeCavity(n)
    })
  }

  const mainDrawing = String(editForm.productDrawing || '').trim()
  const mainName = String(editForm.productName || '').trim()

  const drawingsRaw = parseProductDrawingList(getProductListRawFromEditForm()).map((d) =>
    String(d || '').trim()
  )
  const namesRaw = parseProductNameList((editForm as any).产品名称列表).map((n) =>
    String(n || '').trim()
  )
  const sizesRaw = parseProductSize(editForm.产品尺寸).map((s) => String(s || '').trim())

  const drawingToName = new Map<string, string>()
  for (let i = 0; i < Math.max(drawingsRaw.length, namesRaw.length); i++) {
    const d = String(drawingsRaw[i] || '').trim()
    const n = String(namesRaw[i] || '').trim()
    if (!d || !n) continue
    const key = d.toLowerCase()
    if (!drawingToName.has(key)) drawingToName.set(key, n)
  }

  const drawingToSize = new Map<string, string>()
  for (let i = 0; i < Math.max(drawingsRaw.length, sizesRaw.length); i++) {
    const d = String(drawingsRaw[i] || '').trim()
    const s = String(sizesRaw[i] || '').trim()
    if (!d || !s) continue
    const key = d.toLowerCase()
    if (!drawingToSize.has(key)) drawingToSize.set(key, s)
  }

  const drawings = drawingsRaw.map((d) => d.trim()).filter(Boolean)
  const counts = parseCavityExpressionToCounts(fallbackCavity)

  const groupCount = Math.max(1, drawings.length || 0, counts.length || 0)
  return Array.from({ length: groupCount }).map((_, idx) => {
    const drawing = drawings[idx] || (idx === 0 ? mainDrawing : '')
    const nameFromList = drawing ? drawingToName.get(String(drawing).toLowerCase()) || '' : ''
    const sizeFromList = drawing ? drawingToSize.get(String(drawing).toLowerCase()) || '' : ''
    return {
      id: `g_${projectCode || 'tmp'}_${idx}`,
      name: `产品组 ${idx + 1}`,
      cavityCount: counts[idx] === undefined ? undefined : toSafeCavity(counts[idx]),
      productDrawing: drawing,
      productName: nameFromList || (idx === 0 ? mainName : ''),
      productSize: sizeFromList || ''
    }
  })
}

const runnerTypeOptions = [
  { label: '开放式热流道', value: '开放式热流道' },
  { label: '点浇口热流道', value: '点浇口热流道' },
  { label: '针阀式热流道', value: '针阀式热流道' },
  { label: '冷流道', value: '冷流道' }
]

const mouldMaterialOptions = [
  { label: 'XPM ESR国产', value: 'XPM ESR国产' },
  { label: 'XPM国产', value: 'XPM国产' },
  { label: 'NAK80国产', value: 'NAK80国产' },
  { label: '2738HH国产', value: '2738HH国产' },
  { label: 'S136国产', value: 'S136国产' },
  { label: 'S136HH国产', value: 'S136HH国产' },
  { label: 'P20国产', value: 'P20国产' },
  { label: 'SKD-61', value: 'SKD-61' },
  { label: '718H国产', value: '718H国产' }
]

const queryMouldMaterialSuggestions = (queryString: string, cb: (items: any[]) => void) => {
  const q = String(queryString || '')
    .trim()
    .toLowerCase()
  const list = mouldMaterialOptions
    .map((x) => ({ value: x.value }))
    .filter((x) => (!q ? true : String(x.value).toLowerCase().includes(q)))
  cb(list)
}

const handleMaterialCaretMouseDown = (e: MouseEvent) => {
  const target = e.currentTarget as HTMLElement | null
  const input = target?.closest('.el-input')?.querySelector('input') as HTMLInputElement | null
  input?.focus()
}
const gateTypeOptions = [
  { label: '点浇口', value: '点浇口' },
  { label: '侧浇口', value: '侧浇口' },
  { label: '潜伏浇口', value: '潜伏浇口' }
]

const runnerCountInputRef = ref<any>()
const gateCountInputRef = ref<any>()

const editDialogBodyStyle = computed(() =>
  editDialogBaseHeight.value
    ? { '--pm-edit-body-fixed-height': `${editDialogBaseHeight.value}px` }
    : {}
)

const runnerCountModel = computed<number | undefined>({
  get: () => {
    const v = (editForm as any).流道数量
    return v === null || v === undefined || v === '' ? undefined : Number(v)
  },
  set: (val) => {
    ;(editForm as any).流道数量 = val === undefined ? null : val
  }
})

const runnerTypeModel = computed<string | undefined>({
  get: () => {
    const v = (editForm as any).流道类型
    return v === null || v === undefined || v === '' ? undefined : String(v)
  },
  set: (val) => {
    ;(editForm as any).流道类型 =
      val === undefined || val === null || val === '' ? null : String(val)
  }
})

const gateCountModel = computed<number | undefined>({
  get: () => {
    const v = (editForm as any).浇口数量
    return v === null || v === undefined || v === '' ? undefined : Number(v)
  },
  set: (val) => {
    ;(editForm as any).浇口数量 = val === undefined ? null : val
  }
})

const gateTypeModel = computed<string | undefined>({
  get: () => {
    const v = (editForm as any).浇口类型
    return v === null || v === undefined || v === '' ? undefined : String(v)
  },
  set: (val) => {
    ;(editForm as any).浇口类型 =
      val === undefined || val === null || val === '' ? null : String(val)
  }
})

const isPlasticMould = computed(() => String((editForm as any).分类 || '').trim() === '塑胶模具')

const corePullMethodOptions = ['斜导柱', '斜滑块', '油缸']
const ejectTypeOptions = ['圆顶', '方顶', '顶片']
const ejectWayOptions = ['机械顶出', '油缸顶出']
const resetWayOptions = ['弹簧复位', '氮气弹簧复位', '强制复位', '油缸复位']

const corePullSelected = ref<string[]>([])
const corePullQty = reactive<Record<string, number | undefined>>({
  斜导柱: undefined,
  斜滑块: undefined,
  油缸: undefined
})
const corePullQtyInputRefs = new Map<string, any>()
const setCorePullQtyInputRef = (method: string, el: any) => {
  if (el) corePullQtyInputRefs.set(method, el)
  else corePullQtyInputRefs.delete(method)
}

const handleCorePullToggle = (method: string, checked: unknown) => {
  const isChecked = Boolean(checked)
  const list = corePullSelected.value.slice()
  const idx = list.indexOf(method)
  if (isChecked) {
    if (idx === -1) list.push(method)
  } else if (idx !== -1) {
    list.splice(idx, 1)
  }
  corePullSelected.value = list
}

const splitCsv = (val: unknown) =>
  String(val || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)

const unique = <T,>(arr: T[]) => Array.from(new Set(arr))

const ejectTypeModel = computed<string[]>({
  get: () => unique(splitCsv((editForm as any).顶出类型)),
  set: (arr) => {
    ;(editForm as any).顶出类型 = arr.length ? arr.join(',') : null
  }
})
const ejectWayModel = computed<string[]>({
  get: () => unique(splitCsv((editForm as any).顶出方式)),
  set: (arr) => {
    ;(editForm as any).顶出方式 = arr.length ? arr.join(',') : null
  }
})
const resetWayModel = computed<string[]>({
  get: () => unique(splitCsv((editForm as any).复位方式)),
  set: (arr) => {
    ;(editForm as any).复位方式 = arr.length ? arr.join(',') : null
  }
})

const parseCorePullDetail = (val: unknown): { 方式: string; 数量: number | null }[] => {
  const raw = String(val || '').trim()
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((x) => ({
        方式: String(x?.方式 || '').trim(),
        数量: x?.数量 === null || x?.数量 === undefined || x?.数量 === '' ? null : Number(x?.数量)
      }))
      .filter((x) => x.方式)
      .map((x) => ({
        方式: x.方式,
        数量: Number.isFinite(x.数量 as number) ? (x.数量 as number) : null
      }))
  } catch {
    return []
  }
}

const initCorePullFromForm = () => {
  corePullSelected.value = []
  corePullMethodOptions.forEach((k) => {
    corePullQty[k] = undefined
  })
  if (!isPlasticMould.value) return

  const list = parseCorePullDetail((editForm as any).抽芯明细)
  const selected: string[] = []
  list.forEach((x) => {
    if (!corePullMethodOptions.includes(x.方式)) return
    selected.push(x.方式)
    corePullQty[x.方式] = x.数量 === null ? undefined : Number(x.数量)
  })
  corePullSelected.value = unique(selected)
}

const syncCorePullToForm = () => {
  // 分类未回填/非塑胶模具时，不主动清空，避免“打开弹窗时分类为空”导致把已保存数据误清空。
  // 真正需要清空（从塑胶模具切换到非塑胶模具）在 isPlasticMould 的 watch 里处理。
  if (!isPlasticMould.value) return
  const details = corePullSelected.value.map((方式) => ({
    方式,
    数量: corePullQty[方式] ?? null
  }))
  ;(editForm as any).抽芯明细 = details.length ? JSON.stringify(details) : null
}

const safeValidateFields = (fields: string[]) => {
  if (!editDialogVisible.value) return
  const form = editFormRef.value
  if (!form) return
  try {
    const ret = form.validateField?.(fields as any)
    // Element Plus: validateField 返回 Promise，失败会 reject（避免控制台 Uncaught）
    ;(ret as any)?.catch?.(() => {})
  } catch {
    // ignore
  }
}

watch(
  () => corePullSelected.value.slice(),
  (nextSelected, prevSelected) => {
    const prevSet = new Set(prevSelected || [])
    const nextSet = new Set(nextSelected || [])
    const added = (nextSelected || []).filter((k) => !prevSet.has(k))
    const removed = (prevSelected || []).filter((k) => !nextSet.has(k))

    // 被取消的项：清空数量
    removed.forEach((k) => {
      if (k in corePullQty) corePullQty[k] = undefined
    })
    syncCorePullToForm()

    // 新增勾选：自动聚焦数量输入
    if (added.length) {
      nextTick(() => {
        corePullQtyInputRefs.get(added[0])?.focus?.()
      })
    }
  }
)

watch(
  corePullQty,
  () => {
    syncCorePullToForm()
  },
  { deep: true }
)

const handleCorePullQtyChange = (method: string, val: unknown) => {
  if (!corePullSelected.value.includes(method)) return
  const n = Number(val)
  if (Number.isFinite(n) && n === 0) {
    corePullQty[method] = undefined
    ElMessage.error('抽芯数量不能为 0')
  }
}

const frontMouldMaterialModel = computed<string>({
  get: () => String((editForm as any).前模材质 ?? ''),
  set: (val) => {
    ;(editForm as any).前模材质 = String(val ?? '')
  }
})

const rearMouldMaterialModel = computed<string>({
  get: () => String((editForm as any).后模材质 ?? ''),
  set: (val) => {
    ;(editForm as any).后模材质 = String(val ?? '')
  }
})

const sliderMouldMaterialModel = computed<string>({
  get: () => String((editForm as any).滑块材质 ?? ''),
  set: (val) => {
    ;(editForm as any).滑块材质 = String(val ?? '')
  }
})

const materialUi = reactive({
  front: { hover: false, focus: false },
  rear: { hover: false, focus: false },
  slider: { hover: false, focus: false }
})

const showMaterialCaret = (value: string, ui: { hover: boolean; focus: boolean }) => {
  const v = String(value || '').trim()
  if (!v) return true
  // clear 图标出现时（hover/focus），隐藏下拉箭头，避免两个图标并排与位移
  return !(ui.hover || ui.focus)
}

const machineTonnageOptions = [
  { tonnage: 80, lockForce: 80, moldCapacity: 360, tiebarSpacing: '365*365' },
  { tonnage: 110, lockForce: 110, moldCapacity: 430, tiebarSpacing: '400*400' },
  { tonnage: 150, lockForce: 150, moldCapacity: 500, tiebarSpacing: '460*460' },
  { tonnage: 200, lockForce: 200, moldCapacity: 510, tiebarSpacing: '510*510' },
  { tonnage: 250, lockForce: 250, moldCapacity: 570, tiebarSpacing: '570*570' },
  { tonnage: 300, lockForce: 300, moldCapacity: 630, tiebarSpacing: '630*630' },
  { tonnage: 360, lockForce: 360, moldCapacity: 710, tiebarSpacing: '710*710' },
  { tonnage: 450, lockForce: 450, moldCapacity: 750, tiebarSpacing: '750*750' },
  { tonnage: 530, lockForce: 530, moldCapacity: 820, tiebarSpacing: '820*820' },
  { tonnage: 650, lockForce: 650, moldCapacity: 900, tiebarSpacing: '900*900' },
  { tonnage: 780, lockForce: 780, moldCapacity: 980, tiebarSpacing: '980*980' },
  { tonnage: 1000, lockForce: 1000, moldCapacity: 1100, tiebarSpacing: '1100*1100' },
  { tonnage: 1250, lockForce: 1250, moldCapacity: 1250, tiebarSpacing: '1250*1250' },
  { tonnage: 1600, lockForce: 1600, moldCapacity: 1400, tiebarSpacing: '1500*1350' },
  { tonnage: 1800, lockForce: 1800, moldCapacity: 1560, tiebarSpacing: '1650*1500' },
  { tonnage: 2500, lockForce: 2500, moldCapacity: 1800, tiebarSpacing: '1800*1600' }
] as const

const machineTonnageModel = computed<number | undefined>({
  get: () => {
    const v = (editForm as any).机台吨位
    if (v === null || v === undefined || v === '') return undefined
    const n = Number(v)
    return Number.isFinite(n) ? n : undefined
  },
  set: (val) => {
    ;(editForm as any).机台吨位 = val === undefined ? null : val
  }
})

const machineSpecUnlocked = computed(() => {
  const t = machineTonnageModel.value
  return Number.isFinite(Number(t)) && Number(t) > 0
})

const handleMachineTonnageClear = () => {
  handleMachineTonnageChange(undefined)
}

const handleMachineTonnageChange = (val: unknown) => {
  // 清除机台吨位时，同时清除关联字段
  if (val === undefined || val === null || val === '') {
    ;(editForm as any).锁模力 = null
    ;(editForm as any).定位圈 = null
    ;(editForm as any).容模量 = ''
    ;(editForm as any).拉杆间距 = ''
    return
  }
  const tonnage = Number(val)
  if (!Number.isFinite(tonnage) || tonnage <= 0) return

  const spec = machineTonnageOptions.find((x) => x.tonnage === tonnage)
  if (!spec) return
  ;(editForm as any).机台吨位 = spec.tonnage
  ;(editForm as any).锁模力 = spec.lockForce
  ;(editForm as any).容模量 = String(spec.moldCapacity)
  ;(editForm as any).拉杆间距 = spec.tiebarSpacing

  const locatingRing = Number((editForm as any).定位圈)
  if (!Number.isFinite(locatingRing) || locatingRing <= 0) {
    ;(editForm as any).定位圈 = 100
  }
}

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
    '浇口数量'
  ]
  return fields.every((key) => isFieldFilled((editForm as any)[key]))
})

const machineTabCompleted = computed(() => {
  const fields: (keyof ProjectInfo)[] = [
    '机台吨位',
    '锁模力',
    '定位圈',
    '容模量',
    '拉杆间距',
    '成型周期'
  ]
  return fields.every((key) => isFieldFilled((editForm as any)[key]))
})

const toNumber = (val: unknown) => {
  const n = typeof val === 'number' ? val : Number(val)
  return Number.isFinite(n) ? n : null
}

const isPositiveInteger = (val: unknown) => {
  const n = typeof val === 'number' ? val : Number(val)
  return Number.isInteger(n) && n > 0
}

const validateTripartiteAgreementForEdit = () => {
  const errors: string[] = []
  const add = (msg: string) => errors.push(msg)
  const filled = (v: unknown) => v !== null && v !== undefined && String(v).trim() !== ''

  // 2.1
  if (!filled(editForm.客户模号)) add('客户模号不能为空')
  if (!filled(editForm.productDrawing)) add('产品图号不能为空')
  if (!filled(editForm.productName)) add('产品名称不能为空')
  if (!filled((editForm as any).产品材质)) add('产品材质不能为空')
  if (!filled((editForm as any).前模材质)) add('前模材质不能为空')
  if (!filled((editForm as any).后模材质)) add('后模材质不能为空')
  if (!filled((editForm as any).滑块材质)) add('滑块材质不能为空')
  if (!filled((editForm as any).模具穴数)) add('模具穴数不能为空')
  if (!filled((editForm as any).首次送样日期)) add('首次送样日期不能为空')

  // 3.1.1
  const runnerType = String((editForm as any).流道类型 || '').trim()
  const runnerAllowed = ['冷流道', '开放式热流道', '点浇口热流道', '针阀式热流道']
  if (!runnerAllowed.includes(runnerType)) add('流道及类型必须选择一项')
  if (!isPositiveInteger((editForm as any).流道数量))
    add('流道数量必须为正整数（不能为 0，也不能为小数）')

  const gateType = String((editForm as any).浇口类型 || '').trim()
  const gateAllowed = ['直接浇口', '点浇口', '侧浇口', '潜伏浇口']
  if (!gateAllowed.includes(gateType)) add('浇口类型必须选择一项')
  if (!isPositiveInteger((editForm as any).浇口数量))
    add('浇口数量必须为正整数（不能为 0，也不能为小数）')

  const partWeight = toNumber((editForm as any).产品重量)
  if (partWeight === null) add('产品重量必须有数值')
  const cycle = toNumber((editForm as any).成型周期)
  if (cycle === null) add('成型周期必须有数值')

  const sprueWeightRaw = (editForm as any).料柄重量
  const sprueEmpty =
    sprueWeightRaw === null || sprueWeightRaw === undefined || String(sprueWeightRaw).trim() === ''
  if (sprueEmpty) {
    if (runnerType && runnerType !== '针阀式热流道')
      add('料柄重量为空时，流道类型必须为“针阀式热流道”')
  } else if (toNumber(sprueWeightRaw) === null) {
    add('料柄重量必须为数值或为空')
  }

  // 3.1.2 联动
  const ejectTypeSelected = splitCsv((editForm as any).顶出类型).length > 0
  const ejectWaySelected = splitCsv((editForm as any).顶出方式).length > 0
  const resetWaySelected = splitCsv((editForm as any).复位方式).length > 0
  const anySelected = ejectTypeSelected || ejectWaySelected || resetWaySelected
  if (anySelected && !(ejectTypeSelected && ejectWaySelected && resetWaySelected)) {
    add('顶出类型、顶出方式、复位方式需同时至少选择一项（或三项都不选）')
  }

  // 3.2
  if (!filled((editForm as any).模具尺寸)) add('模具尺寸不能为空')
  if (!filled((editForm as any).模具重量)) add('模具重量不能为空')
  if (!filled((editForm as any).锁模力)) add('锁模力不能为空')
  if (!filled((editForm as any).定位圈)) add('定位圈不能为空')
  if (!filled((editForm as any).容模量)) add('容模量不能为空')
  if (!filled((editForm as any).拉杆间距)) add('拉杆间距不能为空')

  return errors
}

const editRules: FormRules = {
  项目编号: [{ required: true, message: '请输入项目编号', trigger: 'blur' }],
  产品重量: [
    {
      validator: (_rule, value, callback) => {
        if (value === null || value === undefined || value === '') return callback()
        const n = Number(value)
        if (!Number.isFinite(n)) return callback(new Error('产品重量必须有数值'))
        return callback()
      },
      trigger: ['blur', 'change']
    }
  ],
  成型周期: [
    {
      validator: (_rule, value, callback) => {
        if (value === null || value === undefined || value === '') return callback()
        const n = Number(value)
        if (!Number.isFinite(n)) return callback(new Error('成型周期必须有数值'))
        return callback()
      },
      trigger: ['blur', 'change']
    }
  ],
  流道数量: [
    {
      validator: (_rule, value, callback) => {
        if (!editForm.流道类型) return callback()
        if (value === null || value === undefined || value === '') {
          return callback(new Error('请选择流道类型后，流道数量不能为空'))
        }
        const n = Number(value)
        if (!Number.isFinite(n) || n <= 0) {
          return callback(new Error('流道数量必须大于 0'))
        }
        if (!Number.isInteger(n)) {
          return callback(new Error('流道数量必须为整数'))
        }
        return callback()
      },
      trigger: ['blur', 'change']
    }
  ],
  浇口数量: [
    {
      validator: (_rule, value, callback) => {
        if (!editForm.浇口类型) return callback()
        if (value === null || value === undefined || value === '') {
          return callback(new Error('请选择浇口类型后，浇口数量不能为空'))
        }
        const n = Number(value)
        if (!Number.isFinite(n) || n <= 0) {
          return callback(new Error('浇口数量必须大于 0'))
        }
        if (!Number.isInteger(n)) {
          return callback(new Error('浇口数量必须为整数'))
        }
        return callback()
      },
      trigger: ['blur', 'change']
    }
  ]
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

    // 时间轴视图：数据加载后，如果有数据且没有选中项目，自动选中第一个
    if (!isMobile.value && viewMode.value === 'timeline') {
      await nextTick()
      if (projectGroups.value.length > 0 && !timelineActiveProjectCode.value) {
        const firstGroup = projectGroups.value[0]
        if (firstGroup.projects.length > 0) {
          const firstProject = firstGroup.projects[0]
          timelineActiveProjectCode.value = firstProject.项目编号 || null
          void loadProjectForTimeline(firstProject.项目编号 || '')
        }
      }
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

      // 同步到store，用于工具栏显示
      appStore.setProjectManagementSummary({
        totalProjects: summary.totalProjects,
        designingProjects: summary.designingProjects,
        processingProjects: summary.processingProjects,
        completedProjects: summary.completedProjects
      })
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

const formatProductSizeDisplay = (value: any) => {
  const sizes = parseProductSize(value)
    .map((s) => String(s || '').trim())
    .filter(Boolean)
  if (sizes.length === 0) return '-'
  return sizes.length === 1 ? sizes[0] : sizes.join('/')
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

// 时间轴视图的详情部分
const timelineDetailSections = computed<DetailSection[]>(() => {
  const data = viewProjectData.value || {}

  const v = (val?: string | number | null) => {
    const res = formatValue(val)
    return typeof res === 'number' ? String(res) : (res ?? '-')
  }

  const productInfo: DetailItem[] = [
    {
      label: '产品尺寸',
      value: formatProductSizeDisplay((data as any).产品尺寸)
    },
    { label: '产品重量（克）', value: v(data.产品重量 ?? '') },
    { label: '产品材质', value: v(data.产品材质 ?? '') },
    { label: '产品颜色', value: v(data.产品颜色 ?? '') },
    { label: '收缩率', value: v(data.收缩率 ?? '') },
    { label: '料柄重量', value: v(data.料柄重量 ?? '') }
  ]

  const mouldInfo: DetailItem[] = [
    {
      label: '模具穴数',
      value: (() => {
        const cavity = data.模具穴数
        if (!cavity) return '-'
        const total = parseCavityExpression(cavity)
        const expr = String(cavity)
        if (expr.includes('+') || expr.includes('*')) {
          return `${total}穴 (${expr})`
        }
        return `${total}穴`
      })()
    },
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
    { label: '成型周期', value: v(data.成型周期 ?? '') }
  ]

  const dateInfo: DetailItem[] = [
    { label: '中标日期', value: formatDate(data.中标日期 ?? '') },
    { label: '产品3D确认', value: formatDate(data.产品3D确认 ?? '') },
    { label: '图纸下发日期', value: formatDate(data.图纸下发日期 ?? '') },
    { label: '计划首样日期', value: formatDate(data.计划首样日期 ?? '') },
    { label: '首次送样日期', value: formatDate(data.首次送样日期 ?? '') },
    { label: '封样时间', value: formatDate(data.封样时间 ?? '') },
    { label: '移模日期', value: formatDate(data.移模日期 ?? '') }
  ]

  return [
    { title: '零件信息', items: productInfo },
    { title: '模具信息', items: mouldInfo },
    { title: '设备信息', items: equipmentInfo },
    { title: '日期信息', items: dateInfo }
  ]
})

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
    { label: '封样单号', value: v((data as any).封样单号 ?? '') },
    { label: '进度影响原因', value: v(data.进度影响原因 ?? '') },
    { label: '备注', value: v(data.备注 ?? '') }
  ]

  const productInfo: DetailItem[] = [
    {
      label: '产品尺寸',
      value: formatProductSizeDisplay((data as any).产品尺寸)
    },
    { label: '产品重量（克）', value: v(data.产品重量 ?? '') },
    { label: '产品材质', value: v(data.产品材质 ?? '') },
    { label: '产品颜色', value: v(data.产品颜色 ?? '') },
    { label: '收缩率', value: v(data.收缩率 ?? '') },
    { label: '料柄重量', value: v(data.料柄重量 ?? '') }
  ]

  const mouldInfo: DetailItem[] = [
    {
      label: '模具穴数',
      value: (() => {
        const cavity = data.模具穴数
        if (!cavity) return '-'
        const total = parseCavityExpression(cavity)
        const expr = String(cavity)
        if (expr.includes('+') || expr.includes('*')) {
          return `${total}穴 (${expr})`
        }
        return `${total}穴`
      })()
    },
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
    { title: '设备与工艺参数', items: equipmentInfo },
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

const handleResetInit = async () => {
  const projectCode = currentProjectCode.value
  if (!projectCode) return

  // 只有分类为"塑胶模具"时才能重置初始化
  const category = String((editForm as any).分类 || '').trim()
  if (category !== '塑胶模具') {
    ElMessage.warning('只有分类为"塑胶模具"的项目才能使用初始化功能')
    return
  }

  try {
    await ElMessageBox.confirm(
      '将重置该项目的初始化标记，并在关闭编辑后重新进入初始化流程。是否继续？',
      '重置初始化',
      {
        type: 'warning',
        confirmButtonText: '继续',
        cancelButtonText: '取消'
      }
    )
  } catch {
    return
  }

  // 方案 A：重置数据库标记（允许再次初始化）
  try {
    await updateProjectApi(projectCode, { init_done: 0 })
    ;(editForm as any).init_done = 0
  } catch {
    ElMessage.error('重置初始化失败')
    return
  }

  initDialogInitialGroups.value = buildDefaultInitGroups(projectCode, (editForm as any).模具穴数)

  editDialogVisible.value = false
  nextTick(() => {
    initDialogVisible.value = true
  })
}

const openEditDialog = async () => {
  editDialogVisible.value = true

  const projectCode = currentProjectCode.value
  if (projectCode) {
    loadAttachments()
    loadProductionTaskAttachments()
  }

  setEditFormSnapshot()
}

const handleInitComplete = async (groups: InitProductGroupPersisted[], specData?: any) => {
  const projectCode = currentProjectCode.value
  if (!projectCode) return

  const safeGroups = (groups || []).map((g) => ({
    cavityCount: toSafeCavity(g?.cavityCount)
  }))

  // 生成表达式格式（如 "2+2" 或 "4"）
  const expression = generateCavityExpression(safeGroups)
  // 计算总穴数（用于验证和显示）
  const total = safeGroups.reduce((sum, g) => sum + toSafeCavity(g.cavityCount), 0)

  console.log('[初始化完成] 产品组:', safeGroups)
  console.log('[初始化完成] 表达式:', expression)
  console.log('[初始化完成] 总穴数:', total)
  console.log('[初始化完成] 技术规格表数据:', specData)

  // 只更新 editForm 的本地数据，不保存到数据库
  // 数据将在编辑弹窗中点击"保存"按钮时一起保存
  ;(editForm as any).模具穴数 = expression

  // 如果有技术规格表数据，映射到 editForm（不保存到数据库）
  if (specData) {
    // 字段映射：技术规格表 -> editForm 字段
    if (specData.材料) {
      ;(editForm as any).产品材质 = specData.材料
    }
    if (specData.型腔) {
      ;(editForm as any).前模材质 = specData.型腔
    }
    if (specData.型芯) {
      ;(editForm as any).后模材质 = specData.型芯
    }
    if (specData.产品结构工程师) {
      ;(editForm as any).设计师 = specData.产品结构工程师
    }

    // 处理产品列表和产品尺寸列表
    if (specData.产品列表 && Array.isArray(specData.产品列表) && specData.产品列表.length > 0) {
      const 技术规格表图号列表 = specData.产品列表
      const 技术规格表尺寸列表 = specData.产品尺寸列表 || []
      const 技术规格表名称列表 = specData.产品名称列表 || []
      const 技术规格表数量列表 = specData.产品数量列表 || []
      const 技术规格表重量列表 = specData.产品重量列表 || []

      // 确保尺寸列表长度与图号列表一致
      while (技术规格表尺寸列表.length < 技术规格表图号列表.length) {
        技术规格表尺寸列表.push('')
      }
      while (技术规格表尺寸列表.length > 技术规格表图号列表.length) {
        技术规格表尺寸列表.pop()
      }

      // 确保名称列表长度与图号列表一致
      while (技术规格表名称列表.length < 技术规格表图号列表.length) {
        技术规格表名称列表.push('')
      }
      while (技术规格表名称列表.length > 技术规格表图号列表.length) {
        技术规格表名称列表.pop()
      }

      // 确保数量列表长度与图号列表一致
      while (技术规格表数量列表.length < 技术规格表图号列表.length) {
        技术规格表数量列表.push(0)
      }
      while (技术规格表数量列表.length > 技术规格表图号列表.length) {
        技术规格表数量列表.pop()
      }

      // 确保重量列表长度与图号列表一致
      while (技术规格表重量列表.length < 技术规格表图号列表.length) {
        技术规格表重量列表.push(0)
      }
      while (技术规格表重量列表.length > 技术规格表图号列表.length) {
        技术规格表重量列表.pop()
      }

      // 获取现有的图号列表和尺寸列表
      const 现有图号列表 = parseProductDrawingList(getProductListRawFromEditForm())
      const 现有尺寸列表 = parseProductSize(editForm.产品尺寸)
      const 现有名称列表 = parseProductNameList((editForm as any).产品名称列表)
      const 现有数量列表 = parseProductQtyList((editForm as any).产品数量列表)
      const 现有重量列表 = parseProductWeightList((editForm as any).产品重量列表)

      // 确保现有列表长度一致
      const 现有最大长度 = Math.max(
        现有图号列表.length,
        现有尺寸列表.length,
        现有名称列表.length,
        现有数量列表.length,
        现有重量列表.length
      )
      while (现有图号列表.length < 现有最大长度) {
        现有图号列表.push('')
      }
      while (现有尺寸列表.length < 现有最大长度) {
        现有尺寸列表.push('')
      }
      while (现有名称列表.length < 现有最大长度) {
        现有名称列表.push('')
      }
      while (现有数量列表.length < 现有最大长度) {
        现有数量列表.push(0)
      }
      while (现有重量列表.length < 现有最大长度) {
        现有重量列表.push(0)
      }

      // 合并技术规格表的数据到现有列表
      for (let i = 0; i < 技术规格表图号列表.length; i++) {
        const 新图号 = 技术规格表图号列表[i]?.trim() || ''
        const 新尺寸 = 技术规格表尺寸列表[i]?.trim() || ''
        const 新名称 = 技术规格表名称列表[i]?.trim() || ''
        const 新数量 = Number.isFinite(技术规格表数量列表[i] as any)
          ? Number(技术规格表数量列表[i])
          : 0
        const 新重量 = Number.isFinite(技术规格表重量列表[i] as any)
          ? Number(技术规格表重量列表[i])
          : 0

        if (!新图号) continue

        // 检查图号是否已存在于列表中
        const 现有索引 = 现有图号列表.findIndex((图号) => 图号?.trim() === 新图号)

        if (现有索引 >= 0) {
          // 图号已存在，提示用户确认是否更新
          try {
            await ElMessageBox.confirm(
              `图号 "${新图号}" 已存在于列表中，是否更新对应行的尺寸？`,
              '图号已存在',
              {
                type: 'warning',
                confirmButtonText: '更新',
                cancelButtonText: '跳过'
              }
            )
            // 用户确认更新
            现有尺寸列表[现有索引] = 新尺寸
            if (!String(现有名称列表[现有索引] || '').trim() && 新名称) {
              现有名称列表[现有索引] = 新名称
            }
            if (!Number(现有数量列表[现有索引] || 0) && 新数量) {
              现有数量列表[现有索引] = Math.max(0, Math.trunc(新数量))
            }
            if (!Number(现有重量列表[现有索引] || 0) && 新重量) {
              现有重量列表[现有索引] = Math.max(0, 新重量)
            }
          } catch {
            // 用户取消，跳过该图号
            continue
          }
        } else {
          // 图号不存在，添加新行
          现有图号列表.push(新图号)
          现有尺寸列表.push(新尺寸)
          现有名称列表.push(新名称)
          现有数量列表.push(Math.max(0, Math.trunc(新数量)))
          现有重量列表.push(Math.max(0, 新重量))
        }
      }

      // 更新editForm
      ;(editForm as any).产品列表 = 现有图号列表
      editForm.产品尺寸 = 现有尺寸列表 as any
      ;(editForm as any).产品名称列表 = 现有名称列表
      ;(editForm as any).产品数量列表 = 现有数量列表
      ;(editForm as any).产品重量列表 = 现有重量列表
      syncMainDrawingRowToForm()

      console.log('[初始化完成] 合并后的产品列表:', 现有图号列表)
      console.log('[初始化完成] 合并后的产品尺寸列表:', 现有尺寸列表)
    } else if (specData.产品外观尺寸) {
      // 如果没有图号列表，只有单个尺寸，使用旧的方式
      ;(editForm as any).产品尺寸 = specData.产品外观尺寸
    }
    // 零件图片需要特殊处理（需要上传到服务器获得URL）
    if (specData.零件图片) {
      try {
        // 如果图片是base64，需要转换为File并上传
        if (typeof specData.零件图片 === 'string' && specData.零件图片.startsWith('data:')) {
          // base64图片，需要转换为File并上传
          const base64Data = specData.零件图片
          const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/)
          if (matches && matches.length === 3) {
            const mimeType = matches[1]
            const base64String = matches[2]
            const byteCharacters = atob(base64String)
            const byteNumbers = new Array(byteCharacters.length)
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i)
            }
            const byteArray = new Uint8Array(byteNumbers)
            const blob = new Blob([byteArray], { type: mimeType })
            const file = new File([blob], 'spec-image.png', { type: mimeType })

            // 上传图片（获得URL，但不保存到数据库）
            const { uploadProjectPartImageApi } = await import('@/api/project')
            const resp: any = await uploadProjectPartImageApi(projectCode, file)
            if (resp?.data?.url) {
              ;(editForm as any).零件图示URL = resp.data.url
              console.log('[初始化完成] 零件图片已上传:', resp.data.url)
            }
          }
        } else if (typeof specData.零件图片 === 'string' && specData.零件图片.startsWith('http')) {
          // URL图片，直接使用
          ;(editForm as any).零件图示URL = specData.零件图片
          console.log('[初始化完成] 零件图片URL:', specData.零件图片)
        }
      } catch (error: any) {
        console.error('[初始化完成] 零件图片处理失败:', error)
        ElMessage.warning('零件图片处理失败，可在编辑弹窗中重新上传')
      }
    }
  }

  // 将初始化产品组的“产品图号”代入到“产品列表”
  applyInitGroupsToProductDrawingList(groups)

  // 产品图号形如 C25066.22.1.1 时，取前缀 C25066 作为“项目名称”自动回填
  if (!String(editForm.项目名称 || '').trim()) {
    const firstGroupDrawing = groups?.find((g) =>
      String(g?.productDrawing || '').trim()
    )?.productDrawing
    const projectName = extractProjectNameFromProductDrawing(
      firstGroupDrawing || editForm.productDrawing
    )
    if (projectName) {
      ;(editForm as any).项目名称 = projectName
    }
  }

  // 标记初始化完成（仅本地标记，保存时一起写入数据库）
  ;(editForm as any).init_done = 1

  // 直接打开编辑对话框，不保存数据
  // 用户需要在编辑对话框中点击"保存"按钮才会保存到数据库
  nextTick(() => openEditDialog())
}

const handleEdit = async (row: Partial<ProjectInfo>) => {
  editTitle.value = '编辑项目'
  const projectCode = row.项目编号 || ''
  currentProjectCode.value = projectCode

  // 先用列表行数据填充，避免弹窗打开前无内容
  Object.assign(editForm, row)

  // 编辑：优先拉取详情，确保新字段（如 抽芯明细/顶出/复位）能回显
  if (projectCode) {
    try {
      const response: any = await getProjectDetailApi(projectCode)
      const detail = response?.data?.data || response?.data || null
      if (detail) {
        Object.assign(editForm, detail)
        console.log('[编辑项目] 加载详情，零件图示URL:', detail.零件图示URL)

        // 如果模具穴数是纯数字格式，转换为表达式格式（如 "4" -> "1*4"）
        const cavityCount = (detail as any).模具穴数
        if (cavityCount && typeof cavityCount === 'string') {
          const cavityStr = String(cavityCount).trim()
          // 如果是纯数字（不包含 + 或 *），转换为 1*数字 格式
          if (cavityStr && !cavityStr.includes('+') && !cavityStr.includes('*')) {
            const num = Number(cavityStr)
            if (Number.isFinite(num) && num > 0) {
              ;(editForm as any).模具穴数 = `1*${num}`
              console.log('[编辑项目] 转换模具穴数格式:', cavityStr, '->', `1*${num}`)
            }
          }
        }

        // 处理产品列表和产品尺寸的兼容
        // 确保数据格式正确（JSON数组）
        ;(editForm as any).产品列表 = parseProductDrawingList(
          (detail as any).产品列表 ?? (detail as any).产品图号列表
        )
        ;(editForm as any).产品名称列表 = parseProductNameList((detail as any).产品名称列表)
        ;(editForm as any).产品数量列表 = parseProductQtyList((detail as any).产品数量列表)
        ;(editForm as any).产品重量列表 = parseProductWeightList((detail as any).产品重量列表)
        editForm.产品尺寸 = parseProductSize(detail.产品尺寸) as any
        syncMainDrawingRowToForm()

        console.log(
          '[编辑项目] 产品列表:',
          parseProductDrawingList(getProductListRawFromEditForm())
        )
        console.log('[编辑项目] 产品尺寸列表:', parseProductSize(editForm.产品尺寸))
      }
    } catch {
      // ignore：详情失败时回退到列表行数据
    }

    // 编辑时自动加载货物信息（用于分类/产品信息等）
    await handleProjectCodeBlur()
  }

  // 若已有吨位，则自动补齐设备参数（不覆盖已填定位圈）
  if (machineTonnageModel.value !== undefined) {
    handleMachineTonnageChange(machineTonnageModel.value)
  }

  if (shouldShowInitDialog(projectCode)) {
    initDialogInitialGroups.value = buildDefaultInitGroups(projectCode, (editForm as any).模具穴数)
    initDialogVisible.value = true
    return
  }

  openEditDialog()
}

// 附件相关状态
const attachmentLoading = ref(false)
const allAttachments = ref<ProjectAttachment[]>([])

const relocationProcessAttachments = computed(() =>
  allAttachments.value.filter((item) => item.type === 'relocation-process')
)
const trialRecordAttachments = computed(() =>
  allAttachments.value.filter((item) => item.type === 'trial-record')
)
const tripartiteAgreementAttachments = computed(() =>
  allAttachments.value.filter((item) => item.type === 'tripartite-agreement')
)
const trialFormAttachments = computed(() =>
  allAttachments.value.filter((item) => item.type === 'trial-form')
)
const drawingAttachments = computed(() =>
  allAttachments.value.filter((item) => item.type === 'drawing')
)
const sealSampleAttachments = computed(() =>
  allAttachments.value.filter((item) => item.type === 'seal-sample')
)

// 零件图示相关状态
const partImageUploading = ref(false)
const partImageFileInputRef = ref<HTMLInputElement>()
const TEMP_PART_IMAGE_PREFIX = '/uploads/_temp/project-images/'

const isTempPartImageUrl = (url: any) => String(url || '').startsWith(TEMP_PART_IMAGE_PREFIX)

const toPartImageDisplayUrl = (imageUrl: any) => {
  const url = String(imageUrl || '').trim()
  if (!url) {
    console.log('[图示预览] URL为空')
    return ''
  }
  // 所有图片都通过API预览接口访问（兼容临时和正式路径）
  const displayUrl = `/api/project/part-image?url=${encodeURIComponent(url)}`
  console.log('[图示预览] 原始URL:', url)
  console.log('[图示预览] 显示URL:', displayUrl)
  return displayUrl
}

const deleteTempPartImageIfNeeded = async (imageUrl: any) => {
  const url = String(imageUrl || '').trim()
  if (!isTempPartImageUrl(url)) return
  try {
    await deleteProjectTempPartImageApi(url)
  } catch (e) {
    console.warn('删除临时图示失败（忽略）:', e)
  }
}

// 上传零件图示
const uploadPartImage = async (file: File) => {
  if (!file) return
  const projectCode = editForm.项目编号 || currentProjectCode.value
  if (!projectCode) {
    ElMessage.warning('请先填写项目编号后再上传图示')
    return
  }

  partImageUploading.value = true

  // 保存旧的图片URL，如果上传失败则恢复
  const oldImageUrl = editForm.零件图示URL

  try {
    // 先上传新图片，成功后再删除旧图片
    const resp: any = await uploadProjectPartImageApi(projectCode, file)
    const pr: any = resp
    const url = pr?.data?.url || pr?.data?.data?.url || ''
    if (!url) {
      ElMessage.error(pr?.message || '上传失败')
      return
    }

    // 上传成功后才删除旧图片
    if (oldImageUrl) {
      await deleteTempPartImageIfNeeded(oldImageUrl)
    }
    editForm.零件图示URL = url
  } catch (error) {
    console.error('上传图示失败:', error)
    ElMessage.error('上传图示失败')
    // 上传失败时保持旧图片URL不变
  } finally {
    partImageUploading.value = false
  }
}

// 点击选择文件
const handlePickPartImage = () => {
  partImageFileInputRef.value?.click()
}

// 聚焦图片容器（用于粘贴）
const handleFocusPartImageCell = (e: MouseEvent) => {
  const el = e.currentTarget as HTMLElement | null
  el?.focus?.()
}

// 文件选择变化
const handlePartImageFileChange = async (e: Event) => {
  const input = e.target as HTMLInputElement | null
  const file = input?.files?.[0]
  if (input) input.value = ''
  if (!file) return
  await uploadPartImage(file)
}

// 粘贴图片
const handlePartImagePaste = async (e: ClipboardEvent) => {
  const items = e.clipboardData?.items ? Array.from(e.clipboardData.items) : []
  const imageItem = items.find((it) => String(it.type || '').startsWith('image/'))
  if (!imageItem) return
  const file = imageItem.getAsFile()
  if (!file) return
  e.preventDefault()
  await uploadPartImage(file)
}

// 拖拽悬停
const handlePartImageDragOver = (e: DragEvent) => {
  e.preventDefault()
}

// 拖拽放下
const handlePartImageDrop = async (e: DragEvent) => {
  e.preventDefault()
  const file = e.dataTransfer?.files?.[0]
  if (!file) return
  if (!String(file.type || '').startsWith('image/')) {
    ElMessage.warning('仅支持拖拽图片文件')
    return
  }
  await uploadPartImage(file)
}

// 清除图片
const handleRemovePartImage = async () => {
  try {
    await ElMessageBox.confirm('确定清除图示吗？', '提示', {
      confirmButtonText: '清除',
      cancelButtonText: '取消',
      type: 'warning'
    })
  } catch {
    return
  }
  await deleteTempPartImageIfNeeded(editForm.零件图示URL)
  editForm.零件图示URL = ''
}

// 清理临时图片
const cleanupTempPartImage = async () => {
  const url = String(editForm.零件图示URL || '').trim()
  if (!url) return
  await deleteTempPartImageIfNeeded(url)
}

// 生产任务附件相关状态
const productionTaskAttachmentLoading = ref(false)
const productionTaskPhotoAttachments = ref<ProductionTaskAttachment[]>([])
const productionTaskInspectionAttachments = ref<ProductionTaskAttachment[]>([])

const productionTaskPhotoAppearanceAttachments = computed(() =>
  productionTaskPhotoAttachments.value.filter((a) => a.tag === 'appearance')
)
const productionTaskPhotoNameplateAttachments = computed(() =>
  productionTaskPhotoAttachments.value.filter((a) => a.tag === 'nameplate')
)

// 加载附件列表
const loadAttachments = async () => {
  const projectCode = editForm.项目编号 || currentProjectCode.value
  if (!projectCode) {
    allAttachments.value = []
    return
  }

  attachmentLoading.value = true
  try {
    const response: any = await getProjectAttachmentsApi(projectCode)
    // 根据 axios 拦截器的处理，response 已经是后端返回的 { code, success, data: [...] } 对象
    // 所以应该直接访问 response.data 获取数组（类似生产任务的实现：photoResp?.data）
    allAttachments.value = response?.data || []
    console.log(
      '加载附件列表成功，项目编号:',
      projectCode,
      '附件数量:',
      allAttachments.value.length,
      '响应:',
      response
    )
  } catch (error: any) {
    console.error('加载附件列表失败:', error)
    ElMessage.error(error?.message || '加载附件列表失败')
    allAttachments.value = []
  } finally {
    attachmentLoading.value = false
  }
}

// 加载生产任务附件列表
const loadProductionTaskAttachments = async () => {
  const projectCode = editForm.项目编号 || currentProjectCode.value
  if (!projectCode) {
    productionTaskPhotoAttachments.value = []
    productionTaskInspectionAttachments.value = []
    return
  }

  productionTaskAttachmentLoading.value = true
  try {
    const [photoResp, inspectionResp]: any[] = await Promise.all([
      getProductionTaskAttachmentsApi(projectCode, 'photo'),
      getProductionTaskAttachmentsApi(projectCode, 'inspection')
    ])
    productionTaskPhotoAttachments.value = photoResp?.data || []
    productionTaskInspectionAttachments.value = inspectionResp?.data || []
  } catch (error) {
    console.error('加载生产任务附件失败:', error)
    productionTaskPhotoAttachments.value = []
    productionTaskInspectionAttachments.value = []
  } finally {
    productionTaskAttachmentLoading.value = false
  }
}

// 获取上传API地址
const getAttachmentAction = (type: ProjectAttachmentType) => {
  const projectCode = String(editForm.项目编号 || currentProjectCode.value || '').trim()
  // 直接返回URL，即使项目编号为空也返回（让后端处理验证）
  // 这样可以避免在页面初始化时就显示错误提示
  return `/api/project/${encodeURIComponent(projectCode || '')}/attachments/${type}`
}

// 上传前确认（用于单文件类型的覆盖确认）
const beforeAttachmentUpload = async (_file: File, type: ProjectAttachmentType) => {
  // 单文件类型需要确认覆盖
  const singleFileTypes: ProjectAttachmentType[] = [
    'relocation-process',
    'trial-record',
    'tripartite-agreement',
    'seal-sample'
  ]

  if (singleFileTypes.includes(type)) {
    // 检查是否已有文件
    let existingAttachments: ProjectAttachment[] = []
    if (type === 'relocation-process') {
      existingAttachments = relocationProcessAttachments.value
    } else if (type === 'trial-record') {
      existingAttachments = trialRecordAttachments.value
    } else if (type === 'tripartite-agreement') {
      existingAttachments = tripartiteAgreementAttachments.value
    } else if (type === 'seal-sample') {
      existingAttachments = sealSampleAttachments.value
    }

    if (existingAttachments.length > 0) {
      const oldFileName =
        existingAttachments[0].storedFileName || existingAttachments[0].originalName
      try {
        await ElMessageBox.confirm(
          `已存在文件：${oldFileName}。确认上传将覆盖现有文件，是否继续？`,
          '确认覆盖',
          {
            confirmButtonText: '确认覆盖',
            cancelButtonText: '取消',
            type: 'warning',
            closeOnClickModal: false
          }
        )
        return true
      } catch {
        return false // 用户取消，阻止上传
      }
    }
  }

  return true // 没有旧文件或不是单文件类型，允许上传
}

// 上传成功回调
const handleAttachmentUploadSuccess = (response: any) => {
  console.log('上传响应:', response)
  // 处理不同的响应结构：response.code 或 response.data?.code
  const code = response?.code ?? response?.data?.code
  const success = response?.success ?? response?.data?.success

  if (code === 0 || success) {
    ElMessage.success('上传成功')
    // 延迟一点再加载，确保数据库已更新
    setTimeout(() => {
      loadAttachments()
    }, 200)
  } else {
    ElMessage.error(response?.message || response?.data?.message || '上传失败')
  }
}

// 上传失败回调
const handleAttachmentUploadError = (error: any) => {
  console.error('上传附件失败:', error)
  ElMessage.error(error?.message || '上传失败')
}

// 判断附件是否为图片
const isImageFile = (attachment: ProjectAttachment): boolean => {
  if (attachment.contentType && attachment.contentType.startsWith('image/')) {
    return true
  }
  const fileName = attachment.storedFileName || attachment.originalName || ''
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico']
  return imageExts.includes(ext)
}

// 判断附件是否为 PDF
const isPdfFile = (attachment: ProjectAttachment): boolean => {
  if (attachment.contentType === 'application/pdf') {
    return true
  }
  const fileName = attachment.storedFileName || attachment.originalName || ''
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  return ext === 'pdf'
}

// 预览图片附件
const handleAttachmentPreview = async (attachment: ProjectAttachment) => {
  if (!isImageFile(attachment)) {
    ElMessage.warning('该文件不是图片格式')
    return
  }

  try {
    // 获取同类型的所有图片附件
    const sameTypeAttachments = allAttachments.value.filter(
      (item) => item.type === attachment.type && isImageFile(item)
    )
    if (sameTypeAttachments.length === 0) {
      ElMessage.warning('没有可预览的图片')
      return
    }

    const currentIndex = sameTypeAttachments.findIndex((item) => item.id === attachment.id)

    const urlList: string[] = []
    const blobUrls: string[] = []

    try {
      const blobPromises = sameTypeAttachments.map(async (item) => {
        try {
          const resp = await downloadProjectAttachmentApi(item.id)
          const blob = (resp as any)?.data ?? resp
          const url = window.URL.createObjectURL(blob as Blob)
          blobUrls.push(url)
          return url
        } catch (error) {
          console.error(`加载图片 ${item.storedFileName || item.originalName} 失败:`, error)
          return null
        }
      })

      const urls = await Promise.all(blobPromises)
      urlList.push(...urls.filter((url): url is string => url !== null))

      if (urlList.length === 0) {
        ElMessage.warning('加载图片失败')
        return
      }

      createImageViewer({
        urlList,
        initialIndex: currentIndex >= 0 ? currentIndex : 0,
        infinite: true,
        hideOnClickModal: true,
        zIndex: 3000,
        teleported: true
      })
    } catch (error) {
      blobUrls.forEach((url) => window.URL.revokeObjectURL(url))
      throw error
    }
  } catch (error) {
    console.error('预览图片失败:', error)
    ElMessage.error('预览图片失败')
  }
}

// 预览 PDF 附件
const handleAttachmentPdfPreview = async (attachment: ProjectAttachment) => {
  if (!isPdfFile(attachment)) {
    ElMessage.warning('该文件不是 PDF 格式')
    return
  }

  try {
    const resp = await downloadProjectAttachmentApi(attachment.id)
    const blob = (resp as any)?.data ?? resp
    const url = window.URL.createObjectURL(blob as Blob)

    if (isMobile.value) {
      const newWindow = window.open(url, '_blank')
      if (!newWindow) {
        ElMessage.warning('请允许弹出窗口以预览 PDF')
        window.URL.revokeObjectURL(url)
      }
    } else {
      createPdfViewer({
        url,
        fileName: attachment.storedFileName || attachment.originalName || 'PDF 文件'
      })
    }
  } catch (error) {
    console.error('预览 PDF 失败:', error)
    ElMessage.error('预览 PDF 失败')
  }
}

// 下载附件
const downloadAttachment = async (row: ProjectAttachment) => {
  try {
    const resp: any = await downloadProjectAttachmentApi(row.id)
    const blob = ((resp as any)?.data ?? resp) as Blob
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = row.storedFileName || row.originalName || `附件_${row.id}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  } catch (error: any) {
    console.error('下载附件失败:', error)
    ElMessage.error(error?.message || '下载失败')
  }
}

const normalizeTrialCountInput = (val: any) => {
  const raw = String(val || '')
    .trim()
    .replace(/\s+/g, '')
  if (!raw) return null
  let n: number | null = null
  if (/^\d+$/.test(raw)) {
    n = parseInt(raw, 10)
  } else if (/^第\d+次$/.test(raw)) {
    n = parseInt(raw.slice(1, -1), 10)
  }
  if (!Number.isInteger(n) || !n || n <= 0) return null
  return `第${n}次`
}

const handlePrintTrialFormPreview = async () => {
  const projectCode = String(editForm.项目编号 || currentProjectCode.value || '').trim()
  if (!projectCode) {
    ElMessage.warning('请先填写项目编号')
    return
  }
  if (trialFormGenerating.value || editSubmitting.value) return

  // 如果需要保存，先保存
  if (isEditFormDirty.value) {
    try {
      await ElMessageBox.confirm('请先保存后再打印试模单', '提示', {
        type: 'warning',
        confirmButtonText: '保存并继续',
        cancelButtonText: '取消'
      })
    } catch {
      return
    }
    await handleSubmitEdit()
    if (editDialogVisible.value) return
  }

  // 保存后校验（打印预览也需要与“生成试模单”一致的完整性校验）
  try {
    const resp: any = await validateTrialFormApi(projectCode)
    if (resp?.code !== 0 && resp?.success !== true) {
      const msg = resp?.message || '试模单数据不完整，请先补齐后再生成'
      const errs = Array.isArray(resp?.errors) ? resp.errors : []
      if (errs.length) {
        await ElMessageBox.alert(errs.join('\n'), msg, { type: 'error', confirmButtonText: '确定' })
      } else {
        ElMessage.error(msg)
      }
      return
    }
  } catch (error: any) {
    const data = error?.response?.data
    const msg = data?.message || '试模单数据不完整，请先补齐后再生成'
    const errs = Array.isArray(data?.errors) ? data.errors : []
    if (errs.length) {
      await ElMessageBox.alert(errs.join('\n'), msg, { type: 'error', confirmButtonText: '确定' })
      return
    }
    ElMessage.error(msg)
    return
  }

  // 先输入试模次数
  let normalizedTrialCount = '第1次'
  try {
    const { value } = await ElMessageBox.prompt('请输入试模次数（例如：第1次 或 1）', '试模次数', {
      inputValue: '第1次',
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      inputValidator: (v) => {
        return normalizeTrialCountInput(v) ? true : '仅支持"第N次"或数字 N（N 为正整数）'
      }
    })
    normalizedTrialCount = normalizeTrialCountInput(value) || '第1次'
  } catch {
    return
  }

  // 跳转到打印预览页面
  const fromPath = route.path
  router.push({
    name: 'TrialFormPrintPreview',
    params: { projectCode },
    query: { trialCount: normalizedTrialCount, from: fromPath }
  })
}

const handlePrintTrialRecord = async () => {
  const projectCode = String(editForm.项目编号 || currentProjectCode.value || '').trim()
  if (!projectCode) {
    ElMessage.warning('请先填写项目编号')
    return
  }

  // 如果需要保存，先保存
  if (isEditFormDirty.value) {
    try {
      await ElMessageBox.confirm('请先保存后再打印试模记录单', '提示', {
        type: 'warning',
        confirmButtonText: '保存并继续',
        cancelButtonText: '取消'
      })
    } catch {
      return
    }
    await handleSubmitEdit()
    if (!editDialogVisible.value) return
  }

  // 跳转到打印预览页面
  const fromPath = route.path
  void router.push({
    name: 'TrialRecordPrintPreview',
    params: { projectCode },
    query: { from: fromPath }
  })
}

const resolveDownloadFilename = (resp: any, fallback: string) => {
  const headers = resp?.headers || {}
  const disposition = headers['content-disposition'] || headers['Content-Disposition'] || ''
  const raw = String(disposition)
  let fileName = ''

  const matchUtf8 = raw.match(/filename\\*=(?:UTF-8''|utf-8'')?([^;]+)/)
  if (matchUtf8?.[1]) {
    fileName = matchUtf8[1].trim().replace(/^\"|\"$/g, '')
    try {
      fileName = decodeURIComponent(fileName)
    } catch {
      // ignore
    }
  } else {
    const match = raw.match(/filename=([^;]+)/)
    if (match?.[1]) {
      fileName = match[1].trim().replace(/^\"|\"$/g, '')
    }
  }

  return fileName || fallback
}

const downloadBlobAsFile = (blob: Blob, fileName: string) => {
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  window.URL.revokeObjectURL(url)
}

const handleDownloadTrialFormXlsx = async () => {
  const projectCode = String(editForm.项目编号 || currentProjectCode.value || '').trim()
  if (!projectCode) {
    ElMessage.warning('请先填写项目编号')
    return
  }
  if (trialFormGenerating.value || editSubmitting.value) return

  // 如果需要保存，先保存（生成基于数据库数据）
  if (isEditFormDirty.value) {
    try {
      await ElMessageBox.confirm('请先保存后再生成试模单', '提示', {
        type: 'warning',
        confirmButtonText: '保存并继续',
        cancelButtonText: '取消'
      })
    } catch {
      return
    }
    await handleSubmitEdit()
    if (editDialogVisible.value) return
  }

  // 保存后校验（与“打印试模单”保持一致）
  try {
    const resp: any = await validateTrialFormApi(projectCode)
    if (resp?.code !== 0 && resp?.success !== true) {
      const msg = resp?.message || '试模单数据不完整，请先补齐后再生成'
      const errs = Array.isArray(resp?.errors) ? resp.errors : []
      if (errs.length) {
        await ElMessageBox.alert(errs.join('\n'), msg, { type: 'error', confirmButtonText: '确定' })
      } else {
        ElMessage.error(msg)
      }
      return
    }
  } catch (error: any) {
    const data = error?.response?.data
    const msg = data?.message || '试模单数据不完整，请先补齐后再生成'
    const errs = Array.isArray(data?.errors) ? data.errors : []
    if (errs.length) {
      await ElMessageBox.alert(errs.join('\n'), msg, { type: 'error', confirmButtonText: '确定' })
      return
    }
    ElMessage.error(msg)
    return
  }

  // 先输入试模次数
  let normalizedTrialCount = '第1次'
  try {
    const { value } = await ElMessageBox.prompt('请输入试模次数（例如：第1次 或 1）', '试模次数', {
      inputValue: '第1次',
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      inputValidator: (v) => {
        return normalizeTrialCountInput(v) ? true : '仅支持"第N次"或数字 N（N 为正整数）'
      }
    })
    normalizedTrialCount = normalizeTrialCountInput(value) || '第1次'
  } catch {
    return
  }

  try {
    trialFormGenerating.value = true
    const resp: any = await downloadTrialFormXlsxApi(projectCode, normalizedTrialCount)
    const blob = ((resp as any)?.data ?? resp) as Blob
    const fallbackName = `${projectCode}_${normalizedTrialCount}.xlsx`
    const fileName = resolveDownloadFilename(resp, fallbackName)
    downloadBlobAsFile(blob, fileName)
  } catch (error: any) {
    console.error('生成试模单失败:', error)
    ElMessage.error(error?.message || '生成试模单失败')
  } finally {
    trialFormGenerating.value = false
  }
}

const handleGenerateSealSample = async () => {
  const projectCode = String(editForm.项目编号 || currentProjectCode.value || '').trim()
  if (!projectCode) {
    ElMessage.warning('请先填写项目编号')
    return
  }

  try {
    sealSampleGenerating.value = true
    const resp: any = await generateSealSampleXlsxApi(projectCode)
    if (resp?.code !== 0 && resp?.success !== true) {
      ElMessage.error(resp?.message || '生成封样单失败')
      return
    }

    ElMessage.success('封样单已生成并保存到附件')
    await loadAttachments()
  } catch (error: any) {
    console.error('生成封样单失败:', error)
    const resp = error?.response
    const data = resp?.data
    if (data instanceof Blob) {
      try {
        const text = await data.text()
        const json = JSON.parse(text)
        ElMessage.error(json?.message || '生成封样单失败')
        return
      } catch {
        // ignore
      }
    }
    ElMessage.error(resp?.data?.message || error?.message || '生成封样单失败')
  } finally {
    sealSampleGenerating.value = false
  }
}

const handleGenerateTripartiteAgreement = async () => {
  const projectCode = String(editForm.项目编号 || currentProjectCode.value || '').trim()
  if (!projectCode) {
    ElMessage.warning('请先填写项目编号')
    return
  }

  try {
    tripartiteAgreementDownloading.value = true

    // 生成时才校验三方协议完整性（允许先暂存/分步填写，保存不拦截）
    syncCorePullToForm()
    const localErrors = validateTripartiteAgreementForEdit()
    if (localErrors.length) {
      ElMessageBox.alert(localErrors.join('\n'), '三方协议字段缺失/不符合规则', {
        type: 'error',
        confirmButtonText: '确定'
      })
      return
    }

    // 客户模号为必填项：缺失则不生成
    const customerModelNo = String(editForm.客户模号 || '').trim()
    if (!customerModelNo) {
      ElMessage.error('客户模号不能为空，请先补齐后再生成三方协议')
      return
    }

    const resp: any = await generateTripartiteAgreementPdfApi(projectCode)
    if (resp?.code !== 0 && resp?.success !== true) {
      ElMessage.error(resp?.message || '生成三方协议失败')
      return
    }

    ElMessage.success('三方协议已生成并保存到附件')
    await loadAttachments()
  } catch (error: any) {
    console.error('生成三方协议失败:', error)
    const resp = error?.response
    const data = resp?.data
    if (data instanceof Blob) {
      try {
        const text = await data.text()
        const json = JSON.parse(text)
        const msg = json?.message || '生成三方协议失败'
        const errs = Array.isArray(json?.errors) ? json.errors : []
        if (errs.length) {
          const lines = errs.map((e: any) => {
            const label = e?.label || e?.field || ''
            const m = e?.message ? `：${e.message}` : ''
            return `${label}${m}`
          })
          ElMessageBox.alert(lines.join('\n'), msg, { type: 'error', confirmButtonText: '确定' })
          return
        }
        ElMessage.error(msg)
        return
      } catch {
        // ignore
      }
    }
    ElMessage.error(resp?.data?.message || error?.message || '生成三方协议失败')
  } finally {
    tripartiteAgreementDownloading.value = false
  }
}

// 删除附件
const deleteAttachment = async (row: ProjectAttachment) => {
  try {
    await ElMessageBox.confirm(
      `确定删除附件：${row.storedFileName || row.originalName}？`,
      '提示',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
        closeOnClickModal: false
      }
    )
  } catch {
    return
  }

  try {
    await deleteProjectAttachmentApi(row.id)
    ElMessage.success('删除成功')
    await loadAttachments()
  } catch (error: any) {
    console.error('删除附件失败:', error)
    ElMessage.error(error?.message || '删除失败')
  }
}

// 格式化文件大小
const formatFileSize = (size?: number | null): string => {
  if (!size || size <= 0) return '-'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

// 判断生产任务附件是否为图片
const isProductionTaskImageFile = (attachment: ProductionTaskAttachment): boolean => {
  if (attachment.contentType?.startsWith('image/')) {
    return true
  }
  const fileName = attachment.storedFileName || attachment.originalName || ''
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico']
  return imageExts.includes(ext)
}

// 判断生产任务附件是否为 PDF
const isProductionTaskPdfFile = (attachment: ProductionTaskAttachment): boolean => {
  if (attachment.contentType === 'application/pdf') {
    return true
  }
  const fileName = attachment.storedFileName || attachment.originalName || ''
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  return ext === 'pdf'
}

// 预览生产任务图片附件
const handleProductionTaskAttachmentPreview = async (attachment: ProductionTaskAttachment) => {
  if (!isProductionTaskImageFile(attachment)) {
    ElMessage.warning('该文件不是图片格式')
    return
  }

  try {
    // 获取同类型的所有图片附件
    let allAttachments: ProductionTaskAttachment[] = []
    if (attachment.type === 'photo') {
      allAttachments = productionTaskPhotoAttachments.value
    } else if (attachment.type === 'inspection') {
      allAttachments = productionTaskInspectionAttachments.value
    }

    const imageAttachments = allAttachments.filter(isProductionTaskImageFile)
    if (imageAttachments.length === 0) {
      ElMessage.warning('没有可预览的图片')
      return
    }

    const currentIndex = imageAttachments.findIndex((item) => item.id === attachment.id)

    const urlList: string[] = []
    const blobUrls: string[] = []

    try {
      const blobPromises = imageAttachments.map(async (item) => {
        try {
          const resp = await downloadProductionTaskAttachmentApi(item.id)
          const blob = (resp as any)?.data ?? resp
          const url = window.URL.createObjectURL(blob as Blob)
          blobUrls.push(url)
          return url
        } catch (error) {
          console.error(`加载图片 ${item.storedFileName || item.originalName} 失败:`, error)
          return null
        }
      })

      const urls = await Promise.all(blobPromises)
      urlList.push(...urls.filter((url): url is string => url !== null))

      if (urlList.length === 0) {
        ElMessage.warning('加载图片失败')
        return
      }

      createImageViewer({
        urlList,
        initialIndex: currentIndex >= 0 ? currentIndex : 0,
        infinite: true,
        hideOnClickModal: true,
        zIndex: 3000,
        teleported: true
      })
    } catch (error) {
      blobUrls.forEach((url) => window.URL.revokeObjectURL(url))
      throw error
    }
  } catch (error) {
    console.error('预览图片失败:', error)
    ElMessage.error('预览图片失败')
  }
}

// 预览生产任务 PDF 附件
const handleProductionTaskAttachmentPdfPreview = async (attachment: ProductionTaskAttachment) => {
  if (!isProductionTaskPdfFile(attachment)) {
    ElMessage.warning('该文件不是 PDF 格式')
    return
  }

  try {
    const resp = await downloadProductionTaskAttachmentApi(attachment.id)
    const blob = (resp as any)?.data ?? resp
    const url = window.URL.createObjectURL(blob as Blob)

    if (isMobile.value) {
      const newWindow = window.open(url, '_blank')
      if (!newWindow) {
        ElMessage.warning('请允许弹出窗口以预览 PDF')
        window.URL.revokeObjectURL(url)
      }
    } else {
      createPdfViewer({
        url,
        fileName: attachment.storedFileName || attachment.originalName || 'PDF 文件'
      })
    }
  } catch (error) {
    console.error('预览 PDF 失败:', error)
    ElMessage.error('预览 PDF 失败')
  }
}

// 下载生产任务附件
const downloadProductionTaskAttachment = async (row: ProductionTaskAttachment) => {
  try {
    const resp: any = await downloadProductionTaskAttachmentApi(row.id)
    const blob = ((resp as any)?.data ?? resp) as Blob
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = row.storedFileName || row.originalName || `附件_${row.id}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  } catch (error: any) {
    console.error('下载附件失败:', error)
    ElMessage.error(error?.message || '下载失败')
  }
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

watch(
  () => editForm.流道类型,
  async (val, prev) => {
    if (!val) {
      editForm.流道数量 = null
      editFormRef.value?.clearValidate?.(['流道数量'])
      return
    }
    if (val !== prev) {
      await nextTick()
      runnerCountInputRef.value?.focus?.()
    }
  }
)

watch(
  () => editForm.浇口类型,
  async (val, prev) => {
    if (!val) {
      editForm.浇口数量 = null
      editFormRef.value?.clearValidate?.(['浇口数量'])
      return
    }
    if (val !== prev) {
      await nextTick()
      gateCountInputRef.value?.focus?.()
    }
  }
)

const handleRunnerCountChange = (val: unknown) => {
  if (!editForm.流道类型) return
  const n = Number(val)
  if (Number.isFinite(n) && !Number.isInteger(n)) {
    editForm.流道数量 = null
    ElMessage.error('流道数量必须为整数')
    nextTick(() => safeValidateFields(['流道数量']))
    return
  }
  if (Number.isFinite(n) && n === 0) {
    editForm.流道数量 = null
    ElMessage.error('流道数量不能为 0')
    nextTick(() => safeValidateFields(['流道数量']))
  }
}

const handleGateCountChange = (val: unknown) => {
  if (!editForm.浇口类型) return
  const n = Number(val)
  if (Number.isFinite(n) && !Number.isInteger(n)) {
    editForm.浇口数量 = null
    ElMessage.error('浇口数量必须为整数')
    nextTick(() => safeValidateFields(['浇口数量']))
    return
  }
  if (Number.isFinite(n) && n === 0) {
    editForm.浇口数量 = null
    ElMessage.error('浇口数量不能为 0')
    nextTick(() => safeValidateFields(['浇口数量']))
  }
}

const handleSubmitEdit = async () => {
  if (!editFormRef.value) return

  // 兜底：避免“勾选/输入后立刻保存”导致 watcher 未及时同步到 editForm
  syncCorePullToForm()

  const savedProjectCode = currentProjectCode.value || editForm.项目编号 || ''

  try {
    await editFormRef.value.validate()
  } catch {
    return
  }

  // 抽芯方式：不在表单中做逐行提示校验，保存时统一校验并提示
  if (isPlasticMould.value && corePullSelected.value.length > 0) {
    const invalidMethod = corePullSelected.value.find((m) => {
      const qty = corePullQty[m]
      return qty === undefined || Number(qty) <= 0
    })
    if (invalidMethod) {
      ElMessage.error('抽芯方式勾选后，请填写对应数量（必须大于 0）')
      nextTick(() => corePullQtyInputRefs.get(invalidMethod)?.focus?.())
      return
    }
  }

  // 三方协议字段规则：保存时统一校验（一次性提示缺失项）
  // 注意：三方协议字段完整性校验仅在“下载三方协议”时执行

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

  // 保存前处理产品列表和产品尺寸
  syncMainDrawingRowToForm()

  const 主图号 = String(editForm.productDrawing || '').trim()
  if (!主图号) {
    ElMessage.error('主图号不能为空，无法保存')
    return
  }

  const 图号列表 = parseProductDrawingList(getProductListRawFromEditForm())
  const 尺寸列表 = parseProductSize(editForm.产品尺寸)
  const 名称列表 = parseProductNameList((editForm as any).产品名称列表)
  const 数量列表 = parseProductQtyList((editForm as any).产品数量列表)
  const 重量列表 = parseProductWeightList((editForm as any).产品重量列表)

  // 确保两个数组长度一致（保留更长的一侧）
  const maxLength = Math.max(
    1,
    图号列表.length,
    尺寸列表.length,
    名称列表.length,
    数量列表.length,
    重量列表.length
  )
  const 对齐后图号列表 = [...图号列表]
  const 对齐后尺寸列表 = [...尺寸列表]
  const 对齐后名称列表 = [...名称列表]
  const 对齐后数量列表 = [...数量列表]
  const 对齐后重量列表 = [...重量列表]
  while (对齐后图号列表.length < maxLength) 对齐后图号列表.push('')
  while (对齐后尺寸列表.length < maxLength) 对齐后尺寸列表.push('')
  while (对齐后名称列表.length < maxLength) 对齐后名称列表.push('')
  while (对齐后数量列表.length < maxLength) 对齐后数量列表.push(0)
  while (对齐后重量列表.length < maxLength) 对齐后重量列表.push(0)

  // 过滤空行（图号/名称/尺寸都为空）
  const 有效图号列表: string[] = []
  const 有效尺寸列表: string[] = []
  const 有效名称列表: string[] = []
  const 有效数量列表: number[] = []
  const 有效重量列表: number[] = []
  for (let i = 0; i < 对齐后图号列表.length; i++) {
    const 图号 = String(对齐后图号列表[i] || '').trim()
    const 名称 = String(对齐后名称列表[i] || '').trim()
    const 尺寸 = String(对齐后尺寸列表[i] || '').trim()
    const 数量 = Number.isFinite(对齐后数量列表[i] as any) ? Number(对齐后数量列表[i]) : 0
    const 重量 = Number.isFinite(对齐后重量列表[i] as any) ? Number(对齐后重量列表[i]) : 0
    if (图号 || 名称 || 尺寸 || 数量 || 重量) {
      有效图号列表.push(图号)
      有效名称列表.push(名称)
      有效尺寸列表.push(尺寸)
      有效数量列表.push(Math.max(0, Math.trunc(数量)))
      有效重量列表.push(Math.max(0, 重量))
    }
  }

  if (有效图号列表.length === 0) {
    ElMessage.error('产品列表至少保留一行')
    return
  }

  // 验证图号重复（仅对非空图号）
  const 非空图号 = 有效图号列表.filter((d) => d)
  if (new Set(非空图号).size !== 非空图号.length) {
    ElMessage.error('产品列表中存在重复图号，无法保存')
    return
  }

  ;(editForm as any).产品列表 = 有效图号列表
  ;(editForm as any).产品名称列表 = 有效名称列表
  ;(editForm as any).产品数量列表 = 有效数量列表
  ;(editForm as any).产品重量列表 = 有效重量列表
  editForm.产品尺寸 = 有效尺寸列表 as any

  editSubmitting.value = true
  // 保存前记录当前图片URL，如果保存失败则清理临时图片
  const currentImageUrl = editForm.零件图示URL
  try {
    if (currentProjectCode.value) {
      // 过滤掉 productName 和 productDrawing，这两个字段不属于项目管理表
      // 同时过滤掉"分类"，它属于货物信息表，不应回写到项目管理表
      const { productName, productDrawing, 分类, ...updateData } = editForm as any

      // 将产品列表/产品名称列表/产品数量列表/产品重量列表/产品尺寸转换为JSON字符串
      if (updateData.产品列表 && Array.isArray(updateData.产品列表)) {
        updateData.产品列表 = JSON.stringify(updateData.产品列表)
      }
      if (updateData.产品名称列表 && Array.isArray(updateData.产品名称列表)) {
        updateData.产品名称列表 = JSON.stringify(updateData.产品名称列表)
      }
      if (updateData.产品数量列表 && Array.isArray(updateData.产品数量列表)) {
        updateData.产品数量列表 = JSON.stringify(updateData.产品数量列表)
      }
      if (updateData.产品重量列表 && Array.isArray(updateData.产品重量列表)) {
        updateData.产品重量列表 = JSON.stringify(updateData.产品重量列表)
      }
      if (updateData.产品尺寸 && Array.isArray(updateData.产品尺寸)) {
        updateData.产品尺寸 = JSON.stringify(updateData.产品尺寸)
      }

      await updateProjectApi(currentProjectCode.value, updateData)
      ElMessage.success('更新成功')
    } else {
      // 确保项目编号存在
      if (!editForm.项目编号) {
        ElMessage.error('项目编号不能为空')
        return
      }
      // 过滤掉 productName 和 productDrawing
      const { productName, productDrawing, 分类, ...createData } = editForm as any

      // 将产品列表/产品名称列表/产品数量列表/产品重量列表/产品尺寸转换为JSON字符串
      if (createData.产品列表 && Array.isArray(createData.产品列表)) {
        createData.产品列表 = JSON.stringify(createData.产品列表)
      }
      if (createData.产品名称列表 && Array.isArray(createData.产品名称列表)) {
        createData.产品名称列表 = JSON.stringify(createData.产品名称列表)
      }
      if (createData.产品数量列表 && Array.isArray(createData.产品数量列表)) {
        createData.产品数量列表 = JSON.stringify(createData.产品数量列表)
      }
      if (createData.产品重量列表 && Array.isArray(createData.产品重量列表)) {
        createData.产品重量列表 = JSON.stringify(createData.产品重量列表)
      }
      if (createData.产品尺寸 && Array.isArray(createData.产品尺寸)) {
        createData.产品尺寸 = JSON.stringify(createData.产品尺寸)
      }

      await createProjectApi(createData as ProjectInfo)
      ElMessage.success('创建成功')
    }
    editDialogVisible.value = false
    await Promise.all([loadData(), loadStatistics()])
    if (
      !isMobile.value &&
      viewMode.value === 'timeline' &&
      savedProjectCode &&
      timelineActiveProjectCode.value === savedProjectCode
    ) {
      await loadProjectForTimeline(savedProjectCode)
    }
  } catch (error: any) {
    ElMessage.error('保存失败: ' + (error.message || '未知错误'))
    // 保存失败时，如果当前图片是临时图片，清理它
    if (currentImageUrl) {
      await deleteTempPartImageIfNeeded(currentImageUrl)
      // 如果清理的是当前显示的图片，清空URL
      if (editForm.零件图示URL === currentImageUrl && isTempPartImageUrl(currentImageUrl)) {
        editForm.零件图示URL = ''
      }
    }
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
        productDrawing: goodsData.productDrawing || '',
        分类: goodsData.category || ''
      } as Partial<ProjectInfo>)
      syncMainDrawingRowToForm()

      console.log('填充后的 editForm:', editForm)
      console.log('productName:', editForm.productName, 'productDrawing:', editForm.productDrawing)

      // 分类回填后，重新从已保存的“抽芯明细”初始化 UI（避免再次打开看不到）
      nextTick(() => initCorePullFromForm())
    } else {
      console.log('未找到货物信息')
      // 清空产品信息
      editForm.productName = ''
      editForm.productDrawing = ''
      editForm.分类 = ''
      syncMainDrawingRowToForm()
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

const handleEditDialogClosed = async () => {
  // 清理临时图片
  await cleanupTempPartImage()

  editFormRef.value?.resetFields()
  Object.keys(editForm).forEach((key) => delete (editForm as any)[key])
  currentProjectCode.value = ''
  corePullSelected.value = []
  corePullMethodOptions.forEach((k) => {
    corePullQty[k] = undefined
  })
  partImageUploading.value = false
}

watch(
  () => editDialogVisible.value,
  (visible) => {
    if (visible) {
      editActiveTab.value = 'basic'
      nextTick(() => {
        initCorePullFromForm()
        setEditDialogBaseHeight()
      })
    } else {
      editDialogBaseHeight.value = undefined
    }
  }
)

watch(
  () => isPlasticMould.value,
  (val, prev) => {
    // 仅当从“塑胶模具”切换到“非塑胶模具”时，才清空相关字段
    if (prev === true && val === false) {
      ;(editForm as any).抽芯明细 = null
      ;(editForm as any).顶出类型 = null
      ;(editForm as any).顶出方式 = null
      ;(editForm as any).复位方式 = null
      corePullSelected.value = []
      corePullMethodOptions.forEach((k) => {
        corePullQty[k] = undefined
      })
      return
    }

    if (val === true && prev !== true) {
      initCorePullFromForm()
    }
  }
)

onMounted(() => {
  loadData()
  loadStatistics()
})

// 监听视图模式切换，重置选中状态
watch(viewMode, (val) => {
  if (val !== 'timeline') {
    timelineActiveProjectCode.value = null
    viewProjectData.value = null
  }
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
  :deep(.pm-edit-dialog) {
    display: flex;
    height: 800px;
    max-height: 800px;
    min-height: 800px;
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

/* 响应式优化 - 表格在小屏幕上允许横向滚动 */
@media (width <= 768px) {
  .pm-timeline-basic-table-wrapper,
  .pm-timeline-detail-table-wrapper {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .pm-timeline-basic-table,
  .pm-timeline-detail-table {
    min-width: 600px;
  }
}

.pm-product-drawing-list :deep(.pm-cell-input--error .el-input__wrapper) {
  background: rgb(245 108 108 / 8%);
  box-shadow: 0 0 0 1px var(--el-color-danger) inset;
}

.pm-product-drawing-list :deep(.pm-cell-input--empty .el-input__wrapper) {
  background: rgb(230 162 60 / 8%);
  box-shadow: 0 0 0 1px var(--el-color-warning) inset;
}

.pm-edit-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.pm-edit-footer__right {
  display: flex;
  align-items: center;
  gap: 10px;
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
  justify-content: space-between;
  gap: 8px;
}

.pm-edit-header-main-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.pm-edit-header-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.pm-edit-header-actions--pair {
  align-items: center;
}

:deep(.pm-edit-header-actions--pair .el-button) {
  width: 110px;
  justify-content: center;
}

.pm-edit-header-code {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.pm-edit-header-status-label {
  margin-left: 10px;
  font-size: 13px;
  font-weight: 400;
  color: #909399;
}

.pm-edit-header-status {
  margin-left: 8px;
  cursor: pointer;
}

.pm-edit-header-status-trigger {
  display: inline-flex;
  align-items: center;
}

.pm-edit-header-status-tag {
  width: 112px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  justify-content: center;
}

.pm-edit-header-status-caret {
  margin-left: 4px;
  font-size: 16px;
  line-height: 1;
  color: #909399;
}

:deep(.pm-edit-header-status-dropdown) {
  min-width: 112px !important;
  font-size: 16px !important;
}

:deep(.pm-edit-header-status-dropdown .el-dropdown-menu) {
  width: 112px !important;
  min-width: 112px !important;
}

:deep(.pm-edit-header-status-dropdown .el-dropdown-menu__item) {
  overflow: hidden;
  font-size: 16px !important;
  text-overflow: ellipsis;
  white-space: nowrap;
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

:deep(.pm-edit-tabs .el-tab-pane) {
  height: 100%;
}

.pm-edit-section {
  display: flex;
  height: 100%;
  padding: 12px 14px 4px;
  margin-bottom: 12px;
  background-color: #fff;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  flex-direction: column;
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

.pm-autocomplete-caret {
  color: var(--el-text-color-regular);
  cursor: pointer;
  user-select: none;
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

.pm-view-mode-bar {
  display: flex;
  padding: 8px 0;
  margin-bottom: 8px;
  justify-content: flex-end;
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
  height: 56px;
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
  line-height: 18px;
}

.summary-value {
  margin-top: 2px;
  font-size: 20px;
  font-weight: 600;
  line-height: 24px;
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

/* 附件页签样式 */
.pm-attachments {
  padding: 12px 14px 6px;
}

.pm-attachments-row {
  width: 100%;
}

.pm-attachment-col {
  margin-bottom: 16px;
}

.pm-attachment-card {
  width: 100%;
  height: 100%;
}

:deep(.pm-attachment-card .el-card__body) {
  padding: 12px;
}

/* 模具信息：抽芯/顶出/复位 */
.pm-core-pull-item__checkbox {
  display: inline-flex;
  align-items: center;
}

.pm-core-pull-item__qty {
  width: 100%;
}

.pm-core-pull-item__qty :deep(.el-input__inner) {
  text-align: right;
}

.pm-multi-options {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 14px;
}

:deep(.pm-multi-options .el-checkbox) {
  margin-right: 0;
}

.pm-mould-group {
  padding: 12px 14px 2px;
  background: var(--el-bg-color-overlay);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}

.pm-mould-group__title {
  margin-bottom: 10px;
  font-size: 13px;
  font-weight: 600;
  line-height: 1;
  color: var(--el-text-color-primary);
}

.pm-mould-group--light :deep(.el-form-item__label),
.pm-mould-group--light :deep(.el-checkbox__label),
.pm-mould-group--light :deep(.el-checkbox) {
  font-weight: 400 !important;
}

.pm-mould-grid-row :deep(.el-col) {
  display: flex;
}

.pm-mould-grid-row .pm-mould-group {
  flex: 1;
  height: 100%;
}

.pm-mould-grid-row + .pm-mould-grid-row {
  margin-top: 12px;
}

.pm-mould-grid-row {
  align-items: stretch;
}

/* 零件图示相关样式 */
.pm-part-image-file-input {
  display: none;
}

.pm-part-image-container {
  position: relative;
  display: flex;
  width: 100%;
  max-height: 400px;
  min-height: 200px;
  cursor: pointer;
  background: #fafafa;
  border: 1px dashed #dcdfe6;
  border-radius: 6px;
  outline: none;
  box-sizing: border-box;
  align-items: center;
  justify-content: center;
}

.pm-part-image-container--readonly {
  cursor: default;
}

.pm-part-image-container:focus {
  border-color: #409eff;
}

.pm-part-image-cell__loading {
  display: flex;
  width: 100%;
  min-height: 200px;
  font-size: 12px;
  color: #909399;
  background: #f5f7fa;
  border: 1px dashed #dcdfe6;
  border-radius: 6px;
  box-sizing: border-box;
  align-items: center;
  justify-content: center;
}

.pm-part-image-empty {
  display: flex;
  width: 100%;
  min-height: 200px;
  font-size: 12px;
  color: #909399;
  background: #fafafa;
  border: 1px dashed #dcdfe6;
  border-radius: 6px;
  box-sizing: border-box;
  align-items: center;
  justify-content: center;
}

.pm-part-image-empty__text {
  line-height: 1.1;
  text-align: center;
  user-select: none;
}

.pm-part-image-thumb {
  width: 100%;
  max-height: 300px;
  overflow: hidden;
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  box-sizing: border-box;
}

.pm-part-image-thumb :deep(.el-image__inner) {
  width: 100%;
  max-height: 300px;
  object-fit: contain;
}

.pm-part-image-remove {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 20px;
  height: 20px;
  padding: 0;
  font-size: 16px;
  line-height: 18px;
  color: #606266;
  text-align: center;
  cursor: pointer;
  background: rgb(255 255 255 / 90%);
  border: 1px solid #dcdfe6;
  border-radius: 50%;
  transition: all 0.2s;
}

.pm-part-image-remove:hover {
  color: #f56c6c;
  background: rgb(255 255 255 / 100%);
  border-color: #f56c6c;
}

.pm-part-image-pick {
  position: absolute;
  right: 8px;
  bottom: 8px;
  width: 20px;
  height: 20px;
  padding: 0;
  font-size: 14px;
  line-height: 18px;
  color: #606266;
  text-align: center;
  cursor: pointer;
  background: rgb(255 255 255 / 90%);
  border: 1px solid #dcdfe6;
  border-radius: 50%;
  transition: all 0.2s;
}

.pm-part-image-pick:hover {
  color: #409eff;
  background: rgb(255 255 255 / 100%);
  border-color: #409eff;
}

/* 时间轴视图样式 */
.pm-timeline-layout {
  display: flex;
  gap: 12px;
  margin-top: 8px;
}

.pm-timeline-left {
  flex: 0 0 450px;
  max-height: calc(100vh - 220px);
  padding: 8px;
  overflow: auto;
  background-color: var(--el-bg-color);
  border-radius: 8px;
}

.pm-timeline-right {
  flex: 1;
  max-height: calc(100vh - 220px);
  padding: 8px 12px;
  overflow: auto;
  background-color: var(--el-bg-color);
  border-radius: 8px;
}

.pm-group-block + .pm-group-block {
  margin-top: 16px;
}

.pm-group-header {
  padding: 8px 12px;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 600;
  background: var(--el-color-primary-light-9);
  border-left: 3px solid var(--el-color-primary);
  border-radius: 4px;
}

.pm-group-label {
  color: var(--el-color-primary);
}

.pm-group-count {
  margin-left: 4px;
  font-weight: normal;
  color: var(--el-text-color-secondary);
}

.pm-project-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pm-project-card {
  padding: 12px;
  cursor: pointer;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 4px;
  transition: all 0.2s;
}

.pm-project-card:hover {
  border-color: var(--el-color-primary);
  box-shadow: 0 2px 8px rgb(0 0 0 / 10%);
}

.pm-project-card.is-active {
  background: var(--el-color-primary-light-9);
  border-color: var(--el-color-primary);
}

.pm-project-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 12px;
}

.pm-project-field {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  min-height: 20px;
}

.pm-field-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
  flex-shrink: 0;
}

.pm-field-value {
  display: flex;
  font-size: 13px;
  color: var(--el-text-color-primary);
  word-break: break-all;
  flex: 1;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.pm-due-tag {
  margin-left: 4px;
}

.pm-timeline-empty {
  margin-top: 16px;
}

.pm-timeline-detail-panel {
  width: 100%;
}

.pm-timeline-detail-panel-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 300px;
}

.view-dialog-section-header--timeline {
  display: flex;
  padding-bottom: 6px;
  margin-bottom: 10px;
  border-bottom: 1px solid var(--el-border-color-light);
  justify-content: space-between;
  align-items: flex-start;
}

.view-dialog-section-header--timeline .view-dialog-section-main {
  flex: 1;
}

.view-dialog-section-main {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.view-dialog-info-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr)) 220px;
  gap: 8px 16px;
}

.view-dialog-info-label {
  color: #666;
}

.pm-timeline-basic-image {
  display: flex;
  min-height: 120px;
  overflow: hidden;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
  grid-column: 4;
  grid-row: 1 / span 4;
  align-items: center;
  justify-content: center;
}

.pm-timeline-basic-image__img {
  width: 100%;
  height: 100%;
}

.pm-timeline-basic-image__empty {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.view-dialog-section-title {
  margin-bottom: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.pm-timeline-basic-table-wrapper {
  margin-top: 4px;
  overflow-x: auto;
}

.pm-timeline-basic-table {
  width: 100%;
  overflow: hidden;
  border: 1px solid var(--el-border-color-light);
  border-collapse: collapse;
  border-radius: 4px;
}

.pm-timeline-basic-table thead {
  background-color: var(--el-fill-color-lighter);
}

.pm-timeline-basic-table tbody {
  background-color: var(--el-bg-color);
}

.pm-timeline-table-header {
  padding: 6px 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  text-align: center;
  white-space: nowrap;
  border-right: 1px solid var(--el-border-color-light);
}

.pm-timeline-table-header:last-child {
  border-right: none;
}

.pm-timeline-table-cell {
  padding: 6px 8px;
  font-size: 12px;
  color: var(--el-text-color-primary);
  text-align: center;
  word-break: break-all;
  border-top: 1px solid var(--el-border-color-light);
  border-right: 1px solid var(--el-border-color-light);
}

.pm-timeline-table-cell:last-child {
  border-right: none;
}

.pm-timeline-header-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.pm-timeline-detail-content {
  margin-top: 8px;
}

.pm-timeline-detail-section {
  padding: 8px;
  margin-bottom: 8px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 4px;
}

.pm-timeline-detail-section:last-child {
  margin-bottom: 0;
}

.pm-timeline-detail-section-title {
  padding-bottom: 4px;
  margin-bottom: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--el-color-primary);
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.pm-timeline-detail-table-wrapper {
  margin-top: 4px;
  overflow-x: auto;
}

.pm-timeline-detail-table {
  width: 100%;
  overflow: hidden;
  border: 1px solid var(--el-border-color-light);
  border-collapse: collapse;
  border-radius: 4px;
}

.pm-timeline-detail-table thead {
  background-color: var(--el-fill-color-lighter);
}

.pm-timeline-detail-table tbody {
  background-color: var(--el-bg-color);
}

.pm-timeline-detail-table .pm-timeline-table-header {
  padding: 5px 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  text-align: center;
  white-space: nowrap;
  border-right: 1px solid var(--el-border-color-light);
}

.pm-timeline-detail-table .pm-timeline-table-header:last-child {
  border-right: none;
}

.pm-timeline-detail-table .pm-timeline-table-cell {
  padding: 5px 6px;
  font-size: 12px;
  color: var(--el-text-color-primary);
  text-align: center;
  word-break: break-all;
  border-top: 1px solid var(--el-border-color-light);
  border-right: 1px solid var(--el-border-color-light);
}

.pm-timeline-detail-table .pm-timeline-table-cell:last-child {
  border-right: none;
}

/* 优化标签样式 */
.pm-timeline-basic-cell .pm-status-tag,
.pm-timeline-detail-cell .pm-status-tag {
  height: 20px;
  padding: 0 6px;
  margin: 0;
  font-size: 11px;
  line-height: 20px;
}

/* 产品列表（产品图号列表）相关样式 */
.pm-product-drawing-list {
  width: 100%;
}

.pm-product-drawing-list :deep(.el-table) {
  font-size: 13px;
}

.pm-product-drawing-list :deep(.el-table .el-input) {
  width: 100%;
}

.pm-error-text {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.2;
  color: var(--el-color-danger);
}

/* A) 产品列表单元格颜色 */
</style>
