<template>
  <div class="salary-page p-4 space-y-4">
    <div v-if="isMobile" class="mobile-top-bar">
      <el-button text type="primary" @click="showMobileFilters = !showMobileFilters">
        {{ showMobileFilters ? '收起筛选' : '展开筛选' }}
      </el-button>
    </div>

    <el-form
      :model="queryForm"
      :inline="!isMobile"
      :label-width="isMobile ? 'auto' : '90px'"
      :label-position="isMobile ? 'top' : 'right'"
      class="query-form rounded-lg bg-[var(--el-bg-color-overlay)] p-4 shadow-sm"
      :class="{ 'query-form--mobile': isMobile }"
      v-show="!isMobile || showMobileFilters"
    >
      <el-form-item label="月份">
        <el-date-picker
          v-model="queryForm.month"
          type="month"
          value-format="YYYY-MM"
          placeholder="选择月份"
          clearable
          :style="{ width: isMobile ? '100%' : '180px' }"
          @change="handleQuery"
        />
      </el-form-item>
      <el-form-item label="关键词">
        <el-input
          v-model="queryForm.keyword"
          placeholder="姓名/工号"
          clearable
          :style="{ width: isMobile ? '100%' : '240px' }"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item class="query-form__actions">
        <div class="query-actions">
          <el-button @click="handleParams">参数</el-button>
          <el-button type="primary" @click="handleQuery">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
          <el-button type="success" @click="handleAdd">新增</el-button>
        </div>
      </el-form-item>
    </el-form>

    <template v-if="summaryTableRows.length">
      <div class="salary-table-wrapper">
        <el-table
          :data="summaryTableRows"
          border
          v-loading="loading"
          :height="isMobile ? undefined : 'calc(100vh - 320px)'"
        >
          <el-table-column type="index" label="序号" width="60" align="center" />
          <el-table-column prop="month" label="月份" width="110" />
          <el-table-column prop="employeeCount" label="人数" width="90" align="right" />
          <el-table-column prop="overtimePayTotal" label="加班费合计" width="120" align="right">
            <template #default="{ row }">{{
              formatMoneyWithThousands(row.overtimePayTotal)
            }}</template>
          </el-table-column>
          <el-table-column
            prop="doubleOvertimePayTotal"
            label="两倍加班费合计"
            width="140"
            align="right"
          >
            <template #default="{ row }">{{
              formatMoneyWithThousands(row.doubleOvertimePayTotal)
            }}</template>
          </el-table-column>
          <el-table-column
            prop="tripleOvertimePayTotal"
            label="三倍加班费合计"
            width="140"
            align="right"
          >
            <template #default="{ row }">{{
              formatMoneyWithThousands(row.tripleOvertimePayTotal)
            }}</template>
          </el-table-column>
          <el-table-column prop="currentSalaryTotal" label="本期工资合计" width="130" align="right">
            <template #default="{ row }">{{
              formatMoneyWithThousands(row.currentSalaryTotal)
            }}</template>
          </el-table-column>
          <el-table-column prop="firstPayTotal" label="第一次应发合计" width="130" align="right">
            <template #default="{ row }">{{
              formatMoneyWithThousands(row.firstPayTotal)
            }}</template>
          </el-table-column>
          <el-table-column prop="secondPayTotal" label="第二次应发合计" width="130" align="right">
            <template #default="{ row }">{{
              formatMoneyWithThousands(row.secondPayTotal)
            }}</template>
          </el-table-column>
        </el-table>
      </div>

      <div class="pagination-footer" :class="{ 'pagination-footer--mobile': isMobile }">
        <el-pagination
          background
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.size"
          :total="pagination.total"
          :page-sizes="[10, 20, 50, 100]"
          :layout="paginationLayout"
          :pager-count="paginationPagerCount"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </template>
    <el-empty
      v-else
      description="暂无工资汇总数据"
      class="rounded-lg bg-[var(--el-bg-color-overlay)] py-16"
      :image-size="180"
    />

    <el-dialog
      v-model="paramsDialogVisible"
      title="参数"
      :width="isMobile ? '100%' : '1260px'"
      :fullscreen="isMobile"
      :close-on-click-modal="false"
      class="params-dialog"
      @closed="resetParamsDialog"
    >
      <el-tabs v-model="paramsActiveTab" @tab-change="handleParamsTabChange">
        <el-tab-pane label="工资基数" name="salaryBase">
          <div class="params-tab-body" v-loading="salaryBaseLoading">
            <el-table v-if="salaryBaseRows.length" :data="salaryBaseRows" border height="560">
              <el-table-column type="index" label="序号" width="70" align="center" />
              <el-table-column prop="employeeName" label="姓名" width="120" show-overflow-tooltip />
              <el-table-column
                prop="employeeNumber"
                label="员工工号"
                width="100"
                show-overflow-tooltip
              />
              <el-table-column
                prop="department"
                label="所属部门"
                width="110"
                show-overflow-tooltip
              />
              <el-table-column
                label="工资基数"
                width="140"
                align="center"
                class-name="sb-col-input"
              >
                <template #default="{ row }">
                  <el-input-number
                    v-model="row.salaryBase"
                    @change="touchAdjustDate(row)"
                    :min="0"
                    :max="999999"
                    :precision="0"
                    :controls="false"
                    :value-on-clear="null"
                    placeholder="-"
                    size="small"
                    class="sb-number"
                  />
                </template>
              </el-table-column>
              <el-table-column
                label="基本养老保险费"
                width="140"
                align="center"
                class-name="sb-col-input"
              >
                <template #default="{ row }">
                  <el-input-number
                    v-model="row.pensionInsuranceFee"
                    @change="touchAdjustDate(row)"
                    :min="0"
                    :max="999999"
                    :precision="2"
                    :controls="false"
                    :value-on-clear="null"
                    placeholder="-"
                    size="small"
                    class="sb-number"
                  />
                </template>
              </el-table-column>
              <el-table-column
                label="基本医疗保险费"
                width="140"
                align="center"
                class-name="sb-col-input"
              >
                <template #default="{ row }">
                  <el-input-number
                    v-model="row.medicalInsuranceFee"
                    @change="touchAdjustDate(row)"
                    :min="0"
                    :max="999999"
                    :precision="2"
                    :controls="false"
                    :value-on-clear="null"
                    placeholder="-"
                    size="small"
                    class="sb-number"
                  />
                </template>
              </el-table-column>
              <el-table-column
                label="失业保险费"
                width="120"
                align="center"
                class-name="sb-col-input"
              >
                <template #default="{ row }">
                  <el-input-number
                    v-model="row.unemploymentInsuranceFee"
                    @change="touchAdjustDate(row)"
                    :min="0"
                    :max="999999"
                    :precision="2"
                    :controls="false"
                    :value-on-clear="null"
                    placeholder="-"
                    size="small"
                    class="sb-number"
                  />
                </template>
              </el-table-column>
              <el-table-column
                label="调整日期"
                width="140"
                align="center"
                class-name="sb-col-input"
              >
                <template #default="{ row }">
                  <el-date-picker
                    v-model="row.adjustDate"
                    type="date"
                    value-format="YYYY-MM-DD"
                    placeholder="-"
                    clearable
                    size="small"
                    style="width: 130px"
                  />
                </template>
              </el-table-column>
            </el-table>
            <el-empty v-else description="暂无人员" />
          </div>
        </el-tab-pane>

        <el-tab-pane label="加班费基数" name="level">
          <div class="params-tab-body" v-loading="levelLoading">
            <el-table v-if="levelRows.length" :data="levelRows" border height="560">
              <el-table-column prop="level" label="职级" width="80" align="center" />
              <el-table-column label="加班" width="140" align="center" class-name="lv-col-input">
                <template #default="{ row }">
                  <el-input-number
                    v-model="row.overtime"
                    @change="touchAdjustDate(row)"
                    :min="0"
                    :max="999999"
                    :precision="2"
                    :controls="false"
                    :value-on-clear="null"
                    placeholder="-"
                    size="small"
                    class="lv-number"
                  />
                </template>
              </el-table-column>
              <el-table-column
                label="两倍加班"
                width="140"
                align="center"
                class-name="lv-col-input"
              >
                <template #default="{ row }">
                  <el-input-number
                    v-model="row.doubleOvertime"
                    @change="touchAdjustDate(row)"
                    :min="0"
                    :max="999999"
                    :precision="2"
                    :controls="false"
                    :value-on-clear="null"
                    placeholder="-"
                    size="small"
                    class="lv-number"
                  />
                </template>
              </el-table-column>
              <el-table-column
                label="三倍加班"
                width="140"
                align="center"
                class-name="lv-col-input"
              >
                <template #default="{ row }">
                  <el-input-number
                    v-model="row.tripleOvertime"
                    @change="touchAdjustDate(row)"
                    :min="0"
                    :max="999999"
                    :precision="2"
                    :controls="false"
                    :value-on-clear="null"
                    placeholder="-"
                    size="small"
                    class="lv-number"
                  />
                </template>
              </el-table-column>
              <el-table-column
                label="调整日期"
                width="160"
                align="center"
                class-name="lv-col-input"
              >
                <template #default="{ row }">
                  <el-date-picker
                    v-model="row.adjustDate"
                    type="date"
                    value-format="YYYY-MM-DD"
                    placeholder="-"
                    clearable
                    size="small"
                    style="width: 140px"
                  />
                </template>
              </el-table-column>
            </el-table>
            <el-empty v-else description="暂无职级配置" />
          </div>
        </el-tab-pane>

        <el-tab-pane label="补助" name="subsidy">
          <div class="params-tab-body" v-loading="subsidyLoading">
            <el-table v-if="subsidyRows.length" :data="subsidyRows" border height="560">
              <el-table-column type="index" label="序号" width="70" align="center" />
              <el-table-column prop="name" label="补助" width="110" />
              <el-table-column label="金额" width="140" align="center" class-name="sub-col-input">
                <template #default="{ row }">
                  <el-input-number
                    v-model="row.amount"
                    @change="touchAdjustDate(row)"
                    :min="0"
                    :max="999999"
                    :precision="0"
                    :controls="false"
                    :value-on-clear="null"
                    placeholder="-"
                    size="small"
                    class="sub-number"
                  />
                </template>
              </el-table-column>
              <el-table-column
                label="调整日期"
                width="180"
                align="center"
                class-name="sub-col-input"
              >
                <template #default="{ row }">
                  <el-date-picker
                    v-model="row.adjustDate"
                    type="date"
                    value-format="YYYY-MM-DD"
                    placeholder="-"
                    clearable
                    size="small"
                    style="width: 160px"
                  />
                </template>
              </el-table-column>
            </el-table>
            <el-empty v-else description="暂无补助配置" />
          </div>
        </el-tab-pane>

        <el-tab-pane label="罚扣" name="penalty">
          <div class="params-tab-body" v-loading="penaltyLoading">
            <el-table v-if="penaltyRows.length" :data="penaltyRows" border height="560">
              <el-table-column type="index" label="序号" width="70" align="center" />
              <el-table-column prop="name" label="罚扣" width="110" />
              <el-table-column label="金额" width="140" align="center" class-name="sub-col-input">
                <template #default="{ row }">
                  <el-input-number
                    v-model="row.amount"
                    @change="touchAdjustDate(row)"
                    :min="0"
                    :max="999999"
                    :precision="0"
                    :controls="false"
                    :value-on-clear="null"
                    placeholder="-"
                    size="small"
                    class="sub-number"
                  />
                </template>
              </el-table-column>
              <el-table-column
                label="调整日期"
                width="180"
                align="center"
                class-name="sub-col-input"
              >
                <template #default="{ row }">
                  <el-date-picker
                    v-model="row.adjustDate"
                    type="date"
                    value-format="YYYY-MM-DD"
                    placeholder="-"
                    clearable
                    size="small"
                    style="width: 160px"
                  />
                </template>
              </el-table-column>
            </el-table>
            <el-empty v-else description="暂无罚扣配置" />
          </div>
        </el-tab-pane>
      </el-tabs>

      <template #footer>
        <el-button @click="paramsDialogVisible = false">关闭</el-button>
        <el-button type="primary" @click="handleParamsSave">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="rangeDialogVisible"
      title="选择工资计算范围"
      :width="isMobile ? '100%' : '560px'"
      :fullscreen="isMobile"
      :close-on-click-modal="false"
      class="salary-range-dialog"
    >
      <el-form :model="rangeForm" label-width="90px" class="salary-range-form">
        <el-form-item label="月份" required>
          <el-date-picker
            v-model="rangeForm.month"
            type="month"
            value-format="YYYY-MM"
            placeholder="选择月份"
            :disabled-date="isRangeMonthDisabled"
            :style="{ width: isMobile ? '100%' : '220px' }"
          />
        </el-form-item>
        <el-form-item label="员工范围" required>
          <el-radio-group v-model="rangeForm.applyToAll">
            <el-radio :value="true">全部在职员工</el-radio>
            <el-radio :value="false">指定员工</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="!rangeForm.applyToAll" label="选择员工" required>
          <el-select
            v-model="rangeForm.employeeIds"
            filterable
            multiple
            collapse-tags
            collapse-tags-tooltip
            placeholder="请选择员工"
            :loading="addEmployeesLoading"
            :style="{ width: isMobile ? '100%' : '420px' }"
          >
            <el-option
              v-for="emp in addEmployees"
              :key="emp.id"
              :label="`${emp.employeeName}（${emp.employeeNumber}）`"
              :value="emp.id"
            />
          </el-select>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="cancelRange">取消</el-button>
        <el-button type="primary" :loading="rangeSaving" @click="saveRange">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="addDialogVisible"
      title="新增工资"
      :width="isMobile ? '100%' : '1580px'"
      :style="isMobile ? {} : { maxWidth: 'calc(100vw - 48px)' }"
      :fullscreen="isMobile"
      :close-on-click-modal="false"
      class="salary-add-dialog"
      @closed="resetAddWizard"
    >
      <template #header>
        <div class="salary-add-header">
          <div class="salary-add-header__top">
            <div class="salary-add-header__title">新增工资</div>
            <div class="salary-add-header__meta">
              <div class="salary-add-header__meta-row">
                <el-tag size="small" type="info">{{ rangeForm.month || '-' }}</el-tag>
                <span class="salary-add-header__meta-text"
                  >人数：{{ formatCount(addRows.length) }}</span
                >
              </div>
              <div class="salary-add-header__meta-row salary-add-header__meta-row--sub">
                <span>本期工资合计：{{ formatMoneyWithThousands(addRowsTotal) }}</span>
              </div>
              <div
                class="salary-add-header__meta-row salary-add-header__meta-row--sub"
                :class="{
                  'salary-add-header__meta-row--sub-hidden': !(addStep === 1 || addStep === 2)
                }"
              >
                <span v-if="addStep === 1"
                  >第一批工资合计：{{ formatMoneyWithThousands(addRowsFirstPayTotal) }}</span
                >
                <span v-else
                  >第一次应发合计：{{ formatMoneyWithThousands(addRowsFirstPayTotal) }}</span
                >
              </div>
              <div
                class="salary-add-header__meta-row salary-add-header__meta-row--sub"
                :class="{
                  'salary-add-header__meta-row--sub-hidden': !(addStep === 1 || addStep === 2)
                }"
              >
                <span v-if="addStep === 1"
                  >第二批工资合计：{{ formatMoneyWithThousands(addRowsSecondPayTotal) }}</span
                >
                <span v-else
                  >第二次应发合计：{{ formatMoneyWithThousands(addRowsSecondPayTotal) }}</span
                >
              </div>
            </div>
          </div>

          <el-steps :active="addStep" align-center finish-status="success" class="salary-add-steps">
            <el-step title="步骤1" description="填写明细" />
            <el-step title="步骤2" description="拆分两次发放" />
            <el-step title="步骤3" description="个税社保申报" />
          </el-steps>
        </div>
      </template>

      <div class="salary-add-body" v-loading="addSaving">
        <div v-show="addStep === 0" class="salary-add-step">
          <div v-if="addRows.length" class="salary-add-table-wrap salary-add-table-wrap--step1">
            <el-table :data="addRows" border height="560" :fit="false" style="width: 1495px">
              <el-table-column type="index" label="序号" width="55" align="center" />
              <el-table-column prop="employeeName" label="姓名" width="85" show-overflow-tooltip />
              <el-table-column
                prop="employeeNumber"
                label="工号"
                width="55"
                show-overflow-tooltip
              />
              <el-table-column label="基本工资" width="85" align="right">
                <template #default="{ row }">
                  {{ formatMoney(row.baseSalary) }}
                </template>
              </el-table-column>
              <el-table-column label="加班费" width="80" align="right">
                <template #default="{ row }">{{ formatMoney(row.overtimePay) }}</template>
              </el-table-column>
              <el-table-column label="两倍加班费" width="100" align="right">
                <template #default="{ row }">{{ formatMoney(row.doubleOvertimePay) }}</template>
              </el-table-column>
              <el-table-column label="三倍加班费" width="100" align="right">
                <template #default="{ row }">{{ formatMoney(row.tripleOvertimePay) }}</template>
              </el-table-column>
              <el-table-column label="夜班补助" width="85" align="right">
                <template #default="{ row }">{{ formatMoney(row.nightShiftSubsidy) }}</template>
              </el-table-column>
              <el-table-column label="误餐补助" width="85" align="right">
                <template #default="{ row }">{{ formatMoney(row.mealSubsidy) }}</template>
              </el-table-column>
              <el-table-column label="全勤" width="65" align="right">
                <template #default="{ row }">{{ formatMoney(row.fullAttendanceBonus) }}</template>
              </el-table-column>
              <el-table-column label="工龄工资" width="85" align="right">
                <template #default="{ row }">
                  <el-tooltip :content="formatYmd(row.entryDate) || '-'" placement="top">
                    <span>{{ formatMoney(row.seniorityPay) }}</span>
                  </el-tooltip>
                </template>
              </el-table-column>
              <el-table-column label="迟到扣款" width="85" align="right">
                <template #default="{ row }">{{ formatMoney(row.lateDeduction) }}</template>
              </el-table-column>
              <el-table-column label="新进及事假" width="100" align="right">
                <template #default="{ row }">{{
                  formatMoney(row.newOrPersonalLeaveDeduction)
                }}</template>
              </el-table-column>
              <el-table-column label="病假" width="80" align="right">
                <template #default="{ row }">{{ formatMoney(row.sickLeaveDeduction) }}</template>
              </el-table-column>
              <el-table-column label="旷工扣款" width="85" align="right">
                <template #default="{ row }">{{ formatMoney(row.absenceDeduction) }}</template>
              </el-table-column>
              <el-table-column label="卫生费" width="75" align="right">
                <template #default="{ row }">{{ formatMoney(row.hygieneFee) }}</template>
              </el-table-column>
              <el-table-column label="水费" width="79" align="right">
                <template #default="{ row }">{{ formatMoney(row.waterFee) }}</template>
              </el-table-column>
              <el-table-column label="电费" width="79" align="right">
                <template #default="{ row }">{{ formatMoney(row.electricityFee) }}</template>
              </el-table-column>
              <el-table-column label="本期工资" width="85" align="right">
                <template #default="{ row }">{{ formatMoney(computeRowTotal(row)) }}</template>
              </el-table-column>
            </el-table>
          </div>
          <el-empty v-else description="暂无人员" />
        </div>

        <div v-show="addStep === 1" class="salary-add-step">
          <el-table v-if="addRows.length" :data="addRows" border height="560">
            <el-table-column type="index" label="序号" width="55" align="center" />
            <el-table-column prop="employeeName" label="姓名" width="85" show-overflow-tooltip />
            <el-table-column prop="employeeNumber" label="工号" width="55" show-overflow-tooltip />
            <el-table-column prop="total" label="本期工资" width="85" align="right">
              <template #default="{ row }">{{ formatMoney(computeRowTotal(row)) }}</template>
            </el-table-column>
            <el-table-column
              label="第一批工资"
              width="110"
              align="center"
              class-name="sa-col-input sa-col-input--center"
            >
              <template #default="{ row }">
                <el-input-number
                  v-model="row.firstPay"
                  :min="0"
                  :max="computeRowTotal(row) ?? 999999"
                  :precision="2"
                  :controls="false"
                  :value-on-clear="null"
                  placeholder="-"
                  size="small"
                  class="sa-number sa-number--narrow"
                  @update:model-value="(val) => handleFirstPayChange(row, val)"
                />
              </template>
            </el-table-column>
            <el-table-column label="基本养老保险费" width="130" align="right">
              <template #default="{ row }">{{ formatMoney(row.pensionInsuranceFee) }}</template>
            </el-table-column>
            <el-table-column label="基本医疗保险费" width="130" align="right">
              <template #default="{ row }">{{ formatMoney(row.medicalInsuranceFee) }}</template>
            </el-table-column>
            <el-table-column label="失业保险费" width="110" align="right">
              <template #default="{ row }">{{
                formatMoney(row.unemploymentInsuranceFee)
              }}</template>
            </el-table-column>
            <el-table-column label="第一次应发" width="110" align="right">
              <template #default="{ row }">{{ formatMoney(computeFirstActualPay(row)) }}</template>
            </el-table-column>
            <el-table-column label="第二批工资" width="100" align="right">
              <template #default="{ row }">
                {{ formatMoney(getRowPaySplit(row).second) }}
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-else description="暂无人员" />
        </div>

        <div v-show="addStep === 2" class="salary-add-step">
          <el-table v-if="addRows.length" :data="addRows" border height="560">
            <el-table-column type="index" label="序号" width="55" align="center" />
            <el-table-column prop="employeeName" label="姓名" width="85" show-overflow-tooltip />
            <el-table-column prop="employeeNumber" label="工号" width="55" show-overflow-tooltip />
            <el-table-column prop="total" label="本期工资" width="85" align="right">
              <template #default="{ row }">{{ formatMoney(computeRowTotal(row)) }}</template>
            </el-table-column>
            <el-table-column label="第二批工资" width="110" align="right">
              <template #default="{ row }">{{ formatMoney(getRowPaySplit(row).second) }}</template>
            </el-table-column>
            <el-table-column label="个税" width="85" align="right">
              <template #default="{ row }">{{ formatMoney(row.incomeTax) }}</template>
            </el-table-column>
            <el-table-column label="第二次应发" width="110" align="right">
              <template #default="{ row }">
                <span v-if="row.incomeTax === null || row.incomeTax === undefined">-</span>
                <span v-else>{{ formatMoney(computeSecondActualPay(row)) }}</span>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-else description="暂无人员" />
        </div>
      </div>

      <template #footer>
        <div class="salary-add-footer">
          <el-button @click="addDialogVisible = false">取消</el-button>
          <el-button v-if="addStep === 1" :loading="taxImporting" @click="handleTaxImport">
            个税申报文件
          </el-button>
          <el-button v-if="addStep === 2" :loading="taxLoading" @click="handleLoadTax">
            读取个税
          </el-button>
          <el-button v-if="addStep !== 0" type="primary" :loading="addSaving" @click="saveAddStep">
            保存
          </el-button>
          <el-button v-if="addStep > 0" @click="goPrevStep">上一步</el-button>
          <el-button
            v-if="addStep < 2"
            type="success"
            :disabled="addStep !== 0 && !addStepSaved[addStep]"
            @click="goNextStep"
          >
            下一步
          </el-button>
          <el-button
            v-else
            type="success"
            :disabled="!addStepSaved[2]"
            :loading="addCompleting"
            @click="completeAdd"
          >
            完成
          </el-button>
        </div>
        <input
          ref="taxFileInputRef"
          type="file"
          accept=".xls,.xlsx"
          style="display: none"
          @change="handleTaxFileChange"
        />
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useAppStore } from '@/store/modules/app'
import { getEmployeeListApi, type EmployeeInfo } from '@/api/employee'
import { exportSalaryTaxImportTemplateApi, readSalaryIncomeTaxApi } from '@/api/salary'
import {
  getAttendanceDetailApi,
  getAttendanceListApi,
  type AttendanceRecord
} from '@/api/attendance'
import {
  getOvertimeBaseParamsApi,
  getPenaltyParamsApi,
  getSalaryBaseParamsApi,
  getSubsidyParamsApi,
  savePenaltyParamsApi,
  saveOvertimeBaseParamsApi,
  saveSalaryBaseParamsApi,
  saveSubsidyParamsApi,
  type OvertimeBaseParamRow,
  type PenaltyParamRow,
  type SalaryBaseParamRow,
  type SubsidyParamRow
} from '@/api/salary-params'

type SalaryBaseRow = {
  employeeId: number
  employeeName: string
  employeeNumber: string
  department: string
  salaryBase: number | null
  pensionInsuranceFee: number | null
  medicalInsuranceFee: number | null
  unemploymentInsuranceFee: number | null
  adjustDate: string
}

type LevelRow = {
  level: number
  overtime: number | null
  doubleOvertime: number | null
  tripleOvertime: number | null
  adjustDate: string
}

type SubsidyRow = {
  name: string
  amount: number | null
  adjustDate: string
}

type PenaltyRow = {
  name: string
  amount: number | null
  adjustDate: string
}

type SalarySummaryRow = {
  id: string
  month: string // YYYY-MM
  employeeCount: number
  overtimePayTotal: number
  doubleOvertimePayTotal: number
  tripleOvertimePayTotal: number
  currentSalaryTotal: number
  firstPayTotal: number
  secondPayTotal: number
  createdAt: string
}

type SalaryDraftRow = {
  employeeId: number
  employeeName: string
  employeeNumber: string
  idCard: string
  entryDate: string
  baseSalary: number | null
  pensionInsuranceFee: number | null
  medicalInsuranceFee: number | null
  unemploymentInsuranceFee: number | null
  firstPay: number | null
  secondPay: number | null
  incomeTax: number | null
  overtimePay: number | null
  doubleOvertimePay: number | null
  tripleOvertimePay: number | null
  nightShiftSubsidy: number | null
  mealSubsidy: number | null
  fullAttendanceBonus: number | null
  seniorityPay: number | null
  lateDeduction: number | null
  newOrPersonalLeaveDeduction: number | null
  sickLeaveDeduction: number | null
  absenceDeduction: number | null
  hygieneFee: number | null
  waterFee: number | null
  electricityFee: number | null
  total: number | null
  remark: string
}

const appStore = useAppStore()
const isMobile = computed(() => appStore.getMobile)
const showMobileFilters = ref(false)

const queryForm = reactive({
  month: '',
  keyword: ''
})

const loading = ref(false)
const tableData = ref<SalarySummaryRow[]>([])
const pagination = reactive({ page: 1, size: 10, total: 0 })

const paginationLayout = computed(() =>
  isMobile.value ? 'prev, pager, next' : 'total, sizes, prev, pager, next, jumper'
)
const paginationPagerCount = computed(() => (isMobile.value ? 5 : 7))

const summaryTableRows = computed(() => {
  const month = String(queryForm.month || '').trim()
  const keyword = String(queryForm.keyword || '').trim()
  let rows = tableData.value

  if (month) rows = rows.filter((r) => r.month === month)
  if (keyword) rows = rows.filter((r) => r.month.includes(keyword))

  pagination.total = rows.length
  const start = (pagination.page - 1) * pagination.size
  const end = start + pagination.size
  return rows.slice(start, end)
})

const salaryBaseLoading = ref(false)
const salaryBaseRows = ref<SalaryBaseRow[]>([])

const levelLoading = ref(false)
const levelRows = ref<LevelRow[]>([])

const subsidyLoading = ref(false)
const subsidyRows = ref<SubsidyRow[]>([])

const penaltyLoading = ref(false)
const penaltyRows = ref<PenaltyRow[]>([])

const paramsDialogVisible = ref(false)
const paramsActiveTab = ref<'salaryBase' | 'level' | 'subsidy' | 'penalty'>('salaryBase')

const resetParamsDialog = () => {
  salaryBaseLoading.value = false
  levelLoading.value = false
  subsidyLoading.value = false
  penaltyLoading.value = false
  salaryBaseRows.value = []
  levelRows.value = []
  subsidyRows.value = []
  penaltyRows.value = []
  paramsActiveTab.value = 'salaryBase'
}

const rangeDialogVisible = ref(false)
const rangeSaving = ref(false)
const rangeForm = reactive({
  month: '',
  applyToAll: true,
  employeeIds: [] as number[]
})

const addDialogVisible = ref(false)
const addStep = ref(0)
const addSaving = ref(false)
const addCompleting = ref(false)
const addStepSaved = reactive([false, false, false])
const taxImporting = ref(false)
const taxLoading = ref(false)

const addEmployeesLoading = ref(false)
const addEmployees = ref<EmployeeInfo[]>([])
const addRows = ref<SalaryDraftRow[]>([])

const formatMoney = (val?: number | null) => {
  if (val === null || val === undefined) return '-'
  const num = Number(val)
  if (Number.isNaN(num)) return '-'
  return num.toFixed(2)
}

const formatMoneyWithThousands = (val?: number | null) => {
  if (val === null || val === undefined) return '-'
  const num = Number(val)
  if (Number.isNaN(num)) return '-'
  return num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const formatCount = (val: unknown) => {
  const num = Number(val)
  if (!Number.isFinite(num)) return '-'
  return Math.trunc(num).toLocaleString('zh-CN')
}

const formatMonth = (date: Date) => {
  const y = date.getFullYear()
  const m = `${date.getMonth() + 1}`.padStart(2, '0')
  return `${y}-${m}`
}

const formatYmd = (val: unknown) => {
  const text = String(val ?? '').trim()
  if (!text) return ''
  if (text.includes('T')) return text.split('T')[0]
  if (text.includes(' ')) return text.split(' ')[0]
  return text
}

const getTodayYmd = () => {
  const now = new Date()
  const y = now.getFullYear()
  const m = `${now.getMonth() + 1}`.padStart(2, '0')
  const d = `${now.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${d}`
}

const touchAdjustDate = (row: { adjustDate: string }) => {
  row.adjustDate = getTodayYmd()
}

const toNumberOrNull = (val: unknown) => {
  if (val === null || val === undefined || val === '') return null
  const num = Number(val)
  return Number.isNaN(num) ? null : num
}

const sumMoney = <T,>(list: T[], getVal: (row: T) => unknown) => {
  const total = list.reduce((acc, row) => acc + (toNumberOrNull(getVal(row)) ?? 0), 0)
  if (Number.isNaN(total)) return 0
  return Math.round(total * 100) / 100
}

const multiplyMoneyOrNull = (left: unknown, right: unknown) => {
  const l = toNumberOrNull(left)
  const r = toNumberOrNull(right)
  if (l === null || r === null) return null
  const result = l * r
  if (Number.isNaN(result)) return null
  return Math.round(result * 100) / 100
}

const toNegativeMoneyOrNull = (val: unknown) => {
  const num = toNumberOrNull(val)
  if (num === null) return null
  const rounded = Math.round(num * 100) / 100
  return rounded === 0 ? 0 : -Math.abs(rounded)
}

const negateMoneyOrNull = (val: number | null) => {
  if (val === null) return null
  return val === 0 ? 0 : -Math.abs(val)
}

const computeHourlyRateFromSalaryBase = (salaryBase: unknown) => {
  const base = toNumberOrNull(salaryBase)
  if (base === null) return null
  const rate = base / 26 / 8
  if (Number.isNaN(rate)) return null
  return rate
}

const computeSickLeaveHourlyRateFromSalaryBase = (salaryBase: unknown) => {
  const base = toNumberOrNull(salaryBase)
  if (base === null) return null
  const adjusted = Math.max(0, base - 2600)
  const rate = adjusted / 26 / 8
  if (Number.isNaN(rate)) return null
  return rate
}

const isAttendanceFullAttendance = (val: unknown) => {
  const num = toNumberOrNull(val)
  if (num === null) return false
  return num !== 0
}

const parseYmdToLocalDate = (val: string) => {
  const ymd = formatYmd(val)
  const match = /(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(String(ymd || '').trim())
  if (!match) return null
  const y = Number(match[1])
  const m = Number(match[2])
  const d = Number(match[3])
  if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return null
  return new Date(y, m - 1, d)
}

const getMonthEndDate = (month: string) => {
  const match = /^(\d{4})-(\d{2})$/.exec(String(month || '').trim())
  if (!match) return null
  const y = Number(match[1])
  const m = Number(match[2])
  if (Number.isNaN(y) || Number.isNaN(m)) return null
  return new Date(y, m, 0)
}

const computeSeniorityYearsByMonth = (entryDate: string, month: string) => {
  const entry = parseYmdToLocalDate(entryDate)
  const asOf = getMonthEndDate(month)
  if (!entry || !asOf) return 0
  if (asOf < entry) return 0

  let years = asOf.getFullYear() - entry.getFullYear()
  const anniversaryMonth = entry.getMonth()
  const anniversaryDay = entry.getDate()
  if (
    asOf.getMonth() < anniversaryMonth ||
    (asOf.getMonth() === anniversaryMonth && asOf.getDate() < anniversaryDay)
  ) {
    years -= 1
  }
  if (years < 1) return 0
  return Math.min(years, 10)
}

const isSameMonth = (a: Date, b: Date) => {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
}

const getAllowedRangeMonths = () => {
  const now = new Date()
  const current = new Date(now.getFullYear(), now.getMonth(), 1)
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  return { current, prev }
}

const isRangeMonthDisabled = (date: Date) => {
  const { current, prev } = getAllowedRangeMonths()
  return !(isSameMonth(date, current) || isSameMonth(date, prev))
}

const isAllowedRangeMonthString = (month: string) => {
  const match = /^(\d{4})-(\d{2})$/.exec(String(month || '').trim())
  if (!match) return false
  const y = Number(match[1])
  const m = Number(match[2]) - 1
  if (Number.isNaN(y) || Number.isNaN(m)) return false
  const selected = new Date(y, m, 1)
  const { current, prev } = getAllowedRangeMonths()
  return isSameMonth(selected, current) || isSameMonth(selected, prev)
}

const computeRowTotal = (
  row: Pick<
    SalaryDraftRow,
    | 'baseSalary'
    | 'overtimePay'
    | 'doubleOvertimePay'
    | 'tripleOvertimePay'
    | 'nightShiftSubsidy'
    | 'mealSubsidy'
    | 'fullAttendanceBonus'
    | 'seniorityPay'
    | 'lateDeduction'
    | 'newOrPersonalLeaveDeduction'
    | 'sickLeaveDeduction'
    | 'absenceDeduction'
    | 'hygieneFee'
    | 'waterFee'
    | 'electricityFee'
  >
) => {
  const positive =
    Number(row.baseSalary || 0) +
    Number(row.overtimePay || 0) +
    Number(row.doubleOvertimePay || 0) +
    Number(row.tripleOvertimePay || 0) +
    Number(row.nightShiftSubsidy || 0) +
    Number(row.mealSubsidy || 0) +
    Number(row.fullAttendanceBonus || 0) +
    Number(row.seniorityPay || 0)

  const negative =
    Number(row.lateDeduction || 0) +
    Number(row.newOrPersonalLeaveDeduction || 0) +
    Number(row.sickLeaveDeduction || 0) +
    Number(row.absenceDeduction || 0) +
    Number(row.hygieneFee || 0) +
    Number(row.waterFee || 0) +
    Number(row.electricityFee || 0)

  const total = positive + negative
  if (Number.isNaN(total)) return null
  return Math.round(total * 100) / 100
}

const DEFAULT_PAY_SPLIT_LIMIT = 4300
const paySplitLimit = ref<number>(DEFAULT_PAY_SPLIT_LIMIT)

const computePaySplit = (total: number | null, limit = paySplitLimit.value) => {
  if (total === null || total === undefined) return { first: null as number | null, second: null }

  const totalCents = Math.round(Number(total) * 100)
  const limitCents = Math.round(Number(limit) * 100)
  if (Number.isNaN(totalCents) || Number.isNaN(limitCents)) {
    return { first: null as number | null, second: null }
  }

  if (totalCents <= limitCents) {
    return { first: total, second: 0 }
  }

  const diffCents = totalCents - limitCents
  const stepCents = 10000 // 100 元
  const secondCents = Math.ceil(diffCents / stepCents) * stepCents
  const safeSecondCents = Math.min(Math.max(secondCents, 0), totalCents)
  const firstCents = totalCents - safeSecondCents

  return {
    first: Math.round(firstCents) / 100,
    second: Math.round(safeSecondCents) / 100
  }
}

const roundMoney2 = (val: unknown) => {
  const num = toNumberOrNull(val)
  if (num === null) return null
  return Math.round(num * 100) / 100
}

const getRowPaySplit = (row: Pick<SalaryDraftRow, 'firstPay' | 'secondPay'> & SalaryDraftRow) => {
  const total = computeRowTotal(row)
  const fallback = computePaySplit(total)
  if (total === null) return { first: fallback.first, second: fallback.second }

  const first = row.firstPay ?? fallback.first
  const second =
    row.secondPay ??
    (first === null || first === undefined ? fallback.second : roundMoney2(total - first))

  return {
    first: first ?? null,
    second: second ?? null
  }
}

const handleFirstPayChange = (row: SalaryDraftRow, val: number | null | undefined) => {
  const total = computeRowTotal(row)
  if (val === null || val === undefined || Number.isNaN(Number(val))) {
    row.firstPay = null
    row.secondPay = null
    return
  }
  if (total === null) {
    row.firstPay = roundMoney2(val)
    row.secondPay = null
    return
  }

  const desired = Math.max(0, Math.min(Number(val), Number(total)))
  const first = roundMoney2(desired) ?? 0
  const second = roundMoney2(Number(total) - first) ?? 0

  row.firstPay = first
  row.secondPay = Math.max(0, second)
}

const computeFirstActualPay = (row: SalaryDraftRow) => {
  const split = getRowPaySplit(row)
  const first = toNumberOrNull(split.first) ?? 0
  const pension = toNumberOrNull(row.pensionInsuranceFee) ?? 0
  const medical = toNumberOrNull(row.medicalInsuranceFee) ?? 0
  const unemployment = toNumberOrNull(row.unemploymentInsuranceFee) ?? 0
  const actual = first + pension + medical + unemployment
  return Math.max(0, Math.round(actual * 100) / 100)
}

const computeSecondActualPay = (row: SalaryDraftRow) => {
  const split = getRowPaySplit(row)
  const second = toNumberOrNull(split.second) ?? 0
  const incomeTax = toNumberOrNull(row.incomeTax) ?? 0
  const actual = second - incomeTax
  return Math.max(0, Math.round(actual * 100) / 100)
}

const addRowsTotal = computed(() => {
  return addRows.value.reduce((acc, row) => acc + (computeRowTotal(row) || 0), 0)
})

const addRowsFirstPayTotal = computed(() => {
  return addRows.value.reduce((acc, row) => {
    const split = getRowPaySplit(row)
    return acc + (split.first || 0)
  }, 0)
})

const addRowsSecondPayTotal = computed(() => {
  return addRows.value.reduce((acc, row) => {
    const split = getRowPaySplit(row)
    return acc + (split.second || 0)
  }, 0)
})

const loadList = async () => {
  loading.value = true
  try {
    // 汇总列表暂不从数据库加载（前端内存数据）
  } finally {
    loading.value = false
  }
}

const handleQuery = () => {
  pagination.page = 1
  void loadList()
}

const handleReset = () => {
  queryForm.month = ''
  queryForm.keyword = ''
  handleQuery()
}

const handleSizeChange = (size: number) => {
  pagination.size = size
  pagination.page = 1
  void loadList()
}

const handleCurrentChange = (page: number) => {
  pagination.page = page
  void loadList()
}

const handleTaxImport = () => {
  void (async () => {
    if (addStep.value !== 1) return
    if (!addRows.value.length) {
      ElMessage.warning('暂无数据可导出')
      return
    }

    const missingIdCard = addRows.value.filter((r) => !String(r.idCard || '').trim())
    if (missingIdCard.length) {
      ElMessage.warning(
        `存在未填写身份证号码的员工：${missingIdCard.map((r) => r.employeeName).join('、')}`
      )
      return
    }

    taxImporting.value = true
    try {
      const exportRows = addRows.value.map((row) => {
        const split = getRowPaySplit(row)
        return {
          employeeName: row.employeeName,
          idCard: String(row.idCard || '').trim(),
          firstPay: Number(split.first ?? 0),
          pensionInsuranceFee: Number(row.pensionInsuranceFee ?? 0),
          medicalInsuranceFee: Number(row.medicalInsuranceFee ?? 0),
          unemploymentInsuranceFee: Number(row.unemploymentInsuranceFee ?? 0)
        }
      })

      const resp = await exportSalaryTaxImportTemplateApi({
        month: rangeForm.month,
        rows: exportRows
      })
      const blob = (resp as any)?.data ?? resp
      const url = window.URL.createObjectURL(blob as Blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `个税申报文件_${rangeForm.month || '模板'}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('个税申报文件导出失败:', error)
      ElMessage.error('个税申报文件导出失败')
    } finally {
      taxImporting.value = false
    }
  })()
}

const handleLoadTax = () => {
  if (taxLoading.value) return
  if (!addRows.value.length) {
    ElMessage.warning('暂无人员')
    return
  }
  taxFileInputRef.value?.click()
}

const taxFileInputRef = ref<HTMLInputElement | null>(null)
const normalizeName = (val: unknown) => String(val ?? '').trim()
const normalizeIdCard = (val: unknown) => String(val ?? '').trim()

const parseTaxItems = (resp: any) => {
  const payload = resp?.data ?? resp
  if (payload?.code && payload.code !== 0) throw new Error(payload?.message || '读取个税失败')
  const list = payload?.data ?? payload ?? []
  return Array.isArray(list) ? list : []
}

const handleTaxFileChange = (event: Event) => {
  void (async () => {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return

    taxLoading.value = true
    try {
      const resp: any = await readSalaryIncomeTaxApi(file)
      const list: Array<{ employeeName?: string; idCard?: string; incomeTax?: number | null }> =
        parseTaxItems(resp)

      const taxByIdCard = new Map<string, { employeeName: string; incomeTax: number | null }>()
      for (const item of list) {
        const idCard = normalizeIdCard(item?.idCard)
        const employeeName = normalizeName(item?.employeeName)
        if (!idCard || !employeeName) continue
        taxByIdCard.set(idCard, { employeeName, incomeTax: item?.incomeTax ?? null })
      }

      let matched = 0
      const nameMismatch: string[] = []
      const notFound: string[] = []

      for (const row of addRows.value) {
        const idCard = normalizeIdCard(row.idCard)
        const employeeName = normalizeName(row.employeeName)
        if (!idCard || !employeeName) continue

        const item = taxByIdCard.get(idCard)
        if (!item) {
          notFound.push(`${employeeName}(${idCard.slice(-4)})`)
          continue
        }
        if (normalizeName(item.employeeName) !== employeeName) {
          nameMismatch.push(`${employeeName}(${idCard.slice(-4)})`)
          continue
        }

        row.incomeTax = item.incomeTax ?? null
        matched += 1
      }

      if (matched === 0) {
        ElMessage.warning('未匹配到任何个税数据，请检查模板与人员身份证/姓名')
        return
      }

      const parts = [`匹配成功 ${matched} 人`]
      if (notFound.length) parts.push(`未找到 ${notFound.length} 人`)
      if (nameMismatch.length) parts.push(`姓名不一致 ${nameMismatch.length} 人`)
      ElMessage.success(`读取个税成功：${parts.join('，')}`)
    } catch (error: any) {
      console.error('读取个税失败:', error)
      ElMessage.error(error?.message || '读取个税失败')
    } finally {
      taxLoading.value = false
    }
  })()
}

const loadActiveEmployees = async () => {
  const response: any = await getEmployeeListApi({
    status: '在职',
    page: 1,
    pageSize: 500
  })

  let list: EmployeeInfo[] = []
  if (response?.code === 0 && response?.data) {
    list = response.data.list || []
  } else {
    list = response?.list || response?.data?.list || response?.data || []
  }
  return list
}

const ensureSalaryBaseLoaded = async () => {
  if (salaryBaseRows.value.length) return
  salaryBaseLoading.value = true
  try {
    const employees = await loadActiveEmployees()
    const paramsResp: any = await getSalaryBaseParamsApi()
    const paramsList: SalaryBaseParamRow[] = paramsResp?.data || paramsResp || []
    const paramsByEmployeeId = new Map<number, SalaryBaseParamRow>()
    for (const item of paramsList) paramsByEmployeeId.set(item.employeeId, item)

    salaryBaseRows.value = employees.map((emp) => {
      const param = paramsByEmployeeId.get(emp.id)
      return {
        employeeId: emp.id,
        employeeName: emp.employeeName,
        employeeNumber: String(emp.employeeNumber ?? ''),
        department: emp.department || '',
        salaryBase: param?.salaryBase ?? null,
        pensionInsuranceFee: param?.pensionInsuranceFee ?? null,
        medicalInsuranceFee: param?.medicalInsuranceFee ?? null,
        unemploymentInsuranceFee: param?.unemploymentInsuranceFee ?? null,
        adjustDate: (param?.adjustDate as any) || ''
      }
    })
  } catch (error) {
    console.error('加载员工列表失败:', error)
    ElMessage.error('加载员工列表失败')
    salaryBaseRows.value = []
  } finally {
    salaryBaseLoading.value = false
  }
}

const ensureLevelLoaded = () => {
  if (levelRows.value.length) return
  void (async () => {
    levelLoading.value = true
    try {
      const paramsResp: any = await getOvertimeBaseParamsApi()
      const paramsList: OvertimeBaseParamRow[] = paramsResp?.data || paramsResp || []
      const paramsByLevel = new Map<number, OvertimeBaseParamRow>()
      for (const item of paramsList) paramsByLevel.set(item.level, item)

      levelRows.value = Array.from({ length: 10 }, (_, idx) => {
        const level = idx + 1
        const param = paramsByLevel.get(level)
        return {
          level,
          overtime: param?.overtime ?? null,
          doubleOvertime: param?.doubleOvertime ?? null,
          tripleOvertime: param?.tripleOvertime ?? null,
          adjustDate: (param?.adjustDate as any) || ''
        }
      })
    } catch (error) {
      console.error('加载加班费基数失败:', error)
      ElMessage.error('加载加班费基数失败')
      levelRows.value = []
    } finally {
      levelLoading.value = false
    }
  })()
}

const ensureSubsidyLoaded = () => {
  if (subsidyRows.value.length) return
  void (async () => {
    subsidyLoading.value = true
    try {
      const resp: any = await getSubsidyParamsApi()
      const list: SubsidyParamRow[] = resp?.data || resp || []
      const required = ['夜班补助', '误餐补助', '全勤补助', '工龄补助', '拆分基数']
      const map = new Map<string, SubsidyParamRow>()
      for (const item of list) map.set(String(item?.name || '').trim(), item)

      const rows: SubsidyRow[] = required.map((name) => {
        const item = map.get(name)
        return {
          name,
          amount: item?.amount ?? null,
          adjustDate: (item?.adjustDate as any) || ''
        }
      })

      const extras = list
        .map((item) => String(item?.name || '').trim())
        .filter((name) => name && !required.includes(name))

      for (const name of extras) {
        const item = map.get(name)
        rows.push({
          name,
          amount: item?.amount ?? null,
          adjustDate: (item?.adjustDate as any) || ''
        })
      }

      subsidyRows.value = rows
    } catch (error) {
      console.error('加载补助参数失败:', error)
      ElMessage.error('加载补助参数失败')
      subsidyRows.value = []
    } finally {
      subsidyLoading.value = false
    }
  })()
}

const ensurePenaltyLoaded = () => {
  if (penaltyRows.value.length) return
  void (async () => {
    penaltyLoading.value = true
    try {
      const resp: any = await getPenaltyParamsApi()
      const list: PenaltyParamRow[] = resp?.data || resp || []
      const required = ['迟到扣款']

      const map = new Map<string, PenaltyParamRow>()
      for (const item of list) map.set(String(item?.name || '').trim(), item)

      const rows: PenaltyRow[] = required.map((name) => {
        const item = map.get(name)
        return {
          name,
          amount: item?.amount ?? null,
          adjustDate: (item?.adjustDate as any) || ''
        }
      })

      penaltyRows.value = rows
    } catch (error) {
      console.error('加载罚扣参数失败:', error)
      ElMessage.error('加载罚扣参数失败')
      penaltyRows.value = []
    } finally {
      penaltyLoading.value = false
    }
  })()
}

const ensureParamsTabLoaded = async (tab: 'salaryBase' | 'level' | 'subsidy' | 'penalty') => {
  if (tab === 'salaryBase') {
    await ensureSalaryBaseLoaded()
    return
  }
  if (tab === 'level') {
    ensureLevelLoaded()
    return
  }
  if (tab === 'subsidy') {
    ensureSubsidyLoaded()
    return
  }
  if (tab === 'penalty') {
    ensurePenaltyLoaded()
  }
}

const handleParams = () => {
  paramsDialogVisible.value = true
  void ensureParamsTabLoaded(paramsActiveTab.value)
}

const handleParamsTabChange = (tabName: string | number) => {
  if (
    tabName === 'salaryBase' ||
    tabName === 'level' ||
    tabName === 'subsidy' ||
    tabName === 'penalty'
  ) {
    void ensureParamsTabLoaded(tabName)
  }
}

const handleParamsSave = () => {
  void (async () => {
    try {
      if (paramsActiveTab.value === 'salaryBase') {
        const rows: SalaryBaseParamRow[] = salaryBaseRows.value.map((r) => ({
          employeeId: r.employeeId,
          salaryBase: r.salaryBase ?? null,
          pensionInsuranceFee: r.pensionInsuranceFee ?? null,
          medicalInsuranceFee: r.medicalInsuranceFee ?? null,
          unemploymentInsuranceFee: r.unemploymentInsuranceFee ?? null,
          adjustDate: r.adjustDate || null
        }))
        const resp: any = await saveSalaryBaseParamsApi(rows)
        if (resp?.code !== 0) throw new Error(resp?.message || '保存失败')
        ElMessage.success('工资基数已保存')
        salaryBaseRows.value = []
        await ensureSalaryBaseLoaded()
        return
      }

      if (paramsActiveTab.value === 'level') {
        const rows: OvertimeBaseParamRow[] = levelRows.value.map((r) => ({
          level: r.level,
          overtime: r.overtime ?? null,
          doubleOvertime: r.doubleOvertime ?? null,
          tripleOvertime: r.tripleOvertime ?? null,
          adjustDate: r.adjustDate || null
        }))
        const resp: any = await saveOvertimeBaseParamsApi(rows)
        if (resp?.code !== 0) throw new Error(resp?.message || '保存失败')
        ElMessage.success('加班费基数已保存')
        levelRows.value = []
        ensureLevelLoaded()
        return
      }

      if (paramsActiveTab.value === 'subsidy') {
        const rows: SubsidyParamRow[] = subsidyRows.value.map((r) => ({
          name: r.name,
          unit: '按次',
          amount: r.amount ?? null,
          adjustDate: r.adjustDate || null
        }))
        const resp: any = await saveSubsidyParamsApi(rows)
        if (resp?.code !== 0) throw new Error(resp?.message || '保存失败')
        ElMessage.success('补助已保存')
        subsidyRows.value = []
        ensureSubsidyLoaded()
        return
      }

      if (paramsActiveTab.value === 'penalty') {
        const rows: PenaltyParamRow[] = penaltyRows.value.map((r) => ({
          name: r.name,
          unit: '按次',
          amount: r.amount ?? null,
          adjustDate: r.adjustDate || null
        }))
        const resp: any = await savePenaltyParamsApi(rows)
        if (resp?.code !== 0) throw new Error(resp?.message || '保存失败')
        ElMessage.success('罚扣已保存')
        penaltyRows.value = []
        ensurePenaltyLoaded()
      }
    } catch (error: any) {
      console.error('保存参数失败:', error)
      ElMessage.error(error?.message || '保存失败')
    }
  })()
}

const resetAddWizard = () => {
  addStep.value = 0
  addSaving.value = false
  addCompleting.value = false
  addStepSaved[0] = false
  addStepSaved[1] = false
  addStepSaved[2] = false
  addRows.value = []
}

const loadAddEmployees = async () => {
  addEmployeesLoading.value = true
  try {
    addEmployees.value = await loadActiveEmployees()
  } catch (error) {
    console.error('加载员工列表失败:', error)
    ElMessage.error('加载员工列表失败')
    addEmployees.value = []
  } finally {
    addEmployeesLoading.value = false
  }
}

const handleAdd = async () => {
  resetAddWizard()
  await loadAddEmployees()
  resetRangeDialog()
  rangeDialogVisible.value = true
}

const getStep1EmployeeIds = () => {
  if (rangeForm.applyToAll) return addEmployees.value.map((emp) => emp.id)
  return rangeForm.employeeIds
}

const buildDraftRowsFromEmployees = (employeeIds: number[]): SalaryDraftRow[] => {
  const selectedEmployees = addEmployees.value.filter((emp) => employeeIds.includes(emp.id))
  return selectedEmployees.map(
    (emp) =>
      ({
        employeeId: emp.id,
        employeeName: emp.employeeName,
        employeeNumber: String(emp.employeeNumber ?? ''),
        idCard: emp.idCard || '',
        entryDate: String(emp.entryDate || ''),
        baseSalary: salaryBaseByEmployeeId.value.get(emp.id) ?? null,
        pensionInsuranceFee:
          toNegativeMoneyOrNull(insuranceFeesByEmployeeId.value.get(emp.id)?.pensionInsuranceFee) ??
          null,
        medicalInsuranceFee:
          toNegativeMoneyOrNull(insuranceFeesByEmployeeId.value.get(emp.id)?.medicalInsuranceFee) ??
          null,
        unemploymentInsuranceFee:
          toNegativeMoneyOrNull(
            insuranceFeesByEmployeeId.value.get(emp.id)?.unemploymentInsuranceFee
          ) ?? null,
        firstPay: null,
        secondPay: null,
        incomeTax: null,
        overtimePay: null,
        doubleOvertimePay: null,
        tripleOvertimePay: null,
        nightShiftSubsidy: null,
        mealSubsidy: null,
        fullAttendanceBonus: null,
        seniorityPay: null,
        lateDeduction: null,
        newOrPersonalLeaveDeduction: null,
        sickLeaveDeduction: null,
        absenceDeduction: null,
        hygieneFee: null,
        waterFee: null,
        electricityFee: null,
        total: null,
        remark: ''
      }) satisfies SalaryDraftRow
  )
}

const salaryBaseByEmployeeId = ref(new Map<number, number | null>())
const insuranceFeesByEmployeeId = ref(
  new Map<
    number,
    {
      pensionInsuranceFee: number | null
      medicalInsuranceFee: number | null
      unemploymentInsuranceFee: number | null
    }
  >()
)

const refreshSalaryBaseParams = async () => {
  const paramsResp: any = await getSalaryBaseParamsApi()
  const paramsList: SalaryBaseParamRow[] = paramsResp?.data || paramsResp || []
  const map = new Map<number, number | null>()
  const feeMap = new Map<
    number,
    {
      pensionInsuranceFee: number | null
      medicalInsuranceFee: number | null
      unemploymentInsuranceFee: number | null
    }
  >()
  for (const item of paramsList) {
    map.set(item.employeeId, item.salaryBase ?? null)
    feeMap.set(item.employeeId, {
      pensionInsuranceFee: item.pensionInsuranceFee ?? null,
      medicalInsuranceFee: item.medicalInsuranceFee ?? null,
      unemploymentInsuranceFee: item.unemploymentInsuranceFee ?? null
    })
  }
  salaryBaseByEmployeeId.value = map
  insuranceFeesByEmployeeId.value = feeMap
}

const loadOvertimeBaseByLevel = async () => {
  const paramsResp: any = await getOvertimeBaseParamsApi()
  const paramsList: OvertimeBaseParamRow[] = paramsResp?.data || paramsResp || []
  const map = new Map<number, OvertimeBaseParamRow>()
  for (const item of paramsList) map.set(item.level, item)
  return map
}

const loadSubsidyAmountByName = async (name: string) => {
  const paramsResp: any = await getSubsidyParamsApi()
  const paramsList: SubsidyParamRow[] = paramsResp?.data || paramsResp || []
  const matched = paramsList.find((item) => String(item?.name || '').trim() === name)
  return matched?.amount ?? null
}

const loadPenaltyAmountByName = async (name: string) => {
  const paramsResp: any = await getPenaltyParamsApi()
  const paramsList: PenaltyParamRow[] = paramsResp?.data || paramsResp || []
  const matched = paramsList.find((item) => String(item?.name || '').trim() === name)
  return matched?.amount ?? null
}

const loadAttendanceRecordsByMonth = async (month: string) => {
  const resp: any = await getAttendanceListApi({ month, page: 1, pageSize: 1 })
  let list: any[] = []
  if (resp?.code === 0 && resp?.data) {
    list = resp.data.list || []
  } else {
    list = resp?.list || resp?.data?.list || resp?.data || []
  }
  const summary = list?.[0]
  const attendanceId = toNumberOrNull(summary?.id)
  if (!attendanceId) return []

  const detailResp: any = await getAttendanceDetailApi(attendanceId)
  const detail = detailResp?.data || detailResp || {}
  const records: AttendanceRecord[] = detail.records || []
  return Array.isArray(records) ? records : []
}

const applyAttendanceOvertimeToDraftRows = async (month: string, rows: SalaryDraftRow[]) => {
  const [
    attendanceRecords,
    overtimeBaseByLevel,
    nightShiftSubsidyAmount,
    mealSubsidyAmount,
    fullAttendanceSubsidyAmount,
    senioritySubsidyAmount,
    splitBaseAmount,
    latePenaltyAmount
  ] = await Promise.all([
    loadAttendanceRecordsByMonth(month),
    loadOvertimeBaseByLevel(),
    loadSubsidyAmountByName('夜班补助'),
    loadSubsidyAmountByName('误餐补助'),
    loadSubsidyAmountByName('全勤补助'),
    loadSubsidyAmountByName('工龄补助'),
    loadSubsidyAmountByName('拆分基数'),
    loadPenaltyAmountByName('迟到扣款')
  ])

  paySplitLimit.value =
    typeof splitBaseAmount === 'number' && !Number.isNaN(splitBaseAmount) && splitBaseAmount > 0
      ? splitBaseAmount
      : DEFAULT_PAY_SPLIT_LIMIT

  const attByEmployeeId = new Map<number, AttendanceRecord>()
  for (const rec of attendanceRecords) attByEmployeeId.set(rec.employeeId, rec)

  return rows.map((row) => {
    const entryDate = String(row.entryDate || '').trim()
    const seniorityYears = entryDate ? computeSeniorityYearsByMonth(entryDate, month) : 0
    const seniorityPay = multiplyMoneyOrNull(seniorityYears, senioritySubsidyAmount)

    const att = attByEmployeeId.get(row.employeeId)
    if (!att) return { ...row, seniorityPay }

    const level = toNumberOrNull(att.level)
    const base = level ? overtimeBaseByLevel.get(level) : undefined
    const hourlyRate = computeHourlyRateFromSalaryBase(row.baseSalary)
    const sickHourlyRate = computeSickLeaveHourlyRateFromSalaryBase(row.baseSalary)

    return {
      ...row,
      overtimePay: multiplyMoneyOrNull(att.overtimeHours, base?.overtime),
      doubleOvertimePay: multiplyMoneyOrNull(att.doubleOvertimeHours, base?.doubleOvertime),
      tripleOvertimePay: multiplyMoneyOrNull(att.tripleOvertimeHours, base?.tripleOvertime),
      nightShiftSubsidy: multiplyMoneyOrNull(att.nightShiftCount, nightShiftSubsidyAmount),
      mealSubsidy: multiplyMoneyOrNull(att.mealAllowanceCount, mealSubsidyAmount),
      fullAttendanceBonus: multiplyMoneyOrNull(
        isAttendanceFullAttendance(att.fullAttendanceBonus) ? 1 : null,
        fullAttendanceSubsidyAmount
      ),
      seniorityPay,
      lateDeduction: negateMoneyOrNull(multiplyMoneyOrNull(att.lateCount, latePenaltyAmount)),
      newOrPersonalLeaveDeduction: negateMoneyOrNull(
        multiplyMoneyOrNull(att.newOrPersonalLeaveHours, hourlyRate)
      ),
      sickLeaveDeduction: negateMoneyOrNull(
        multiplyMoneyOrNull(att.sickLeaveHours, sickHourlyRate)
      ),
      absenceDeduction: negateMoneyOrNull(
        multiplyMoneyOrNull(att.absenceHours, multiplyMoneyOrNull(hourlyRate, 3))
      ),
      hygieneFee: toNegativeMoneyOrNull(att.hygieneFee),
      waterFee: toNegativeMoneyOrNull(att.waterFee),
      electricityFee: toNegativeMoneyOrNull(att.electricityFee)
    }
  })
}

const resetRangeDialog = () => {
  rangeSaving.value = false
  const { current } = getAllowedRangeMonths()
  const preset = queryForm.month || ''
  rangeForm.month = preset && isAllowedRangeMonthString(preset) ? preset : formatMonth(current)
  rangeForm.applyToAll = true
  rangeForm.employeeIds = []
}

const cancelRange = () => {
  resetRangeDialog()
  rangeDialogVisible.value = false
}

const saveRange = async () => {
  if (!rangeForm.month) {
    ElMessage.warning('请选择月份')
    return
  }
  if (!isAllowedRangeMonthString(rangeForm.month)) {
    ElMessage.warning('月份只允许选择当月和上一月')
    return
  }
  const employeeIds = getStep1EmployeeIds()
  if (!employeeIds.length) {
    ElMessage.warning('请选择员工')
    return
  }

  rangeSaving.value = true
  try {
    await refreshSalaryBaseParams()
    const baseRows = buildDraftRowsFromEmployees(employeeIds)
    let mergedRows = baseRows
    try {
      mergedRows = await applyAttendanceOvertimeToDraftRows(rangeForm.month, baseRows)
      const hasAnyOvertimeComputed = mergedRows.some(
        (r) =>
          r.overtimePay !== null ||
          r.doubleOvertimePay !== null ||
          r.tripleOvertimePay !== null ||
          r.nightShiftSubsidy !== null ||
          r.mealSubsidy !== null ||
          r.fullAttendanceBonus !== null ||
          r.seniorityPay !== null
      )
      if (!hasAnyOvertimeComputed) {
        ElMessage.warning(`未找到【${rangeForm.month}】考勤数据或加班基数，已仅初始化工资基数`)
      }
    } catch (error) {
      console.error('加载考勤/加班基数失败:', error)
      ElMessage.error('加载考勤/加班基数失败，已仅初始化工资基数')
    }
    addRows.value = mergedRows
    addStep.value = 0
    addStepSaved[0] = false
    addStepSaved[1] = false
    addStepSaved[2] = false
    rangeDialogVisible.value = false
    addDialogVisible.value = true
  } finally {
    rangeSaving.value = false
  }
}

const saveAddStep = async () => {
  if (addStep.value === 0) {
    addSaving.value = true
    try {
      const rows = addRows.value.map((r) => {
        const total = computeRowTotal(r)
        const split = computePaySplit(total)
        return {
          ...r,
          total,
          firstPay: r.firstPay ?? split.first,
          secondPay: r.secondPay ?? split.second
        }
      })
      addRows.value = rows
      addStepSaved[0] = true
      ElMessage.success('步骤1已保存（未写入数据库）')
    } finally {
      addSaving.value = false
    }
    return
  }

  if (addStep.value === 1) {
    addSaving.value = true
    try {
      addStepSaved[1] = true
      ElMessage.success('步骤2已保存（未写入数据库）')
    } finally {
      addSaving.value = false
    }
    return
  }

  if (addStep.value === 2) {
    addSaving.value = true
    try {
      addStepSaved[2] = true
      ElMessage.success('步骤3已保存（未写入数据库）')
    } finally {
      addSaving.value = false
    }
  }
}

const goNextStep = () => {
  if (addStep.value === 0) {
    const rows = addRows.value.map((r) => {
      const total = computeRowTotal(r)
      const split = computePaySplit(total)
      return {
        ...r,
        total,
        firstPay: r.firstPay ?? split.first,
        secondPay: r.secondPay ?? split.second
      }
    })
    addRows.value = rows
    addStepSaved[0] = true
    addStep.value = 1
    return
  }

  if (!addStepSaved[addStep.value]) {
    ElMessage.warning('请先保存当前步骤')
    return
  }
  addStep.value = Math.min(addStep.value + 1, 2)
}

const goPrevStep = () => {
  addStep.value = Math.max(addStep.value - 1, 0)
}

const completeAdd = async () => {
  if (!addStepSaved[2]) {
    ElMessage.warning('请先保存步骤3')
    return
  }

  addCompleting.value = true
  try {
    const month = String(rangeForm.month || '').trim() || '-'
    const now = new Date()
    const createdAt = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes()
    ).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`

    const summary: SalarySummaryRow = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      month,
      employeeCount: addRows.value.length,
      overtimePayTotal: sumMoney(addRows.value, (r) => r.overtimePay),
      doubleOvertimePayTotal: sumMoney(addRows.value, (r) => r.doubleOvertimePay),
      tripleOvertimePayTotal: sumMoney(addRows.value, (r) => r.tripleOvertimePay),
      currentSalaryTotal: Math.round(addRowsTotal.value * 100) / 100,
      firstPayTotal: Math.round(addRowsFirstPayTotal.value * 100) / 100,
      secondPayTotal: Math.round(addRowsSecondPayTotal.value * 100) / 100,
      createdAt
    }

    tableData.value = [summary, ...tableData.value]
    pagination.total = tableData.value.length
    ElMessage.success('新增完成（已生成汇总，未写入数据库）')
    addDialogVisible.value = false
  } finally {
    addCompleting.value = false
  }
}

onMounted(() => {
  void loadList()
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
}

@media (width > 768px) {
  .query-form {
    display: flex;
    align-items: center;
    flex-wrap: nowrap;
    gap: 12px;
  }

  :deep(.query-form .el-form-item) {
    margin-bottom: 0;
  }

  .query-actions {
    flex-wrap: nowrap;
    white-space: nowrap;
  }
}

.mobile-top-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}

.query-form__actions {
  display: flex;
  margin-left: auto;
}

.query-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.salary-table-wrapper {
  padding: 4px;
  background: var(--el-bg-color);
  border-radius: 8px;
}

.salary-add-body {
  margin-top: 12px;
}

.salary-add-table-wrap {
  display: flex;
  justify-content: center;
  overflow-x: auto;
}

.salary-add-table-wrap--step1 {
  padding-bottom: 6px;
}

.salary-add-step {
  margin-top: 12px;
}

:deep(.salary-add-dialog .salary-add-step) {
  min-height: 590px;
}

.salary-add-summary {
  display: flex;
  gap: 18px;
  padding: 10px 0;
  font-size: 14px;
  color: var(--el-text-color-regular);
}

:deep(.salary-add-dialog .sa-col-input .cell) {
  padding: 0 !important;
}

:deep(.salary-add-dialog .sa-col-input--center .cell) {
  display: flex;
  align-items: center;
  justify-content: center;
}

:deep(.salary-add-dialog .sa-number.el-input-number) {
  width: 120px;
}

:deep(.salary-add-dialog .sa-number--narrow.el-input-number) {
  width: 80px;
}

.salary-add-header {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.salary-add-header__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.salary-add-header__title {
  font-size: 16px;
  font-weight: 600;
}

.salary-add-header__meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.salary-add-header__meta-row {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.salary-add-header__meta-row--sub {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

.salary-add-header__meta-row--sub-hidden {
  visibility: hidden;
}

.salary-add-header__meta-text {
  font-size: 13px;
  color: var(--el-text-color-regular);
}

.salary-add-steps {
  padding: 0 4px;
  margin-top: -92px;
}

.salary-add-footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

:deep(.salary-add-footer .el-button + .el-button) {
  margin-left: 0;
}

:deep(.salary-add-dialog .el-dialog__header) {
  min-height: 96px;
  padding-top: 12px;
  padding-bottom: 10px;
}

:deep(.salary-add-dialog .el-dialog__headerbtn) {
  top: 12px;
}

.pagination-footer {
  display: flex;
  justify-content: center;
}

.pagination-footer--mobile {
  justify-content: center;
}

:deep(.params-dialog .el-dialog__body) {
  padding-top: 8px;
}

:deep(.params-dialog .sb-col-input .cell) {
  padding: 0 !important;
}

:deep(.params-dialog .sb-number.el-input-number) {
  width: 120px;
}

:deep(.params-dialog .el-dialog__body) {
  padding-top: 8px;
}

:deep(.params-dialog .lv-col-input .cell) {
  padding: 0 !important;
}

:deep(.params-dialog .lv-number.el-input-number) {
  width: 120px;
}

:deep(.params-dialog .sub-col-input .cell) {
  padding: 0 !important;
}

:deep(.params-dialog .sub-number.el-input-number) {
  width: 120px;
}

.params-tab-body {
  min-height: 580px;
}
</style>
