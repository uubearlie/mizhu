<template>
  <div class="activity-form">
    <van-nav-bar
      :title="isEdit ? '编辑活动' : '新建活动'"
      left-arrow
      fixed
      placeholder
      @click-left="router.back()"
    />

    <div class="form-content">
      <!-- ===== 基本信息 ===== -->
      <div class="section-title">基本信息</div>
      <van-cell-group inset>
        <van-field
          v-model="form.name"
          label="活动名称"
          placeholder="请输入活动名称"
          required
        />
        <van-field
          :model-value="form.startDate"
          label="开始日期"
          placeholder="请选择日期"
          readonly
          is-link
          input-align="right"
          @click="openDatePicker('start')"
        />
        <van-field
          :model-value="form.endDate"
          label="结束日期"
          placeholder="请选择日期"
          readonly
          is-link
          input-align="right"
          @click="openDatePicker('end')"
        />
      </van-cell-group>

      <!-- ===== 大套购规则 ===== -->
      <div class="section-title">大套购规则</div>
      <van-cell-group inset>
        <van-cell title="启用大套购" center>
          <template #right-icon>
            <van-switch v-model="bigPurchaseEnabled" />
          </template>
        </van-cell>
      </van-cell-group>

      <div v-if="bigPurchaseEnabled" class="rules-wrap">
        <div
          v-for="(rule, index) in rules"
          :key="index"
          class="rule-row"
        >
          <span class="rule-prefix">满</span>
          <input
            v-model="rule.threshold"
            type="text"
            inputmode="decimal"
            class="rule-input"
            placeholder="金额"
          />
          <span class="rule-prefix">返</span>
          <input
            v-model="rule.cashback"
            type="text"
            inputmode="decimal"
            class="rule-input"
            placeholder="返现"
          />
          <van-icon
            name="cross"
            size="18"
            class="rule-delete"
            @click="removeRule(index)"
          />
        </div>

        <button class="add-rule-btn" @click="addRule">
          <van-icon name="add-o" /> 添加档位
        </button>
      </div>
    </div>

    <!-- ===== 底部保存按钮 ===== -->
    <div class="bottom-bar">
      <van-button type="primary" block round :loading="saving" @click="onSave">
        保存
      </van-button>
    </div>

    <!-- ===== 日期选择器 ===== -->
    <van-popup v-model:show="showDatePicker" position="bottom">
      <van-date-picker
        v-model="datePickerValue"
        title="选择日期"
        :min-date="minDate"
        :max-date="maxDate"
        @confirm="onDateConfirm"
        @cancel="showDatePicker = false"
      />
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { showToast } from 'vant'
import type { BigPurchaseRule } from '@/types'
import {
  createActivity,
  updateActivity,
  getActivity,
  DEFAULT_BIG_PURCHASE_RULES,
} from '@/db/crud'

const router = useRouter()
const route = useRoute()

// ---- Edit mode detection ----

const isEdit = route.query.edit === '1'
const editId = (route.query.id as string) || ''

// ---- Form state ----

const form = reactive({
  name: '',
  startDate: '',
  endDate: '',
})

const bigPurchaseEnabled = ref(true)

interface RuleRow {
  threshold: string
  cashback: string
}
const rules = ref<RuleRow[]>([])

const saving = ref(false)

// ---- Date picker ----

const showDatePicker = ref(false)
const datePickerValue = ref<string[]>([])
const datePickerTarget = ref<'start' | 'end'>('start')
const minDate = new Date(2020, 0, 1)
const maxDate = new Date(2035, 11, 31)

function todayArray(): string[] {
  const d = new Date()
  return [
    String(d.getFullYear()),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ]
}

function openDatePicker(target: 'start' | 'end') {
  datePickerTarget.value = target
  const current = target === 'start' ? form.startDate : form.endDate
  datePickerValue.value = current ? current.split('-') : todayArray()
  showDatePicker.value = true
}

function onDateConfirm({ selectedValues }: { selectedValues: string[] }) {
  const dateStr = selectedValues.join('-')
  if (datePickerTarget.value === 'start') {
    form.startDate = dateStr
  } else {
    form.endDate = dateStr
  }
  showDatePicker.value = false
}

// ---- Rules management ----

function addRule() {
  rules.value.push({ threshold: '', cashback: '' })
}

function removeRule(index: number) {
  rules.value.splice(index, 1)
}

function toRuleRows(rs: BigPurchaseRule[]): RuleRow[] {
  return rs.map(r => ({ threshold: String(r.threshold), cashback: String(r.cashback) }))
}

function toRules(rows: RuleRow[]): BigPurchaseRule[] {
  return rows
    .filter(r => r.threshold !== '' && r.cashback !== '')
    .map(r => ({ threshold: Number(r.threshold), cashback: Number(r.cashback) }))
    .sort((a, b) => a.threshold - b.threshold)
}

// ---- Save ----

async function onSave() {
  if (!form.name.trim()) {
    showToast('请输入活动名称')
    return
  }

  const bigPurchaseRules = bigPurchaseEnabled.value ? toRules(rules.value) : []

  saving.value = true
  try {
    if (isEdit && editId) {
      await updateActivity(editId, {
        name: form.name.trim(),
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        bigPurchaseRules,
      })
    } else {
      await createActivity({
        name: form.name.trim(),
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        status: '进行中',
        bigPurchaseRules: bigPurchaseRules.length > 0
          ? bigPurchaseRules
          : [...DEFAULT_BIG_PURCHASE_RULES],
      })
    }
    router.push('/')
  } finally {
    saving.value = false
  }
}

// ---- Init ----

onMounted(async () => {
  if (isEdit && editId) {
    const activity = await getActivity(editId)
    if (activity) {
      form.name = activity.name
      form.startDate = activity.startDate?.slice(0, 10) ?? ''
      form.endDate = activity.endDate?.slice(0, 10) ?? ''
      bigPurchaseEnabled.value = activity.bigPurchaseRules.length > 0
      rules.value = toRuleRows(activity.bigPurchaseRules)
    }
  } else {
    rules.value = toRuleRows(DEFAULT_BIG_PURCHASE_RULES)
  }
})
</script>

<style scoped>
.activity-form {
  min-height: 100vh;
  background: #f7f8fa;
  padding-bottom: calc(80px + env(safe-area-inset-bottom));
}

.form-content {
  padding: 12px 0;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #646566;
  padding: 8px 28px;
  margin-top: 4px;
}

/* Rules */
.rules-wrap {
  margin: 8px 16px 0;
  background: #fff;
  border-radius: 12px;
  padding: 12px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.rule-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid #f2f3f5;
}

.rule-row:last-of-type {
  border-bottom: none;
}

.rule-prefix {
  font-size: 14px;
  color: #323233;
  white-space: nowrap;
}

.rule-input {
  flex: 1;
  min-width: 0;
  border: 1px solid #ebedf0;
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 14px;
  text-align: center;
  outline: none;
  background: #f7f8fa;
}

.rule-input:focus {
  border-color: #1989fa;
  background: #fff;
}

.rule-delete {
  color: #ee0a24;
  padding: 0 4px;
  flex-shrink: 0;
}

.add-rule-btn {
  width: 100%;
  margin-top: 10px;
  padding: 10px;
  border: 1px dashed #c8c9cc;
  border-radius: 8px;
  background: #f7f8fa;
  color: #969799;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  cursor: pointer;
}

/* Bottom bar */
.bottom-bar {
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
