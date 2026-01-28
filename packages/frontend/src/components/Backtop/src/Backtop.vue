<script setup lang="ts">
import { computed } from 'vue'
import { ElBacktop } from 'element-plus'
import { useDesign } from '@/hooks/web/useDesign'
import { useAppStore } from '@/store/modules/app'

const { getPrefixCls, variables } = useDesign()

const prefixCls = getPrefixCls('backtop')

const appStore = useAppStore()
const isMobile = computed(() => appStore.getMobile)
</script>

<template>
  <ElBacktop
    :class="prefixCls"
    :target="`.${variables.namespace}-layout-content-scrollbar .${variables.elNamespace}-scrollbar__wrap`"
    :right="isMobile ? 12 : 40"
    :bottom="isMobile ? 6 : 40"
  />
</template>
