import type { Item, CashbackEntry } from '@/types'
import { calcBrandCashback } from './cashback'
import { calcMizhuProtect } from './protect'
import { calcBigPurchaseEstimate } from './cashback'
import { ENTRY_TYPE_MAP } from '@/types'

/**
 * 计算应到日期
 */
export function calcDueDate(type: CashbackEntry['type'], confirmDate: string | null): string | null {
  if (!confirmDate) return null
  const rule = ENTRY_TYPE_MAP[type].dueRule
  if (rule === '即时') return confirmDate
  if (rule === '收货+14天') {
    const d = new Date(confirmDate)
    d.setDate(d.getDate() + 14)
    return d.toISOString().slice(0, 10)
  }
  return null // 手动结算
}

/**
 * 动态重算：每次 Item 信息更新后触发
 * 重算品牌套购、迷住保价、大套购预估的 Entry amount
 */
export function recalcDynamicEntries(item: Item, entries: CashbackEntry[]): CashbackEntry[] {
  const updated = entries.map(e => ({ ...e }))

  // Step 1: 品牌套购
  const brandEntry = updated.find(e => e.type === 'brand')
  if (item.brandCoefficient != null) {
    const newAmount = calcBrandCashback(item, updated)
    if (brandEntry) {
      brandEntry.amount = newAmount
    } else {
      updated.push({
        id: crypto.randomUUID(),
        itemId: item.id,
        type: 'brand',
        customLabel: null,
        amount: newAmount,
        dueDate: null,
        isEstimated: false,
        createdAt: new Date().toISOString(),
      })
    }
  } else {
    if (brandEntry) {
      const idx = updated.findIndex(e => e.id === brandEntry.id)
      if (idx >= 0) updated.splice(idx, 1)
    }
  }

  // Step 2: 迷住保价
  const protectEntry = updated.find(e => e.type === 'mizhu_protect')
  const protectResult = calcMizhuProtect(item, updated)
  if (item.mizhuProtectType && item.mizhuProtectPrice != null) {
    if (protectResult.refund > 0) {
      if (protectEntry) {
        protectEntry.amount = protectResult.refund
      } else {
        updated.push({
          id: crypto.randomUUID(),
          itemId: item.id,
          type: 'mizhu_protect',
          customLabel: null,
          amount: protectResult.refund,
          dueDate: null,
          isEstimated: false,
          createdAt: new Date().toISOString(),
        })
      }
    } else {
      if (protectEntry) {
        const idx = updated.findIndex(e => e.id === protectEntry.id)
        if (idx >= 0) updated.splice(idx, 1)
      }
    }
  } else {
    if (protectEntry) {
      const idx = updated.findIndex(e => e.id === protectEntry.id)
      if (idx >= 0) updated.splice(idx, 1)
    }
  }

  // Step 3: 大套购预估
  const bigPurchaseEntry = updated.find(e => e.type === 'big_purchase')
  if (bigPurchaseEntry && bigPurchaseEntry.isEstimated) {
    bigPurchaseEntry.amount = calcBigPurchaseEstimate(item.price)
  }

  return updated
}

/**
 * 确认收货时：为所有 Entry 计算 dueDate
 */
export function updateDueDates(entries: CashbackEntry[], confirmDate: string): CashbackEntry[] {
  return entries.map(e => ({
    ...e,
    dueDate: calcDueDate(e.type, confirmDate),
  }))
}

/**
 * 保存校验
 */
export function validateItem(item: Item, entries: CashbackEntry[]): string | null {
  if (!item.name) return '请输入商品名称'
  if (!item.price || item.price <= 0) return '请输入有效的下单价'

  const storeTotal = entries
    .filter(e => ENTRY_TYPE_MAP[e.type].payer === '店铺')
    .reduce((s, e) => s + e.amount, 0)
  const mizhuTotal = entries
    .filter(e => ENTRY_TYPE_MAP[e.type].payer === '迷住')
    .reduce((s, e) => s + e.amount, 0)
  const total = storeTotal + mizhuTotal

  if (total > item.price) {
    return `返现总额（¥${total.toFixed(2)}）不能超过下单价（¥${item.price.toFixed(2)}）`
  }

  const finalPrice = item.price - total
  if (finalPrice < 0) {
    return '到手价为负数，请检查返现金额'
  }

  if (item.mizhuProtectPrice && item.mizhuProtectPrice >= item.price) {
    return '迷住保价到手价应低于下单价'
  }

  return null
}
