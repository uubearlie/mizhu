import Dexie, { type Table } from 'dexie'
import type { Activity, Item, CashbackEntry, PaymentRecord, SettlementBatch } from '@/types'

export class MizhuDB extends Dexie {
  activities!: Table<Activity, string>
  items!: Table<Item, string>
  cashbackEntries!: Table<CashbackEntry, string>
  paymentRecords!: Table<PaymentRecord, string>
  settlementBatches!: Table<SettlementBatch, string>

  constructor() {
    super('mizhu_db')

    // v2: 初始 schema
    this.version(2).stores({
      activities: 'id, name, status, createdAt',
      items: 'id, activityId, status, channel, orderNo, isDeleted',
      cashbackEntries: 'id, itemId, type',
      paymentRecords: 'id, itemId, payer',
      settlementBatches: 'id, activityId, date',
    })

    // v3: paymentRecords 增加 batchId 索引
    this.version(3).stores({
      activities: 'id, name, status, createdAt',
      items: 'id, activityId, status, channel, orderNo, isDeleted',
      cashbackEntries: 'id, itemId, type',
      paymentRecords: 'id, itemId, payer, batchId',
      settlementBatches: 'id, activityId, date',
    })

    // v4: big_purchase 的 payer 从 '迷住' 改为 '大套购'
    // 需要将已有的 big_purchase 结算 PaymentRecord 的 payer 迁移
    this.version(4).stores({
      activities: 'id, name, status, createdAt',
      items: 'id, activityId, status, channel, orderNo, isDeleted',
      cashbackEntries: 'id, itemId, type',
      paymentRecords: 'id, itemId, payer, batchId',
      settlementBatches: 'id, activityId, date',
    }).upgrade(async (tx) => {
      // 遍历所有 paymentRecords，将大套购结算的迷住 payment 改为大套购
      const payments = await tx.table('paymentRecords').toArray()
      for (const p of payments) {
        if (p.payer === '迷住') {
          // 检查是否属于大套购结算（通过关联 item 的 big_purchase entry 判断）
          const entries = await tx.table('cashbackEntries')
            .where('itemId').equals(p.itemId).toArray()
          const bp = entries.find((e: CashbackEntry) => e.type === 'big_purchase' && !e.isEstimated)
          if (bp && bp.amount === p.amount) {
            await tx.table('paymentRecords').update(p.id, { payer: '大套购' })
          }
        }
      }
    })
  }
}

export const db = new MizhuDB()
