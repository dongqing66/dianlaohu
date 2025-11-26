<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '../stores'
import { showConfirmDialog, showToast } from 'vant'

const router = useRouter()
const store = useAppStore()

// 统计：本月充电
const thisMonthStats = computed(() => {
  const now = new Date()
  const thisMonth = store.chargingRecords.filter(r => {
    const date = new Date(r.datetime)
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
  })

  let totalEnergy = 0
  let totalCost = 0

  thisMonth.forEach(r => {
    const socCharged = r.socAfter - r.socBefore
    const batteryEnergy = (socCharged / 100) * (store.totalEnergy / 1000)
    const gridEnergy = batteryEnergy / (store.settings.chargingEfficiency || 0.88)
    totalEnergy += gridEnergy
    totalCost += gridEnergy * store.settings.electricityPrice
  })

  return {
    count: thisMonth.length,
    totalEnergy: Math.round(totalEnergy * 100) / 100,
    totalCost: Math.round(totalCost * 100) / 100
  }
})

// 统计：本周充电
const thisWeekStats = computed(() => {
  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - now.getDay())
  weekStart.setHours(0, 0, 0, 0)

  const thisWeek = store.chargingRecords.filter(r => {
    const date = new Date(r.datetime)
    return date >= weekStart
  })

  let totalEnergy = 0
  let totalCost = 0

  thisWeek.forEach(r => {
    const socCharged = r.socAfter - r.socBefore
    const batteryEnergy = (socCharged / 100) * (store.totalEnergy / 1000)
    const gridEnergy = batteryEnergy / (store.settings.chargingEfficiency || 0.88)
    totalEnergy += gridEnergy
    totalCost += gridEnergy * store.settings.electricityPrice
  })

  return {
    count: thisWeek.length,
    totalEnergy: Math.round(totalEnergy * 100) / 100,
    totalCost: Math.round(totalCost * 100) / 100
  }
})

// 计算记录的详细数据
function calculateRecordData(record) {
  const socCharged = record.socAfter - record.socBefore
  const batteryEnergy = (socCharged / 100) * (store.totalEnergy / 1000) // 电池实际存入的电量（kWh）
  const gridEnergy = batteryEnergy / (store.settings.chargingEfficiency || 0.88) // 从电网消耗的电量（kWh）
  const cost = gridEnergy * store.settings.electricityPrice // 充电费用

  return {
    socCharged: Math.round(socCharged * 10) / 10,
    batteryEnergy: Math.round(batteryEnergy * 100) / 100, // 实际入电量
    gridEnergy: Math.round(gridEnergy * 100) / 100, // 充电度数
    cost: Math.round(cost * 100) / 100
  }
}

// 跳转到录入页面
function goToEntry() {
  router.push('/charging-entry')
}

// 编辑记录
function editRecord(id) {
  router.push(`/charging-entry?id=${id}`)
}

// 删除记录
async function deleteRecord(id) {
  try {
    await showConfirmDialog({
      title: '确认删除',
      message: '确定要删除这条充电记录吗？'
    })
    store.deleteChargingRecord(id)
    showToast('已删除')
  } catch {
    // 用户取消
  }
}

// 格式化日期时间显示
function formatDateTime(datetime) {
  const d = new Date(datetime)
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hour = String(d.getHours()).padStart(2, '0')
  const minute = String(d.getMinutes()).padStart(2, '0')
  return `${month}/${day} ${hour}:${minute}`
}
</script>

<template>
  <div class="charging-page">
    <van-nav-bar title="充电管理" fixed placeholder>
      <template #right>
        <van-button type="primary" size="small" @click="goToEntry">+ 记录</van-button>
      </template>
    </van-nav-bar>

    <!-- 统计卡片 -->
    <div class="stats-container">
      <div class="stat-card">
        <div class="stat-label">本月充电</div>
        <div class="stat-value">{{ thisMonthStats.count }}次</div>
        <div class="stat-details">
          <span>{{ thisMonthStats.totalEnergy }}度</span>
          <span class="cost">¥{{ thisMonthStats.totalCost }}</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">本周充电</div>
        <div class="stat-value">{{ thisWeekStats.count }}次</div>
        <div class="stat-details">
          <span>{{ thisWeekStats.totalEnergy }}度</span>
          <span class="cost">¥{{ thisWeekStats.totalCost }}</span>
        </div>
      </div>
    </div>

    <!-- 记录列表 -->
    <div class="records-list">
      <van-empty v-if="store.chargingRecords.length === 0" description="还没有充电记录" />

      <van-swipe-cell
        v-for="(record, index) in store.chargingRecords"
        :key="record.id"
        class="swipe-cell-wrapper"
      >
        <div
          class="record-card"
          @click="editRecord(record.id)"
          :style="{ animationDelay: `${index * 0.05}s` }"
        >
          <!-- 渐变光泽边框 -->
          <div class="card-gradient-border"></div>

          <div class="card-content">
            <div class="record-header">
              <span class="record-date">{{ formatDateTime(record.datetime) }}</span>
              <span v-if="record.location" class="record-location">📍 {{ record.location }}</span>
            </div>

            <div class="record-main">
              <div class="soc-display">
                <span class="soc-value before">{{ record.socBefore }}%</span>
                <span class="arrow">→</span>
                <span class="soc-value after">{{ record.socAfter }}%</span>
              </div>
              <div class="record-info">
                <div class="info-item">
                  <span class="info-label">充电量</span>
                  <span class="info-value">{{ calculateRecordData(record).socCharged }}%</span>
                </div>
                <div class="info-item">
                  <span class="info-label">实际入电量</span>
                  <span class="info-value">{{ calculateRecordData(record).batteryEnergy }} kWh</span>
                </div>
                <div class="info-item">
                  <span class="info-label">充电度数</span>
                  <span class="info-value">{{ calculateRecordData(record).gridEnergy }} kWh</span>
                </div>
                <div class="info-item">
                  <span class="info-label">充电费用</span>
                  <span class="info-value cost">¥{{ calculateRecordData(record).cost }}</span>
                </div>
              </div>
            </div>

            <div v-if="record.note" class="record-note">💬 {{ record.note }}</div>
          </div>

          <!-- 充电徽章 -->
          <div class="charging-badge">
            <svg class="charging-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span class="charging-value">+{{ calculateRecordData(record).socCharged }}%</span>
          </div>
        </div>
        <template #right>
          <van-button
            square
            type="danger"
            text="删除"
            class="delete-btn"
            @click="deleteRecord(record.id)"
          />
        </template>
      </van-swipe-cell>
    </div>
  </div>
</template>

<style scoped>
.charging-page {
  padding-bottom: 60px;
}

/* 统计卡片 */
.stats-container {
  display: flex;
  gap: 12px;
  padding: 16px;
}

.stat-card {
  flex: 1;
  padding: 16px;
  border-radius: 12px;
  background: linear-gradient(135deg, #fee140 0%, #fa709a 100%);
  color: white;
  box-shadow: 0 4px 15px rgba(250, 112, 154, 0.3);
}

.stat-label {
  font-size: 12px;
  opacity: 0.9;
  margin-bottom: 8px;
}

.stat-value {
  font-size: 24px;
  font-weight: bold;
  margin-bottom: 8px;
}

.stat-details {
  font-size: 12px;
  display: flex;
  justify-content: space-between;
  opacity: 0.9;
}

.stat-details .cost {
  color: #ffd700;
  font-weight: 600;
}

/* 记录列表 */
.records-list {
  padding: 12px 16px;
}

.swipe-cell-wrapper {
  margin-bottom: 10px;
}

/* 卡片入场动画 */
.record-card {
  position: relative;
  background: #fff;
  border-radius: 16px;
  padding: 12px;
  overflow: hidden;
  animation: slideInUp 0.4s ease-out backwards;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
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
  background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
  opacity: 0.8;
}

.card-content {
  position: relative;
  z-index: 1;
}

.record-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  font-size: 13px;
  color: #969799;
}

.record-location {
  color: #fa709a;
  font-size: 12px;
}

.record-main {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 8px;
}

.soc-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.soc-value {
  font-size: 20px;
  font-weight: 600;
  color: #646566;
}

.soc-value.before {
  font-size: 16px;
  color: #07c160;
}

.soc-value.after {
  font-size: 28px;
  color: #fa709a;
}

.arrow {
  color: #969799;
  font-size: 16px;
  margin: 2px 0;
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

.info-value.cost {
  color: #ff976a;
  font-weight: 600;
}

.dark-mode .info-value {
  color: #fff;
}

.record-note {
  font-size: 12px;
  color: #969799;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #f7f8fa;
}

.dark-mode .record-note {
  border-top-color: #3a3a3a;
}

/* 充电徽章 */
.charging-badge {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 4px 8px;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(250, 112, 154, 0.12) 0%, rgba(254, 225, 64, 0.12) 100%);
  border: 1.5px solid rgba(250, 112, 154, 0.25);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  box-shadow: 0 2px 8px rgba(250, 112, 154, 0.15);
  animation: fadeInScale 0.5s ease-out backwards;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes fadeInScale {
  from {
    opacity: 0;
    transform: scale(0.8);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.charging-badge:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(250, 112, 154, 0.25);
}

.charging-icon {
  width: 10px;
  height: 10px;
  color: #fa709a;
  flex-shrink: 0;
}

.charging-value {
  font-size: 11px;
  font-weight: 600;
  background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  white-space: nowrap;
}

.dark-mode .charging-badge {
  background: linear-gradient(135deg, rgba(250, 112, 154, 0.2) 0%, rgba(254, 225, 64, 0.2) 100%);
  border-color: rgba(250, 112, 154, 0.35);
}

.delete-btn {
  height: 100%;
}
</style>
