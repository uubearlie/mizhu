<template>
  <div class="home">
    <!-- Activity switcher nav bar -->
    <van-nav-bar
      fixed
      placeholder
      @click-left="showActivityPopup = true"
    >
      <template #left>
        <span class="nav-switch">
          <van-icon name="exchange" />
          <span>切换</span>
        </span>
      </template>
      <template #title>
        <span class="nav-title-wrap" @click="showActivityPopup = true">
          {{ currentActivity?.name ?? '迷住团购管家' }}
          <van-icon
            v-if="currentActivity"
            name="edit"
            size="13"
            class="nav-edit-icon"
            @click.stop="router.push(`/activity-form?edit=1&id=${currentActivity.id}`)"
          />
        </span>
      </template>
      <template #right>
        <van-icon
          name="question-o"
          size="22"
          @click="showHelp = true"
        />
      </template>
    </van-nav-bar>

    <!-- Loading -->
    <div v-if="loading" class="loading-wrap">
      <van-loading type="spinner" />
    </div>

    <!-- Empty state -->
    <div v-else-if="activities.length === 0" class="empty-state">
      <van-empty description="还没有活动，快去创建一个吧">
        <van-button type="primary" round icon="add-o" @click="router.push('/activity-form')">
          新建活动
        </van-button>
      </van-empty>
    </div>

    <!-- Main content -->
    <div v-else-if="currentActivity" class="content">
      <!-- Overview section -->
      <div class="card overview-card-wrap">
        <div class="overview-grid">
          <div class="overview-cell">
            <div class="cell-label">累计下单</div>
            <div class="cell-value">¥{{ fmt(overview.totalOrder) }}</div>
          </div>
          <div class="overview-cell">
            <div class="cell-label">购买订单</div>
            <div class="cell-value">{{ overview.itemCount }} 件</div>
          </div>
          <div class="overview-cell">
            <div class="cell-label">已返金额</div>
            <div class="cell-value text-paid">¥{{ fmt(overview.totalPaid) }}</div>
          </div>
          <div class="overview-cell">
            <div class="cell-label">待返金额</div>
            <div class="cell-value text-pending">¥{{ fmt(overview.totalPending) }}</div>
          </div>
        </div>

        <!-- Pending breakdown -->
        <div class="pending-breakdown">
          <div class="breakdown-item">
            <span class="breakdown-item-left">
              <span class="dot dot-store" />
              <span class="breakdown-label">店铺待返</span>
            </span>
            <span class="breakdown-amount">¥{{ fmt(overview.storePending) }}</span>
          </div>
          <div class="breakdown-item">
            <span class="breakdown-item-left">
              <span class="dot dot-mizhu" />
              <span class="breakdown-label">迷住待返</span>
            </span>
            <span class="breakdown-amount">¥{{ fmt(overview.mizhuPending) }}</span>
          </div>
          <div class="breakdown-item">
            <span class="breakdown-item-left">
              <span class="dot dot-big" />
              <span class="breakdown-label">大套购待返</span>
            </span>
            <span class="breakdown-amount">¥{{ fmt(overview.bigPurchasePending) }}</span>
          </div>
        </div>

        <!-- Progress bar -->
        <div class="progress-wrap">
          <div class="progress-header">
            <span>返现进度</span>
            <span class="progress-pct">{{ overview.progressPercent }}%</span>
          </div>
          <van-progress
            :percentage="overview.progressPercent"
            stroke-width="8"
            :color="overview.progressPercent >= 100 ? '#34c759' : '#5b8def'"
            track-color="#eef0f3"
          />
        </div>
      </div>

      <!-- Pending reminders -->
      <div v-if="hasReminders" class="card reminder-section">
        <div class="section-title">待返提醒</div>
        <van-collapse v-model="activeCollapseNames">
          <van-collapse-item
            v-if="reminders.overdue.length > 0"
            name="overdue"
          >
            <template #title>
              <span class="collapse-title collapse-title--overdue">
                <van-icon name="warning-o" />
                超期待返（{{ reminders.overdue.length }}）
              </span>
            </template>
            <div
              v-for="r in reminders.overdue"
              :key="r.itemId"
              class="reminder-item"
              @click="goToItemDetail(r.itemId)"
            >
              <span class="reminder-name">{{ r.itemName }}</span>
              <span class="reminder-badge reminder-badge--overdue">已超期 {{ r.days }} 天</span>
            </div>
          </van-collapse-item>

          <van-collapse-item
            v-if="reminders.upcoming.length > 0"
            name="upcoming"
          >
            <template #title>
              <span class="collapse-title collapse-title--upcoming">
                <van-icon name="clock-o" />
                即将到期（{{ reminders.upcoming.length }}）
              </span>
            </template>
            <div
              v-for="r in reminders.upcoming"
              :key="r.itemId"
              class="reminder-item"
              @click="goToItemDetail(r.itemId)"
            >
              <span class="reminder-name">{{ r.itemName }}</span>
              <span class="reminder-badge reminder-badge--upcoming">{{ r.days }} 天后到期</span>
            </div>
          </van-collapse-item>
        </van-collapse>
      </div>

      <!-- Quick stats link -->
      <div class="quick-link" @click="router.push('/items')">
        <van-icon name="orders-o" />
        <span>查看全部订单</span>
        <van-icon name="arrow" class="arrow" />
      </div>
    </div>

    <!-- Bottom action buttons (above tabbar) -->
    <div v-if="currentActivity" class="bottom-actions">
      <van-button
        type="primary"
        round
        icon="add-o"
        @click="router.push('/item-form')"
      >
        新增订单
      </van-button>
      <van-button
        type="default"
        round
        icon="success"
        @click="router.push('/batch-confirm')"
      >
        批量确认收货
      </van-button>
    </div>

    <!-- Activity switch popup -->
    <van-popup
      v-model:show="showActivityPopup"
      position="top"
      round
      closeable
      close-icon-position="top-left"
      :style="{ top: '46px' }"
    >
      <div class="activity-popup">
        <div class="popup-header">选择活动</div>
        <van-cell-group inset>
          <van-cell
            v-for="act in activities"
            :key="act.id"
            :title="act.name"
            :label="activityLabel(act)"
            clickable
            @click="selectActivity(act.id)"
          >
            <template #right-icon>
              <van-icon
                name="edit"
                size="16"
                class="cell-edit-icon"
                @click.stop="router.push(`/activity-form?edit=1&id=${act.id}`)"
              />
            </template>
            <template #value>
              <van-tag v-if="act.id === currentActivityId" type="primary" plain size="medium">
                当前
              </van-tag>
            </template>
          </van-cell>
        </van-cell-group>
        <div class="popup-footer">
          <van-button
            type="primary"
            block
            round
            icon="add-o"
            @click="showActivityPopup = false; router.push('/activity-form')"
          >
            新建活动
          </van-button>
        </div>
      </div>
    </van-popup>

    <!-- 说明弹窗 -->
    <van-popup
      v-model:show="showHelp"
      position="bottom"
      :style="{ width: '100%', height: '100%', top: '0', maxHeight: '100%' }"
      closeable
      close-icon-position="top-left"
    >
      <div class="help-page">
        <div class="help-title">📖 使用说明</div>

        <div class="help-section">
          <div class="help-section-title">💡 核心概念</div>
          <p>本应用用于管理团购商品的返现追踪。每个订单从录入到返现完成，经历以下状态流转：</p>
          <p><b>待收货</b> → <b>待返现</b> → <b>已完成</b></p>
        </div>

        <div class="help-section">
          <div class="help-section-title">💰 返现来源</div>
          <p>返现分为三种来源，各自独立统计：</p>
          <ul>
            <li><span class="dot dot-store"></span> <b>店铺返现</b>：下单即返、小红书晒单、组合购、品牌套购、平台/店铺保价退款等</li>
            <li><span class="dot dot-mizhu"></span> <b>迷住返现</b>：迷住加返、舰长神券、装修神券、迷住保价等</li>
            <li><span class="dot dot-big"></span> <b>大套购</b>：根据活动规则按累计金额阶梯返现，需手动结算</li>
          </ul>
        </div>

        <div class="help-section">
          <div class="help-section-title">📐 计算逻辑</div>
          <p><b>到手价</b> = 下单价 - 店铺返现总额 - 迷住返现总额 - 大套购返现总额</p>
          <p><b>品牌套购返现</b> = (下单价 - 平台保价 - 店铺保价 - 店铺手填返现) × (1 - 系数)</p>
          <p><b>迷住保价退款</b>（一类）= (下单价 - 店铺返现 - 保价退款) - 迷住承诺到手价</p>
          <p><b>迷住保价退款</b>（二类）= (到手价 - 大套购分摊) - 迷住承诺到手价</p>
          <p><b>大套购预估</b> = 下单价 × 5%（实际金额根据活动规则阶梯计算后按比例分摊）</p>
        </div>

        <div class="help-section">
          <div class="help-section-title">📋 操作流程</div>
          <ol>
            <li><b>创建活动</b>：设置活动名称和大套购规则</li>
            <li><b>新增订单</b>：录入商品信息、下单价、返现明细</li>
            <li><b>确认收货</b>：收货后返现进入待返状态，平台保价退款自动到账</li>
            <li><b>收到返现</b>：点击待返金额数字可快速填充，逐笔记录收款</li>
            <li><b>大套购结算</b>：当店铺和迷住返现全部到账后，可在待返页结算大套购</li>
          </ol>
        </div>

        <div class="help-section">
          <div class="help-section-title">⚠️ 注意事项</div>
          <ul>
            <li>已参与大套购结算的订单，下单价会被锁定</li>
            <li>删除大套购返现记录会连带撤销同批次的所有结算</li>
            <li>迷住保价需同时选择类型和填写到手价</li>
            <li>舰长神券与装修神券互斥，填写一项会清空另一项</li>
          </ul>
        </div>
      </div>
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { Activity, Item, CashbackEntry } from '@/types'
import { ENTRY_TYPE_MAP } from '@/types'
import {
  getAllActivities,
  getItemsByActivity,
  getEntriesByItem,
  getPaymentsByItem,
} from '@/db/crud'
import { calcItem, type ItemCalc } from '@/calc/aggregate'

const router = useRouter()

const STORAGE_KEY = 'mizhu_current_activity_id'
const UPCOMING_DAYS = 7

// ---- State ----

const loading = ref(true)
const activities = ref<Activity[]>([])
const currentActivityId = ref<string | null>(null)
const showActivityPopup = ref(false)
const showHelp = ref(false)
const activeCollapseNames = ref<string[]>(['overdue', 'upcoming'])

interface ItemData {
  item: Item
  entries: CashbackEntry[]
  calc: ItemCalc
}
const itemDataList = ref<ItemData[]>([])

// ---- Computed ----

const currentActivity = computed(
  () => activities.value.find(a => a.id === currentActivityId.value) ?? null,
)

const r2 = (n: number) => Math.round(n * 100) / 100

const overview = computed(() => {
  const list = itemDataList.value
  const totalOrder = r2(list.reduce((s, d) => s + d.item.price, 0))
  const itemCount = list.length
  const totalCashback = r2(list.reduce((s, d) => s + d.calc.storeTotal + d.calc.mizhuTotal + d.calc.bigPurchaseTotal, 0))
  const totalPaid = r2(list.reduce((s, d) => s + d.calc.storePaid + d.calc.mizhuPaid + d.calc.bigPurchasePaid, 0))
  const totalPending = r2(list.reduce((s, d) => s + d.calc.totalPending, 0))
  const storePending = r2(list.reduce((s, d) => s + d.calc.storePending, 0))
  const mizhuPending = r2(list.reduce((s, d) => s + d.calc.mizhuPending, 0))
  const bigPurchasePending = r2(list.reduce((s, d) => s + d.calc.bigPurchasePending, 0))
  const progressPercent =
    totalCashback > 0 ? Math.min(100, Math.round((totalPaid / totalCashback) * 100)) : 0
  return { totalOrder, itemCount, totalPaid, totalPending, storePending, mizhuPending, bigPurchasePending, progressPercent }
})

interface ReminderEntry {
  itemId: string
  itemName: string
  days: number
}

const reminders = computed<{ overdue: ReminderEntry[]; upcoming: ReminderEntry[] }>(() => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const collected: ReminderEntry[] = []

  for (const { item, entries, calc } of itemDataList.value) {
    // 仅判断店铺+迷住的待返，大套购不参与到账提醒
    const pending = calc.storePending + calc.mizhuPending
    if (pending <= 0) continue
    if (item.status !== '待返现') continue // 只显示待返现状态的商品

    let minDiff: number | null = null
    for (const entry of entries) {
      if (entry.type === 'big_purchase') continue // 大套购不参与提醒
      const dueStr = computeDueDate(entry, item)
      if (!dueStr) continue
      const due = new Date(dueStr)
      if (isNaN(due.getTime())) continue
      due.setHours(0, 0, 0, 0)
      const diff = Math.round((due.getTime() - today.getTime()) / 86_400_000)
      if (minDiff === null || diff < minDiff) minDiff = diff
    }

    if (minDiff !== null && minDiff <= UPCOMING_DAYS) {
      collected.push({ itemId: item.id, itemName: item.name, days: minDiff })
    }
  }

  return {
    overdue: collected.filter(r => r.days < 0).sort((a, b) => a.days - b.days),
    upcoming: collected.filter(r => r.days >= 0).sort((a, b) => a.days - b.days),
  }
})

const hasReminders = computed(
  () => reminders.value.overdue.length > 0 || reminders.value.upcoming.length > 0,
)

// ---- Methods ----

function fmt(n: number): string {
  return n.toFixed(2)
}

function activityLabel(act: Activity): string {
  const parts: string[] = [act.status]
  if (act.startDate || act.endDate) {
    const s = act.startDate ? act.startDate.slice(0, 10) : '?'
    const e = act.endDate ? act.endDate.slice(0, 10) : '?'
    parts.push(`${s} ~ ${e}`)
  }
  return parts.join(' · ')
}

function computeDueDate(entry: CashbackEntry, item: Item): string | null {
  if (entry.dueDate) return entry.dueDate
  if (!item.confirmDate) return null // 未确认收货，不参与倒计时
  const rule = ENTRY_TYPE_MAP[entry.type].dueRule
  if (rule === '即时') return item.confirmDate
  if (rule === '收货+14天') {
    const d = new Date(item.confirmDate)
    d.setDate(d.getDate() + 14)
    return d.toISOString()
  }
  return null
}

function selectActivity(id: string) {
  currentActivityId.value = id
  localStorage.setItem(STORAGE_KEY, id)
  showActivityPopup.value = false
}

function goToItemDetail(itemId: string) {
  router.push(`/item-detail/${itemId}`)
}

async function loadItemData() {
  const aid = currentActivityId.value
  if (!aid) {
    itemDataList.value = []
    return
  }
  const items = await getItemsByActivity(aid)
  const results: ItemData[] = []
  for (const item of items) {
    const entries = await getEntriesByItem(item.id)
    const payments = await getPaymentsByItem(item.id)
    results.push({ item, entries, calc: calcItem(item, entries, payments) })
  }
  itemDataList.value = results
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

    await loadItemData()
  } finally {
    loading.value = false
  }
}

watch(currentActivityId, () => {
  loadItemData()
})

onMounted(init)
</script>

<style scoped>
.home {
  min-height: 100vh;
  background: #f7f8fa;
  padding-bottom: calc(50px + env(safe-area-inset-bottom));
}

/* Nav switch */
.nav-switch {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
}

.nav-title-wrap {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 15px;
  font-weight: 600;
}

.nav-edit-icon {
  color: #969799;
}

/* Loading */
.loading-wrap {
  display: flex;
  justify-content: center;
  padding: 80px 0;
}

/* Empty state */
.empty-state {
  padding: 40px 0;
}

/* Content */
.content {
  padding: 12px;
}

/* Card */
.card {
  background: #fff;
  border-radius: 16px;
  padding: 18px;
  margin-bottom: 12px;
  box-shadow: var(--mz-shadow, 0 2px 12px rgba(91, 141, 239, 0.06));
  border: 1px solid var(--mz-border, #eef0f3);
}

.overview-card-wrap {
  background: linear-gradient(135deg, #f0f4ff 0%, #ffffff 60%);
  border-color: #e3ecff;
}

/* Overview grid */
.overview-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.overview-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.cell-label {
  font-size: 13px;
  color: #969799;
}

.cell-value {
  font-size: 20px;
  font-weight: 600;
  color: #323233;
}

.text-paid {
  color: #07c160;
}

.text-pending {
  color: #ee0a24;
}

/* Pending breakdown */
.pending-breakdown {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid #f2f3f5;
}

.breakdown-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.breakdown-item-left {
  display: flex;
  align-items: center;
  gap: 6px;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.dot-store {
  background: #5b8def;
}

.dot-mizhu {
  background: #ff976a;
}

.dot-big {
  background: #9b6dff;
}

.breakdown-label {
  font-size: 13px;
  color: #646566;
}

.breakdown-amount {
  font-size: 14px;
  font-weight: 600;
  color: #323233;
}

/* Progress */
.progress-wrap {
  margin-top: 16px;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 13px;
  color: #646566;
}

.progress-pct {
  font-weight: 600;
  color: #323233;
}

/* Reminder section */
.section-title {
  font-size: 15px;
  font-weight: 600;
  color: #323233;
  margin-bottom: 8px;
}

.reminder-section :deep(.van-collapse) {
  margin: 0 -16px -16px;
}

.reminder-section :deep(.van-collapse-item__title) {
  padding: 10px 16px;
}

.collapse-title {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
}

.collapse-title--overdue {
  color: #ee0a24;
}

.collapse-title--upcoming {
  color: #ff976a;
}

.reminder-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #f2f3f5;
}

.reminder-item:last-child {
  border-bottom: none;
}

.reminder-name {
  font-size: 14px;
  color: #323233;
}

.reminder-badge {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 10px;
  white-space: nowrap;
}

.reminder-badge--overdue {
  color: #ee0a24;
  background: #ffeece;
}

.reminder-badge--upcoming {
  color: #ff976a;
  background: #fff7e8;
}

/* Quick link */
.quick-link {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 14px 16px;
  background: #fff;
  border-radius: 12px;
  margin-bottom: 12px;
  font-size: 14px;
  color: #323233;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.quick-link .arrow {
  margin-left: auto;
  color: #c8c9cc;
}

/* Bottom actions */
.bottom-actions {
  display: flex;
  gap: 12px;
  padding: 12px;
  position: fixed;
  left: 0;
  right: 0;
  bottom: calc(50px + env(safe-area-inset-bottom));
  max-width: 430px;
  margin: 0 auto;
  background: #f7f8fa;
}

.bottom-actions .van-button {
  flex: 1;
}

/* Activity popup */
.activity-popup {
  padding: 16px 0;
}

.popup-header {
  text-align: center;
  font-size: 16px;
  font-weight: 600;
  color: #323233;
  margin-bottom: 12px;
}

.cell-edit-icon {
  color: #1989fa;
  margin-left: 12px;
  align-self: center;
}

.popup-footer {
  padding: 16px;
}

/* 说明页面 */
.help-page {
  padding: 20px 16px 60px;
  overflow-y: auto;
  max-height: 100vh;
}

.help-title {
  font-size: 20px;
  font-weight: 700;
  margin-bottom: 16px;
  text-align: center;
}

.help-section {
  margin-bottom: 20px;
}

.help-section-title {
  font-size: 15px;
  font-weight: 600;
  color: #1989fa;
  margin-bottom: 8px;
}

.help-section p {
  font-size: 13px;
  color: #323233;
  line-height: 1.7;
  margin-bottom: 6px;
}

.help-section ul,
.help-section ol {
  padding-left: 20px;
  font-size: 13px;
  color: #323233;
  line-height: 1.8;
}

.help-section li {
  margin-bottom: 4px;
}
</style>
