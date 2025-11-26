<script setup>
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAppStore } from '../stores'
import { showToast } from 'vant'

const router = useRouter()
const route = useRoute()
const store = useAppStore()

const isEdit = computed(() => !!route.query.id)

const formData = ref({
  datetime: new Date().toISOString(),
  socBefore: '',
  socAfter: '',
  location: '',
  note: ''
})

// 预设充电地点
const locationPresets = ['家里', '快充站', '公司', '商场']

// 实时计算预览
const preview = computed(() => {
  const socBefore = parseFloat(formData.value.socBefore) || 0
  const socAfter = parseFloat(formData.value.socAfter) || 0

  if (socBefore < 0 || socAfter <= socBefore || socAfter > 100) {
    return null
  }

  const socCharged = socAfter - socBefore
  const batteryEnergy = (socCharged / 100) * (store.totalEnergy / 1000) // 电池实际存入的电量（kWh）
  const gridEnergy = batteryEnergy / (store.settings.chargingEfficiency || 0.88) // 从电网消耗的电量（kWh）
  const cost = gridEnergy * store.settings.electricityPrice // 充电费用

  return {
    socCharged: Math.round(socCharged * 10) / 10,
    batteryEnergy: Math.round(batteryEnergy * 100) / 100, // 实际入电量
    gridEnergy: Math.round(gridEnergy * 100) / 100, // 充电度数
    cost: Math.round(cost * 100) / 100
  }
})

// 日期选择器
const showDatePicker = ref(false)
const showTimePicker = ref(false)

const currentDate = computed(() => {
  const d = new Date(formData.value.datetime)
  return [d.getFullYear(), d.getMonth() + 1, d.getDate()]
})

const currentTime = computed(() => {
  const d = new Date(formData.value.datetime)
  return [d.getHours(), d.getMinutes()]
})

const displayDateTime = computed(() => {
  const d = new Date(formData.value.datetime)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hour = String(d.getHours()).padStart(2, '0')
  const minute = String(d.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hour}:${minute}`
})

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

// 验证表单
function validateForm() {
  const socBefore = parseFloat(formData.value.socBefore)
  const socAfter = parseFloat(formData.value.socAfter)

  if (formData.value.socBefore === '' || isNaN(socBefore) || socBefore < 0 || socBefore >= 100) {
    showToast('请输入有效的充电前电量 (0-99%)')
    return false
  }
  if (formData.value.socAfter === '' || isNaN(socAfter) || socAfter <= socBefore || socAfter > 100) {
    showToast('充电后电量必须大于充电前且不超过100%')
    return false
  }
  return true
}

// 保存
function handleSave() {
  if (!validateForm()) return

  const data = {
    ...formData.value,
    socBefore: parseFloat(formData.value.socBefore),
    socAfter: parseFloat(formData.value.socAfter)
  }

  if (isEdit.value) {
    store.updateChargingRecord(route.query.id, data)
    showToast('已更新')
  } else {
    store.addChargingRecord(data)
    showToast('已保存')
  }

  router.push('/charging')
}

// 返回
function handleBack() {
  router.back()
}

// 加载编辑数据
if (isEdit.value) {
  const record = store.chargingRecords.find(r => r.id === route.query.id)
  if (record) {
    formData.value = { ...record }
  }
}
</script>

<template>
  <div class="charging-entry-page">
    <van-nav-bar
      :title="isEdit ? '编辑充电记录' : '记录充电'"
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

      <!-- 充电数据 -->
      <van-cell-group inset title="充电数据">
        <van-field
          v-model="formData.socBefore"
          type="number"
          label="充电前电量"
          placeholder="请输入充电前电量"
          :rules="[{ required: true, message: '请输入充电前电量' }]"
        >
          <template #button>%</template>
        </van-field>
        <van-field
          v-model="formData.socAfter"
          type="number"
          label="充电后电量"
          placeholder="请输入充电后电量"
          :rules="[{ required: true, message: '请输入充电后电量' }]"
        >
          <template #button>%</template>
        </van-field>
      </van-cell-group>

      <!-- 实时预览 -->
      <transition name="fade-scale">
        <div v-if="preview" class="preview-card">
          <div class="preview-header">⚡ 充电预览</div>
          <div class="preview-grid">
            <div class="preview-item">
              <div class="preview-label">充电量</div>
              <div class="preview-value">{{ preview.socCharged }}%</div>
            </div>
            <div class="preview-item">
              <div class="preview-label">实际入电量</div>
              <div class="preview-value">{{ preview.batteryEnergy }} kWh</div>
            </div>
            <div class="preview-item">
              <div class="preview-label">充电度数</div>
              <div class="preview-value">{{ preview.gridEnergy }} kWh</div>
            </div>
            <div class="preview-item">
              <div class="preview-label">充电费用</div>
              <div class="preview-value cost">¥{{ preview.cost }}</div>
            </div>
          </div>
          <div class="preview-hint">💡 充电度数含{{ Math.round((1 - (store.settings.chargingEfficiency || 0.88)) * 100) }}%损耗</div>
        </div>
      </transition>

      <!-- 充电地点 -->
      <van-cell-group inset title="充电地点（选填）">
        <van-cell title="常用地点">
          <template #value>
            <div class="location-btns">
              <van-button
                v-for="loc in locationPresets"
                :key="loc"
                size="mini"
                :type="formData.location === loc ? 'primary' : 'default'"
                @click="formData.location = loc"
              >
                {{ loc }}
              </van-button>
            </div>
          </template>
        </van-cell>
        <van-field
          v-model="formData.location"
          placeholder="或输入其他地点"
        />
      </van-cell-group>

      <!-- 备注 -->
      <van-cell-group inset title="备注（选填）">
        <van-field
          v-model="formData.note"
          type="textarea"
          placeholder="记录特殊情况"
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
  </div>
</template>

<style scoped>
.charging-entry-page {
  padding-bottom: 20px;
}

.datetime-btns {
  display: flex;
  gap: 8px;
}

.location-btns {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: flex-end;
}

.submit-btn {
  padding: 16px;
}

/* 实时预览卡片 */
.preview-card {
  margin: 16px;
  padding: 16px;
  border-radius: 12px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
}

.preview-header {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 12px;
  opacity: 0.9;
}

.preview-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 12px;
}

.preview-item {
  text-align: center;
}

.preview-label {
  font-size: 12px;
  opacity: 0.8;
  margin-bottom: 4px;
}

.preview-value {
  font-size: 18px;
  font-weight: bold;
}

.preview-value.cost {
  color: #ffd700;
}

.preview-hint {
  font-size: 11px;
  opacity: 0.75;
  text-align: center;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
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
