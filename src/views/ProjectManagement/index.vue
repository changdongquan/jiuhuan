<template>
  <div class="pm-page px-4 pt-1 pb-4 space-y-2">
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

    <el-row :gutter="16">
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
          width="130"
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
        />
        <el-table-column
          prop="productDrawing"
          label="产品图号"
          width="130"
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
            <el-tag :type="getStatusTagType(row.项目状态)" size="small" class="pm-status-tag">
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
        <el-table-column prop="计划首样日期" label="计划首样日期" width="150" sortable="custom">
          <template #default="{ row }">
            <span>{{ formatDate(row.计划首样日期) }}</span>
            <el-tag
              v-if="isDueSoon(row.计划首样日期)"
              type="warning"
              size="small"
              effect="light"
              style="margin-left: 6px"
              >{{ daysUntil(row.计划首样日期) }}天</el-tag
            >
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
        <el-table-column label="操作" width="160" fixed="right" align="center">
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
            <el-tag :type="getStatusTagType(row.项目状态)" size="small">
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
        layout="total, sizes, prev, pager, next, jumper"
        :current-page="pagination.page"
        :page-size="pagination.size"
        :page-sizes="[10, 15, 20, 30, 50]"
        :total="total"
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
    >
      <div class="detail-grid">
        <div class="detail-grid-col">
          <div class="detail-cell"
            ><span class="detail-label">项目编号</span
            ><span class="detail-value">{{ formatValue(viewData.项目编号) }}</span></div
          >
          <div class="detail-cell"
            ><span class="detail-label">项目状态</span
            ><span class="detail-value"
              ><el-tag :type="getStatusTagType(viewData.项目状态)">{{
                formatValue(viewData.项目状态)
              }}</el-tag></span
            ></div
          >
          <div class="detail-cell"
            ><span class="detail-label">产品名称</span
            ><span class="detail-value">{{ formatValue(viewData.productName) }}</span></div
          >
          <div class="detail-cell"
            ><span class="detail-label">产品图号</span
            ><span class="detail-value">{{ formatValue(viewData.productDrawing) }}</span></div
          >
          <div class="detail-cell"
            ><span class="detail-label">客户模号</span
            ><span class="detail-value">{{ formatValue(viewData.客户模号) }}</span></div
          >
          <div class="detail-cell"
            ><span class="detail-label">产品尺寸</span
            ><span class="detail-value">{{ formatValue(viewData.产品尺寸) }}</span></div
          >
          <div class="detail-cell"
            ><span class="detail-label">产品重量</span
            ><span class="detail-value">{{ formatValue(viewData.产品重量) }}</span></div
          >
          <div class="detail-cell"
            ><span class="detail-label">产品材质</span
            ><span class="detail-value">{{ formatValue(viewData.产品材质) }}</span></div
          >
          <div class="detail-cell"
            ><span class="detail-label">产品颜色</span
            ><span class="detail-value">{{ formatValue(viewData.产品颜色) }}</span></div
          >
          <div class="detail-cell"
            ><span class="detail-label">收缩率</span
            ><span class="detail-value">{{ formatValue(viewData.收缩率) }}</span></div
          >
          <div class="detail-cell"
            ><span class="detail-label">料柄重量</span
            ><span class="detail-value">{{ formatValue(viewData.料柄重量) }}</span></div
          >
        </div>
        <div class="detail-grid-col">
          <div class="detail-cell"
            ><span class="detail-label">模具穴数</span
            ><span class="detail-value">{{ formatValue(viewData.模具穴数) }}</span></div
          >
          <div class="detail-cell"
            ><span class="detail-label">模具尺寸</span
            ><span class="detail-value">{{ formatValue(viewData.模具尺寸) }}</span></div
          >
          <div class="detail-cell"
            ><span class="detail-label">模具重量</span
            ><span class="detail-value">{{ formatValue(viewData.模具重量) }}</span></div
          >
          <div class="detail-cell"
            ><span class="detail-label">前模材质</span
            ><span class="detail-value">{{ formatValue(viewData.前模材质) }}</span></div
          >
          <div class="detail-cell"
            ><span class="detail-label">后模材质</span
            ><span class="detail-value">{{ formatValue(viewData.后模材质) }}</span></div
          >
          <div class="detail-cell"
            ><span class="detail-label">滑块材质</span
            ><span class="detail-value">{{ formatValue(viewData.滑块材质) }}</span></div
          >
          <div class="detail-cell"
            ><span class="detail-label">流道类型</span
            ><span class="detail-value">{{ formatValue(viewData.流道类型) }}</span></div
          >
          <div class="detail-cell"
            ><span class="detail-label">流道数量</span
            ><span class="detail-value">{{ formatValue(viewData.流道数量) }}</span></div
          >
          <div class="detail-cell"
            ><span class="detail-label">浇口类型</span
            ><span class="detail-value">{{ formatValue(viewData.浇口类型) }}</span></div
          >
          <div class="detail-cell"
            ><span class="detail-label">浇口数量</span
            ><span class="detail-value">{{ formatValue(viewData.浇口数量) }}</span></div
          >
        </div>
        <div class="detail-grid-col">
          <div class="detail-cell"
            ><span class="detail-label">机台吨位</span
            ><span class="detail-value">{{ formatValue(viewData.机台吨位) }}</span></div
          >
          <div class="detail-cell"
            ><span class="detail-label">锁模力</span
            ><span class="detail-value">{{ formatValue(viewData.锁模力) }}</span></div
          >
          <div class="detail-cell"
            ><span class="detail-label">定位圈</span
            ><span class="detail-value">{{ formatValue(viewData.定位圈) }}</span></div
          >
          <div class="detail-cell"
            ><span class="detail-label">容模量</span
            ><span class="detail-value">{{ formatValue(viewData.容模量) }}</span></div
          >
          <div class="detail-cell"
            ><span class="detail-label">拉杆间距</span
            ><span class="detail-value">{{ formatValue(viewData.拉杆间距) }}</span></div
          >
          <div class="detail-cell"
            ><span class="detail-label">成型周期</span
            ><span class="detail-value">{{ formatValue(viewData.成型周期) }}</span></div
          >
          <div class="detail-cell"
            ><span class="detail-label">费用出处</span
            ><span class="detail-value">{{ formatValue(viewData.费用出处) }}</span></div
          >
        </div>
        <div class="detail-grid-col">
          <div class="detail-cell"
            ><span class="detail-label">项目名称</span
            ><span class="detail-value">{{ formatValue(viewData.项目名称) }}</span></div
          >
          <div class="detail-cell"
            ><span class="detail-label">设计师</span
            ><span class="detail-value">{{ formatValue(viewData.设计师) }}</span></div
          >
          <div class="detail-cell"
            ><span class="detail-label">中标日期</span
            ><span class="detail-value">{{ formatDate(viewData.中标日期) }}</span></div
          >
          <div class="detail-cell"
            ><span class="detail-label">产品3D确认</span
            ><span class="detail-value">{{ formatDate(viewData.产品3D确认) }}</span></div
          >
          <div class="detail-cell"
            ><span class="detail-label">图纸下发日期</span
            ><span class="detail-value">{{ formatDate(viewData.图纸下发日期) }}</span></div
          >
          <div class="detail-cell"
            ><span class="detail-label">计划首样日期</span
            ><span class="detail-value">{{ formatDate(viewData.计划首样日期) }}</span></div
          >
          <div class="detail-cell"
            ><span class="detail-label">首次送样日期</span
            ><span class="detail-value">{{ formatDate(viewData.首次送样日期) }}</span></div
          >
          <div class="detail-cell"
            ><span class="detail-label">移模日期</span
            ><span class="detail-value">{{ formatDate(viewData.移模日期) }}</span></div
          >
          <div class="detail-cell"
            ><span class="detail-label">封样时间</span
            ><span class="detail-value">{{ formatDate(viewData.封样时间) }}</span></div
          >
          <div class="detail-cell"
            ><span class="detail-label">制件厂家</span
            ><span class="detail-value">{{ formatValue(viewData.制件厂家) }}</span></div
          >
          <div class="detail-cell"
            ><span class="detail-label">进度影响原因</span
            ><span class="detail-value">{{ formatValue(viewData.进度影响原因) }}</span></div
          >
        </div>
      </div>
      <div class="detail-row-remark">
        <div class="detail-cell"
          ><span class="detail-label">备注</span
          ><span class="detail-value">{{ formatValue(viewData.备注) }}</span></div
        >
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
      align-center
      :close-on-click-modal="false"
      @closed="handleEditDialogClosed"
    >
      <el-form
        ref="editFormRef"
        :model="editForm"
        :rules="editRules"
        :label-width="isMobile ? '100px' : '120px'"
        class="edit-form-container"
      >
        <el-row :gutter="isMobile ? 8 : 12" justify="center">
          <!-- 第1列：项目编号 产品名称 产品图号 客户模号 产品尺寸 产品重量 产品材质 产品颜色 收缩率 料柄重量 -->
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
            <el-form-item label="客户模号">
              <el-input v-model="editForm.客户模号" placeholder="客户模号" />
            </el-form-item>
            <el-form-item label="产品尺寸">
              <el-input v-model="editForm.产品尺寸" placeholder="产品尺寸" />
            </el-form-item>
            <el-form-item label="产品重量">
              <el-input-number
                v-model="editForm.产品重量"
                :min="0"
                :precision="2"
                :controls="false"
                style="width: 100%"
              />
            </el-form-item>
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

          <!-- 第2-4列：其他字段 -->
          <el-col :xs="24" :sm="12" :lg="6">
            <el-form-item label="模具穴数">
              <el-input v-model="editForm.模具穴数" placeholder="模具穴数" />
            </el-form-item>
            <el-form-item label="模具尺寸">
              <el-input v-model="editForm.模具尺寸" placeholder="模具尺寸" />
            </el-form-item>
            <el-form-item label="模具重量">
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
          <el-col :xs="24" :sm="12" :lg="6">
            <el-form-item label="机台吨位">
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
            <el-form-item label="成型周期">
              <el-input-number
                v-model="editForm.成型周期"
                :min="0"
                :controls="false"
                style="width: 100%"
              />
            </el-form-item>
            <el-form-item label="费用出处">
              <el-input v-model="editForm.费用出处" placeholder="费用出处" />
            </el-form-item>
          </el-col>
          <!-- 第4列：日期和其他 -->
          <el-col :xs="24" :sm="12" :lg="6">
            <el-form-item label="项目名称" prop="项目名称">
              <el-input v-model="editForm.项目名称" placeholder="项目名称" />
            </el-form-item>
            <el-form-item label="设计师">
              <el-input v-model="editForm.设计师" placeholder="设计师" />
            </el-form-item>
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
            <el-form-item label="制件厂家">
              <el-input v-model="editForm.制件厂家" placeholder="制件厂家" />
            </el-form-item>
            <el-form-item label="进度影响原因">
              <el-input v-model="editForm.进度影响原因" placeholder="进度影响原因" />
            </el-form-item>
            <el-form-item label="备注">
              <el-input v-model="editForm.备注" type="textarea" :rows="3" placeholder="备注" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
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
import { computed, onMounted, reactive, ref, watch } from 'vue'
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
import type { GoodsInfo } from '@/api/goods'
import { useAppStore } from '@/store/modules/app'

const loading = ref(false)
const tableData = ref<Partial<ProjectInfo>[]>([])
const total = ref(0)
const pagination = reactive({ page: 1, size: 20 })
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
const showMobileFilters = ref(true)
const tableHeight = computed(() => (isMobile.value ? undefined : 'calc(100vh - 340px)'))

const queryForm = reactive({ keyword: '', status: '', category: '塑胶模具' })
const categoryOptions = [
  { label: '塑胶模具', value: '塑胶模具' },
  { label: '零件加工', value: '零件加工' },
  { label: '修改模具', value: '修改模具' }
]
const projectStatusOptions = [
  { label: 'T0', value: 'T0' },
  { label: '设计中', value: '设计中' },
  { label: '加工中', value: '加工中' },
  { label: '表面处理', value: '表面处理' },
  { label: '已经移模', value: '已经移模' }
]

const viewDialogVisible = ref(false)
const viewData = ref<Partial<ProjectInfo>>({})

const editDialogVisible = ref(false)
const editTitle = ref('编辑项目')
const editFormRef = ref<FormInstance>()
const editForm = reactive<Partial<ProjectInfo>>({})
const editSubmitting = ref(false)
const currentProjectCode = ref('')

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

  // 为不同的项目状态分配不同的颜色
  const statusMap: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'primary'> = {
    T0: 'danger', // 红色 - T0阶段（试模）
    设计中: 'warning', // 橙色 - 设计阶段
    加工中: 'primary', // 蓝色 - 加工阶段
    表面处理: 'info', // 灰色 - 表面处理阶段
    已经移模: 'success' // 绿色 - 已完成
  }

  return statusMap[status] || 'info'
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

onMounted(() => {
  loadData()
  loadStatistics()
})
</script>

<style scoped>
/* 响应式优化 */
@media (width <= 1200px) {
  .detail-grid {
    flex-direction: column;
  }

  .detail-grid-col {
    border-right: none;
    border-bottom: 1px solid #e4e7ed;
  }

  .detail-grid-col:last-child {
    border-bottom: none;
  }
}

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

.pm-page {
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

.query-form {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}

:deep(.query-form .el-form-item) {
  margin-bottom: 0;
}

.edit-form-container {
  max-height: 70vh;
  overflow-y: auto;
}

:deep(.el-descriptions__table) {
  table-layout: fixed;
}

:deep(.el-descriptions__table .el-descriptions__cell) {
  width: 25%;
}

.detail-grid {
  display: flex;
  overflow: hidden;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgb(0 0 0 / 8%);
  gap: 0;
}

.detail-grid-col {
  background: linear-gradient(180deg, #fafbfc 0%, #fff 100%);
  border-right: 1px solid #e4e7ed;
  flex: 1;
}

.detail-grid-col:last-child {
  border-right: none;
}

.detail-grid-col:nth-child(odd) {
  background: linear-gradient(180deg, #f5f7fa 0%, #fff 100%);
}

.detail-cell {
  position: relative;
  display: flex;
  min-height: 48px;
  padding: 12px 16px;
  border-bottom: 1px solid #f0f2f5;
  transition: all 0.3s ease;
  align-items: center;
}

.detail-cell:hover {
  background-color: #f5f7fa;
  transform: translateX(2px);
}

.detail-cell:last-child {
  border-bottom: none;
}

.detail-cell::before {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 3px;
  background: linear-gradient(180deg, #409eff 0%, #66b1ff 100%);
  content: '';
  opacity: 0;
  transition: opacity 0.3s ease;
}

.detail-cell:hover::before {
  opacity: 1;
}

.detail-label {
  position: relative;
  padding-right: 12px;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.3px;
  color: #606266;
  flex: 0 0 100px;
}

.detail-label::after {
  margin-left: 2px;
  color: #c0c4cc;
  content: ':';
}

.detail-value {
  min-height: 20px;
  font-size: 14px;
  color: #303133;
  word-break: break-word;
  flex: 1;
}

.detail-value:empty::before {
  font-style: italic;
  color: #c0c4cc;
  content: '-';
}

.detail-row-remark {
  background: #fff;
  border: 1px solid #e4e7ed;
  border-top: none;
  border-radius: 0 0 8px 8px;
  box-shadow: 0 2px 12px 0 rgb(0 0 0 / 8%);
}

.detail-row-remark .detail-cell {
  min-height: 60px;
  padding-top: 16px;
  border-bottom: none;
  align-items: flex-start;
}

.detail-row-remark .detail-label {
  padding-top: 4px;
}

/* 空值显示优化 */
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

/* 分页固定在页面底部右侧，靠近版权信息区域 */
.pagination-footer {
  position: fixed;
  right: 40px;
  bottom: 40px;
  z-index: 10;
  display: flex;
  justify-content: flex-end;
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
  height: 24px !important;
}

:deep(.pm-table .el-table__body-wrapper .el-table__cell) {
  padding-top: 3px !important;
  padding-bottom: 3px !important;
}

.pagination-footer--mobile {
  position: static;
  left: auto;
  margin-top: 12px;
  transform: none;
  justify-content: flex-end;
}
</style>
