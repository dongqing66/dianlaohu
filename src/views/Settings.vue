<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAppStore } from '../stores'
import { useRoute } from 'vue-router'
import { showToast, showConfirmDialog, showDialog } from 'vant'
import * as XLSX from 'xlsx'
import { calculateRecordData } from '../utils/calculator'

const store = useAppStore()
const route = useRoute()

// 电压预设值
const voltagePresets = [48, 60, 64, 72]

// 表单数据
const voltage = ref(store.settings.voltage)
const capacity = ref(store.settings.capacity)
const excellentThreshold = ref(store.settings.excellentThreshold)
const warningThreshold = ref(store.settings.warningThreshold)
const darkMode = ref(store.settings.darkMode)
const electricityPrice = ref(store.settings.electricityPrice)
const chargingEfficiency = ref(store.settings.chargingEfficiency * 100) // 转换为百分比显示

// 新标签输入
const newTag = ref('')
const showTagInput = ref(false)

// 计算电池总能量
const totalEnergy = computed(() => voltage.value * capacity.value)

// 选择电压预设
function selectVoltage(val) {
  voltage.value = val
  saveSettings()
}

// 保存设置
function saveSettings() {
  store.updateSettings({
    voltage: voltage.value,
    capacity: capacity.value,
    excellentThreshold: excellentThreshold.value,
    warningThreshold: warningThreshold.value,
    darkMode: darkMode.value,
    electricityPrice: electricityPrice.value,
    chargingEfficiency: chargingEfficiency.value / 100 // 转换为小数保存
  })
  showToast('设置已保存')
}

// 切换深色模式
function toggleDarkMode(val) {
  darkMode.value = val
  store.updateSettings({ darkMode: val })
}

// 添加自定义标签
function addTag() {
  const tag = newTag.value.trim()
  if (!tag) {
    showToast('请输入标签名称')
    return
  }
  if (store.allTags.includes(tag)) {
    showToast('标签已存在')
    return
  }
  store.addCustomTag(tag)
  newTag.value = ''
  showTagInput.value = false
  showToast('标签已添加')
}

// 删除自定义标签
async function removeTag(tag) {
  try {
    await showConfirmDialog({
      title: '确认删除',
      message: `确定要删除标签"${tag}"吗？`
    })
    store.removeCustomTag(tag)
    showToast('标签已删除')
  } catch {
    // 用户取消
  }
}

// 导出 Excel
function exportExcel() {
  if (store.records.length === 0) {
    showToast('暂无数据可导出')
    return
  }

  const data = store.records.map(record => {
    const computed = calculateRecordData(record, store.totalEnergy, store.settings.electricityPrice)
    return {
      '日期时间': new Date(record.datetime).toLocaleString('zh-CN'),
      '母线限流(A)': record.busbarCurrent,
      '相线限流(A)': record.phaseCurrent,
      '行驶里程(km)': record.distance,
      '电量消耗(%)': record.socConsumed,
      '消耗能量(Wh)': computed.consumedEnergy,
      '平均能耗(Wh/km)': computed.energyConsumption,
      '理论续航(km)': computed.range,
      '电费(元)': computed.electricityCost,
      '电机温度(°C)': record.motorTemp || '',
      '控制器温度(°C)': record.controllerTemp || '',
      '路况标签': record.tags?.join(', ') || '',
      '备注': record.note || ''
    }
  })

  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '骑行记录')

  const fileName = `骑行记录_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.xlsx`
  XLSX.writeFile(wb, fileName)
  showToast('已导出 Excel')
}

// 导出 JSON 备份
function exportJSON() {
  const json = store.exportJSON()
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `ev-tuner-backup_${new Date().toISOString().split('T')[0]}.json`
  a.click()
  URL.revokeObjectURL(url)

  // 重置备份计数器
  store.resetBackupCounter()
  showToast('已导出备份')
}

// 导入 JSON 备份
function importJSON(event) {
  const file = event.target.files[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (e) => {
    const success = store.importJSON(e.target.result)
    if (success) {
      // 更新本地表单数据
      voltage.value = store.settings.voltage
      capacity.value = store.settings.capacity
      excellentThreshold.value = store.settings.excellentThreshold
      warningThreshold.value = store.settings.warningThreshold
      darkMode.value = store.settings.darkMode
      electricityPrice.value = store.settings.electricityPrice
      chargingEfficiency.value = (store.settings.chargingEfficiency || 0.88) * 100 // 转换为百分比
      showToast('导入成功')
    } else {
      showToast('导入失败，文件格式错误')
    }
  }
  reader.readAsText(file)

  // 清空 input 以便再次选择同一文件
  event.target.value = ''
}

// 清空所有数据
async function clearAllData() {
  try {
    await showConfirmDialog({
      title: '危险操作',
      message: '确定要清空所有骑行记录吗？此操作不可恢复！'
    })
    store.clearRecords()
    showToast('已清空所有记录')
  } catch {
    // 用户取消
  }
}

// 显示关于
function showAbout() {
  showDialog({
    title: '电老虎测试',
    message: '版本 1.3.0\n\n电动车性能调教助手\n记录骑行数据，分析能耗效率\n\n数据存储在本地浏览器中',
    confirmButtonText: '知道了'
  })
}

// 处理路由参数
onMounted(() => {
  // 如果是从备份提醒跳转过来，自动触发导出
  if (route.query.action === 'export') {
    setTimeout(() => {
      exportJSON()
    }, 300)
  }
})
</script>

<template>
  <div class="settings-page">
    <van-nav-bar title="设置" fixed placeholder />

    <!-- 电池参数 -->
    <van-cell-group inset title="电池参数">
      <van-cell title="标称电压">
        <template #value>
          <div class="voltage-presets">
            <van-button
              v-for="val in voltagePresets"
              :key="val"
              size="mini"
              :type="voltage === val ? 'primary' : 'default'"
              @click="selectVoltage(val)"
            >
              {{ val }}V
            </van-button>
          </div>
        </template>
      </van-cell>
      <van-field
        v-model="voltage"
        type="number"
        label="自定义电压"
        placeholder="输入电压"
        @blur="saveSettings"
      >
        <template #button>V</template>
      </van-field>
      <van-field
        v-model="capacity"
        type="number"
        label="电池容量"
        placeholder="输入容量"
        @blur="saveSettings"
      >
        <template #button>Ah</template>
      </van-field>
      <van-cell title="电池总能量" :value="`${totalEnergy} Wh`" />
    </van-cell-group>

    <!-- 电价设置 -->
    <van-cell-group inset title="电价设置">
      <van-field
        v-model="electricityPrice"
        type="number"
        label="电价"
        placeholder="输入电价"
        @blur="saveSettings"
      >
        <template #button>元/kWh</template>
      </van-field>
      <van-cell title-class="hint-text">
        用于计算每次骑行的电费成本
      </van-cell>
    </van-cell-group>

    <!-- 充电效率设置 -->
    <van-cell-group inset title="充电效率设置">
      <van-field
        v-model="chargingEfficiency"
        type="number"
        label="充电效率"
        placeholder="输入充电效率"
        @blur="saveSettings"
      >
        <template #button>%</template>
      </van-field>
      <van-cell title-class="hint-text">
        充电时的能量转换效率，默认88%（12%损耗）
      </van-cell>
      <van-cell title-class="hint-text">
        💡 充电时约有12%能量损耗，实际入电量 = 充电量 × 效率
      </van-cell>
    </van-cell-group>

    <!-- 能耗阈值 -->
    <van-cell-group inset title="能耗阈值配置">
      <van-field
        v-model="excellentThreshold"
        type="number"
        label="优秀阈值"
        placeholder="输入优秀阈值"
        @blur="saveSettings"
      >
        <template #button>Wh/km</template>
      </van-field>
      <van-cell title-class="hint-text">
        低于此值显示为优秀（绿色）
      </van-cell>

      <van-field
        v-model="warningThreshold"
        type="number"
        label="警告阈值"
        placeholder="输入警告阈值"
        @blur="saveSettings"
      >
        <template #button>Wh/km</template>
      </van-field>
      <van-cell title-class="hint-text">
        高于此值显示为警告（红色）
      </van-cell>
    </van-cell-group>

    <!-- 自定义标签 -->
    <van-cell-group inset title="自定义路况标签">
      <van-cell v-if="store.settings.customTags.length > 0">
        <div class="custom-tags">
          <van-tag
            v-for="tag in store.settings.customTags"
            :key="tag"
            type="primary"
            closeable
            @close="removeTag(tag)"
            class="custom-tag"
          >
            {{ tag }}
          </van-tag>
        </div>
      </van-cell>
      <van-cell v-else title="暂无自定义标签" />

      <van-cell v-if="showTagInput">
        <van-field
          v-model="newTag"
          placeholder="输入新标签名称"
          @keyup.enter="addTag"
        >
          <template #button>
            <van-button size="small" type="primary" @click="addTag">添加</van-button>
          </template>
        </van-field>
      </van-cell>
      <van-cell v-else>
        <van-button size="small" block @click="showTagInput = true">
          + 添加自定义标签
        </van-button>
      </van-cell>
    </van-cell-group>

    <!-- 显示设置 -->
    <van-cell-group inset title="显示设置">
      <van-cell title="深色模式" center>
        <template #right-icon>
          <van-switch :model-value="darkMode" @update:model-value="toggleDarkMode" size="24" />
        </template>
      </van-cell>
    </van-cell-group>

    <!-- 数据管理 -->
    <van-cell-group inset title="数据管理">
      <van-cell title="导出 Excel" is-link @click="exportExcel" />
      <van-cell title="导出 JSON 备份" is-link @click="exportJSON" />
      <van-cell title="导入 JSON 备份" is-link>
        <template #value>
          <input
            type="file"
            accept=".json"
            @change="importJSON"
            class="file-input"
          />
        </template>
      </van-cell>
      <van-cell
        title="清空所有记录"
        is-link
        @click="clearAllData"
        title-class="danger-text"
      />
    </van-cell-group>

    <!-- 关于 -->
    <van-cell-group inset title="关于">
      <van-cell title="版本信息" is-link @click="showAbout" value="1.0.0" />
      <van-cell title="记录数量" :value="`${store.records.length} 条`" />
    </van-cell-group>
  </div>
</template>

<style scoped>
.settings-page {
  padding-bottom: 20px;
}

.voltage-presets {
  display: flex;
  gap: 4px;
}

.custom-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.custom-tag {
  margin: 2px 0;
}

.file-input {
  width: 100%;
  opacity: 0;
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  cursor: pointer;
}

.danger-text {
  color: #ee0a24;
}

.hint-text {
  font-size: 12px;
  color: #969799;
  padding-left: 16px;
}
</style>
