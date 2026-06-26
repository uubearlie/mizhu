// ===== Core Enums =====

export type Payer = '店铺' | '迷住'

export type ItemStatus = '待收货' | '待返现' | '已完成' | '已取消'

export type Channel = '淘宝' | '京东' | '小程序' | '其他'

export type MizhuProtectType = '一类' | '二类' | null

export type CashbackEntryType =
  | 'platform_refund'
  | 'store_refund'
  | 'instant_cashback'
  | 'xhs_post'
  | 'combo'
  | 'other'
  | 'brand'
  | 'mizhu_extra'
  | 'captain_coupon'
  | 'renovation_coupon'
  | 'mizhu_protect'
  | 'big_purchase'

export type DueRule = '即时' | '收货+14天' | '手动结算'

// ===== Entities =====

export interface BigPurchaseRule {
  threshold: number
  cashback: number
}

export interface Activity {
  id: string
  name: string
  startDate: string | null
  endDate: string | null
  status: '进行中' | '已完结'
  bigPurchaseRules: BigPurchaseRule[]
  createdAt: string
}

export interface Item {
  id: string
  activityId: string
  name: string
  channel: Channel
  orderNo: string
  price: number
  gift: string
  remark: string
  confirmDate: string | null
  status: ItemStatus
  brandCoefficient: number | null
  mizhuProtectType: MizhuProtectType
  mizhuProtectPrice: number | null
  isDeleted: boolean
  createdAt: string
}

export interface CashbackEntry {
  id: string
  itemId: string
  type: CashbackEntryType
  customLabel: string | null
  amount: number
  dueDate: string | null
  isEstimated: boolean
  createdAt: string
}

export interface PaymentRecord {
  id: string
  itemId: string
  date: string
  amount: number
  payer: Payer
}

export interface SettlementAllocation {
  itemId: string
  amount: number
}

export interface SettlementBatch {
  id: string
  activityId: string
  date: string
  totalAmount: number
  totalCashback: number
  allocations: SettlementAllocation[]
}

// ===== Type Mappings =====

export const ENTRY_TYPE_MAP: Record<CashbackEntryType, { payer: Payer; dueRule: DueRule; label: string }> = {
  platform_refund: { payer: '店铺', dueRule: '即时', label: '平台保价退款' },
  store_refund: { payer: '店铺', dueRule: '收货+14天', label: '店铺保价退款' },
  instant_cashback: { payer: '店铺', dueRule: '收货+14天', label: '下单即返' },
  xhs_post: { payer: '店铺', dueRule: '收货+14天', label: '小红书晒单' },
  combo: { payer: '店铺', dueRule: '收货+14天', label: '组合购' },
  other: { payer: '店铺', dueRule: '收货+14天', label: '其他' },
  brand: { payer: '店铺', dueRule: '收货+14天', label: '品牌套购' },
  mizhu_extra: { payer: '迷住', dueRule: '收货+14天', label: '迷住返(加返)' },
  captain_coupon: { payer: '迷住', dueRule: '收货+14天', label: '舰长神券' },
  renovation_coupon: { payer: '迷住', dueRule: '收货+14天', label: '装修神券' },
  mizhu_protect: { payer: '迷住', dueRule: '收货+14天', label: '迷住保价' },
  big_purchase: { payer: '迷住', dueRule: '手动结算', label: '大套购分摊' },
}

// 手动固定型
export const MANUAL_ENTRY_TYPES: CashbackEntryType[] = [
  'platform_refund', 'store_refund', 'instant_cashback', 'xhs_post',
  'combo', 'other', 'mizhu_extra', 'captain_coupon', 'renovation_coupon',
]

// 店铺侧手填条目（参与品牌套购基准扣除）
export const STORE_MANUAL_TYPES: CashbackEntryType[] = [
  'instant_cashback', 'xhs_post', 'combo', 'other',
]

// 大套购预估固定比例
export const BIG_PURCHASE_ESTIMATE_RATE = 0.05
