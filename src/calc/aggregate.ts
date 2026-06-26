import type { Item, CashbackEntry, PaymentRecord } from '@/types'
import { ENTRY_TYPE_MAP } from '@/types'

/**
 * 店铺侧合计 = Σ(Entry where payer='店铺')
 */
export function sumStoreEntries(entries: CashbackEntry[]): number {
  return entries
    .filter(e => ENTRY_TYPE_MAP[e.type].payer === '店铺')
    .reduce((sum, e) => sum + e.amount, 0)
}

/**
 * 迷住侧合计 = Σ(Entry where payer='迷住')
 */
export function sumMizhuEntries(entries: CashbackEntry[]): number {
  return entries
    .filter(e => ENTRY_TYPE_MAP[e.type].payer === '迷住')
    .reduce((sum, e) => sum + e.amount, 0)
}

/**
 * 到手价 = price - 店铺侧合计 - 迷住侧合计
 */
export function calcFinalPrice(item: Item, entries: CashbackEntry[]): number {
  const storeTotal = sumStoreEntries(entries)
  const mizhuTotal = sumMizhuEntries(entries)
  return Math.round((item.price - storeTotal - mizhuTotal) * 100) / 100
}

/**
 * 店铺已返 = Σ(PaymentRecord where payer='店铺')
 */
export function sumStorePayments(records: PaymentRecord[]): number {
  return records.filter(r => r.payer === '店铺').reduce((s, r) => s + r.amount, 0)
}

/**
 * 迷住已返 = Σ(PaymentRecord where payer='迷住')
 */
export function sumMizhuPayments(records: PaymentRecord[]): number {
  return records.filter(r => r.payer === '迷住').reduce((s, r) => s + r.amount, 0)
}

export interface ItemCalc {
  storeTotal: number
  mizhuTotal: number
  finalPrice: number
  storePaid: number
  mizhuPaid: number
  storePending: number
  mizhuPending: number
  totalPending: number
}

/**
 * 完整聚合计算
 */
export function calcItem(item: Item, entries: CashbackEntry[], records: PaymentRecord[]): ItemCalc {
  const storeTotal = sumStoreEntries(entries)
  const mizhuTotal = sumMizhuEntries(entries)
  const finalPrice = Math.round((item.price - storeTotal - mizhuTotal) * 100) / 100
  const storePaid = sumStorePayments(records)
  const mizhuPaid = sumMizhuPayments(records)
  const storePending = Math.round((storeTotal - storePaid) * 100) / 100
  const mizhuPending = Math.round((mizhuTotal - mizhuPaid) * 100) / 100
  const totalPending = Math.round((storePending + mizhuPending) * 100) / 100

  return { storeTotal, mizhuTotal, finalPrice, storePaid, mizhuPaid, storePending, mizhuPending, totalPending }
}
