<template>
  <view class="page">
    <view class="topbar">
      <view>
        <view class="brand-row">
          <text class="brand-mark">G</text>
          <text class="title">Sensor Simulator</text>
          <text class="dev-badge">DEVELOPMENT</text>
        </view>
        <text class="subtitle">选择用户、绑定虚拟设备并向后端推送传感器读数</text>
      </view>
      <view class="server-state">
        <text class="status-dot"></text>
        <text>开发接口</text>
        <text class="status-value">ENABLE_DEV_SENSOR_SIMULATOR=1</text>
      </view>
    </view>

    <view class="workspace">
      <view class="sidebar">
        <view class="panel user-panel">
          <view class="panel-head">
            <view>
              <text class="step-label">STEP 01</text>
              <text class="panel-title">选择用户</text>
            </view>
            <view class="icon-button" :class="{ disabled: loadingUsers }" @click="loadUsers">
              {{ loadingUsers ? "…" : "↻" }}
            </view>
          </view>
          <view class="user-list">
            <view
              v-for="(user, index) in users"
              :key="user.id"
              class="user-item"
              :class="{ active: selectedUserIndex === index }"
              @click="selectUser(index)"
            >
              <view class="avatar">{{ String(user.openid || user.id).slice(0, 1).toUpperCase() }}</view>
              <view class="item-main">
                <text class="item-title">{{ shortUserName(user) }}</text>
                <text class="item-meta">{{ user._count?.plants || 0 }} 株植物 · {{ user._count?.devices || 0 }} 台设备</text>
              </view>
              <text class="selected-check">{{ selectedUserIndex === index ? "✓" : "" }}</text>
            </view>
            <view v-if="!loadingUsers && !users.length" class="empty-state">暂无可选用户</view>
          </view>
          <view
            class="danger-button"
            :class="{ disabled: deletingUser || sending || !selectedUser }"
            @click="confirmDeleteUser"
          >
            {{ deletingUser ? "正在删除…" : "删除用户及全部关联数据" }}
          </view>
        </view>

        <view class="panel plant-panel">
          <view class="panel-head">
            <view>
              <text class="step-label">STEP 02</text>
              <text class="panel-title">模拟植物</text>
            </view>
            <text class="subtle-badge">{{ availablePlants.length }} 株</text>
          </view>
          <view class="form-group">
            <text class="form-label">植物昵称</text>
            <input v-model="simulatedPlantNickname" class="web-input" maxlength="60" placeholder="模拟绿萝" />
          </view>
          <view class="form-group">
            <text class="form-label">植物品种</text>
            <input v-model="simulatedSpeciesLabel" class="web-input" maxlength="120" placeholder="绿萝" />
          </view>
          <text class="field-tip plant-tip">默认使用室内、中等光照和中等需水配置</text>
          <view
            class="primary-button"
            :class="{ disabled: creatingPlant || !selectedUser || !canCreatePlant }"
            @click="createSimulatedPlant"
          >
            {{ creatingPlant ? "正在创建…" : "创建模拟植物" }}
          </view>
        </view>

        <view class="panel device-panel">
          <view class="panel-head">
            <view>
              <text class="step-label">STEP 03</text>
              <text class="panel-title">目标设备</text>
            </view>
            <view class="icon-button" :class="{ disabled: loadingContext || !selectedUser }" @click="loadUserContext">
              {{ loadingContext ? "…" : "↻" }}
            </view>
          </view>
          <view class="device-list">
            <view
              v-for="(device, index) in devices"
              :key="device.id"
              class="device-item"
              :class="{ active: selectedDeviceIndex === index }"
              @click="selectDevice(index)"
            >
              <view class="device-icon">◉</view>
              <view class="item-main">
                <text class="item-title">{{ device.label || device.hardwareId }}</text>
                <text class="item-meta mono">{{ device.hardwareId }}</text>
              </view>
              <text class="device-badge" :class="{ online: device.lastSeenAt }">
                {{ device.lastSeenAt ? "有数据" : "未上报" }}
              </text>
            </view>
            <view v-if="selectedUser && !loadingContext && !devices.length" class="empty-state">
              当前用户暂无设备，请在下方创建
            </view>
          </view>
        </view>

        <view class="panel bind-panel">
          <view class="panel-head">
            <view>
              <text class="step-label">STEP 04</text>
              <text class="panel-title">模拟绑定</text>
            </view>
            <text class="subtle-badge">跳过固件</text>
          </view>
          <view class="form-group">
            <text class="form-label">硬件 ID</text>
            <view class="input-with-action">
              <input v-model="simulatedHardwareId" class="web-input mono" maxlength="128" />
              <view class="inline-action" @click="regenerateHardwareId">重新生成</view>
            </view>
          </view>
          <view class="form-group">
            <text class="form-label">设备名称</text>
            <input v-model="simulatedLabel" class="web-input" maxlength="60" placeholder="开发模拟设备" />
          </view>
          <view class="form-group">
            <text class="form-label">绑定植物</text>
            <picker :range="plantLabels" :value="selectedPlantIndex" @change="onPlantChange">
              <view class="web-select">
                <text>{{ plantLabels[selectedPlantIndex] }}</text>
                <text>⌄</text>
              </view>
            </picker>
          </view>
          <view
            class="primary-button"
            :class="{ disabled: bindingDevice || !selectedUser || !simulatedHardwareId.trim() }"
            @click="bindSimulatedDevice"
          >
            {{ bindingDevice ? "正在创建…" : "创建并绑定模拟设备" }}
          </view>
        </view>
      </view>

      <view class="main-content">
        <view class="panel scenario-panel">
          <view class="panel-head main-head">
            <view>
              <text class="step-label">STEP 05</text>
              <text class="panel-title large">配置模拟数据</text>
            </view>
            <view class="target-summary">
              <text class="summary-label">当前目标</text>
              <text class="summary-value">{{ selectedDeviceLabel }}</text>
            </view>
          </view>
          <view class="preset-grid">
            <view
              v-for="(preset, index) in presets"
              :key="preset.key"
              class="preset-card"
              :class="{ active: selectedPresetIndex === index }"
              @click="applyPreset(index)"
            >
              <text class="preset-name">{{ preset.shortLabel }}</text>
              <text class="preset-desc">{{ preset.label }}</text>
            </view>
          </view>
        </view>

        <view class="panel metrics-panel">
          <view class="panel-head">
            <view>
              <text class="panel-title">指标组合</text>
              <text class="panel-description">启用需要上报的指标并设定基础值</text>
            </view>
          </view>
          <view class="metrics-grid">
            <view
              v-for="metric in metrics"
              :key="metric.key"
              class="metric-card"
              :class="{ inactive: !enabled[metric.key] }"
            >
              <view class="metric-card-head">
                <view>
                  <text class="metric-name">{{ metric.label }}</text>
                  <text class="metric-range">有效范围 {{ metric.range }}</text>
                </view>
                <switch
                  class="metric-switch"
                  color="#16a34a"
                  :checked="enabled[metric.key]"
                  @change="onMetricToggle(metric.key, $event)"
                />
              </view>
              <view class="metric-value-row">
                <input
                  class="metric-input"
                  type="digit"
                  :disabled="!enabled[metric.key]"
                  :value="values[metric.key]"
                  @input="onMetricInput(metric.key, $event)"
                />
                <text class="metric-unit">{{ metric.unit || "pH" }}</text>
              </view>
            </view>
          </view>
        </view>

        <view class="bottom-grid">
          <view class="panel batch-panel">
            <view class="panel-head">
              <view>
                <text class="panel-title">批量参数</text>
                <text class="panel-description">按间隔逐条模拟实时推送</text>
              </view>
            </view>
            <view class="batch-fields">
              <view class="form-group">
                <text class="form-label">读数数量</text>
                <view class="input-suffix">
                  <input class="web-input" type="number" :value="batchCount" @input="onBatchInput" />
                  <text>条</text>
                </view>
                <text class="field-tip">每次请求发送 1 条，最多 200 条</text>
              </view>
              <view class="form-group">
                <text class="form-label">时间间隔</text>
                <view class="input-suffix">
                  <input class="web-input" type="number" :value="intervalSeconds" @input="onIntervalInput" />
                  <text>秒</text>
                </view>
                <text class="field-tip">两次实时推送之间的等待时间</text>
              </view>
              <view class="form-group jitter-field">
                <text class="form-label">随机波动</text>
                <view class="toggle-row">
                  <switch color="#16a34a" :checked="jitter" @change="jitter = $event.detail.value" />
                  <text>{{ jitter ? "已启用" : "已关闭" }}</text>
                </view>
                <text class="field-tip">模拟真实传感器抖动</text>
              </view>
            </view>
          </view>

          <view class="panel preview-panel">
            <view class="panel-head">
              <view>
                <text class="panel-title">请求预览</text>
                <text class="panel-description">后端任务持续运行，页面仅同步进度</text>
              </view>
              <text class="count-badge">{{ normalizedBatchCount }} SENDS</text>
            </view>
            <text class="preview-json">{{ previewText }}</text>
          </view>
        </view>

        <view class="action-bar">
          <view v-if="lastResult" class="last-result">
            <text class="success-icon">✓</text>
            <view>
              <text class="result-title">最近发送成功</text>
              <text class="result-detail">写入 {{ lastResult.inserted }} 条 · 去重 {{ lastResult.deduped }} 条 · {{ lastResult.sentAt }}</text>
            </view>
          </view>
          <view v-else class="action-hint">所有模拟数据都会写入当前开发数据库</view>
          <view
            class="send-button"
            :class="{ disabled: !sending && !canSend, sending }"
            @click="sending ? stopScheduledSend() : send()"
          >
            <text>{{ sending ? `停止发送 ${sentCount}/${sendTotal}` : "开始定时发送" }}</text>
            <text class="send-arrow">{{ sending ? "■" : "→" }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, reactive, ref } from "vue";
import { onShow, onUnload } from "@dcloudio/uni-app";
import { request } from "../../utils/request";

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
const selectedDeviceIndex = ref(0);
const selectedPlantIndex = ref(0);
const selectedPresetIndex = ref(0);
const loadingUsers = ref(false);
const loadingContext = ref(false);
const deletingUser = ref(false);
const creatingPlant = ref(false);
const bindingDevice = ref(false);
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
const simulatedHardwareId = ref(createHardwareId());
const simulatedLabel = ref("开发模拟设备");
const simulatedPlantNickname = ref("模拟绿萝");
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
  return deviceLabels.value[selectedDeviceIndex.value] || "暂无设备，请先完成设备绑定";
});
const plantLabels = computed(() => [
  "不绑定植物",
  ...availablePlants.value.map((plant) => plant.nickname || plant.speciesLabel || "未命名植物"),
]);
const canSend = computed(
  () => Boolean(selectedDevice.value) && metrics.some((metric) => enabled[metric.key])
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

function createHardwareId() {
  return `greenai-sim-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
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
  applyPreset(Number(event.detail.value));
}

function shortUserName(user) {
  const value = String(user?.openid || user?.id || "未知用户");
  return value.length > 28 ? `${value.slice(0, 25)}…` : value;
}

async function selectUser(index) {
  if (selectedUserIndex.value === index && devices.value.length) return;
  selectedUserIndex.value = index;
  selectedDeviceIndex.value = 0;
  selectedPlantIndex.value = 0;
  lastResult.value = null;
  await loadUserContext();
}

async function selectDevice(index) {
  if (selectedDeviceIndex.value === index) return;
  selectedDeviceIndex.value = index;
  lastResult.value = null;
  await syncScheduledJob();
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
        selectedDeviceIndex.value = 0;
        selectedPlantIndex.value = 0;
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

function onPlantChange(event) {
  selectedPlantIndex.value = Number(event.detail.value);
}

function regenerateHardwareId() {
  simulatedHardwareId.value = createHardwareId();
}

function onMetricToggle(key, event) {
  enabled[key] = Boolean(event.detail.value);
}

function onMetricInput(key, event) {
  const limits = {
    tempC: [-50, 80],
    soilMoisture: [0, 100],
    phLevel: [0, 14],
    lux: [0, 200000],
  }[key];
  values[key] = clamp(event.detail.value, limits[0], limits[1], values[key]);
}

function onBatchInput(event) {
  batchCount.value = Math.round(clamp(event.detail.value, 1, 200, 1));
}

function onIntervalInput(event) {
  intervalSeconds.value = Math.round(clamp(event.detail.value, 1, 86_400, 5));
}

async function createSimulatedPlant() {
  if (creatingPlant.value || !selectedUser.value || !canCreatePlant.value) {
    if (!selectedUser.value) uni.showToast({ title: "请先选择用户", icon: "none" });
    return;
  }

  creatingPlant.value = true;
  try {
    const plant = await request({
      path: `/dev/sensor-simulator/users/${encodeURIComponent(selectedUser.value.id)}/plants`,
      method: "POST",
      data: {
        nickname: simulatedPlantNickname.value.trim(),
        speciesLabel: simulatedSpeciesLabel.value.trim(),
      },
    });
    await loadUserContext();
    const index = availablePlants.value.findIndex((item) => item.id === plant?.id);
    selectedPlantIndex.value = index >= 0 ? index + 1 : 0;
    simulatedPlantNickname.value = "模拟绿萝";
    simulatedSpeciesLabel.value = "绿萝";
    uni.showToast({ title: "模拟植物已创建", icon: "success" });
  } catch (error) {
    uni.showModal({
      title: "模拟植物创建失败",
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
    if (selectedDeviceIndex.value >= devices.value.length) selectedDeviceIndex.value = 0;
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

async function bindSimulatedDevice() {
  const hardwareId = simulatedHardwareId.value.trim();
  if (bindingDevice.value || !hardwareId || !selectedUser.value) {
    if (!selectedUser.value) uni.showToast({ title: "请先选择用户", icon: "none" });
    return;
  }

  bindingDevice.value = true;
  try {
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
    selectedDeviceIndex.value = index >= 0 ? index : 0;
    regenerateHardwareId();
    uni.showToast({ title: plant ? "模拟设备已绑定" : "模拟设备已创建", icon: "success" });
  } catch (error) {
    uni.showModal({
      title: "模拟绑定失败",
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
    if (!selectedDevice.value) uni.showToast({ title: "请先选择设备", icon: "none" });
    else if (!canSend.value) uni.showToast({ title: "请至少启用一个指标", icon: "none" });
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

onShow(loadUsers);
onUnload(stopStatusPolling);
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #f0faf5;
  padding: 28rpx 32rpx calc(56rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
}
.warning {
  padding: 24rpx 28rpx;
  margin-bottom: 24rpx;
  border-radius: 20rpx;
  background: #fff3e0;
  border: 1rpx solid #f4c47b;
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
  font-size: 28rpx;
  font-weight: 700;
}
.warning-text {
  color: #7a5a2b;
  font-size: 23rpx;
  line-height: 1.5;
  margin-top: 8rpx;
}
.card,
.result-card {
  background: #fff;
  border-radius: 24rpx;
  padding: 28rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 2rpx 10rpx rgba(26, 61, 43, 0.05);
}
.section-title {
  color: #1a3d2b;
  font-size: 28rpx;
  font-weight: 700;
  margin-bottom: 20rpx;
}
.no-margin {
  margin-bottom: 0;
}
.picker-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 76rpx;
  padding: 0 22rpx;
  border-radius: 16rpx;
  background: #f5faf7;
  color: #274b36;
  font-size: 26rpx;
}
.chevron {
  color: #8ea397;
  font-size: 40rpx;
}
.secondary-btn {
  margin-top: 16rpx;
  padding: 18rpx;
  border-radius: 16rpx;
  text-align: center;
  color: #1e7a4a;
  background: #e2f5ec;
  font-size: 25rpx;
  font-weight: 600;
}
.bind-help {
  display: block;
  margin: 18rpx 0;
  color: #718078;
  font-size: 22rpx;
  line-height: 1.5;
}
.text-input {
  height: 72rpx;
  padding: 0 20rpx;
  margin-bottom: 14rpx;
  border-radius: 14rpx;
  background: #f5faf7;
  color: #244633;
  font-size: 24rpx;
  box-sizing: border-box;
}
.bind-picker {
  margin-bottom: 16rpx;
}
.bind-actions {
  display: flex;
  gap: 16rpx;
}
.secondary-btn.compact {
  flex: 1;
  margin-top: 0;
}
.primary-small-btn {
  flex: 2;
  padding: 18rpx;
  border-radius: 16rpx;
  text-align: center;
  color: #fff;
  background: #1e7a4a;
  font-size: 25rpx;
  font-weight: 600;
}
.preset-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 14rpx;
  margin-top: 20rpx;
}
.preset-chip {
  min-width: 112rpx;
  padding: 14rpx 18rpx;
  border-radius: 999rpx;
  color: #4a6556;
  background: #f2f6f3;
  text-align: center;
  font-size: 23rpx;
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
  min-height: 92rpx;
  border-bottom: 1rpx solid #edf2ef;
}
.metric-row:last-child,
.field-row:last-child {
  border-bottom: 0;
}
.metric-switch {
  transform: scale(0.8);
  transform-origin: left center;
  width: 82rpx;
}
.metric-info {
  flex: 1;
  min-width: 0;
}
.metric-name,
.field-label {
  color: #244633;
  font-size: 25rpx;
}
.metric-range,
.field-help {
  margin-top: 4rpx;
  color: #97a49c;
  font-size: 20rpx;
}
.number-input,
.small-input {
  height: 58rpx;
  border-radius: 12rpx;
  background: #f3f7f4;
  color: #1a3d2b;
  text-align: right;
  padding: 0 16rpx;
  box-sizing: border-box;
  font-size: 25rpx;
}
.number-input {
  width: 160rpx;
}
.small-input {
  width: 130rpx;
  margin-left: auto;
}
.number-input[disabled] {
  opacity: 0.45;
}
.unit {
  min-width: 46rpx;
  margin-left: 10rpx;
  color: #68776e;
  font-size: 22rpx;
}
.field-row {
  min-height: 96rpx;
  border-bottom: 1rpx solid #edf2ef;
}
.field-row > view:first-child {
  flex: 1;
}
.preview-head {
  justify-content: space-between;
  margin-bottom: 18rpx;
}
.preview-count {
  color: #1e7a4a;
  font-size: 22rpx;
}
.preview-json {
  display: block;
  white-space: pre-wrap;
  word-break: break-all;
  color: #365443;
  background: #f5faf7;
  border-radius: 16rpx;
  padding: 20rpx;
  font-size: 21rpx;
  line-height: 1.45;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
.send-btn {
  padding: 28rpx;
  margin: 8rpx 0 24rpx;
  border-radius: 22rpx;
  color: #fff;
  background: #1e7a4a;
  text-align: center;
  font-size: 29rpx;
  font-weight: 700;
}
.disabled {
  opacity: 0.5;
}
.result-card {
  border: 1rpx solid #b9dfca;
}
.result-title {
  color: #1e7a4a;
  font-size: 26rpx;
  font-weight: 700;
}
.result-line {
  color: #587064;
  font-size: 23rpx;
  margin-top: 8rpx;
}

/* Desktop web console */
.page {
  min-width: 1180px;
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
  display: grid;
  grid-template-columns: 330px minmax(0, 1fr);
  gap: 22px;
  box-sizing: border-box;
  align-items: start;
}
.sidebar,
.main-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
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
.user-list,
.device-list {
  max-height: 220px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.user-item,
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
.device-item:hover {
  background: #f7faf8;
}
.user-item.active,
.device-item.active {
  background: #f0f9f3;
  border-color: #a7d9b7;
}
.avatar,
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
  width: auto;
  transform: scale(0.65);
  transform-origin: right top;
}
.metric-value-row {
  margin-top: 19px;
  display: flex;
  align-items: baseline;
  border-bottom: 1px solid #d8e0db;
}
.metric-input {
  flex: 1;
  min-width: 0;
  height: 38px;
  color: #17221b;
  font-size: 26px;
  font-weight: 650;
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
.input-suffix > text {
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
  gap: 4px;
  color: #556159;
  font-size: 11px;
}
.toggle-row switch {
  transform: scale(0.65);
  transform-origin: left center;
  width: 42px;
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

@media (max-width: 1360px) {
  .workspace {
    grid-template-columns: 310px minmax(0, 1fr);
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
</style>
