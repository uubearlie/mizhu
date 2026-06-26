<template>
  <div class="pending">
    <van-nav-bar title="待返清单" />

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

    <!-- 列表 -->
    <div v-else class="content">
      <div class="activity-bar">
        <van-icon name="shop-o" />
        <span>{{ currentActivity.name }}</span>
      </div>

      <van-tabs v-model:active="activeTab" sticky>
        <!-- Tab 1: 订单返现 -->
        <van-tab title="订单返现">
          <div v-if="waitingList.length === 0" class="empty-tip">暂无等待到账的返现</div>
          <div
            v-for="w in waitingList"
            :key="w.item.id"
            class="pending-card"
          >
            <div class="card-head">
              <span class="card-name">{{ w.item.name }}</span>
              <van-tag v-if="w.tag" :type="w.tag.type" round size="medium">
                {{ w.tag.text }}
              </van-tag>
            </div>
            <div class="card-info">
              <span>
                店铺
                <span class="amt amt-store">¥{{ fmt(w.calc.storePending) }}</span>
              </span>
              <span>
                迷住
                <span class="amt amt-mizhu">¥{{ fmt(w.calc.mizhuPending) }}</span>
              </span>
              <span class="due-date">应到 {{ fmtDate(w.dueDate) }}</span>
            </div>
            <div class="card-actions">
              <van-button size="small" type="success" icon="gold-pay-o" @click="openPopup(w)">
                收到返现
              </van-button>
            </div>
          </div>
        </van-tab>

        <!-- Tab 2: 大套购 -->
        <van-tab :title="`大套购${bigItems.length > 0 ? ' ' + bigItems.length : ''}`">
          <!-- 可结算 -->
          <div v-if="settledBigItems.length > 0" class="big-section">
            <div class="big-section-title text-green">✅ 可结算（{{ settledBigItems.length }}）</div>
            <div
              v-for="b in settledBigItems"
              :key="b.item.id"
              class="pending-card big-card"
            >
              <div class="card-head">
                <span class="card-name">{{ b.item.name }}</span>
                <van-tag type="success" round size="medium">可结算</van-tag>
              </div>
              <div class="card-info">
                <span>下单 <span class="amt">¥{{ fmt(b.item.price) }}</span></span>
                <span>预估返 <span class="amt amt-red">¥{{ fmt(b.amount) }}</span></span>
              </div>
            </div>
          </div>

          <!-- 不可结算 -->
          <div v-if="unsettledBigItems.length > 0" class="big-section">
            <div class="big-section-title text-gray">🔒 返现未到账（{{ unsettledBigItems.length }}）</div>
            <div
              v-for="b in unsettledBigItems"
              :key="b.item.id"
              class="pending-card big-card big-card--disabled"
            >
              <div class="card-head">
                <span class="card-name">{{ b.item.name }}</span>
                <van-tag type="warning" plain round size="medium">待到账</van-tag>
              </div>
              <div class="card-info">
                <span>下单 <span class="amt">¥{{ fmt(b.item.price) }}</span></span>
                <span>预估返 <span class="amt amt-red">¥{{ fmt(b.amount) }}</span></span>
              </div>
              <div class="big-hint">店铺待返 ¥{{ fmt(b.storePending) }}，迷住待返 ¥{{ fmt(b.mizhuPending) }}</div>
            </div>
          </div>

          <div v-if="bigItems.length === 0" class="empty-tip">暂无待结算商品</div>

          <div v-if="bigItems.length > 0" class="card-actions" style="padding: 12px 0;">
            <van-button size="small" type="warning" icon="balance-o" @click="goSettlement">
              前往结算
            </van-button>
          </div>
        </van-tab>
      </van-tabs>
    </div>

    <!-- 收到返现弹窗 -->
    <van-popup
      v-model:show="showPopup"
      position="bottom"
      round
      closeable
      close-icon-position="top-left"
      :style="{ maxHeight: '85%' }"
    >
      <div v-if="popupData" class="popup-body">
        <div class="popup-title">💰 收到返现 · {{ popupData.item.name }}</div>

        <!-- 待返金额 -->
        <div class="pending-summary">
          <div class="summary-item clickable" @click="fillPayment('店铺')">
            <div class="summary-label">店铺待返</div>
            <div class="summary-amt text-red">¥{{ fmt(popupData.calc.storePending) }}</div>
          </div>
          <div class="summary-divider" />
          <div class="summary-item clickable" @click="fillPayment('迷住')">
            <div class="summary-label">迷住待返</div>
            <div class="summary-amt text-red">¥{{ fmt(popupData.calc.mizhuPending) }}</div>
          </div>
        </div>

        <!-- 本次收款 -->
        <div class="section-title">本次收款</div>
        <van-field
          v-model="payAmount"
          type="number"
          label="收款金额"
          placeholder="0.00"
        >
          <template #prefix><span class="text-gray">¥</span></template>
        </van-field>

        <div class="payer-row">
          <span class="payer-label">付款方</span>
          <van-radio-group v-model="payPayer" direction="horizontal">
            <van-radio name="店铺">店铺</van-radio>
            <van-radio name="迷住">迷住</van-radio>
          </van-radio-group>
        </div>

        <van-button
          type="primary"
          block
          class="confirm-btn"
          :loading="submitting"
          @click="confirmPayment"
        >
          确认收款
        </van-button>

        <!-- 返现记录 -->
        <div class="section-title">返现记录</div>
        <div v-if="popupPayments.length === 0" class="empty-tip">暂无返现记录</div>
        <div v-for="r in popupPayments" :key="r.id" class="record-row">
          <div class="record-left">
            <span class="record-date">{{ fmtDate(r.date) }}</span>
            <van-tag :type="r.payer === '店铺' ? 'danger' : r.payer === '迷住' ? 'success' : 'warning'" plain>
              {{ r.payer }}
            </van-tag>
          </div>
          <div class="record-right">
            <span class="record-amt">¥{{ fmt(r.amount) }}</span>
            <van-button
              size="mini"
              type="danger"
              plain
              icon="delete-o"
              @click="removePayment(r.id)"
            >
              删除
            </van-button>
          </div>
        </div>

        <!-- 累计已返 -->
        <div class="popup-footer">
          <span class="footer-label">累计已返</span>
          <span class="footer-amt">¥{{ fmt(popupTotalPaid) }}</span>
        </div>
      </div>
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { showToast, showConfirmDialog, showSuccessToast } from 'vant'
import type { Activity, Item, CashbackEntry, PaymentRecord, Payer } from '@/types'
import { ENTRY_TYPE_MAP, BIG_PURCHASE_ESTIMATE_RATE } from '@/types'
import {
  getAllActivities,
  getItemsByActivity,
  getEntriesByItem,
  getPaymentsByItem,
  createPayment,
  deletePayment,
  undoSettlementBatch,
} from '@/db/crud'
import { calcItem, type ItemCalc } from '@/calc/aggregate'
import { parseToYuan } from '@/calc/money'

const router = useRouter()

const STORAGE_KEY = 'mizhu_current_activity_id'

// ---- State ----

const loading = ref(true)
const activities = ref<Activity[]>([])
const currentActivityId = ref<string | null>(null)
const activeTab = ref(0)

interface WaitingItem {
  item: Item
  entries: CashbackEntry[]
  payments: PaymentRecord[]
  calc: ItemCalc
  dueDate: string | null
  tag: { text: string; type: 'danger' | 'warning' | 'primary' } | null
}
const waitingList = ref<WaitingItem[]>([])

// 大套购待结算（仅预估中的 big_purchase 条目）
interface BigItem {
  item: Item
  amount: number
  storePending: number
  mizhuPending: number
  canSettle: boolean
}
const bigItems = ref<BigItem[]>([])

// 弹窗
const showPopup = ref(false)
const popupItemId = ref<string | null>(null)
const payAmount = ref('')
const payPayer = ref<Payer>('店铺')
const submitting = ref(false)

// ---- Computed ----

const currentActivity = computed(
  () => activities.value.find(a => a.id === currentActivityId.value) ?? null,
)

const settledBigItems = computed(() => bigItems.value.filter(b => b.canSettle))
const unsettledBigItems = computed(() => bigItems.value.filter(b => !b.canSettle))

const popupData = computed(() =>
  waitingList.value.find(w => w.item.id === popupItemId.value) ?? null,
)

const popupPayments = computed<PaymentRecord[]>(() => {
  const sorted = [...(popupData.value?.payments ?? [])]
  return sorted.sort((a, b) => (a.date < b.date ? 1 : -1))
})

const popupTotalPaid = computed(() => {
  const p = popupData.value
  return p ? r2(p.calc.storePaid + p.calc.mizhuPaid + p.calc.bigPurchasePaid) : 0
})

// ---- Helpers ----

const r2 = (n: number) => Math.round(n * 100) / 100
const fmt = (n: number) => n.toFixed(2)

function fmtDate(d: string | null): string {
  if (!d) return '—'
  const parts = d.slice(0, 10).split('-')
  if (parts.length < 3) return d
  return `${parts[1]}/${parts[2]}`
}

/** 计算某条目应到日期（与 Home 页一致：优先 entry.dueDate，否则按规则推算） */
function computeDueDate(entry: CashbackEntry, item: Item): string | null {
  if (entry.dueDate) return entry.dueDate
  if (!item.confirmDate) return null // 未确认收货，不参与倒计时
  const rule = ENTRY_TYPE_MAP[entry.type].dueRule
  if (rule === '即时') return item.confirmDate
  if (rule === '收货+14天') {
    const d = new Date(item.confirmDate)
    d.setDate(d.getDate() + 14)
    return d.toISOString().slice(0, 10)
  }
  return null
}

function daysFromToday(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(dateStr.slice(0, 10))
  if (isNaN(d.getTime())) return NaN
  d.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - today.getTime()) / 86_400_000)
}

function dueTag(dueDate: string | null): WaitingItem['tag'] {
  if (!dueDate) return null
  const diff = daysFromToday(dueDate)
  if (isNaN(diff)) return null
  if (diff < 0) return { text: `已超${-diff}天`, type: 'danger' }
  if (diff === 0) return { text: '今天到期', type: 'warning' }
  if (diff <= 3) return { text: `还剩${diff}天`, type: 'warning' }
  return { text: `还剩${diff}天`, type: 'primary' }
}

// ---- Methods ----

async function loadData() {
  const aid = currentActivityId.value
  if (!aid) {
    waitingList.value = []
    bigItems.value = []
    return
  }

  // 仅待返现商品，不含待收货
  const items = (await getItemsByActivity(aid)).filter(i => i.status === '待返现')

  const waiting: WaitingItem[] = []
  const big: BigItem[] = []

  for (const item of items) {
    const entries = await getEntriesByItem(item.id)
    const payments = await getPaymentsByItem(item.id)
    const calc = calcItem(item, entries, payments)

    // 大套购待结算：存在预估中的 big_purchase 条目
    const bp = entries.find(e => e.type === 'big_purchase' && e.isEstimated)
    if (bp && bp.amount > 0) {
      big.push({
        item,
        amount: bp.amount,
        storePending: calc.storePending,
        mizhuPending: calc.mizhuPending,
        canSettle: calc.storePending <= 0 && calc.mizhuPending <= 0,
      })
    }

    // 等待到账：存在带应到日期的非大套购条目，且店铺/迷住仍有待返
    const pending = calc.storePending + calc.mizhuPending
    if (pending <= 0) continue
    const dueDates = entries
      .filter(e => e.type !== 'big_purchase')
      .map(e => computeDueDate(e, item))
      .filter((d): d is string => !!d)
    if (dueDates.length === 0) continue

    // 取最晚应到日期作为「等待到账」的代表日期
    dueDates.sort()
    const dueDate = dueDates[dueDates.length - 1]

    waiting.push({ item, entries, payments, calc, dueDate, tag: dueTag(dueDate) })
  }

  // 按应到日期升序
  waiting.sort((a, b) => {
    if (!a.dueDate) return 1
    if (!b.dueDate) return -1
    return a.dueDate < b.dueDate ? -1 : 1
  })

  waitingList.value = waiting
  bigItems.value = big
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

function openPopup(w: WaitingItem) {
  popupItemId.value = w.item.id
  payAmount.value = ''
  payPayer.value = '店铺'
  showPopup.value = true
}

function fillPayment(payer: Payer) {
  if (!popupData.value) return
  const pending = payer === '店铺'
    ? popupData.value.calc.storePending
    : popupData.value.calc.mizhuPending
  payPayer.value = payer
  payAmount.value = pending > 0 ? String(pending) : ''
}

async function confirmPayment() {
  const id = popupItemId.value
  if (!id) return
  const amount = parseToYuan(payAmount.value)
  if (amount <= 0) {
    showToast('请输入有效金额')
    return
  }
  // 校验：收款金额不得超过对应付款方的待返金额
  if (popupData.value) {
    const pending = payPayer.value === '店铺'
      ? popupData.value.calc.storePending
      : popupData.value.calc.mizhuPending
    if (amount > pending) {
      showToast(`${payPayer.value}待返仅剩 ¥${pending.toFixed(2)}，不可超额收款`)
      return
    }
  }
  submitting.value = true
  try {
    await createPayment({
      itemId: id,
      date: new Date().toISOString().slice(0, 10),
      amount,
      payer: payPayer.value,
    })
    payAmount.value = ''
    showToast({ type: 'success', message: '收款已记录' })
    await loadData()
  } finally {
    submitting.value = false
  }
}

async function removePayment(paymentId: string) {
  const payment = popupPayments.value.find(p => p.id === paymentId)
  if (payment?.batchId) {
    try {
      await showConfirmDialog({
        title: '删除确认',
        message: '该返现记录属于大套购结算批次，将同时撤销该批次的所有结算记录，确定删除？',
      })
    } catch {
      return
    }
    await undoSettlementBatch(payment.batchId, BIG_PURCHASE_ESTIMATE_RATE)
    showSuccessToast('已撤销结算批次')
  } else {
    await deletePayment(paymentId)
    showToast('已删除')
  }
  await loadData()
}

function goSettlement() {
  router.push({ name: 'settlement' })
}

watch(currentActivityId, () => {
  loadData()
})

onMounted(init)
</script>

<style scoped>
.pending {
  min-height: 100vh;
  background: #f7f8fa;
  padding-bottom: calc(50px + env(safe-area-inset-bottom));
}

.loading-wrap {
  display: flex;
  justify-content: center;
  padding: 60px 0;
}

.activity-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  font-size: 13px;
  color: #969799;
}

.group-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
}

.empty-tip {
  text-align: center;
  color: #c8c9cc;
  font-size: 13px;
  padding: 16px 0;
}

.big-section {
  margin-bottom: 12px;
}

.big-section-title {
  font-size: 14px;
  font-weight: 600;
  padding: 12px 0 8px;
}

.big-section-title.text-green {
  color: #07c160;
}

.big-section-title.text-gray {
  color: #969799;
}

.big-card--disabled {
  opacity: 0.65;
}

.big-hint {
  font-size: 12px;
  color: #ee0a24;
  margin-top: 4px;
}

.pending-card {
  background: #fff;
  border-radius: 14px;
  padding: 14px;
  margin-bottom: 10px;
  box-shadow: var(--mz-shadow, 0 2px 12px rgba(91, 141, 239, 0.06));
  border: 1px solid var(--mz-border, #eef0f3);
}

.card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-name {
  font-size: 15px;
  font-weight: 600;
  color: #323233;
}

.card-info {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin-top: 8px;
  font-size: 13px;
  color: #969799;
}

.amt {
  font-weight: 600;
}
.amt-store {
  color: #ee0a24;
}
.amt-mizhu {
  color: #07c160;
}
.amt-red {
  color: #ee0a24;
}

.due-date {
  color: #969799;
}

.card-actions {
  margin-top: 10px;
  display: flex;
  justify-content: flex-end;
}

/* Popup */
.popup-body {
  padding: 20px 16px calc(16px + env(safe-area-inset-bottom));
}

.popup-title {
  text-align: center;
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 14px;
}

.pending-summary {
  display: flex;
  align-items: center;
  justify-content: space-around;
  background: #f7f8fa;
  border-radius: 8px;
  padding: 14px 0;
  margin-bottom: 16px;
}

.summary-item {
  text-align: center;
}

.summary-item.clickable {
  cursor: pointer;
  transition: opacity 0.15s;
}

.summary-item.clickable:active {
  opacity: 0.6;
}

.summary-label {
  font-size: 12px;
  color: #969799;
  margin-bottom: 4px;
}

.summary-amt {
  font-size: 18px;
  font-weight: 700;
}

.summary-divider {
  width: 1px;
  height: 32px;
  background: #ebedf0;
}

.text-red {
  color: #ee0a24;
}
.text-gray {
  color: #969799;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #323233;
  margin: 4px 0 8px;
}

.payer-row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 0;
}

.payer-label {
  font-size: 14px;
  color: #646566;
  width: 64px;
}

.confirm-btn {
  margin-top: 8px;
}

.record-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid #ebedf0;
}

.record-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.record-date {
  font-size: 13px;
  color: #969799;
}

.record-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.record-amt {
  font-size: 15px;
  font-weight: 600;
  color: #323233;
}

.popup-footer {
  display: flex;
  justify-content: center;
  align-items: baseline;
  gap: 8px;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid #ebedf0;
}

.footer-label {
  font-size: 14px;
  color: #969799;
}

.footer-amt {
  font-size: 20px;
  font-weight: 700;
  color: #ee0a24;
}
</style>
