import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import { registerSW } from 'virtual:pwa-register'

// Vant 组件按需引入
import {
  Button,
  NavBar,
  Tabbar,
  TabbarItem,
  Cell,
  CellGroup,
  Field,
  Form,
  Stepper,
  Picker,
  Popup,
  DatePicker,
  TimePicker,
  Tag,
  Switch,
  Dialog,
  Toast,
  ActionSheet,
  Icon,
  Empty,
  List,
  PullRefresh,
  SwipeCell,
  Collapse,
  CollapseItem,
  ConfigProvider
} from 'vant'

// Vant 样式
import 'vant/lib/index.css'
import './style.css'

const app = createApp(App)

// 注册 Vant 组件
const vantComponents = [
  Button,
  NavBar,
  Tabbar,
  TabbarItem,
  Cell,
  CellGroup,
  Field,
  Form,
  Stepper,
  Picker,
  Popup,
  DatePicker,
  TimePicker,
  Tag,
  Switch,
  Dialog,
  Toast,
  ActionSheet,
  Icon,
  Empty,
  List,
  PullRefresh,
  SwipeCell,
  Collapse,
  CollapseItem,
  ConfigProvider
]

vantComponents.forEach(component => {
  app.use(component)
})

app.use(createPinia())
app.use(router)

app.mount('#app')

// PWA Service Worker 注册
const updateSW = registerSW({
  onNeedRefresh() {
    // 当有新版本可用时
    if (confirm('发现新版本，是否立即更新？')) {
      updateSW(true)
    }
  },
  onOfflineReady() {
    // 当应用已经准备好离线使用时
    console.log('应用已就绪，可以离线使用')
  },
  onRegistered(registration) {
    // Service Worker 注册成功
    console.log('Service Worker 已注册')

    // 每小时检查一次更新
    if (registration) {
      setInterval(() => {
        registration.update()
      }, 60 * 60 * 1000)
    }
  },
  onRegisterError(error) {
    console.error('Service Worker 注册失败:', error)
  }
})
