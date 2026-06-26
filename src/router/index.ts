import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: () => import('@/views/Home.vue') },
    { path: '/items', name: 'items', component: () => import('@/views/Items.vue') },
    { path: '/pending', name: 'pending', component: () => import('@/views/Pending.vue') },
    { path: '/reports', name: 'reports', component: () => import('@/views/Reports.vue') },
    { path: '/item-form', name: 'item-form', component: () => import('@/views/ItemForm.vue') },
    { path: '/item-detail/:id', name: 'item-detail', component: () => import('@/views/ItemDetail.vue') },
    { path: '/activity-form', name: 'activity-form', component: () => import('@/views/ActivityForm.vue') },
    { path: '/batch-confirm', name: 'batch-confirm', component: () => import('@/views/BatchConfirm.vue') },
    { path: '/settlement', name: 'settlement', component: () => import('@/views/Settlement.vue') },
  ],
})

export default router
