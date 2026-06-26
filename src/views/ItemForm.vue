<template>
  <div class="item-form-page">
    <!-- NavBar -->
    <van-nav-bar
      title="新建商品记录"
      left-arrow
      fixed
      placeholder
      @click-left="router.back()"
    />

    <!-- No activity guard -->
    <div v-if="!activityId" class="empty-activity">
      <van-empty description="请先在首页选择活动">
        <van-button type="primary" round @click="router.push('/')">去首页</van-button>
      </van-empty>
    </div>

    <!-- Form -->
    <template v-else>
      <!-- ===== Section 1: 基本信息 ===== -->
      <van-cell-group inset title="基本信息" class="form-section">
        <van-field
          v-model="form.name"
          label="型号/商品名"
          placeholder="请输入商品名称"
          required
          clearable
        />
        <van-field
          v-model="form.channel"
          label="下单途径"
          placeholder="请选择"
          readonly
          is-link
          input-align="right"
          @click="openChannelPicker"
        />
        <van-field
          v-model="form.orderNo"
          label="订单号"
          placeholder="请输入订单号"
          clearable
        />
        <van-field
          v-model="form.price"
          label="下单价"
          placeholder="0.00"
          type="number"
          required
        >
          <template #left-icon><span class="currency">¥</span></template>
        </van-field>
        <van-field
          v-model="form.gift"
          label="赠品"
          placeholder="如有赠品请填写"
          clearable
        />
      </van-cell-group>

      <!-- ===== Section 2 & 3: Collapse ===== -->
      <van-collapse v-model="activeNames" class="form-section">
        <!-- Section 2: 返现明细 -->
        <van-collapse-item title="返现明细" name="cashback">
          <!-- 店铺侧 -->
          <div class="sub-title">店铺侧</div>
          <div
            v-for="row in storeRows"
            :key="row.type"
            class="check-row"
          >
            <van-checkbox v-model="row.checked" shape="square" />
            <span v-if="row.type !== 'other'" class="check-name">{{ row.label }}</span>
            <input
              v-else
              v-model="row.customLabel"
              class="custom-name-input"
              placeholder="自定义名称"
            />
            <van-field
              v-model="row.amount"
              type="number"
              placeholder="0.00"
              class="amount-field"
              input-align="right"
              :disabled="!row.checked"
            >
              <template #left-icon><span class="currency">¥</span></template>
            </van-field>
          </div>

          <!-- 迷住侧 -->
          <div class="sub-title mizhu-divider">迷住侧</div>
          <div class="amount-row">
            <span class="row-label">迷住返</span>
            <van-field
              v-model="mizhuExtra"
              type="number"
              placeholder="0.00"
              class="amount-field"
              input-align="right"
            >
              <template #left-icon><span class="currency">¥</span></template>
            </van-field>
          </div>
          <div class="amount-row">
            <span class="row-label">舰长神券</span>
            <van-field
              v-model="captainCoupon"
              type="number"
              placeholder="0.00"
              class="amount-field"
              input-align="right"
            >
              <template #left-icon><span class="currency">¥</span></template>
            </van-field>
          </div>
          <div class="amount-row">
            <span class="row-label">装修神券</span>
            <van-field
              v-model="renovationCoupon"
              type="number"
              placeholder="0.00"
              class="amount-field"
              input-align="right"
            >
              <template #left-icon><span class="currency">¥</span></template>
            </van-field>
          </div>
          <div class="mutex-hint">
            <van-icon name="info-o" /> 舰长神券与装修神券互斥，填写一项将清空另一项
          </div>
        </van-collapse-item>

        <!-- Section 3: 品牌套购 -->
        <van-collapse-item title="品牌套购" name="brand">
          <div class="brand-hint">选择参与的套购方案，不选则不参与</div>
          <van-radio-group v-model="brandChoice">
            <div class="brand-row">
              <van-radio name="0.98">选项1</van-radio>
              <span class="brand-coef-text">系数 0.98</span>
            </div>
            <div class="brand-row">
              <van-radio name="0.95">选项2</van-radio>
              <span class="brand-coef-text">系数 0.95</span>
            </div>
            <div class="brand-row">
              <van-radio name="custom">自定义</van-radio>
              <van-field
                v-model="brandCustomInput"
                type="number"
                placeholder="输入系数"
                class="coef-input"
                :disabled="brandChoice !== 'custom'"
              >
                <template #left-icon><span class="coef-prefix">系数</span></template>
              </van-field>
            </div>
          </van-radio-group>
        </van-collapse-item>
      </van-collapse>
    </template>

    <!-- Channel Picker Popup -->
    <van-popup v-model:show="showChannelPicker" round position="bottom">
      <van-picker
        v-model="channelPickerValue"
        :columns="channelColumns"
        title="选择下单途径"
        @confirm="onChannelConfirm"
        @cancel="showChannelPicker = false"
      />
    </van-popup>

    <!-- Fixed Bottom Save Button -->
    <div v-if="activityId" class="save-bar">
      <van-button type="primary" block round :loading="saving" @click="onSave">
        保存
      </van-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import { showToast, showSuccessToast } from 'vant'
import type { Item, CashbackEntry, CashbackEntryType, Channel } from '@/types'
import { createItem, replaceItemEntries } from '@/db/crud'
import { recalcDynamicEntries, validateItem } from '@/calc/recalc'
import { parseToYuan } from '@/calc/money'

const router = useRouter()

// ===== 活动上下文 =====
const activityId = ref(localStorage.getItem('mizhu_current_activity_id') || '')

// ===== Section 1: 基本信息 =====
const form = reactive({
  name: '',
  channel: '淘宝' as Channel,
  orderNo: '',
  price: '',
  gift: '',
})

// ===== 下单途径 picker =====
const showChannelPicker = ref(false)
const channelPickerValue = ref<string[]>(['淘宝'])
const channelColumns = [
  { text: '淘宝', value: '淘宝' },
  { text: '京东', value: '京东' },
  { text: '小程序', value: '小程序' },
  { text: '其他', value: '其他' },
]

function openChannelPicker() {
  channelPickerValue.value = [form.channel]
  showChannelPicker.value = true
}

function onChannelConfirm({ selectedValues }: { selectedValues: string[] }) {
  form.channel = (selectedValues[0] as Channel) || '淘宝'
  showChannelPicker.value = false
}

// ===== Section 2: 返现明细 =====
interface StoreRow {
  type: CashbackEntryType
  label: string
  checked: boolean
  amount: string
  customLabel: string
}

const storeRows = reactive<StoreRow[]>([
  { type: 'instant_cashback', label: '下单即返', checked: false, amount: '', customLabel: '' },
  { type: 'xhs_post', label: '小红书晒单', checked: false, amount: '', customLabel: '' },
  { type: 'combo', label: '组合购', checked: false, amount: '', customLabel: '' },
  { type: 'other', label: '其他', checked: false, amount: '', customLabel: '' },
])

// 迷住侧
const mizhuExtra = ref('')
const captainCoupon = ref('')
const renovationCoupon = ref('')

// 舰长神券与装修神券互斥：填一个清空另一个
watch(captainCoupon, (val) => {
  if (val) renovationCoupon.value = ''
})
watch(renovationCoupon, (val) => {
  if (val) captainCoupon.value = ''
})

// ===== Section 3: 品牌套购 =====
const brandChoice = ref('') // '' | '0.98' | '0.95' | 'custom'
const brandCustomInput = ref('')

const resolvedCoefficient = computed<number | null>(() => {
  if (brandChoice.value === '0.98') return 0.98
  if (brandChoice.value === '0.95') return 0.95
  if (brandChoice.value === 'custom') {
    const n = parseFloat(brandCustomInput.value)
    return !isNaN(n) && n > 0 ? n : null
  }
  return null
})

// ===== Collapse 状态 =====
const activeNames = ref<string[]>([]) // 返现明细、品牌套购 默认折叠

const saving = ref(false)

// ===== 构建 Entries =====
function buildEntries(itemId: string, price: number): CashbackEntry[] {
  const now = new Date().toISOString()
  const entries: CashbackEntry[] = []

  // big_purchase（预估，price * 0.05）
  entries.push({
    id: crypto.randomUUID(),
    itemId,
    type: 'big_purchase',
    customLabel: null,
    amount: Math.round(price * 0.05 * 100) / 100,
    dueDate: null,
    isEstimated: true,
    createdAt: now,
  })

  // 店铺侧手填条目
  for (const row of storeRows) {
    if (!row.checked) continue
    const amount = parseToYuan(row.amount)
    if (amount <= 0) continue
    entries.push({
      id: crypto.randomUUID(),
      itemId,
      type: row.type,
      customLabel: row.type === 'other' ? (row.customLabel.trim() || '其他') : null,
      amount,
      dueDate: null,
      isEstimated: false,
      createdAt: now,
    })
  }

  // 迷住侧条目
  const mizhuEntries: Array<[string, CashbackEntryType]> = [
    [mizhuExtra.value, 'mizhu_extra'],
    [captainCoupon.value, 'captain_coupon'],
    [renovationCoupon.value, 'renovation_coupon'],
  ]
  for (const [val, type] of mizhuEntries) {
    if (!val) continue
    const amount = parseToYuan(val)
    if (amount <= 0) continue
    entries.push({
      id: crypto.randomUUID(),
      itemId,
      type,
      customLabel: null,
      amount,
      dueDate: null,
      isEstimated: false,
      createdAt: now,
    })
  }

  return entries
}

// ===== 保存 =====
async function onSave() {
  if (!activityId.value) {
    showToast('请先选择活动')
    return
  }

  const name = form.name.trim()
  if (!name) {
    showToast('请输入商品名称')
    return
  }
  const price = parseToYuan(form.price)
  if (!price || price <= 0) {
    showToast('请输入有效的下单价')
    return
  }

  const coefficient = resolvedCoefficient.value

  // 构建临时 Item 用于校验 + 重算
  const tempItem: Item = {
    id: '__temp__',
    activityId: activityId.value,
    name,
    channel: form.channel,
    orderNo: form.orderNo.trim(),
    price,
    gift: form.gift.trim(),
    remark: '',
    confirmDate: null,
    status: '待收货',
    brandCoefficient: coefficient,
    mizhuProtectType: null,
    mizhuProtectPrice: null,
    isDeleted: false,
    createdAt: new Date().toISOString(),
  }

  // 构建 entries（big_purchase + 手填返现）
  const entries = buildEntries('__temp__', price)

  // 触发动态重算：自动生成/更新 brand entry、big_purchase 金额
  const finalEntries = recalcDynamicEntries(tempItem, entries)

  // 校验
  const error = validateItem(tempItem, finalEntries)
  if (error) {
    showToast(error)
    return
  }

  // 保存
  saving.value = true
  try {
    const itemId = await createItem({
      activityId: activityId.value,
      name,
      channel: form.channel,
      orderNo: form.orderNo.trim(),
      price,
      gift: form.gift.trim(),
      remark: '',
      confirmDate: null,
      status: '待收货',
      brandCoefficient: coefficient,
      mizhuProtectType: null,
      mizhuProtectPrice: null,
    })

    // 用真实 itemId 保存 entries
    const entriesToSave = finalEntries.map(e => ({ ...e, itemId }))
    await replaceItemEntries(itemId, entriesToSave)

    showSuccessToast('保存成功')
    router.replace('/items')
  } catch {
    showToast('保存失败，请重试')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.item-form-page {
  min-height: 100vh;
  background: #f7f8fa;
  padding-bottom: 100px;
}

.empty-activity {
  padding-top: 80px;
}

.form-section {
  margin-top: 12px;
}

/* 金额符号 */
.currency {
  color: #ee0a24;
  font-weight: 600;
  font-size: 15px;
}

/* ===== 返现明细 ===== */
.sub-title {
  font-size: 13px;
  color: #969799;
  font-weight: 500;
  padding: 4px 0;
}

.mizhu-divider {
  margin-top: 16px;
  border-top: 1px solid #f2f3f5;
  padding-top: 12px;
}

/* 店铺侧 check + 金额 */
.check-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid #f7f8fa;
}

.check-name {
  font-size: 14px;
  color: #323233;
  flex: 1;
}

.custom-name-input {
  flex: 1;
  border: none;
  border-bottom: 1px solid #dcdee0;
  background: transparent;
  font-size: 14px;
  padding: 2px 0;
  outline: none;
  color: #323233;
}

.custom-name-input::placeholder {
  color: #c8c9cc;
}

.custom-name-input:focus {
  border-bottom-color: #1989fa;
}

/* 金额输入 */
.amount-field {
  flex: 0 0 120px;
  padding: 4px 8px;
  background: #f7f8fa;
  border-radius: 6px;
}

.amount-field :deep(.van-field__body) {
  font-size: 14px;
}

/* 迷住侧行 */
.amount-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid #f7f8fa;
}

.amount-row .amount-field {
  flex: 1;
}

.row-label {
  font-size: 14px;
  color: #323233;
  width: 72px;
  flex-shrink: 0;
}

.mutex-hint {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #969799;
  margin-top: 8px;
}

/* ===== 品牌套购 ===== */
.brand-hint {
  font-size: 12px;
  color: #969799;
  padding: 4px 0 8px;
}

.brand-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid #f7f8fa;
}

.brand-row:last-child {
  border-bottom: none;
}

.brand-coef-text {
  margin-left: auto;
  font-size: 13px;
  color: #969799;
}

.coef-input {
  flex: 0 0 120px;
  padding: 4px 8px;
  background: #f7f8fa;
  border-radius: 6px;
  margin-left: auto;
}

.coef-prefix {
  font-size: 12px;
  color: #969799;
}

.coef-input :deep(.van-field__body) {
  font-size: 14px;
}

/* ===== 底部保存按钮 ===== */
.save-bar {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: 430px;
  background: #fff;
  padding: 12px 16px;
  border-top: 1px solid #ebedf0;
  z-index: 50;
  padding-bottom: calc(12px + env(safe-area-inset-bottom));
}
</style>
