import type { Item, CashbackEntry } from '@/types'
import { sumPlatformRefund, sumStoreRefund, sumStoreManualEntries, calcBrandCashback } from './cashback'

/**
 * 迷住保价计算
 *
 * 用户输入：好价（必须 < 下单价）+ 类型（一类/二类）
 *
 * 一类保价:
 *   原一类到手价 = 原下单价 - 单品返现 - 平台保价 - 店铺保价
 *   新一类到手价 = 好价 - 单品返现 - 平台保价 - 店铺保价
 *   保价返现 = 原一类到手价 - 新一类到手价
 *
 * 二类保价:
 *   原二类到手价 = 原下单价 - 单品返现 - 店铺活动 - 品牌套购 - 大套购 - 平台保价 - 店铺保价
 *   新二类到手价 = 好价 - (同上扣减项，品牌套购基准因好价变化)
 *   保价返现 = 原二类到手价 - 新二类到手价
 */

interface ProtectResult {
  refund: number
  reason?: string
}

export function calcMizhuProtect(item: Item, entries: CashbackEntry[]): ProtectResult {
  if (!item.mizhuProtectType || item.mizhuProtectPrice == null) {
    return { refund: 0, reason: '未设置保价' }
  }
  if (item.mizhuProtectPrice >= item.price) {
    return { refund: 0, reason: '好价必须小于下单价' }
  }

  const platformRefund = sumPlatformRefund(entries)
  const storeRefund = sumStoreRefund(entries)
  const storeManual = sumStoreManualEntries(entries)

  if (item.mizhuProtectType === '一类') {
    // 单品返现 = 店铺侧手填条目
    const originalFinal = item.price - storeManual - platformRefund - storeRefund
    const newFinal = item.mizhuProtectPrice - storeManual - platformRefund - storeRefund
    const refund = Math.round((originalFinal - newFinal) * 100) / 100

    if (refund <= 0) {
      return { refund: 0, reason: '好价到手价不优于原价，不触发保价' }
    }
    return { refund }
  }

  // 二类
  const brandCashback = calcBrandCashback(item, entries)
  const bigPurchase = entries.find(e => e.type === 'big_purchase')?.amount ?? 0

  // 原二类到手价
  const originalFinal2 = item.price - storeManual - brandCashback - bigPurchase - platformRefund - storeRefund

  // 新二类到手价：品牌套购基准因好价变化
  const newBase = item.mizhuProtectPrice - platformRefund - storeRefund - storeManual
  const newBrandCashback = newBase > 0 && item.brandCoefficient != null
    ? Math.round(newBase * (1 - item.brandCoefficient) * 100) / 100
    : 0
  const newFinal2 = item.mizhuProtectPrice - storeManual - newBrandCashback - bigPurchase - platformRefund - storeRefund

  const refund2 = Math.round((originalFinal2 - newFinal2) * 100) / 100

  if (refund2 <= 0) {
    return { refund: 0, reason: '好价到手价不优于原价，不触发保价' }
  }
  return { refund: refund2 }
}
