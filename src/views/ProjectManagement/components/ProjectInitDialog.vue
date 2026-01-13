<template>
  <el-dialog
    v-model="visible"
    title="初始化"
    :width="isMobile ? '100%' : '980px'"
    :fullscreen="isMobile"
    :close-on-click-modal="false"
    class="pm-init-dialog"
    @closed="handleClosed"
  >
    <el-steps :active="step" align-center class="pm-init-steps">
      <el-step title="项目信息" description="确认项目编号与基础信息" />
      <el-step title="模具穴数" description="按产品组初始化穴数" />
    </el-steps>

    <div class="pm-init-body">
      <div v-show="step === 0" class="pm-init-step">
        <el-alert
          type="info"
          :closable="false"
          title="初始化仅需完成一次，完成后将不再弹出。"
          class="pm-init-alert"
        />
        <el-descriptions :column="isMobile ? 1 : 2" border class="pm-init-desc">
          <el-descriptions-item label="项目编号">
            {{ project?.项目编号 || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="项目名称">
            {{ project?.项目名称 || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="产品名称">
            {{ project?.productName || project?.产品名称 || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="产品图号">
            {{ project?.productDrawing || project?.产品图号 || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="客户模号">
            {{ project?.客户模号 || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="当前模具穴数">
            {{ project?.模具穴数 || '-' }}
          </el-descriptions-item>
        </el-descriptions>
      </div>

      <div v-show="step === 1" class="pm-init-step">
        <div class="pm-init-groups-header">
          <div class="pm-init-groups-title">
            <div class="pm-init-groups-title__main">产品组</div>
            <div class="pm-init-groups-title__sub">总穴数：{{ totalCavityCount }}</div>
          </div>
          <el-button type="primary" plain @click="handleAddGroup">+ 添加产品组</el-button>
        </div>

        <VueDraggable v-model="groups" handle=".pm-init-group__drag" :animation="150">
          <div v-for="(group, index) in groups" :key="group.id" class="pm-init-group-wrap">
            <el-card
              shadow="hover"
              class="pm-init-group"
              :class="{ 'is-expanded': group.expanded }"
              @click="toggleExpanded(group.id)"
            >
              <div class="pm-init-group__header">
                <div class="pm-init-group__left">
                  <div class="pm-init-group__drag" title="拖拽排序" @click.stop>
                    <Icon icon="vi-ep:rank" />
                  </div>
                  <div class="pm-init-group__title">
                    {{ group.name || `产品组 ${index + 1}` }}
                  </div>
                </div>
                <div class="pm-init-group__right" @click.stop>
                  <div class="pm-init-group__cavity">
                    <el-button
                      size="small"
                      :disabled="group.cavityCount <= 1"
                      @click="decCavity(group.id)"
                    >
                      -
                    </el-button>
                    <el-input-number
                      v-model="group.cavityCount"
                      :min="1"
                      :max="64"
                      :controls="false"
                      size="small"
                      class="pm-init-group__cavity-input"
                      @change="normalizeCavity(group.id)"
                      @click.stop
                    />
                    <el-button
                      size="small"
                      :disabled="group.cavityCount >= 64"
                      @click="incCavity(group.id)"
                    >
                      +
                    </el-button>
                  </div>
                  <el-button
                    text
                    type="danger"
                    title="删除"
                    :disabled="groups.length <= 1"
                    @click="handleDeleteGroup(group.id)"
                  >
                    <Icon icon="vi-ep:close" />
                  </el-button>
                </div>
              </div>

              <el-collapse-transition>
                <div v-show="group.expanded" class="pm-init-group__detail" @click.stop>
                  <el-form label-width="100px" class="pm-init-group__detail-form">
                    <el-form-item label="产品组名称">
                      <el-input v-model="group.name" placeholder="例如：A组 / B组（可选）" />
                    </el-form-item>
                    <el-form-item label="穴数">
                      <el-input-number
                        v-model="group.cavityCount"
                        :min="1"
                        :max="64"
                        :controls="true"
                        style="width: 100%"
                        @change="normalizeCavity(group.id)"
                      />
                    </el-form-item>
                  </el-form>
                </div>
              </el-collapse-transition>
            </el-card>
          </div>
        </VueDraggable>
      </div>
    </div>

    <template #footer>
      <div class="pm-init-footer">
        <el-button @click="visible = false">取消</el-button>
        <el-button v-if="step === 0" type="primary" @click="step = 1">下一步</el-button>
        <el-button v-else type="primary" @click="handleComplete">完成并进入编辑</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { VueDraggable } from 'vue-draggable-plus'
import type { ProjectInfo } from '@/api/project'

type InitProductGroup = {
  id: string
  name: string
  cavityCount: number
  expanded: boolean
}

const props = defineProps<{
  modelValue: boolean
  project: Partial<ProjectInfo> | null
  initialGroups: Array<Omit<InitProductGroup, 'expanded'>> | null
  isMobile: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'complete', v: Array<Omit<InitProductGroup, 'expanded'>>): void
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})

const step = ref(0)
const groups = ref<InitProductGroup[]>([])

const toSafeCavity = (value: unknown) => {
  const n = Number(value)
  if (!Number.isFinite(n)) return 1
  return Math.min(64, Math.max(1, Math.round(n)))
}

const makeDefaultGroup = (index: number, cavityCount: number): InitProductGroup => ({
  id: `g_${Date.now()}_${Math.random().toString(16).slice(2)}_${index}`,
  name: `产品组 ${index + 1}`,
  cavityCount: toSafeCavity(cavityCount),
  expanded: false
})

const resetFromProps = () => {
  step.value = 0
  const initial = props.initialGroups || []
  if (initial.length) {
    groups.value = initial.map((g, idx) => ({
      id: g.id || makeDefaultGroup(idx, g.cavityCount).id,
      name: g.name || `产品组 ${idx + 1}`,
      cavityCount: toSafeCavity(g.cavityCount),
      expanded: false
    }))
    return
  }

  const fallback = toSafeCavity((props.project as any)?.模具穴数)
  groups.value = [makeDefaultGroup(0, fallback)]
}

watch(
  () => props.modelValue,
  (v) => {
    if (!v) return
    resetFromProps()
  }
)

const totalCavityCount = computed(() =>
  groups.value.reduce((sum, g) => sum + toSafeCavity(g.cavityCount), 0)
)

const toggleExpanded = (id: string) => {
  const group = groups.value.find((g) => g.id === id)
  if (!group) return
  group.expanded = !group.expanded
}

const normalizeCavity = (id: string) => {
  const group = groups.value.find((g) => g.id === id)
  if (!group) return
  group.cavityCount = toSafeCavity(group.cavityCount)
}

const decCavity = (id: string) => {
  const group = groups.value.find((g) => g.id === id)
  if (!group) return
  group.cavityCount = toSafeCavity(group.cavityCount - 1)
}

const incCavity = (id: string) => {
  const group = groups.value.find((g) => g.id === id)
  if (!group) return
  group.cavityCount = toSafeCavity(group.cavityCount + 1)
}

const handleAddGroup = () => {
  groups.value.push(makeDefaultGroup(groups.value.length, 1))
}

const handleDeleteGroup = (id: string) => {
  if (groups.value.length <= 1) return
  groups.value = groups.value.filter((g) => g.id !== id)
}

const handleComplete = () => {
  if (!groups.value.length) {
    ElMessage.warning('请至少保留 1 个产品组')
    return
  }
  emit(
    'complete',
    groups.value.map(({ expanded: _expanded, ...g }) => ({
      ...g,
      cavityCount: toSafeCavity(g.cavityCount)
    }))
  )
  visible.value = false
}

const handleClosed = () => {
  step.value = 0
}
</script>

<style scoped>
.pm-init-steps {
  margin-bottom: 12px;
}

.pm-init-alert {
  margin-bottom: 12px;
}

.pm-init-groups-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.pm-init-groups-title__main {
  font-weight: 600;
}

.pm-init-groups-title__sub {
  margin-top: 2px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.pm-init-group-wrap + .pm-init-group-wrap {
  margin-top: 10px;
}

.pm-init-group {
  cursor: pointer;
}

.pm-init-group__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.pm-init-group__left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.pm-init-group__drag {
  color: var(--el-text-color-secondary);
  cursor: move;
}

.pm-init-group__title {
  overflow: hidden;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pm-init-group__right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.pm-init-group__cavity {
  display: flex;
  align-items: center;
  gap: 6px;
}

.pm-init-group__cavity-input {
  width: 110px;
}

.pm-init-group__detail {
  padding-top: 10px;
  margin-top: 10px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.pm-init-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
