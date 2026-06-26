<template>
  <div class="item-detail-page">
    <!-- 导航栏 -->
    <van-nav-bar
      :title="item?.name ?? '商品详情'"
      left-arrow
      fixed
      placeholder
      @click-left="onBack"
    >
      <template #right>
        <span class="nav-edit-btn" @click="editMode ? saveEdit() : enterEdit()">
          {{ editMode ? '保存' : '编辑' }}
        </span>
      </template>
    </van-nav-bar>

    <!-- 加载中 -->
    <div v-if="loading" class="loading-wrap">
      <van-loading type="spinner" />
    </div>

    <!-- 不存在 -->
    <van-empty v-else-if="!item" description="商品不存在或已删除" />

    <!-- 内容区 -->
    <template v-else>
      <!-- 到手价大卡片 -->
      <div class="final-card">
        <div class="final-card-inner">
          <div class="final-top">
            <span class="final-label">到手价</span>
            <van-tag v-if="item.status !== '已完成'" :type="statusTagType(item.status)" round size="medium">
              {{ item.status }}
            </van-tag>
            <van-tag v-else type="success" round size="medium">已完成</van-tag>
          </div>
          <div class="final-price">¥{{ fmt(calc.finalPrice) }}</div>
          <div class="final-meta">
            <div class="meta-item">
              <span class="meta-label">下单价</span>
              <span class="meta-value">¥{{ fmt(item.price) }}</span>
            </div>
            <div class="meta-divider" />
            <div class="meta-item">
              <span class="meta-label">返现率</span>
              <span class="meta-value">{{ cashbackRate }}%</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 基本信息 -->
      <div class="section-card">
        <div class="section-header">
          <van-icon name="description" />
          <span>基本信息</span>
        </div>
        <!-- 查看模式 -->
        <van-cell-group v-if="!editMode" inset>
          <van-cell title="商品名称" :value="item.name" />
          <van-cell title="途径" :value="item.channel" />
          <van-cell title="订单号" :value="item.orderNo || '—'" />
          <van-cell title="下单价">
            <template #value>
              <span class="cell-price">¥{{ fmt(item.price) }}</span>
            </template>
          </van-cell>
          <van-cell title="收货日期" :value="item.confirmDate || '未收货'" />
          <van-cell title="赠品" :value="item.gift || '—'" />
        </van-cell-group>
        <!-- 编辑模式 -->
        <van-cell-group v-else inset>
          <van-field v-model="form.name" label="商品名称" placeholder="请输入商品名称" input-align="right" />
          <van-field
            label="途径"
            input-align="right"
            is-link
            readonly
            :model-value="form.channel"
            @click="showChannelPicker = true"
          />
          <van-field v-model="form.orderNo" label="订单号" placeholder="请输入订单号" input-align="right" />
          <van-field
            v-model="form.price"
            type="number"
            label="下单价"
            placeholder="请输入下单价"
            input-align="right"
            :readonly="isPriceLocked"
          >
            <template #left-icon><span class="field-prefix">¥</span></template>
          </van-field>
          <van-field
            v-model="form.confirmDate"
            label="收货日期"
            placeholder="点击选择日期"
            readonly
            input-align="right"
            is-link
            @click="openDatePicker"
          />
          <van-field v-model="form.gift" label="赠品" placeholder="无" input-align="right" />
        </van-cell-group>
        <div v-if="editMode && isPriceLocked" class="price-lock-tip">
          <van-icon name="warning-o" /> 该商品已参与大套购结算，下单价已锁定
        </div>
      </div>

      <!-- 保价信息区（仅编辑模式显示） -->
      <div v-if="editMode" class="section-card">
        <div class="section-header">
          <van-icon name="shield-o" />
          <span>保价信息</span>
        </div>

        <!-- 平台保价 -->
        <div class="protect-block">
          <div class="block-title">
            <span>🏪 平台保价</span>
            <span class="block-sum">累计 ¥{{ fmt(protectSum(editPlatformEntries)) }}</span>
          </div>
          <div
            v-for="e in editPlatformEntries"
            :key="e.id"
            class="protect-entry"
          >
            <span class="entry-date">{{ e.createdAt.slice(5, 10) }}</span>
            <span class="entry-label">平台保价退款</span>
            <span class="entry-money">¥{{ fmt(e.amount) }}</span>
            <van-icon name="cross" class="entry-del" @click="removeProtectEntry('platform', e.id)" />
          </div>
          <div class="protect-add">
            <van-field
              v-model="newPlatformAmount"
              type="number"
              placeholder="新增补偿金额"
              class="protect-input"
            >
              <template #left-icon><span class="field-prefix">¥</span></template>
            </van-field>
            <van-button size="small" type="primary" @click="addProtectEntry('platform')">添加</van-button>
          </div>
        </div>

        <!-- 店铺保价 -->
        <div class="protect-block">
          <div class="block-title">
            <span>🏪 店铺保价</span>
            <span class="block-sum">累计 ¥{{ fmt(protectSum(editStoreEntries)) }}</span>
          </div>
          <div
            v-for="e in editStoreEntries"
            :key="e.id"
            class="protect-entry"
          >
            <span class="entry-date">{{ e.createdAt.slice(5, 10) }}</span>
            <span class="entry-label">店铺保价退款</span>
            <span class="entry-money">¥{{ fmt(e.amount) }}</span>
            <van-icon name="cross" class="entry-del" @click="removeProtectEntry('store', e.id)" />
          </div>
          <div class="protect-add">
            <van-field
              v-model="newStoreAmount"
              type="number"
              placeholder="新增补偿金额"
              class="protect-input"
            >
              <template #left-icon><span class="field-prefix">¥</span></template>
            </van-field>
            <van-button size="small" type="primary" @click="addProtectEntry('store')">添加</van-button>
          </div>
        </div>

        <!-- 迷住保价 -->
        <div class="protect-block">
          <div class="block-title"><span>🏠 迷住保价</span></div>
          <div class="mizhu-row">
            <span class="mizhu-label">保价类型</span>
            <van-radio-group v-model="form.mizhuType" direction="horizontal">
              <van-radio name="一类">一类</van-radio>
              <van-radio name="二类">二类</van-radio>
            </van-radio-group>
          </div>
          <div class="mizhu-row">
            <span class="mizhu-label">好价</span>
            <van-field
              v-model="form.mizhuPrice"
              type="number"
              placeholder="需低于下单价"
              class="protect-input"
            >
              <template #left-icon><span class="field-prefix">¥</span></template>
            </van-field>
          </div>
        </div>
      </div>

      <!-- 返现明细 -->
      <div class="section-card">
        <div class="section-header">
          <van-icon name="balance-list-o" />
          <span>返现明细</span>
        </div>

        <!-- 店铺侧 -->
        <div class="entry-group">
          <div class="group-header">
            <span class="group-name">
              <span class="dot dot-store" /> 店铺侧
            </span>
            <span class="group-amt">¥{{ fmt(calc.storeTotal) }}</span>
          </div>
          <div class="group-sub">
            <span>已返 <b class="text-green">¥{{ fmt(calc.storePaid) }}</b></span>
            <span>待返 <b class="text-red">¥{{ fmt(calc.storePending) }}</b></span>
          </div>
          <div
            v-for="e in storeEntries"
            :key="e.id"
            class="entry-row"
          >
            <div class="entry-info">
              <span class="entry-name">{{ entryLabel(e) }}</span>
              <van-tag :type="entryTagType(e)" plain size="medium">{{ entryTagText(e) }}</van-tag>
            </div>
            <span class="entry-money">¥{{ fmt(e.amount) }}</span>
          </div>
          <div v-if="storeEntries.length === 0" class="entry-empty">暂无返现条目</div>
        </div>

        <!-- 迷住侧 -->
        <div class="entry-group">
          <div class="group-header">
            <span class="group-name">
              <span class="dot dot-mizhu" /> 迷住侧
            </span>
            <span class="group-amt">¥{{ fmt(calc.mizhuTotal) }}</span>
          </div>
          <div class="group-sub">
            <span>已返 <b class="text-green">¥{{ fmt(calc.mizhuPaid) }}</b></span>
            <span>待返 <b class="text-red">¥{{ fmt(calc.mizhuPending) }}</b></span>
          </div>
          <div
            v-for="e in mizhuEntries"
            :key="e.id"
            class="entry-row"
          >
            <div class="entry-info">
              <span class="entry-name">{{ entryLabel(e) }}</span>
              <van-tag :type="entryTagType(e)" plain size="medium">{{ entryTagText(e) }}</van-tag>
            </div>
            <span class="entry-money">¥{{ fmt(e.amount) }}</span>
          </div>
          <div v-if="mizhuEntries.length === 0" class="entry-empty">暂无返现条目</div>
        </div>
      </div>

      <!-- 返现记录 -->
      <div v-if="sortedPayments.length > 0" class="section-card">
        <div class="section-header">
          <van-icon name="gold-pay-o" />
          <span>返现记录</span>
        </div>
        <div
          v-for="r in sortedPayments"
          :key="r.id"
          class="payment-row"
        >
          <div class="payment-left">
            <span class="payment-date">{{ r.date.slice(5) }}</span>
            <van-tag :type="r.payer === '店铺' ? 'danger' : 'success'" plain>{{ r.payer }}</van-tag>
          </div>
          <div class="payment-right">
            <span class="payment-amount">¥{{ fmt(r.amount) }}</span>
            <van-icon name="delete-o" class="payment-del" @click="removePayment(r.id)" />
          </div>
        </div>
      </div>

      <!-- 底部留白 -->
      <div style="height: 80px" />
    </template>

    <!-- 途径选择 -->
    <van-action-sheet
      v-model:show="showChannelPicker"
      :actions="channelActions"
      cancel-text="取消"
      close-on-click-action
      @select="onChannelSelect"
    />

    <!-- 日期选择 -->
    <van-popup v-model:show="showDatePicker" position="bottom" round>
      <van-date-picker
        v-model="datePickerValue"
        title="选择收货日期"
        @confirm="onDateConfirm"
        @cancel="showDatePicker = false"
      />
    </van-popup>

    <!-- 收到返现弹窗 -->
    <van-popup
      v-model:show="showPaymentPopup"
      position="bottom"
      round
      closeable
      close-icon-position="top-left"
      :style="{ maxHeight: '85%' }"
    >
      <div v-if="item" class="payment-popup">
        <div class="popup-title">💰 收到返现 · {{ item.name }}</div>

        <!-- 待返金额 -->
        <div class="pending-summary">
          <div class="summary-item">
            <div class="summary-label">店铺待返</div>
            <div class="summary-amt text-red">¥{{ fmt(calc.storePending) }}</div>
          </div>
          <div class="summary-divider" />
          <div class="summary-item">
            <div class="summary-label">迷住待返</div>
            <div class="summary-amt text-red">¥{{ fmt(calc.mizhuPending) }}</div>
          </div>
        </div>

        <!-- 本次收款 -->
        <div class="popup-section-title">本次收款</div>
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
      </div>
    </van-popup>

    <!-- 底部操作栏 -->
    <div v-if="item && !editMode" class="bottom-bar">
      <van-button
        v-if="item.status === '待收货'"
        type="primary"
        round
        @click="doConfirmReceipt"
      >确认收货</van-button>
      <van-button
        :type="item.status === '待收货' ? 'default' : 'success'"
        round
        :disabled="item.status === '待收货'"
        @click="openPaymentPopup"
      >收到返现</van-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast, showConfirmDialog, showSuccessToast } from 'vant'
import type { Item, CashbackEntry, PaymentRecord, Channel, MizhuProtectType, ItemStatus, Payer } from '@/types'
import { ENTRY_TYPE_MAP } from '@/types'
import {
  getItemWithDetails,
  updateItem,
  replaceItemEntries,
  createPayment,
  deletePayment,
} from '@/db/crud'
import { calcItem, type ItemCalc } from '@/calc/aggregate'
import { recalcDynamicEntries, updateDueDates } from '@/calc/recalc'
import { parseToYuan } from '@/calc/money'

const route = useRoute()
const router = useRouter()
const itemId = route.params.id as string

// ===== 数据状态 =====
const loading = ref(true)
const item = ref<Item | null>(null)
const entries = ref<CashbackEntry[]>([])
const payments = ref<PaymentRecord[]>([])
const editMode = ref(false)

// ===== 编辑表单 =====
const form = ref({
  name: '',
  channel: '淘宝' as Channel,
  orderNo: '',
  price: '',
  confirmDate: '',
  gift: '',
  mizhuType: '' as '一类' | '二类' | '',
  mizhuPrice: '',
})

// ===== 保价编辑 =====
const editPlatformEntries = ref<CashbackEntry[]>([])
const editStoreEntries = ref<CashbackEntry[]>([])
const newPlatformAmount = ref('')
const newStoreAmount = ref('')

// ===== 弹窗状态 =====
const showChannelPicker = ref(false)
const showDatePicker = ref(false)
const datePickerValue = ref<string[]>([])

const showPaymentPopup = ref(false)
const payAmount = ref('')
const payPayer = ref<Payer>('店铺')
const submitting = ref(false)

// ===== 计算属性 =====
const calc = computed<ItemCalc>(() => {
  if (!item.value) {
    return { storeTotal: 0, mizhuTotal: 0, finalPrice: 0, storePaid: 0, mizhuPaid: 0, storePending: 0, mizhuPending: 0, totalPending: 0 }
  }
  return calcItem(item.value, entries.value, payments.value)
})

const cashbackRate = computed(() => {
  if (!item.value || item.value.price === 0) return 0
  const total = calc.value.storeTotal + calc.value.mizhuTotal
  return Math.round((total / item.value.price) * 100)
})

/** 大套购已结算（非预估）→ 价格锁定 */
const isPriceLocked = computed(() => {
  const bp = entries.value.find(e => e.type === 'big_purchase')
  return bp ? !bp.isEstimated : false
})

const storeEntries = computed(() =>
  entries.value.filter(e => ENTRY_TYPE_MAP[e.type].payer === '店铺'),
)
const mizhuEntries = computed(() =>
  entries.value.filter(e => ENTRY_TYPE_MAP[e.type].payer === '迷住'),
)
const sortedPayments = computed(() =>
  [...payments.value].sort((a, b) => (a.date < b.date ? 1 : -1)),
)

const channelActions = [
  { name: '淘宝' },
  { name: '京东' },
  { name: '小程序' },
  { name: '其他' },
]

// ===== 工具方法 =====
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

function entryLabel(e: CashbackEntry): string {
  return e.customLabel ?? ENTRY_TYPE_MAP[e.type].label
}

function entryTagText(e: CashbackEntry): string {
  if (e.isEstimated) return '预估'
  return ENTRY_TYPE_MAP[e.type].dueRule
}

function entryTagType(e: CashbackEntry): 'warning' | 'primary' | 'default' {
  if (e.isEstimated) return 'warning'
  const rule = ENTRY_TYPE_MAP[e.type].dueRule
  if (rule === '即时') return 'primary'
  if (rule === '手动结算') return 'warning'
  return 'default'
}

function protectSum(list: CashbackEntry[]): number {
  return list.reduce((s, e) => s + e.amount, 0)
}

// ===== 数据加载 =====
async function loadData() {
  loading.value = true
  try {
    const data = await getItemWithDetails(itemId)
    if (!data) {
      item.value = null
      return
    }
    item.value = data.item
    entries.value = data.entries
    payments.value = data.payments
  } finally {
    loading.value = false
  }
}

onMounted(loadData)

// ===== 导航 =====
function onBack() {
  router.back()
}

// ===== 编辑模式 =====
function enterEdit() {
  if (!item.value) return
  const it = item.value
  form.value = {
    name: it.name,
    channel: it.channel,
    orderNo: it.orderNo,
    price: String(it.price),
    confirmDate: it.confirmDate ?? '',
    gift: it.gift,
    mizhuType: (it.mizhuProtectType ?? '') as '一类' | '二类' | '',
    mizhuPrice: it.mizhuProtectPrice != null ? String(it.mizhuProtectPrice) : '',
  }
  editPlatformEntries.value = entries.value
    .filter(e => e.type === 'platform_refund')
    .map(e => ({ ...e }))
  editStoreEntries.value = entries.value
    .filter(e => e.type === 'store_refund')
    .map(e => ({ ...e }))
  newPlatformAmount.value = ''
  newStoreAmount.value = ''
  editMode.value = true
}

function onChannelSelect(action: { name: string }) {
  form.value.channel = action.name as Channel
  showChannelPicker.value = false
}

function openDatePicker() {
  if (form.value.confirmDate) {
    datePickerValue.value = form.value.confirmDate.split('-')
  } else {
    const now = new Date()
    datePickerValue.value = [
      String(now.getFullYear()),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ]
  }
  showDatePicker.value = true
}

function onDateConfirm({ selectedValues }: { selectedValues: string[] }) {
  form.value.confirmDate = selectedValues.join('-')
  showDatePicker.value = false
}

// ===== 保价条目编辑 =====
function addProtectEntry(side: 'platform' | 'store') {
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
    itemId,
    type: side === 'platform' ? 'platform_refund' : 'store_refund',
    customLabel: null,
    amount,
    dueDate: null,
    isEstimated: false,
    createdAt: new Date().toISOString(),
  }
  if (side === 'platform') {
    editPlatformEntries.value.push(entry)
    newPlatformAmount.value = ''
  } else {
    editStoreEntries.value.push(entry)
    newStoreAmount.value = ''
  }
}

function removeProtectEntry(side: 'platform' | 'store', id: string) {
  const list = side === 'platform' ? editPlatformEntries.value : editStoreEntries.value
  const idx = list.findIndex(e => e.id === id)
  if (idx >= 0) list.splice(idx, 1)
}

// ===== 保存编辑 =====
async function saveEdit() {
  if (!item.value) return

  // 校验
  if (!form.value.name.trim()) {
    showToast('请输入商品名称')
    return
  }
  const newPrice = parseToYuan(form.value.price)
  if (newPrice <= 0) {
    showToast('请输入有效的下单价')
    return
  }

  // 价格锁定校验
  if (isPriceLocked.value && newPrice !== item.value.price) {
    showToast('该商品已参与大套购结算，下单价已锁定')
    return
  }

  // 迷住保价校验
  const mizhuType: MizhuProtectType = form.value.mizhuType || null
  const mizhuPrice = form.value.mizhuPrice ? parseToYuan(form.value.mizhuPrice) : null
  if (mizhuType && mizhuPrice != null && mizhuPrice >= newPrice) {
    showToast('好价必须低于下单价')
    return
  }

  // 合成更新后的 item
  const updatedItem: Item = {
    ...item.value,
    name: form.value.name.trim(),
    channel: form.value.channel,
    orderNo: form.value.orderNo.trim(),
    price: newPrice,
    gift: form.value.gift.trim(),
    confirmDate: form.value.confirmDate || null,
    mizhuProtectType: mizhuType,
    mizhuProtectPrice: mizhuPrice,
  }

  // 合并 entries：保留非保价条目 + 编辑后的保价条目
  const keepEntries = entries.value.filter(
    e => e.type !== 'platform_refund' && e.type !== 'store_refund' && e.type !== 'mizhu_protect',
  )
  const merged = [...keepEntries, ...editPlatformEntries.value, ...editStoreEntries.value]

  // 动态重算
  let finalEntries = recalcDynamicEntries(updatedItem, merged)

  // 若已确认收货，补算 dueDate
  if (updatedItem.confirmDate) {
    finalEntries = updateDueDates(finalEntries, updatedItem.confirmDate)
  }

  await replaceItemEntries(itemId, finalEntries)
  await updateItem(itemId, {
    name: updatedItem.name,
    channel: updatedItem.channel,
    orderNo: updatedItem.orderNo,
    price: updatedItem.price,
    gift: updatedItem.gift,
    confirmDate: updatedItem.confirmDate,
    mizhuProtectType: updatedItem.mizhuProtectType,
    mizhuProtectPrice: updatedItem.mizhuProtectPrice,
  })

  editMode.value = false
  showSuccessToast('已保存')
  await loadData()
}

// ===== 确认收货 =====
async function doConfirmReceipt() {
  if (!item.value) return
  try {
    await showConfirmDialog({
      title: '确认收货',
      message: '确认已收到商品？将进入待返现状态。',
    })
  } catch {
    return
  }

  const today = new Date().toISOString().slice(0, 10)
  const updatedItem = { ...item.value, confirmDate: today }
  let newEntries = recalcDynamicEntries(updatedItem, entries.value)
  newEntries = updateDueDates(newEntries, today)
  await replaceItemEntries(itemId, newEntries)
  await updateItem(itemId, { status: '待返现', confirmDate: today })
  showSuccessToast('已确认收货')
  await loadData()
}

// ===== 收到返现 =====
function openPaymentPopup() {
  payAmount.value = ''
  payPayer.value = '店铺'
  showPaymentPopup.value = true
}

async function confirmPayment() {
  const amount = parseToYuan(payAmount.value)
  if (amount <= 0) {
    showToast('请输入有效金额')
    return
  }
  // 校验：收款金额不得超过对应付款方的待返金额
  const pending = payPayer.value === '店铺'
    ? calc.value.storePending
    : calc.value.mizhuPending
  if (amount > pending) {
    showToast(`${payPayer.value}待返仅剩 ¥${pending.toFixed(2)}，不可超额收款`)
    return
  }
  submitting.value = true
  try {
    await createPayment({
      itemId,
      date: new Date().toISOString().slice(0, 10),
      amount,
      payer: payPayer.value,
    })
    payAmount.value = ''
    showPaymentPopup.value = false
    showSuccessToast('收款已记录')
    await loadData()
  } finally {
    submitting.value = false
  }
}

async function removePayment(id: string) {
  await deletePayment(id)
  showSuccessToast('已删除')
  await loadData()
}
</script>

<style scoped>
.item-detail-page {
  min-height: 100vh;
  background: #f7f8fa;
  padding-bottom: env(safe-area-inset-bottom);
}

/* 导航栏编辑按钮 */
.nav-edit-btn {
  font-size: 14px;
  font-weight: 500;
  color: #1989fa;
}

/* 加载 */
.loading-wrap {
  display: flex;
  justify-content: center;
  padding: 80px 0;
}

/* ===== 到手价大卡片 ===== */
.final-card {
  margin: 12px;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(25, 137, 250, 0.25);
}

.final-card-inner {
  background: linear-gradient(135deg, #1989fa 0%, #36cfc9 100%);
  padding: 24px 20px;
  color: #fff;
}

.final-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.final-label {
  font-size: 14px;
  opacity: 0.9;
}

.final-price {
  font-size: 36px;
  font-weight: 700;
  line-height: 1.2;
  margin: 4px 0 12px;
}

.final-meta {
  display: flex;
  align-items: center;
  gap: 20px;
}

.meta-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.meta-label {
  font-size: 12px;
  opacity: 0.8;
}

.meta-value {
  font-size: 16px;
  font-weight: 600;
}

.meta-divider {
  width: 1px;
  height: 28px;
  background: rgba(255, 255, 255, 0.3);
}

/* ===== 通用卡片 ===== */
.section-card {
  background: #fff;
  border-radius: 12px;
  margin: 0 12px 12px;
  padding: 14px 0 4px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.section-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 16px 10px;
  font-size: 15px;
  font-weight: 600;
  color: #323233;
}

.section-header .van-icon {
  font-size: 16px;
  color: #1989fa;
}

/* 基本信息单元格 */
.section-card :deep(.van-cell-group--inset) {
  margin: 0;
}

.cell-price {
  font-weight: 600;
  color: #ee0a24;
}

.field-prefix {
  color: #969799;
  font-size: 14px;
}

.price-lock-tip {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 16px 10px;
  font-size: 12px;
  color: #ff976a;
}

/* ===== 保价信息 ===== */
.protect-block {
  margin: 0 16px 12px;
  border: 1px solid #f2f3f5;
  border-radius: 8px;
  overflow: hidden;
}

.block-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: #f7f8fa;
  font-size: 14px;
  font-weight: 500;
}

.block-sum {
  font-size: 12px;
  color: #969799;
}

.protect-entry {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-top: 1px solid #f7f8fa;
  font-size: 13px;
}

.protect-entry .entry-date {
  color: #969799;
  width: 44px;
  flex-shrink: 0;
}

.protect-entry .entry-label {
  color: #323233;
  flex: 1;
}

.protect-entry .entry-money {
  font-weight: 600;
  color: #ee0a24;
}

.protect-entry .entry-del {
  color: #c8c9cc;
  font-size: 14px;
  padding: 4px;
}

.protect-add {
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

/* ===== 返现明细 ===== */
.entry-group {
  padding: 0 16px;
  margin-bottom: 12px;
}

.entry-group:last-child {
  margin-bottom: 4px;
}

.group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 4px;
}

.group-name {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 500;
  color: #323233;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.dot-store {
  background: #1989fa;
}

.dot-mizhu {
  background: #ff976a;
}

.group-amt {
  font-size: 15px;
  font-weight: 600;
  color: #323233;
}

.group-sub {
  display: flex;
  gap: 16px;
  padding-bottom: 8px;
  font-size: 12px;
  color: #969799;
}

.group-sub b {
  font-weight: 600;
}

.text-red {
  color: #ee0a24;
}

.text-green {
  color: #07c160;
}

.entry-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid #f7f8fa;
}

.entry-row:last-child {
  border-bottom: none;
}

.entry-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.entry-name {
  font-size: 14px;
  color: #323233;
}

.entry-money {
  font-size: 14px;
  font-weight: 600;
  color: #323233;
}

.entry-empty {
  text-align: center;
  color: #c8c9cc;
  font-size: 13px;
  padding: 12px 0;
}

/* ===== 返现记录 ===== */
.payment-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  border-bottom: 1px solid #f7f8fa;
}

.payment-row:last-child {
  border-bottom: none;
}

.payment-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.payment-date {
  font-size: 13px;
  color: #969799;
}

.payment-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.payment-amount {
  font-size: 15px;
  font-weight: 600;
  color: #323233;
}

.payment-del {
  color: #c8c9cc;
  font-size: 16px;
  padding: 2px;
}

/* ===== 收到返现弹窗 ===== */
.payment-popup {
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

.text-gray {
  color: #969799;
}

.popup-section-title {
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

/* ===== 底部操作栏 ===== */
.bottom-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  gap: 12px;
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
  background: #fff;
  box-shadow: 0 -1px 8px rgba(0, 0, 0, 0.06);
  z-index: 100;
}

.bottom-bar .van-button {
  flex: 1;
}
</style>
