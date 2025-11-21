import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useAppStore = defineStore('app', () => {
  // 设置数据
  const settings = ref({
    voltage: 64,
    capacity: 45,
    excellentThreshold: 25,
    warningThreshold: 32,
    customTags: [],
    darkMode: false,
    electricityPrice: 0.6 // 电价（元/kWh），默认 0.6 元
  })

  // 骑行记录
  const records = ref([])

  // 上次录入的母线/相线值（用于自动填充）
  const lastInput = ref({
    busbarCurrent: 45,
    phaseCurrent: 120
  })

  // 录入模板
  const templates = ref([])

  // 计算电池总能量 (Wh)
  const totalEnergy = computed(() => {
    return settings.value.voltage * settings.value.capacity
  })

  // 预设路况标签
  const defaultTags = [
    '单人通勤',
    '双人重载',
    '极速满把',
    '佛系省电',
    '爬坡测试'
  ]

  // 所有可用标签
  const allTags = computed(() => {
    return [...defaultTags, ...settings.value.customTags]
  })

  // 从 localStorage 加载数据
  function loadData() {
    const savedSettings = localStorage.getItem('ev-tuner-settings')
    const savedRecords = localStorage.getItem('ev-tuner-records')
    const savedLastInput = localStorage.getItem('ev-tuner-last-input')
    const savedTemplates = localStorage.getItem('ev-tuner-templates')

    if (savedSettings) {
      settings.value = { ...settings.value, ...JSON.parse(savedSettings) }
    }
    if (savedRecords) {
      records.value = JSON.parse(savedRecords)
    }
    if (savedLastInput) {
      lastInput.value = JSON.parse(savedLastInput)
    }
    if (savedTemplates) {
      templates.value = JSON.parse(savedTemplates)
    }
  }

  // 保存设置到 localStorage
  function saveSettings() {
    localStorage.setItem('ev-tuner-settings', JSON.stringify(settings.value))
  }

  // 保存记录到 localStorage
  function saveRecords() {
    localStorage.setItem('ev-tuner-records', JSON.stringify(records.value))
  }

  // 保存上次输入
  function saveLastInput() {
    localStorage.setItem('ev-tuner-last-input', JSON.stringify(lastInput.value))
  }

  // 添加记录
  function addRecord(record) {
    const id = Date.now().toString()
    records.value.unshift({ ...record, id })
    saveRecords()

    // 更新上次输入
    lastInput.value.busbarCurrent = record.busbarCurrent
    lastInput.value.phaseCurrent = record.phaseCurrent
    saveLastInput()
  }

  // 更新记录
  function updateRecord(id, record) {
    const index = records.value.findIndex(r => r.id === id)
    if (index !== -1) {
      records.value[index] = { ...record, id }
      saveRecords()
    }
  }

  // 删除记录
  function deleteRecord(id) {
    records.value = records.value.filter(r => r.id !== id)
    saveRecords()
  }

  // 更新设置
  function updateSettings(newSettings) {
    settings.value = { ...settings.value, ...newSettings }
    saveSettings()
  }

  // 添加自定义标签
  function addCustomTag(tag) {
    if (!settings.value.customTags.includes(tag) && !defaultTags.includes(tag)) {
      settings.value.customTags.push(tag)
      saveSettings()
    }
  }

  // 删除自定义标签
  function removeCustomTag(tag) {
    settings.value.customTags = settings.value.customTags.filter(t => t !== tag)
    saveSettings()
  }

  // 导出数据为 JSON
  function exportJSON() {
    return JSON.stringify({
      settings: settings.value,
      records: records.value,
      exportTime: new Date().toISOString()
    }, null, 2)
  }

  // 导入 JSON 数据
  function importJSON(jsonString) {
    try {
      const data = JSON.parse(jsonString)
      if (data.settings) {
        settings.value = { ...settings.value, ...data.settings }
        saveSettings()
      }
      if (data.records) {
        records.value = data.records
        saveRecords()
      }
      return true
    } catch (e) {
      return false
    }
  }

  // 清空所有记录
  function clearRecords() {
    records.value = []
    saveRecords()
  }

  // 保存模板
  function saveTemplate(template) {
    const id = Date.now().toString()
    templates.value.push({ ...template, id })
    localStorage.setItem('ev-tuner-templates', JSON.stringify(templates.value))
  }

  // 删除模板
  function deleteTemplate(id) {
    templates.value = templates.value.filter(t => t.id !== id)
    localStorage.setItem('ev-tuner-templates', JSON.stringify(templates.value))
  }

  return {
    settings,
    records,
    lastInput,
    templates,
    totalEnergy,
    defaultTags,
    allTags,
    loadData,
    saveSettings,
    saveRecords,
    addRecord,
    updateRecord,
    deleteRecord,
    updateSettings,
    addCustomTag,
    removeCustomTag,
    exportJSON,
    importJSON,
    clearRecords,
    saveTemplate,
    deleteTemplate
  }
})
