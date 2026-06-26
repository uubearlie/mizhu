<template>
  <div class="reports" data-page="reports">
    <!-- 顶部导航 + 导出 -->
    <van-nav-bar title="统计报表" fixed placeholder>
      <template #right>
        <div class="nav-export" @click="showExport = true">
          <van-icon name="down" />
          <span>导出</span>
        </div>
      </template>
    </van-nav-bar>

    <!-- 加载中 -->
    <div v-if="loading" class="loading-wrap">
      <van-loading type="spinner" />
    </div>

    <!-- 无活动 -->
    <van-empty v-else-if="!currentActivity" description="请先在首页选择活动">
      <van-button type="primary" round @click="goHome">去首页</van-button>
    </van-empty>

    <template v-else>
      <!-- 本期总览 -->
      <div class="card">
        <div class="card-header">本期总览 · {{ currentActivity.name }}</div>
        <div class="overview-grid">
          <div class="overview-item">
            <span class="cell-label">下单总额</span>
            <span class="cell-value">¥{{ fmt(overview.totalOrder) }}</span>
          </div>
          <div class="overview-item">
            <span class="cell-label">总返现</span>
            <span class="cell-value text-cashback">¥{{ fmt(overview.totalCashback) }}</span>
          </div>
          <div class="overview-item">
            <span class="cell-label">实际到手</span>
            <span class="cell-value text-primary">¥{{ fmt(overview.finalPrice) }}</span>
          </div>
          <div class="overview-item">
            <span class="cell-label">返现率</span>
            <span class="cell-value text-cashback">{{ overview.cashbackRate }}%</span>
          </div>
        </div>

        <div class="progress-wrap">
          <div class="progress-header">
            <span>返现进度</span>
            <span class="progress-pct">{{ overview.progressPercent }}%</span>
          </div>
          <van-progress
            :percentage="overview.progressPercent"
            stroke-width="8"
            :color="overview.progressPercent >= 100 ? '#07c160' : '#1989fa'"
            track-color="#ebedf0"
          />
          <div class="progress-text">
            <span>已返 <span class="text-green text-bold">¥{{ fmt(overview.totalPaid) }}</span></span>
            <span>待返 <span class="text-red text-bold">¥{{ fmt(overview.totalPending) }}</span></span>
          </div>
        </div>
      </div>

      <!-- 返现构成图表 -->
      <div class="card">
        <div class="card-header">返现构成</div>
        <div v-if="chartData.length === 0" class="empty-tip">暂无返现数据</div>
        <v-chart
          v-else
          class="bar-chart"
          :option="chartOption"
          autoresize
        />
      </div>

      <!-- 历史趋势 -->
      <div class="card">
        <div class="card-header">历史趋势</div>
        <div class="overview-grid">
          <div class="overview-item">
            <span class="cell-label">参与活动</span>
            <span class="cell-value">{{ history.activityCount }}<span class="unit"> 期</span></span>
          </div>
          <div class="overview-item">
            <span class="cell-label">累计返现</span>
            <span class="cell-value text-cashback">¥{{ fmt(history.totalCashback) }}</span>
          </div>
        </div>
        <div class="overview-row">
          <div class="overview-item">
            <span class="cell-label">累计省钱</span>
            <span class="cell-value text-green">¥{{ fmt(history.totalSaved) }}</span>
          </div>
        </div>
      </div>
    </template>

    <!-- 导出选择 -->
    <van-action-sheet
      v-model:show="showExport"
      :actions="exportActions"
      cancel-text="取消"
      close-on-click-action
      @select="onExportSelect"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import type { Activity, Item, CashbackEntry, PaymentRecord, CashbackEntryType } from '@/types'
import { ENTRY_TYPE_MAP } from '@/types'
import {
  getAllActivities,
  getItemsByActivity,
  getEntriesByItem,
  getPaymentsByItem,
} from '@/db/crud'
import { calcItem, type ItemCalc } from '@/calc/aggregate'

use([CanvasRenderer, BarChart, GridComponent, TooltipComponent])

const router = useRouter()
const STORAGE_KEY = 'mizhu_current_activity_id'

// ---- State ----

const loading = ref(true)
const activities = ref<Activity[]>([])
const currentActivityId = ref<string | null>(null)
const showExport = ref(false)

interface ItemData {
  item: Item
  entries: CashbackEntry[]
  payments: PaymentRecord[]
  calc: ItemCalc
  activityId: string
}
const allItemData = ref<ItemData[]>([])

// ---- Computed ----

const currentActivity = computed(
  () => activities.value.find((a) => a.id === currentActivityId.value) ?? null,
)

const itemDataList = computed(() =>
  currentActivityId.value
    ? allItemData.value.filter((d) => d.activityId === currentActivityId.value)
    : [],
)

const r2 = (n: number) => Math.round(n * 100) / 100

function fmt(n: number): string {
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** 本期总览 */
const overview = computed(() => {
  const list = itemDataList.value
  const totalOrder = r2(list.reduce((s, d) => s + d.item.price, 0))
  const totalCashback = r2(list.reduce((s, d) => s + d.calc.storeTotal + d.calc.mizhuTotal, 0))
  const finalPrice = r2(list.reduce((s, d) => s + d.calc.finalPrice, 0))
  const totalPaid = r2(list.reduce((s, d) => s + d.calc.storePaid + d.calc.mizhuPaid, 0))
  const totalPending = r2(list.reduce((s, d) => s + d.calc.totalPending, 0))
  const cashbackRate =
    totalOrder > 0 ? Math.round((totalCashback / totalOrder) * 1000) / 10 : 0
  const progressPercent =
    totalCashback > 0 ? Math.min(100, Math.round((totalPaid / totalCashback) * 100)) : 0
  return { totalOrder, totalCashback, finalPrice, totalPaid, totalPending, cashbackRate, progressPercent }
})

/** 返现构成（按类型汇总） */
const TYPE_COLORS: Record<CashbackEntryType, string> = {
  platform_refund: '#36cfc9',
  store_refund: '#1890ff',
  instant_cashback: '#52c41a',
  xhs_post: '#eb2f96',
  combo: '#faad14',
  other: '#bfbfbf',
  brand: '#722ed1',
  mizhu_extra: '#ff7a45',
  captain_coupon: '#fa8c16',
  renovation_coupon: '#13c2c2',
  mizhu_protect: '#2f54eb',
  big_purchase: '#1677ff',
}

const chartData = computed(() => {
  const map = new Map<CashbackEntryType, number>()
  for (const d of itemDataList.value) {
    for (const e of d.entries) {
      map.set(e.type, (map.get(e.type) ?? 0) + e.amount)
    }
  }
  return [...map.entries()]
    .map(([type, amount]) => ({ type, label: ENTRY_TYPE_MAP[type].label, amount: r2(amount) }))
    .filter((d) => d.amount > 0)
    .sort((a, b) => b.amount - a.amount)
})

const chartOption = computed(() => {
  // 反转使最大值在顶部
  const reversed = [...chartData.value].reverse()
  return {
    grid: { left: '2%', right: '8%', bottom: '3%', top: '3%', containLabel: true },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      valueFormatter: (v: number) => `¥${Number(v).toFixed(2)}`,
    },
    xAxis: {
      type: 'value',
      show: false,
    },
    yAxis: {
      type: 'category',
      data: reversed.map((d) => d.label),
      axisLabel: { color: '#323233', fontSize: 12 },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [
      {
        type: 'bar',
        data: reversed.map((d) => ({
          value: d.amount,
          itemStyle: { color: TYPE_COLORS[d.type] ?? '#1989fa', borderRadius: [0, 4, 4, 0] },
        })),
        barWidth: '55%',
        label: {
          show: true,
          position: 'right',
          formatter: (p: { value: number }) => `¥${Number(p.value).toFixed(0)}`,
          color: '#646566',
          fontSize: 11,
        },
      },
    ],
  }
})

/** 历史趋势 */
const history = computed(() => {
  const list = allItemData.value
  const activityCount = activities.value.length
  const totalCashback = r2(list.reduce((s, d) => s + d.calc.storeTotal + d.calc.mizhuTotal, 0))
  return { activityCount, totalCashback, totalSaved: totalCashback }
})

// ---- 导出 ----

const exportActions = [
  { name: '导出 JSON' },
  { name: '导出 Excel (CSV)' },
]

function onExportSelect(action: { name: string }) {
  if (action.name.startsWith('导出 JSON')) exportJSON()
  else if (action.name.startsWith('导出 Excel')) exportExcel()
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** JSON 导出：当前活动完整数据 */
function exportJSON() {
  const activity = currentActivity.value
  if (!activity || itemDataList.value.length === 0) {
    showToast('暂无数据可导出')
    return
  }
  const payload = {
    exportedAt: new Date().toISOString(),
    activity: {
      id: activity.id,
      name: activity.name,
      startDate: activity.startDate,
      endDate: activity.endDate,
      status: activity.status,
    },
    summary: overview.value,
    items: itemDataList.value.map((d) => ({
      name: d.item.name,
      channel: d.item.channel,
      orderNo: d.item.orderNo,
      price: d.item.price,
      status: d.item.status,
      confirmDate: d.item.confirmDate,
      gift: d.item.gift,
      remark: d.item.remark,
      finalPrice: d.calc.finalPrice,
      entries: d.entries.map((e) => ({
        type: ENTRY_TYPE_MAP[e.type].label,
        customLabel: e.customLabel,
        amount: e.amount,
        dueDate: e.dueDate,
        isEstimated: e.isEstimated,
      })),
      payments: d.payments.map((p) => ({
        date: p.date,
        amount: p.amount,
        payer: p.payer,
      })),
    })),
  }
  const json = JSON.stringify(payload, null, 2)
  const blob = new Blob([json], { type: 'application/json;charset=utf-8;' })
  downloadBlob(blob, `${activity.name}_统计.json`)
  showToast({ type: 'success', message: '已导出 JSON' })
}

/** Excel(CSV) 导出：扁平化表格，自定义条目合并为「其他」列 */
function exportExcel() {
  const activity = currentActivity.value
  if (!activity || itemDataList.value.length === 0) {
    showToast('暂无数据可导出')
    return
  }

  // 标准类型列（排除 other，other 统一进「其他」列）
  const columnTypes = Object.keys(ENTRY_TYPE_MAP).filter(
    (t) => t !== 'other',
  ) as CashbackEntryType[]

  const headers = [
    '商品名称',
    '渠道',
    '订单号',
    '下单价',
    ...columnTypes.map((t) => ENTRY_TYPE_MAP[t].label),
    '其他',
    '已返',
    '待返',
    '到手价',
    '状态',
  ]

  const escCell = (v: unknown) => {
    const s = String(v ?? '')
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }

  const dataRows = itemDataList.value.map((d) => {
    const entryMap = new Map<string, number>()
    let otherSum = 0
    for (const e of d.entries) {
      if (e.type === 'other') {
        otherSum += e.amount
      } else {
        entryMap.set(e.type, (entryMap.get(e.type) ?? 0) + e.amount)
      }
    }
    return [
      d.item.name,
      d.item.channel,
      d.item.orderNo,
      d.item.price,
      ...columnTypes.map((t) => r2(entryMap.get(t) ?? 0)),
      r2(otherSum),
      r2(d.calc.storePaid + d.calc.mizhuPaid),
      r2(d.calc.totalPending),
      d.calc.finalPrice,
      d.item.status,
    ].map(escCell).join(',')
  })

  // 合计行
  const totals = itemDataList.value
  const sumRow = [
    escCell('合计'),
    '',
    '',
    r2(totals.reduce((s, d) => s + d.item.price, 0)),
    ...columnTypes.map((t) =>
      r2(totals.reduce((s, d) => s + d.entries.filter((e) => e.type === t).reduce((a, e) => a + e.amount, 0), 0)),
    ),
    r2(totals.reduce((s, d) => s + d.entries.filter((e) => e.type === 'other').reduce((a, e) => a + e.amount, 0), 0)),
    r2(totals.reduce((s, d) => s + d.calc.storePaid + d.calc.mizhuPaid, 0)),
    r2(totals.reduce((s, d) => s + d.calc.totalPending, 0)),
    r2(totals.reduce((s, d) => s + d.calc.finalPrice, 0)),
    '',
  ].join(',')

  const csv = [headers.map(escCell).join(','), ...dataRows, sumRow].join('\r\n')
  // BOM 保证 Excel 正确识别 UTF-8
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  downloadBlob(blob, `${activity.name}_统计.csv`)
  showToast({ type: 'success', message: '已导出 CSV' })
}

// ---- 导航 ----

function goHome() {
  router.push('/')
}

// ---- 数据加载 ----

async function loadData() {
  loading.value = true
  try {
    activities.value = await getAllActivities()

    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && activities.value.some((a) => a.id === stored)) {
      currentActivityId.value = stored
    } else if (activities.value.length > 0) {
      currentActivityId.value = activities.value[0].id
      localStorage.setItem(STORAGE_KEY, activities.value[0].id)
    } else {
      currentActivityId.value = null
    }

    // 加载所有活动的商品数据（用于历史趋势 + 当前活动详情）
    const all: ItemData[] = []
    for (const act of activities.value) {
      const items = await getItemsByActivity(act.id)
      for (const item of items) {
        const entries = await getEntriesByItem(item.id)
        const payments = await getPaymentsByItem(item.id)
        all.push({ item, entries, payments, calc: calcItem(item, entries, payments), activityId: act.id })
      }
    }
    allItemData.value = all
  } finally {
    loading.value = false
  }
}

onMounted(loadData)
</script>

<style scoped>
.reports {
  min-height: 100vh;
  background: #f7f8fa;
  padding-bottom: calc(50px + env(safe-area-inset-bottom));
}

/* Nav export button */
.nav-export {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 14px;
  color: #323233;
}

/* Loading */
.loading-wrap {
  display: flex;
  justify-content: center;
  padding: 80px 0;
}

/* Content */
.reports > .card {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  margin: 12px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.card-header {
  font-size: 15px;
  font-weight: 600;
  color: #323233;
  margin-bottom: 14px;
}

/* Overview grid */
.overview-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px 12px;
}

.overview-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.overview-row {
  display: flex;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid #f2f3f5;
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

.unit {
  font-size: 14px;
  font-weight: 400;
  color: #969799;
}

.text-cashback {
  color: #ff976a;
}

.text-primary {
  color: #1989fa;
}

.text-green {
  color: #07c160;
}

.text-red {
  color: #ee0a24;
}

.text-bold {
  font-weight: 600;
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

.progress-text {
  display: flex;
  justify-content: space-between;
  margin-top: 10px;
  font-size: 13px;
  color: #969799;
}

/* Chart */
.bar-chart {
  width: 100%;
  height: 280px;
}

.empty-tip {
  text-align: center;
  color: #c8c9cc;
  font-size: 13px;
  padding: 32px 0;
}
</style>
