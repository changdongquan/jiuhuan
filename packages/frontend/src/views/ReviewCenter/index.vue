<template>
  <div class="review-center-page">
    <section class="review-filter-panel">
      <el-form class="review-filter-form" :inline="!isMobile">
        <el-form-item label="审核分类">
          <el-select v-model="query.category" :style="fieldWidth(isMobile ? '100%' : '188px')">
            <el-option
              v-for="option in categoryOptions"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="审核状态">
          <el-select v-model="query.status" :style="fieldWidth(isMobile ? '100%' : '168px')">
            <el-option
              v-for="option in statusOptions"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="关键词">
          <el-input
            v-model="query.keyword"
            :style="fieldWidth(isMobile ? '100%' : '360px')"
            clearable
            placeholder="项目编号 / 名称 / 申请人 / 审核人"
            @keydown.enter.prevent="handleSearch"
          />
        </el-form-item>
        <el-form-item>
          <div class="review-filter-form__actions">
            <el-button type="primary" @click="handleSearch">查询</el-button>
            <el-button @click="handleReset">重置</el-button>
            <div class="review-filter-panel__quick">
              <button
                v-for="option in statusOptions"
                :key="option.value"
                type="button"
                class="status-switch"
                :class="{ 'status-switch--active': query.status === option.value }"
                @click="applyQuickStatus(option.value)"
              >
                {{ option.label }}
              </button>
            </div>
          </div>
        </el-form-item>
      </el-form>
    </section>

    <section class="review-board">
      <div class="review-board__head">
        <div>
          <div class="review-board__title">任务列表</div>
        </div>
        <div class="review-board__meta">第 {{ query.page }} 页 / 每页 {{ query.pageSize }} 条</div>
      </div>

      <div v-loading="loading" class="review-feed">
        <template v-if="!isMobile">
          <el-table
            :data="list"
            class="review-table"
            border
            stripe
            size="default"
            max-height="720"
            empty-text="当前条件下没有审核任务"
          >
            <el-table-column type="index" label="#" width="58" />
            <el-table-column prop="categoryText" label="审核分类" width="156">
              <template #default="{ row }">
                <span class="review-table__category" :class="categoryCardClass(row.category)">
                  {{ row.categoryText }}
                </span>
              </template>
            </el-table-column>
            <el-table-column prop="statusText" label="状态" width="110">
              <template #default="{ row }">
                <el-tag size="small" effect="light" :type="statusTagType(row.status)">
                  {{ row.statusText }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="projectCode" label="项目编号" width="170" show-overflow-tooltip>
              <template #default="{ row }">
                {{ row.projectCode || '未关联项目编号' }}
              </template>
            </el-table-column>
            <el-table-column prop="subject" label="审核内容" min-width="240" show-overflow-tooltip>
              <template #default="{ row }">
                <div class="review-table__subject">
                  <div class="review-table__subject-title">{{ row.subject || '-' }}</div>
                  <div class="review-table__subject-summary">{{ rowSummary(row) }}</div>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="sourceText" label="内容来源" width="170" show-overflow-tooltip />
            <el-table-column prop="applicant" label="申请人" width="120" show-overflow-tooltip />
            <el-table-column prop="reviewer" label="审核人" width="120" show-overflow-tooltip />
            <el-table-column prop="reason" label="说明" min-width="220" show-overflow-tooltip>
              <template #default="{ row }">
                {{ row.reason || '暂无补充说明' }}
              </template>
            </el-table-column>
            <el-table-column prop="updatedAt" label="更新时间" width="180">
              <template #default="{ row }">
                {{ formatTime(row.updatedAt) }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="120" fixed="right">
              <template #default="{ row }">
                <div class="review-table__actions">
                  <el-button link type="primary" @click="openDetail(row)">
                    {{ detailButtonLabel(row) }}
                  </el-button>
                  <template v-if="canReview(row)">
                    <el-button link type="danger" @click="openRejectDialog(row)">驳回</el-button>
                    <el-button
                      link
                      type="success"
                      :loading="approvingId === row.id"
                      @click="handleApprove(row)"
                    >
                      审核通过
                    </el-button>
                  </template>
                </div>
              </template>
            </el-table-column>
          </el-table>
        </template>

        <template v-else>
          <el-empty
            v-if="!loading && !list.length"
            class="review-empty"
            description="当前条件下没有审核任务"
            :image-size="92"
          />

          <article
            v-for="row in list"
            :key="row.id"
            class="review-card"
            :class="categoryCardClass(row.category)"
          >
            <div class="review-card__topline">
              <div class="review-card__category-wrap">
                <span class="review-card__category">{{ row.categoryText }}</span>
                <el-tag size="small" effect="light" :type="statusTagType(row.status)">
                  {{ row.statusText }}
                </el-tag>
              </div>
              <div class="review-card__time">{{ formatTime(row.updatedAt) }}</div>
            </div>

            <div class="review-card__main">
              <div class="review-card__headline">
                <div class="review-card__project">{{ row.projectCode || '未关联项目编号' }}</div>
                <div class="review-card__subject">{{ row.subject || '-' }}</div>
              </div>
              <div class="review-card__reason">{{ row.reason || '暂无补充说明' }}</div>
            </div>

            <div class="review-card__grid">
              <div class="review-meta-item">
                <span class="review-meta-item__label">内容来源</span>
                <span class="review-meta-item__value">{{ row.sourceText || '-' }}</span>
              </div>
              <div class="review-meta-item">
                <span class="review-meta-item__label">申请人</span>
                <span class="review-meta-item__value">{{ row.applicant || '-' }}</span>
              </div>
              <div class="review-meta-item">
                <span class="review-meta-item__label">审核人</span>
                <span class="review-meta-item__value">{{ row.reviewer || '-' }}</span>
              </div>
              <div class="review-meta-item">
                <span class="review-meta-item__label">任务摘要</span>
                <span class="review-meta-item__value">{{ rowSummary(row) }}</span>
              </div>
            </div>

            <div class="review-card__actions">
              <el-button link type="primary" @click="openDetail(row)">
                {{ detailButtonLabel(row) }}
              </el-button>
              <template v-if="canReview(row)">
                <el-button link type="danger" @click="openRejectDialog(row)">驳回</el-button>
                <el-button
                  link
                  type="success"
                  :loading="approvingId === row.id"
                  @click="handleApprove(row)"
                >
                  审核通过
                </el-button>
              </template>
            </div>
          </article>
        </template>
      </div>

      <div class="review-pagination">
        <el-pagination
          v-model:current-page="query.page"
          v-model:page-size="query.pageSize"
          :layout="
            isMobile ? 'total, prev, pager, next' : 'total, sizes, prev, pager, next, jumper'
          "
          :total="total"
          :page-sizes="[20, 50, 100]"
          :small="isMobile"
          @current-change="loadTasks"
          @size-change="handlePageSizeChange"
        />
      </div>
    </section>

    <el-dialog
      v-model="rejectDialogVisible"
      class="review-dialog review-dialog--compact"
      :fullscreen="isMobile"
      :width="isMobile ? '100vw' : '560px'"
      destroy-on-close
    >
      <template #header>
        <div class="dialog-head">
          <div class="dialog-head__eyebrow">Reject Review</div>
          <div class="dialog-head__title">填写驳回原因</div>
          <div class="dialog-head__desc">原因会写入审核记录，并反馈给申请人。</div>
        </div>
      </template>

      <div v-if="rejectTarget" class="dialog-body dialog-body--compact">
        <div class="dialog-spotlight">
          <div class="dialog-spotlight__label">当前任务</div>
          <div class="dialog-spotlight__title">{{ rejectTarget.subject || '-' }}</div>
          <div class="dialog-spotlight__meta">
            {{ rejectTarget.categoryText }} / {{ rejectTarget.applicant || '-' }} /
            {{ rejectTarget.projectCode || '未关联项目' }}
          </div>
        </div>

        <el-input
          v-model="rejectReason"
          type="textarea"
          :rows="5"
          maxlength="300"
          show-word-limit
          placeholder="请填写明确的驳回原因，后续会直接展示给申请方。"
        />
      </div>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="closeRejectDialog">取消</el-button>
          <el-button type="danger" :loading="rejectSubmitting" @click="submitReject"
            >确认驳回</el-button
          >
        </div>
      </template>
    </el-dialog>

    <el-dialog
      v-model="viewDialogVisible"
      class="review-dialog review-dialog--wide review-dialog--initiation"
      :fullscreen="isMobile"
      :width="isMobile ? '100vw' : '1240px'"
      destroy-on-close
    >
      <template #header>
        <div class="dialog-head">
          <div class="dialog-head__eyebrow">BMO Initiation</div>
          <div class="dialog-head__title">BMO 立项详情</div>
          <div class="dialog-head__desc"
            >保留来源、审核、项目和销售订单四组信息，并在同一窗口内完成核对。</div
          >
        </div>
      </template>

      <div v-loading="viewDialogLoading" class="dialog-body dialog-body--dense">
        <div class="dialog-hero">
          <div>
            <div class="dialog-hero__label">项目编号候选</div>
            <div class="dialog-hero__value">{{
              viewRequest?.project_code_candidate || viewRow?.project_code_candidate || '-'
            }}</div>
          </div>
          <div class="dialog-hero__aside">
            <el-tag effect="dark" :type="statusTagType(normalizeBmoStatus(viewRequest?.status))">
              {{ normalizeStatusText(normalizeBmoStatus(viewRequest?.status)) }}
            </el-tag>
          </div>
        </div>

        <section class="detail-section">
          <div class="detail-section__title">来源信息</div>
          <el-table
            :data="toDetailTableRows(getBmoSourceFields())"
            border
            size="small"
            class="detail-kv-table"
          >
            <el-table-column prop="label1" width="100" />
            <el-table-column prop="value1" min-width="108" show-overflow-tooltip />
            <el-table-column prop="label2" width="100" />
            <el-table-column prop="value2" min-width="108" show-overflow-tooltip />
            <el-table-column prop="label3" width="100" />
            <el-table-column prop="value3" min-width="108" show-overflow-tooltip />
            <el-table-column prop="label4" width="100" />
            <el-table-column prop="value4" min-width="108" show-overflow-tooltip />
          </el-table>
        </section>

        <section class="detail-section">
          <div class="detail-section__title">审核信息</div>
          <el-table
            :data="toDetailTableRows(getBmoReviewFields())"
            border
            size="small"
            class="detail-kv-table"
          >
            <el-table-column prop="label1" width="100" />
            <el-table-column prop="value1" min-width="108" show-overflow-tooltip />
            <el-table-column prop="label2" width="100" />
            <el-table-column prop="value2" min-width="108" show-overflow-tooltip />
            <el-table-column prop="label3" width="100" />
            <el-table-column prop="value3" min-width="108" show-overflow-tooltip />
            <el-table-column prop="label4" width="100" />
            <el-table-column prop="value4" min-width="108" show-overflow-tooltip />
          </el-table>
        </section>

        <section class="detail-section">
          <div class="detail-section__title">项目信息</div>
          <el-table
            :data="toDetailTableRows(getBmoProjectFields())"
            border
            size="small"
            class="detail-kv-table"
          >
            <el-table-column prop="label1" width="100" />
            <el-table-column prop="value1" min-width="108" show-overflow-tooltip />
            <el-table-column prop="label2" width="100" />
            <el-table-column prop="value2" min-width="108" show-overflow-tooltip />
            <el-table-column prop="label3" width="100" />
            <el-table-column prop="value3" min-width="108" show-overflow-tooltip />
            <el-table-column prop="label4" width="100" />
            <el-table-column prop="value4" min-width="108" show-overflow-tooltip />
          </el-table>
        </section>

        <section class="detail-section">
          <div class="detail-section__title">销售订单表头</div>
          <el-table
            :data="toDetailTableRows(getBmoSalesFields())"
            border
            size="small"
            class="detail-kv-table"
          >
            <el-table-column prop="label1" width="100" />
            <el-table-column prop="value1" min-width="108" show-overflow-tooltip />
            <el-table-column prop="label2" width="100" />
            <el-table-column prop="value2" min-width="108" show-overflow-tooltip />
            <el-table-column prop="label3" width="100" />
            <el-table-column prop="value3" min-width="108" show-overflow-tooltip />
            <el-table-column prop="label4" width="100" />
            <el-table-column prop="value4" min-width="108" show-overflow-tooltip />
          </el-table>
        </section>

        <section class="detail-section">
          <div class="detail-section__title">销售订单明细</div>
          <el-table
            :data="viewRequest?.sales_order_draft?.details || []"
            border
            size="small"
            max-height="240"
          >
            <el-table-column type="index" label="#" width="56" />
            <el-table-column
              prop="itemCode"
              label="项目编号"
              min-width="140"
              show-overflow-tooltip
            />
            <el-table-column
              prop="customerPartNo"
              label="客户料号"
              min-width="140"
              show-overflow-tooltip
            />
            <el-table-column
              prop="deliveryDate"
              label="交货日期"
              width="120"
              show-overflow-tooltip
            />
            <el-table-column prop="quantity" label="数量" width="90" />
            <el-table-column prop="unitPrice" label="单价" width="110" />
            <el-table-column prop="totalAmount" label="总金额" width="110" />
            <el-table-column prop="remark" label="备注" min-width="160" show-overflow-tooltip />
            <el-table-column prop="handler" label="经办人" width="120" show-overflow-tooltip />
            <el-table-column prop="costSource" label="费用出处" width="120" show-overflow-tooltip />
          </el-table>
        </section>

        <section class="detail-section">
          <div class="detail-section__title">技术快照</div>
          <el-table
            :data="toDetailTableRows(getBmoTechFields())"
            border
            size="small"
            class="detail-kv-table"
          >
            <el-table-column prop="label1" width="100" />
            <el-table-column prop="value1" min-width="108" show-overflow-tooltip />
            <el-table-column prop="label2" width="100" />
            <el-table-column prop="value2" min-width="108" show-overflow-tooltip />
            <el-table-column prop="label3" width="100" />
            <el-table-column prop="value3" min-width="108" show-overflow-tooltip />
            <el-table-column prop="label4" width="100" />
            <el-table-column prop="value4" min-width="108" show-overflow-tooltip />
          </el-table>
        </section>
      </div>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="viewDialogVisible = false">关闭</el-button>
        </div>
      </template>
    </el-dialog>

    <el-dialog
      v-model="quotationViewDialogVisible"
      class="review-dialog review-dialog--wide review-dialog--initiation"
      :fullscreen="isMobile"
      :width="isMobile ? '100vw' : '1020px'"
      destroy-on-close
    >
      <template #header>
        <div class="dialog-head">
          <div class="dialog-head__eyebrow">Quotation Initiation</div>
          <div class="dialog-head__title">报价单立项详情</div>
          <div class="dialog-head__desc">聚焦报价单、项目草稿与订单草稿的可审核信息。</div>
        </div>
      </template>

      <div v-if="quotationViewRequest" class="dialog-body dialog-body--dense">
        <div class="dialog-hero">
          <div>
            <div class="dialog-hero__label">报价单号</div>
            <div class="dialog-hero__value">{{ quotationViewRequest.quotation_no || '-' }}</div>
          </div>
          <div class="dialog-hero__aside">
            <el-tag
              effect="dark"
              :type="statusTagType(normalizeQuotationStatus(quotationViewRequest.status))"
            >
              {{
                quotationViewRequest.status_text ||
                normalizeStatusText(normalizeQuotationStatus(quotationViewRequest.status))
              }}
            </el-tag>
          </div>
        </div>

        <section class="detail-section">
          <div class="detail-section__title">基础信息</div>
          <el-table
            :data="toDetailTableRows(getQuotationBaseFields())"
            border
            size="small"
            class="detail-kv-table"
          >
            <el-table-column prop="label1" width="100" />
            <el-table-column prop="value1" min-width="108" show-overflow-tooltip />
            <el-table-column prop="label2" width="100" />
            <el-table-column prop="value2" min-width="108" show-overflow-tooltip />
            <el-table-column prop="label3" width="100" />
            <el-table-column prop="value3" min-width="108" show-overflow-tooltip />
            <el-table-column prop="label4" width="100" />
            <el-table-column prop="value4" min-width="108" show-overflow-tooltip />
          </el-table>
        </section>

        <section class="detail-section">
          <div class="detail-section__title">项目信息</div>
          <el-table
            :data="toDetailTableRows(getQuotationProjectFields())"
            border
            size="small"
            class="detail-kv-table"
          >
            <el-table-column prop="label1" width="100" />
            <el-table-column prop="value1" min-width="108" show-overflow-tooltip />
            <el-table-column prop="label2" width="100" />
            <el-table-column prop="value2" min-width="108" show-overflow-tooltip />
            <el-table-column prop="label3" width="100" />
            <el-table-column prop="value3" min-width="108" show-overflow-tooltip />
            <el-table-column prop="label4" width="100" />
            <el-table-column prop="value4" min-width="108" show-overflow-tooltip />
          </el-table>
        </section>

        <section class="detail-section">
          <div class="detail-section__title">销售订单表头</div>
          <el-table
            :data="toDetailTableRows(getQuotationSalesFields())"
            border
            size="small"
            class="detail-kv-table"
          >
            <el-table-column prop="label1" width="80" />
            <el-table-column prop="value1" min-width="108" show-overflow-tooltip />
            <el-table-column prop="label2" width="80" />
            <el-table-column prop="value2" min-width="108" show-overflow-tooltip />
            <el-table-column prop="label3" width="80" />
            <el-table-column prop="value3" min-width="108" show-overflow-tooltip />
            <el-table-column prop="label4" width="80" />
            <el-table-column prop="value4" min-width="108" show-overflow-tooltip />
          </el-table>
        </section>

        <section class="detail-section">
          <div class="detail-section__title">销售订单明细</div>
          <el-table
            :data="quotationViewRequest.sales_order_draft?.details || []"
            border
            size="small"
            max-height="240"
          >
            <el-table-column type="index" label="#" width="56" />
            <el-table-column
              prop="itemCode"
              label="项目编号"
              min-width="140"
              show-overflow-tooltip
            />
            <el-table-column prop="name" label="名称" min-width="160" show-overflow-tooltip />
            <el-table-column
              prop="productDrawingNo"
              label="产品图号"
              min-width="140"
              show-overflow-tooltip
            />
            <el-table-column
              prop="customerPartNo"
              label="客户料号"
              min-width="140"
              show-overflow-tooltip
            />
            <el-table-column prop="quantity" label="数量" width="90" />
            <el-table-column prop="unitPrice" label="单价" width="110" />
            <el-table-column prop="totalAmount" label="总金额" width="110" />
            <el-table-column prop="remark" label="备注" min-width="150" show-overflow-tooltip />
            <el-table-column prop="handler" label="经办人" width="120" show-overflow-tooltip />
            <el-table-column prop="costSource" label="费用出处" width="120" show-overflow-tooltip />
            <el-table-column
              prop="deliveryDate"
              label="交货日期"
              width="120"
              show-overflow-tooltip
            />
          </el-table>
        </section>
      </div>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="quotationViewDialogVisible = false">关闭</el-button>
        </div>
      </template>
    </el-dialog>

    <el-dialog
      v-model="customerCreateViewDialogVisible"
      class="review-dialog review-dialog--compact"
      :fullscreen="isMobile"
      :width="isMobile ? '100vw' : '760px'"
      destroy-on-close
    >
      <template #header>
        <div class="dialog-head">
          <div class="dialog-head__eyebrow">Customer Creation</div>
          <div class="dialog-head__title">客户新增审核</div>
          <div class="dialog-head__desc">保留申请、审核结果和时间线，移动端直接全屏查看。</div>
        </div>
      </template>

      <div v-if="customerCreateViewRow" class="dialog-body dialog-body--compact">
        <div class="dialog-hero">
          <div>
            <div class="dialog-hero__label">客户名称</div>
            <div class="dialog-hero__value">{{ customerCreateViewRow.customer_name || '-' }}</div>
          </div>
          <div class="dialog-hero__aside">
            <el-tag effect="dark" :type="statusTagType(customerCreateViewRow.status)">
              {{
                customerCreateViewRow.status_text ||
                normalizeStatusText(
                  customerCreateViewRow.status === 'APPROVED'
                    ? 'APPROVED'
                    : customerCreateViewRow.status === 'REJECTED'
                      ? 'REJECTED'
                      : 'PENDING'
                )
              }}
            </el-tag>
          </div>
        </div>

        <section class="detail-section">
          <el-table
            :data="toDetailTableRows(getCustomerCreateFields())"
            border
            size="small"
            class="detail-kv-table"
          >
            <el-table-column prop="label1" width="80" />
            <el-table-column prop="value1" min-width="108" show-overflow-tooltip />
            <el-table-column prop="label2" width="80" />
            <el-table-column prop="value2" min-width="108" show-overflow-tooltip />
            <el-table-column prop="label3" width="80" />
            <el-table-column prop="value3" min-width="108" show-overflow-tooltip />
            <el-table-column prop="label4" width="80" />
            <el-table-column prop="value4" min-width="108" show-overflow-tooltip />
          </el-table>
        </section>
      </div>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="customerCreateViewDialogVisible = false">关闭</el-button>
        </div>
      </template>
    </el-dialog>

    <el-dialog
      v-model="salesOrderMergeViewDialogVisible"
      class="review-dialog review-dialog--wide"
      :fullscreen="isMobile"
      :width="isMobile ? '100vw' : '1200px'"
      destroy-on-close
    >
      <template #header>
        <div class="dialog-head">
          <div class="dialog-head__eyebrow">Sales Order Merge</div>
          <div class="dialog-head__title">销售订单合并审核</div>
          <div class="dialog-head__desc"
            >对比源订单、目标订单和合并预览，避免只看编号无法判断。</div
          >
        </div>
      </template>

      <div v-if="salesOrderMergeViewRow" class="dialog-body">
        <div class="dialog-hero">
          <div>
            <div class="dialog-hero__label">目标订单</div>
            <div class="dialog-hero__value">{{ salesOrderMergeViewRow.targetOrderNo || '-' }}</div>
          </div>
          <div class="dialog-hero__aside">
            <el-tag
              effect="dark"
              :type="statusTagType(normalizeSalesOrderMergeStatus(salesOrderMergeViewRow.status))"
            >
              {{
                salesOrderMergeViewRow.statusText ||
                normalizeStatusText(normalizeSalesOrderMergeStatus(salesOrderMergeViewRow.status))
              }}
            </el-tag>
          </div>
        </div>

        <section class="detail-section">
          <div class="detail-section__title">审核信息</div>
          <el-table
            :data="toDetailTableRows(getSalesOrderMergeReviewFields())"
            border
            size="small"
            class="detail-kv-table"
          >
            <el-table-column prop="label1" width="80" />
            <el-table-column prop="value1" min-width="108" show-overflow-tooltip />
            <el-table-column prop="label2" width="80" />
            <el-table-column prop="value2" min-width="108" show-overflow-tooltip />
            <el-table-column prop="label3" width="80" />
            <el-table-column prop="value3" min-width="108" show-overflow-tooltip />
            <el-table-column prop="label4" width="80" />
            <el-table-column prop="value4" min-width="108" show-overflow-tooltip />
          </el-table>
        </section>

        <section class="detail-compare">
          <article class="compare-card">
            <div class="compare-card__title">源订单</div>
            <el-table
              :data="toDetailTableRows(getSalesOrderSourceFields())"
              border
              size="small"
              class="detail-kv-table"
            >
              <el-table-column prop="label1" width="72" />
              <el-table-column prop="value1" min-width="92" show-overflow-tooltip />
              <el-table-column prop="label2" width="72" />
              <el-table-column prop="value2" min-width="92" show-overflow-tooltip />
              <el-table-column prop="label3" width="72" />
              <el-table-column prop="value3" min-width="92" show-overflow-tooltip />
              <el-table-column prop="label4" width="72" />
              <el-table-column prop="value4" min-width="92" show-overflow-tooltip />
            </el-table>
            <el-table
              :data="salesOrderMergeViewRow.sourceSnapshot?.details || []"
              border
              size="small"
              max-height="280"
            >
              <el-table-column
                prop="itemCode"
                label="项目编号"
                min-width="130"
                show-overflow-tooltip
              />
              <el-table-column
                prop="customerPartNo"
                label="客户模号"
                min-width="130"
                show-overflow-tooltip
              />
              <el-table-column
                prop="productName"
                label="产品名称"
                min-width="150"
                show-overflow-tooltip
              />
              <el-table-column prop="quantity" label="数量" width="90" />
            </el-table>
          </article>

          <article class="compare-card">
            <div class="compare-card__title">目标订单</div>
            <el-table
              :data="toDetailTableRows(getSalesOrderTargetFields())"
              border
              size="small"
              class="detail-kv-table"
            >
              <el-table-column prop="label1" width="72" />
              <el-table-column prop="value1" min-width="92" show-overflow-tooltip />
              <el-table-column prop="label2" width="72" />
              <el-table-column prop="value2" min-width="92" show-overflow-tooltip />
              <el-table-column prop="label3" width="72" />
              <el-table-column prop="value3" min-width="92" show-overflow-tooltip />
              <el-table-column prop="label4" width="72" />
              <el-table-column prop="value4" min-width="92" show-overflow-tooltip />
            </el-table>
            <el-table
              :data="salesOrderMergeViewRow.targetSnapshot?.details || []"
              border
              size="small"
              max-height="280"
            >
              <el-table-column
                prop="itemCode"
                label="项目编号"
                min-width="130"
                show-overflow-tooltip
              />
              <el-table-column
                prop="customerPartNo"
                label="客户模号"
                min-width="130"
                show-overflow-tooltip
              />
              <el-table-column
                prop="productName"
                label="产品名称"
                min-width="150"
                show-overflow-tooltip
              />
              <el-table-column prop="quantity" label="数量" width="90" />
            </el-table>
          </article>
        </section>

        <section class="detail-section">
          <div class="detail-section__title">合并预览</div>
          <el-table
            :data="toDetailTableRows(getSalesOrderPreviewFields())"
            border
            size="small"
            class="detail-kv-table"
          >
            <el-table-column prop="label1" width="80" />
            <el-table-column prop="value1" min-width="108" show-overflow-tooltip />
            <el-table-column prop="label2" width="80" />
            <el-table-column prop="value2" min-width="108" show-overflow-tooltip />
            <el-table-column prop="label3" width="80" />
            <el-table-column prop="value3" min-width="108" show-overflow-tooltip />
            <el-table-column prop="label4" width="80" />
            <el-table-column prop="value4" min-width="108" show-overflow-tooltip />
          </el-table>
        </section>
      </div>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="salesOrderMergeViewDialogVisible = false">关闭</el-button>
        </div>
      </template>
    </el-dialog>

    <el-dialog
      v-model="hardDeleteViewDialogVisible"
      class="review-dialog review-dialog--wide"
      :fullscreen="isMobile"
      :width="isMobile ? '100vw' : '1080px'"
      destroy-on-close
    >
      <template #header>
        <div class="dialog-head">
          <div class="dialog-head__eyebrow">Hard Delete Review</div>
          <div class="dialog-head__title">硬删除审核详情</div>
          <div class="dialog-head__desc"
            >突出待删实体、申请原因、审核意见和原始快照，确保删除闭环可审计。</div
          >
        </div>
      </template>

      <div v-if="hardDeleteViewRow" class="dialog-body">
        <div class="dialog-hero">
          <div>
            <div class="dialog-hero__label">待删实体</div>
            <div class="dialog-hero__value">{{
              hardDeleteViewRow.displayName || hardDeleteViewRow.displayCode || '-'
            }}</div>
          </div>
          <div class="dialog-hero__aside">
            <el-tag
              effect="dark"
              :type="statusTagType(normalizeHardDeleteStatus(hardDeleteViewRow.status))"
            >
              {{ normalizeStatusText(normalizeHardDeleteStatus(hardDeleteViewRow.status)) }}
            </el-tag>
          </div>
        </div>

        <section class="detail-section">
          <div class="detail-section__title">待删内容</div>
          <el-table
            :data="toDetailTableRows(getHardDeleteEntityFields())"
            border
            size="small"
            class="detail-kv-table"
          >
            <el-table-column prop="label1" width="80" />
            <el-table-column prop="value1" min-width="108" show-overflow-tooltip />
            <el-table-column prop="label2" width="80" />
            <el-table-column prop="value2" min-width="108" show-overflow-tooltip />
            <el-table-column prop="label3" width="80" />
            <el-table-column prop="value3" min-width="108" show-overflow-tooltip />
            <el-table-column prop="label4" width="80" />
            <el-table-column prop="value4" min-width="108" show-overflow-tooltip />
          </el-table>
        </section>

        <section class="detail-section">
          <div class="detail-section__title">审核信息</div>
          <el-table
            :data="toDetailTableRows(getHardDeleteReviewFields())"
            border
            size="small"
            class="detail-kv-table"
          >
            <el-table-column prop="label1" width="80" />
            <el-table-column prop="value1" min-width="108" show-overflow-tooltip />
            <el-table-column prop="label2" width="80" />
            <el-table-column prop="value2" min-width="108" show-overflow-tooltip />
            <el-table-column prop="label3" width="80" />
            <el-table-column prop="value3" min-width="108" show-overflow-tooltip />
            <el-table-column prop="label4" width="80" />
            <el-table-column prop="value4" min-width="108" show-overflow-tooltip />
          </el-table>
        </section>

        <section class="detail-section">
          <div class="detail-section__title">删除原单内容快照</div>
          <div
            v-if="hardDeleteSnapshotRows.length || hardDeleteSnapshotTables.length"
            class="snapshot-space"
          >
            <el-table
              v-if="hardDeleteSnapshotRows3Col.length"
              :data="hardDeleteSnapshotRows3Col"
              border
              size="small"
            >
              <el-table-column prop="col1" label="字段 1" min-width="220" show-overflow-tooltip />
              <el-table-column prop="col2" label="字段 2" min-width="220" show-overflow-tooltip />
              <el-table-column prop="col3" label="字段 3" min-width="220" show-overflow-tooltip />
            </el-table>

            <div
              v-for="table in hardDeleteSnapshotTables"
              :key="table.title"
              class="snapshot-block"
            >
              <div class="snapshot-block__title">{{ table.title }}</div>
              <el-table :data="table.rows" border size="small" max-height="320">
                <el-table-column
                  v-for="col in table.columns"
                  :key="col"
                  :label="col"
                  :min-width="getSnapshotColMinWidth(col, table.rows)"
                  show-overflow-tooltip
                >
                  <template #default="{ row }">
                    {{ formatSnapshotCell(row[col]) }}
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </div>
          <div v-else class="snapshot-empty">暂无快照内容</div>
        </section>
      </div>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="hardDeleteViewDialogVisible = false">关闭</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRoute } from 'vue-router'
import {
  approveAndApplyBmoInitiationReviewApi,
  getBmoInitiationRequestApi,
  getBmoInitiationReviewTasksApi,
  rejectBmoInitiationReviewApi,
  type BmoInitiationRequestRow,
  type BmoInitiationReviewTask
} from '@/api/bmo'
import {
  approveAndApplyQuotationInitiationApi,
  getQuotationInitiationReviewTasksApi,
  rejectQuotationInitiationReviewApi,
  type QuotationInitiationRequestRow
} from '@/api/quotation'
import {
  approveHardDeleteReviewApi,
  getHardDeleteReviewTasksApi,
  rejectHardDeleteReviewApi,
  type HardDeleteReviewTask
} from '@/api/goods'
import {
  approveSalesOrderMergeReviewApi,
  getSalesOrderMergeReviewTasksApi,
  rejectSalesOrderMergeReviewApi,
  type SalesOrderMergeReviewTask
} from '@/api/sales-orders'
import {
  approveCustomerCreateReviewForReviewCenterApi,
  type CustomerCreateReviewTask,
  getCustomerCreateReviewTasksForReviewCenterApi,
  rejectCustomerCreateReviewForReviewCenterApi
} from '@/api/review-center'
import { refreshBmoMenuBadges } from '@/utils/bmoBadge'

type ReviewCategory =
  | 'ALL'
  | 'HARD_DELETE'
  | 'SALES_ORDER_MERGE'
  | 'BMO_INITIATION'
  | 'QUOTATION_INITIATION'
  | 'CUSTOMER_CREATE'
type StandardStatus = 'ALL' | 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELED'
type FieldItem = { label: string; value: string; span?: 'full' }
type DetailTableRow = {
  label1: string
  value1: string
  label2: string
  value2: string
  label3: string
  value3: string
  label4: string
  value4: string
}
type QuotationReviewRow = QuotationInitiationRequestRow & {
  quotation_no?: string | null
  quotation_customer_name?: string | null
  quotation_part_name?: string | null
  quotation_mold_no?: string | null
}

type UnifiedReviewRow = {
  id: string
  category: Exclude<ReviewCategory, 'ALL'>
  categoryText: string
  sourceText: string
  status: Exclude<StandardStatus, 'ALL'>
  statusText: string
  projectCode: string
  subject: string
  applicant: string
  reviewer: string
  reason: string
  updatedAt: string | null
  raw:
    | BmoInitiationReviewTask
    | HardDeleteReviewTask
    | SalesOrderMergeReviewTask
    | QuotationReviewRow
    | CustomerCreateReviewTask
}

const categoryOptions: Array<{ label: string; value: ReviewCategory }> = [
  { label: '全部', value: 'ALL' },
  { label: '硬删除审核', value: 'HARD_DELETE' },
  { label: '销售订单合并审核', value: 'SALES_ORDER_MERGE' },
  { label: 'BMO立项审核', value: 'BMO_INITIATION' },
  { label: '报价单立项审核', value: 'QUOTATION_INITIATION' },
  { label: '客户新增审核', value: 'CUSTOMER_CREATE' }
]

const statusOptions: Array<{ label: string; value: StandardStatus }> = [
  { label: '全部', value: 'ALL' },
  { label: '草稿', value: 'DRAFT' },
  { label: '审核中', value: 'PENDING' },
  { label: '已通过', value: 'APPROVED' },
  { label: '已驳回', value: 'REJECTED' },
  { label: '已取消', value: 'CANCELED' }
]

const route = useRoute()
const MOBILE_BREAKPOINT = 900
const loading = ref(false)
const list = ref<UnifiedReviewRow[]>([])
const total = ref(0)
const approvingId = ref('')

const viewDialogVisible = ref(false)
const viewDialogLoading = ref(false)
const viewRow = ref<BmoInitiationReviewTask | null>(null)
const viewRequest = ref<BmoInitiationRequestRow | null>(null)
const quotationViewDialogVisible = ref(false)
const quotationViewRequest = ref<QuotationReviewRow | null>(null)
const customerCreateViewDialogVisible = ref(false)
const customerCreateViewRow = ref<CustomerCreateReviewTask | null>(null)
const salesOrderMergeViewDialogVisible = ref(false)
const salesOrderMergeViewRow = ref<SalesOrderMergeReviewTask | null>(null)
const hardDeleteViewDialogVisible = ref(false)
const hardDeleteViewRow = ref<HardDeleteReviewTask | null>(null)
const rejectDialogVisible = ref(false)
const rejectTarget = ref<UnifiedReviewRow | null>(null)
const rejectReason = ref('')
const rejectSubmitting = ref(false)
const isMobile = ref(false)

const query = reactive({
  category: 'ALL' as ReviewCategory,
  status: 'PENDING' as StandardStatus,
  keyword: '',
  page: 1,
  pageSize: 20
})

const normalizedKeyword = computed(() => String(query.keyword || '').trim())
const normalizeStatusText = (status: Exclude<StandardStatus, 'ALL'>) => {
  if (status === 'DRAFT') return '草稿'
  if (status === 'PENDING') return '审核中'
  if (status === 'APPROVED') return '已通过'
  if (status === 'REJECTED') return '已驳回'
  return '已取消'
}

const statusTagType = (status: string) => {
  if (status === 'PENDING') return 'warning'
  if (status === 'APPROVED') return 'success'
  if (status === 'REJECTED') return 'danger'
  return 'info'
}

const categoryCardClass = (category: UnifiedReviewRow['category']) => {
  if (category === 'HARD_DELETE') return 'review-card--hard-delete'
  if (category === 'SALES_ORDER_MERGE') return 'review-card--sales-merge'
  if (category === 'BMO_INITIATION') return 'review-card--bmo'
  if (category === 'QUOTATION_INITIATION') return 'review-card--quotation'
  return 'review-card--customer'
}

const normalizeBmoStatus = (status: unknown): Exclude<StandardStatus, 'ALL'> => {
  const s = String(status || '')
    .trim()
    .toUpperCase()
  if (s === 'DRAFT') return 'DRAFT'
  if (s === 'PM_CONFIRMED') return 'PENDING'
  if (s === 'APPLIED') return 'APPROVED'
  if (s === 'REJECTED') return 'REJECTED'
  return 'CANCELED'
}

const normalizeHardDeleteStatus = (status: unknown): Exclude<StandardStatus, 'ALL'> => {
  const s = String(status || '')
    .trim()
    .toUpperCase()
  if (s === 'PENDING') return 'PENDING'
  if (s === 'APPROVED') return 'APPROVED'
  if (s === 'REJECTED') return 'REJECTED'
  return 'CANCELED'
}

const normalizeSalesOrderMergeStatus = (status: unknown): Exclude<StandardStatus, 'ALL'> => {
  const s = String(status || '')
    .trim()
    .toUpperCase()
  if (s === 'PENDING') return 'PENDING'
  if (s === 'APPROVED') return 'APPROVED'
  if (s === 'REJECTED') return 'REJECTED'
  return 'CANCELED'
}

const normalizeQuotationStatus = (status: unknown): Exclude<StandardStatus, 'ALL'> => {
  const s = String(status || '')
    .trim()
    .toUpperCase()
  if (s === 'DRAFT' || s === 'WAIT_CUSTOMER_REVIEW') return 'DRAFT'
  if (s === 'PENDING') return 'PENDING'
  if (s === 'APPROVED') return 'APPROVED'
  if (s === 'REJECTED') return 'REJECTED'
  if (s === 'WITHDRAWN') return 'CANCELED'
  return 'CANCELED'
}

const mapStatusForBmoApi = (
  status: StandardStatus
): 'ALL' | 'DRAFT' | 'PM_CONFIRMED' | 'APPLIED' | 'REJECTED' | null => {
  if (status === 'DRAFT') return 'DRAFT'
  if (status === 'PENDING') return 'PM_CONFIRMED'
  if (status === 'APPROVED') return 'APPLIED'
  if (status === 'REJECTED') return 'REJECTED'
  if (status === 'CANCELED') return null
  return 'ALL'
}

const mapStatusForQuotationApi = (
  status: StandardStatus
): '' | 'DRAFT' | 'WAIT_CUSTOMER_REVIEW' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN' => {
  if (status === 'DRAFT') return 'DRAFT'
  if (status === 'PENDING') return 'PENDING'
  if (status === 'APPROVED') return 'APPROVED'
  if (status === 'REJECTED') return 'REJECTED'
  if (status === 'CANCELED') return 'WITHDRAWN'
  return ''
}

const mapStatusForCustomerApi = (
  status: StandardStatus
): '' | 'PENDING' | 'APPROVED' | 'REJECTED' => {
  if (status === 'PENDING') return 'PENDING'
  if (status === 'APPROVED') return 'APPROVED'
  if (status === 'REJECTED') return 'REJECTED'
  return ''
}

const mapStatusForHardDeleteApi = (
  status: StandardStatus
): 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELED' | null => {
  if (status === 'DRAFT') return null
  if (status === 'PENDING') return 'PENDING'
  if (status === 'APPROVED') return 'APPROVED'
  if (status === 'REJECTED') return 'REJECTED'
  if (status === 'CANCELED') return 'CANCELED'
  return 'ALL'
}

const mapStatusForSalesOrderMergeApi = (
  status: StandardStatus
): 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELED' | null => {
  if (status === 'DRAFT') return null
  if (status === 'PENDING') return 'PENDING'
  if (status === 'APPROVED') return 'APPROVED'
  if (status === 'REJECTED') return 'REJECTED'
  if (status === 'CANCELED') return 'CANCELED'
  return 'ALL'
}

const canReview = (row: UnifiedReviewRow) => row.status === 'PENDING'

const formatTime = (value: string | null | undefined) => {
  if (!value) return '-'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString()
}

const formatAmount = (value: number | null | undefined) => {
  if (value === null || value === undefined) return '-'
  const amount = Number(value)
  return Number.isFinite(amount) ? amount.toLocaleString('zh-CN') : '-'
}

const formatText = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '-'
  return String(value)
}

const buildField = (label: string, value: unknown, span?: 'full'): FieldItem => ({
  label,
  value: formatText(value),
  span
})

const fieldWidth = (width: string) => ({ width })
const toDetailTableRows = (items: FieldItem[]): DetailTableRow[] => {
  const rows: DetailTableRow[] = []
  let group: FieldItem[] = []

  const pushGroup = () => {
    if (!group.length) return
    rows.push({
      label1: group[0]?.label || '',
      value1: group[0]?.value || '',
      label2: group[1]?.label || '',
      value2: group[1]?.value || '',
      label3: group[2]?.label || '',
      value3: group[2]?.value || '',
      label4: group[3]?.label || '',
      value4: group[3]?.value || ''
    })
    group = []
  }

  items.forEach((item) => {
    if (item.span === 'full') {
      pushGroup()
      rows.push({
        label1: item.label,
        value1: item.value,
        label2: '',
        value2: '',
        label3: '',
        value3: '',
        label4: '',
        value4: ''
      })
      return
    }

    group.push(item)
    if (group.length === 4) pushGroup()
  })

  pushGroup()
  return rows
}

const rowSummary = (row: UnifiedReviewRow) => {
  if (row.category === 'HARD_DELETE') return '审核通过后执行硬删除'
  if (row.category === 'SALES_ORDER_MERGE') return '审核通过后真正执行订单合并'
  if (row.category === 'BMO_INITIATION') return '立项通过后生成项目与销售订单'
  if (row.category === 'QUOTATION_INITIATION') return '立项通过后写入报价关联项目'
  return '审核通过后新增客户信息'
}

const detailButtonLabel = (row: UnifiedReviewRow) => {
  if (row.category === 'BMO_INITIATION' || row.category === 'QUOTATION_INITIATION')
    return '查看立项'
  return '查看详情'
}

const openDetail = (row: UnifiedReviewRow) => {
  if (row.category === 'HARD_DELETE') {
    openHardDeleteViewDialog(row)
    return
  }
  if (row.category === 'SALES_ORDER_MERGE') {
    openSalesOrderMergeViewDialog(row)
    return
  }
  if (row.category === 'BMO_INITIATION') {
    void openBmoViewDialog(row)
    return
  }
  if (row.category === 'QUOTATION_INITIATION') {
    openQuotationViewDialog(row)
    return
  }
  openCustomerCreateViewDialog(row)
}

const formatSnapshotCell = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '-'
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map((item) => String(item)).join(', ')
  if (typeof value === 'object') {
    const maybeBuffer = value as { type?: string; data?: unknown[] }
    if (maybeBuffer?.type === 'Buffer' && Array.isArray(maybeBuffer?.data)) {
      return `[二进制 ${maybeBuffer.data.length} bytes]`
    }
    try {
      return JSON.stringify(value)
    } catch {
      return '[对象]'
    }
  }
  return String(value)
}

const getSnapshotColMinWidth = (column: string, rows: Record<string, any>[]) => {
  const headerLen = String(column || '').length
  const sampleMax = rows.slice(0, 20).reduce((max, row) => {
    const text = formatSnapshotCell(row?.[column])
    return Math.max(max, String(text || '').length)
  }, 0)
  const estimated = Math.max(headerLen, sampleMax)
  return Math.min(320, Math.max(100, estimated * 14 + 28))
}

const hardDeleteSnapshotObject = computed<Record<string, any> | null>(() => {
  const snapshot = hardDeleteViewRow.value?.requestSnapshot
  return snapshot && typeof snapshot === 'object' ? (snapshot as Record<string, any>) : null
})

const SNAPSHOT_FIELD_LABEL_MAP: Record<string, string> = {
  id: 'ID',
  invoiceId: '发票ID',
  documentNo: '单据编号',
  invoiceNo: '发票号码',
  receiptNo: '回款单号',
  receiptDate: '回款日期',
  customerName: '客户名称',
  contractNo: '合同号',
  projectCode: '项目编号',
  productName: '产品名称',
  productDrawing: '产品图号',
  amountReceivable: '应收金额',
  amountReceived: '实收金额',
  discountAmount: '贴息金额',
  totalAmount: '合计金额',
  paymentMethod: '回款方式',
  remark: '备注',
  month: '月份',
  orderNo: '订单编号'
}

const SNAPSHOT_HIDDEN_KEYS = new Set([
  'SSMA_TimeStamp',
  '是否删除',
  '删除时间',
  '删除人',
  '创建时间',
  '创建人',
  '更新时间',
  '更新人'
])

const SNAPSHOT_PREFERRED_ORDER = [
  'documentNo',
  '单据编号',
  'invoiceNo',
  '发票号码',
  'receiptNo',
  'customerName',
  '客户名称',
  'contractNo',
  '合同号',
  'projectCode',
  '项目编号',
  'productName',
  '产品名称',
  'productDrawing',
  '产品图号',
  'receiptDate',
  '回款日期',
  'amountReceivable',
  '应收金额',
  'amountReceived',
  '实收金额',
  'discountAmount',
  '贴息金额',
  'totalAmount',
  '合计金额',
  'paymentMethod',
  '回款方式',
  'month',
  '月份',
  'remark',
  '备注'
]

const formatSnapshotFieldValue = (key: string, value: unknown) => {
  if (typeof value === 'boolean') return value ? '是' : '否'
  const keyText = String(key || '')
  if (typeof value === 'string' && /(时间|日期|At|Date)/i.test(keyText)) {
    const t = formatTime(value)
    return t === '-' ? value : t
  }
  return formatSnapshotCell(value)
}

const hardDeleteSnapshotRows = computed<Array<{ key: string; label: string; value: string }>>(
  () => {
    const snapshot = hardDeleteSnapshotObject.value
    if (!snapshot) return []
    const rows = Object.entries(snapshot)
      .filter(
        ([key, value]) => !Array.isArray(value) && !SNAPSHOT_HIDDEN_KEYS.has(String(key || ''))
      )
      .map(([key, value]) => ({
        key,
        label: SNAPSHOT_FIELD_LABEL_MAP[key] || key,
        value: formatSnapshotFieldValue(key, value)
      }))
      .filter((row) => row.value !== '-')

    const orderIndex = (key: string) => {
      const idx = SNAPSHOT_PREFERRED_ORDER.indexOf(key)
      return idx < 0 ? Number.MAX_SAFE_INTEGER : idx
    }
    return rows.sort((a, b) => {
      const oa = orderIndex(a.key)
      const ob = orderIndex(b.key)
      if (oa !== ob) return oa - ob
      return a.label.localeCompare(b.label, 'zh-CN')
    })
  }
)

const hardDeleteSnapshotRows3Col = computed<Array<{ col1: string; col2: string; col3: string }>>(
  () => {
    const rows = hardDeleteSnapshotRows.value.map((item) => `${item.label}：${item.value}`)
    const result: Array<{ col1: string; col2: string; col3: string }> = []
    for (let i = 0; i < rows.length; i += 3) {
      result.push({
        col1: rows[i] || '-',
        col2: rows[i + 1] || '-',
        col3: rows[i + 2] || '-'
      })
    }
    return result
  }
)

const hardDeleteSnapshotTables = computed<
  Array<{ title: string; columns: string[]; rows: Record<string, any>[] }>
>(() => {
  const snapshot = hardDeleteSnapshotObject.value
  if (!snapshot) return []
  const tables: Array<{ title: string; columns: string[]; rows: Record<string, any>[] }> = []
  Object.entries(snapshot).forEach(([key, value]) => {
    if (!Array.isArray(value) || !value.length) return
    const rows = value.filter((item) => item && typeof item === 'object') as Record<string, any>[]
    if (!rows.length) return
    const colSet = new Set<string>()
    rows.forEach((row) => {
      Object.keys(row || {}).forEach((col) => colSet.add(col))
    })
    tables.push({ title: key, columns: [...colSet], rows })
  })
  return tables
})

const updateViewport = () => {
  if (typeof window === 'undefined') return
  isMobile.value = window.innerWidth < MOBILE_BREAKPOINT
}

const resolveHardDeleteSourceText = (moduleCode: unknown) => {
  const code = String(moduleCode || 'GOODS')
    .trim()
    .toUpperCase()
  if (code === 'SALES_ORDER') return '销售订单删除'
  if (code === 'FINANCE_INVOICE') return '开票单据删除'
  if (code === 'FINANCE_RECEIPT') return '回款单据删除'
  if (code === 'SALARY') return '工资删除'
  if (code === 'OUTBOUND_DOCUMENT') return '出库单删除'
  if (code === 'PROJECT_INFO') return '项目信息删除'
  if (code === 'CUSTOMER') return '客户信息删除'
  if (code === 'SUPPLIER') return '供方信息删除'
  if (code === 'EMPLOYEE') return '员工信息删除'
  if (code === 'GOODS') return '货物信息删除'
  return '硬删除申请'
}

const mapHardDeleteRows = (hardDeleteRows: HardDeleteReviewTask[]): UnifiedReviewRow[] => {
  return hardDeleteRows.map((row) => {
    const status = normalizeHardDeleteStatus(row.status)
    return {
      id: `hard-${row.id}`,
      category: 'HARD_DELETE',
      categoryText: '硬删除审核',
      sourceText: resolveHardDeleteSourceText(row.moduleCode),
      status,
      statusText: normalizeStatusText(status),
      projectCode: String(row.projectCode || ''),
      subject:
        [row.displayName, row.displayCode, row.productName, row.productDrawing]
          .filter((v, i, arr) => !!v && arr.indexOf(v) === i)
          .join(' / ') || '-',
      applicant: String(row.requesterName || ''),
      reviewer: String(row.reviewerName || ''),
      reason: String(row.requestReason || row.reviewComment || ''),
      updatedAt: row.updatedAt || row.createdAt || null,
      raw: row
    }
  })
}

const mapSalesOrderMergeRows = (rows: SalesOrderMergeReviewTask[]): UnifiedReviewRow[] => {
  return rows.map((row) => {
    const status = normalizeSalesOrderMergeStatus(row.status)
    const sourceText = row.targetOrderNo ? `并入 ${row.targetOrderNo}` : '销售订单合并'
    const subject =
      [row.sourceOrderNo, row.targetOrderNo, row.customerName].filter(Boolean).join(' / ') || '-'
    return {
      id: `sales-order-merge-${row.id}`,
      category: 'SALES_ORDER_MERGE',
      categoryText: '销售订单合并审核',
      sourceText,
      status,
      statusText: normalizeStatusText(status),
      projectCode: String(
        row.sourceSnapshot?.details?.[0]?.itemCode ||
          row.targetSnapshot?.details?.[0]?.itemCode ||
          ''
      ),
      subject,
      applicant: String(row.requesterName || ''),
      reviewer: String(row.reviewerName || ''),
      reason: String(row.reviewComment || row.requestReason || ''),
      updatedAt: row.updatedAt || row.createdAt || null,
      raw: row
    }
  })
}

const mapBmoRows = (bmoRows: BmoInitiationReviewTask[]): UnifiedReviewRow[] => {
  return bmoRows.map((row) => {
    const status = normalizeBmoStatus(row.status)
    return {
      id: `bmo-${row.bmo_record_id}`,
      category: 'BMO_INITIATION',
      categoryText: 'BMO立项审核',
      sourceText: 'BMO立项审核',
      status,
      statusText: normalizeStatusText(status),
      projectCode: String(row.project_code_candidate || ''),
      subject: [row.part_name, row.part_no].filter(Boolean).join(' / ') || '-',
      applicant: String(row.created_by || ''),
      reviewer: String(row.approved_by || ''),
      reason: String(row.rejected_reason || ''),
      updatedAt: row.updated_at || row.created_at || null,
      raw: row
    }
  })
}

const mapQuotationRows = (rows: QuotationReviewRow[]): UnifiedReviewRow[] => {
  return rows.map((row) => {
    const status = normalizeQuotationStatus(row.status)
    return {
      id: `quotation-${row.quotation_id}`,
      category: 'QUOTATION_INITIATION',
      categoryText: '报价单立项审核',
      sourceText: '报价单立项审核',
      status,
      statusText: normalizeStatusText(status),
      projectCode: String(row.project_code_candidate || row.project_code_final || ''),
      subject: [row.quotation_part_name, row.quotation_no].filter(Boolean).join(' / ') || '-',
      applicant: String(row.created_by || ''),
      reviewer: String(row.approved_by || ''),
      reason: String(
        row.initiation_rejected_reason ||
          row.customer_review_rejected_reason ||
          row.withdraw_reason ||
          ''
      ),
      updatedAt: row.updated_at || row.created_at || null,
      raw: row
    }
  })
}

const mapCustomerRows = (rows: CustomerCreateReviewTask[]): UnifiedReviewRow[] => {
  return rows.map((row) => {
    const status =
      row.status === 'APPROVED' ? 'APPROVED' : row.status === 'REJECTED' ? 'REJECTED' : 'PENDING'
    return {
      id: `customer-${row.id}`,
      category: 'CUSTOMER_CREATE',
      categoryText: '客户新增审核',
      sourceText: '客户信息审核',
      status,
      statusText: normalizeStatusText(status),
      projectCode: '',
      subject: String(row.customer_name || '-') || '-',
      applicant: String(row.created_by || ''),
      reviewer: String(row.approved_by || row.rejected_by || ''),
      reason: String(row.review_reason || row.request_reason || ''),
      updatedAt: row.updated_at || row.created_at || null,
      raw: row
    }
  })
}

async function safeLoadReviewRows<T>(
  loader: () => Promise<T>,
  categoryText: string,
  fallback: T
): Promise<T> {
  try {
    return await loader()
  } catch (error) {
    console.error(`加载${categoryText}失败:`, error)
    return fallback
  }
}

const loadUnifiedRows = async (): Promise<UnifiedReviewRow[]> => {
  const bmoStatus = mapStatusForBmoApi(query.status)
  const quotationStatus = mapStatusForQuotationApi(query.status)
  const customerStatus = mapStatusForCustomerApi(query.status)
  const hardDeleteStatus = mapStatusForHardDeleteApi(query.status)
  const salesOrderMergeStatus = mapStatusForSalesOrderMergeApi(query.status)
  const includeHardDelete =
    (query.category === 'ALL' || query.category === 'HARD_DELETE') && hardDeleteStatus !== null
  const includeSalesOrderMerge =
    (query.category === 'ALL' || query.category === 'SALES_ORDER_MERGE') &&
    salesOrderMergeStatus !== null
  const includeBmo =
    (query.category === 'ALL' || query.category === 'BMO_INITIATION') && bmoStatus !== null
  const includeQuotation = query.category === 'ALL' || query.category === 'QUOTATION_INITIATION'
  const includeCustomer = query.category === 'ALL' || query.category === 'CUSTOMER_CREATE'

  if (query.category === 'HARD_DELETE') {
    if (!includeHardDelete) {
      total.value = 0
      return []
    }
    const res = await getHardDeleteReviewTasksApi({
      status: hardDeleteStatus,
      keyword: normalizedKeyword.value || undefined,
      page: query.page,
      pageSize: query.pageSize
    })
    total.value = Number(res.data?.total || 0) || 0
    return mapHardDeleteRows((res.data?.list || []) as HardDeleteReviewTask[])
  }

  if (query.category === 'SALES_ORDER_MERGE') {
    if (!includeSalesOrderMerge) {
      total.value = 0
      return []
    }
    const res = await getSalesOrderMergeReviewTasksApi({
      status: salesOrderMergeStatus,
      keyword: normalizedKeyword.value || undefined,
      page: query.page,
      pageSize: query.pageSize
    })
    total.value = Number(res.data?.total || 0) || 0
    return mapSalesOrderMergeRows((res.data?.list || []) as SalesOrderMergeReviewTask[])
  }

  if (query.category === 'BMO_INITIATION') {
    if (!includeBmo) {
      total.value = 0
      return []
    }
    const res = await getBmoInitiationReviewTasksApi({
      status: bmoStatus,
      keyword: normalizedKeyword.value || undefined,
      page: query.page,
      pageSize: query.pageSize
    })
    total.value = Number(res.data?.total || 0) || 0
    return mapBmoRows((res.data?.list || []) as BmoInitiationReviewTask[])
  }

  if (query.category === 'QUOTATION_INITIATION') {
    const res = await getQuotationInitiationReviewTasksApi({
      status: quotationStatus || undefined,
      keyword: normalizedKeyword.value || undefined,
      page: query.page,
      pageSize: query.pageSize
    })
    total.value = Number(res.data?.total || 0) || 0
    return mapQuotationRows((res.data?.list || []) as QuotationReviewRow[])
  }

  if (query.category === 'CUSTOMER_CREATE') {
    const res = await getCustomerCreateReviewTasksForReviewCenterApi({
      status: customerStatus || undefined,
      keyword: normalizedKeyword.value || undefined,
      page: query.page,
      pageSize: query.pageSize
    })
    total.value = Number(res.data?.total || 0) || 0
    return mapCustomerRows((res.data?.list || []) as CustomerCreateReviewTask[])
  }

  if (query.status === 'ALL') {
    const fetchAllHardDelete = async () => {
      if (!includeHardDelete) return [] as UnifiedReviewRow[]
      const rows: UnifiedReviewRow[] = []
      const pageSize = 200
      let page = 1
      let totalRows = Number.POSITIVE_INFINITY
      while ((page - 1) * pageSize < totalRows) {
        const res = await getHardDeleteReviewTasksApi({
          status: hardDeleteStatus,
          keyword: normalizedKeyword.value || undefined,
          page,
          pageSize
        })
        const part = mapHardDeleteRows((res.data?.list || []) as HardDeleteReviewTask[])
        totalRows = Number(res.data?.total || 0) || 0
        rows.push(...part)
        if (!part.length) break
        page += 1
      }
      return rows
    }

    const fetchAllBmo = async () => {
      if (!includeBmo) return [] as UnifiedReviewRow[]
      const rows: UnifiedReviewRow[] = []
      const pageSize = 200
      let page = 1
      let totalRows = Number.POSITIVE_INFINITY
      while ((page - 1) * pageSize < totalRows) {
        const res = await getBmoInitiationReviewTasksApi({
          status: bmoStatus,
          keyword: normalizedKeyword.value || undefined,
          page,
          pageSize
        })
        const part = mapBmoRows((res.data?.list || []) as BmoInitiationReviewTask[])
        totalRows = Number(res.data?.total || 0) || 0
        rows.push(...part)
        if (!part.length) break
        page += 1
      }
      return rows
    }

    const fetchAllQuotation = async () => {
      if (!includeQuotation) return [] as UnifiedReviewRow[]
      const rows: UnifiedReviewRow[] = []
      const pageSize = 200
      let page = 1
      let totalRows = Number.POSITIVE_INFINITY
      while ((page - 1) * pageSize < totalRows) {
        const res = await getQuotationInitiationReviewTasksApi({
          status: quotationStatus || undefined,
          keyword: normalizedKeyword.value || undefined,
          page,
          pageSize
        })
        const part = mapQuotationRows((res.data?.list || []) as QuotationReviewRow[])
        totalRows = Number(res.data?.total || 0) || 0
        rows.push(...part)
        if (!part.length) break
        page += 1
      }
      return rows
    }

    const fetchAllCustomer = async () => {
      if (!includeCustomer) return [] as UnifiedReviewRow[]
      const rows: UnifiedReviewRow[] = []
      const pageSize = 200
      let page = 1
      let totalRows = Number.POSITIVE_INFINITY
      while ((page - 1) * pageSize < totalRows) {
        const res = await getCustomerCreateReviewTasksForReviewCenterApi({
          status: customerStatus || undefined,
          keyword: normalizedKeyword.value || undefined,
          page,
          pageSize
        })
        const part = mapCustomerRows((res.data?.list || []) as CustomerCreateReviewTask[])
        totalRows = Number(res.data?.total || 0) || 0
        rows.push(...part)
        if (!part.length) break
        page += 1
      }
      return rows
    }

    const fetchAllSalesOrderMerge = async () => {
      if (!includeSalesOrderMerge) return [] as UnifiedReviewRow[]
      const rows: UnifiedReviewRow[] = []
      const pageSize = 200
      let page = 1
      let totalRows = Number.POSITIVE_INFINITY
      while ((page - 1) * pageSize < totalRows) {
        const res = await getSalesOrderMergeReviewTasksApi({
          status: salesOrderMergeStatus,
          keyword: normalizedKeyword.value || undefined,
          page,
          pageSize
        })
        const part = mapSalesOrderMergeRows((res.data?.list || []) as SalesOrderMergeReviewTask[])
        totalRows = Number(res.data?.total || 0) || 0
        rows.push(...part)
        if (!part.length) break
        page += 1
      }
      return rows
    }

    const [hardRows, salesOrderMergeRows, bmoRows, quotationRows, customerRows] = await Promise.all(
      [
        safeLoadReviewRows(fetchAllHardDelete, '硬删除审核任务', [] as UnifiedReviewRow[]),
        safeLoadReviewRows(
          fetchAllSalesOrderMerge,
          '销售订单合并审核任务',
          [] as UnifiedReviewRow[]
        ),
        safeLoadReviewRows(fetchAllBmo, 'BMO立项审核任务', [] as UnifiedReviewRow[]),
        safeLoadReviewRows(fetchAllQuotation, '报价单立项审核任务', [] as UnifiedReviewRow[]),
        safeLoadReviewRows(fetchAllCustomer, '客户新增审核任务', [] as UnifiedReviewRow[])
      ]
    )
    const mergedRows = [
      ...hardRows,
      ...salesOrderMergeRows,
      ...bmoRows,
      ...quotationRows,
      ...customerRows
    ].sort((a, b) => {
      const ta = a.updatedAt ? new Date(a.updatedAt).getTime() : 0
      const tb = b.updatedAt ? new Date(b.updatedAt).getTime() : 0
      return tb - ta
    })
    total.value = mergedRows.length
    return mergedRows.slice((query.page - 1) * query.pageSize, query.page * query.pageSize)
  }

  const mergePageSize = Math.max(50, query.pageSize)
  const targetCount = query.page * query.pageSize
  const merged: UnifiedReviewRow[] = []
  const readTimestamp = (row: UnifiedReviewRow | null) =>
    row?.updatedAt ? new Date(row.updatedAt).getTime() || 0 : 0

  let hardPage = 1
  let hardTotal = 0
  let hardLoaded = 0
  let hardBuffer: UnifiedReviewRow[] = []
  let hardCursor = 0

  let bmoPage = 1
  let bmoTotal = 0
  let bmoLoaded = 0
  let bmoBuffer: UnifiedReviewRow[] = []
  let bmoCursor = 0

  let quotationPage = 1
  let quotationTotal = 0
  let quotationLoaded = 0
  let quotationBuffer: UnifiedReviewRow[] = []
  let quotationCursor = 0

  let customerPage = 1
  let customerTotal = 0
  let customerLoaded = 0
  let customerBuffer: UnifiedReviewRow[] = []
  let customerCursor = 0

  let salesOrderMergePage = 1
  let salesOrderMergeTotal = 0
  let salesOrderMergeLoaded = 0
  let salesOrderMergeBuffer: UnifiedReviewRow[] = []
  let salesOrderMergeCursor = 0

  const fetchHardNext = async () => {
    if (!includeHardDelete) return
    if (hardLoaded >= hardTotal && hardPage > 1) return
    const res = await getHardDeleteReviewTasksApi({
      status: hardDeleteStatus,
      keyword: normalizedKeyword.value || undefined,
      page: hardPage,
      pageSize: mergePageSize
    })
    const part = mapHardDeleteRows((res.data?.list || []) as HardDeleteReviewTask[])
    hardTotal = Number(res.data?.total || 0) || 0
    hardLoaded += part.length
    hardPage += 1
    hardBuffer = part
    hardCursor = 0
  }

  const fetchBmoNext = async () => {
    if (!includeBmo) return
    if (bmoLoaded >= bmoTotal && bmoPage > 1) return
    const res = await getBmoInitiationReviewTasksApi({
      status: bmoStatus,
      keyword: normalizedKeyword.value || undefined,
      page: bmoPage,
      pageSize: mergePageSize
    })
    const part = mapBmoRows((res.data?.list || []) as BmoInitiationReviewTask[])
    bmoTotal = Number(res.data?.total || 0) || 0
    bmoLoaded += part.length
    bmoPage += 1
    bmoBuffer = part
    bmoCursor = 0
  }

  const fetchSalesOrderMergeNext = async () => {
    if (!includeSalesOrderMerge) return
    if (salesOrderMergeLoaded >= salesOrderMergeTotal && salesOrderMergePage > 1) return
    const res = await getSalesOrderMergeReviewTasksApi({
      status: salesOrderMergeStatus,
      keyword: normalizedKeyword.value || undefined,
      page: salesOrderMergePage,
      pageSize: mergePageSize
    })
    const part = mapSalesOrderMergeRows((res.data?.list || []) as SalesOrderMergeReviewTask[])
    salesOrderMergeTotal = Number(res.data?.total || 0) || 0
    salesOrderMergeLoaded += part.length
    salesOrderMergePage += 1
    salesOrderMergeBuffer = part
    salesOrderMergeCursor = 0
  }

  const fetchQuotationNext = async () => {
    if (!includeQuotation) return
    if (quotationLoaded >= quotationTotal && quotationPage > 1) return
    const res = await getQuotationInitiationReviewTasksApi({
      status: quotationStatus || undefined,
      keyword: normalizedKeyword.value || undefined,
      page: quotationPage,
      pageSize: mergePageSize
    })
    const part = mapQuotationRows((res.data?.list || []) as QuotationReviewRow[])
    quotationTotal = Number(res.data?.total || 0) || 0
    quotationLoaded += part.length
    quotationPage += 1
    quotationBuffer = part
    quotationCursor = 0
  }

  const fetchCustomerNext = async () => {
    if (!includeCustomer) return
    if (customerLoaded >= customerTotal && customerPage > 1) return
    const res = await getCustomerCreateReviewTasksForReviewCenterApi({
      status: customerStatus || undefined,
      keyword: normalizedKeyword.value || undefined,
      page: customerPage,
      pageSize: mergePageSize
    })
    const part = mapCustomerRows((res.data?.list || []) as CustomerCreateReviewTask[])
    customerTotal = Number(res.data?.total || 0) || 0
    customerLoaded += part.length
    customerPage += 1
    customerBuffer = part
    customerCursor = 0
  }

  while (merged.length < targetCount) {
    const shouldFetchHard = includeHardDelete && hardCursor >= hardBuffer.length
    const shouldFetchSalesOrderMerge =
      includeSalesOrderMerge && salesOrderMergeCursor >= salesOrderMergeBuffer.length
    const shouldFetchBmo = includeBmo && bmoCursor >= bmoBuffer.length
    const shouldFetchQuotation = includeQuotation && quotationCursor >= quotationBuffer.length
    const shouldFetchCustomer = includeCustomer && customerCursor >= customerBuffer.length

    await Promise.all([
      shouldFetchHard
        ? safeLoadReviewRows(
            async () => {
              await fetchHardNext()
              return null
            },
            '硬删除审核任务',
            null
          )
        : Promise.resolve(null),
      shouldFetchSalesOrderMerge
        ? safeLoadReviewRows(
            async () => {
              await fetchSalesOrderMergeNext()
              return null
            },
            '销售订单合并审核任务',
            null
          )
        : Promise.resolve(null),
      shouldFetchBmo
        ? safeLoadReviewRows(
            async () => {
              await fetchBmoNext()
              return null
            },
            'BMO立项审核任务',
            null
          )
        : Promise.resolve(null),
      shouldFetchQuotation
        ? safeLoadReviewRows(
            async () => {
              await fetchQuotationNext()
              return null
            },
            '报价单立项审核任务',
            null
          )
        : Promise.resolve(null),
      shouldFetchCustomer
        ? safeLoadReviewRows(
            async () => {
              await fetchCustomerNext()
              return null
            },
            '客户新增审核任务',
            null
          )
        : Promise.resolve(null)
    ])

    const hardHead = hardCursor < hardBuffer.length ? hardBuffer[hardCursor] : null
    const salesOrderMergeHead =
      salesOrderMergeCursor < salesOrderMergeBuffer.length
        ? salesOrderMergeBuffer[salesOrderMergeCursor]
        : null
    const bmoHead = bmoCursor < bmoBuffer.length ? bmoBuffer[bmoCursor] : null
    const quotationHead =
      quotationCursor < quotationBuffer.length ? quotationBuffer[quotationCursor] : null
    const customerHead =
      customerCursor < customerBuffer.length ? customerBuffer[customerCursor] : null
    const heads = [hardHead, salesOrderMergeHead, bmoHead, quotationHead, customerHead].filter(
      Boolean
    ) as UnifiedReviewRow[]
    if (!heads.length) break

    const pick = heads.sort((a, b) => readTimestamp(b) - readTimestamp(a))[0]
    if (pick === hardHead) {
      merged.push(hardHead as UnifiedReviewRow)
      hardCursor += 1
      continue
    }
    if (pick === bmoHead) {
      merged.push(bmoHead as UnifiedReviewRow)
      bmoCursor += 1
      continue
    }
    if (pick === salesOrderMergeHead) {
      merged.push(salesOrderMergeHead as UnifiedReviewRow)
      salesOrderMergeCursor += 1
      continue
    }
    if (pick === quotationHead) {
      merged.push(quotationHead as UnifiedReviewRow)
      quotationCursor += 1
      continue
    }
    merged.push(customerHead as UnifiedReviewRow)
    customerCursor += 1
  }

  total.value =
    (includeHardDelete ? hardTotal : 0) +
    (includeSalesOrderMerge ? salesOrderMergeTotal : 0) +
    (includeBmo ? bmoTotal : 0) +
    (includeQuotation ? quotationTotal : 0) +
    (includeCustomer ? customerTotal : 0)
  return merged.slice((query.page - 1) * query.pageSize, query.page * query.pageSize)
}

const loadTasks = async () => {
  loading.value = true
  try {
    list.value = await loadUnifiedRows()
  } catch (e: any) {
    list.value = []
    total.value = 0
    ElMessage.error(e?.message || '读取审核任务失败')
  } finally {
    loading.value = false
  }
}

const handleSearch = async () => {
  query.page = 1
  await loadTasks()
}

const handleReset = async () => {
  query.category = 'ALL'
  query.status = 'PENDING'
  query.keyword = ''
  query.page = 1
  query.pageSize = 20
  await loadTasks()
}

const handlePageSizeChange = async () => {
  query.page = 1
  await loadTasks()
}

const applyQuickStatus = async (status: StandardStatus) => {
  query.status = status
  query.page = 1
  await loadTasks()
}

const openBmoViewDialog = async (row: UnifiedReviewRow) => {
  if (row.category !== 'BMO_INITIATION') return
  const data = row.raw as BmoInitiationReviewTask
  const bmoRecordId = String(data.bmo_record_id || '').trim()
  if (!bmoRecordId) {
    ElMessage.error('缺少 bmo_record_id，无法查看立项')
    return
  }

  viewDialogVisible.value = true
  viewDialogLoading.value = true
  viewRow.value = data
  viewRequest.value = null
  try {
    const requestRes = await getBmoInitiationRequestApi({ bmo_record_id: bmoRecordId })
    viewRequest.value = (requestRes.data as any) || null
  } catch (e: any) {
    ElMessage.error(e?.message || '读取立项详情失败')
  } finally {
    viewDialogLoading.value = false
  }
}

const openQuotationViewDialog = (row: UnifiedReviewRow) => {
  if (row.category !== 'QUOTATION_INITIATION') return
  quotationViewRequest.value = row.raw as QuotationReviewRow
  quotationViewDialogVisible.value = true
}

const openCustomerCreateViewDialog = (row: UnifiedReviewRow) => {
  if (row.category !== 'CUSTOMER_CREATE') return
  customerCreateViewRow.value = row.raw as CustomerCreateReviewTask
  customerCreateViewDialogVisible.value = true
}

const openSalesOrderMergeViewDialog = (row: UnifiedReviewRow) => {
  if (row.category !== 'SALES_ORDER_MERGE') return
  salesOrderMergeViewRow.value = row.raw as SalesOrderMergeReviewTask
  salesOrderMergeViewDialogVisible.value = true
}

const openHardDeleteViewDialog = (row: UnifiedReviewRow) => {
  if (row.category !== 'HARD_DELETE') return
  hardDeleteViewRow.value = row.raw as HardDeleteReviewTask
  hardDeleteViewDialogVisible.value = true
}

const openRejectDialog = (row: UnifiedReviewRow) => {
  if (!canReview(row)) return
  rejectTarget.value = row
  rejectReason.value = ''
  rejectDialogVisible.value = true
}

const closeRejectDialog = () => {
  rejectDialogVisible.value = false
  rejectTarget.value = null
  rejectReason.value = ''
}

const submitReject = async () => {
  const target = rejectTarget.value
  const reason = String(rejectReason.value || '').trim()
  if (!target) return
  if (!reason) {
    ElMessage.warning('请填写驳回原因')
    return
  }
  rejectSubmitting.value = true
  try {
    if (target.category === 'HARD_DELETE') {
      const data = target.raw as HardDeleteReviewTask
      await rejectHardDeleteReviewApi({ requestId: Number(data.id), reason })
    } else if (target.category === 'SALES_ORDER_MERGE') {
      const data = target.raw as SalesOrderMergeReviewTask
      await rejectSalesOrderMergeReviewApi({ requestId: Number(data.id), reason })
    } else if (target.category === 'BMO_INITIATION') {
      const data = target.raw as BmoInitiationReviewTask
      await rejectBmoInitiationReviewApi({
        bmo_record_id: String(data.bmo_record_id || ''),
        reason
      })
    } else if (target.category === 'QUOTATION_INITIATION') {
      const data = target.raw as QuotationInitiationRequestRow
      await rejectQuotationInitiationReviewApi({
        quotationId: Number(data.quotation_id || 0),
        reason
      })
    } else {
      const data = target.raw as CustomerCreateReviewTask
      await rejectCustomerCreateReviewForReviewCenterApi({ requestId: Number(data.id), reason })
    }

    await refreshBmoMenuBadges()
    ElMessage.success('已驳回')
    closeRejectDialog()
    await loadTasks()
  } catch (e: any) {
    ElMessage.error(e?.message || '驳回失败')
  } finally {
    rejectSubmitting.value = false
  }
}

const handleApprove = async (row: UnifiedReviewRow) => {
  if (!canReview(row)) return
  try {
    await ElMessageBox.confirm(`确认通过「${row.subject || row.categoryText}」吗？`, '审核通过', {
      confirmButtonText: '确认通过',
      cancelButtonText: '取消',
      type: 'warning'
    })
  } catch (e: any) {
    if (e === 'cancel' || e?.action === 'cancel' || e?.action === 'close') return
  }

  approvingId.value = row.id
  try {
    if (row.category === 'HARD_DELETE') {
      const data = row.raw as HardDeleteReviewTask
      await approveHardDeleteReviewApi({ requestId: Number(data.id) })
      ElMessage.success('审核通过，已执行硬删除')
    } else if (row.category === 'SALES_ORDER_MERGE') {
      const data = row.raw as SalesOrderMergeReviewTask
      await approveSalesOrderMergeReviewApi({ requestId: Number(data.id) })
      ElMessage.success('销售订单合并审核已通过')
    } else if (row.category === 'BMO_INITIATION') {
      const data = row.raw as BmoInitiationReviewTask
      const res = await approveAndApplyBmoInitiationReviewApi({
        bmo_record_id: String(data.bmo_record_id || '')
      })
      ElMessage.success(`审核通过：${res.data?.projectCode || '-'} / ${res.data?.orderNo || '-'}`)
    } else if (row.category === 'QUOTATION_INITIATION') {
      const data = row.raw as QuotationInitiationRequestRow
      const res = await approveAndApplyQuotationInitiationApi({
        quotationId: Number(data.quotation_id || 0)
      })
      ElMessage.success(
        `审核通过：${res.data?.data?.projectCode || '-'} / ${res.data?.data?.orderNo || '-'}`
      )
    } else {
      const data = row.raw as CustomerCreateReviewTask
      await approveCustomerCreateReviewForReviewCenterApi({ requestId: Number(data.id) })
      ElMessage.success('客户新增审核已通过')
    }

    await refreshBmoMenuBadges()
    await loadTasks()
  } catch (e: any) {
    ElMessage.error(e?.message || '审核通过失败')
  } finally {
    approvingId.value = ''
  }
}

const getBmoSourceFields = (): FieldItem[] => [
  buildField('零部件图号', viewRow.value?.part_no),
  buildField('零部件名称', viewRow.value?.part_name),
  buildField('产品型号', viewRow.value?.model),
  buildField('模具编号', viewRow.value?.mold_number),
  buildField('中标价格(含税)', formatAmount(viewRow.value?.bid_price_tax_incl ?? null)),
  buildField('中标时间', formatTime(viewRow.value?.bid_time || null))
]

const getBmoReviewFields = (): FieldItem[] => [
  buildField('当前状态', normalizeStatusText(normalizeBmoStatus(viewRequest.value?.status))),
  buildField('项目编号候选', viewRequest.value?.project_code_candidate),
  buildField('最终项目编号', viewRequest.value?.project_code_final),
  buildField('申请人', viewRequest.value?.created_by),
  buildField('确认人', viewRequest.value?.confirmed_by),
  buildField('审核人', viewRequest.value?.approved_by),
  buildField('创建时间', formatTime(viewRequest.value?.created_at || null)),
  buildField('提交审核时间', formatTime(viewRequest.value?.confirmed_at || null)),
  buildField('审核通过时间', formatTime(viewRequest.value?.approved_at || null)),
  buildField('更新时间', formatTime(viewRequest.value?.updated_at || null)),
  buildField('驳回原因', viewRequest.value?.rejected_reason, 'full')
]

const getBmoProjectFields = (): FieldItem[] => [
  buildField('项目编号', viewRequest.value?.goods_draft?.projectCode),
  buildField('项目分类', viewRequest.value?.goods_draft?.category),
  buildField('客户名称', viewRequest.value?.goods_draft?.customerName),
  buildField('客户模号', viewRequest.value?.goods_draft?.customerModelNo),
  buildField('产品名称', viewRequest.value?.goods_draft?.productName),
  buildField('产品图号', viewRequest.value?.goods_draft?.productDrawing),
  buildField('备注', viewRequest.value?.goods_draft?.remarks, 'full')
]

const getBmoSalesFields = (): FieldItem[] => [
  buildField('订单日期', viewRequest.value?.sales_order_draft?.orderDate),
  buildField('签订日期', viewRequest.value?.sales_order_draft?.signDate),
  buildField('合同号', viewRequest.value?.sales_order_draft?.contractNo),
  buildField('客户ID', viewRequest.value?.sales_order_draft?.customerId)
]

const getBmoTechFields = (): FieldItem[] => [
  buildField('FD ID', viewRequest.value?.tech_snapshot?.fdId),
  buildField('提需类型', viewRequest.value?.tech_snapshot?.demandType),
  buildField('设计师', viewRequest.value?.tech_snapshot?.designer),
  buildField('技术表', viewRequest.value?.tech_snapshot?.tech?.tableName)
]

const getQuotationBaseFields = (): FieldItem[] => {
  const row = quotationViewRequest.value
  return [
    buildField('客户名称', row?.quotation_customer_name),
    buildField(
      '立项状态',
      row?.status_text || normalizeStatusText(normalizeQuotationStatus(row?.status))
    ),
    buildField('项目编号候选', row?.project_code_candidate),
    buildField('最终项目编号', row?.project_code_final),
    buildField('销售订单号', row?.sales_order_no),
    buildField('申请人', row?.created_by),
    buildField('审核人', row?.approved_by),
    buildField('草稿保存时间', formatTime(row?.draft_saved_at || null)),
    buildField('提交审核时间', formatTime(row?.submitted_at || null)),
    buildField('审核通过时间', formatTime(row?.approved_at || null)),
    buildField('驳回时间', formatTime(row?.rejected_at || null)),
    buildField('撤回时间', formatTime(row?.withdrawn_at || null)),
    buildField('更新时间', formatTime(row?.updated_at || null)),
    buildField('立项审核驳回原因', row?.initiation_rejected_reason, 'full'),
    buildField('客户审核驳回原因', row?.customer_review_rejected_reason, 'full'),
    buildField('撤回原因', row?.withdraw_reason, 'full')
  ]
}

const getQuotationProjectFields = (): FieldItem[] => {
  const row = quotationViewRequest.value
  return [
    buildField('项目编号', row?.project_draft?.projectCode || row?.project_code_candidate),
    buildField('项目分类', row?.project_draft?.category),
    buildField('客户名称', row?.project_draft?.customerName || row?.quotation_customer_name),
    buildField('客户模号', row?.project_draft?.customerModelNo),
    buildField('产品名称', row?.project_draft?.productName),
    buildField('产品图号', row?.project_draft?.productDrawing)
  ]
}

const getQuotationSalesFields = (): FieldItem[] => {
  const row = quotationViewRequest.value
  return [
    buildField('订单日期', row?.sales_order_draft?.orderDate),
    buildField('签订日期', row?.sales_order_draft?.signDate),
    buildField('合同号', row?.sales_order_draft?.contractNo),
    buildField('客户ID', row?.sales_order_draft?.customerId)
  ]
}

const getCustomerCreateFields = (): FieldItem[] => {
  const row = customerCreateViewRow.value
  return [
    buildField('状态', row?.status_text),
    buildField('申请人', row?.created_by),
    buildField('审核通过人', row?.approved_by),
    buildField('审核驳回人', row?.rejected_by),
    buildField('申请原因', row?.request_reason, 'full'),
    buildField('审核意见', row?.review_reason, 'full'),
    buildField('创建时间', formatTime(row?.created_at || null)),
    buildField('审核通过时间', formatTime(row?.approved_at || null)),
    buildField('审核驳回时间', formatTime(row?.rejected_at || null)),
    buildField('更新时间', formatTime(row?.updated_at || null))
  ]
}

const getSalesOrderMergeReviewFields = (): FieldItem[] => {
  const row = salesOrderMergeViewRow.value
  return [
    buildField('审核状态', row?.statusText),
    buildField('客户名称', row?.customerName),
    buildField('申请人', row?.requesterName),
    buildField('审核人', row?.reviewerName),
    buildField('申请说明', row?.requestReason, 'full'),
    buildField('审核意见', row?.reviewComment, 'full'),
    buildField('执行错误', row?.executionError, 'full')
  ]
}

const getSalesOrderSourceFields = (): FieldItem[] => {
  const row = salesOrderMergeViewRow.value
  return [
    buildField('订单编号', row?.sourceOrderNo),
    buildField('订单日期', row?.sourceSnapshot?.orderDate),
    buildField('签订日期', row?.sourceSnapshot?.signDate),
    buildField('合同号', row?.sourceSnapshot?.contractNo)
  ]
}

const getSalesOrderTargetFields = (): FieldItem[] => {
  const row = salesOrderMergeViewRow.value
  return [
    buildField('订单编号', row?.targetOrderNo),
    buildField('订单日期', row?.targetSnapshot?.orderDate),
    buildField('签订日期', row?.targetSnapshot?.signDate),
    buildField('合同号', row?.targetSnapshot?.contractNo)
  ]
}

const getSalesOrderPreviewFields = (): FieldItem[] => {
  const row = salesOrderMergeViewRow.value
  return [
    buildField('保留订单编号', row?.preview?.orderNo || row?.targetOrderNo),
    buildField('合并后明细', row?.preview?.detailCount),
    buildField('合并后总数量', row?.preview?.totalQuantity),
    buildField('合并后总金额', row?.preview?.totalAmount)
  ]
}

const getHardDeleteEntityFields = (): FieldItem[] => {
  const row = hardDeleteViewRow.value
  return [
    buildField('内容来源', resolveHardDeleteSourceText(row?.moduleCode)),
    buildField('审核状态', normalizeStatusText(normalizeHardDeleteStatus(row?.status))),
    buildField('实体标识', row?.entityKey),
    buildField('项目编号', row?.projectCode),
    buildField('显示编码', row?.displayCode),
    buildField('显示名称', row?.displayName),
    buildField('产品名称', row?.productName),
    buildField('产品图号', row?.productDrawing),
    buildField('分类', row?.category),
    buildField('申请来源', row?.requestSource)
  ]
}

const getHardDeleteReviewFields = (): FieldItem[] => {
  const row = hardDeleteViewRow.value
  return [
    buildField('申请人', row?.requesterName),
    buildField('审核人', row?.reviewerName),
    buildField('创建时间', formatTime(row?.createdAt || null)),
    buildField('更新时间', formatTime(row?.updatedAt || null)),
    buildField('通过时间', formatTime(row?.approvedAt || null)),
    buildField('驳回时间', formatTime(row?.rejectedAt || null)),
    buildField('取消时间', formatTime(row?.canceledAt || null)),
    buildField('执行时间', formatTime(row?.executedAt || null)),
    buildField('申请说明', row?.requestReason, 'full'),
    buildField('审核意见', row?.reviewComment, 'full'),
    buildField('执行错误', row?.executionError, 'full')
  ]
}

onMounted(async () => {
  updateViewport()
  window.addEventListener('resize', updateViewport, { passive: true })
  const initBmoRecordId = String(route.query.bmoRecordId || '').trim()
  if (initBmoRecordId) {
    query.category = 'BMO_INITIATION'
    query.keyword = initBmoRecordId
  }
  await loadTasks()
})

onBeforeUnmount(() => {
  if (typeof window === 'undefined') return
  window.removeEventListener('resize', updateViewport)
})
</script>

<style scoped lang="less">
.review-center-page {
  --review-bg: #f6f4ef;
  --review-panel: #fff;
  --review-panel-strong: #fff;
  --review-ink: #1d2430;
  --review-muted: #6c7280;
  --review-line: #e6e8ec;
  --review-accent: #9d4b20;
  --review-shadow: 0 8px 24px rgb(15 23 42 / 6%);

  min-height: 100%;
  padding: 16px;
  color: var(--review-ink);
  background: var(--review-bg);

  :deep(.el-button--primary) {
    --el-button-bg-color: #9d4b20;
    --el-button-border-color: #9d4b20;
    --el-button-hover-bg-color: #b05822;
    --el-button-hover-border-color: #b05822;
  }

  :deep(.el-input__wrapper),
  :deep(.el-select__wrapper),
  :deep(.el-textarea__inner) {
    background: #fff;
    box-shadow: inset 0 0 0 1px #d9dde5;
  }

  :deep(.review-filter-panel .el-input__wrapper),
  :deep(.review-filter-panel .el-select__wrapper) {
    min-height: 32px;
    padding-top: 0;
    padding-bottom: 0;
  }

  :deep(.review-filter-panel .el-form-item__label) {
    padding-right: 8px;
    line-height: 32px;
  }

  :deep(.review-filter-panel .el-button) {
    min-height: 32px;
    padding: 7px 14px;
  }

  :deep(.el-table) {
    --el-table-border-color: #e6e8ec;
    --el-table-header-bg-color: #f8f9fb;
    --el-table-row-hover-bg-color: #f7f9fc;
  }

  :deep(.el-pagination) {
    padding: 0;
  }

  :deep(.review-dialog .el-dialog__header) {
    padding: 14px 16px 8px;
  }

  :deep(.review-dialog .el-dialog__body) {
    padding: 0 16px 12px;
  }

  :deep(.review-dialog .el-dialog__footer) {
    padding: 8px 16px 14px;
  }

  :deep(.review-dialog .el-table) {
    --el-table-cell-padding: 6px 0;
  }
}

.review-filter-panel,
.review-board,
.detail-section,
.compare-card,
.dialog-hero,
.dialog-spotlight {
  background: var(--review-panel);
  border: 1px solid var(--review-line);
  border-radius: 14px;
  box-shadow: var(--review-shadow);
}

.dialog-head__eyebrow {
  font-family: 'Avenir Next', 'PingFang SC', 'Hiragino Sans GB', sans-serif;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.12em;
  color: #91673a;
  text-transform: uppercase;
}

.dialog-head__title {
  margin: 0;
}

.dialog-head__desc,
.review-filter-panel__desc,
.review-board__desc {
  font-size: 13px;
  line-height: 1.6;
  color: var(--review-muted);
}

.review-board__meta,
.dialog-hero__label,
.dialog-spotlight__label,
.review-meta-item__label,
.review-card__time,
.review-board__title,
.detail-section__title,
.compare-card__title,
.snapshot-block__title {
  font-family: 'Avenir Next', 'PingFang SC', 'Hiragino Sans GB', sans-serif;
  letter-spacing: 0.02em;
  color: #111827;
}

.review-filter-panel {
  padding: 12px 14px 10px;
  margin-top: 12px;
}

.review-board__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.review-board__title,
.detail-section__title,
.compare-card__title,
.snapshot-block__title {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}

.review-filter-panel__quick {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-left: auto;
  justify-content: flex-end;
}

.status-switch {
  min-height: 28px;
  padding: 0 9px;
  font-size: 12px;
  color: #4b5563;
  background: #fff;
  border: 1px solid #d8dde6;
  border-radius: 999px;
  transition: all 0.18s ease;
}

.status-switch--active {
  color: #111827;
  background: #f3f6fb;
  border-color: #c8d1de;
}

.review-filter-form {
  margin-top: 10px;
}

.review-filter-form__actions {
  display: flex;
  width: 100%;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.review-filter-form :deep(.el-form-item:last-child) {
  flex: 1 1 auto;
}

.review-board {
  padding: 16px;
  margin-top: 12px;
}

.review-feed {
  margin-top: 12px;
}

.review-empty {
  padding: 40px 0;
}

.review-table {
  overflow: hidden;
  border-radius: 10px;
}

.review-table__category {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.05em;
}

.review-table__subject {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.review-table__subject-title {
  font-size: 14px;
  font-weight: 600;
  color: #26303b;
}

.review-table__subject-summary {
  font-size: 12px;
  line-height: 1.5;
  color: var(--review-muted);
}

.review-table__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.review-card {
  position: relative;
  display: flex;
  padding: 16px;
  background: var(--review-panel-strong);
  border: 1px solid var(--review-line);
  border-radius: 12px;
  box-shadow: none;
  flex-direction: column;
  gap: 14px;
}

.review-card::before {
  position: absolute;
  top: 18px;
  left: 18px;
  width: 8px;
  height: 8px;
  background: currentcolor;
  border-radius: 999px;
  content: '';
}

.review-card--hard-delete {
  color: #8c3121;
}

.review-card--sales-merge {
  color: #8a5522;
}

.review-card--bmo {
  color: #2e6270;
}

.review-card--quotation {
  color: #465c93;
}

.review-card--customer {
  color: #2f6c4d;
}

.review-card__topline,
.review-card__category-wrap,
.review-card__actions,
.dialog-footer,
.dialog-hero,
.dialog-spotlight__meta {
  display: flex;
  align-items: center;
}

.review-card__topline {
  justify-content: space-between;
  gap: 12px;
  padding-left: 14px;
}

.review-card__category-wrap {
  flex-wrap: wrap;
  gap: 10px;
}

.review-card__category {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.review-card__time {
  font-size: 12px;
  color: #84725a;
}

.review-card__headline {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.review-card__project,
.dialog-hero__value,
.dialog-spotlight__title {
  font-size: 18px;
  line-height: 1.25;
  color: #222933;
}

.review-card__subject {
  font-size: 15px;
  font-weight: 600;
  color: #2d3440;
}

.review-card__reason {
  font-size: 13px;
  line-height: 1.7;
  color: var(--review-muted);
}

.review-card__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.review-meta-item {
  display: flex;
  padding: 10px 12px;
  background: #fafbfc;
  border: 1px solid #eceff3;
  border-radius: 10px;
  flex-direction: column;
  gap: 6px;
}

.review-meta-item__label,
.dialog-hero__label,
.dialog-spotlight__label {
  font-size: 11px;
  color: #8d7653;
  text-transform: uppercase;
}

.review-meta-item__value,
.dialog-spotlight__meta {
  font-size: 14px;
  line-height: 1.7;
  color: #28303a;
  word-break: break-word;
}

.review-card__actions {
  justify-content: flex-end;
  gap: 14px;
}

.detail-kv-table {
  margin-top: 8px;
}

.detail-kv-table :deep(.el-table__cell) {
  vertical-align: top;
}

.review-pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 18px;
}

.dialog-head {
  padding-right: 8px;
}

.dialog-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-bottom: 0;
}

.dialog-body--compact {
  gap: 10px;
}

.dialog-body--dense {
  gap: 8px;
}

.dialog-body--dense .dialog-hero {
  padding: 10px 12px;
}

.dialog-body--dense .detail-section {
  padding: 10px;
}

.dialog-hero {
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  background: #fafbfc;
}

.dialog-hero__aside {
  display: flex;
  align-items: flex-start;
}

.detail-section,
.compare-card {
  padding: 12px;
}

.detail-compare {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.compare-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.dialog-spotlight {
  padding: 12px;
}

.dialog-spotlight__title {
  margin-top: 4px;
  font-size: 18px;
}

.dialog-spotlight__meta {
  gap: 8px;
  margin-top: 6px;
  font-size: 12px;
  color: var(--review-muted);
}

.dialog-footer {
  justify-content: flex-end;
  gap: 8px;
}

.snapshot-space {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.snapshot-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.snapshot-empty {
  font-size: 14px;
  color: var(--review-muted);
}

@media (width <= 1100px) {
  .detail-compare {
    grid-template-columns: 1fr;
  }
}

@media (width <= 900px) {
  .review-center-page {
    padding: 10px;
  }

  .review-filter-panel,
  .review-board,
  .detail-section,
  .compare-card,
  .dialog-hero,
  .dialog-spotlight {
    border-radius: 12px;
  }

  .review-filter-panel,
  .review-board {
    padding: 14px;
  }

  .dialog-head__title {
    font-size: 22px;
  }

  .review-filter-panel__head,
  .review-board__head,
  .review-card__topline,
  .dialog-hero,
  .dialog-footer {
    flex-direction: column;
    align-items: flex-start;
  }

  .review-card__actions {
    justify-content: flex-start;
    flex-wrap: wrap;
  }

  .review-card__grid {
    grid-template-columns: 1fr;
  }

  .review-pagination {
    padding-bottom: 4px;
    overflow-x: auto;
    justify-content: center;
  }

  .review-filter-panel__quick {
    width: 100%;
  }

  .status-switch {
    flex: 1 1 calc(50% - 10px);
  }

  .review-filter-form__actions {
    width: 100%;
    align-items: stretch;
  }

  .review-filter-form__actions :deep(.el-button) {
    flex: 1 1 auto;
  }

  .review-filter-panel__quick {
    width: 100%;
    margin-left: 0;
    justify-content: flex-start;
  }

  .review-card {
    padding: 18px;
  }

  .review-feed {
    display: grid;
    grid-template-columns: 1fr;
    gap: 16px;
  }
}
</style>
