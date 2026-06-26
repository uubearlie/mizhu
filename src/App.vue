<template>
  <div class="app-container">
    <router-view />
    <van-tabbar v-model="active" route v-if="showTabbar">
      <van-tabbar-item to="/" icon="wap-home-o">首页</van-tabbar-item>
      <van-tabbar-item to="/items" icon="orders-o">商品</van-tabbar-item>
      <van-tabbar-item to="/pending" icon="balance-o">待返</van-tabbar-item>
      <van-tabbar-item to="/reports" icon="chart-trending-o">统计</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const active = ref(0)

const hideTabbarRoutes = ['item-form', 'item-detail', 'activity-form', 'batch-confirm', 'settlement']
const showTabbar = ref(true)

watch(() => route.name, (name) => {
  showTabbar.value = !hideTabbarRoutes.includes(name as string)
}, { immediate: true })
</script>

<style scoped>
.app-container {
  max-width: 430px;
  margin: 0 auto;
  min-height: 100vh;
  background: #f7f8fa;
  position: relative;
}
</style>
