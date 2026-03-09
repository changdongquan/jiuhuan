import { getBmoPendingInitiationCountApi, getBmoPendingReviewCountApi } from '@/api/bmo'
import { getHardDeleteReviewPendingCountApi } from '@/api/goods'
import { getQuotationInitiationPendingCountApi } from '@/api/quotation'
import { getCustomerCreateReviewPendingCountApi } from '@/api/review-center'
import { useAppStoreWithOut } from '@/store/modules/app'

export const refreshBmoMenuBadges = async () => {
  const appStore = useAppStoreWithOut()
  try {
    const [initiationRes, reviewRes, hardDeleteRes, quotationReviewRes, customerReviewRes] =
      await Promise.all([
        getBmoPendingInitiationCountApi({ timeout: 8000 }),
        getBmoPendingReviewCountApi({ timeout: 8000 }),
        getHardDeleteReviewPendingCountApi({ timeout: 8000 }),
        getQuotationInitiationPendingCountApi({ timeout: 8000 }),
        getCustomerCreateReviewPendingCountApi({ timeout: 8000 })
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
