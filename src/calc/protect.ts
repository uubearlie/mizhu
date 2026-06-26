import type { Item, CashbackEntry } from '@/types'
import { sumPlatformRefund, sumStoreRefund, sumStoreManualEntries, calcBrandCashback } from './cashback'

/**
 * 迷住保价计算
 *
 * 用户输入：迷住保价到手价 + 类型（一类/二类）
 * 迷住保价保的是到手价，直接与原到手价比差
 *
 * 一类保价:
 *   原一类到手价 = 原下单价 - 单品返现 - 平台保价 - 店铺保价
 *   保价返现 = 原一类到手价 - 迷住保价到手价
 *
 * 二类保价:
 *   原二类到手价 = 原下单价 - 单品返现 - 店铺活动 - 品牌套购
 *                       - 大套购 - 平台保价 - 店铺保价
 *   保价返现 = 原二类到手价 - 迷住保价到手价
 */

interface ProtectResult {
  refund: number
  reason?: string
}

export function calcMizhuProtect(item: Item, entries: CashbackEntry[]): ProtectResult {
  if (!item.mizhuProtectType || item.mizhuProtectPrice == null) {
    return { refund: 0, reason: '未设置保价' }
  }

  const platformRefund = sumPlatformRefund(entries)
  const storeRefund = sumStoreRefund(entries)
  const storeManual = sumStoreManualEntries(entries)

  if (item.mizhuProtectType === '一类') {
    const originalFinal = item.price - storeManual - platformRefund - storeRefund
    const refund = Math.round((originalFinal - item.mizhuProtectPrice) * 100) / 100

    if (refund <= 0) {
      return { refund: 0, reason: '迷住保价到手价不优于原到手价，不触发保价' }
    }
    return { refund }
  }

  // 二类
  const brandCashback = calcBrandCashback(item, entries)
  const bigPurchase = entries.find(e => e.type === 'big_purchase')?.amount ?? 0

  const originalFinal2 = item.price - storeManual - brandCashback - bigPurchase - platformRefund - storeRefund
  const refund2 = Math.round((originalFinal2 - item.mizhuProtectPrice) * 100) / 100

  if (refund2 <= 0) {
    return { refund: 0, reason: '迷住保价到手价不优于原到手价，不触发保价' }
  }
  return { refund: refund2 }
}
