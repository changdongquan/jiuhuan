import { getBmoPendingInitiationCountApi, getBmoPendingReviewCountApi } from '@/api/bmo'
import { getHardDeleteReviewPendingCountApi } from '@/api/goods'
import { getQuotationInitiationPendingCountApi } from '@/api/quotation'
import { getCustomerCreateReviewPendingCountApi } from '@/api/review-center'
import { useAppStoreWithOut } from '@/store/modules/app'
import { useUserStoreWithOut } from '@/store/modules/user'

export const refreshBmoMenuBadges = async () => {
  const appStore = useAppStoreWithOut()
  const userStore = useUserStoreWithOut()
  const userInfo = (userStore.getUserInfo || {}) as any
  const capabilityKeys = ((userInfo.capabilities || []) as string[]).map((x) =>
    String(x || '')
      .trim()
      .toUpperCase()
  )
  const routePermissions = ((userInfo.permissions || []) as string[]).map((x) =>
    String(x || '').trim()
  )
  const canReadCustomerReview =
    capabilityKeys.includes('CUSTOMER_INFO.READ') || routePermissions.includes('CustomerInfoIndex')
  try {
    const customerReviewPromise = canReadCustomerReview
      ? getCustomerCreateReviewPendingCountApi({ timeout: 8000, silentError: true })
      : Promise.resolve({ data: { pendingCount: 0 } })

    const [initiationRes, reviewRes, hardDeleteRes, quotationReviewRes, customerReviewRes] =
      await Promise.all([
        getBmoPendingInitiationCountApi({ timeout: 8000, silentError: true }),
        getBmoPendingReviewCountApi({ timeout: 8000, silentError: true }),
        getHardDeleteReviewPendingCountApi({ timeout: 8000, silentError: true }),
        getQuotationInitiationPendingCountApi({ timeout: 8000, silentError: true }),
        customerReviewPromise
      ])
    const pendingInitiationCount = Number(initiationRes?.data?.pendingCount || 0) || 0
    const pendingReviewCount =
      (Number(reviewRes?.data?.pendingCount || 0) || 0) +
      (Number(hardDeleteRes?.data?.pendingCount || 0) || 0) +
      (Number(quotationReviewRes?.data?.pendingCount || 0) || 0) +
      (Number(customerReviewRes?.data?.pendingCount || 0) || 0)
    appStore.setBmoPendingInitiationCount(pendingInitiationCount)
    appStore.setBmoPendingReviewCount(pendingReviewCount)
  } catch {
    appStore.setBmoPendingInitiationCount(0)
    appStore.setBmoPendingReviewCount(0)
  }
}
