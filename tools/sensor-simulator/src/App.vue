<template>
  <div class="page">
    <div class="topbar">
      <div>
        <div class="brand-row">
          <span class="brand-mark">G</span>
          <span class="title">Sensor Simulator</span>
          <span class="dev-badge">DEVELOPMENT</span>
        </div>
        <span class="subtitle">选择用户、绑定虚拟设备并向后端推送传感器读数</span>
      </div>
      <div class="server-state">
        <span class="status-dot"></span>
        <span>开发接口</span>
        <span class="status-value">ENABLE_DEV_SENSOR_SIMULATOR=1</span>
      </div>
    </div>

    <div class="workspace">
      <div class="sidebar">
        <div class="panel user-panel">
          <div class="panel-head">
            <div>
              <span class="step-label">STEP 01</span>
              <span class="panel-title">选择用户</span>
            </div>
            <div class="icon-button" :class="{ disabled: loadingUsers }" @click="loadUsers">
              {{ loadingUsers ? "…" : "↻" }}
            </div>
          </div>
          <div class="user-list">
            <div
              v-for="(user, index) in users"
              :key="user.id"
              class="user-item"
              :class="{ active: selectedUserIndex === index }"
              @click="selectUser(index)"
            >
              <div class="avatar">{{ String(user.displayName || user.openid || user.id).slice(0, 1).toUpperCase() }}</div>
              <div class="item-main">
                <span class="item-title">{{ shortUserName(user) }}</span>
                <span class="item-meta">{{ user._count?.plants || 0 }} 株植物 · {{ user._count?.devices || 0 }} 台设备</span>
              </div>
              <span class="selected-check">{{ selectedUserIndex === index ? "✓" : "" }}</span>
            </div>
            <div v-if="!loadingUsers && !users.length" class="empty-state">暂无可选用户</div>
          </div>
          <div
            class="danger-button"
            :class="{ disabled: deletingUser || sending || !selectedUser }"
            @click="confirmDeleteUser"
          >
            {{ deletingUser ? "正在删除…" : "删除用户及全部关联数据" }}
          </div>
        </div>

        <div class="panel plant-panel">
          <div class="panel-head">
            <div>
              <span class="step-label">STEP 02</span>
              <span class="panel-title">植物</span>
            </div>
            <div class="panel-actions">
              <span class="subtle-badge">{{ availablePlants.length }} 株</span>
              <div class="icon-button" :class="{ disabled: !selectedUser }" @click="openPlantModal">＋</div>
            </div>
          </div>
          <div class="plant-list">
            <div
              v-for="(plant, index) in availablePlants"
              :key="plant.id"
              class="plant-item"
              :class="{ active: editingPlantId === plant.id }"
              @click="selectPlant(index)"
            >
              <div class="plant-icon">♧</div>
              <div class="item-main">
                <span class="item-title">{{ plant.nickname || "未命名植物" }}</span>
                <span class="item-meta">{{ plant.speciesLabel || "未知品种" }}</span>
              </div>
              <span class="selected-check">{{ editingPlantId === plant.id ? "✓" : "" }}</span>
              <div class="item-edit" @click.stop="openPlantEdit(index)">修改</div>
              <div class="item-delete" @click.stop="confirmDeletePlant(plant.id)">删除</div>
            </div>
            <div v-if="selectedUser && !loadingContext && !availablePlants.length" class="empty-state">
              当前用户暂无植物，请在下方添加
            </div>
          </div>
        </div>

        <div class="panel device-panel">
          <div class="panel-head">
            <div>
              <span class="step-label">STEP 03</span>
              <span class="panel-title">传感器</span>
            </div>
            <div class="panel-actions">
              <span class="subtle-badge">{{ devices.length }} 台</span>
              <div class="icon-button" :class="{ disabled: !selectedUser }" @click="openDeviceModal">＋</div>
            </div>
          </div>
          <div class="device-list">
            <div
              v-for="(device, index) in devices"
              :key="device.id"
              class="device-item"
              :class="{ active: selectedDeviceIndex === index }"
              @click="selectDevice(index)"
            >
              <div class="device-icon">◉</div>
              <div class="item-main">
                <span class="item-title">{{ device.label || device.hardwareId }}</span>
                <span class="item-meta mono">{{ device.hardwareId }}</span>
              </div>
              <span class="device-badge" :class="{ online: device.lastSeenAt }">
                {{ device.lastSeenAt ? "有数据" : "未上报" }}
              </span>
              <div class="item-edit" @click.stop="openDeviceEdit(index)">修改</div>
              <div class="item-delete" @click.stop="confirmDeleteDevice(device.id)">删除</div>
            </div>
            <div v-if="selectedUser && !loadingContext && !devices.length" class="empty-state">
              当前用户暂无设备，请在下方创建
            </div>
          </div>
        </div>
      </div>

      <div class="main-content">
        <div v-if="!canConfigure" class="configuration-lock">
          {{ configurationMessage }}
        </div>
        <div class="panel scenario-panel" :class="{ disabled: !canConfigure }">
          <div class="panel-head main-head">
            <div>
              <span class="step-label">STEP 04</span>
              <span class="panel-title large">配置模拟数据</span>
            </div>
            <div class="target-summary">
              <span class="summary-label">当前目标</span>
              <span class="summary-value">{{ selectedDeviceLabel }}</span>
            </div>
          </div>
          <div class="preset-grid">
            <div
              v-for="(preset, index) in presets"
              :key="preset.key"
              class="preset-card"
              :class="{ active: selectedPresetIndex === index }"
              @click="applyPreset(index)"
            >
              <span class="preset-name">{{ preset.shortLabel }}</span>
              <span class="preset-desc">{{ preset.label }}</span>
            </div>
          </div>
        </div>

        <div class="panel metrics-panel" :class="{ disabled: !canConfigure }">
          <div class="panel-head">
            <div>
              <span class="panel-title">指标组合</span>
              <span class="panel-description">启用需要上报的指标并设定基础值</span>
            </div>
          </div>
          <div class="metrics-grid">
            <div
              v-for="metric in metrics"
              :key="metric.key"
              class="metric-card"
              :class="{ inactive: !enabled[metric.key] }"
            >
              <div class="metric-card-head">
                <div>
                  <span class="metric-name">{{ metric.label }}</span>
                  <span class="metric-range">有效范围 {{ metric.range }}</span>
                </div>
                <input
                  class="metric-switch"
                  type="checkbox"
                  :disabled="!canConfigure"
                  :checked="enabled[metric.key]"
                  @change="onMetricToggle(metric.key, { detail: { value: $event.target.checked } })"
                />
              </div>
              <div class="metric-value-row">
                <input
                  class="metric-input"
                  type="number"
                  :disabled="!canConfigure || !enabled[metric.key]"
                  :value="values[metric.key]"
                  @input="onMetricInput(metric.key, $event)"
                />
                <span class="metric-unit">{{ metric.unit || "pH" }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="bottom-grid">
          <div class="panel batch-panel" :class="{ disabled: !canConfigure }">
            <div class="panel-head">
              <div>
                <span class="panel-title">批量参数</span>
                <span class="panel-description">按间隔逐条模拟实时推送</span>
              </div>
            </div>
            <div class="batch-fields">
              <div class="form-group">
                <span class="form-label">读数数量</span>
                <div class="input-suffix">
                  <input
                    class="web-input"
                    type="number"
                    :disabled="!canConfigure"
                    :value="batchCount"
                    @input="onBatchInput"
                  />
                  <span>条</span>
                </div>
                <span class="field-tip">每次请求发送 1 条，最多 200 条</span>
              </div>
              <div class="form-group">
                <span class="form-label">时间间隔</span>
                <div class="input-suffix">
                  <input
                    class="web-input"
                    type="number"
                    :disabled="!canConfigure"
                    :value="intervalSeconds"
                    @input="onIntervalInput"
                  />
                  <span>秒</span>
                </div>
                <span class="field-tip">两次实时推送之间的等待时间</span>
              </div>
              <div class="form-group jitter-field">
                <span class="form-label">随机波动</span>
                <div class="toggle-row">
                  <input
                    type="checkbox"
                    :disabled="!canConfigure"
                    :checked="jitter"
                    @change="jitter = $event.target.checked"
                  />
                  <span>{{ jitter ? "已启用" : "已关闭" }}</span>
                </div>
                <span class="field-tip">模拟真实传感器抖动</span>
              </div>
            </div>
          </div>

          <div class="panel preview-panel" :class="{ disabled: !canConfigure }">
            <div class="panel-head">
              <div>
                <span class="panel-title">请求预览</span>
                <span class="panel-description">后端任务持续运行，页面仅同步进度</span>
              </div>
              <span class="count-badge">{{ normalizedBatchCount }} SENDS</span>
            </div>
            <span class="preview-json">{{ previewText }}</span>
          </div>
        </div>

        <div class="action-bar">
          <div v-if="lastResult" class="last-result">
            <span class="success-icon">✓</span>
            <div>
              <span class="result-title">最近发送成功</span>
              <span class="result-detail">写入 {{ lastResult.inserted }} 条 · 去重 {{ lastResult.deduped }} 条 · {{ lastResult.sentAt }}</span>
            </div>
          </div>
          <div v-else class="action-hint">
            {{ canConfigure ? "所有模拟数据都会写入当前开发数据库" : configurationMessage }}
          </div>
          <div
            class="send-button"
            :class="{ disabled: !sending && !canSend, sending }"
            @click="sending ? stopScheduledSend() : send()"
          >
            <span>{{ sending ? `停止发送 ${sentCount}/${sendTotal}` : "开始定时发送" }}</span>
            <span class="send-arrow">{{ sending ? "■" : "→" }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showPlantModal" class="modal-mask" @click.self="closePlantModal">
      <div class="modal-card">
        <div class="modal-head">
          <div>
            <span class="panel-title large">{{ editingPlantId ? "修改植物" : "添加植物" }}</span>
            <span class="panel-description">
              {{ editingPlantId ? "修改植物信息并管理传感器绑定" : "创建后可绑定模拟传感器" }}
            </span>
          </div>
          <div class="modal-close" @click="closePlantModal">×</div>
        </div>
        <div class="form-group">
          <span class="form-label">植物昵称</span>
          <input v-model="simulatedPlantNickname" class="web-input" maxlength="60" placeholder="模拟绿萝" />
        </div>
        <div class="form-group">
          <span class="form-label">植物品种</span>
          <input v-model="simulatedSpeciesLabel" class="web-input" maxlength="120" placeholder="绿萝" />
        </div>
        <span class="field-tip plant-tip">默认使用室内、中等光照和中等需水配置</span>
        <div class="form-group">
          <span class="form-label">绑定传感器（可选）</span>
          <select
            class="web-select"
            :value="selectedPlantSensorIndex"
            @change="onPlantSensorChange({ detail: { value: $event.target.value } })"
          >
            <option v-for="(label, index) in plantSensorLabels" :key="index" :value="index">{{ label }}</option>
          </select>
        </div>
        <div class="modal-actions">
          <div class="modal-cancel" @click="closePlantModal">取消</div>
          <div
            class="primary-button"
            :class="{ disabled: creatingPlant || !canCreatePlant }"
            @click="saveSimulatedPlant"
          >
            {{ creatingPlant ? "正在保存…" : editingPlantId ? "保存修改" : "添加植物" }}
          </div>
        </div>
      </div>
    </div>

    <div v-if="showDeviceModal" class="modal-mask" @click.self="closeDeviceModal">
      <div class="modal-card">
        <div class="modal-head">
          <div>
            <span class="panel-title large">{{ editingDeviceId ? "修改传感器" : "添加传感器" }}</span>
            <span class="panel-description">
              {{ editingDeviceId ? "修改传感器信息并管理植物绑定" : "创建模拟硬件并添加到当前用户" }}
            </span>
          </div>
          <div class="modal-close" @click="closeDeviceModal">×</div>
        </div>
        <div class="form-group">
          <span class="form-label">硬件 ID</span>
          <div class="input-with-action">
            <input
              v-model="simulatedHardwareId"
              class="web-input mono"
              maxlength="128"
              :disabled="Boolean(editingDeviceId)"
            />
            <div v-if="!editingDeviceId" class="inline-action" @click="regenerateHardwareId">重新生成</div>
          </div>
        </div>
        <div class="form-group">
          <span class="form-label">设备名称</span>
          <input v-model="simulatedLabel" class="web-input" maxlength="60" placeholder="开发模拟设备" />
        </div>
        <div class="form-group">
          <span class="form-label">绑定植物（可选）</span>
          <select
            class="web-select"
            :value="selectedPlantIndex"
            @change="onPlantChange({ detail: { value: $event.target.value } })"
          >
            <option v-for="(label, index) in plantLabels" :key="index" :value="index">{{ label }}</option>
          </select>
        </div>
        <div class="modal-actions">
          <div class="modal-cancel" @click="closeDeviceModal">取消</div>
          <div
            class="primary-button"
            :class="{ disabled: bindingDevice || !simulatedHardwareId.trim() }"
            @click="saveSimulatedDevice"
          >
            {{ bindingDevice ? "正在保存…" : editingDeviceId ? "保存修改" : "添加传感器" }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import "./uniCompat";
import { request } from "./api";

const metrics = [
  { key: "tempC", label: "环境温度", unit: "℃", range: "-50～80" },
  { key: "soilMoisture", label: "土壤湿度", unit: "%", range: "0～100" },
  { key: "phLevel", label: "土壤 pH", unit: "", range: "0～14" },
  { key: "lux", label: "光照强度", unit: "lx", range: "0～200000" },
];

const presets = [
  { key: "normal", label: "正常环境（全指标）", shortLabel: "正常", values: [24, 58, 6.5, 8500] },
  { key: "dry", label: "缺水干燥", shortLabel: "干燥", values: [27, 12, 6.4, 12000] },
  { key: "wet", label: "土壤过湿", shortLabel: "过湿", values: [22, 94, 6.7, 3500] },
  { key: "hot", label: "高温强光", shortLabel: "高温", values: [39, 32, 6.6, 68000] },
  { key: "cold", label: "低温环境", shortLabel: "低温", values: [5, 52, 6.5, 1800] },
  { key: "dark", label: "低光照", shortLabel: "缺光", values: [20, 55, 6.5, 80] },
  { key: "acid", label: "土壤偏酸", shortLabel: "偏酸", values: [24, 55, 4.2, 7000] },
  { key: "alkaline", label: "土壤偏碱", shortLabel: "偏碱", values: [24, 55, 9.2, 7000] },
];

const selectedUserIndex = ref(0);
const selectedDeviceIndex = ref(-1);
const selectedPlantIndex = ref(0);
const selectedPlantSensorIndex = ref(0);
const selectedPresetIndex = ref(0);
const loadingUsers = ref(false);
const loadingContext = ref(false);
const deletingUser = ref(false);
const deletingPlant = ref(false);
const deletingDevice = ref(false);
const creatingPlant = ref(false);
const bindingDevice = ref(false);
const showPlantModal = ref(false);
const showDeviceModal = ref(false);
const sending = ref(false);
const sentCount = ref(0);
const sendTotal = ref(0);
const batchCount = ref(1);
const intervalSeconds = ref(5);
const jitter = ref(false);
const lastResult = ref(null);
const users = ref([]);
const devices = ref([]);
const availablePlants = ref([]);
const editingPlantId = ref("");
const editingDeviceId = ref("");
const simulatedHardwareId = ref(createHardwareId());
const simulatedLabel = ref("开发模拟设备 1");
const simulatedPlantNickname = ref("模拟绿萝 1");
const simulatedSpeciesLabel = ref("绿萝");
const activeJobId = ref("");
let jobPollTimer = null;
const enabled = reactive({
  tempC: true,
  soilMoisture: true,
  phLevel: true,
  lux: true,
});
const values = reactive({
  tempC: 24,
  soilMoisture: 58,
  phLevel: 6.5,
  lux: 8500,
});

const selectedUser = computed(() => users.value[selectedUserIndex.value] || null);
const deviceLabels = computed(() =>
  devices.value.map((device) => {
    const name = device.label || device.hardwareId;
    return device.plantId ? `${name}（已绑定植物）` : `${name}（未绑定植物）`;
  })
);
const selectedDevice = computed(() => devices.value[selectedDeviceIndex.value] || null);
const selectedDeviceLabel = computed(() => {
  if (loadingContext.value) return "正在加载…";
  if (!selectedUser.value) return "请先选择用户";
  if (!devices.value.length) return "暂无传感器";
  return deviceLabels.value[selectedDeviceIndex.value] || "请先选择传感器";
});
const canConfigure = computed(() => Boolean(selectedDevice.value?.plantId));
const configurationMessage = computed(() => {
  if (!selectedDevice.value) return "请先选择传感器，选择后才能配置模拟数据。";
  if (!selectedDevice.value.plantId) return "当前传感器尚未绑定植物，请先在“修改”中配置植物。";
  return "";
});
const plantLabels = computed(() => [
  "不绑定植物",
  ...availablePlants.value.map((plant) => plant.nickname || plant.speciesLabel || "未命名植物"),
]);
const plantSensorLabels = computed(() => [
  "选择传感器",
  ...devices.value.map((device) => {
    const name = device.label || device.hardwareId;
    return device.plantId ? `${name}（已绑定）` : name;
  }),
]);
const canSend = computed(
  () => canConfigure.value && metrics.some((metric) => enabled[metric.key])
);
const canCreatePlant = computed(
  () => Boolean(simulatedPlantNickname.value.trim() && simulatedSpeciesLabel.value.trim())
);
const normalizedBatchCount = computed(() => Math.round(clamp(batchCount.value, 1, 200, 1)));
const preview = computed(() => buildPayload(false));
const previewText = computed(() => {
  const first = preview.value.readings[0] || {};
  const output = {
    deviceId: selectedDevice.value?.id || null,
    readings: [first],
  };
  return JSON.stringify(output, null, 2);
});

function clamp(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function eventValue(event) {
  return event?.detail?.value ?? event?.target?.value;
}

function createHardwareId() {
  return `greenai-sim-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function nextNumberedName(items, prefix, getName) {
  const maxNumber = items.reduce((max, item) => {
    const value = String(getName(item) || "");
    if (!value.startsWith(`${prefix} `)) return max;
    const number = Number(value.slice(prefix.length + 1));
    return Number.isInteger(number) && number > max ? number : max;
  }, 0);
  return `${prefix} ${maxNumber + 1}`;
}

function round(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function jitterValue(key, value) {
  if (!jitter.value) return value;
  const amplitude = {
    tempC: 1.2,
    soilMoisture: 3,
    phLevel: 0.15,
    lux: Math.max(20, value * 0.08),
  }[key];
  const limits = {
    tempC: [-50, 80],
    soilMoisture: [0, 100],
    phLevel: [0, 14],
    lux: [0, 200000],
  }[key];
  const next = value + (Math.random() * 2 - 1) * amplitude;
  return round(clamp(next, limits[0], limits[1], value), key === "lux" ? 0 : 1);
}

function buildPayload(withJitter) {
  const reading = {
    measuredAt: new Date().toISOString(),
  };
  metrics.forEach((metric) => {
    if (!enabled[metric.key]) return;
    const value = Number(values[metric.key]);
    reading[metric.key] = withJitter ? jitterValue(metric.key, value) : value;
  });
  return { readings: [reading] };
}

function applyPreset(index) {
  const preset = presets[index];
  if (!preset) return;
  selectedPresetIndex.value = index;
  metrics.forEach((metric, metricIndex) => {
    enabled[metric.key] = true;
    values[metric.key] = preset.values[metricIndex];
  });
}

function onPresetChange(event) {
  applyPreset(Number(eventValue(event)));
}

function shortUserName(user) {
  const value = String(user?.displayName || user?.openid || user?.id || "未知用户");
  return value.length > 28 ? `${value.slice(0, 25)}…` : value;
}

async function selectUser(index) {
  if (selectedUserIndex.value === index && devices.value.length) return;
  selectedUserIndex.value = index;
  selectedDeviceIndex.value = -1;
  selectedPlantIndex.value = 0;
  selectedPlantSensorIndex.value = 0;
  editingPlantId.value = "";
  editingDeviceId.value = "";
  showPlantModal.value = false;
  showDeviceModal.value = false;
  lastResult.value = null;
  await loadUserContext();
}

async function selectDevice(index) {
  const device = devices.value[index];
  if (!device) return;
  selectedDeviceIndex.value = index;
  editingDeviceId.value = device.id;
  simulatedHardwareId.value = device.hardwareId;
  simulatedLabel.value = device.label || "";
  const plantIndex = availablePlants.value.findIndex((plant) => plant.id === device.plantId);
  selectedPlantIndex.value = plantIndex >= 0 ? plantIndex + 1 : 0;
  lastResult.value = null;
  await syncScheduledJob();
}

function selectPlant(index) {
  const plant = availablePlants.value[index];
  if (!plant) return;
  editingPlantId.value = plant.id;
  simulatedPlantNickname.value = plant.nickname || "";
  simulatedSpeciesLabel.value = plant.speciesLabel || "";
  const deviceIndex = devices.value.findIndex((device) => device.plantId === plant.id);
  selectedPlantSensorIndex.value = deviceIndex >= 0 ? deviceIndex + 1 : 0;
}

function openPlantEdit(index) {
  selectPlant(index);
  if (editingPlantId.value) showPlantModal.value = true;
}

async function openDeviceEdit(index) {
  await selectDevice(index);
  if (editingDeviceId.value) showDeviceModal.value = true;
}

function openPlantModal() {
  if (!selectedUser.value) return;
  editingPlantId.value = "";
  simulatedPlantNickname.value = nextNumberedName(
    availablePlants.value,
    "模拟绿萝",
    (plant) => plant.nickname
  );
  simulatedSpeciesLabel.value = "绿萝";
  selectedPlantSensorIndex.value = 0;
  showPlantModal.value = true;
}

function closePlantModal() {
  if (!creatingPlant.value && !deletingPlant.value) {
    showPlantModal.value = false;
  }
}

function openDeviceModal() {
  if (!selectedUser.value) return;
  editingDeviceId.value = "";
  simulatedHardwareId.value = createHardwareId();
  simulatedLabel.value = nextNumberedName(devices.value, "开发模拟设备", (device) => device.label);
  selectedPlantIndex.value = 0;
  showDeviceModal.value = true;
}

function closeDeviceModal() {
  if (!bindingDevice.value && !deletingDevice.value) {
    showDeviceModal.value = false;
  }
}

function confirmDeleteUser() {
  const user = selectedUser.value;
  if (!user || deletingUser.value) return;
  if (sending.value) {
    uni.showToast({ title: "请先停止定时发送", icon: "none" });
    return;
  }

  uni.showModal({
    title: "永久删除用户？",
    content:
      `用户 ${shortUserName(user)} 的 ${user._count?.plants || 0} 株植物、` +
      `${user._count?.devices || 0} 台设备及其任务、读数、通知等数据都会被删除，且无法恢复。`,
    confirmText: "永久删除",
    confirmColor: "#b42318",
    success: async (result) => {
      if (!result.confirm) return;
      deletingUser.value = true;
      try {
        await request({
          path: `/dev/sensor-simulator/users/${encodeURIComponent(user.id)}`,
          method: "DELETE",
        });
        selectedUserIndex.value = 0;
        selectedDeviceIndex.value = -1;
        selectedPlantIndex.value = 0;
        selectedPlantSensorIndex.value = 0;
        editingPlantId.value = "";
        editingDeviceId.value = "";
        showPlantModal.value = false;
        showDeviceModal.value = false;
        lastResult.value = null;
        devices.value = [];
        availablePlants.value = [];
        await loadUsers();
        uni.showToast({ title: "用户及关联数据已删除", icon: "success" });
      } catch (error) {
        uni.showModal({
          title: "删除失败",
          content: errorMessage(error),
          showCancel: false,
        });
      } finally {
        deletingUser.value = false;
      }
    },
  });
}

function confirmDeletePlant(plantId = editingPlantId.value) {
  if (!plantId || deletingPlant.value) return;
  uni.showModal({
    title: "删除植物？",
    content: "植物的养护计划和任务将一并删除，已绑定传感器会自动解除绑定。",
    confirmText: "删除",
    confirmColor: "#b42318",
    success: async (result) => {
      if (!result.confirm) return;
      deletingPlant.value = true;
      try {
        await request({
          path: `/dev/sensor-simulator/plants/${encodeURIComponent(plantId)}`,
          method: "DELETE",
        });
        if (editingPlantId.value === plantId) {
          editingPlantId.value = "";
          showPlantModal.value = false;
        }
        selectedPlantIndex.value = 0;
        selectedPlantSensorIndex.value = 0;
        await loadUsers();
        uni.showToast({ title: "植物已删除", icon: "success" });
      } catch (error) {
        uni.showModal({ title: "删除植物失败", content: errorMessage(error), showCancel: false });
      } finally {
        deletingPlant.value = false;
      }
    },
  });
}

function confirmDeleteDevice(deviceId = editingDeviceId.value) {
  if (!deviceId || deletingDevice.value) return;
  uni.showModal({
    title: "删除传感器？",
    content: "传感器的历史读数和正在运行的模拟任务将一并删除。",
    confirmText: "删除",
    confirmColor: "#b42318",
    success: async (result) => {
      if (!result.confirm) return;
      deletingDevice.value = true;
      try {
        await request({
          path: `/dev/sensor-simulator/devices/${encodeURIComponent(deviceId)}`,
          method: "DELETE",
        });
        if (editingDeviceId.value === deviceId) {
          editingDeviceId.value = "";
          showDeviceModal.value = false;
        }
        selectedDeviceIndex.value = -1;
        selectedPlantSensorIndex.value = 0;
        await loadUsers();
        uni.showToast({ title: "传感器已删除", icon: "success" });
      } catch (error) {
        uni.showModal({ title: "删除传感器失败", content: errorMessage(error), showCancel: false });
      } finally {
        deletingDevice.value = false;
      }
    },
  });
}

function onPlantChange(event) {
  selectedPlantIndex.value = Number(eventValue(event));
}

function onPlantSensorChange(event) {
  selectedPlantSensorIndex.value = Number(eventValue(event));
}

function regenerateHardwareId() {
  simulatedHardwareId.value = createHardwareId();
}

function onMetricToggle(key, event) {
  enabled[key] = Boolean(eventValue(event));
}

function onMetricInput(key, event) {
  const limits = {
    tempC: [-50, 80],
    soilMoisture: [0, 100],
    phLevel: [0, 14],
    lux: [0, 200000],
  }[key];
  values[key] = clamp(eventValue(event), limits[0], limits[1], values[key]);
}

function onBatchInput(event) {
  batchCount.value = Math.round(clamp(eventValue(event), 1, 200, 1));
}

function onIntervalInput(event) {
  intervalSeconds.value = Math.round(clamp(eventValue(event), 1, 86_400, 5));
}

async function saveSimulatedPlant() {
  if (creatingPlant.value || !selectedUser.value || !canCreatePlant.value) {
    if (!selectedUser.value) uni.showToast({ title: "请先选择用户", icon: "none" });
    return;
  }

  creatingPlant.value = true;
  try {
    const isEditing = Boolean(editingPlantId.value);
    const sensorToBind = devices.value[selectedPlantSensorIndex.value - 1] || null;
    const plant = await request({
      path: isEditing
        ? `/dev/sensor-simulator/plants/${encodeURIComponent(editingPlantId.value)}`
        : `/dev/sensor-simulator/users/${encodeURIComponent(selectedUser.value.id)}/plants`,
      method: isEditing ? "PATCH" : "POST",
      data: {
        nickname: simulatedPlantNickname.value.trim(),
        speciesLabel: simulatedSpeciesLabel.value.trim(),
      },
    });
    let bindingError = null;
    if (sensorToBind) {
      try {
        await request({
          path: `/dev/sensor-simulator/users/${encodeURIComponent(selectedUser.value.id)}/devices`,
          method: "POST",
          data: {
            hardwareId: sensorToBind.hardwareId,
            plantId: plant.id,
          },
        });
      } catch (error) {
        bindingError = error;
      }
    }
    await loadUserContext();
    editingPlantId.value = plant?.id || "";
    const index = availablePlants.value.findIndex((item) => item.id === editingPlantId.value);
    if (index >= 0) selectPlant(index);
    if (!isEditing) showPlantModal.value = false;
    if (bindingError) {
      uni.showModal({
        title: "植物已添加，绑定失败",
        content: errorMessage(bindingError),
        showCancel: false,
      });
    } else {
      uni.showToast({ title: isEditing ? "植物修改已保存" : "植物已添加", icon: "success" });
    }
  } catch (error) {
    uni.showModal({
      title: "保存植物失败",
      content: errorMessage(error),
      showCancel: false,
    });
  } finally {
    creatingPlant.value = false;
  }
}

async function loadUsers() {
  if (loadingUsers.value) return;
  loadingUsers.value = true;
  try {
    const data = await request({ path: "/dev/sensor-simulator/users" });
    users.value = Array.isArray(data) ? data : [];
    if (selectedUserIndex.value >= users.value.length) selectedUserIndex.value = 0;
    await loadUserContext();
  } catch (error) {
    users.value = [];
    devices.value = [];
    availablePlants.value = [];
    uni.showModal({
      title: "用户列表加载失败",
      content: errorMessage(error),
      showCancel: false,
    });
  } finally {
    loadingUsers.value = false;
  }
}

async function loadUserContext() {
  if (loadingContext.value) return;
  const user = selectedUser.value;
  if (!user) {
    devices.value = [];
    availablePlants.value = [];
    return;
  }

  loadingContext.value = true;
  try {
    const context = await request({
      path: `/dev/sensor-simulator/users/${encodeURIComponent(user.id)}/context`,
    });
    devices.value = Array.isArray(context?.devices) ? context.devices : [];
    availablePlants.value = Array.isArray(context?.plants) ? context.plants : [];
    if (selectedDeviceIndex.value >= devices.value.length) selectedDeviceIndex.value = -1;
    if (selectedPlantIndex.value >= plantLabels.value.length) selectedPlantIndex.value = 0;
    await syncScheduledJob();
  } catch (error) {
    devices.value = [];
    availablePlants.value = [];
    uni.showToast({ title: errorMessage(error), icon: "none" });
  } finally {
    loadingContext.value = false;
  }
}

async function saveSimulatedDevice() {
  const hardwareId = simulatedHardwareId.value.trim();
  if (bindingDevice.value || !hardwareId || !selectedUser.value) {
    if (!selectedUser.value) uni.showToast({ title: "请先选择用户", icon: "none" });
    return;
  }

  bindingDevice.value = true;
  try {
    const isEditing = Boolean(editingDeviceId.value);
    const plant = availablePlants.value[selectedPlantIndex.value - 1] || null;
    const device = await request({
      path: `/dev/sensor-simulator/users/${encodeURIComponent(selectedUser.value.id)}/devices`,
      method: "POST",
      data: {
        hardwareId,
        label: simulatedLabel.value.trim() || null,
        plantId: plant?.id || null,
      },
    });
    await loadUserContext();
    const index = devices.value.findIndex((item) => item.id === device?.id);
    if (index >= 0) await selectDevice(index);
    if (!isEditing) showDeviceModal.value = false;
    uni.showToast({ title: isEditing ? "传感器修改已保存" : "传感器已添加", icon: "success" });
  } catch (error) {
    uni.showModal({
      title: "保存传感器失败",
      content: errorMessage(error),
      showCancel: false,
    });
  } finally {
    bindingDevice.value = false;
  }
}

function errorMessage(error) {
  if (error?.data?.error === "plant_not_found") return error.data.message || "目标植物不存在";
  if (error?.statusCode === 404 && error?.data?.message) return error.data.message;
  if (error?.statusCode === 404) return "模拟接口未启用，请设置 ENABLE_DEV_SENSOR_SIMULATOR=1";
  if (error?.statusCode === 400) return error?.data?.message || "数据格式不正确";
  if (error?.statusCode === 409) return error?.data?.message || "该硬件 ID 已被占用";
  return error?.errMsg || error?.data?.message || "发送失败，请检查后端连接";
}

function stopStatusPolling() {
  if (jobPollTimer) clearInterval(jobPollTimer);
  jobPollTimer = null;
}

function applyJobStatus(job) {
  if (!job) {
    activeJobId.value = "";
    sending.value = false;
    sentCount.value = 0;
    sendTotal.value = 0;
    stopStatusPolling();
    return;
  }

  activeJobId.value = job.id || "";
  sentCount.value = Number(job.sentCount || 0);
  sendTotal.value = Number(job.total || 0);
  sending.value = job.status === "running";

  if (job.status !== "running") {
    stopStatusPolling();
    if (sentCount.value > 0) {
      lastResult.value = {
        inserted: Number(job.inserted || 0),
        deduped: Number(job.deduped || 0),
        sentAt: new Date(job.completedAt || Date.now()).toLocaleString(),
      };
    }
    if (job.status === "failed" && job.error) {
      uni.showToast({ title: `后端任务失败：${job.error}`, icon: "none" });
    }
  }
}

function startStatusPolling() {
  stopStatusPolling();
  jobPollTimer = setInterval(() => {
    void syncScheduledJob();
  }, 1_000);
}

async function syncScheduledJob() {
  const device = selectedDevice.value;
  if (!device) {
    applyJobStatus(null);
    return;
  }
  try {
    const data = await request({
      path: `/dev/sensor-simulator/devices/${device.id}/job`,
    });
    applyJobStatus(data?.job || null);
    if (data?.job?.status === "running") startStatusPolling();
  } catch {
    // 状态同步失败不影响后端任务，下次轮询或重新显示页面时继续同步。
  }
}

async function stopScheduledSend() {
  if (!sending.value || !activeJobId.value) return;
  try {
    const job = await request({
      path: `/dev/sensor-simulator/jobs/${activeJobId.value}/stop`,
      method: "POST",
      data: {},
    });
    applyJobStatus(job);
    uni.showToast({ title: `已停止，共发送 ${sentCount.value} 条`, icon: "none" });
    await loadUserContext();
  } catch (error) {
    uni.showModal({
      title: "停止失败",
      content: errorMessage(error),
      showCancel: false,
    });
  }
}

async function send() {
  if (!canSend.value) {
    if (!selectedDevice.value) uni.showToast({ title: "请先选择传感器", icon: "none" });
    else if (!selectedDevice.value.plantId) {
      uni.showToast({ title: "请先为传感器绑定植物", icon: "none" });
    } else {
      uni.showToast({ title: "请至少启用一个指标", icon: "none" });
    }
    return;
  }

  const deviceId = selectedDevice.value.id;
  const total = normalizedBatchCount.value;
  const interval = Math.round(clamp(intervalSeconds.value, 1, 86_400, 5));
  const reading = buildPayload(false).readings[0];
  const { measuredAt: _measuredAt, ...readingTemplate } = reading;
  try {
    const job = await request({
      path: `/dev/sensor-simulator/devices/${deviceId}/jobs`,
      method: "POST",
      data: {
        total,
        intervalSeconds: interval,
        jitter: jitter.value,
        reading: readingTemplate,
      },
    });
    applyJobStatus(job);
    startStatusPolling();
    uni.showToast({ title: "后端定时任务已启动", icon: "success" });
  } catch (error) {
    if (error?.statusCode === 409 && error?.data?.job) {
      applyJobStatus(error.data.job);
      startStatusPolling();
      return;
    }
    uni.showModal({
      title: "发送失败",
      content: errorMessage(error),
      showCancel: false,
    });
  }
}

onMounted(loadUsers);
onBeforeUnmount(stopStatusPolling);
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #f0faf5;
  padding: 14px 16px calc(28px + env(safe-area-inset-bottom));
  box-sizing: border-box;
}
.warning {
  padding: 12px 14px;
  margin-bottom: 12px;
  border-radius: 10px;
  background: #fff3e0;
  border: 0.5px solid #f4c47b;
}
.warning-title,
.warning-text,
.section-title,
.metric-name,
.metric-range,
.field-label,
.field-help,
.result-title,
.result-line {
  display: block;
}
.warning-title {
  color: #9a5b00;
  font-size: 14px;
  font-weight: 700;
}
.warning-text {
  color: #7a5a2b;
  font-size: 11.5px;
  line-height: 1.5;
  margin-top: 4px;
}
.card,
.result-card {
  background: #fff;
  border-radius: 12px;
  padding: 14px;
  margin-bottom: 12px;
  box-shadow: 0 1px 5px rgba(26, 61, 43, 0.05);
}
.section-title {
  color: #1a3d2b;
  font-size: 14px;
  font-weight: 700;
  margin-bottom: 10px;
}
.no-margin {
  margin-bottom: 0;
}
.picker-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 38px;
  padding: 0 11px;
  border-radius: 8px;
  background: #f5faf7;
  color: #274b36;
  font-size: 13px;
}
.chevron {
  color: #8ea397;
  font-size: 20px;
}
.secondary-btn {
  margin-top: 8px;
  padding: 9px;
  border-radius: 8px;
  text-align: center;
  color: #1e7a4a;
  background: #e2f5ec;
  font-size: 12.5px;
  font-weight: 600;
}
.bind-help {
  display: block;
  margin: 9px 0;
  color: #718078;
  font-size: 11px;
  line-height: 1.5;
}
.text-input {
  height: 36px;
  padding: 0 10px;
  margin-bottom: 7px;
  border-radius: 7px;
  background: #f5faf7;
  color: #244633;
  font-size: 12px;
  box-sizing: border-box;
}
.bind-picker {
  margin-bottom: 8px;
}
.bind-actions {
  display: flex;
  gap: 8px;
}
.secondary-btn.compact {
  flex: 1;
  margin-top: 0;
}
.primary-small-btn {
  flex: 2;
  padding: 9px;
  border-radius: 8px;
  text-align: center;
  color: #fff;
  background: #1e7a4a;
  font-size: 12.5px;
  font-weight: 600;
}
.preset-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin-top: 10px;
}
.preset-chip {
  min-width: 56px;
  padding: 7px 9px;
  border-radius: 499.5px;
  color: #4a6556;
  background: #f2f6f3;
  text-align: center;
  font-size: 11.5px;
  box-sizing: border-box;
}
.preset-chip.active {
  color: #fff;
  background: #1e7a4a;
}
.metric-row,
.field-row,
.preview-head {
  display: flex;
  align-items: center;
}
.metric-row {
  min-height: 46px;
  border-bottom: 0.5px solid #edf2ef;
}
.metric-row:last-child,
.field-row:last-child {
  border-bottom: 0;
}
.metric-switch {
  transform: scale(0.8);
  transform-origin: left center;
  width: 41px;
}
.metric-info {
  flex: 1;
  min-width: 0;
}
.metric-name,
.field-label {
  color: #244633;
  font-size: 12.5px;
}
.metric-range,
.field-help {
  margin-top: 2px;
  color: #97a49c;
  font-size: 10px;
}
.number-input,
.small-input {
  height: 29px;
  border-radius: 6px;
  background: #f3f7f4;
  color: #1a3d2b;
  text-align: right;
  padding: 0 8px;
  box-sizing: border-box;
  font-size: 12.5px;
}
.number-input {
  width: 80px;
}
.small-input {
  width: 65px;
  margin-left: auto;
}
.number-input[disabled] {
  opacity: 0.45;
}
.unit {
  min-width: 23px;
  margin-left: 5px;
  color: #68776e;
  font-size: 11px;
}
.field-row {
  min-height: 48px;
  border-bottom: 0.5px solid #edf2ef;
}
.field-row > view:first-child {
  flex: 1;
}
.preview-head {
  justify-content: space-between;
  margin-bottom: 9px;
}
.preview-count {
  color: #1e7a4a;
  font-size: 11px;
}
.preview-json {
  display: block;
  white-space: pre-wrap;
  word-break: break-all;
  color: #365443;
  background: #f5faf7;
  border-radius: 8px;
  padding: 10px;
  font-size: 10.5px;
  line-height: 1.45;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
.send-btn {
  padding: 14px;
  margin: 4px 0 12px;
  border-radius: 11px;
  color: #fff;
  background: #1e7a4a;
  text-align: center;
  font-size: 14.5px;
  font-weight: 700;
}
.disabled {
  opacity: 0.5;
}
.result-card {
  border: 0.5px solid #b9dfca;
}
.result-title {
  color: #1e7a4a;
  font-size: 13px;
  font-weight: 700;
}
.result-line {
  color: #587064;
  font-size: 11.5px;
  margin-top: 4px;
}

/* Desktop web console */
:global(html),
:global(body),
:global(#app) {
  min-height: 100%;
  margin: 0;
}
:global(button),
:global(input),
:global(select) {
  font: inherit;
}
.page {
  min-width: 0;
  min-height: 100vh;
  padding: 0;
  background: #f4f6f8;
  color: #18221c;
  font-family: Inter, "Segoe UI", "Microsoft YaHei", sans-serif;
}
.topbar {
  position: sticky;
  top: 0;
  z-index: 100;
  height: 86px;
  padding: 0 32px;
  background: #fff;
  border-bottom: 1px solid #e5e9e7;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-sizing: border-box;
}
.brand-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.brand-mark {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #15803d;
  color: #fff;
  font-weight: 800;
  font-size: 18px;
}
.title {
  font-size: 21px;
  line-height: 1;
  font-weight: 750;
  color: #142019;
}
.dev-badge,
.subtle-badge,
.count-badge {
  padding: 4px 8px;
  border-radius: 5px;
  font-size: 10px;
  line-height: 1.2;
  letter-spacing: 0.08em;
  font-weight: 700;
}
.dev-badge {
  color: #9a6700;
  background: #fff7d6;
  border: 1px solid #f1d98a;
}
.subtitle {
  display: block;
  margin-top: 7px;
  color: #768079;
  font-size: 12px;
}
.server-state {
  height: 36px;
  padding: 0 12px;
  border: 1px solid #dce4df;
  border-radius: 7px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #5f6963;
  font-size: 12px;
}
.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #22c55e;
  box-shadow: 0 0 0 3px #dcfce7;
}
.status-value {
  padding-left: 8px;
  border-left: 1px solid #e5e9e7;
  color: #15803d;
  font-family: Consolas, monospace;
}
.workspace {
  width: 100%;
  padding: 24px 28px 36px;
  display: flex;
  flex-direction: column;
  gap: 22px;
  box-sizing: border-box;
}
.sidebar {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  align-items: start;
}
.main-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}
.configuration-lock {
  padding: 13px 16px;
  border: 1px solid #f0cf7a;
  border-radius: 8px;
  color: #7a5200;
  background: #fff9e8;
  font-size: 13px;
  font-weight: 650;
}
.panel {
  background: #fff;
  border: 1px solid #e2e7e4;
  border-radius: 10px;
  box-shadow: 0 1px 2px rgba(15, 35, 23, 0.03);
}
.sidebar .panel {
  padding: 18px;
}
.panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}
.step-label {
  display: block;
  margin-bottom: 5px;
  color: #16a34a;
  font-size: 9px;
  line-height: 1;
  letter-spacing: 0.13em;
  font-weight: 800;
}
.panel-title {
  display: block;
  color: #18221c;
  font-size: 15px;
  line-height: 1.25;
  font-weight: 700;
}
.panel-title.large {
  font-size: 19px;
}
.panel-description {
  display: block;
  margin-top: 5px;
  color: #849088;
  font-size: 11px;
}
.icon-button {
  width: 28px;
  height: 28px;
  border: 1px solid #dfe6e2;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #667169;
  background: #fafcfb;
  cursor: pointer;
  font-size: 16px;
}
.panel-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.panel-actions .icon-button {
  width: 24px;
  height: 24px;
  color: #15803d;
  font-size: 15px;
}
.user-list,
.plant-list,
.device-list {
  max-height: 220px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.user-item,
.plant-item,
.device-item {
  min-height: 54px;
  padding: 8px 9px;
  border: 1px solid transparent;
  border-radius: 7px;
  display: flex;
  align-items: center;
  gap: 10px;
  box-sizing: border-box;
  cursor: pointer;
}
.user-item:hover,
.plant-item:hover,
.device-item:hover {
  background: #f7faf8;
}
.user-item.active,
.plant-item.active,
.device-item.active {
  background: #f0f9f3;
  border-color: #a7d9b7;
}
.avatar,
.plant-icon,
.device-icon {
  width: 32px;
  height: 32px;
  border-radius: 7px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.avatar {
  background: #e5f5ea;
  color: #16783b;
  font-size: 13px;
  font-weight: 750;
}
.plant-icon {
  background: #edf7e8;
  color: #3d7d2c;
  font-size: 16px;
}
.device-icon {
  background: #edf2ef;
  color: #647269;
  font-size: 14px;
}
.active .device-icon {
  color: #15803d;
  background: #dff3e5;
}
.item-main {
  flex: 1;
  min-width: 0;
}
.item-title,
.item-meta {
  display: block;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.item-title {
  color: #263129;
  font-size: 12px;
  font-weight: 650;
}
.item-meta {
  margin-top: 4px;
  color: #8b958f;
  font-size: 10px;
}
.mono {
  font-family: Consolas, "SFMono-Regular", monospace;
}
.selected-check {
  width: 18px;
  color: #16a34a;
  font-size: 13px;
  font-weight: 800;
}
.item-edit,
.item-delete {
  min-height: 26px;
  padding: 5px 8px;
  border-radius: 4px;
  cursor: pointer;
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 700;
}
.item-edit {
  color: #15723a;
  background: #edf7f0;
}
.item-edit:hover {
  background: #dff1e5;
}
.item-delete {
  color: #b42318;
  background: #fff0ee;
}
.item-delete:hover {
  background: #ffe2df;
}
.device-badge {
  padding: 3px 6px;
  border-radius: 4px;
  color: #8a6a20;
  background: #fff8df;
  font-size: 9px;
}
.device-badge.online {
  color: #16783b;
  background: #e7f7ec;
}
.empty-state {
  padding: 22px 10px;
  color: #9aa39d;
  text-align: center;
  font-size: 11px;
}
.subtle-badge {
  color: #68736c;
  background: #f1f4f2;
  letter-spacing: 0;
}
.form-group {
  margin-bottom: 13px;
}
.form-label {
  display: block;
  margin-bottom: 6px;
  color: #59645d;
  font-size: 11px;
  font-weight: 650;
}
.web-input,
.web-select {
  width: 100%;
  height: 36px;
  padding: 0 10px;
  border: 1px solid #dce3df;
  border-radius: 6px;
  background: #fff;
  color: #263129;
  font-size: 12px;
  box-sizing: border-box;
}
.web-input:focus {
  border-color: #6bc488;
  box-shadow: 0 0 0 2px rgba(22, 163, 74, 0.08);
}
.web-input[disabled] {
  color: #7d8881;
  background: #f3f5f4;
}
.web-select {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
}
.input-with-action {
  position: relative;
}
.input-with-action .web-input {
  padding-right: 75px;
}
.inline-action {
  position: absolute;
  right: 9px;
  top: 10px;
  color: #15803d;
  font-size: 10px;
  font-weight: 650;
  cursor: pointer;
}
.primary-button,
.send-button {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  background: #15803d;
  cursor: pointer;
  font-weight: 700;
}
.primary-button {
  height: 38px;
  margin-top: 4px;
  border-radius: 6px;
  font-size: 12px;
}
.modal-mask {
  position: fixed;
  inset: 0;
  z-index: 900;
  padding: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 25, 19, 0.46);
  box-sizing: border-box;
}
.modal-card {
  width: 440px;
  max-height: 90vh;
  padding: 22px;
  border: 1px solid #dfe6e2;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 20px 50px rgba(15, 35, 23, 0.2);
  box-sizing: border-box;
  overflow-y: auto;
}
.modal-head {
  margin-bottom: 22px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
}
.modal-close {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #69746d;
  background: #f2f5f3;
  cursor: pointer;
  font-size: 20px;
}
.modal-actions {
  margin-top: 20px;
  display: flex;
  gap: 10px;
}
.modal-actions .primary-button {
  flex: 1;
  margin-top: 0;
}
.modal-cancel {
  width: 100px;
  height: 38px;
  border: 1px solid #dce3df;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #59645d;
  background: #fff;
  cursor: pointer;
  font-size: 12px;
  font-weight: 650;
}
.danger-button {
  height: 34px;
  margin-top: 12px;
  border: 1px solid #f2b8b5;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #b42318;
  background: #fff7f6;
  cursor: pointer;
  font-size: 11px;
  font-weight: 700;
}
.danger-button:hover {
  border-color: #dc6b64;
  background: #fff0ee;
}
.primary-button:hover,
.send-button:hover {
  background: #116b34;
}
.send-button.sending {
  background: #b42318;
}
.send-button.sending:hover {
  background: #912018;
}
.scenario-panel,
.metrics-panel,
.batch-panel,
.preview-panel {
  padding: 20px;
}
.main-head {
  align-items: center;
}
.target-summary {
  max-width: 380px;
  padding: 8px 11px;
  border: 1px solid #e1e6e3;
  border-radius: 6px;
  background: #f8faf9;
}
.summary-label,
.summary-value {
  display: block;
  text-align: right;
}
.summary-label {
  color: #8a948e;
  font-size: 9px;
  text-transform: uppercase;
}
.summary-value {
  margin-top: 3px;
  color: #344039;
  font-size: 11px;
  font-weight: 650;
}
.preset-grid {
  display: grid;
  grid-template-columns: repeat(8, minmax(72px, 1fr));
  gap: 8px;
  margin: 0;
}
.preset-card {
  min-height: 64px;
  padding: 11px 9px;
  border: 1px solid #e0e6e2;
  border-radius: 7px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  background: #fafcfb;
  cursor: pointer;
  box-sizing: border-box;
}
.preset-card:hover {
  border-color: #9ecfae;
}
.preset-card.active {
  border-color: #16a34a;
  background: #f0faf3;
  box-shadow: inset 0 0 0 1px #16a34a;
}
.preset-name,
.preset-desc {
  display: block;
  text-align: center;
}
.preset-name {
  color: #273229;
  font-size: 12px;
  font-weight: 700;
}
.preset-desc {
  margin-top: 5px;
  color: #8b958f;
  font-size: 9px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}
.metric-card {
  width: 100%;
  min-width: 0;
  min-height: 132px;
  padding: 15px;
  border: 1px solid #dfe6e2;
  border-radius: 8px;
  background: #fbfdfc;
  box-sizing: border-box;
}
.metric-card.inactive {
  opacity: 0.48;
  background: #f5f6f5;
}
.metric-card-head {
  min-width: 0;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}
.metric-name {
  display: block;
  color: #29342c;
  font-size: 12px;
  font-weight: 700;
}
.metric-range {
  display: block;
  margin-top: 4px;
  color: #909a94;
  font-size: 9px;
}
.metric-switch {
  width: 36px;
  height: 20px;
  margin: 0;
  border: 0;
  border-radius: 999px;
  position: relative;
  appearance: none;
  background: #cbd5ce;
  cursor: pointer;
  transition: background 0.2s ease;
}
.metric-switch::after,
.toggle-row input[type="checkbox"]::after {
  content: "";
  width: 16px;
  height: 16px;
  border-radius: 50%;
  position: absolute;
  top: 2px;
  left: 2px;
  background: #fff;
  box-shadow: 0 1px 3px rgba(15, 35, 23, 0.24);
  transition: transform 0.2s ease;
}
.metric-switch:checked,
.toggle-row input[type="checkbox"]:checked {
  background: #16a34a;
}
.metric-switch:checked::after,
.toggle-row input[type="checkbox"]:checked::after {
  transform: translateX(16px);
}
.metric-value-row {
  min-width: 0;
  margin-top: 19px;
  display: flex;
  align-items: baseline;
  border-bottom: 1px solid #d8e0db;
}
.metric-input {
  flex: 1;
  min-width: 0;
  height: 38px;
  padding: 0;
  border: 0;
  outline: 0;
  appearance: textfield;
  background: transparent;
  color: #17221b;
  font-size: 26px;
  font-weight: 650;
}
.metric-input::-webkit-inner-spin-button,
.metric-input::-webkit-outer-spin-button {
  margin: 0;
  appearance: none;
}
.metric-unit {
  color: #77827b;
  font-size: 11px;
}
.bottom-grid {
  display: grid;
  grid-template-columns: minmax(420px, 0.9fr) minmax(460px, 1.1fr);
  gap: 16px;
}
.batch-fields {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 15px;
}
.batch-fields .form-group {
  margin-bottom: 0;
}
.input-suffix {
  position: relative;
}
.input-suffix .web-input {
  padding-right: 48px;
}
.input-suffix > span {
  position: absolute;
  right: 10px;
  top: 10px;
  color: #7a857e;
  font-size: 10px;
}
.field-tip {
  display: block;
  margin-top: 5px;
  color: #98a19b;
  font-size: 9px;
}
.plant-tip {
  margin: -2px 0 12px;
}
.toggle-row {
  height: 36px;
  display: flex;
  align-items: center;
  gap: 9px;
  color: #556159;
  font-size: 11px;
}
.toggle-row input[type="checkbox"] {
  width: 36px;
  height: 20px;
  margin: 0;
  border: 0;
  border-radius: 999px;
  position: relative;
  appearance: none;
  background: #cbd5ce;
  cursor: pointer;
}
.preview-panel {
  min-width: 0;
}
.count-badge {
  color: #4ade80;
  background: #153d25;
}
.preview-json {
  height: 132px;
  margin: 0;
  padding: 14px;
  border-radius: 7px;
  display: block;
  overflow: auto;
  background: #101a14;
  color: #b7e4c7;
  white-space: pre;
  font-family: Consolas, "SFMono-Regular", monospace;
  font-size: 10px;
  line-height: 1.55;
  box-sizing: border-box;
}
.action-bar {
  min-height: 68px;
  padding: 12px 16px;
  border: 1px solid #dfe5e1;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  background: #fff;
  box-sizing: border-box;
}
.last-result {
  display: flex;
  align-items: center;
  gap: 10px;
}
.success-icon {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #15803d;
  background: #dcfce7;
  font-weight: 800;
}
.result-title {
  display: block;
  color: #26713f;
  font-size: 11px;
  font-weight: 700;
}
.result-detail,
.action-hint {
  display: block;
  margin-top: 3px;
  color: #87918b;
  font-size: 10px;
}
.send-button {
  width: 190px;
  height: 42px;
  padding: 0 16px;
  border-radius: 7px;
  justify-content: space-between;
  font-size: 12px;
  box-sizing: border-box;
}
.send-arrow {
  font-size: 17px;
}
.disabled {
  opacity: 0.45;
  pointer-events: none;
}

.step-label,
.device-badge,
.summary-label,
.preset-desc,
.metric-range,
.field-tip,
.dev-badge,
.subtle-badge,
.count-badge,
.item-meta,
.item-edit,
.item-delete,
.empty-state,
.form-label,
.inline-action,
.danger-button,
.preview-json,
.result-title,
.result-detail,
.action-hint {
  font-size: 12px;
}
.item-title,
.panel-title,
.preset-name,
.metric-name {
  font-size: 13px;
}
.panel-description,
.summary-value,
.metric-unit,
.toggle-row {
  font-size: 12px;
}

@media (max-width: 1360px) {
  .workspace {
    padding-left: 20px;
    padding-right: 20px;
  }
  .preset-grid {
    grid-template-columns: repeat(4, 1fr);
  }
  .bottom-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 1100px) {
  .metrics-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 900px) {
  .topbar {
    height: auto;
    min-height: 78px;
    padding: 14px 18px;
    align-items: flex-start;
    gap: 12px;
  }
  .server-state {
    height: auto;
    min-height: 34px;
    flex-wrap: wrap;
  }
  .workspace {
    padding: 16px;
    gap: 16px;
  }
  .sidebar {
    grid-template-columns: 1fr;
  }
  .sidebar .panel {
    width: 100%;
    box-sizing: border-box;
  }
  .main-head,
  .action-bar {
    align-items: stretch;
    flex-direction: column;
  }
  .target-summary {
    max-width: none;
  }
  .summary-label,
  .summary-value {
    text-align: left;
  }
  .preset-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
  .batch-fields {
    grid-template-columns: 1fr;
  }
  .batch-fields .form-group + .form-group {
    margin-top: 10px;
  }
  .send-button {
    width: 100%;
  }
}

@media (max-width: 560px) {
  .page {
    overflow-x: clip;
  }
  .topbar {
    position: static;
    flex-direction: column;
  }
  .brand-row {
    flex-wrap: wrap;
  }
  .status-value {
    width: 100%;
    padding: 5px 0 0;
    border-top: 1px solid #e5e9e7;
    border-left: 0;
  }
  .workspace {
    padding: 12px;
  }
  .metrics-grid {
    width: 100%;
    min-width: 0;
    grid-template-columns: 1fr;
  }
  .metric-card {
    overflow: hidden;
  }
  .preset-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .scenario-panel,
  .metrics-panel,
  .batch-panel,
  .preview-panel {
    padding: 15px;
  }
  .modal-mask {
    padding: 12px;
  }
  .modal-card {
    width: 100%;
    padding: 18px;
  }
  .modal-actions {
    flex-direction: column-reverse;
  }
  .modal-cancel,
  .modal-actions .primary-button {
    width: 100%;
    flex: none;
  }
  .step-label,
  .device-badge,
  .summary-label,
  .preset-desc,
  .metric-range,
  .field-tip,
  .item-meta,
  .panel-description,
  .form-label,
  .summary-value,
  .metric-unit,
  .toggle-row {
    font-size: 12px;
  }
}
</style>
