<template>
  <view class="page">
    <view class="profile card">
      <view class="avatar">🌿</view>
      <view class="meta">
        <text class="name">{{ user ? 'GreenAI 花友' : '未登录' }}</text>
        <text v-if="user" class="sub">时区 {{ user.timezone }}</text>
        <text v-else class="sub">请先登录以使用完整功能</text>
      </view>
    </view>

    <view v-if="!isLoggedIn" class="card">
      <text class="section-label">开发环境登录</text>
      <view class="dev-login">
        <button class="btn-primary" @tap="onDevLogin">一键创建开发账号</button>
        <text class="divider-text">或</text>
        <input class="token-input" v-model="manualToken" placeholder="粘贴已有 Token" />
        <button class="btn-outline" @tap="onManualToken">使用此 Token</button>
      </view>
    </view>

    <template v-if="isLoggedIn">
      <text class="section-title">时区</text>
      <view class="card">
        <view class="field">
          <text class="label">时区</text>
          <picker mode="selector" :range="tzLabels" :value="tzIndex" @change="onTzChange">
            <view class="picker-value">{{ tzLabels[tzIndex] || '选择时区' }}</view>
          </picker>
        </view>
        <view class="btn-primary btn-inline" @tap="onSaveTz">保存时区</view>
      </view>

      <text class="section-title">室内微气候</text>
      <view class="card">
        <view class="field field--row">
          <text class="label label--inline">长期开空调（偏干）</text>
          <switch color="#43A047" :checked="airConditioning" @change="onAcChange" />
        </view>
        <view class="field">
          <text class="label">窗台 / 主采光朝向</text>
          <picker mode="selector" :range="aspectLabels" :value="aspectIndex" @change="onAspectChange">
            <view class="picker-value">{{ aspectLabels[aspectIndex] || '选择朝向' }}</view>
          </picker>
        </view>
        <view class="btn-primary btn-inline btn-secondary" @tap="onSaveEnv">保存环境偏好</view>
      </view>

      <text class="section-title">天气与环境</text>
      <view class="card">
        <view v-if="currentLive" class="live-weather">
          <view class="live-icon">
            <text class="live-emoji">{{ liveEmoji }}</text>
          </view>
          <view class="live-texts">
            <text class="live-temp">{{ currentLive.tempC }}°C</text>
            <text class="live-sub">湿度 {{ currentLive.rh }}%</text>
          </view>
        </view>
        <view v-if="forecastDays.length" class="forecast">
          <text class="forecast-title">未来 3 日 · 气温示意</text>
          <view class="forecast-row">
            <view v-for="d in forecastDays" :key="d.date" class="forecast-day">
              <text class="forecast-dm">{{ d.dateShort }}</text>
              <text class="forecast-day-emoji">{{ d.emoji }}</text>
              <view class="forecast-bar-track">
                <view class="forecast-bar-fill" :style="{ height: d.barFillRpx + 'rpx' }"></view>
              </view>
              <text class="forecast-hilo">{{ d.lo }}° / {{ d.hi }}°</text>
            </view>
          </view>
        </view>
        <view class="field">
          <text class="label">已保存位置</text>
          <text v-if="locSummary" class="mono">{{ locSummary }}</text>
          <text v-else class="muted">未设置</text>
        </view>
        <view class="btn-row">
          <view class="btn-primary btn-small" @tap="onPickLocation">使用当前定位</view>
          <view class="btn-ghost btn-small" @tap="onClearLocation">清除位置</view>
        </view>
      </view>

      <text class="section-title">传感器绑定码</text>
      <view class="card">
        <view v-if="bindCode" class="bind-code-display">
          <text class="bind-code">{{ bindCode }}</text>
          <text class="bind-expires">有效期至 {{ bindExpiresText }}</text>
        </view>
        <view class="btn-primary btn-inline" @tap="onCreateBindCode" :loading="bindLoading">
          {{ bindCode ? '重新生成' : '生成绑定码' }}
        </view>
      </view>

      <text class="section-title">我的设备</text>
      <view class="card">
        <view v-if="devices.length === 0" class="muted">暂无绑定设备</view>
        <view v-for="d in devices" :key="d.id" class="device-row">
          <text class="device-hwid">{{ d.hardwareId }}</text>
          <text v-if="d.label" class="device-label">{{ d.label }}</text>
          <text class="device-status">{{ d.lastSeenAt ? '最近在线' : '未上线' }}</text>
        </view>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { request, getToken, setToken } from "@/utils/request";

interface UserMe {
  id: string;
  timezone: string;
  latitude: number | null;
  longitude: number | null;
  locationLabel: string | null;
  airConditioning: boolean;
  windowAspect: string;
}

const user = ref<UserMe | null>(null);
const manualToken = ref("");
const airConditioning = ref(false);
const aspectIndex = ref(0);
const tzIndex = ref(0);
const currentLive = ref<any>(null);
const forecastDays = ref<any[]>([]);
const bindCode = ref("");
const bindExpiresText = ref("");
const bindLoading = ref(false);
const loggedIn = ref(!!getToken());
const devices = ref<any[]>([]);

const aspectKeys = ["unknown", "north", "south", "east", "west"];
const aspectLabels = ["未知", "北", "南", "东", "西"];
const tzLabels = [
  "Asia/Shanghai", "Asia/Tokyo", "Asia/Seoul", "Asia/Hong_Kong",
  "Asia/Singapore", "Asia/Taipei", "America/New_York", "America/Chicago",
  "America/Los_Angeles", "Europe/London", "Europe/Berlin", "Europe/Paris",
  "Australia/Sydney", "Pacific/Auckland",
];

const isLoggedIn = computed(() => loggedIn.value);
const locSummary = computed(() => {
  if (!user.value) return "";
  if (user.value.latitude && user.value.longitude) {
    return `${user.value.latitude.toFixed(4)}, ${user.value.longitude.toFixed(4)}`;
  }
  return "";
});

const liveEmoji = computed(() => {
  if (!currentLive.value) return "☀️";
  const code = currentLive.value.wmoCode ?? 0;
  if (code === 0) return "☀️";
  if (code <= 3) return "⛅";
  if (code <= 48) return "🌫️";
  if (code <= 67) return "🌧️";
  if (code <= 86) return "🌨️";
  return "⛈️";
});

async function loadMeAndWeather() {
  if (!getToken()) return;
  try {
    const me: UserMe = await request({ path: "/users/me" });
    user.value = me;
    airConditioning.value = me.airConditioning;
    aspectIndex.value = Math.max(0, aspectKeys.indexOf(me.windowAspect));
    tzIndex.value = Math.max(0, tzLabels.indexOf(me.timezone));

    if (me.latitude && me.longitude) {
      Promise.allSettled([loadWeather(), loadForecast()]);
    }
  } catch {}
  loadDevices();
}

async function loadDevices() {
  try {
    devices.value = await request({ path: "/devices" });
  } catch {}
}

async function loadWeather() {
  if (!user.value?.latitude || !user.value?.longitude) return;
  try {
    const data: any = await request({ path: "/weather/current" });
    if (data?.error === "no_location") return;
    currentLive.value = { tempC: data.temperatureC, rh: data.relativeHumidity, wmoCode: data.weatherCode };
  } catch {}
}

async function loadForecast() {
  if (!user.value?.latitude || !user.value?.longitude) return;
  try {
    const data: any = await request({ path: "/weather/forecast" });
    const days = (data.days || []).slice(0, 3).map((d: any) => {
      const dShort = d.date?.slice(5) || "";
      const hi = Math.round(d.temperature2mMax ?? d.temperatureMax ?? 0);
      const lo = Math.round(d.temperature2mMin ?? d.temperatureMin ?? 0);
      const barFillRpx = Math.max(20, Math.min(160, (hi - lo + 10) * 6));
      const wmoCode = d.weatherCode ?? 0;
      const wmoEmoji = wmoCode === 0 ? "☀️" : wmoCode <= 3 ? "⛅" : wmoCode <= 48 ? "🌫️" : wmoCode <= 67 ? "🌧️" : wmoCode <= 86 ? "🌨️" : "⛈️";
      return { date: d.date, dateShort: dShort, hi, lo, barFillRpx, wmoCode, emoji: wmoEmoji };
    });
    forecastDays.value = days;
  } catch {}
}

async function onDevLogin() {
  try {
    const data: any = await request({ path: "/auth/dev", method: "POST" });
    setToken(data.token);
    loggedIn.value = true;
    uni.showToast({ title: "登录成功", icon: "success" });
    loadMeAndWeather();
  } catch {
    uni.showToast({ title: "登录失败", icon: "none" });
  }
}

function onManualToken() {
  const t = manualToken.value.trim();
  if (!t) {
    uni.showToast({ title: "请输入 Token", icon: "none" });
    return;
  }
  setToken(t);
  loggedIn.value = true;
  uni.showToast({ title: "Token 已设置", icon: "success" });
  loadMeAndWeather();
}

function onTzChange(e: any) {
  tzIndex.value = e.detail?.value ?? 0;
}

async function onSaveTz() {
  const tz = tzLabels[tzIndex.value];
  if (!tz) return;
  try {
    const data: any = await request({ path: "/users/me", method: "PATCH", data: { timezone: tz } });
    user.value = data;
    uni.showToast({ title: "已保存", icon: "success" });
  } catch {
    uni.showToast({ title: "保存失败", icon: "none" });
  }
}

function onAcChange(e: any) {
  airConditioning.value = e.detail?.value ?? false;
}

function onAspectChange(e: any) {
  aspectIndex.value = e.detail?.value ?? 0;
}

async function onSaveEnv() {
  try {
    const data: any = await request({
      path: "/users/me",
      method: "PATCH",
      data: {
        airConditioning: airConditioning.value,
        windowAspect: aspectKeys[aspectIndex.value],
      },
    });
    user.value = data;
    uni.showToast({ title: "已保存", icon: "success" });
  } catch {
    uni.showToast({ title: "保存失败", icon: "none" });
  }
}

async function onPickLocation() {
  try {
    const loc: any = await new Promise((resolve, reject) => {
      uni.getLocation({
        type: "wgs84",
        success: resolve,
        fail: reject,
      });
    });
    const data: any = await request({
      path: "/users/me",
      method: "PATCH",
      data: { latitude: loc.latitude, longitude: loc.longitude },
    });
    user.value = data;
    uni.showToast({ title: "位置已更新", icon: "success" });
    loadWeather();
    loadForecast();
  } catch {
    uni.showToast({ title: "获取位置失败", icon: "none" });
  }
}

async function onClearLocation() {
  uni.showModal({
    title: "确认清除",
    content: "确定要清除位置信息吗？",
    success: async (res) => {
      if (res.confirm) {
        try {
          const data: any = await request({
            path: "/users/me",
            method: "PATCH",
            data: { clearLocation: true },
          });
          user.value = data;
          currentLive.value = null;
          forecastDays.value = [];
          uni.showToast({ title: "已清除", icon: "success" });
        } catch {
          uni.showToast({ title: "操作失败", icon: "none" });
        }
      }
    },
  });
}

async function onCreateBindCode() {
  bindLoading.value = true;
  try {
    const data: any = await request({ path: "/devices/binding-codes", method: "POST" });
    bindCode.value = data.code;
    const exp = new Date(data.expiresAt);
    bindExpiresText.value = `${exp.getHours().toString().padStart(2, "0")}:${exp.getMinutes().toString().padStart(2, "0")}`;
  } catch {
    uni.showToast({ title: "生成失败", icon: "none" });
  } finally {
    bindLoading.value = false;
  }
}

onShow(() => {
  loggedIn.value = !!getToken();
  loadMeAndWeather();
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
  padding: 32rpx;
  margin-bottom: 24rpx;
}
.profile {
  display: flex;
  align-items: center;
  gap: 28rpx;
}
.avatar {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  background: #e8f5e9;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 52rpx;
}
.meta { flex: 1; }
.name {
  font-size: 40rpx;
  font-weight: 800;
  color: #212121;
  display: block;
  margin-bottom: 8rpx;
}
.sub {
  font-size: 24rpx;
  color: #9e9e9e;
}
.section-title {
  font-size: 24rpx;
  font-weight: 700;
  color: #9e9e9e;
  text-transform: uppercase;
  margin: 16rpx 0 8rpx;
  letter-spacing: 2rpx;
}
.section-label {
  font-size: 28rpx;
  font-weight: 700;
  color: #212121;
  display: block;
  margin-bottom: 16rpx;
}
.dev-login {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.divider-text {
  text-align: center;
  font-size: 24rpx;
  color: #bdbdbd;
}
.token-input {
  border: 2rpx solid #e0e0e0;
  border-radius: 12rpx;
  padding: 16rpx 20rpx;
  font-size: 24rpx;
}
.field {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16rpx 0;
  border-bottom: 1rpx solid #f5f5f5;
}
.field:last-of-type { border-bottom: none; }
.field--row { flex-direction: row; }
.label {
  font-size: 28rpx;
  color: #616161;
}
.label--inline { font-size: 26rpx; }
.picker-value {
  font-size: 28rpx;
  color: #212121;
}
.mono {
  font-size: 24rpx;
  font-family: monospace;
  color: #616161;
}
.muted {
  font-size: 24rpx;
  color: #9e9e9e;
}
.btn-primary {
  background: #43a047;
  color: #fff;
  border-radius: 12rpx;
  padding: 20rpx 32rpx;
  text-align: center;
  font-size: 28rpx;
  font-weight: 600;
}
.btn-outline {
  background: transparent;
  border: 2rpx solid #43a047;
  color: #43a047;
  border-radius: 12rpx;
  padding: 20rpx 32rpx;
  text-align: center;
  font-size: 28rpx;
  font-weight: 600;
}
.btn-secondary { margin-top: 8rpx; }
.btn-inline { margin-top: 12rpx; }
.btn-row {
  display: flex;
  gap: 12rpx;
  margin-top: 12rpx;
}
.btn-small {
  flex: 1;
  padding: 14rpx 20rpx;
  font-size: 24rpx;
}
.btn-ghost {
  background: #f5f5f5;
  color: #616161;
  border-radius: 12rpx;
  padding: 14rpx 20rpx;
  text-align: center;
  font-size: 24rpx;
}
.live-weather {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 8rpx 0;
}
.live-icon { width: 80rpx; height: 80rpx; display: flex; align-items: center; justify-content: center; }
.live-emoji { font-size: 64rpx; }
.live-texts { flex: 1; }
.live-temp {
  font-size: 48rpx;
  font-weight: 800;
  color: #212121;
  display: block;
}
.live-sub {
  font-size: 24rpx;
  color: #616161;
}
.forecast {
  margin-top: 20rpx;
  padding-top: 20rpx;
  border-top: 1rpx solid #f5f5f5;
}
.forecast-title {
  font-size: 24rpx;
  color: #9e9e9e;
  display: block;
  margin-bottom: 16rpx;
}
.forecast-row {
  display: flex;
  gap: 24rpx;
  justify-content: center;
}
.forecast-day {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
}
.forecast-dm {
  font-size: 24rpx;
  color: #616161;
}
.forecast-day-emoji {
  font-size: 36rpx;
}
.forecast-bar-track {
  width: 20rpx;
  height: 180rpx;
  background: #f5f5f5;
  border-radius: 10rpx;
  display: flex;
  flex-direction: column-reverse;
  overflow: hidden;
}
.forecast-bar-fill {
  width: 100%;
  background: linear-gradient(to top, #90caf9, #43a047);
  border-radius: 10rpx;
  transition: height 0.3s;
}
.forecast-hilo {
  font-size: 22rpx;
  color: #9e9e9e;
}
.bind-code-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
  margin-bottom: 16rpx;
}
.bind-code {
  font-size: 36rpx;
  font-weight: 800;
  font-family: monospace;
  color: #212121;
  letter-spacing: 4rpx;
}
.bind-expires {
  font-size: 22rpx;
  color: #9e9e9e;
}
.device-row {
  display: flex;
  align-items: center;
  padding: 14rpx 0;
  border-bottom: 1rpx solid #f5f5f5;
  gap: 12rpx;
}
.device-row:last-child { border-bottom: none; }
.device-hwid {
  font-size: 24rpx;
  font-family: monospace;
  color: #212121;
  flex: 1;
}
.device-label {
  font-size: 24rpx;
  color: #616161;
}
.device-status {
  font-size: 22rpx;
  color: #9e9e9e;
}
.muted {
  font-size: 24rpx;
  color: #9e9e9e;
  display: block;
}
</style>
