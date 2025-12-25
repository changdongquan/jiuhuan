<script setup lang="ts">
import { ElOverlay } from 'element-plus'
import { ref, nextTick, watch, onUnmounted } from 'vue'
import { Icon } from '@/components/Icon'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  url: {
    type: String,
    default: '',
    required: true
  },
  fileName: {
    type: String,
    default: ''
  },
  id: {
    type: String,
    default: ''
  }
})

const visible = ref(props.show)

const close = async () => {
  visible.value = false
  await nextTick()
  const wrap = document.getElementById(props.id)
  if (!wrap) return

  // 清理 blob URL
  if (props.url && props.url.startsWith('blob:')) {
    try {
      window.URL.revokeObjectURL(props.url)
    } catch (error) {
      console.error('清理 blob URL 失败:', error)
    }
  }

  document.body.removeChild(wrap)
}

// 监听 show 变化
watch(
  () => props.show,
  (val) => {
    visible.value = val
  }
)

// 组件卸载时清理
onUnmounted(() => {
  if (props.url && props.url.startsWith('blob:')) {
    try {
      window.URL.revokeObjectURL(props.url)
    } catch (error) {
      console.error('清理 blob URL 失败:', error)
    }
  }
})
</script>

<template>
  <ElOverlay v-show="visible" :z-index="3000" @click="close">
    <div class="pdf-viewer-container" @click.stop>
      <div class="pdf-viewer-header">
        <span class="pdf-viewer-title">{{ fileName || 'PDF 预览' }}</span>
        <div class="pdf-viewer-close" @click="close">
          <Icon icon="vi-ep:close" :size="20" />
        </div>
      </div>
      <div class="pdf-viewer-content">
        <iframe
          :src="url"
          frameborder="0"
          class="pdf-viewer-iframe"
          type="application/pdf"
        ></iframe>
      </div>
    </div>
  </ElOverlay>
</template>

<style lang="less" scoped>
.pdf-viewer-container {
  display: flex;
  width: 90vw;
  height: 90vh;
  max-width: 1400px;
  max-height: 900px;
  overflow: hidden;
  background: var(--el-bg-color);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgb(0 0 0 / 15%);
  flex-direction: column;
}

.pdf-viewer-header {
  display: flex;
  height: 50px;
  padding: 0 20px;
  background: var(--el-bg-color-page);
  border-bottom: 1px solid var(--el-border-color);
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.pdf-viewer-title {
  margin-right: 16px;
  overflow: hidden;
  font-size: 16px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.pdf-viewer-close {
  display: flex;
  width: 32px;
  height: 32px;
  color: var(--el-text-color-regular);
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.3s;
  align-items: center;
  justify-content: center;

  &:hover {
    color: var(--el-text-color-primary);
    background: var(--el-fill-color-light);
  }
}

.pdf-viewer-content {
  position: relative;
  overflow: hidden;
  flex: 1;
}

.pdf-viewer-iframe {
  width: 100%;
  height: 100%;
  border: none;
}
</style>
