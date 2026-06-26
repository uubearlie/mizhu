<template>
  <div class="settlement">
    <van-nav-bar
      title="大套购结算"
      left-arrow
      @click-left="router.back()"
    />

    <!-- 加载中 -->
    <div v-if="loading" class="loading-wrap">
      <van-loading type="spinner" />
    </div>

    <!-- 无活动 -->
    <van-empty
      v-else-if="!currentActivity"
      description="请先创建活动"
    >
      <van-button type="primary" size="small" @click="router.push('/activity-form')">
        新建活动
      </van-button>
    </van-empty>

    <div v-else class="content">
      <!-- 规则展示区 -->
      <div class="rules-box">
        <div class="rules-title">📋 返现规则</div>
        <div v-for="(r, i) in rules" :key="i" class="rules-line">
          满 ¥{{ fmtThousands(r.threshold) }} 返 ¥{{ fmtThousands(r.cashback) }}
        </div>
      </div>

      <!-- 未结算订单选择列表 -->
      <div class="section-label">未结算订单（{{ unsettledItems.length }}）</div>
      <div v-if="unsettledItems.length === 0" class="empty-tip">
        暂无未结算的大套购订单
      </div>
      <van-checkbox-group v-else v-model="selectedIds" class="order-list">
        <div
          v-for="u in unsettledItems"
          :key="u.item.id"
          class="order-item"
          :class="{ 'order-item--active': selectedIds.includes(u.item.id) }"
          @click="toggleSelect(u.item.id)"
        >
          <van-checkbox
            :name="u.item.id"
            shape="square"
            :model-value="selectedIds.includes(u.item.id)"
            @click.stop
          />
          <div class="order-info">
            <div class="order-name">{{ u.item.name }}</div>
            <div class="order-price">¥{{ fmt(u.item.price) }}</div>
          </div>
        </div>
      </van-checkbox-group>

      <!-- 本批总额 -->
      <div v-if="unsettledItems.length > 0" class="batch-total">
        <span class="batch-total-label">本批总额</span>
        <span class="batch-total-amt">¥{{ fmt(batchTotal) }}</span>
      </div>

      <!-- 预览计算区域 -->
      <div v-if="preview" class="preview-box">
        <div class="preview-title">📐 预览计算</div>
        <div class="preview-line">
          <span>本批总额</span>
          <span>¥{{ fmt(preview.totalAmount) }}</span>
        </div>
        <div class="preview-line">
          <span>本批返现</span>
          <span class="text-bold text-red">¥{{ fmt(preview.totalCashback) }}</span>
        </div>
        <div class="preview-divider" />
        <div
          v-for="u in selectedItemsData"
          :key="u.item.id"
          class="preview-line"
        >
          <span class="alloc-name">{{ u.item.name }}</span>
          <span class="text-bold">¥{{ fmt(allocationMap.get(u.item.id) ?? 0) }}</span>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div v-if="unsettledItems.length > 0" class="btn-row">
        <van-button
          type="primary"
          block
          round
          :disabled="selectedIds.length === 0"
          :loading="settling"
          @click="confirmSettle"
        >
          确认结算（{{ selectedIds.length }}）
        </van-button>
        <van-button
          type="success"
          block
          round
          :loading="settling"
          @click="settleAll"
        >
          全部结算
        </van-button>
      </div>

      <!-- 结算记录 -->
      <div class="section-label">📜 结算记录（{{ batches.length }}）</div>
      <div v-if="batches.length === 0" class="empty-tip">
        暂无结算记录
      </div>
      <van-collapse v-else v-model="activeBatchNames" class="batch-collapse">
        <van-collapse-item
          v-for="(b, idx) in batches"
          :key="b.id"
          :name="b.id"
        >
          <template #title>
            <div class="batch-head">
              <span class="batch-head-label">
                第{{ batches.length - idx }}批 · {{ fmtDate(b.date) }} · {{ b.allocations.length }}件
              </span>
              <span class="batch-head-amt">¥{{ fmt(b.totalCashback) }}</span>
            </div>
          </template>

          <div class="batch-detail">
            <div class="detail-line">
              <span>本批总额</span>
              <span>¥{{ fmt(b.totalAmount) }}</span>
            </div>
            <div class="detail-line">
              <span>返现金额</span>
              <span class="text-red text-bold">¥{{ fmt(b.totalCashback) }}</span>
            </div>
            <div class="preview-divider" />
            <div
              v-for="a in b.allocations"
              :key="a.itemId"
              class="detail-line"
            >
              <span class="alloc-name">{{ itemMap.get(a.itemId)?.name ?? '已删除' }}</span>
              <span class="text-bold">¥{{ fmt(a.amount) }}</span>
            </div>
            <div class="batch-actions">
              <van-button
                size="small"
                plain
                type="danger"
                icon="revoke"
                :loading="undoingId === b.id"
                @click.stop="undoBatch(b)"
              >
                撤销结算
              </van-button>
            </div>
          </div>
        </van-collapse-item>
      </van-collapse>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { showToast, showConfirmDialog } from 'vant'
import type { Activity, Item, CashbackEntry, SettlementBatch, BigPurchaseRule } from '@/types'
import { BIG_PURCHASE_ESTIMATE_RATE } from '@/types'
import {
  getAllActivities,
  getItemsByActivity,
  getEntriesByItem,
  getPaymentsByItem,
  getBatchesByActivity,
  createBatch,
  deleteBatch,
  createPayment,
  deletePayment,
  updateEntry,
} from '@/db/crud'
import { previewSettlement } from '@/calc/bigPurchase'

const router = useRouter()
const STORAGE_KEY = 'mizhu_current_activity_id'

// ---- State ----

const loading = ref(true)
const settling = ref(false)
const undoingId = ref<string | null>(null)

const activities = ref<Activity[]>([])
const currentActivityId = ref<string | null>(null)

interface UnsettledItem {
  item: Item
  entries: CashbackEntry[]
  bigEntry: CashbackEntry
}
const unsettledItems = ref<UnsettledItem[]>([])
const batches = ref<SettlementBatch[]>([])
const itemMap = ref<Map<string, Item>>(new Map())

const selectedIds = ref<string[]>([])
const activeBatchNames = ref<string[]>([])

// ---- Computed ----

const currentActivity = computed(
  () => activities.value.find(a => a.id === currentActivityId.value) ?? null,
)

const rules = computed<BigPurchaseRule[]>(
  () => currentActivity.value?.bigPurchaseRules ?? [],
)

const batchTotal = computed(() =>
  r2(
    unsettledItems.value
      .filter(u => selectedIds.value.includes(u.item.id))
      .reduce((s, u) => s + u.item.price, 0),
  ),
)

const selectedItemsData = computed(() =>
  unsettledItems.value.filter(u => selectedIds.value.includes(u.item.id)),
)

const preview = computed(() => {
  if (selectedItemsData.value.length === 0) return null
  return previewSettlement(
    selectedItemsData.value.map(u => ({ id: u.item.id, price: u.item.price })),
    rules.value,
  )
})

const allocationMap = computed<Map<string, number>>(() => {
  const m = new Map<string, number>()
  for (const a of preview.value?.allocations ?? []) {
    m.set(a.itemId, a.amount)
  }
  return m
})

// ---- Helpers ----

const r2 = (n: number) => Math.round(n * 100) / 100
const fmt = (n: number) => n.toFixed(2)
const fmtThousands = (n: number) => n.toLocaleString('zh-CN')

function fmtDate(d: string): string {
  const parts = d.slice(0, 10).split('-')
  if (parts.length < 3) return d
  return `${parts[1]}/${parts[2]}`
}

function toggleSelect(id: string) {
  const i = selectedIds.value.indexOf(id)
  if (i >= 0) {
    selectedIds.value.splice(i, 1)
  } else {
    selectedIds.value.push(id)
  }
}

// ---- Data loading ----

async function loadData() {
  const aid = currentActivityId.value
  if (!aid) {
    unsettledItems.value = []
    batches.value = []
    itemMap.value = new Map()
    return
  }

  const allItems = await getItemsByActivity(aid)
  const iMap = new Map<string, Item>()
  for (const it of allItems) iMap.set(it.id, it)
  itemMap.value = iMap

  // 未结算：存在预估中的 big_purchase 条目（排除已取消的）
  const unsettled: UnsettledItem[] = []
  for (const item of allItems) {
    if (item.status === '已取消') continue
    const entries = await getEntriesByItem(item.id)
    const bp = entries.find(e => e.type === 'big_purchase' && e.isEstimated)
    if (bp) {
      unsettled.push({ item, entries, bigEntry: bp })
    }
  }
  unsettledItems.value = unsettled

  // 默认全选
  selectedIds.value = unsettled.map(u => u.item.id)

  // 结算批次（按日期降序，最新的在最前）
  const allBatches = await getBatchesByActivity(aid)
  allBatches.sort((a, b) => (a.date < b.date ? 1 : -1))
  batches.value = allBatches
}

async function init() {
  loading.value = true
  try {
    activities.value = await getAllActivities()
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && activities.value.some(a => a.id === stored)) {
      currentActivityId.value = stored
    } else if (activities.value.length > 0) {
      currentActivityId.value = activities.value[0].id
      localStorage.setItem(STORAGE_KEY, activities.value[0].id)
    } else {
      currentActivityId.value = null
    }
    await loadData()
  } finally {
    loading.value = false
  }
}

// ---- 结算 ----

async function doSettlement(itemIds: string[]) {
  const aid = currentActivityId.value
  if (!aid) return

  const targets = unsettledItems.value.filter(u => itemIds.includes(u.item.id))
  if (targets.length === 0) {
    showToast('请选择要结算的商品')
    return
  }

  const { totalAmount, totalCashback, allocations } = previewSettlement(
    targets.map(u => ({ id: u.item.id, price: u.item.price })),
    rules.value,
  )

  const today = new Date().toISOString().slice(0, 10)

  // 1. 创建批次
  await createBatch({ activityId: aid, date: today, totalAmount, totalCashback, allocations })

  // 2. 回写每个商品的 big_purchase 条目（锁定为分摊金额）+ 生成 PaymentRecord
  for (const alloc of allocations) {
    const u = targets.find(t => t.item.id === alloc.itemId)
    if (!u) continue
    if (u.bigEntry) {
      await updateEntry(u.bigEntry.id, { isEstimated: false, amount: alloc.amount })
    }
    await createPayment({
      itemId: alloc.itemId,
      date: today,
      amount: alloc.amount,
      payer: '迷住',
    })
  }

  showToast({ type: 'success', message: '结算成功' })
  selectedIds.value = []
  await loadData()
}

async function confirmSettle() {
  if (selectedIds.value.length === 0) {
    showToast('请选择要结算的商品')
    return
  }
  settling.value = true
  try {
    await doSettlement([...selectedIds.value])
  } finally {
    settling.value = false
  }
}

async function settleAll() {
  const allIds = unsettledItems.value.map(u => u.item.id)
  if (allIds.length === 0) {
    showToast('暂无可结算的商品')
    return
  }
  settling.value = true
  try {
    await doSettlement(allIds)
  } finally {
    settling.value = false
  }
}

// ---- 撤销 ----

async function undoBatch(batch: SettlementBatch) {
  try {
    await showConfirmDialog({
      title: '撤销结算',
      message: `确定撤销第${batches.value.length - batches.value.indexOf(batch)}批结算？\n相关商品的返现将恢复为预估状态。`,
    })
  } catch {
    return // 用户取消
  }

  undoingId.value = batch.id
  try {
    // 1. 回退每个商品的 big_purchase 条目 + 删除对应 PaymentRecord
    for (const alloc of batch.allocations) {
      const item = itemMap.value.get(alloc.itemId)
      const entries = await getEntriesByItem(alloc.itemId)
      const bp = entries.find(e => e.type === 'big_purchase')
      if (bp) {
        const estimate = r2((item?.price ?? 0) * BIG_PURCHASE_ESTIMATE_RATE)
        await updateEntry(bp.id, { isEstimated: true, amount: estimate })
      }
      // 找到结算时生成的 PaymentRecord 并删除
      const payments = await getPaymentsByItem(alloc.itemId)
      const payment = payments.find(p => p.payer === '迷住' && p.amount === alloc.amount)
      if (payment) {
        await deletePayment(payment.id)
      }
    }

    // 2. 删除批次
    await deleteBatch(batch.id)

    showToast('已撤销结算')
    await loadData()
  } finally {
    undoingId.value = null
  }
}

// ---- 生命周期 ----

watch(currentActivityId, () => {
  loadData()
})

onMounted(init)
</script>

<style scoped>
.settlement {
  min-height: 100vh;
  background: #f7f8fa;
  padding-bottom: calc(24px + env(safe-area-inset-bottom));
}

.loading-wrap {
  display: flex;
  justify-content: center;
  padding: 60px 0;
}

.content {
  padding: 12px;
}

/* 规则展示区 */
.rules-box {
  background: #fffbe8;
  border: 1px solid #ffe58f;
  border-radius: 10px;
  padding: 14px 16px;
  margin-bottom: 12px;
}

.rules-title {
  font-size: 14px;
  font-weight: 600;
  color: #8c6d1f;
  margin-bottom: 6px;
}

.rules-line {
  font-size: 13px;
  color: #8c6d1f;
  line-height: 1.8;
}

/* 分区标题 */
.section-label {
  font-size: 13px;
  color: #969799;
  font-weight: 500;
  padding: 4px 4px 8px;
}

.empty-tip {
  text-align: center;
  color: #c8c9cc;
  font-size: 13px;
  padding: 20px 0;
  background: #fff;
  border-radius: 10px;
  margin-bottom: 12px;
}

/* 订单选择列表 */
.order-list {
  background: #fff;
  border-radius: 10px 10px 0 0;
  overflow: hidden;
}

.order-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid #f2f3f5;
  transition: background 0.15s;
}

.order-item:last-child {
  border-bottom: none;
}

.order-item--active {
  background: #f0f9ff;
}

.order-info {
  flex: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.order-name {
  font-size: 15px;
  font-weight: 500;
  color: #323233;
}

.order-price {
  font-size: 15px;
  font-weight: 600;
  color: #323233;
}

/* 本批总额 */
.batch-total {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #fff;
  border-radius: 0 0 10px 10px;
  padding: 14px 16px;
  margin-bottom: 12px;
}

.batch-total-label {
  font-size: 14px;
  color: #646566;
}

.batch-total-amt {
  font-size: 22px;
  font-weight: 700;
  color: #ee0a24;
}

/* 预览计算区域 */
.preview-box {
  background: #e8f3ff;
  border: 1px solid #a3c8f0;
  border-radius: 10px;
  padding: 14px 16px;
  margin-bottom: 12px;
}

.preview-title {
  font-size: 14px;
  font-weight: 600;
  color: #1989fa;
  margin-bottom: 10px;
}

.preview-line {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
  color: #323233;
  padding: 4px 0;
}

.alloc-name {
  color: #646566;
  max-width: 60%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview-divider {
  height: 1px;
  background: #c4daf5;
  margin: 6px 0;
}

.text-bold {
  font-weight: 600;
}

.text-red {
  color: #ee0a24;
}

/* 操作按钮 */
.btn-row {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.btn-row .van-button {
  flex: 1;
}

/* 结算记录 */
.batch-collapse {
  background: #fff;
  border-radius: 10px;
  overflow: hidden;
}

.batch-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.batch-head-label {
  font-size: 14px;
  font-weight: 500;
  color: #323233;
}

.batch-head-amt {
  font-size: 15px;
  font-weight: 700;
  color: #ee0a24;
  margin-right: 8px;
}

.batch-detail {
  padding: 4px 0;
}

.detail-line {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  color: #646566;
  padding: 5px 0;
}

.batch-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 10px;
}
</style>
