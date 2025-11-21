<script setup>
import { onMounted, computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from './stores'

const router = useRouter()
const store = useAppStore()

const transitionName = ref('fade')
const lastTabIndex = ref(0)

const active = computed(() => {
  const path = router.currentRoute.value.path
  if (path === '/') return 0
  if (path === '/entry') return 1
  if (path === '/charts') return 2
  if (path === '/settings') return 3
  return 0
})

// 监听路由变化，设置过渡动画
watch(active, (newIndex, oldIndex) => {
  if (newIndex > oldIndex) {
    transitionName.value = 'slide-left'
  } else {
    transitionName.value = 'slide-right'
  }
  lastTabIndex.value = newIndex
})

const themeVars = computed(() => {
  if (store.settings.darkMode) {
    return {
      background: '#1a1a1a',
      textColor: '#ffffff',
      cellBackground: '#2a2a2a',
      navBarBackground: '#2a2a2a',
      tabbarBackground: '#2a2a2a'
    }
  }
  return {}
})

onMounted(() => {
  store.loadData()
  lastTabIndex.value = active.value
})

function onTabChange(index) {
  const routes = ['/', '/entry', '/charts', '/settings']
  router.push(routes[index])
}

const tabs = [
  {
    icon: 'list',
    label: '记录',
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
  },
  {
    icon: 'add',
    label: '录入',
    gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
  },
  {
    icon: 'chart',
    label: '图表',
    gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'
  },
  {
    icon: 'settings',
    label: '设置',
    gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)'
  }
]
</script>

<template>
  <van-config-provider :theme="store.settings.darkMode ? 'dark' : 'light'" :theme-vars="themeVars">
    <div class="app-container" :class="{ 'dark-mode': store.settings.darkMode }">
      <!-- 页面切换动画 -->
      <router-view v-slot="{ Component }">
        <transition :name="transitionName" mode="out-in">
          <component :is="Component" :key="$route.path" />
        </transition>
      </router-view>

      <!-- 自定义小牛风格底部导航 -->
      <div class="custom-tabbar">
        <div class="tabbar-content">
          <div
            v-for="(tab, index) in tabs"
            :key="index"
            class="tab-item"
            :class="{ active: active === index }"
            @click="onTabChange(index)"
          >
            <div class="tab-icon-wrapper">
              <div
                class="tab-icon-bg"
                :style="{ background: active === index ? tab.gradient : 'transparent' }"
              ></div>
              <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <!-- 记录图标 -->
                <template v-if="tab.icon === 'list'">
                  <line x1="8" y1="6" x2="21" y2="6" stroke-width="2" stroke-linecap="round"/>
                  <line x1="8" y1="12" x2="21" y2="12" stroke-width="2" stroke-linecap="round"/>
                  <line x1="8" y1="18" x2="21" y2="18" stroke-width="2" stroke-linecap="round"/>
                  <line x1="3" y1="6" x2="3.01" y2="6" stroke-width="2" stroke-linecap="round"/>
                  <line x1="3" y1="12" x2="3.01" y2="12" stroke-width="2" stroke-linecap="round"/>
                  <line x1="3" y1="18" x2="3.01" y2="18" stroke-width="2" stroke-linecap="round"/>
                </template>
                <!-- 录入图标 -->
                <template v-else-if="tab.icon === 'add'">
                  <circle cx="12" cy="12" r="10" stroke-width="2"/>
                  <line x1="12" y1="8" x2="12" y2="16" stroke-width="2" stroke-linecap="round"/>
                  <line x1="8" y1="12" x2="16" y2="12" stroke-width="2" stroke-linecap="round"/>
                </template>
                <!-- 图表图标 -->
                <template v-else-if="tab.icon === 'chart'">
                  <path d="M3 3v18h18" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M18 9l-5 5-4-4-4 4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </template>
                <!-- 设置图标 -->
                <template v-else-if="tab.icon === 'settings'">
                  <circle cx="12" cy="12" r="3" stroke-width="2"/>
                  <path d="M12 1v6m0 6v6M4.22 4.22l4.24 4.24m5.08 5.08l4.24 4.24M1 12h6m6 0h6M4.22 19.78l4.24-4.24m5.08-5.08l4.24-4.24" stroke-width="2" stroke-linecap="round"/>
                </template>
              </svg>
            </div>
            <span class="tab-label">{{ tab.label }}</span>
            <div v-if="active === index" class="active-indicator"></div>
          </div>
        </div>
      </div>
    </div>
  </van-config-provider>
</template>

<style scoped>
.app-container {
  min-height: 100vh;
  background: #f7f8fa;
  padding-bottom: calc(75px + env(safe-area-inset-bottom));
}

.app-container.dark-mode {
  background: #1a1a1a;
}

/* 小牛风格底部导航 */
.custom-tabbar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  padding: 8px 16px calc(12px + env(safe-area-inset-bottom));
  padding-left: max(16px, env(safe-area-inset-left));
  padding-right: max(16px, env(safe-area-inset-right));
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow: 0 -2px 20px rgba(0, 0, 0, 0.05);
}

.dark-mode .custom-tabbar {
  background: rgba(30, 30, 30, 0.9);
  box-shadow: 0 -2px 20px rgba(0, 0, 0, 0.3);
}

.tabbar-content {
  display: flex;
  justify-content: space-around;
  align-items: center;
  max-width: 500px;
  margin: 0 auto;
}

.tab-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  position: relative;
  padding: 8px 0;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.tab-item:active {
  transform: scale(0.95);
}

.tab-icon-wrapper {
  position: relative;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tab-icon-bg {
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: 14px;
  opacity: 0;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.tab-item.active .tab-icon-bg {
  opacity: 1;
  transform: scale(1.05);
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1.05);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
  50% {
    transform: scale(1.08);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
  }
}

.tab-icon {
  width: 24px;
  height: 24px;
  position: relative;
  z-index: 1;
  color: #969799;
  transition: all 0.3s ease;
}

.tab-item.active .tab-icon {
  color: #ffffff;
  transform: translateY(-2px);
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
}

.tab-label {
  font-size: 11px;
  color: #969799;
  font-weight: 500;
  transition: all 0.3s ease;
  letter-spacing: 0.3px;
}

.tab-item.active .tab-label {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-weight: 600;
  transform: scale(1.05);
}

.dark-mode .tab-label {
  color: #969799;
}

.active-indicator {
  position: absolute;
  bottom: 0;
  width: 24px;
  height: 3px;
  background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
  border-radius: 2px 2px 0 0;
  animation: slideIn 0.3s ease;
}

@keyframes slideIn {
  from {
    width: 0;
    opacity: 0;
  }
  to {
    width: 24px;
    opacity: 1;
  }
}

/* 支持安全区域（刘海屏） */
@supports (padding: max(0px)) {
  .custom-tabbar {
    padding-bottom: max(12px, env(safe-area-inset-bottom));
  }
}

/* 页面切换动画 */
.slide-left-enter-active,
.slide-left-leave-active,
.slide-right-enter-active,
.slide-right-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-left-enter-from {
  opacity: 0;
  transform: translateX(30px);
}

.slide-left-leave-to {
  opacity: 0;
  transform: translateX(-30px);
}

.slide-right-enter-from {
  opacity: 0;
  transform: translateX(-30px);
}

.slide-right-leave-to {
  opacity: 0;
  transform: translateX(30px);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>

<style>
/* 全局导航栏安全区域适配 - 修复状态栏遮挡问题 */
.van-nav-bar {
  padding-top: 56px !important; /* 增加顶部内边距，避免被状态栏遮挡 */
  height: auto !important;
}

.van-nav-bar__content {
  padding-left: 16px !important;
  padding-right: 16px !important;
  padding-top: 12px !important; /* 内容区域额外的顶部间距 */
  padding-bottom: 12px !important;
}

/* 优化导航栏右侧按钮的点击区域 */
.van-nav-bar__right .van-icon {
  padding: 12px !important;
  cursor: pointer;
}
</style>
