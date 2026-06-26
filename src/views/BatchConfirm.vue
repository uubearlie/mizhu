<template>
  <div class="batch-confirm">
    <van-nav-bar
      title="批量确认收货"
      left-arrow
      @click-left="router.back()"
    />

    <!-- 加载中 -->
    <div v-if="loading" class="loading-wrap">
      <van-loading type="spinner" />
    </div>

    <!-- 无活动 -->
    <van-empty
      v-else-if="!activityId"
      description="请先在首页选择活动"
    >
      <van-button type="primary" round @click="router.push('/')">去首页</van-button>
    </van-empty>

    <!-- 表单内容 -->
    <template v-else>
      <!-- 收货日期 -->
      <van-cell-group inset class="date-group">
        <van-cell
          title="收货日期"
          :value="confirmDate || '请选择'"
          is-link
          @click="showCalendar = true"
        />
      </van-cell-group>

      <!-- 选择订单 -->
      <div class="section-label">选择订单（仅显示待收货）</div>
      <van-checkbox-group v-model="checkedIds">
        <van-cell-group inset class="order-list">
          <van-cell
            v-for="(row, idx) in rows"
            :key="row.item.id"
            class="order-cell"
            :class="{ 'border-last': idx === rows.length - 1 }"
            clickable
            @click="toggle(row.item.id)"
          >
            <template #title>
              <div class="order-row">
                <van-checkbox :name="row.item.id" shape="square" ref="checkboxRefs" />
                <div class="order-info">
                  <div class="order-name">{{ row.item.name }}</div>
                  <div class="order-price">¥{{ fmt(row.item.price) }}</div>
                </div>
                <van-tag type="warning" plain round>待收货</van-tag>
              </div>
            </template>
          </van-cell>

          <van-empty
            v-if="rows.length === 0"
            description="暂无待收货商品"
            image-size="80"
          />
        </van-cell-group>
      </van-checkbox-group>

      <!-- 已选统计 -->
      <div class="selected-count">
        已选 <span class="count-num">{{ checkedIds.length }}</span> 件
      </div>
    </template>

    <!-- 日期日历 -->
    <van-calendar
      v-model:show="showCalendar"
      title="选择收货日期"
      :default-date="defaultCalendarDate"
      :min-date="minDate"
      :max-date="maxDate"
      @confirm="onDateConfirm"
    />

    <!-- 底部固定按钮 -->
    <div class="bottom-bar">
      <van-button
        type="primary"
        block
        round
        :disabled="checkedIds.length === 0 || submitting"
        :loading="submitting"
        @click="doBatchConfirm"
      >
        确认收货({{ checkedIds.length }})
      </van-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showToast, showSuccessToast } from 'vant'
import type { Item, CashbackEntry } from '@/types'
import { getPendingItems, getEntriesByItem, updateItem, replaceItemEntries } from '@/db/crud'
import { recalcDynamicEntries, updateDueDates } from '@/calc/recalc'

const router = useRouter()

const STORAGE_KEY = 'mizhu_current_activity_id'

// ---- 活动上下文 ----
const activityId = ref<string>(localStorage.getItem(STORAGE_KEY) || '')

// ---- 列表数据 ----
interface PendingRow {
  item: Item
  entries: CashbackEntry[]
}

const rows = ref<PendingRow[]>([])
const loading = ref(true)

// ---- 日期 ----
function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const confirmDate = ref(todayStr())
const showCalendar = ref(false)

const today = new Date()
const minDate = computed(() => {
  // 允许选过去日期，最早为一年前
  const d = new Date()
  d.setFullYear(d.getFullYear() - 1)
  return d
})
const maxDate = computed(() => today)
const defaultCalendarDate = computed(() => {
  const d = new Date(confirmDate.value)
  return isNaN(d.getTime()) ? new Date() : d
})

function onDateConfirm(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  confirmDate.value = `${y}-${m}-${day}`
  showCalendar.value = false
}

// ---- 勾选 ----
const checkedIds = ref<string[]>([])
const submitting = ref(false)

function toggle(id: string) {
  const idx = checkedIds.value.indexOf(id)
  if (idx >= 0) {
    checkedIds.value.splice(idx, 1)
  } else {
    checkedIds.value.push(id)
  }
}

// ---- 格式化 ----
function fmt(n: number): string {
  if (n == null || isNaN(n)) return '0.00'
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ---- 数据加载 ----
async function loadData() {
  if (!activityId.value) {
    rows.value = []
    return
  }
  loading.value = true
  try {
    const items = await getPendingItems(activityId.value)
    const built: PendingRow[] = []
    for (const item of items) {
      const entries = await getEntriesByItem(item.id)
      built.push({ item, entries })
    }
    rows.value = built
    // 默认全选
    checkedIds.value = built.map(r => r.item.id)
  } finally {
    loading.value = false
  }
}

onMounted(loadData)

// ---- 批量确认收货 ----
async function doBatchConfirm() {
  if (checkedIds.value.length === 0) {
    showToast('请选择商品')
    return
  }
  submitting.value = true
  try {
    const date = confirmDate.value
    const selected = rows.value.filter(r => checkedIds.value.includes(r.item.id))

    for (const row of selected) {
      const updatedItem: Item = { ...row.item, confirmDate: date }
      // 动态重算（品牌套购 / 迷住保价 / 大套购预估）
      let entries = recalcDynamicEntries(updatedItem, row.entries)
      // 计算 dueDate
      entries = updateDueDates(entries, date)
      // 保存
      await replaceItemEntries(row.item.id, entries)
      await updateItem(row.item.id, { status: '待返现', confirmDate: date })
    }

    showSuccessToast(`已确认 ${selected.length} 件`)
    router.push('/items')
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.batch-confirm {
  min-height: 100vh;
  background: #f7f8fa;
  padding-bottom: calc(80px + env(safe-area-inset-bottom));
}

.loading-wrap {
  display: flex;
  justify-content: center;
  padding: 60px 0;
}

/* 日期 */
.date-group {
  margin-top: 12px;
}

/* 分区标签 */
.section-label {
  padding: 16px 16px 8px;
  font-size: 13px;
  color: #969799;
}

/* 订单列表 */
.order-list {
  padding: 0;
}

.order-cell {
  padding: 12px 16px;
}

.order-cell.border-last {
  border-bottom: none;
}

.order-row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.order-info {
  flex: 1;
  min-width: 0;
}

.order-name {
  font-size: 15px;
  font-weight: 600;
  color: #323233;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.order-price {
  font-size: 13px;
  color: #ee0a24;
  font-weight: 600;
  margin-top: 2px;
}

/* 已选统计 */
.selected-count {
  text-align: center;
  padding: 16px 0;
  font-size: 13px;
  color: #969799;
}

.count-num {
  color: #1989fa;
  font-weight: 700;
  font-size: 15px;
}

/* 底部固定按钮 */
.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: #fff;
  padding: 12px 16px;
  padding-bottom: calc(12px + env(safe-area-inset-bottom));
  border-top: 1px solid #ebedf0;
  z-index: 50;
}
</style>
