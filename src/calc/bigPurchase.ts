import type { BigPurchaseRule, SettlementAllocation, Item } from '@/types'

/**
 * 大套购分档拆分算法（档位不共享）
 * 金额按从高到低的档位依次消耗
 */
export function calcBigPurchaseTotal(amount: number, rules: BigPurchaseRule[]): number {
  const sortedRules = [...rules].sort((a, b) => b.threshold - a.threshold)
  let remaining = amount
  let totalCashback = 0

  for (const rule of sortedRules) {
    if (remaining >= rule.threshold) {
      const count = Math.floor(remaining / rule.threshold)
      totalCashback += count * rule.cashback
      remaining = remaining % rule.threshold
    }
  }

  return totalCashback
}

/**
 * 大套购按比例分摊
 */
export function allocateBigPurchase(
  items: Pick<Item, 'id' | 'price'>[],
  totalCashback: number,
  totalAmount: number,
): SettlementAllocation[] {
  if (totalAmount === 0) return []

  return items.map(item => ({
    itemId: item.id,
    amount: Math.round((totalCashback * (item.price / totalAmount)) * 100) / 100,
  }))
}

/**
 * 预览计算：选择部分订单后的预览
 */
export function previewSettlement(
  items: Pick<Item, 'id' | 'price'>[],
  rules: BigPurchaseRule[],
): { totalAmount: number; totalCashback: number; allocations: SettlementAllocation[] } {
  const totalAmount = items.reduce((sum, item) => sum + item.price, 0)
  const totalCashback = calcBigPurchaseTotal(totalAmount, rules)
  const allocations = allocateBigPurchase(items, totalCashback, totalAmount)
  return { totalAmount, totalCashback, allocations }
}
