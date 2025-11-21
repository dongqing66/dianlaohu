<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAppStore } from '../stores'
import {
  calculateConsumedEnergy,
  calculateEnergyConsumption,
  calculateRange,
  getConsumptionLevel
} from '../utils/calculator'
import { showToast, showDialog } from 'vant'

const router = useRouter()
const route = useRoute()
const store = useAppStore()

// 是否编辑模式
const isEdit = computed(() => !!route.query.id)

// 表单数据
const formData = ref({
  datetime: new Date().toISOString(),
  busbarCurrent: 45,
  phaseCurrent: 120,
  distance: '',
  socConsumed: '',
  tags: [],
  motorTemp: '',
  controllerTemp: '',
  note: ''
})

// 实时计算预览
const preview = computed(() => {
  const distance = parseFloat(formData.value.distance) || 0
  const socConsumed = parseFloat(formData.value.socConsumed) || 0

  if (distance <= 0 || socConsumed <= 0) {
    return null
  }

  const consumedEnergy = calculateConsumedEnergy(socConsumed, store.totalEnergy)
  const energyConsumption = calculateEnergyConsumption(consumedEnergy, distance)
  const range = calculateRange(store.totalEnergy, energyConsumption)
  const level = getConsumptionLevel(energyConsumption, store.settings.excellentThreshold, store.settings.warningThreshold)

  return {
    consumedEnergy: Math.round(consumedEnergy * 10) / 10,
    energyConsumption: Math.round(energyConsumption * 10) / 10,
    range: Math.round(range),
    level
  }
})

// 预览显示颜色
const previewColor = computed(() => {
  if (!preview.value) return '#969799'
  if (preview.value.level === 'excellent') return '#07c160'
  if (preview.value.level === 'normal') return '#ff976a'
  return '#ee0a24'
})

// 预览渐变背景
const previewGradient = computed(() => {
  if (!preview.value) return 'linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%)'
  if (preview.value.level === 'excellent') return 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)'
  if (preview.value.level === 'normal') return 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
  return 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)'
})

// 常用母线值
const busbarPresets = [35, 40, 45, 50, 55, 60]
// 常用相线值
const phasePresets = [80, 100, 120, 150, 180, 200]

// 日期选择器
const showDatePicker = ref(false)
const showTimePicker = ref(false)

// 模板相关
const showSaveTemplate = ref(false)
const templateName = ref('')

// 当前日期时间
const currentDate = computed(() => {
  const d = new Date(formData.value.datetime)
  return [d.getFullYear(), d.getMonth() + 1, d.getDate()]
})

const currentTime = computed(() => {
  const d = new Date(formData.value.datetime)
  return [d.getHours(), d.getMinutes()]
})

// 格式化显示的日期时间
const displayDateTime = computed(() => {
  const d = new Date(formData.value.datetime)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hour = String(d.getHours()).padStart(2, '0')
  const minute = String(d.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hour}:${minute}`
})

onMounted(() => {
  if (isEdit.value) {
    // 编辑模式：加载现有记录
    const record = store.records.find(r => r.id === route.query.id)
    if (record) {
      formData.value = { ...record }
    }
  } else {
    // 新增模式：使用上次输入的母线/相线值
    formData.value.busbarCurrent = store.lastInput.busbarCurrent
    formData.value.phaseCurrent = store.lastInput.phaseCurrent
  }
})

// 选择母线预设值
function selectBusbar(value) {
  formData.value.busbarCurrent = value
}

// 选择相线预设值
function selectPhase(value) {
  formData.value.phaseCurrent = value
}

// 切换标签
function toggleTag(tag) {
  const index = formData.value.tags.indexOf(tag)
  if (index === -1) {
    formData.value.tags.push(tag)
  } else {
    formData.value.tags.splice(index, 1)
  }
}

// 日期确认
function onDateConfirm({ selectedValues }) {
  const d = new Date(formData.value.datetime)
  d.setFullYear(selectedValues[0])
  d.setMonth(selectedValues[1] - 1)
  d.setDate(selectedValues[2])
  formData.value.datetime = d.toISOString()
  showDatePicker.value = false
}

// 时间确认
function onTimeConfirm({ selectedValues }) {
  const d = new Date(formData.value.datetime)
  d.setHours(selectedValues[0])
  d.setMinutes(selectedValues[1])
  formData.value.datetime = d.toISOString()
  showTimePicker.value = false
}

// 表单验证
function validateForm() {
  if (!formData.value.distance || formData.value.distance <= 0) {
    showToast('请输入有效的行驶里程')
    return false
  }
  if (!formData.value.socConsumed || formData.value.socConsumed <= 0 || formData.value.socConsumed > 100) {
    showToast('请输入有效的电量消耗百分比 (1-100)')
    return false
  }
  if (!formData.value.busbarCurrent || formData.value.busbarCurrent <= 0) {
    showToast('请输入有效的母线限流')
    return false
  }
  if (!formData.value.phaseCurrent || formData.value.phaseCurrent <= 0) {
    showToast('请输入有效的相线限流')
    return false
  }
  return true
}

// 保存
function handleSave() {
  if (!validateForm()) return

  const data = {
    ...formData.value,
    distance: parseFloat(formData.value.distance),
    socConsumed: parseFloat(formData.value.socConsumed),
    busbarCurrent: parseInt(formData.value.busbarCurrent),
    phaseCurrent: parseInt(formData.value.phaseCurrent),
    motorTemp: formData.value.motorTemp ? parseFloat(formData.value.motorTemp) : null,
    controllerTemp: formData.value.controllerTemp ? parseFloat(formData.value.controllerTemp) : null
  }

  if (isEdit.value) {
    store.updateRecord(route.query.id, data)
    showToast('已更新')
    router.push('/')
  } else {
    const backupCheck = store.addRecord(data)
    showToast('已保存')

    // 检查是否需要提醒备份
    if (backupCheck && backupCheck.shouldRemind) {
      setTimeout(() => {
        showDialog({
          title: '💾 备份提醒',
          message: `你已新增 ${backupCheck.newRecordsCount} 条记录，建议备份数据以防丢失。\n\n当前共有 ${backupCheck.totalRecords} 条记录。`,
          confirmButtonText: '立即备份',
          cancelButtonText: '稍后提醒',
          showCancelButton: true,
        }).then(() => {
          // 用户选择立即备份
          router.push('/settings?action=export')
        }).catch(() => {
          // 用户选择稍后提醒
          showToast('下次新增20条记录时再次提醒')
        })
      }, 500) // 延迟500ms，让保存提示先显示
    } else {
      router.push('/')
    }
  }
}

// 返回
function handleBack() {
  router.back()
}

// 应用模板
function applyTemplate(template) {
  formData.value.busbarCurrent = template.busbarCurrent
  formData.value.phaseCurrent = template.phaseCurrent
  showToast(`已应用模板：${template.name}`)
}

// 保存模板
function handleSaveTemplate() {
  const name = templateName.value.trim()
  if (!name) {
    showToast('请输入模板名称')
    return
  }

  store.saveTemplate({
    name,
    busbarCurrent: parseInt(formData.value.busbarCurrent),
    phaseCurrent: parseInt(formData.value.phaseCurrent)
  })

  templateName.value = ''
  showToast(`模板"${name}"已保存`)
}
</script>

<template>
  <div class="entry-page">
    <van-nav-bar
      :title="isEdit ? '编辑记录' : '录入数据'"
      left-arrow
      @click-left="handleBack"
      fixed
      placeholder
    />

    <van-form @submit="handleSave">
      <!-- 日期时间 -->
      <van-cell-group inset title="日期时间">
        <van-cell
          :value="displayDateTime"
          is-link
          @click="showDatePicker = true"
        >
          <template #title>
            <div class="datetime-btns">
              <van-button size="small" @click.stop="showDatePicker = true">日期</van-button>
              <van-button size="small" @click.stop="showTimePicker = true">时间</van-button>
            </div>
          </template>
        </van-cell>
      </van-cell-group>

      <!-- 快速模板 -->
      <van-cell-group inset title="快速模板" v-if="store.templates.length > 0 || !isEdit">
        <van-cell v-if="store.templates.length > 0" title="选择模板">
          <template #value>
            <div class="template-btns">
              <van-button
                v-for="template in store.templates"
                :key="template.id"
                size="mini"
                type="success"
                @click="applyTemplate(template)"
              >
                {{ template.name }}
              </van-button>
            </div>
          </template>
        </van-cell>
        <van-cell v-if="!isEdit && formData.busbarCurrent && formData.phaseCurrent">
          <van-button size="small" block type="primary" plain @click="showSaveTemplate = true">
            💾 保存当前配置为模板
          </van-button>
        </van-cell>
      </van-cell-group>

      <!-- 母线相线设置 -->
      <van-cell-group inset title="电流设置">
        <van-cell title="母线限流 (A)">
          <template #value>
            <div class="preset-btns">
              <van-button
                v-for="val in busbarPresets"
                :key="val"
                size="mini"
                :type="formData.busbarCurrent === val ? 'primary' : 'default'"
                @click="selectBusbar(val)"
              >
                {{ val }}
              </van-button>
            </div>
          </template>
        </van-cell>
        <van-field
          v-model="formData.busbarCurrent"
          type="number"
          placeholder="自定义母线限流"
        />

        <van-cell title="相线限流 (A)">
          <template #value>
            <div class="preset-btns">
              <van-button
                v-for="val in phasePresets"
                :key="val"
                size="mini"
                :type="formData.phaseCurrent === val ? 'primary' : 'default'"
                @click="selectPhase(val)"
              >
                {{ val }}
              </van-button>
            </div>
          </template>
        </van-cell>
        <van-field
          v-model="formData.phaseCurrent"
          type="number"
          placeholder="自定义相线限流"
        />
      </van-cell-group>

      <!-- 骑行数据 -->
      <van-cell-group inset title="骑行数据">
        <van-field
          v-model="formData.distance"
          type="number"
          label="行驶里程"
          placeholder="请输入里程"
          :rules="[{ required: true, message: '请输入里程' }]"
        >
          <template #button>km</template>
        </van-field>
        <van-field
          v-model="formData.socConsumed"
          type="number"
          label="电量消耗"
          placeholder="请输入消耗的电量百分比"
          :rules="[{ required: true, message: '请输入电量消耗' }]"
        >
          <template #button>%</template>
        </van-field>
      </van-cell-group>

      <!-- 实时预览 -->
      <transition name="fade-scale">
        <div v-if="preview" class="preview-card">
          <div class="preview-bg" :style="{ background: previewGradient }"></div>
          <div class="preview-content">
            <div class="preview-title">实时预览</div>
            <div class="preview-main">
              <div class="preview-consumption" :style="{ color: previewColor }">
                <div class="preview-value">{{ preview.energyConsumption }}</div>
                <div class="preview-unit">Wh/km</div>
              </div>
              <div class="preview-divider"></div>
              <div class="preview-details">
                <div class="detail-item">
                  <span class="detail-label">消耗能量</span>
                  <span class="detail-value">{{ preview.consumedEnergy }} Wh</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">理论续航</span>
                  <span class="detail-value">{{ preview.range }} km</span>
                </div>
              </div>
            </div>
            <div class="preview-status">
              <van-tag :type="preview.level === 'excellent' ? 'success' : preview.level === 'normal' ? 'warning' : 'danger'" size="medium">
                {{ preview.level === 'excellent' ? '优秀' : preview.level === 'normal' ? '正常' : '偏高' }}
              </van-tag>
            </div>
          </div>
        </div>
      </transition>

      <!-- 路况标签 -->
      <van-cell-group inset title="路况标签">
        <van-cell>
          <div class="tag-selector">
            <van-tag
              v-for="tag in store.allTags"
              :key="tag"
              :type="formData.tags.includes(tag) ? 'primary' : 'default'"
              size="medium"
              @click="toggleTag(tag)"
              class="tag-item"
            >
              {{ tag }}
            </van-tag>
          </div>
        </van-cell>
      </van-cell-group>

      <!-- 温度监测 -->
      <van-cell-group inset title="温度监测（选填）">
        <van-field
          v-model="formData.motorTemp"
          type="number"
          label="电机温度"
          placeholder="选填"
        >
          <template #button>°C</template>
        </van-field>
        <van-field
          v-model="formData.controllerTemp"
          type="number"
          label="控制器温度"
          placeholder="选填"
        >
          <template #button>°C</template>
        </van-field>
      </van-cell-group>

      <!-- 备注 -->
      <van-cell-group inset title="备注">
        <van-field
          v-model="formData.note"
          type="textarea"
          placeholder="选填，记录特殊情况"
          rows="2"
          autosize
        />
      </van-cell-group>

      <!-- 保存按钮 -->
      <div class="submit-btn">
        <van-button type="primary" block native-type="submit">
          {{ isEdit ? '更新记录' : '保存记录' }}
        </van-button>
      </div>
    </van-form>

    <!-- 日期选择器 -->
    <van-popup v-model:show="showDatePicker" position="bottom">
      <van-date-picker
        :model-value="currentDate"
        title="选择日期"
        @confirm="onDateConfirm"
        @cancel="showDatePicker = false"
      />
    </van-popup>

    <!-- 时间选择器 -->
    <van-popup v-model:show="showTimePicker" position="bottom">
      <van-time-picker
        :model-value="currentTime"
        title="选择时间"
        @confirm="onTimeConfirm"
        @cancel="showTimePicker = false"
      />
    </van-popup>

    <!-- 保存模板对话框 -->
    <van-dialog
      v-model:show="showSaveTemplate"
      title="保存为模板"
      show-cancel-button
      @confirm="handleSaveTemplate"
    >
      <van-field
        v-model="templateName"
        label="模板名称"
        placeholder="例如：通勤模式"
        style="margin: 16px 0"
      />
    </van-dialog>
  </div>
</template>

<style scoped>
.entry-page {
  padding-bottom: 20px;
}

.datetime-btns {
  display: flex;
  gap: 8px;
}

.preset-btns {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  justify-content: flex-end;
}

.template-btns {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: flex-end;
}

.tag-selector {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag-item {
  cursor: pointer;
}

.submit-btn {
  padding: 16px;
}

/* 实时预览卡片 */
.preview-card {
  margin: 16px;
  border-radius: 16px;
  overflow: hidden;
  position: relative;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.preview-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  opacity: 0.15;
}

.preview-content {
  position: relative;
  z-index: 1;
  padding: 16px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.dark-mode .preview-content {
  background: rgba(30, 30, 30, 0.95);
}

.preview-title {
  font-size: 12px;
  color: #969799;
  margin-bottom: 12px;
  font-weight: 500;
  letter-spacing: 0.5px;
}

.preview-main {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 12px;
}

.preview-consumption {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.preview-value {
  font-size: 48px;
  font-weight: bold;
  line-height: 1;
  animation: numberPop 0.3s ease;
}

@keyframes numberPop {
  0% {
    transform: scale(1.2);
  }
  100% {
    transform: scale(1);
  }
}

.preview-unit {
  font-size: 12px;
  font-weight: 500;
  margin-top: 4px;
  opacity: 0.7;
}

.preview-divider {
  width: 1px;
  height: 60px;
  background: linear-gradient(to bottom, transparent, #e0e0e0, transparent);
}

.dark-mode .preview-divider {
  background: linear-gradient(to bottom, transparent, #4a4a4a, transparent);
}

.preview-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
}

.detail-label {
  color: #969799;
}

.detail-value {
  font-weight: 600;
  color: #323233;
}

.dark-mode .detail-value {
  color: #fff;
}

.preview-status {
  display: flex;
  justify-content: center;
}

/* 渐变缩放动画 */
.fade-scale-enter-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.fade-scale-leave-active {
  transition: all 0.2s ease;
}

.fade-scale-enter-from {
  opacity: 0;
  transform: scale(0.95) translateY(-10px);
}

.fade-scale-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>
