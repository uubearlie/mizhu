<template>
  <div class="items-page">
    <!-- 顶部：搜索栏 + 状态筛选 -->
    <van-sticky>
      <div class="filter-bar">
        <van-search
          v-model="keyword"
          placeholder="搜索型号 / 订单号"
          shape="round"
          class="filter-search"
        />
        <van-dropdown-menu class="status-dropdown">
          <van-dropdown-item v-model="statusFilter" :options="statusOptions" />
        </van-dropdown-menu>
      </div>
    </van-sticky>

    <!-- 批量收货 -->
    <div class="px-3 pt-2">
      <van-button type="primary" block round icon="sign" @click="goBatchConfirm">
        批量收货
      </van-button>
    </div>

    <!-- 加载中 -->
    <div v-if="loading" class="flex justify-center py-10">
      <van-loading type="spinner" />
    </div>

    <!-- 未选择活动 -->
    <van-empty
      v-else-if="!activityId"
      description="请先在首页选择活动"
    >
      <van-button type="primary" round @click="goHome">去首页</van-button>
    </van-empty>

    <!-- 商品列表 -->
    <template v-else>
      <div class="item-list">
        <van-card
          v-for="row in filteredRows"
          :key="row.item.id"
          class="item-card"
        >
          <!-- 标题：商品名（可点击） + 状态标签 -->
          <template #title>
            <div class="card-title">
              <span class="card-name" @click="goDetail(row.item.id)">{{ row.item.name }}</span>
              <van-tag :type="statusTagType(row.item.status)" size="medium">
                {{ row.item.status }}
              </van-tag>
            </div>
          </template>

          <!-- 信息行：下单 / 待返(红) / 已返(绿) -->
          <template #desc>
            <div class="card-info">
              <span>下单 <b>¥{{ fmt(row.item.price) }}</b></span>
              <span>待返 <b class="text-red">¥{{ fmt(row.calc.totalPending) }}</b></span>
              <span>已返 <b class="text-green">¥{{ fmt(row.calc.storePaid + row.calc.mizhuPaid) }}</b></span>
            </div>
          </template>

          <!-- 到手价 -->
          <template #price>
            <div class="final-price-row">
              <span class="final-label">到手价</span>
              <span
                v-if="row.item.status !== '已取消'"
                class="final-price"
              >¥{{ fmt(row.calc.finalPrice) }}</span>
              <span v-else class="final-price final-price-muted">—</span>
            </div>
          </template>

          <!-- 操作按钮 -->
          <template #footer>
            <van-button
              v-if="row.item.status === '待收货'"
              size="small"
              type="primary"
              plain
              @click="doConfirmReceipt(row)"
            >确认收货</van-button>
            <van-button
              v-if="row.item.status !== '已取消'"
              size="small"
              plain
              @click="openProtect(row)"
            >保价</van-button>
            <van-button size="small" plain @click="openAction(row)">⋯</van-button>
          </template>
        </van-card>

        <van-empty
          v-if="filteredRows.length === 0"
          description="暂无订单"
        />
      </div>
    </template>

    <!-- 新建商品 FAB -->
    <div v-if="activityId" class="fab" @click="goCreate">
      <van-icon name="plus" size="24" color="#fff" />
    </div>

    <!-- 状态切换 action sheet -->
    <van-action-sheet
      v-model:show="actionShow"
      :actions="currentActions"
      cancel-text="取消"
      close-on-click-action
      @select="onActionSelect"
    />

    <!-- 快速保价弹窗 -->
    <van-popup
      v-model:show="protectShow"
      round
      position="bottom"
      :style="{ maxHeight: '85%' }"
      closeable
    >
      <div v-if="protectData" class="protect-popup">
        <div class="protect-header">快速保价</div>

        <!-- 平台保价 -->
        <div class="protect-section">
          <div class="section-title">
            <span>🏪 平台保价</span>
            <span class="text-gray text-sm">累计 ¥{{ fmt(protectSum(protectData.platform)) }}</span>
          </div>
          <div
            v-for="e in protectData.platform"
            :key="e.id"
            class="protect-record"
          >
            <span class="record-date">{{ e.createdAt.slice(5, 10) }}</span>
            <span class="record-source">平台保价</span>
            <span class="record-amount">¥{{ fmt(e.amount) }}</span>
            <van-icon name="cross" class="del-icon" @click="removeProtectEntry('platform', e.id)" />
          </div>
          <div class="protect-add-row">
            <van-field
              v-model="newPlatformAmount"
              type="number"
              placeholder="新增补偿金额"
              class="protect-input"
            >
              <template #left-icon><span>¥</span></template>
            </van-field>
            <van-button size="small" type="primary" @click="addProtectEntry('platform')">添加</van-button>
          </div>
        </div>

        <!-- 店铺保价 -->
        <div class="protect-section">
          <div class="section-title">
            <span>🏪 店铺保价</span>
            <span class="text-gray text-sm">累计 ¥{{ fmt(protectSum(protectData.store)) }}</span>
          </div>
          <div
            v-for="e in protectData.store"
            :key="e.id"
            class="protect-record"
          >
            <span class="record-date">{{ e.createdAt.slice(5, 10) }}</span>
            <span class="record-source">店铺保价</span>
            <span class="record-amount">¥{{ fmt(e.amount) }}</span>
            <van-icon name="cross" class="del-icon" @click="removeProtectEntry('store', e.id)" />
          </div>
          <div class="protect-add-row">
            <van-field
              v-model="newStoreAmount"
              type="number"
              placeholder="新增补偿金额"
              class="protect-input"
            >
              <template #left-icon><span>¥</span></template>
            </van-field>
            <van-button size="small" type="primary" @click="addProtectEntry('store')">添加</van-button>
          </div>
        </div>

        <!-- 迷住保价 -->
        <div class="protect-section">
          <div class="section-title">🏠 迷住保价</div>
          <div class="mizhu-row">
            <span class="mizhu-label">保价类型</span>
            <van-radio-group v-model="protectData.mizhuType" direction="horizontal">
              <van-radio name="一类">一类</van-radio>
              <van-radio name="二类">二类</van-radio>
            </van-radio-group>
          </div>
          <div class="mizhu-row">
            <span class="mizhu-label">迷住保价到手价</span>
            <van-field
              v-model="protectData.mizhuPriceInput"
              type="number"
              placeholder="输入迷住保价承诺的到手价"
              class="protect-input"
            >
              <template #left-icon><span>¥</span></template>
            </van-field>
          </div>
        </div>

        <div class="protect-footer">
          <van-button block @click="protectShow = false">取消</van-button>
          <van-button block type="primary" @click="confirmProtect">确认保价</van-button>
        </div>
      </div>
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showToast, showConfirmDialog, showSuccessToast } from 'vant'
import type { Item, CashbackEntry, PaymentRecord, ItemStatus, MizhuProtectType } from '@/types'
import {
  getItemsByActivity,
  getEntriesByItem,
  getPaymentsByItem,
  updateItem,
  deleteItem,
  replaceItemEntries,
  deletePayment,
  autoCollectPlatformRefunds,
} from '@/db/crud'
import { calcItem, type ItemCalc } from '@/calc/aggregate'
import { recalcDynamicEntries, updateDueDates, validateItem } from '@/calc/recalc'
import { parseToYuan } from '@/calc/money'

const router = useRouter()

// ===== 活动上下文 =====
const activityId = ref<string>(localStorage.getItem('mizhu_current_activity_id') || '')

// ===== 列表数据 =====
interface ItemRow {
  item: Item
  entries: CashbackEntry[]
  records: PaymentRecord[]
  calc: ItemCalc
}

const rows = ref<ItemRow[]>([])
const loading = ref(false)

async function loadData() {
  if (!activityId.value) return
  loading.value = true
  try {
    const items = await getItemsByActivity(activityId.value)
    const built: ItemRow[] = []
    for (const item of items) {
      const entries = await getEntriesByItem(item.id)
      const records = await getPaymentsByItem(item.id)
      built.push({ item, entries, records, calc: calcItem(item, entries, records) })
    }
    rows.value = built
  } finally {
    loading.value = false
  }
}

onMounted(loadData)

// ===== 搜索 & 筛选 =====
const keyword = ref('')
const statusFilter = ref<string>('')

const statusOptions = [
  { text: '全部状态', value: '' },
  { text: '待收货', value: '待收货' },
  { text: '待返现', value: '待返现' },
  { text: '已完成', value: '已完成' },
  { text: '已取消', value: '已取消' },
]

const filteredRows = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return rows.value.filter((row) => {
    if (statusFilter.value && row.item.status !== statusFilter.value) return false
    if (kw) {
      const hay = (row.item.name + ' ' + row.item.orderNo).toLowerCase()
      if (!hay.includes(kw)) return false
    }
    return true
  })
})

// ===== 格式化 =====
function fmt(n: number): string {
  if (n == null || isNaN(n)) return '0.00'
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function statusTagType(status: ItemStatus): 'warning' | 'primary' | 'success' | 'default' {
  return ({
    待收货: 'warning',
    待返现: 'primary',
    已完成: 'success',
    已取消: 'default',
  } as const)[status]
}

// ===== 导航 =====
function goDetail(id: string) {
  router.push(`/item-detail/${id}`)
}

function goCreate() {
  router.push('/item-form')
}

function goBatchConfirm() {
  router.push('/batch-confirm')
}

function goHome() {
  router.push('/')
}

// ===== 状态切换 action sheet =====
const actionShow = ref(false)
const currentRow = ref<ItemRow | null>(null)

const currentActions = computed(() => {
  if (!currentRow.value) return []
  const status = currentRow.value.item.status
  return [
    { name: '确认收货', disabled: status !== '待收货' },
    { name: '收到返现', disabled: status === '待收货' || status === '已取消' },
    { name: '重置状态', disabled: status === '待收货' },
    { name: '取消订单' },
    { name: '删除', color: '#ee0a24' },
  ]
})

function openAction(row: ItemRow) {
  currentRow.value = row
  actionShow.value = true
}

async function onActionSelect(action: { name: string }) {
  if (!currentRow.value) return
  const row = currentRow.value
  switch (action.name) {
    case '确认收货':
      await doConfirmReceipt(row)
      break
    case '收到返现':
      goDetail(row.item.id)
      break
    case '重置状态':
      await doReset(row)
      break
    case '取消订单':
      await doCancel(row)
      break
    case '删除':
      await doDelete(row)
      break
  }
}

/** 确认收货：status→待返现，设置 confirmDate，重算 dueDate */
async function doConfirmReceipt(row: ItemRow) {
  const today = new Date().toISOString().slice(0, 10)
  const updatedItem = { ...row.item, confirmDate: today }
  let entries = recalcDynamicEntries(updatedItem, row.entries)
  entries = updateDueDates(entries, today)
  await replaceItemEntries(row.item.id, entries)
  // 平台保价为即时到账，自动创建收款记录
  await autoCollectPlatformRefunds(row.item.id, entries, today)
  await updateItem(row.item.id, { status: '待返现', confirmDate: today })
  showSuccessToast('已确认收货')
  await loadData()
}

/** 重置状态：回待收货，删除收款记录，清空 confirmDate 和 dueDate */
async function doReset(row: ItemRow) {
  try {
    await showConfirmDialog({
      title: '重置状态',
      message: '将删除所有收款记录并回到待收货状态，确定？',
    })
  } catch {
    return
  }
  // 删除收款记录
  for (const r of row.records) {
    await deletePayment(r.id)
  }
  // 清空 dueDate
  const cleared = row.entries.map((e) => ({ ...e, dueDate: null }))
  await replaceItemEntries(row.item.id, cleared)
  await updateItem(row.item.id, { status: '待收货', confirmDate: null })
  showSuccessToast('已重置状态')
  await loadData()
}

/** 取消订单：检查无收款记录后切换为已取消 */
async function doCancel(row: ItemRow) {
  if (row.records.length > 0) {
    showToast('已有收款记录，无法取消订单')
    return
  }
  await updateItem(row.item.id, { status: '已取消' })
  showSuccessToast('已取消订单')
  await loadData()
}

/** 删除：硬删除商品及关联数据 */
async function doDelete(row: ItemRow) {
  try {
    await showConfirmDialog({
      title: '删除订单',
      message: `确定删除「${row.item.name}」吗？将同时删除关联的返现和收款记录。`,
    })
  } catch {
    return
  }
  await deleteItem(row.item.id)
  showSuccessToast('已删除')
  await loadData()
}

// ===== 快速保价弹窗 =====
const protectShow = ref(false)
const newPlatformAmount = ref('')
const newStoreAmount = ref('')

interface ProtectWork {
  itemId: string
  platform: CashbackEntry[]
  store: CashbackEntry[]
  mizhuType: '一类' | '二类' | ''
  mizhuPriceInput: string
}

const protectData = ref<ProtectWork | null>(null)

function openProtect(row: ItemRow) {
  currentRow.value = row
  const platform = row.entries
    .filter((e) => e.type === 'platform_refund')
    .map((e) => ({ ...e }))
  const store = row.entries
    .filter((e) => e.type === 'store_refund')
    .map((e) => ({ ...e }))
  protectData.value = {
    itemId: row.item.id,
    platform,
    store,
    mizhuType: (row.item.mizhuProtectType ?? '') as '一类' | '二类' | '',
    mizhuPriceInput: row.item.mizhuProtectPrice != null ? String(row.item.mizhuProtectPrice) : '',
  }
  newPlatformAmount.value = ''
  newStoreAmount.value = ''
  protectShow.value = true
}

function protectSum(list: CashbackEntry[]): number {
  return list.reduce((s, e) => s + e.amount, 0)
}

function addProtectEntry(side: 'platform' | 'store') {
  if (!protectData.value) return
  const amountStr = side === 'platform' ? newPlatformAmount.value : newStoreAmount.value
  if (!amountStr) {
    showToast('请输入金额')
    return
  }
  const amount = parseToYuan(amountStr)
  if (amount <= 0) {
    showToast('金额需大于 0')
    return
  }
  const entry: CashbackEntry = {
    id: crypto.randomUUID(),
    itemId: protectData.value.itemId,
    type: side === 'platform' ? 'platform_refund' : 'store_refund',
    customLabel: null,
    amount,
    dueDate: null,
    isEstimated: false,
    createdAt: new Date().toISOString(),
  }
  protectData.value[side].push(entry)
  if (side === 'platform') newPlatformAmount.value = ''
  else newStoreAmount.value = ''
}

function removeProtectEntry(side: 'platform' | 'store', id: string) {
  if (!protectData.value) return
  const list = protectData.value[side]
  const idx = list.findIndex((e) => e.id === id)
  if (idx >= 0) list.splice(idx, 1)
}

async function confirmProtect() {
  if (!protectData.value || !currentRow.value) return
  const work = protectData.value
  const row = currentRow.value

  // 迷住保价参数
  const mizhuType: MizhuProtectType = work.mizhuType || null
  const mizhuPrice = work.mizhuPriceInput ? parseToYuan(work.mizhuPriceInput) : null

  // 保价类型和价格必须同时填写
  if (mizhuType && mizhuPrice == null) {
    showToast('请输入迷住保价到手价')
    return
  }
  if (!mizhuType && mizhuPrice != null) {
    showToast('请选择保价类型')
    return
  }
  // 校验迷住保价到手价 < 下单价
  if (mizhuType && mizhuPrice != null && mizhuPrice >= row.item.price) {
    showToast('迷住保价到手价应低于下单价')
    return
  }

  // 合成新的 entries：保留非保价类条目 + 弹窗编辑后的保价条目
  const keep = row.entries.filter(
    (e) => e.type !== 'platform_refund' && e.type !== 'store_refund' && e.type !== 'mizhu_protect',
  )
  const merged = [...keep, ...work.platform, ...work.store]

  // 更新 item 的迷住保价字段后触发动态重算
  const updatedItem: Item = {
    ...row.item,
    mizhuProtectType: mizhuType,
    mizhuProtectPrice: mizhuPrice,
  }
  let finalEntries = recalcDynamicEntries(updatedItem, merged)

  // 全量校验（返现总额不超过下单价等）
  const error = validateItem(updatedItem, finalEntries)
  if (error) {
    showToast(error)
    return
  }

  // 若已确认收货，补算 dueDate
  if (updatedItem.confirmDate) {
    finalEntries = updateDueDates(finalEntries, updatedItem.confirmDate)
  }

  await replaceItemEntries(row.item.id, finalEntries)
  await updateItem(row.item.id, {
    mizhuProtectType: mizhuType,
    mizhuProtectPrice: mizhuPrice,
  })

  protectShow.value = false
  showSuccessToast('保价已保存')
  await loadData()
}
</script>

<style scoped>
.items-page {
  padding-bottom: 100px;
}

/* 搜索栏 + 下拉 */
.filter-bar {
  display: flex;
  align-items: center;
  background: #fff;
}

.filter-search {
  flex: 1;
  padding: 8px 12px;
}

.status-dropdown {
  width: 110px;
  flex-shrink: 0;
}

.status-dropdown :deep(.van-dropdown-menu__bar) {
  box-shadow: none;
  height: 40px;
}

/* 商品卡片 */
.item-list {
  padding: 4px 0 0;
}

.item-card {
  background: #fff;
  margin: 8px 12px;
  border-radius: 12px;
  overflow: hidden;
}

.item-card :deep(.van-card__content) {
  min-height: auto;
  padding: 4px 0;
}

.item-card :deep(.van-card__footer) {
  padding-top: 4px;
}

.card-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.card-name {
  font-size: 15px;
  font-weight: 600;
  color: #323233;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-info {
  display: flex;
  gap: 16px;
  font-size: 13px;
  color: #969799;
  margin-top: 4px;
}

.text-red {
  color: #ee0a24;
}

.text-green {
  color: #07c160;
}

.final-price-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin-top: 6px;
}

.final-label {
  font-size: 12px;
  color: #969799;
}

.final-price {
  font-size: 22px;
  font-weight: 700;
  color: #ee0a24;
  line-height: 1.2;
}

.final-price-muted {
  color: #c8c9cc;
}

/* FAB */
.fab {
  position: fixed;
  right: 18px;
  bottom: 72px;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: #1989fa;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(25, 137, 250, 0.4);
  z-index: 100;
  cursor: pointer;
}

.fab:active {
  transform: scale(0.92);
}

/* 保价弹窗 */
.protect-popup {
  padding: 16px;
  padding-bottom: env(safe-area-inset-bottom);
}

.protect-header {
  text-align: center;
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 12px;
}

.protect-section {
  margin-bottom: 12px;
  border: 1px solid #f2f3f5;
  border-radius: 8px;
  overflow: hidden;
}

.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: #f7f8fa;
  font-size: 14px;
  font-weight: 500;
}

.text-gray {
  color: #969799;
}

.text-sm {
  font-size: 12px;
}

.protect-record {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-top: 1px solid #f7f8fa;
  font-size: 13px;
}

.record-date {
  color: #969799;
  width: 44px;
}

.record-source {
  color: #323233;
  flex: 1;
}

.record-amount {
  font-weight: 600;
  color: #ee0a24;
}

.del-icon {
  color: #c8c9cc;
  font-size: 14px;
  padding: 4px;
}

.protect-add-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-top: 1px solid #f7f8fa;
}

.protect-input {
  flex: 1;
  padding: 4px 8px;
  background: #f7f8fa;
  border-radius: 6px;
}

.protect-input :deep(.van-field__body) {
  font-size: 14px;
}

.mizhu-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-top: 1px solid #f7f8fa;
}

.mizhu-label {
  font-size: 14px;
  color: #646566;
  width: 64px;
  flex-shrink: 0;
}

.protect-footer {
  display: flex;
  gap: 12px;
  margin-top: 16px;
}
</style>
