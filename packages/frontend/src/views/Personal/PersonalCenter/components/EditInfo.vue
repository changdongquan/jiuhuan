<script lang="ts" setup>
import { FormSchema, Form } from '@/components/Form'
import { useForm } from '@/hooks/web/useForm'
import { useValidator } from '@/hooks/web/useValidator'
import { reactive, ref, watch } from 'vue'
import { ElDivider, ElMessage, ElMessageBox } from 'element-plus'
import { updateProfileApi } from '@/api/login'
import { useUserStore } from '@/store/modules/user'

const props = defineProps({
  userInfo: {
    type: Object,
    default: () => ({})
  },
  disabled: {
    type: Boolean,
    default: false
  }
})

const { required, phone, maxlength, email } = useValidator()

const formSchema = reactive<FormSchema[]>([
  {
    field: 'realName',
    label: '昵称',
    component: 'Input',
    colProps: {
      span: 24
    }
  },
  {
    field: 'phoneNumber',
    label: '手机号码',
    component: 'Input',
    colProps: {
      span: 24
    }
  },
  {
    field: 'email',
    label: '邮箱',
    component: 'Input',
    colProps: {
      span: 24
    }
  }
])

const rules = reactive({
  realName: [required(), maxlength(50)],
  phoneNumber: [phone()],
  email: [email()]
})

const { formRegister, formMethods } = useForm()
const { setValues, getElFormExpose, getFormData } = formMethods

const userStore = useUserStore()

watch(
  () => props.userInfo,
  (value) => {
    setValues(value)
  },
  {
    immediate: true,
    deep: true
  }
)

const saveLoading = ref(false)
const save = async () => {
  if (props.disabled) {
    ElMessage.warning('域用户基本信息由域管理员维护，不能在此修改')
    return
  }
  const elForm = await getElFormExpose()
  const valid = await elForm?.validate().catch((err) => {
    console.log(err)
  })
  if (valid) {
    ElMessageBox.confirm('是否确认修改?', '提示', {
      confirmButtonText: '确认',
      cancelButtonText: '取消',
      type: 'warning'
    })
      .then(async () => {
        try {
          saveLoading.value = true
          const formData = await getFormData()
          const payload = {
            realName: formData.realName,
            displayName: formData.realName,
            email: formData.email,
            phoneNumber: formData.phoneNumber
          }
          const res = (await updateProfileApi(payload)) as any
          if (res?.success) {
            ElMessage.success(res.message || '修改成功')
            const current = (userStore.getUserInfo || {}) as any
            userStore.setUserInfo({
              ...current,
              realName: res.data?.realName || payload.realName || current.realName,
              displayName: res.data?.displayName || payload.realName || current.displayName,
              email: res.data?.email ?? payload.email ?? current.email,
              phoneNumber: res.data?.phoneNumber ?? payload.phoneNumber ?? current.phoneNumber
            })
          }
        } catch (error) {
          console.log(error)
        } finally {
          saveLoading.value = false
        }
      })
      .catch(() => {})
  }
}
</script>

<template>
  <Form :rules="rules" :disabled="disabled" @register="formRegister" :schema="formSchema" />
  <ElDivider />
  <BaseButton type="primary" :disabled="disabled" @click="save">保存</BaseButton>
</template>
