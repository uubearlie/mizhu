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
    this.version(2).stores({
      activities: 'id, name, status, createdAt',
      items: 'id, activityId, status, channel, orderNo, isDeleted',
      cashbackEntries: 'id, itemId, type',
      paymentRecords: 'id, itemId, payer',
      settlementBatches: 'id, activityId, date',
    })
  }
}

export const db = new MizhuDB()
