import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('../views/Home.vue'),
    meta: { title: '骑行记录' }
  },
  {
    path: '/entry',
    name: 'Entry',
    component: () => import('../views/Entry.vue'),
    meta: { title: '录入数据' }
  },
  {
    path: '/charts',
    name: 'Charts',
    component: () => import('../views/Charts.vue'),
    meta: { title: '图表分析' }
  },
  {
    path: '/charging',
    name: 'Charging',
    component: () => import('../views/Charging.vue'),
    meta: { title: '充电管理' }
  },
  {
    path: '/charging-entry',
    name: 'ChargingEntry',
    component: () => import('../views/ChargingEntry.vue'),
    meta: { title: '记录充电' }
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('../views/Settings.vue'),
    meta: { title: '设置' }
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
