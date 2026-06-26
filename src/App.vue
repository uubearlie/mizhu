<template>
  <van-config-provider :theme-vars="themeVars">
    <div class="app-container">
      <router-view />
      <van-tabbar v-model="active" route v-if="showTabbar">
        <van-tabbar-item to="/" icon="wap-home-o">首页</van-tabbar-item>
        <van-tabbar-item to="/items" icon="orders-o">订单</van-tabbar-item>
        <van-tabbar-item to="/pending" icon="balance-o">待返</van-tabbar-item>
        <van-tabbar-item to="/reports" icon="chart-trending-o">统计</van-tabbar-item>
      </van-tabbar>
    </div>
  </van-config-provider>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import type { ConfigProviderThemeVars } from 'vant'

const route = useRoute()
const active = ref(0)

const hideTabbarRoutes = ['item-form', 'item-detail', 'activity-form', 'batch-confirm', 'settlement']
const showTabbar = ref(true)

watch(() => route.name, (name) => {
  showTabbar.value = !hideTabbarRoutes.includes(name as string)
}, { immediate: true })

const themeVars: ConfigProviderThemeVars = {
  primaryColor: '#5b8def',
  successColor: '#34c759',
  dangerColor: '#ff5a5f',
  warningColor: '#ffb340',
  navBarBackground: '#fafbfc',
  tabbarItemActiveColor: '#5b8def',
  buttonPrimaryBackground: '#5b8def',
  buttonPrimaryBorderColor: '#5b8def',
}
</script>

<style scoped>
.app-container {
  max-width: 430px;
  margin: 0 auto;
  min-height: 100vh;
  background: var(--mz-bg, #f5f7fa);
  position: relative;
}
</style>
