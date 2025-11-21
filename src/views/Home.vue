<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '../stores'
import { calculateRecordData, getConsumptionLevel, formatDateTime, formatDate } from '../utils/calculator'
import { showConfirmDialog, showToast } from 'vant'

const router = useRouter()
const store = useAppStore()

const filterTag = ref('')
const refreshing = ref(false)
const dateRange = ref('all') // 'all', 'today', 'week', 'month', 'custom'
const showDateRangePicker = ref(false)
const customDateRange = ref([new Date(), new Date()])
const compareMode = ref(false)
const selectedRecords = ref([])
const showCompareDialog = ref(false)

// 计算后的记录列表
const computedRecords = computed(() => {
  let list = store.records.map(record =>
    calculateRecordData(record, store.totalEnergy, store.settings.electricityPrice)
  )

  // 按日期范围筛选
  const now = new Date()
  now.setHours(0, 0, 0, 0)

  if (dateRange.value === 'today') {
    list = list.filter(record => {
      const recordDate = new Date(record.datetime)
      recordDate.setHours(0, 0, 0, 0)
      return recordDate.getTime() === now.getTime()
    })
  } else if (dateRange.value === 'week') {
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    list = list.filter(record => {
      const recordDate = new Date(record.datetime)
      return recordDate >= weekAgo
    })
  } else if (dateRange.value === 'month') {
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    list = list.filter(record => {
      const recordDate = new Date(record.datetime)
      return recordDate >= monthAgo
    })
  } else if (dateRange.value === 'custom' && customDateRange.value.length === 2) {
    const startDate = new Date(customDateRange.value[0])
    const endDate = new Date(customDateRange.value[1])
    startDate.setHours(0, 0, 0, 0)
    endDate.setHours(23, 59, 59, 999)

    list = list.filter(record => {
      const recordDate = new Date(record.datetime)
      return recordDate >= startDate && recordDate <= endDate
    })
  }

  // 按标签筛选
  if (filterTag.value) {
    list = list.filter(record =>
      record.tags && record.tags.includes(filterTag.value)
    )
  }

  return list
})

// 获取能耗颜色
function getConsumptionColor(consumption) {
  const level = getConsumptionLevel(
    consumption,
    store.settings.excellentThreshold,
    store.settings.warningThreshold
  )
  if (level === 'excellent') return '#07c160'
  if (level === 'normal') return '#ff976a'
  return '#ee0a24'
}

// 获取能耗渐变色
function getConsumptionGradient(consumption) {
  const level = getConsumptionLevel(
    consumption,
    store.settings.excellentThreshold,
    store.settings.warningThreshold
  )
  if (level === 'excellent') return 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)'
  if (level === 'normal') return 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
  return 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)'
}

// 今日数据统计
const todayStats = computed(() => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const todayRecords = computedRecords.value.filter(record => {
    const recordDate = new Date(record.datetime)
    recordDate.setHours(0, 0, 0, 0)
    return recordDate.getTime() === today.getTime()
  })

  if (todayRecords.length === 0) return null

  const totalDistance = todayRecords.reduce((sum, r) => sum + r.distance, 0)
  const avgConsumption = todayRecords.reduce((sum, r) => sum + r.energyConsumption, 0) / todayRecords.length
  const totalCost = todayRecords.reduce((sum, r) => sum + r.electricityCost, 0)

  return {
    count: todayRecords.length,
    distance: Math.round(totalDistance * 10) / 10,
    consumption: Math.round(avgConsumption * 10) / 10,
    cost: Math.round(totalCost * 100) / 100
  }
})

// 本周数据统计
const weekStats = computed(() => {
  const today = new Date()
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)

  const weekRecords = computedRecords.value.filter(record => {
    const recordDate = new Date(record.datetime)
    return recordDate >= weekAgo
  })

  if (weekRecords.length === 0) return null

  const totalDistance = weekRecords.reduce((sum, r) => sum + r.distance, 0)
  const avgConsumption = weekRecords.reduce((sum, r) => sum + r.energyConsumption, 0) / weekRecords.length
  const totalCost = weekRecords.reduce((sum, r) => sum + r.electricityCost, 0)

  return {
    count: weekRecords.length,
    distance: Math.round(totalDistance * 10) / 10,
    consumption: Math.round(avgConsumption * 10) / 10,
    cost: Math.round(totalCost * 100) / 100
  }
})

// 本月数据统计
const monthStats = computed(() => {
  const today = new Date()
  const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)

  const monthRecords = computedRecords.value.filter(record => {
    const recordDate = new Date(record.datetime)
    return recordDate >= monthAgo
  })

  if (monthRecords.length === 0) return null

  const totalDistance = monthRecords.reduce((sum, r) => sum + r.distance, 0)
  const avgConsumption = monthRecords.reduce((sum, r) => sum + r.energyConsumption, 0) / monthRecords.length
  const totalCost = monthRecords.reduce((sum, r) => sum + r.electricityCost, 0)

  return {
    count: monthRecords.length,
    distance: Math.round(totalDistance * 10) / 10,
    consumption: Math.round(avgConsumption * 10) / 10,
    cost: Math.round(totalCost * 100) / 100
  }
})

// 下拉刷新
function onRefresh() {
  setTimeout(() => {
    refreshing.value = false
    showToast('已刷新')
  }, 1000)
}

// 删除记录
async function handleDelete(record) {
  try {
    await showConfirmDialog({
      title: '确认删除',
      message: '删除后无法恢复，确定要删除这条记录吗？'
    })
    store.deleteRecord(record.id)
    showToast('已删除')
  } catch {
    // 用户取消
  }
}

// 编辑记录
function handleEdit(record) {
  router.push({
    path: '/entry',
    query: { id: record.id }
  })
}

// 添加新记录
function handleAdd() {
  router.push('/entry')
}

// 自定义日期范围确认
function onDateRangeConfirm(values) {
  customDateRange.value = values
  dateRange.value = 'custom'
  showDateRangePicker.value = false
}

// 切换对比模式
function toggleCompareMode() {
  compareMode.value = !compareMode.value
  if (!compareMode.value) {
    selectedRecords.value = []
  }
}

// 选择记录进行对比
function toggleRecordSelection(record) {
  const index = selectedRecords.value.findIndex(r => r.id === record.id)
  if (index === -1) {
    if (selectedRecords.value.length < 2) {
      selectedRecords.value.push(record)
      // 选择第2条记录后自动弹出对比窗口
      if (selectedRecords.value.length === 2) {
        showComparison()
      }
    } else {
      showToast('最多选择2条记录对比')
    }
  } else {
    selectedRecords.value.splice(index, 1)
  }
}

// 判断记录是否被选中
function isRecordSelected(record) {
  return selectedRecords.value.some(r => r.id === record.id)
}

// 显示对比结果
function showComparison() {
  if (selectedRecords.value.length !== 2) {
    showToast('请选择2条记录进行对比')
    return
  }
  showCompareDialog.value = true
}

// 对比数据
const comparisonData = computed(() => {
  if (selectedRecords.value.length !== 2) return null

  const [record1, record2] = selectedRecords.value

  return {
    record1,
    record2,
    differences: {
      busbar: record2.busbarCurrent - record1.busbarCurrent,
      phase: record2.phaseCurrent - record1.phaseCurrent,
      consumption: Math.round((record2.energyConsumption - record1.energyConsumption) * 10) / 10,
      range: record2.range - record1.range,
      cost: Math.round((record2.electricityCost - record1.electricityCost) * 100) / 100
    }
  }
})
</script>

<template>
  <div class="home-page">
    <van-nav-bar title="骑行记录" fixed placeholder class="nav-bar-blur">
      <template #right>
        <van-icon name="plus" size="20" @click="handleAdd" />
      </template>
    </van-nav-bar>

    <!-- 日期范围筛选 -->
    <div class="filter-section">
      <div class="filter-label">日期范围</div>
      <div class="filter-buttons">
        <van-button
          size="small"
          :type="dateRange === 'all' ? 'primary' : 'default'"
          @click="dateRange = 'all'"
        >
          全部
        </van-button>
        <van-button
          size="small"
          :type="dateRange === 'today' ? 'primary' : 'default'"
          @click="dateRange = 'today'"
        >
          今日
        </van-button>
        <van-button
          size="small"
          :type="dateRange === 'week' ? 'primary' : 'default'"
          @click="dateRange = 'week'"
        >
          近7天
        </van-button>
        <van-button
          size="small"
          :type="dateRange === 'month' ? 'primary' : 'default'"
          @click="dateRange = 'month'"
        >
          近30天
        </van-button>
        <van-button
          size="small"
          :type="dateRange === 'custom' ? 'primary' : 'default'"
          @click="showDateRangePicker = true"
        >
          自定义
        </van-button>
        <van-button
          size="small"
          :type="compareMode ? 'primary' : 'default'"
          @click="toggleCompareMode"
        >
          {{ compareMode ? '取消对比' : '对比' }}
        </van-button>
      </div>
    </div>

    <!-- 筛选标签 -->
    <div class="filter-section" v-if="store.allTags.length > 0">
      <div class="filter-label">路况标签</div>
      <div class="filter-tags">
        <van-tag
          :type="filterTag === '' ? 'primary' : 'default'"
          @click="filterTag = ''"
          class="filter-tag"
        >
          全部
        </van-tag>
        <van-tag
          v-for="tag in store.allTags"
          :key="tag"
          :type="filterTag === tag ? 'primary' : 'default'"
          @click="filterTag = filterTag === tag ? '' : tag"
          class="filter-tag"
        >
          {{ tag }}
        </van-tag>
      </div>
    </div>

    <!-- 数据统计卡片 -->
    <div class="stats-cards" v-if="todayStats || weekStats || monthStats">
      <div v-if="todayStats" class="stats-card">
        <div class="stats-bg" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%)"></div>
        <div class="stats-content">
          <div class="stats-title">今日</div>
          <div class="stats-main">
            <div class="stats-item">
              <span class="stats-value">{{ todayStats.count }}</span>
              <span class="stats-label">次</span>
            </div>
            <div class="stats-divider"></div>
            <div class="stats-item">
              <span class="stats-value">{{ todayStats.distance }}</span>
              <span class="stats-label">km</span>
            </div>
            <div class="stats-divider"></div>
            <div class="stats-item">
              <span class="stats-value">{{ todayStats.consumption }}</span>
              <span class="stats-label">Wh/km</span>
            </div>
            <div class="stats-divider"></div>
            <div class="stats-item">
              <span class="stats-value">¥{{ todayStats.cost }}</span>
              <span class="stats-label">电费</span>
            </div>
          </div>
        </div>
      </div>

      <div v-if="weekStats" class="stats-card">
        <div class="stats-bg" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%)"></div>
        <div class="stats-content">
          <div class="stats-title">本周</div>
          <div class="stats-main">
            <div class="stats-item">
              <span class="stats-value">{{ weekStats.count }}</span>
              <span class="stats-label">次</span>
            </div>
            <div class="stats-divider"></div>
            <div class="stats-item">
              <span class="stats-value">{{ weekStats.distance }}</span>
              <span class="stats-label">km</span>
            </div>
            <div class="stats-divider"></div>
            <div class="stats-item">
              <span class="stats-value">{{ weekStats.consumption }}</span>
              <span class="stats-label">Wh/km</span>
            </div>
            <div class="stats-divider"></div>
            <div class="stats-item">
              <span class="stats-value">¥{{ weekStats.cost }}</span>
              <span class="stats-label">电费</span>
            </div>
          </div>
        </div>
      </div>

      <div v-if="monthStats" class="stats-card">
        <div class="stats-bg" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)"></div>
        <div class="stats-content">
          <div class="stats-title">本月</div>
          <div class="stats-main">
            <div class="stats-item">
              <span class="stats-value">{{ monthStats.count }}</span>
              <span class="stats-label">次</span>
            </div>
            <div class="stats-divider"></div>
            <div class="stats-item">
              <span class="stats-value">{{ monthStats.distance }}</span>
              <span class="stats-label">km</span>
            </div>
            <div class="stats-divider"></div>
            <div class="stats-item">
              <span class="stats-value">{{ monthStats.consumption }}</span>
              <span class="stats-label">Wh/km</span>
            </div>
            <div class="stats-divider"></div>
            <div class="stats-item">
              <span class="stats-value">¥{{ monthStats.cost }}</span>
              <span class="stats-label">电费</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 下拉刷新 + 记录列表 -->
    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <div class="record-list" v-if="computedRecords.length > 0">
        <van-swipe-cell
          v-for="(record, index) in computedRecords"
          :key="record.id"
          class="swipe-cell-wrapper"
        >
          <div
            class="record-card"
            @click="compareMode ? toggleRecordSelection(record) : handleEdit(record)"
            :style="{ animationDelay: `${index * 0.05}s` }"
            :class="{ 'selected': compareMode && isRecordSelected(record) }"
          >
            <!-- 渐变光泽边框 -->
            <div class="card-gradient-border" :style="{ background: getConsumptionGradient(record.energyConsumption) }"></div>

            <!-- 对比模式复选框 -->
            <div v-if="compareMode" class="compare-checkbox">
              <van-checkbox :model-value="isRecordSelected(record)" @click.stop="toggleRecordSelection(record)" />
            </div>

            <div class="card-content">
              <div class="record-header">
                <span class="record-date">{{ formatDate(record.datetime) }}</span>
                <span class="record-time">{{ formatDateTime(record.datetime).split(' ')[1] }}</span>
              </div>

              <div class="record-main">
                <div class="consumption-value" :style="{ color: getConsumptionColor(record.energyConsumption) }">
                  {{ record.energyConsumption }}
                  <span class="consumption-unit">Wh/km</span>
                </div>
                <div class="record-info">
                  <div class="info-item">
                    <span class="info-label">续航</span>
                    <span class="info-value">{{ record.range }} km</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">里程</span>
                    <span class="info-value">{{ record.distance }} km</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">母线/相线</span>
                    <span class="info-value">{{ record.busbarCurrent }}/{{ record.phaseCurrent }}A</span>
                  </div>
                </div>
              </div>

              <div class="record-tags" v-if="record.tags && record.tags.length > 0">
                <van-tag
                  v-for="tag in record.tags"
                  :key="tag"
                  type="primary"
                  plain
                  size="small"
                  class="tag-item"
                >
                  {{ tag }}
                </van-tag>
              </div>

              <div class="record-temps" v-if="record.motorTemp || record.controllerTemp">
                <span v-if="record.motorTemp">电机 {{ record.motorTemp }}°C</span>
                <span v-if="record.controllerTemp">控制器 {{ record.controllerTemp }}°C</span>
              </div>

              <!-- 电费显示 -->
              <div class="record-cost" v-if="record.electricityCost">
                <van-icon name="gold-coin-o" size="12" />
                <span>电费 ¥{{ record.electricityCost }}</span>
              </div>

            </div>

            <!-- SOC 消耗徽章 -->
            <div class="soc-badge">
              <svg class="soc-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <rect x="6" y="6" width="12" height="14" rx="2" stroke-width="2"/>
                <line x1="9" y1="3" x2="9" y2="6" stroke-width="2" stroke-linecap="round"/>
                <line x1="15" y1="3" x2="15" y2="6" stroke-width="2" stroke-linecap="round"/>
                <line x1="10" y1="11" x2="14" y2="11" stroke-width="2" stroke-linecap="round"/>
              </svg>
              <span class="soc-value">{{ record.socConsumed }}%</span>
            </div>
          </div>

          <template #right>
            <van-button
              square
              type="danger"
              text="删除"
              class="delete-btn"
              @click="handleDelete(record)"
            />
          </template>
        </van-swipe-cell>
      </div>

      <!-- 空状态 -->
      <van-empty
        v-else
        description="暂无骑行记录"
        image="search"
      >
        <van-button type="primary" size="small" @click="handleAdd">
          录入第一条
        </van-button>
      </van-empty>
    </van-pull-refresh>

    <!-- 自定义日期范围选择器 -->
    <van-calendar
      v-model:show="showDateRangePicker"
      type="range"
      :min-date="new Date(2020, 0, 1)"
      :max-date="new Date()"
      @confirm="onDateRangeConfirm"
      confirm-text="确定"
      confirm-disabled-text="请选择日期范围"
    />

    <!-- 对比对话框 -->
    <van-dialog
      v-model:show="showCompareDialog"
      title="记录对比"
      :show-confirm-button="false"
      class="compare-dialog"
    >
      <div v-if="comparisonData" class="comparison-content">
        <div class="comparison-cards">
          <!-- 记录1 -->
          <div class="compare-card">
            <div class="compare-card-header">记录 1</div>
            <div class="compare-item">
              <span class="compare-label">日期</span>
              <span class="compare-value">{{ formatDate(comparisonData.record1.datetime) }}</span>
            </div>
            <div class="compare-item highlight">
              <span class="compare-label">母线电流</span>
              <span class="compare-value">{{ comparisonData.record1.busbarCurrent }}A</span>
            </div>
            <div class="compare-item highlight">
              <span class="compare-label">相线电流</span>
              <span class="compare-value">{{ comparisonData.record1.phaseCurrent }}A</span>
            </div>
            <div class="compare-item">
              <span class="compare-label">里程</span>
              <span class="compare-value">{{ comparisonData.record1.distance }}km</span>
            </div>
            <div class="compare-item highlight">
              <span class="compare-label">能耗</span>
              <span class="compare-value">{{ comparisonData.record1.energyConsumption }}Wh/km</span>
            </div>
            <div class="compare-item highlight">
              <span class="compare-label">续航</span>
              <span class="compare-value">{{ comparisonData.record1.range }}km</span>
            </div>
            <div class="compare-item highlight">
              <span class="compare-label">电费</span>
              <span class="compare-value">¥{{ comparisonData.record1.electricityCost }}</span>
            </div>
          </div>

          <!-- 差值 -->
          <div class="compare-diff">
            <div class="diff-icon">
              <van-icon name="arrow-left" />
              <van-icon name="arrow" />
            </div>
            <div class="diff-items">
              <div class="diff-spacer"></div>
              <div class="diff-item">
                <span :class="{ 'positive': comparisonData.differences.busbar > 0, 'negative': comparisonData.differences.busbar < 0 }">
                  {{ comparisonData.differences.busbar > 0 ? '+' : '' }}{{ comparisonData.differences.busbar }}A
                </span>
              </div>
              <div class="diff-item">
                <span :class="{ 'positive': comparisonData.differences.phase > 0, 'negative': comparisonData.differences.phase < 0 }">
                  {{ comparisonData.differences.phase > 0 ? '+' : '' }}{{ comparisonData.differences.phase }}A
                </span>
              </div>
              <div class="diff-spacer"></div>
              <div class="diff-item">
                <span :class="{ 'positive': comparisonData.differences.consumption < 0, 'negative': comparisonData.differences.consumption > 0 }">
                  {{ comparisonData.differences.consumption > 0 ? '+' : '' }}{{ comparisonData.differences.consumption }}
                </span>
              </div>
              <div class="diff-item">
                <span :class="{ 'positive': comparisonData.differences.range > 0, 'negative': comparisonData.differences.range < 0 }">
                  {{ comparisonData.differences.range > 0 ? '+' : '' }}{{ comparisonData.differences.range }}km
                </span>
              </div>
              <div class="diff-item">
                <span :class="{ 'positive': comparisonData.differences.cost < 0, 'negative': comparisonData.differences.cost > 0 }">
                  {{ comparisonData.differences.cost > 0 ? '+' : '' }}{{ comparisonData.differences.cost }}元
                </span>
              </div>
            </div>
          </div>

          <!-- 记录2 -->
          <div class="compare-card">
            <div class="compare-card-header">记录 2</div>
            <div class="compare-item">
              <span class="compare-label">日期</span>
              <span class="compare-value">{{ formatDate(comparisonData.record2.datetime) }}</span>
            </div>
            <div class="compare-item highlight">
              <span class="compare-label">母线电流</span>
              <span class="compare-value">{{ comparisonData.record2.busbarCurrent }}A</span>
            </div>
            <div class="compare-item highlight">
              <span class="compare-label">相线电流</span>
              <span class="compare-value">{{ comparisonData.record2.phaseCurrent }}A</span>
            </div>
            <div class="compare-item">
              <span class="compare-label">里程</span>
              <span class="compare-value">{{ comparisonData.record2.distance }}km</span>
            </div>
            <div class="compare-item highlight">
              <span class="compare-label">能耗</span>
              <span class="compare-value">{{ comparisonData.record2.energyConsumption }}Wh/km</span>
            </div>
            <div class="compare-item highlight">
              <span class="compare-label">续航</span>
              <span class="compare-value">{{ comparisonData.record2.range }}km</span>
            </div>
            <div class="compare-item highlight">
              <span class="compare-label">电费</span>
              <span class="compare-value">¥{{ comparisonData.record2.electricityCost }}</span>
            </div>
          </div>
        </div>

        <van-button type="primary" block @click="showCompareDialog = false" style="margin-top: 16px">
          关闭
        </van-button>
      </div>
    </van-dialog>
  </div>
</template>

<style scoped>
.home-page {
  padding-bottom: 20px;
}

/* 毛玻璃导航栏 */
.nav-bar-blur :deep(.van-nav-bar) {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  padding-top: 56px !important; /* 增加顶部内边距，避免被状态栏遮挡 */
  height: auto !important;
}

.dark-mode .nav-bar-blur :deep(.van-nav-bar) {
  background: rgba(30, 30, 30, 0.9);
}

/* 适配安全区域，避免被刘海屏遮挡 */
.nav-bar-blur :deep(.van-nav-bar__content) {
  padding-left: 16px;
  padding-right: 16px;
  padding-top: 12px; /* 内容区域额外的顶部间距 */
  padding-bottom: 12px;
}

.nav-bar-blur :deep(.van-nav-bar__left),
.nav-bar-blur :deep(.van-nav-bar__right) {
  padding: 0 8px;
}

/* 优化右上角+按钮的点击区域 */
.nav-bar-blur :deep(.van-nav-bar__right .van-icon) {
  padding: 12px !important;
  cursor: pointer;
}

.filter-section {
  padding: 10px 16px;
  background: #fff;
  border-bottom: 1px solid #eee;
}

.dark-mode .filter-section {
  background: #2a2a2a;
  border-bottom-color: #3a3a3a;
}

.filter-label {
  font-size: 13px;
  color: #969799;
  margin-bottom: 8px;
  font-weight: 500;
}

.filter-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.filter-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.filter-tag {
  cursor: pointer;
  transition: all 0.3s ease;
}

.filter-tag:active {
  transform: scale(0.95);
}

.record-list {
  padding: 10px 16px;
}

.swipe-cell-wrapper {
  margin-bottom: 12px;
}

/* 卡片入场动画 */
.record-card {
  position: relative;
  background: #fff;
  border-radius: 16px;
  padding: 16px;
  overflow: hidden;
  animation: slideInUp 0.4s ease-out backwards;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes slideInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.record-card:active {
  transform: scale(0.98);
}

.dark-mode .record-card {
  background: #2a2a2a;
}

/* 渐变光泽边框 */
.card-gradient-border {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  border-radius: 16px 16px 0 0;
  opacity: 0.8;
}

.card-content {
  position: relative;
  z-index: 1;
}

.record-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
  font-size: 14px;
  color: #969799;
}

.record-main {
  display: flex;
  align-items: center;
  gap: 20px;
}

.consumption-value {
  font-size: 36px;
  font-weight: bold;
  line-height: 1;
  transition: all 0.3s ease;
}

.consumption-unit {
  font-size: 12px;
  font-weight: normal;
  margin-left: 2px;
}

.record-info {
  flex: 1;
}

.info-item {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  margin-bottom: 4px;
}

.info-label {
  color: #969799;
}

.info-value {
  color: #323233;
  font-weight: 500;
}

.dark-mode .info-value {
  color: #fff;
}

.record-tags {
  margin-top: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag-item {
  font-size: 11px;
}

.record-temps {
  margin-top: 8px;
  font-size: 12px;
  color: #969799;
  display: flex;
  gap: 12px;
}

.record-cost {
  margin-top: 8px;
  font-size: 12px;
  color: #ff976a;
  display: flex;
  align-items: center;
  gap: 4px;
  font-weight: 500;
}

/* SOC 消耗徽章 */
.soc-badge {
  position: absolute;
  bottom: 10px;
  right: 10px;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  border-radius: 16px;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.12) 0%, rgba(118, 75, 162, 0.12) 100%);
  border: 1.5px solid rgba(102, 126, 234, 0.25);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.15);
  animation: fadeInScale 0.5s ease-out backwards;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.soc-badge:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.25);
}

.soc-icon {
  width: 12px;
  height: 12px;
  color: #667eea;
  flex-shrink: 0;
}

.soc-value {
  font-size: 12px;
  font-weight: 600;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  white-space: nowrap;
}

.dark-mode .soc-badge {
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.2) 0%, rgba(118, 75, 162, 0.2) 100%);
  border-color: rgba(102, 126, 234, 0.35);
}

.delete-btn {
  height: 100%;
}

/* 统计卡片 */
.stats-cards {
  padding: 10px 16px;
  display: flex;
  gap: 10px;
  overflow-x: auto;
  scrollbar-width: none;
}

.stats-cards::-webkit-scrollbar {
  display: none;
}

.stats-card {
  position: relative;
  min-width: 280px;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  animation: slideInLeft 0.5s ease-out backwards;
}

.stats-card:nth-child(1) { animation-delay: 0.1s; }
.stats-card:nth-child(2) { animation-delay: 0.15s; }
.stats-card:nth-child(3) { animation-delay: 0.2s; }

@keyframes slideInLeft {
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.stats-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  opacity: 0.15;
}

.stats-content {
  position: relative;
  z-index: 1;
  padding: 14px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.dark-mode .stats-content {
  background: rgba(30, 30, 30, 0.95);
}

.stats-title {
  font-size: 12px;
  color: #969799;
  margin-bottom: 10px;
  font-weight: 500;
}

.stats-main {
  display: flex;
  align-items: center;
  justify-content: space-around;
}

.stats-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.stats-value {
  font-size: 24px;
  font-weight: bold;
  color: #323233;
}

.dark-mode .stats-value {
  color: #fff;
}

.stats-label {
  font-size: 11px;
  color: #969799;
}

.stats-divider {
  width: 1px;
  height: 30px;
  background: linear-gradient(to bottom, transparent, #e0e0e0, transparent);
}

.dark-mode .stats-divider {
  background: linear-gradient(to bottom, transparent, #4a4a4a, transparent);
}

/* 对比模式样式 */
.record-card.selected {
  border: 2px solid #1989fa;
  box-shadow: 0 4px 16px rgba(25, 137, 250, 0.3);
}

.compare-checkbox {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 10;
}

.comparison-content {
  max-height: 70vh;
  overflow-y: auto;
}

.comparison-cards {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 8px;
  margin-bottom: 16px;
}

.compare-card {
  background: #f7f8fa;
  border-radius: 8px;
  padding: 12px;
}

.dark-mode .compare-card {
  background: #2a2a2a;
}

.compare-card-header {
  font-size: 14px;
  font-weight: 600;
  color: #323233;
  margin-bottom: 8px;
  text-align: center;
}

.dark-mode .compare-card-header {
  color: #fff;
}

.compare-item {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  padding: 6px 0;
  border-bottom: 1px solid #eee;
}

.dark-mode .compare-item {
  border-bottom-color: #3a3a3a;
}

.compare-item:last-child {
  border-bottom: none;
}

.compare-item.highlight {
  background: rgba(25, 137, 250, 0.05);
  margin: 0 -12px;
  padding: 6px 12px;
}

.compare-label {
  color: #969799;
}

.compare-value {
  color: #323233;
  font-weight: 500;
}

.dark-mode .compare-value {
  color: #fff;
}

.compare-diff {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-width: 60px;
}

.diff-icon {
  display: flex;
  gap: 4px;
  color: #969799;
  margin-bottom: 8px;
}

.diff-items {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}

.diff-spacer {
  height: 32px;
}

.diff-item {
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 11px;
  font-weight: 600;
  padding: 6px 0;
}

.diff-item span.positive {
  color: #07c160;
}

.diff-item span.negative {
  color: #ee0a24;
}
</style>
