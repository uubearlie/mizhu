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
 * 注意：big_purchase 的 payer 已改为 '大套购'，不再计入迷住侧
 */
export function sumMizhuEntries(entries: CashbackEntry[]): number {
  return entries
    .filter(e => ENTRY_TYPE_MAP[e.type].payer === '迷住')
    .reduce((sum, e) => sum + e.amount, 0)
}

/**
 * 大套购侧合计 = Σ(Entry where type='big_purchase')
 */
export function sumBigPurchaseEntries(entries: CashbackEntry[]): number {
  return entries
    .filter(e => e.type === 'big_purchase')
    .reduce((sum, e) => sum + e.amount, 0)
}

/**
 * 到手价 = price - 店铺侧合计 - 迷住侧合计 - 大套购侧合计
 */
export function calcFinalPrice(item: Item, entries: CashbackEntry[]): number {
  const storeTotal = sumStoreEntries(entries)
  const mizhuTotal = sumMizhuEntries(entries)
  const bigPurchaseTotal = sumBigPurchaseEntries(entries)
  return Math.round((item.price - storeTotal - mizhuTotal - bigPurchaseTotal) * 100) / 100
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

/**
 * 大套购已返 = Σ(PaymentRecord where payer='大套购')
 */
export function sumBigPurchasePayments(records: PaymentRecord[]): number {
  return records.filter(r => r.payer === '大套购').reduce((s, r) => s + r.amount, 0)
}

export interface ItemCalc {
  storeTotal: number
  mizhuTotal: number
  bigPurchaseTotal: number
  finalPrice: number
  storePaid: number
  mizhuPaid: number
  bigPurchasePaid: number
  storePending: number
  mizhuPending: number
  bigPurchasePending: number
  totalPending: number
}

const r2 = (n: number) => Math.round(n * 100) / 100

/**
 * 完整聚合计算
 */
export function calcItem(item: Item, entries: CashbackEntry[], records: PaymentRecord[]): ItemCalc {
  const storeTotal = sumStoreEntries(entries)
  const mizhuTotal = sumMizhuEntries(entries)
  const bigPurchaseTotal = sumBigPurchaseEntries(entries)
  const finalPrice = r2(item.price - storeTotal - mizhuTotal - bigPurchaseTotal)
  const storePaid = sumStorePayments(records)
  const mizhuPaid = sumMizhuPayments(records)
  const bigPurchasePaid = sumBigPurchasePayments(records)
  const storePending = r2(storeTotal - storePaid)
  const mizhuPending = r2(mizhuTotal - mizhuPaid)
  const bigPurchasePending = r2(bigPurchaseTotal - bigPurchasePaid)
  const totalPending = r2(storePending + mizhuPending + bigPurchasePending)

  return { storeTotal, mizhuTotal, bigPurchaseTotal, finalPrice, storePaid, mizhuPaid, bigPurchasePaid, storePending, mizhuPending, bigPurchasePending, totalPending }
}
