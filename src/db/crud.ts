import { db } from '@/db'
import type { Activity, Item, CashbackEntry, PaymentRecord, SettlementBatch, BigPurchaseRule } from '@/types'

// ===== Activity =====

export async function createActivity(data: Omit<Activity, 'id' | 'createdAt'>): Promise<string> {
  const id = crypto.randomUUID()
  await db.activities.add({ ...data, id, createdAt: new Date().toISOString() })
  return id
}

export async function updateActivity(id: string, data: Partial<Activity>): Promise<void> {
  await db.activities.update(id, data)
}

export async function getActivity(id: string): Promise<Activity | undefined> {
  return db.activities.get(id)
}

export async function getAllActivities(): Promise<Activity[]> {
  const list = await db.activities.toArray()
  return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function deleteActivity(id: string): Promise<void> {
  const items = await db.items.where('activityId').equals(id).toArray()
  for (const item of items) {
    await db.cashbackEntries.where('itemId').equals(item.id).delete()
    await db.paymentRecords.where('itemId').equals(item.id).delete()
  }
  await db.items.where('activityId').equals(id).delete()
  await db.settlementBatches.where('activityId').equals(id).delete()
  await db.activities.delete(id)
}

export const DEFAULT_BIG_PURCHASE_RULES: BigPurchaseRule[] = [
  { threshold: 3000, cashback: 100 },
  { threshold: 5000, cashback: 200 },
  { threshold: 10000, cashback: 500 },
]

// ===== Item =====

export async function createItem(data: Omit<Item, 'id' | 'createdAt' | 'isDeleted'>): Promise<string> {
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  await db.items.add({ ...data, id, createdAt: now, isDeleted: false })
  return id
}

export async function updateItem(id: string, data: Partial<Item>): Promise<void> {
  await db.items.update(id, data)
}

export async function getItem(id: string): Promise<Item | undefined> {
  return db.items.get(id)
}

export async function getItemsByActivity(activityId: string): Promise<Item[]> {
  const items = await db.items.where('activityId').equals(activityId).toArray()
  return items.filter(i => !i.isDeleted)
}

export async function getPendingItems(activityId: string): Promise<Item[]> {
  const items = await getItemsByActivity(activityId)
  return items.filter(i => i.status === '待收货')
}

export async function deleteItem(id: string): Promise<void> {
  await db.cashbackEntries.where('itemId').equals(id).delete()
  await db.paymentRecords.where('itemId').equals(id).delete()
  await db.items.delete(id)
}

// ===== CashbackEntry =====

export async function getEntriesByItem(itemId: string): Promise<CashbackEntry[]> {
  return db.cashbackEntries.where('itemId').equals(itemId).toArray()
}

export async function createEntry(data: Omit<CashbackEntry, 'id' | 'createdAt'>): Promise<string> {
  const id = crypto.randomUUID()
  await db.cashbackEntries.add({ ...data, id, createdAt: new Date().toISOString() })
  return id
}

export async function updateEntry(id: string, data: Partial<CashbackEntry>): Promise<void> {
  await db.cashbackEntries.update(id, data)
}

export async function deleteEntry(id: string): Promise<void> {
  await db.cashbackEntries.delete(id)
}

export async function replaceItemEntries(itemId: string, entries: CashbackEntry[]): Promise<void> {
  await db.cashbackEntries.where('itemId').equals(itemId).delete()
  if (entries.length > 0) {
    await db.cashbackEntries.bulkAdd(entries)
  }
}

// ===== PaymentRecord =====

export async function getPaymentsByItem(itemId: string): Promise<PaymentRecord[]> {
  return db.paymentRecords.where('itemId').equals(itemId).toArray()
}

export async function createPayment(data: Omit<PaymentRecord, 'id'>): Promise<string> {
  const id = crypto.randomUUID()
  await db.paymentRecords.add({ ...data, id })
  return id
}

export async function deletePayment(id: string): Promise<void> {
  await db.paymentRecords.delete(id)
}

/**
 * 通过 batchId 批量删除大套购结算关联的 PaymentRecord
 */
export async function deletePaymentsByBatch(batchId: string): Promise<void> {
  await db.paymentRecords.where('batchId').equals(batchId).delete()
}

/**
 * 确认收货时，自动为平台保价退款（即时到账）创建收款记录
 * 平台保价的 dueRule 为"即时"，确认收货即视为已到账
 */
export async function autoCollectPlatformRefunds(itemId: string, entries: CashbackEntry[], confirmDate: string): Promise<void> {
  const platformRefunds = entries.filter(e => e.type === 'platform_refund' && e.amount > 0)
  for (const refund of platformRefunds) {
    await createPayment({
      itemId,
      date: confirmDate,
      amount: refund.amount,
      payer: '店铺',
    })
  }
}

// ===== SettlementBatch =====

export async function getBatchesByActivity(activityId: string): Promise<SettlementBatch[]> {
  return db.settlementBatches.where('activityId').equals(activityId).toArray()
}

export async function createBatch(data: Omit<SettlementBatch, 'id'>): Promise<string> {
  const id = crypto.randomUUID()
  await db.settlementBatches.add({ ...data, id })
  return id
}

export async function deleteBatch(id: string): Promise<void> {
  await db.settlementBatches.delete(id)
}

export async function updateBatch(id: string, data: Partial<SettlementBatch>): Promise<void> {
  await db.settlementBatches.update(id, data)
}

/**
 * 撤销大套购结算批次：回退 big_purchase 条目为预估 + 删除所有关联 PaymentRecord + 删除批次
 */
export async function undoSettlementBatch(
  batchId: string,
  estimateRate: number,
): Promise<void> {
  const batch = await db.settlementBatches.get(batchId)
  if (!batch) return
  for (const alloc of batch.allocations) {
    const entries = await getEntriesByItem(alloc.itemId)
    const bp = entries.find(e => e.type === 'big_purchase')
    if (bp) {
      const item = await getItem(alloc.itemId)
      const estimate = Math.round((item?.price ?? 0) * estimateRate * 100) / 100
      await updateEntry(bp.id, { isEstimated: true, amount: estimate })
    }
  }
  await deletePaymentsByBatch(batchId)
  await deleteBatch(batchId)
}

// ===== Composite helpers =====

export async function getItemWithDetails(itemId: string) {
  const item = await getItem(itemId)
  if (!item) return null
  const entries = await getEntriesByItem(itemId)
  const payments = await getPaymentsByItem(itemId)
  return { item, entries, payments }
}
