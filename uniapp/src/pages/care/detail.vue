<template>
  <view v-if="plant" class="page">
    <SensorAlertBanner />
    <scroll-view scroll-y class="scroll">
      <view class="mint-block px-40 pt-32 pb-40">
        <view class="row top">
          <view class="big-emoji">{{ plant.emoji }}</view>
          <view class="grow min0">
            <view class="row wrap gap-16">
              <text class="p-title">{{ plant.name }}</text>
              <text class="st" :style="stStyle">{{ stText }}</text>
            </view>
            <text class="meta">📍 {{ plant.location }}</text>
            <text class="meta">🕐 上次养护 {{ plant.lastCare }}</text>
          </view>
        </view>
        <view class="sensor-card">
          <view class="sensor-title-row row between">
            <text class="sensor-title">实时环境</text>
            <text class="sensor-time">{{ sensorTimeText }}</text>
          </view>
          <view class="sensor-grid row">
            <view class="sensor-metric">
              <text class="sensor-icon">🌡️</text>
              <text class="sensor-value">{{ temperatureText }}</text>
              <text class="sensor-label">温度</text>
            </view>
            <view class="sensor-metric">
              <text class="sensor-icon">💧</text>
              <text class="sensor-value">{{ humidityText }}</text>
              <text class="sensor-label">土壤湿度</text>
            </view>
            <view class="sensor-metric">
              <text class="sensor-icon">☀️</text>
              <text class="sensor-value">{{ lightText }}</text>
              <text class="sensor-label">光照</text>
            </view>
            <view class="sensor-metric">
              <text class="sensor-icon">🧪</text>
              <text class="sensor-value">{{ phText }}</text>
              <text class="sensor-label">土壤 pH</text>
            </view>
          </view>
          <view v-if="sensorAlerts.length" class="sensor-alert-list">
            <view v-for="item in sensorAlerts" :key="item.id" class="sensor-alert row">
              <text class="sensor-alert-icon">{{ item.severity === "danger" ? "🚨" : "⚠️" }}</text>
              <text class="sensor-alert-text">{{ item.message }}</text>
            </view>
          </view>
        </view>
      </view>
      <view class="px-32 mt-24">
        <view class="card pad">
          <text class="h">养护建议</text>
          <view v-for="(rec, i) in recs" :key="i" class="rec row">
            <view class="num"><text>{{ i + 1 }}</text></view>
            <text class="rec-t">{{ rec }}</text>
          </view>
        </view>
      </view>
      <view class="row gap-16 px-32 mt-24">
        <view class="half card pad act-card" @click="goEdit">
          <text class="h2">✏️ 编辑植物</text>
          <text class="act muted">修改信息 / 绑定传感器</text>
        </view>
        <view class="half card pad act-card" @click="goPlan">
          <text class="h2">📅 养护计划</text>
          <text class="act muted">查看任务排期</text>
        </view>
      </view>
      <view v-if="plantTasks.length" class="px-32 mt-24">
        <view class="card pad">
          <text class="h">近期任务</text>
          <view v-for="task in plantTasks" :key="task.id" class="rec row between">
            <text class="rec-t">{{ taskTypeLabel(task.type) }} · {{ task.status }}</text>
            <view class="row gap-12" v-if="task.status === 'pending'">
              <text class="act" @click="onComplete(task.id)">完成</text>
              <text class="act muted" @click="onSkip(task.id)">跳过</text>
            </view>
          </view>
        </view>
      </view>
      <view class="row gap-16 px-32 mt-24 pb-40">
        <view class="half card pad">
          <text class="h2">📈 近期趋势</text>
          <view class="row gap-12">
            <view v-for="(h, i) in history" :key="i" class="grow hist">
              <text class="hd">{{ h.date }}</text>
              <view class="bars">
                <view class="bar-bg mint"><view class="bar-in" :style="{ width: h.w + '%', backgroundColor: G }" /></view>
                <view class="bar-bg org"><view class="bar-in" :style="{ width: h.l + '%', backgroundColor: '#c47000' }" /></view>
                <view class="bar-bg pur"><view class="bar-in" :style="{ width: h.n + '%', backgroundColor: '#6d4fc4' }" /></view>
              </view>
            </view>
          </view>
        </view>
        <view class="half card pad">
          <text class="h2">☁️ 天气影响</text>
          <view class="wx-line">
            <text :style="{ color: G }">✓</text>
            <text> {{ plant.location }}光照{{ sunPct }}%</text>
          </view>
          <view class="wx-line">
            <text :style="{ color: plant.water >= 50 ? G : '#c47000' }">{{ plant.water >= 50 ? '✓' : '!' }}</text>
            <text> {{ weatherHint }}</text>
          </view>
          <view class="wx-line">
            <text :style="{ color: G }">✓</text>
            <text> 湿度 {{ humidityHint }}</text>
          </view>
        </view>
      </view>
    </scroll-view>
  </view>
  <view v-else class="empty"><text>未找到植物</text></view>
</template>

<script setup>
import { computed, ref } from "vue";
import { onHide, onLoad, onShow, onUnload } from "@dcloudio/uni-app";
import SensorAlertBanner from "../../components/SensorAlertBanner.vue";
import { G } from "../../common/constants.js";
import {
  evaluateSensorAlerts,
  notifyNewSensorAlerts,
} from "../../utils/sensorAlerts.js";
import { startSensorPolling, stopSensorPolling } from "../../utils/sensorPolling.js";
import {
  completeTask,
  fetchPlantDetail,
  fetchPlantSensorSeries,
  findPlant,
  plantStore,
  skipTask,
  taskTypeLabel,
} from "../../common/store.js";

const plant = ref(null);
const plantId = ref("");
const plantTasks = ref([]);
const seriesReadings = ref([]);
const latestReading = ref(null);
const sensorAlerts = ref([]);
const detailLoaded = ref(false);

function goEdit() {
  if (!plantId.value) return;
  uni.navigateTo({ url: `/pages/plant-edit/plant-edit?id=${plantId.value}` });
}
function goPlan() {
  if (!plantId.value) return;
  uni.navigateTo({ url: `/pages/plant-plan/plant-plan?id=${plantId.value}` });
}

const temperatureText = computed(() => {
  const raw = latestReading.value?.tempC;
  if (raw == null) return "--";
  const value = Number(raw);
  return Number.isFinite(value) ? `${value.toFixed(1)}°C` : "--";
});
const humidityText = computed(() => {
  const raw = latestReading.value?.soilMoisture;
  if (raw == null) return "--";
  const value = Number(raw);
  return Number.isFinite(value) ? `${Math.round(value)}%` : "--";
});
const lightText = computed(() => {
  const raw = latestReading.value?.lux;
  if (raw == null) return "--";
  const value = Number(raw);
  return Number.isFinite(value) ? `${Math.round(value)} lx` : "--";
});
const phText = computed(() => {
  const raw = latestReading.value?.phLevel;
  if (raw == null) return "--";
  const value = Number(raw);
  return Number.isFinite(value) ? value.toFixed(1) : "--";
});
const sensorTimeText = computed(() => {
  const measuredAt = latestReading.value?.measuredAt;
  if (!measuredAt) return "暂无传感器数据";
  const date = new Date(measuredAt);
  if (Number.isNaN(date.getTime())) return "最近读数";
  const pad = (value) => String(value).padStart(2, "0");
  return `${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
});

const stText = computed(() => {
  const s = plant.value?.status;
  if (s === "good") return "状态良好";
  if (s === "warning") return "需要关注";
  return "请立即养护";
});
const stStyle = computed(() => {
  const s = plant.value?.status;
  const c = s === "good" ? G : s === "warning" ? "#c47000" : "#c0392b";
  const bg = s === "good" ? "#e2f5ec" : s === "warning" ? "#fff3e0" : "#fef0f0";
  return { color: c, backgroundColor: bg };
});

const recs = computed(() => {
  const p = plant.value;
  if (!p) return [];
  const r = [];
  if (p.water < 50) r.push("建议今日上午浇水约200ml，避免积水");
  if (p.nutrition < 50) r.push("2-3天内补充缓释肥，每盆约5g");
  if (p.light > 85) r.push("今日光照强烈，适当遮阴防晒伤");
  if (!r.length) r.push("植物状态良好，按常规养护即可");
  return r;
});

const history = computed(() => {
  const readings = Array.isArray(seriesReadings.value) ? seriesReadings.value : [];
  if (readings.length) {
    return readings.slice(-3).map((r) => {
      const d = new Date(r.measuredAt);
      const date = Number.isNaN(d.getTime())
        ? "--"
        : `${d.getMonth() + 1}/${d.getDate()}`;
      const w = Math.max(0, Math.min(100, Math.round(Number(r.soilMoisture ?? 50))));
      const l =
        r.lux != null
          ? Math.max(0, Math.min(100, Math.round((Number(r.lux) / 15000) * 100)))
          : plant.value?.light || 60;
      const n =
        r.phLevel != null
          ? Math.max(0, Math.min(100, Math.round(((Number(r.phLevel) - 4) / 5) * 100)))
          : plant.value?.nutrition || 60;
      return { date, w, l, n };
    });
  }
  const p = plant.value;
  if (!p) return [];
  return [
    { date: "D-2", w: Math.max(0, p.water - 15), l: Math.max(0, p.light - 5), n: Math.max(0, p.nutrition - 3) },
    { date: "D-1", w: Math.max(0, p.water - 8), l: p.light, n: Math.max(0, p.nutrition - 1) },
    { date: "今日", w: p.water, l: p.light, n: p.nutrition },
  ];
});

const sunPct = computed(() => Math.round((plant.value?.light || 0) * 0.8));
const weatherHint = computed(() => {
  const t = plantStore.weather?.temperatureC;
  if (t == null) return "暂无天气数据";
  const n = Math.round(Number(t));
  if (n >= 28) return `${n}°C 偏热，蒸发加快`;
  if (n <= 10) return `${n}°C 偏冷，注意保温`;
  return `${n}°C，温度适宜`;
});
const humidityHint = computed(() => {
  const h = plantStore.weather?.relativeHumidity;
  if (h == null) return "--";
  return `${Math.round(Number(h))}%`;
});

async function onComplete(id) {
  try {
    await completeTask(id);
    plantTasks.value = plantTasks.value.filter((t) => t.id !== id);
    uni.showToast({ title: "已完成", icon: "success" });
  } catch {
    uni.showToast({ title: "操作失败", icon: "none" });
  }
}

async function onSkip(id) {
  try {
    await skipTask(id);
    plantTasks.value = plantTasks.value.filter((t) => t.id !== id);
    uni.showToast({ title: "已跳过", icon: "none" });
  } catch {
    uni.showToast({ title: "操作失败", icon: "none" });
  }
}

function applySensorSeries(series) {
  const latest = series?.latest || {};
  latestReading.value = series?.latest || null;
  const readings = series?.readings || series?.points || [];
  seriesReadings.value = Array.isArray(readings) ? readings : [];
  if (!plant.value) return;

  const light =
    latest?.lux != null ? Math.max(0, Math.min(100, Math.round((latest.lux / 15000) * 100))) : (plant.value.light ?? 60);
  const water =
    latest?.soilMoisture != null ? Math.max(0, Math.min(100, Math.round(latest.soilMoisture))) : (plant.value.water ?? 55);
  const phStatus = series?.phEvaluation?.status;
  const nutrition =
    phStatus === "optimal" || phStatus === "ok"
      ? 82
      : !phStatus || phStatus === "unknown"
        ? 60
        : 45;
  sensorAlerts.value = evaluateSensorAlerts({
    plantId: plantId.value,
    plantName: plant.value.name,
    latest: series?.latest,
    phEvaluation: series?.phEvaluation,
    hasDevices: Boolean(series?.devices?.length),
  });
  notifyNewSensorAlerts(sensorAlerts.value);
  const hasDangerAlert = sensorAlerts.value.some((item) => item.severity === "danger");
  const status =
    water < 25 || nutrition < 35 || hasDangerAlert
      ? "danger"
      : water < 45 || nutrition < 55 || sensorAlerts.value.length
        ? "warning"
        : "good";
  plant.value = { ...plant.value, water, light, nutrition, status };
}

async function refreshDetailData() {
  const id = plantId.value;
  if (!id) return;
  try {
    const detail = await fetchPlantDetail(id);
    plantTasks.value = Array.isArray(detail.tasks) ? detail.tasks.slice(0, 8) : [];
    plant.value = {
      id: detail.plant.id,
      name: detail.plant.nickname || detail.plant.speciesLabel || "未命名植物",
      emoji: plant.value?.emoji || "🌱",
      location: detail.plant.indoor ? "室内" : "户外",
      water: plant.value?.water ?? 55,
      light: plant.value?.light ?? 60,
      nutrition: plant.value?.nutrition ?? 60,
      status: plant.value?.status || "good",
      lastCare: plant.value?.lastCare || "近期",
    };
    applySensorSeries(detail.series);
    detailLoaded.value = true;
  } catch {
    // keep cached plant when request fails
  }
}

async function refreshDetailSensors() {
  if (!detailLoaded.value) {
    await refreshDetailData();
    return;
  }
  const series = await fetchPlantSensorSeries(plantId.value);
  if (series) applySensorSeries(series);
}

function detailPollingKey() {
  return `plant-detail:${plantId.value}`;
}

function stopDetailPolling() {
  if (plantId.value) stopSensorPolling(detailPollingKey());
}

onLoad((q) => {
  const id = q?.id;
  plantId.value = id ? String(id) : "";
  plant.value = id ? findPlant(id) : null;
  latestReading.value = plant.value?.sensor || null;
});

onShow(() => {
  if (plantId.value) {
    startSensorPolling(detailPollingKey(), refreshDetailSensors);
  }
});

onHide(stopDetailPolling);
onUnload(stopDetailPolling);
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #f0faf5;
  display: flex;
  flex-direction: column;
}
.scroll {
  flex: 1;
  min-height: 0;
  height: auto;
}
.row {
  display: flex;
  flex-direction: row;
}
.wrap {
  flex-wrap: wrap;
}
.gap-16 {
  gap: 16rpx;
}
.gap-12 {
  gap: 12rpx;
}
.grow {
  flex: 1;
}
.min0 {
  min-width: 0;
}
.px-40 {
  padding-left: 40rpx;
  padding-right: 40rpx;
}
.px-32 {
  padding-left: 32rpx;
  padding-right: 32rpx;
}
.pt-32 {
  padding-top: 32rpx;
}
.pb-40 {
  padding-bottom: 40rpx;
}
.mt-24 {
  margin-top: 24rpx;
}
.mint-block {
  background: #e2f5ec;
}
.top {
  align-items: flex-start;
  gap: 24rpx;
  margin-bottom: 32rpx;
}
.big-emoji {
  width: 128rpx;
  height: 128rpx;
  background: rgba(255, 255, 255, 0.6);
  border-radius: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 72rpx;
  flex-shrink: 0;
}
.p-title {
  font-size: 40rpx;
  font-weight: 700;
  color: #1a3d2b;
}
.st {
  font-size: 22rpx;
  padding: 8rpx 16rpx;
  border-radius: 999rpx;
  font-weight: 600;
}
.meta {
  font-size: 24rpx;
  color: #3a6347;
  display: block;
  margin-top: 8rpx;
}
.sensor-card {
  background: rgba(255, 255, 255, 0.6);
  border-radius: 24rpx;
  padding: 24rpx 32rpx;
}
.sensor-title-row {
  align-items: center;
  margin-bottom: 24rpx;
}
.sensor-title {
  color: #1a3d2b;
  font-size: 25rpx;
  font-weight: 700;
}
.sensor-time {
  color: #7a8d82;
  font-size: 20rpx;
}
.sensor-grid {
  align-items: stretch;
  flex-wrap: wrap;
  gap: 16rpx;
}
.sensor-metric {
  flex: 1 1 calc(50% - 8rpx);
  box-sizing: border-box;
  min-width: 0;
  padding: 20rpx 8rpx;
  border-radius: 18rpx;
  background: rgba(255, 255, 255, 0.72);
  display: flex;
  flex-direction: column;
  align-items: center;
}
.sensor-icon {
  font-size: 34rpx;
}
.sensor-value {
  margin-top: 10rpx;
  color: #1a3d2b;
  font-size: 27rpx;
  font-weight: 700;
  white-space: nowrap;
}
.sensor-label {
  margin-top: 8rpx;
  color: #66776e;
  font-size: 21rpx;
}
.sensor-alert-list {
  margin-top: 20rpx;
  padding-top: 16rpx;
  border-top: 1rpx solid rgba(192, 57, 43, 0.14);
}
.sensor-alert {
  align-items: flex-start;
  gap: 12rpx;
  margin-top: 10rpx;
}
.sensor-alert:first-child {
  margin-top: 0;
}
.sensor-alert-icon {
  font-size: 24rpx;
}
.sensor-alert-text {
  flex: 1;
  color: #a03a2c;
  font-size: 23rpx;
  line-height: 1.45;
}
.card {
  background: #fff;
  border-radius: 24rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
}
.pad {
  padding: 32rpx;
}
.h {
  font-size: 26rpx;
  font-weight: 700;
  color: #1a3d2b;
  display: block;
  margin-bottom: 20rpx;
}
.rec {
  align-items: flex-start;
  gap: 20rpx;
  margin-bottom: 16rpx;
}
.num {
  width: 40rpx;
  height: 40rpx;
  border-radius: 999rpx;
  background: #e2f5ec;
  flex-shrink: 0;
  margin-top: 4rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20rpx;
  font-weight: 700;
  color: #1e7a4a;
}
.rec-t {
  flex: 1;
  font-size: 24rpx;
  color: #424d59;
  line-height: 1.5;
}
.half {
  flex: 1;
  min-width: 0;
}
.act-card {
  min-height: 120rpx;
}
.h2 {
  font-size: 24rpx;
  font-weight: 700;
  color: #1a3d2b;
  display: block;
  margin-bottom: 20rpx;
}
.hist {
  background: #f8faf8;
  border-radius: 16rpx;
  padding: 16rpx;
}
.hd {
  font-size: 18rpx;
  color: #9e9ea7;
  text-align: center;
  display: block;
  margin-bottom: 12rpx;
}
.bars {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}
.bar-bg {
  height: 8rpx;
  border-radius: 8rpx;
  overflow: hidden;
}
.bar-bg.mint {
  background: #e2f5ec;
}
.bar-bg.org {
  background: #fff3e0;
}
.bar-bg.pur {
  background: #f3f0ff;
}
.bar-in {
  height: 100%;
  border-radius: 8rpx;
}
.wx-line {
  font-size: 22rpx;
  color: #424d59;
  line-height: 1.45;
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: flex-start;
  margin-bottom: 16rpx;
}
.act {
  font-size: 22rpx;
  color: #1e7a4a;
  font-weight: 600;
}
.act.muted {
  color: #9e9ea7;
}
.between {
  justify-content: space-between;
  align-items: center;
}
.empty {
  padding: 80rpx;
  text-align: center;
  color: #999;
}
</style>
