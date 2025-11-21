<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useAppStore } from '../stores'
import { calculateRecordData } from '../utils/calculator'
import * as echarts from 'echarts'

const store = useAppStore()

// 图表 DOM 引用
const busbarChartRef = ref(null)
const tempChartRef = ref(null)
const trendChartRef = ref(null)
const consumptionTrendChartRef = ref(null)

// 图表实例
let busbarChart = null
let tempChart = null
let trendChart = null
let consumptionTrendChart = null

// 当前选中的图表 Tab
const activeTab = ref(0)

// 加载状态
const loading = ref(true)

// 计算后的记录
const computedRecords = computed(() => {
  return store.records.map(record =>
    calculateRecordData(record, store.totalEnergy, store.settings.electricityPrice)
  )
})

// 母线电流与能耗数据（气泡图：气泡大小 = 相线电流）
const busbarData = computed(() => {
  return computedRecords.value.map(record => ({
    busbar: record.busbarCurrent,
    phase: record.phaseCurrent,
    consumption: record.energyConsumption,
    // 根据能耗等级决定颜色
    level: record.energyConsumption < store.settings.excellentThreshold
      ? 'excellent'
      : record.energyConsumption <= store.settings.warningThreshold
        ? 'normal'
        : 'warning'
  }))
})

// 最省电配置推荐
const bestConfig = computed(() => {
  if (computedRecords.value.length === 0) return null

  const sorted = [...computedRecords.value].sort((a, b) => a.energyConsumption - b.energyConsumption)
  const best = sorted[0]

  return {
    consumption: best.energyConsumption,
    busbar: best.busbarCurrent,
    phase: best.phaseCurrent,
    range: best.range,
    tags: best.tags || []
  }
})

// 温度与能耗散点数据
const tempData = computed(() => {
  const motorData = computedRecords.value
    .filter(record => record.motorTemp)
    .map(record => ({
      temp: record.motorTemp,
      consumption: record.energyConsumption,
      type: 'motor'
    }))

  const controllerData = computedRecords.value
    .filter(record => record.controllerTemp)
    .map(record => ({
      temp: record.controllerTemp,
      consumption: record.energyConsumption,
      type: 'controller'
    }))

  return { motorData, controllerData }
})

// 续航趋势数据
const trendData = computed(() => {
  return [...computedRecords.value]
    .sort((a, b) => new Date(a.datetime) - new Date(b.datetime))
    .map(record => ({
      date: new Date(record.datetime).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }),
      range: record.range
    }))
})

// 计算移动平均线
function calculateMovingAverage(data, window = 7) {
  // 自适应窗口大小：数据少于7个时使用较小窗口
  const actualWindow = Math.min(window, Math.max(3, Math.floor(data.length / 2)))

  if (data.length < 3) return data.map(d => d.consumption)

  const result = []
  for (let i = 0; i < data.length; i++) {
    if (i < actualWindow - 1) {
      // 前面的数据点，使用可用的数据计算平均
      const slice = data.slice(0, i + 1)
      const avg = slice.reduce((sum, item) => sum + item.consumption, 0) / slice.length
      result.push(avg)
    } else {
      // 使用完整的窗口计算
      const slice = data.slice(i - actualWindow + 1, i + 1)
      const avg = slice.reduce((sum, item) => sum + item.consumption, 0) / slice.length
      result.push(avg)
    }
  }
  return result
}

// 能耗趋势数据（含移动平均线）
const consumptionTrendData = computed(() => {
  const sorted = [...computedRecords.value]
    .sort((a, b) => new Date(a.datetime) - new Date(b.datetime))

  if (sorted.length === 0) return { dates: [], actual: [], moving: [] }

  // 使用更详细的日期时间格式，避免同一天多条记录显示重复
  const dates = sorted.map(r => {
    const d = new Date(r.datetime)
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
  })
  const actual = sorted.map(r => r.energyConsumption)
  const moving = calculateMovingAverage(sorted.map(r => ({ consumption: r.energyConsumption })))

  return { dates, actual, moving, records: sorted }
})

// 改善分析数据
const improvementAnalysis = computed(() => {
  if (computedRecords.value.length < 2) return null

  const sorted = [...computedRecords.value]
    .sort((a, b) => new Date(b.datetime) - new Date(a.datetime))

  // 最近7天
  const recent7Days = sorted.slice(0, Math.min(7, sorted.length))
  if (recent7Days.length === 0) return null

  const recentAvg = recent7Days.reduce((sum, r) => sum + r.energyConsumption, 0) / recent7Days.length

  // 之前7天（用于对比）
  const previous7Days = sorted.slice(7, Math.min(14, sorted.length))

  let trend = '暂无对比数据'
  let changePercent = 0
  let changeText = ''

  if (previous7Days.length > 0) {
    const previousAvg = previous7Days.reduce((sum, r) => sum + r.energyConsumption, 0) / previous7Days.length
    changePercent = ((recentAvg - previousAvg) / previousAvg * 100)

    if (changePercent < -2) {
      trend = 'improving'
      changeText = `↓ ${Math.abs(changePercent).toFixed(1)}% (改善中 ✨)`
    } else if (changePercent > 2) {
      trend = 'worsening'
      changeText = `↑ ${changePercent.toFixed(1)}% (需注意 ⚠️)`
    } else {
      trend = 'stable'
      changeText = `≈ ${Math.abs(changePercent).toFixed(1)}% (稳定 👌)`
    }
  }

  // 最佳记录
  const bestRecord = recent7Days.reduce((best, current) =>
    current.energyConsumption < best.energyConsumption ? current : best
  )

  const daysAgo = Math.floor((new Date() - new Date(bestRecord.datetime)) / (1000 * 60 * 60 * 24))
  const daysAgoText = daysAgo === 0 ? '今天' : `${daysAgo}天前`

  return {
    recentAvg: recentAvg.toFixed(1),
    trend,
    changeText,
    bestConsumption: bestRecord.energyConsumption.toFixed(1),
    bestDaysAgo: daysAgoText,
    recordCount: recent7Days.length
  }
})

// 按路况标签分组的配置推荐
const configRecommendationsByTag = computed(() => {
  if (computedRecords.value.length === 0) return []

  // 按标签分组
  const groupedByTag = {}
  computedRecords.value.forEach(record => {
    if (!record.tags || record.tags.length === 0) {
      // 无标签的记录归入"通用"分组
      if (!groupedByTag['通用']) groupedByTag['通用'] = []
      groupedByTag['通用'].push(record)
    } else {
      record.tags.forEach(tag => {
        if (!groupedByTag[tag]) groupedByTag[tag] = []
        groupedByTag[tag].push(record)
      })
    }
  })

  // 为每个标签找出最优配置
  const recommendations = []
  Object.entries(groupedByTag).forEach(([tag, records]) => {
    if (records.length < 3) return // 样本太少不推荐

    // 找出能耗最低的记录
    const sorted = [...records].sort((a, b) => a.energyConsumption - b.energyConsumption)
    const best = sorted[0]

    // 计算该标签下的平均能耗
    const avgConsumption = records.reduce((sum, r) => sum + r.energyConsumption, 0) / records.length

    recommendations.push({
      tag,
      busbar: best.busbarCurrent,
      phase: best.phaseCurrent,
      consumption: best.energyConsumption.toFixed(1),
      range: Math.round(best.range),
      avgConsumption: avgConsumption.toFixed(1),
      sampleCount: records.length
    })
  })

  return recommendations.sort((a, b) => b.sampleCount - a.sampleCount) // 按样本数量排序
})

// 初始化母线电流效率图表（渐变色版本）
function initBusbarChart() {
  if (!busbarChartRef.value || busbarData.value.length === 0) return

  loading.value = true

  if (busbarChart) {
    busbarChart.dispose()
  }

  busbarChart = echarts.init(busbarChartRef.value)

  const option = {
    title: {
      text: '母线电流效率分析',
      subtext: '气泡大小 = 相线电流',
      left: 'center',
      textStyle: {
        fontSize: 16,
        fontWeight: 600,
        color: store.settings.darkMode ? '#fff' : '#323233'
      },
      subtextStyle: {
        fontSize: 12,
        color: store.settings.darkMode ? '#999' : '#969799'
      }
    },
    tooltip: {
      formatter: params => {
        return `母线: ${params.data[0]}A<br/>能耗: ${params.data[1]} Wh/km<br/>相线: ${params.data[2]}A`
      },
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      borderWidth: 0,
      textStyle: {
        color: '#fff'
      }
    },
    xAxis: {
      type: 'value',
      name: '母线限流 (A)',
      nameLocation: 'middle',
      nameGap: 30,
      axisLine: {
        lineStyle: {
          color: store.settings.darkMode ? '#666' : '#e0e0e0'
        }
      },
      axisLabel: {
        color: store.settings.darkMode ? '#999' : '#666'
      },
      splitLine: {
        lineStyle: {
          color: store.settings.darkMode ? '#333' : '#f0f0f0'
        }
      }
    },
    yAxis: {
      type: 'value',
      name: '能耗 (Wh/km)',
      nameLocation: 'middle',
      nameGap: 40,
      axisLine: {
        lineStyle: {
          color: store.settings.darkMode ? '#666' : '#e0e0e0'
        }
      },
      axisLabel: {
        color: store.settings.darkMode ? '#999' : '#666'
      },
      splitLine: {
        lineStyle: {
          color: store.settings.darkMode ? '#333' : '#f0f0f0'
        }
      }
    },
    series: [{
      type: 'scatter',
      data: busbarData.value.map(d => [
        d.busbar,        // X: 母线电流
        d.consumption,   // Y: 能耗
        d.phase          // 气泡大小的数据源
      ]),
      symbolSize: val => {
        // 相线电流映射到气泡大小 (80-200A -> 15-35px)
        const phase = val[2]
        return Math.max(15, Math.min(35, (phase - 80) / 120 * 20 + 15))
      },
      itemStyle: {
        color: params => {
          const level = busbarData.value[params.dataIndex].level
          // 根据能耗等级返回渐变颜色
          if (level === 'excellent') {
            return new echarts.graphic.RadialGradient(0.5, 0.5, 0.8, [
              { offset: 0, color: '#43e97b' },
              { offset: 1, color: '#38f9d7' }
            ])
          } else if (level === 'normal') {
            return new echarts.graphic.RadialGradient(0.5, 0.5, 0.8, [
              { offset: 0, color: '#f093fb' },
              { offset: 1, color: '#f5576c' }
            ])
          } else {
            return new echarts.graphic.RadialGradient(0.5, 0.5, 0.8, [
              { offset: 0, color: '#fa709a' },
              { offset: 1, color: '#fee140' }
            ])
          }
        },
        shadowBlur: 10,
        shadowColor: 'rgba(0, 0, 0, 0.3)'
      },
      animationDelay: idx => idx * 30
    }],
    grid: {
      left: '15%',
      right: '10%',
      bottom: '15%',
      top: '22%'
    }
  }

  busbarChart.setOption(option)

  setTimeout(() => {
    loading.value = false
  }, 500)
}

// 初始化温度影响图表（渐变色版本）
function initTempChart() {
  const hasData = tempData.value.motorData.length > 0 || tempData.value.controllerData.length > 0
  if (!tempChartRef.value || !hasData) return

  loading.value = true

  if (tempChart) {
    tempChart.dispose()
  }

  tempChart = echarts.init(tempChartRef.value)

  const option = {
    title: {
      text: '温度影响分析',
      left: 'center',
      top: '2%',
      textStyle: {
        fontSize: 16,
        fontWeight: 600,
        color: store.settings.darkMode ? '#fff' : '#323233'
      }
    },
    legend: {
      data: ['电机温度', '控制器温度'],
      top: '12%',
      textStyle: {
        color: store.settings.darkMode ? '#999' : '#666'
      }
    },
    tooltip: {
      formatter: params => {
        const label = params.seriesName === '电机温度' ? '电机温度' : '控制器温度'
        return `${label}: ${params.data[0]}°C<br/>能耗: ${params.data[1]} Wh/km`
      },
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      borderWidth: 0,
      textStyle: {
        color: '#fff'
      }
    },
    xAxis: {
      type: 'value',
      name: '温度 (°C)',
      nameLocation: 'middle',
      nameGap: 30,
      axisLine: {
        lineStyle: {
          color: store.settings.darkMode ? '#666' : '#e0e0e0'
        }
      },
      axisLabel: {
        color: store.settings.darkMode ? '#999' : '#666'
      },
      splitLine: {
        lineStyle: {
          color: store.settings.darkMode ? '#333' : '#f0f0f0'
        }
      }
    },
    yAxis: {
      type: 'value',
      name: 'Wh/km',
      nameLocation: 'middle',
      nameGap: 40,
      axisLine: {
        lineStyle: {
          color: store.settings.darkMode ? '#666' : '#e0e0e0'
        }
      },
      axisLabel: {
        color: store.settings.darkMode ? '#999' : '#666'
      },
      splitLine: {
        lineStyle: {
          color: store.settings.darkMode ? '#333' : '#f0f0f0'
        }
      }
    },
    series: [
      {
        name: '电机温度',
        type: 'scatter',
        data: tempData.value.motorData.map(d => [d.temp, d.consumption]),
        symbolSize: 12,
        itemStyle: {
          color: new echarts.graphic.RadialGradient(0.5, 0.5, 0.8, [
            { offset: 0, color: '#4facfe' },
            { offset: 1, color: '#00f2fe' }
          ]),
          shadowBlur: 10,
          shadowColor: 'rgba(79, 172, 254, 0.5)'
        }
      },
      {
        name: '控制器温度',
        type: 'scatter',
        data: tempData.value.controllerData.map(d => [d.temp, d.consumption]),
        symbolSize: 12,
        itemStyle: {
          color: new echarts.graphic.RadialGradient(0.5, 0.5, 0.8, [
            { offset: 0, color: '#ff976a' },
            { offset: 1, color: '#f5576c' }
          ]),
          shadowBlur: 10,
          shadowColor: 'rgba(255, 151, 106, 0.5)'
        }
      }
    ],
    grid: {
      left: '15%',
      right: '10%',
      bottom: '15%',
      top: '22%'
    }
  }

  tempChart.setOption(option)

  setTimeout(() => {
    loading.value = false
  }, 500)
}

// 初始化续航趋势图表（渐变色版本）
function initTrendChart() {
  if (!trendChartRef.value || trendData.value.length === 0) return

  loading.value = true

  if (trendChart) {
    trendChart.dispose()
  }

  trendChart = echarts.init(trendChartRef.value)

  const option = {
    title: {
      text: '续航趋势',
      left: 'center',
      textStyle: {
        fontSize: 16,
        fontWeight: 600,
        color: store.settings.darkMode ? '#fff' : '#323233'
      }
    },
    tooltip: {
      trigger: 'axis',
      formatter: '{b}: {c} km',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      borderWidth: 0,
      textStyle: {
        color: '#fff'
      }
    },
    xAxis: {
      type: 'category',
      data: trendData.value.map(d => d.date),
      axisLabel: {
        rotate: 45,
        color: store.settings.darkMode ? '#999' : '#666'
      },
      axisLine: {
        lineStyle: {
          color: store.settings.darkMode ? '#666' : '#e0e0e0'
        }
      }
    },
    yAxis: {
      type: 'value',
      name: '续航 (km)',
      nameLocation: 'middle',
      nameGap: 40,
      axisLine: {
        lineStyle: {
          color: store.settings.darkMode ? '#666' : '#e0e0e0'
        }
      },
      axisLabel: {
        color: store.settings.darkMode ? '#999' : '#666'
      },
      splitLine: {
        lineStyle: {
          color: store.settings.darkMode ? '#333' : '#f0f0f0'
        }
      }
    },
    series: [{
      type: 'line',
      data: trendData.value.map(d => d.range),
      smooth: true,
      lineStyle: {
        width: 3,
        color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
          { offset: 0, color: '#43e97b' },
          { offset: 1, color: '#38f9d7' }
        ])
      },
      itemStyle: {
        color: '#43e97b'
      },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(67, 233, 123, 0.3)' },
          { offset: 1, color: 'rgba(56, 249, 215, 0.05)' }
        ])
      },
      animationDuration: 1000
    }],
    grid: {
      left: '15%',
      right: '10%',
      bottom: '20%',
      top: '20%'
    }
  }

  trendChart.setOption(option)

  setTimeout(() => {
    loading.value = false
  }, 500)
}

// 初始化能耗趋势分析图表
function initConsumptionTrendChart() {
  if (!consumptionTrendChartRef.value || consumptionTrendData.value.dates.length === 0) return

  loading.value = true

  if (consumptionTrendChart) {
    consumptionTrendChart.dispose()
  }

  consumptionTrendChart = echarts.init(consumptionTrendChartRef.value)

  const option = {
    title: {
      text: '能耗趋势分析',
      left: 'center',
      top: '2%',
      textStyle: {
        fontSize: 16,
        fontWeight: 600,
        color: store.settings.darkMode ? '#fff' : '#323233'
      }
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      borderWidth: 0,
      textStyle: {
        color: '#fff',
        fontSize: 12
      },
      formatter: params => {
        let result = `<div style="font-size: 12px;">${params[0].axisValue}</div>`
        params.forEach(item => {
          result += `<div style="margin-top: 4px;">${item.marker} ${item.seriesName}: <strong>${item.value.toFixed(1)}</strong> Wh/km</div>`
        })
        return result
      }
    },
    legend: {
      data: ['实际能耗', '移动平均'],
      top: '12%',
      itemGap: 16,
      textStyle: {
        color: store.settings.darkMode ? '#999' : '#666',
        fontSize: 12
      }
    },
    xAxis: {
      type: 'category',
      data: consumptionTrendData.value.dates,
      axisLabel: {
        rotate: 45,
        color: store.settings.darkMode ? '#999' : '#666',
        fontSize: 10
      },
      axisLine: {
        lineStyle: {
          color: store.settings.darkMode ? '#666' : '#e0e0e0'
        }
      }
    },
    yAxis: {
      type: 'value',
      name: '能耗 (Wh/km)',
      nameLocation: 'middle',
      nameGap: 45,
      axisLine: {
        lineStyle: {
          color: store.settings.darkMode ? '#666' : '#e0e0e0'
        }
      },
      axisLabel: {
        color: store.settings.darkMode ? '#999' : '#666'
      },
      splitLine: {
        lineStyle: {
          color: store.settings.darkMode ? '#333' : '#f0f0f0'
        }
      }
    },
    series: [
      {
        name: '实际能耗',
        type: 'line',
        data: consumptionTrendData.value.actual,
        smooth: false,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: {
          width: 2,
          color: store.settings.darkMode ? '#667eea' : '#667eea'
        },
        itemStyle: {
          color: '#667eea'
        }
      },
      {
        name: '移动平均',
        type: 'line',
        data: consumptionTrendData.value.moving,
        smooth: true,
        symbol: 'none',
        lineStyle: {
          width: 3,
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: '#43e97b' },
            { offset: 1, color: '#38f9d7' }
          ])
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(67, 233, 123, 0.2)' },
            { offset: 1, color: 'rgba(56, 249, 215, 0.05)' }
          ])
        },
        animationDuration: 1000
      }
    ],
    grid: {
      left: '15%',
      right: '10%',
      bottom: '20%',
      top: '28%'
    }
  }

  consumptionTrendChart.setOption(option)

  setTimeout(() => {
    loading.value = false
  }, 500)
}

// 监听 Tab 切换
watch(activeTab, async () => {
  await nextTick()
  if (activeTab.value === 0) initBusbarChart()
  else if (activeTab.value === 1) initTempChart()
  else if (activeTab.value === 2) initTrendChart()
  else if (activeTab.value === 3) initConsumptionTrendChart()
})

// 监听深色模式
watch(() => store.settings.darkMode, () => {
  if (activeTab.value === 0) initBusbarChart()
  else if (activeTab.value === 1) initTempChart()
  else if (activeTab.value === 2) initTrendChart()
  else if (activeTab.value === 3) initConsumptionTrendChart()
})

onMounted(() => {
  nextTick(() => {
    initBusbarChart()
  })
})

// 窗口大小变化时重绘图表
window.addEventListener('resize', () => {
  busbarChart?.resize()
  tempChart?.resize()
  trendChart?.resize()
  consumptionTrendChart?.resize()
})
</script>

<template>
  <div class="charts-page">
    <van-nav-bar title="图表分析" fixed placeholder />

    <div v-if="computedRecords.length === 0" class="empty-state">
      <van-empty description="暂无数据，请先录入骑行记录" />
    </div>

    <div v-else class="charts-container">
      <!-- 最省电配置推荐卡片 -->
      <div v-if="bestConfig" class="best-config-card">
        <div class="best-config-bg"></div>
        <div class="best-config-content">
          <div class="config-header">
            <van-icon name="award-o" size="20" />
            <span>最省电配置</span>
          </div>
          <div class="config-main">
            <div class="config-consumption">
              <span class="config-value">{{ bestConfig.consumption }}</span>
              <span class="config-unit">Wh/km</span>
            </div>
            <div class="config-details">
              <div class="config-item">
                <span class="config-label">母线/相线</span>
                <span class="config-text">{{ bestConfig.busbar }}/{{ bestConfig.phase }}A</span>
              </div>
              <div class="config-item">
                <span class="config-label">理论续航</span>
                <span class="config-text">{{ bestConfig.range }} km</span>
              </div>
            </div>
          </div>
          <div v-if="bestConfig.tags.length > 0" class="config-tags">
            <van-tag
              v-for="tag in bestConfig.tags"
              :key="tag"
              type="success"
              plain
              size="small"
            >
              {{ tag }}
            </van-tag>
          </div>
        </div>
      </div>

      <!-- 能耗改善分析卡片 -->
      <div v-if="improvementAnalysis" class="improvement-card">
        <div class="improvement-bg" :style="{
          background: improvementAnalysis.trend === 'improving'
            ? 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)'
            : improvementAnalysis.trend === 'worsening'
            ? 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)'
            : 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'
        }"></div>
        <div class="improvement-content">
          <div class="improvement-header">
            <van-icon name="chart-trending-o" size="20" />
            <span>最近7天能耗分析</span>
          </div>
          <div class="improvement-stats">
            <div class="stat-item">
              <span class="stat-label">平均能耗</span>
              <span class="stat-value">{{ improvementAnalysis.recentAvg }} Wh/km</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">相比之前</span>
              <span class="stat-value">{{ improvementAnalysis.changeText }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">最佳记录</span>
              <span class="stat-value">{{ improvementAnalysis.bestConsumption }} Wh/km ({{ improvementAnalysis.bestDaysAgo }})</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 按路况分组的配置推荐 -->
      <div v-if="configRecommendationsByTag.length > 0" class="recommendations-section">
        <div class="section-title">
          <van-icon name="fire-o" size="18" />
          <span>路况推荐配置</span>
        </div>
        <div class="recommendation-cards">
          <div
            v-for="rec in configRecommendationsByTag"
            :key="rec.tag"
            class="recommendation-card"
          >
            <div class="rec-tag">{{ rec.tag }}</div>
            <div class="rec-stats">
              <div class="rec-main">
                <span class="rec-value">{{ rec.consumption }}</span>
                <span class="rec-unit">Wh/km</span>
              </div>
              <div class="rec-details">
                <div class="rec-detail">
                  <span class="rec-label">母线/相线</span>
                  <span class="rec-text">{{ rec.busbar }}/{{ rec.phase }}A</span>
                </div>
                <div class="rec-detail">
                  <span class="rec-label">续航</span>
                  <span class="rec-text">{{ rec.range }} km</span>
                </div>
                <div class="rec-detail">
                  <span class="rec-label">样本数</span>
                  <span class="rec-text">{{ rec.sampleCount }} 次</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Tab 切换 -->
      <div class="tab-bar">
        <van-button
          :type="activeTab === 0 ? 'primary' : 'default'"
          size="small"
          @click="activeTab = 0"
        >
          电流效率
        </van-button>
        <van-button
          :type="activeTab === 1 ? 'primary' : 'default'"
          size="small"
          @click="activeTab = 1"
        >
          温度影响
        </van-button>
        <van-button
          :type="activeTab === 2 ? 'primary' : 'default'"
          size="small"
          @click="activeTab = 2"
        >
          续航趋势
        </van-button>
        <van-button
          :type="activeTab === 3 ? 'primary' : 'default'"
          size="small"
          @click="activeTab = 3"
        >
          能耗趋势
        </van-button>
      </div>

      <!-- 图表容器 + 骨架屏 -->
      <div class="chart-wrapper">
        <van-skeleton :loading="loading" :row="5" :row-width="['100%', '80%', '60%', '90%', '70%']">
          <div v-show="activeTab === 0" ref="busbarChartRef" class="chart-box"></div>
          <div v-show="activeTab === 1" ref="tempChartRef" class="chart-box">
            <div v-if="tempData.motorData.length === 0 && tempData.controllerData.length === 0" class="no-data">
              暂无温度数据，请在录入时填写温度
            </div>
          </div>
          <div v-show="activeTab === 2" ref="trendChartRef" class="chart-box"></div>
          <div v-show="activeTab === 3" ref="consumptionTrendChartRef" class="chart-box"></div>
        </van-skeleton>
      </div>

      <!-- 数据摘要 - 渐变卡片 -->
      <div class="summary-cards">
        <div class="summary-card">
          <div class="summary-bg" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%)"></div>
          <div class="summary-content">
            <div class="summary-value">{{ computedRecords.length }}</div>
            <div class="summary-label">总记录数</div>
          </div>
        </div>

        <div class="summary-card">
          <div class="summary-bg" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%)"></div>
          <div class="summary-content">
            <div class="summary-value">{{ (computedRecords.reduce((sum, r) => sum + r.energyConsumption, 0) / computedRecords.length).toFixed(1) }}</div>
            <div class="summary-label">平均能耗 (Wh/km)</div>
          </div>
        </div>

        <div class="summary-card">
          <div class="summary-bg" style="background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)"></div>
          <div class="summary-content">
            <div class="summary-value">{{ Math.min(...computedRecords.map(r => r.energyConsumption)).toFixed(1) }}</div>
            <div class="summary-label">最佳能耗 (Wh/km)</div>
          </div>
        </div>

        <div class="summary-card">
          <div class="summary-bg" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)"></div>
          <div class="summary-content">
            <div class="summary-value">{{ computedRecords.reduce((sum, r) => sum + r.distance, 0).toFixed(1) }}</div>
            <div class="summary-label">总里程 (km)</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.charts-page {
  padding-bottom: 20px;
}

.empty-state {
  padding-top: 100px;
}

.charts-container {
  padding: 16px;
}

/* 最省电配置卡片 */
.best-config-card {
  position: relative;
  border-radius: 16px;
  overflow: hidden;
  margin-bottom: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  animation: slideInDown 0.5s ease-out;
}

@keyframes slideInDown {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.best-config-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
  opacity: 0.15;
}

.best-config-content {
  position: relative;
  z-index: 1;
  padding: 16px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.dark-mode .best-config-content {
  background: rgba(30, 30, 30, 0.95);
}

.config-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #43e97b;
  margin-bottom: 12px;
}

.config-main {
  display: flex;
  align-items: center;
  gap: 16px;
}

.config-consumption {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.config-value {
  font-size: 36px;
  font-weight: bold;
  background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.config-unit {
  font-size: 12px;
  color: #969799;
  margin-top: 4px;
}

.config-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.config-item {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
}

.config-label {
  color: #969799;
}

.config-text {
  font-weight: 600;
  color: #323233;
}

.dark-mode .config-text {
  color: #fff;
}

.config-tags {
  margin-top: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

/* 能耗改善分析卡片 */
.improvement-card {
  position: relative;
  border-radius: 16px;
  overflow: hidden;
  margin-bottom: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  animation: slideInDown 0.5s ease-out 0.1s backwards;
}

.improvement-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  opacity: 0.15;
}

.improvement-content {
  position: relative;
  z-index: 1;
  padding: 16px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.dark-mode .improvement-content {
  background: rgba(30, 30, 30, 0.95);
}

.improvement-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #323233;
  margin-bottom: 12px;
}

.dark-mode .improvement-header {
  color: #fff;
}

.improvement-stats {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
}

.stat-label {
  color: #969799;
  font-weight: 500;
}

.stat-value {
  color: #323233;
  font-weight: 600;
}

.dark-mode .stat-value {
  color: #fff;
}

/* 路况推荐配置 */
.recommendations-section {
  margin-bottom: 16px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: #323233;
  margin-bottom: 12px;
}

.dark-mode .section-title {
  color: #fff;
}

.recommendation-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
}

.recommendation-card {
  background: #fff;
  border-radius: 12px;
  padding: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  animation: fadeInScale 0.5s ease-out backwards;
  transition: all 0.3s ease;
}

.recommendation-card:nth-child(1) { animation-delay: 0.05s; }
.recommendation-card:nth-child(2) { animation-delay: 0.1s; }
.recommendation-card:nth-child(3) { animation-delay: 0.15s; }
.recommendation-card:nth-child(4) { animation-delay: 0.2s; }

.recommendation-card:active {
  transform: scale(0.98);
}

.dark-mode .recommendation-card {
  background: #2a2a2a;
}

.rec-tag {
  font-size: 12px;
  font-weight: 600;
  color: #667eea;
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid #f0f0f0;
}

.dark-mode .rec-tag {
  border-bottom-color: #3a3a3a;
}

.rec-stats {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rec-main {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.rec-value {
  font-size: 24px;
  font-weight: bold;
  background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.rec-unit {
  font-size: 10px;
  color: #969799;
}

.rec-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.rec-detail {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
}

.rec-label {
  color: #969799;
}

.rec-text {
  color: #323233;
  font-weight: 500;
}

.dark-mode .rec-text {
  color: #fff;
}

@keyframes fadeInScale {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.tab-bar {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.chart-wrapper {
  margin-bottom: 16px;
}

.chart-box {
  width: 100%;
  height: 300px;
  background: #fff;
  border-radius: 12px;
  padding: 10px;
  position: relative;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

.dark-mode .chart-box {
  background: #2a2a2a;
}

.no-data {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #969799;
  font-size: 14px;
}

/* 渐变摘要卡片 */
.summary-cards {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.summary-card {
  position: relative;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  animation: fadeInScale 0.5s ease-out backwards;
}

.summary-card:nth-child(1) { animation-delay: 0.1s; }
.summary-card:nth-child(2) { animation-delay: 0.15s; }
.summary-card:nth-child(3) { animation-delay: 0.2s; }
.summary-card:nth-child(4) { animation-delay: 0.25s; }

@keyframes fadeInScale {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.summary-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  opacity: 0.15;
}

.summary-content {
  position: relative;
  z-index: 1;
  padding: 16px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  text-align: center;
}

.dark-mode .summary-content {
  background: rgba(30, 30, 30, 0.95);
}

.summary-value {
  font-size: 28px;
  font-weight: bold;
  color: #323233;
  margin-bottom: 4px;
}

.dark-mode .summary-value {
  color: #fff;
}

.summary-label {
  font-size: 12px;
  color: #969799;
  line-height: 1.4;
}
</style>
