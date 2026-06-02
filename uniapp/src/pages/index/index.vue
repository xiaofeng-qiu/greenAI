<template>
  <view class="page">
    <view v-if="weatherCurrent" class="card weather" @tap="goSettings">
      <view class="weather-row">
        <view class="col">
          <text class="date">{{ dateLine }} · {{ weekday }}</text>
          <text class="big-temp">{{ weatherCurrent.temperatureC }}°C</text>
          <text class="sub">湿度 {{ weatherCurrent.relativeHumidity }}%</text>
          <text v-if="weatherSummary" class="cond">{{ weatherSummary }}</text>
        </view>
        <view class="weather-icon-wrap">
          <text class="weather-emoji">{{ weatherEmoji }}</text>
        </view>
      </view>
    </view>
    <view v-else class="card weather" @tap="goSettings">
      <view class="weather-row">
        <view class="col">
          <text class="date">{{ dateLine }}</text>
          <text class="big-temp">--°C</text>
          <text class="sub hint-link">去「我」页设置定位后显示天气</text>
        </view>
      </view>
    </view>

    <text class="section-title">待办事项</text>
    <view class="card row">
      <view class="donut" @tap="goCare">
        <view class="donut-ring donut-ring--water">
          <text class="num">{{ waterCount }}</text>
        </view>
        <text class="cap">{{ waterCountText }}</text>
      </view>
      <view class="donut" @tap="goCare">
        <view class="donut-ring donut-ring--fert">
          <text class="num">{{ fertilizeCount }}</text>
        </view>
        <text class="cap">{{ fertilizeCountText }}</text>
      </view>
    </view>

    <text class="section-title">我的植物</text>
    <view v-if="plantStrip.length" class="plant-strip">
      <view
        v-for="p in plantStrip"
        :key="p.id"
        class="plant-chip"
        @tap="goPlantEdit(p.id)"
      >
        <image v-if="p.photo" class="plant-chip__photo" :src="p.photo" mode="aspectFill"></image>
        <view v-else class="plant-chip__avatar">{{ p.avatarLetter }}</view>
        <text class="plant-chip__name">{{ p.nickname }}</text>
      </view>
    </view>
    <view v-else class="card hint-card">
      <text class="hint-text">还没有植物，去「养护」添加</text>
    </view>

    <text class="section-title">常用工具</text>
    <view class="card tools">
      <view class="tool" @tap="onIdentify"><text class="ico">🌼</text><text>植物识别</text></view>
      <view class="tool" @tap="onSoil"><text class="ico">🪴</text><text>土壤识别</text></view>
      <view class="tool" @tap="onDiagnose"><text class="ico">🐛</text><text>病虫害诊断</text></view>
    </view>

    <view v-if="identifyResult" class="card result-card">
      <view class="result-head">
        <text class="result-title">🌼 识别结果</text>
        <text class="result-close" @tap="clearIdentifyResult">✕</text>
      </view>
      <text class="result-species">品种：{{ identifyResult.speciesLabel }}</text>
      <text v-if="identifyResult.confidence" class="result-conf">置信度：{{ identifyResult.confidence }}%</text>
      <text v-if="identifyResult.description" class="result-desc">{{ identifyResult.description }}</text>
    </view>

    <view v-if="soilResult" class="card result-card result-card--soil">
      <view class="result-head">
        <text class="result-title">🪴 土壤评估</text>
        <text class="result-close" @tap="clearSoilResult">✕</text>
      </view>
      <view class="soil-row">
        <text class="soil-label">干湿度</text>
        <text :class="['soil-tag', 'soil-tag--' + soilResult.moistureKey]">{{ soilResult.moistureLabel }}</text>
        <text v-if="soilResult.confidence" class="soil-conf">置信度 {{ soilResult.confidence }}%</text>
      </view>
      <view class="soil-row">
        <text class="soil-label">肥力</text>
        <text class="soil-tag soil-tag--fertility">{{ soilResult.fertilityLabel }}</text>
      </view>
      <view v-if="soilResult.rationale" class="soil-block">
        <text class="soil-subtitle">分析依据</text>
        <text class="soil-text">{{ soilResult.rationale }}</text>
      </view>
      <view v-if="soilResult.wateringTip" class="soil-block">
        <text class="soil-subtitle">养护建议</text>
        <text class="soil-text soil-tip">{{ soilResult.wateringTip }}</text>
      </view>
    </view>

    <view v-if="tasks.length" class="section-title">今日任务</view>
    <view v-for="t in tasks" :key="t.id" class="card task-card">
      <view class="task-head">
        <view :class="['badge', 'badge--' + t.typeClass]">{{ t.displayType }}</view>
        <text class="task-time">{{ t.displayTime }}</text>
      </view>
      <text class="task-plant">{{ t.plantNickname }}</text>
      <view class="task-foot">
        <view class="pill pill--primary" :data-id="t.id" @tap="onComplete(t.id)">标记完成</view>
        <view class="pill pill--quiet" :data-id="t.id" @tap="onSkip(t.id)">跳过</view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { request, getToken, clearToken } from "@/utils/request";
import { chooseImageBase64 } from "@/utils/image";

interface WeatherCurrent {
  temperatureC: number;
  relativeHumidity: number;
  weatherCode: number;
}
interface Plant {
  id: string;
  nickname: string;
  speciesLabel: string;
}
interface CareTask {
  id: string;
  plantId: string;
  plantNickname: string;
  type: string;
  dueDate: string;
  displayType: string;
  displayTime: string;
  typeClass: string;
}

const IDENTIFY_KEY = "identifyResult";
const SOIL_KEY = "soilResult";

const weatherCurrent = ref<WeatherCurrent | null>(null);
const weatherSummary = ref("");
const plants = ref<Plant[]>([]);
const tasks = ref<CareTask[]>([]);
const identifyResult = ref<any>(null);
const soilResult = ref<any>(null);

function loadStoredResults() {
  try {
    const saved = uni.getStorageSync(IDENTIFY_KEY);
    if (saved) identifyResult.value = typeof saved === "string" ? JSON.parse(saved) : saved;
  } catch {}
  try {
    const saved = uni.getStorageSync(SOIL_KEY);
    if (saved) soilResult.value = typeof saved === "string" ? JSON.parse(saved) : saved;
  } catch {}
}

const now = new Date();
const weekdayNames = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const dateLine = computed(() => {
  const d = new Date();
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
});
const weekday = computed(() => weekdayNames[now.getDay()]);

const waterCount = computed(() => tasks.value.filter(t => t.typeClass === "water").length);
const fertilizeCount = computed(() => tasks.value.filter(t => t.typeClass === "fertilize").length);
const waterCountText = computed(() => waterCount.value ? `${waterCount.value}株植物需要浇水` : "暂无浇水任务");
const fertilizeCountText = computed(() => fertilizeCount.value ? `${fertilizeCount.value}株植物需要施肥` : "暂无施肥任务");

const plantStrip = computed(() => {
  return plants.value.slice(0, 12).map(p => {
    let photo = "";
    try { photo = uni.getStorageSync("plantPhoto_" + p.id) || ""; } catch {}
    return { ...p, photo, avatarLetter: p.nickname.charAt(0) };
  });
});

const weatherEmoji = computed(() => {
  if (!weatherCurrent.value) return "☀️";
  const code = weatherCurrent.value.weatherCode;
  if (code === 0) return "☀️";
  if (code <= 3) return "⛅";
  if (code <= 48) return "🌫️";
  if (code <= 57) return "🌦️";
  if (code <= 67) return "🌧️";
  if (code <= 77) return "🌨️";
  if (code <= 82) return "🌧️";
  if (code <= 86) return "🌨️";
  return "⛈️";
});

async function loadDashboard() {
  if (!getToken()) return;
  try {
    await Promise.all([loadTasks(), loadPlants()]);
  } catch {}
  try {
    const me: any = await request({ path: "/users/me" });
    if (me.latitude && me.longitude) await loadWeather();
  } catch {}
}

async function loadTasks() {
  try {
    const data: any[] = await request({ path: "/tasks/today" });
    tasks.value = data.map(t => {
      const dt = new Date(t.dueDate);
      const typeMap: Record<string, string> = { water: "浇水", fertilize: "施肥", repot: "换盆", inspect: "检查" };
      return {
        ...t,
        plantNickname: t.plant?.nickname || "",
        displayType: typeMap[t.type] || t.type,
        displayTime: `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`,
        typeClass: t.type,
      };
    });
  } catch {}
}

async function loadPlants() {
  try {
    plants.value = await request({ path: "/plants" });
  } catch {}
}

async function loadWeather() {
  try {
    const data: any = await request({ path: "/weather/current" });
    weatherCurrent.value = data;
    weatherSummary.value = describeWeather(data.weatherCode);
  } catch {}
}

function describeWeather(code: number): string {
  if (code === 0) return "晴朗";
  if (code <= 3) return "多云";
  if (code <= 48) return "雾";
  if (code <= 57) return "毛毛雨";
  if (code <= 67) return "雨";
  if (code <= 77) return "雪";
  if (code <= 82) return "阵雨";
  if (code <= 86) return "阵雪";
  return "暴风雨";
}

function goSettings() {
  uni.switchTab({ url: "/pages/me/me" });
}
function goCare() {
  uni.switchTab({ url: "/pages/care/care" });
}
function goPlantEdit(id: string) {
  uni.navigateTo({ url: "/pages/care/care" });
}
async function onIdentify() {
  try {
    const base64 = await chooseImageBase64();
    uni.showLoading({ title: "识别中", mask: true });
    const data: any = await request({ path: "/plants/identify", method: "POST", data: { imageBase64: base64 } });
    const best = data?.best;
    if (!best || !best.name) {
      uni.showToast({ title: "未识别到植物", icon: "none" });
      return;
    }
    const result = {
      speciesLabel: best.name,
      confidence: best.score || "",
      description: best.baikeDescription || best.careSummary || "已识别到品种",
    };
    identifyResult.value = result;
    uni.setStorageSync(IDENTIFY_KEY, result);
    uni.showToast({ title: "识别成功", icon: "success" });
  } catch (e: any) {
    const code = e?.statusCode;
    const msg = e?.message || e?.errMsg || "";
    if (msg.includes("file_read_failed")) uni.showToast({ title: "读取图片失败", icon: "none" });
    else if (msg.includes("cancel") || msg.includes("no_image")) { /* user cancelled, no toast */ }
    else if (code === 503) uni.showToast({ title: "服务端未配置识别", icon: "none" });
    else if (code === 422) uni.showToast({ title: "未识别到植物", icon: "none" });
    else if (code === 502) uni.showToast({ title: "识别服务异常", icon: "none" });
    else if (code === 400) uni.showToast({ title: "图片数据异常", icon: "none" });
    else if (code === 401) { clearToken(); uni.showToast({ title: "登录失效，请重新登录", icon: "none" }); }
    else if (code === 0 || !code) uni.showToast({ title: "网络连接失败，请检查服务器", icon: "none" });
    else uni.showToast({ title: `识别失败（${code}）`, icon: "none" });
  } finally {
    uni.hideLoading();
  }
}

async function onSoil() {
  try {
    const base64 = await chooseImageBase64();
    uni.showLoading({ title: "分析中", mask: true });
    const data: any = await request({ path: "/soil/estimate-photo", method: "POST", data: { imageBase64: base64 } });
    const moistureMap: Record<string, string> = { very_wet: "很湿", wet: "偏湿", moderate: "适中", dry: "偏干", very_dry: "很干" };
    const moistureKey = data?.soilMoistureHint || "moderate";
    const result = {
      moistureKey,
      moistureLabel: moistureMap[moistureKey] || moistureKey,
      fertilityLabel: data?.soilFertilityHint || "未知",
      rationale: data?.rationale || "",
      wateringTip: data?.wateringTip || "",
      confidence: data?.confidence ? Math.round(data.confidence * 100) : 0,
    };
    soilResult.value = result;
    uni.setStorageSync(SOIL_KEY, result);
    uni.showToast({ title: "分析完成", icon: "success" });
  } catch (e: any) {
    const code = e?.statusCode;
    const detail = e?.data?.detail || "";
    if (code === 503) uni.showToast({ title: "未启用 AI 诊断", icon: "none" });
    else if (code === 502) uni.showToast({ title: detail || "AI 服务异常", icon: "none" });
    else uni.showToast({ title: "请求失败", icon: "none" });
  } finally {
    uni.hideLoading();
  }
}

function onDiagnose() {
  uni.navigateTo({ url: "/pages/diagnose/diagnose" });
}

function clearIdentifyResult() {
  identifyResult.value = null;
  uni.removeStorageSync(IDENTIFY_KEY);
}

function clearSoilResult() {
  soilResult.value = null;
  uni.removeStorageSync(SOIL_KEY);
}
async function onComplete(taskId: string) {
  try {
    await request({ path: `/tasks/${taskId}/complete`, method: "POST" });
    tasks.value = tasks.value.filter(t => t.id !== taskId);
    uni.showToast({ title: "已完成", icon: "success" });
  } catch {
    uni.showToast({ title: "操作失败", icon: "none" });
  }
}
async function onSkip(taskId: string) {
  try {
    await request({ path: `/tasks/${taskId}/skip`, method: "POST", data: {} });
    tasks.value = tasks.value.filter(t => t.id !== taskId);
    uni.showToast({ title: "已跳过", icon: "success" });
  } catch {
    uni.showToast({ title: "操作失败", icon: "none" });
  }
}

onShow(() => {
  loadDashboard();
  loadStoredResults();
});
</script>

<style scoped>
.page {
  padding: 24rpx;
  padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
}
.card {
  background: #fff;
  border-radius: 20rpx;
  border: 1rpx solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.04);
  padding: 28rpx;
  margin-bottom: 24rpx;
}
.weather-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.col { flex: 1; }
.date {
  font-size: 24rpx;
  color: #9e9e9e;
  display: block;
  margin-bottom: 8rpx;
}
.big-temp {
  font-size: 56rpx;
  font-weight: 800;
  color: #212121;
}
.sub {
  font-size: 24rpx;
  color: #616161;
  display: block;
  margin-top: 8rpx;
}
.hint-link {
  color: #43a047;
  text-decoration: underline;
}
.cond {
  font-size: 26rpx;
  color: #43a047;
  display: block;
  margin-top: 8rpx;
  font-weight: 600;
}
.weather-icon-wrap {
  width: 120rpx;
  height: 120rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
.weather-emoji {
  font-size: 80rpx;
}
.section-title {
  font-size: 32rpx;
  font-weight: 700;
  margin: 16rpx 0;
  color: #212121;
}
.row {
  display: flex;
  justify-content: space-around;
}
.donut {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
}
.donut-ring {
  width: 160rpx;
  height: 160rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.donut-ring--water {
  border: 12rpx solid #90caf9;
  background: #e3f2fd;
}
.donut-ring--fert {
  border: 12rpx solid #ffcc80;
  background: #fff3e0;
}
.num {
  font-size: 44rpx;
  font-weight: 800;
}
.cap {
  font-size: 22rpx;
  color: #616161;
  text-align: center;
}
.plant-strip {
  display: flex;
  gap: 16rpx;
  overflow-x: auto;
  padding: 8rpx 0;
  margin-bottom: 24rpx;
}
.plant-chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
  min-width: 100rpx;
}
.plant-chip__avatar,
.plant-chip__photo {
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  background: #e8f5e9;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36rpx;
  font-weight: 700;
  color: #43a047;
}
.plant-chip__name {
  font-size: 22rpx;
  color: #616161;
  text-align: center;
}
.hint-card {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 80rpx;
}
.hint-text {
  font-size: 24rpx;
  color: #9e9e9e;
}
.tools {
  display: flex;
  gap: 16rpx;
}
.tool {
  flex: 1;
  text-align: center;
  padding: 20rpx 8rpx;
  background: #f5f5f5;
  border-radius: 16rpx;
  font-size: 22rpx;
  color: #616161;
}
.ico {
  display: block;
  font-size: 40rpx;
  margin-bottom: 8rpx;
}
.task-card {
  margin-bottom: 16rpx;
}
.task-head {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 8rpx;
}
.badge {
  padding: 4rpx 16rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
  font-weight: 600;
}
.badge--water { background: #e3f2fd; color: #1565c0; }
.badge--fertilize { background: #fff3e0; color: #e65100; }
.badge--repot { background: #f3e5f5; color: #7b1fa2; }
.badge--inspect { background: #e8f5e9; color: #2e7d32; }
.task-time {
  font-size: 22rpx;
  color: #9e9e9e;
}
.task-plant {
  font-size: 28rpx;
  font-weight: 600;
  color: #212121;
  display: block;
  margin-bottom: 12rpx;
}
.task-foot {
  display: flex;
  gap: 12rpx;
}
.pill {
  padding: 8rpx 24rpx;
  border-radius: 999rpx;
  font-size: 24rpx;
  font-weight: 600;
}
.pill--primary {
  background: #43a047;
  color: #fff;
}
.pill--quiet {
  background: #f5f5f5;
  color: #616161;
}
.result-card {
  background: #f8f6f0;
  border: 1rpx solid rgba(139, 119, 90, 0.2);
}
.result-card--soil {
  background: #f8f6f0;
}
.result-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
}
.result-title {
  font-size: 28rpx;
  font-weight: 800;
  color: #5d4a2e;
}
.result-close {
  font-size: 28rpx;
  color: #9e9e9e;
  padding: 8rpx;
}
.result-species {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: #212121;
  margin-bottom: 8rpx;
}
.result-conf {
  display: block;
  font-size: 24rpx;
  color: #616161;
  margin-bottom: 8rpx;
}
.result-desc {
  display: block;
  font-size: 26rpx;
  color: #616161;
  line-height: 1.55;
}
.soil-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 12rpx;
  flex-wrap: wrap;
}
.soil-label {
  font-size: 26rpx;
  color: #9e9e9e;
  font-weight: 600;
  min-width: 5em;
}
.soil-tag {
  display: inline-flex;
  align-items: center;
  padding: 4rpx 18rpx;
  border-radius: 999rpx;
  font-size: 24rpx;
  font-weight: 700;
}
.soil-tag--very_wet, .soil-tag--wet { background: #d4edda; color: #155724; }
.soil-tag--moderate { background: #fff3cd; color: #856404; }
.soil-tag--dry, .soil-tag--very_dry { background: #f8d7da; color: #721c24; }
.soil-tag--fertility { background: #e2e3f0; color: #383d6e; }
.soil-conf {
  font-size: 22rpx;
  color: #9e9e9e;
}
.soil-block {
  margin-top: 16rpx;
  padding-top: 14rpx;
  border-top: 1rpx solid #e0e0e0;
}
.soil-subtitle {
  display: block;
  font-size: 26rpx;
  font-weight: 700;
  color: #212121;
  margin-bottom: 8rpx;
}
.soil-text {
  display: block;
  font-size: 24rpx;
  color: #616161;
  line-height: 1.6;
}
.soil-tip {
  padding: 14rpx 18rpx;
  background: #f0f9f4;
  border-radius: 12rpx;
  color: #2d6a4f;
}
</style>
