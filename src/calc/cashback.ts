import type { CashbackEntry, CashbackEntryType, Payer } from '@/types'
import { STORE_MANUAL_TYPES, ENTRY_TYPE_MAP, BIG_PURCHASE_ESTIMATE_RATE } from '@/types'
import type { Item } from '@/types'

/**
 * 获取条目的付款方
 */
export function getPayer(type: CashbackEntryType): Payer {
  return ENTRY_TYPE_MAP[type].payer
}

/**
 * 店铺侧手填条目金额之和（参与品牌套购基准扣除）
 */
export function sumStoreManualEntries(entries: CashbackEntry[]): number {
  return entries
    .filter(e => STORE_MANUAL_TYPES.includes(e.type))
    .reduce((sum, e) => sum + e.amount, 0)
}

/**
 * 平台保价金额之和
 */
export function sumPlatformRefund(entries: CashbackEntry[]): number {
  return entries.filter(e => e.type === 'platform_refund').reduce((s, e) => s + e.amount, 0)
}

/**
 * 店铺保价金额之和
 */
export function sumStoreRefund(entries: CashbackEntry[]): number {
  return entries.filter(e => e.type === 'store_refund').reduce((s, e) => s + e.amount, 0)
}

/**
 * 品牌套购计算
 * 基准 = 下单价 - 平台保价 - 店铺保价 - Σ(店铺侧手填条目)
 * 返现 = 基准 × (1 - 系数)
 */
export function calcBrandCashback(item: Item, entries: CashbackEntry[]): number {
  if (item.brandCoefficient == null) return 0
  const platformRefund = sumPlatformRefund(entries)
  const storeRefund = sumStoreRefund(entries)
  const storeManual = sumStoreManualEntries(entries)
  const base = item.price - platformRefund - storeRefund - storeManual
  if (base <= 0) return 0
  return Math.round(base * (1 - item.brandCoefficient) * 100) / 100
}

/**
 * 大套购预估
 */
export function calcBigPurchaseEstimate(price: number): number {
  return Math.round(price * BIG_PURCHASE_ESTIMATE_RATE * 100) / 100
}
