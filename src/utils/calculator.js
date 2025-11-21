/**
 * 计算消耗能量 (Wh)
 * @param {number} socPercent - 消耗的 SOC 百分比
 * @param {number} totalEnergy - 电池总能量 (Wh)
 * @returns {number} 消耗能量 (Wh)
 */
export function calculateConsumedEnergy(socPercent, totalEnergy) {
  return (socPercent / 100) * totalEnergy
}

/**
 * 计算平均能耗 (Wh/km)
 * @param {number} consumedEnergy - 消耗能量 (Wh)
 * @param {number} distance - 行驶里程 (km)
 * @returns {number} 平均能耗 (Wh/km)
 */
export function calculateEnergyConsumption(consumedEnergy, distance) {
  if (distance <= 0) return 0
  return consumedEnergy / distance
}

/**
 * 计算理论满电续航 (km)
 * @param {number} totalEnergy - 电池总能量 (Wh)
 * @param {number} energyConsumption - 平均能耗 (Wh/km)
 * @returns {number} 理论续航 (km)
 */
export function calculateRange(totalEnergy, energyConsumption) {
  if (energyConsumption <= 0) return 0
  return totalEnergy / energyConsumption
}

/**
 * 根据能耗值获取颜色等级
 * @param {number} consumption - 能耗值 (Wh/km)
 * @param {number} excellentThreshold - 优秀阈值
 * @param {number} warningThreshold - 警告阈值
 * @returns {string} 颜色类型 'excellent' | 'normal' | 'warning'
 */
export function getConsumptionLevel(consumption, excellentThreshold = 25, warningThreshold = 32) {
  if (consumption < excellentThreshold) return 'excellent'
  if (consumption <= warningThreshold) return 'normal'
  return 'warning'
}

/**
 * 格式化日期时间
 * @param {string|Date} date - 日期
 * @returns {string} 格式化后的日期字符串
 */
export function formatDateTime(date) {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hour = String(d.getHours()).padStart(2, '0')
  const minute = String(d.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hour}:${minute}`
}

/**
 * 格式化日期（短格式）
 * @param {string|Date} date - 日期
 * @returns {string} 格式化后的日期字符串
 */
export function formatDate(date) {
  const d = new Date(date)
  const month = d.getMonth() + 1
  const day = d.getDate()
  return `${month}月${day}日`
}

/**
 * 计算电费 (元)
 * @param {number} consumedEnergy - 消耗能量 (Wh)
 * @param {number} electricityPrice - 电价 (元/kWh)
 * @returns {number} 电费 (元)
 */
export function calculateElectricityCost(consumedEnergy, electricityPrice) {
  // 将 Wh 转换为 kWh，然后乘以电价
  return (consumedEnergy / 1000) * electricityPrice
}

/**
 * 计算记录的完整数据
 * @param {Object} record - 原始记录
 * @param {number} totalEnergy - 电池总能量
 * @param {number} electricityPrice - 电价 (元/kWh)，可选
 * @returns {Object} 包含计算结果的记录
 */
export function calculateRecordData(record, totalEnergy, electricityPrice = 0) {
  const consumedEnergy = calculateConsumedEnergy(record.socConsumed, totalEnergy)
  const energyConsumption = calculateEnergyConsumption(consumedEnergy, record.distance)
  const range = calculateRange(totalEnergy, energyConsumption)
  const electricityCost = calculateElectricityCost(consumedEnergy, electricityPrice)

  return {
    ...record,
    consumedEnergy: Math.round(consumedEnergy * 10) / 10,
    energyConsumption: Math.round(energyConsumption * 10) / 10,
    range: Math.round(range),
    electricityCost: Math.round(electricityCost * 100) / 100 // 保留两位小数
  }
}
