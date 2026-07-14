<template>
  <scroll-view scroll-y class="scroll" :show-scrollbar="false">
    <view class="header">
      <text class="h1">个人中心</text>
      <view class="row user">
        <view class="avatar">🌿</view>
        <view class="grow min0">
          <text class="name">{{ profileName }}</text>
          <text class="loc">📍 {{ locationText }}</text>
          <view class="row badges">
            <text class="b1">养护达人</text>
            <text class="b2">{{ plantCount }}株植物</text>
          </view>
        </view>
      </view>
    </view>
    <view class="stats-wrap px-40">
      <view class="stats row">
        <view class="cell grow">
          <text class="v green">{{ careDays }}</text>
          <text class="l">养护天数</text>
        </view>
        <view class="cell grow border-l">
          <text class="v green">{{ plantCount }}</text>
          <text class="l">我的植物</text>
        </view>
        <view class="cell grow border-l">
          <text class="v green">{{ healthRateText }}</text>
          <text class="l">健康率</text>
        </view>
      </view>
    </view>
    <view class="sec px-40">
      <text class="sec-t">位置与天气</text>
      <view class="card">
        <view class="cell-btn row" @click="onPickLocation">
          <view class="ico bg-m">📍</view>
          <text class="lbl grow">当前位置</text>
          <text class="val">{{ locationShortText }}</text>
          <text class="chev">›</text>
        </view>
        <view class="cell-btn row" @click="onWeatherRowTap">
          <view class="ico bg-b">⚙️</view>
          <text class="lbl grow">天气数据源</text>
          <text class="val">{{ weatherRowText }}</text>
          <text class="chev">›</text>
        </view>
      </view>
    </view>
    <view class="sec px-40">
      <text class="sec-t">通知设置</text>
      <view class="card">
        <view class="cell-btn row" @click="toggleNotifications">
          <view class="ico bg-o">🔔</view>
          <text class="lbl grow">养护提醒</text>
          <view class="sw" :class="{ on: notifications }"><view class="knob" /></view>
        </view>
        <view class="cell-btn row" @click="toggleWeatherAlerts">
          <view class="ico bg-b">🔔</view>
          <text class="lbl grow">天气预警</text>
          <view class="sw" :class="{ on: weatherAlerts }"><view class="knob" /></view>
        </view>
      </view>
    </view>
    <view class="sec px-40">
      <text class="sec-t">连接设置</text>
      <view class="card">
        <view class="cell-btn row" @click="onOpenApiConfig">
          <view class="ico bg-b">🌐</view>
          <text class="lbl grow">后端 API 地址</text>
          <text class="val api-val">{{ apiAddressText }}</text>
          <text class="chev">›</text>
        </view>
      </view>
    </view>
    <view class="sec px-40">
      <text class="sec-t">传感器绑定码</text>
      <view class="card">
        <view class="cell-btn">
          <text class="desc">在设备配网页填写绑定码，设备联网后即可完成账户关联。</text>
          <view class="code-actions row">
            <view class="mini-btn" :class="{ disabled: bindLoading }" @click="onCreateBindCode">
              <text class="mini-btn-t">{{ bindCode ? "重新生成绑定码" : bindLoading ? "生成中…" : "生成绑定码" }}</text>
            </view>
            <view class="mini-btn ghost" @click="onCopyBindCode">
              <text class="mini-btn-t ghost">复制绑定码</text>
            </view>
            <view class="mini-btn ghost" @click="onOpenProvision">
              <text class="mini-btn-t ghost">配网向导</text>
            </view>
          </view>
        </view>
        <view v-if="bindCode" class="cell-btn">
          <text class="code-label">当前绑定码（约 10 分钟有效）</text>
          <text class="code-value">{{ bindCode }}</text>
          <text class="code-expire">过期时间：{{ bindExpiresText || "—" }}</text>
        </view>
        <view v-if="devices.length" class="cell-btn">
          <text class="code-label">我的设备</text>
          <view v-for="d in devices" :key="d.id" class="device-row row between" @click="onDeviceTap(d)">
            <text class="device-hwid grow">{{ d.label || d.hardwareId }}</text>
            <text class="code-expire">{{ d.lastSeenAt ? "在线" : "未上线" }}</text>
          </view>
        </view>
        <view class="cell-btn row" @click="onEditTimezone">
          <text class="lbl grow">时区</text>
          <text class="val">{{ timezoneText }}</text>
          <text class="chev">›</text>
        </view>
        <view class="cell-btn row" @click="onEditEnv">
          <text class="lbl grow">微气候偏好</text>
          <text class="val">{{ envText }}</text>
          <text class="chev">›</text>
        </view>
      </view>
    </view>
    <view class="sec px-40 mb-48">
      <text class="sec-t">其他</text>
      <view class="card">
        <view class="cell-btn row" @click="onRateApp">
          <view class="ico bg-o">⭐</view>
          <text class="lbl grow">给应用评分</text>
          <text class="chev">›</text>
        </view>
        <view class="cell-btn row" @click="onHelpFeedback">
          <view class="ico bg-p">❓</view>
          <text class="lbl grow">帮助与反馈</text>
          <text class="chev">›</text>
        </view>
        <view class="cell-btn row" @click="onPrivacy">
          <view class="ico bg-m">🔒</view>
          <text class="lbl grow">隐私政策</text>
          <text class="chev">›</text>
        </view>
      </view>
    </view>
    <view class="px-40 mb-48">
      <view class="card">
        <view class="cell-btn row" @click="onLogout">
          <view class="ico bg-r">🚪</view>
          <text class="lbl grow danger">退出登录</text>
          <text class="chev">›</text>
        </view>
      </view>
    </view>
  </scroll-view>
</template>

<script setup>
import { computed, ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { getApiBase } from "../../utils/config";
import { request } from "../../utils/request";
import {
  bindDeviceToPlant,
  createDeviceBindingCode,
  ensureAuth,
  loadDashboardData,
  loadDevices,
  logoutDeviceUser,
  plantStore,
  updateDevice,
  updateUserMe,
} from "../../common/store.js";

const notifications = ref(true);
const weatherAlerts = ref(true);
const bindCode = ref("");
const bindExpiresText = ref("");
const bindLoading = ref(false);
const me = ref(null);
const weather = ref(null);
const loading = ref(false);
const apiAddress = ref("");

const WEATHER_SOURCE = "Open-Meteo";
const NOTIFY_KEY = "greenai_profile_notify";
const WEATHER_ALERT_KEY = "greenai_profile_weather_alert";
const TZ_LABELS = [
  "Asia/Shanghai",
  "Asia/Hong_Kong",
  "Asia/Tokyo",
  "Asia/Singapore",
  "UTC",
  "Europe/London",
  "America/New_York",
];
const ASPECT_KEYS = ["unknown", "north", "south", "east", "west"];
const ASPECT_LABELS = ["未知", "北向", "南向", "东向", "西向"];

const plants = computed(() => plantStore.plants || []);
const devices = computed(() => plantStore.devices || []);
const plantCount = computed(() => plants.value.length);
const profileName = computed(() => (me.value?.id ? "GreenAI 花友" : "植物爱好者"));
const locationText = computed(() => {
  const label = String(me.value?.locationLabel || "").trim();
  if (label) return label;
  if (me.value?.latitude != null && me.value?.longitude != null) return "已保存定位";
  return "未设置位置";
});
const locationShortText = computed(() => {
  const t = locationText.value;
  return t.length > 8 ? `${t.slice(0, 8)}…` : t;
});
const healthRateText = computed(() => {
  if (!plantCount.value) return "0%";
  const goodCount = plants.value.filter((p) => p.status === "good").length;
  return `${Math.round((goodCount / plantCount.value) * 100)}%`;
});
const careDays = computed(() => {
  if (!plantCount.value) return 0;
  const timestamps = plants.value
    .map((p) => new Date(p.raw?.createdAt || p.raw?.updatedAt || p.raw?.lastCareAt || Date.now()).getTime())
    .filter((v) => Number.isFinite(v));
  if (!timestamps.length) return 0;
  const first = Math.min(...timestamps);
  return Math.max(1, Math.ceil((Date.now() - first) / (24 * 3600 * 1000)));
});
const weatherRowText = computed(() => {
  if (weather.value?.temperatureC == null) return WEATHER_SOURCE;
  const t = Math.round(Number(weather.value.temperatureC));
  return `${WEATHER_SOURCE} ${t}°C`;
});
const timezoneText = computed(() => me.value?.timezone || "Asia/Shanghai");
const apiAddressText = computed(() => {
  const address = apiAddress.value || "同源地址";
  return address.length > 18 ? `${address.slice(0, 18)}…` : address;
});
const envText = computed(() => {
  const ac = me.value?.airConditioning ? "空调开" : "空调关";
  const idx = ASPECT_KEYS.indexOf(me.value?.windowAspect || "unknown");
  const aspect = ASPECT_LABELS[idx >= 0 ? idx : 0];
  return `${ac} · ${aspect}`;
});

function formatBindExpire(isoText) {
  if (!isoText) return "";
  const date = new Date(isoText);
  if (Number.isNaN(date.getTime())) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${date.getMonth() + 1}/${date.getDate()} ${p(date.getHours())}:${p(date.getMinutes())}`;
}

async function onCreateBindCode() {
  if (bindLoading.value) return;
  bindLoading.value = true;
  try {
    const data = await createDeviceBindingCode();
    bindCode.value = data?.code || "";
    bindExpiresText.value = formatBindExpire(data?.expiresAt);
    uni.showToast({ title: "已生成", icon: "success" });
  } catch {
    uni.showToast({ title: "生成失败，请稍后重试", icon: "none" });
  } finally {
    bindLoading.value = false;
  }
}

function onCopyBindCode() {
  const code = String(bindCode.value || "");
  if (!code) {
    uni.showToast({ title: "请先生成绑定码", icon: "none" });
    return;
  }
  uni.setClipboardData({ data: code });
}

function onOpenProvision() {
  uni.navigateTo({ url: "/pages/device-provision/device-provision" });
}

function onOpenApiConfig() {
  uni.navigateTo({ url: "/pages/settings/api-config" });
}

async function refreshProfileData() {
  if (loading.value) return;
  loading.value = true;
  try {
    const authed = await ensureAuth();
    if (!authed) throw new Error("auth_failed");
    await loadDashboardData();
    me.value = await request({ path: "/users/me" });
    await loadDevices();
    if (me.value?.latitude != null && me.value?.longitude != null) {
      try {
        weather.value = await request({ path: "/weather/current" });
      } catch {
        weather.value = null;
      }
    } else {
      weather.value = null;
    }
  } catch {
    me.value = null;
    weather.value = null;
  } finally {
    loading.value = false;
  }
}

async function onPickLocation() {
  try {
    const loc = await new Promise((resolve, reject) => {
      uni.getLocation({
        type: "wgs84",
        success: resolve,
        fail: reject,
      });
    });
    await request({
      path: "/users/me",
      method: "PATCH",
      data: { latitude: loc.latitude, longitude: loc.longitude },
    });
    uni.showToast({ title: "位置已更新", icon: "success" });
    await refreshProfileData();
  } catch {
    uni.showToast({ title: "获取位置失败", icon: "none" });
  }
}

function onWeatherRowTap() {
  if (me.value?.latitude == null || me.value?.longitude == null) {
    uni.showToast({ title: "请先设置位置", icon: "none" });
    return;
  }
  uni.showActionSheet({
    itemList: ["刷新天气", "清除已保存位置"],
    success: async (res) => {
      if (res.tapIndex === 0) {
        await refreshProfileData();
        return;
      }
      try {
        await request({
          path: "/users/me",
          method: "PATCH",
          data: { clearLocation: true },
        });
        uni.showToast({ title: "位置已清除", icon: "success" });
        await refreshProfileData();
      } catch {
        uni.showToast({ title: "清除失败", icon: "none" });
      }
    },
  });
}

function onEditTimezone() {
  uni.showActionSheet({
    itemList: TZ_LABELS,
    success: async (res) => {
      const tz = TZ_LABELS[res.tapIndex];
      if (!tz) return;
      try {
        me.value = await updateUserMe({ timezone: tz });
        uni.showToast({ title: "时区已保存", icon: "success" });
      } catch {
        uni.showToast({ title: "保存失败", icon: "none" });
      }
    },
  });
}

function onEditEnv() {
  uni.showActionSheet({
    itemList: ["切换空调开/关", ...ASPECT_LABELS.map((x) => `朝向：${x}`)],
    success: async (res) => {
      try {
        if (res.tapIndex === 0) {
          me.value = await updateUserMe({ airConditioning: !Boolean(me.value?.airConditioning) });
        } else {
          const aspect = ASPECT_KEYS[res.tapIndex - 1];
          me.value = await updateUserMe({ windowAspect: aspect });
        }
        uni.showToast({ title: "偏好已保存", icon: "success" });
      } catch {
        uni.showToast({ title: "保存失败", icon: "none" });
      }
    },
  });
}

function onDeviceTap(device) {
  const plantItems = plants.value.map((p) => `绑定到：${p.name}`);
  uni.showActionSheet({
    itemList: [...plantItems, "解绑植物", "编辑浇水文案"],
    success: async (res) => {
      try {
        if (res.tapIndex < plantItems.length) {
          const plant = plants.value[res.tapIndex];
          await bindDeviceToPlant(device.id, plant.id);
          uni.showToast({ title: "已绑定", icon: "success" });
          return;
        }
        if (res.tapIndex === plantItems.length) {
          await bindDeviceToPlant(device.id, null);
          uni.showToast({ title: "已解绑", icon: "none" });
          return;
        }
        uni.showModal({
          title: "浇水文案",
          editable: true,
          placeholderText: device.wateringMessage || "浇水好了，植物很开心",
          success: async (m) => {
            if (!m.confirm) return;
            try {
              await updateDevice(device.id, { wateringMessage: String(m.content || "").trim() || null });
              uni.showToast({ title: "已保存", icon: "success" });
            } catch {
              uni.showToast({ title: "保存失败", icon: "none" });
            }
          },
        });
      } catch {
        uni.showToast({ title: "操作失败", icon: "none" });
      }
    },
  });
}

function onRateApp() {
  uni.showToast({ title: "感谢支持", icon: "none" });
}

function onHelpFeedback() {
  const userId = String(me.value?.id || "").trim();
  if (!userId) {
    uni.showToast({ title: "请先登录", icon: "none" });
    return;
  }
  uni.setClipboardData({ data: userId });
}

function onPrivacy() {
  uni.showModal({
    title: "隐私说明",
    content: "我们仅在你授权后使用位置信息用于天气与养护建议，不会用于其他用途。",
    showCancel: false,
  });
}

function clearClientData() {
  me.value = null;
  weather.value = null;
  bindCode.value = "";
  bindExpiresText.value = "";
  plantStore.plants = [];
  plantStore.todayTasks = [];
  plantStore.weather = null;
  plantStore.forecast = null;
  plantStore.devices = [];
}

function onLogout() {
  uni.showModal({
    title: "退出登录？",
    content: "本机用户绑定会保留，之后可在统一登录页一键登录。",
    confirmText: "确认退出",
    confirmColor: "#c0392b",
    success: (result) => {
      if (!result.confirm) return;
      logoutDeviceUser();
      clearClientData();
      uni.reLaunch({ url: "/pages/auth/login" });
    },
  });
}

function loadLocalToggles() {
  notifications.value = uni.getStorageSync(NOTIFY_KEY) !== "0";
  weatherAlerts.value = uni.getStorageSync(WEATHER_ALERT_KEY) !== "0";
}

function persistToggleStates() {
  uni.setStorageSync(NOTIFY_KEY, notifications.value ? "1" : "0");
  uni.setStorageSync(WEATHER_ALERT_KEY, weatherAlerts.value ? "1" : "0");
}

function toggleNotifications() {
  notifications.value = !notifications.value;
  persistToggleStates();
}

function toggleWeatherAlerts() {
  weatherAlerts.value = !weatherAlerts.value;
  persistToggleStates();
}

onShow(() => {
  apiAddress.value = getApiBase();
  loadLocalToggles();
  refreshProfileData();
});
</script>

<style scoped>
.scroll {
  flex: 1;
  height: 0;
  background: #f0faf5;
}
.row {
  display: flex;
  flex-direction: row;
  align-items: center;
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
.mb-48 {
  margin-bottom: 48rpx;
}
.header {
  background: #e2f5ec;
  padding: 40rpx 40rpx 48rpx;
}
.h1 {
  font-size: 36rpx;
  font-weight: 700;
  color: #1a3d2b;
  display: block;
  margin-bottom: 32rpx;
}
.user {
  gap: 32rpx;
  align-items: flex-start;
}
.avatar {
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
.name {
  font-size: 36rpx;
  font-weight: 700;
  color: #1a3d2b;
  display: block;
}
.loc {
  font-size: 26rpx;
  color: #3a6347;
  display: block;
  margin-top: 8rpx;
}
.badges {
  gap: 16rpx;
  margin-top: 16rpx;
}
.b1 {
  background: #1e7a4a;
  color: #fff;
  font-size: 22rpx;
  padding: 8rpx 16rpx;
  border-radius: 999rpx;
  font-weight: 500;
}
.b2 {
  background: rgba(255, 255, 255, 0.6);
  color: #1a3d2b;
  font-size: 22rpx;
  padding: 8rpx 16rpx;
  border-radius: 999rpx;
  font-weight: 500;
}
.stats-wrap {
  margin-top: -24rpx;
  margin-bottom: 32rpx;
}
.stats {
  background: #fff;
  border-radius: 24rpx;
  padding: 32rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
}
.cell {
  text-align: center;
}
.border-l {
  border-left: 1rpx solid #f0f0f0;
}
.v {
  font-size: 44rpx;
  font-weight: 700;
  display: block;
}
.v.green {
  color: #1e7a4a;
}
.l {
  font-size: 22rpx;
  color: #71727a;
  margin-top: 8rpx;
  display: block;
}
.sec {
  margin-bottom: 24rpx;
}
.sec-t {
  font-size: 24rpx;
  color: #71727a;
  font-weight: 600;
  letter-spacing: 2rpx;
  display: block;
  margin-bottom: 16rpx;
  padding-left: 8rpx;
}
.card {
  background: #fff;
  border-radius: 24rpx;
  overflow: hidden;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
}
.cell-btn {
  padding: 28rpx 32rpx;
  border-bottom: 1rpx solid #f5f5f5;
}
.cell-btn:last-child {
  border-bottom: none;
}
.desc {
  display: block;
  font-size: 24rpx;
  color: #5f6b76;
  line-height: 1.5;
}
.code-actions {
  gap: 16rpx;
  margin-top: 20rpx;
}
.mini-btn {
  padding: 14rpx 20rpx;
  border-radius: 12rpx;
  background: #1e7a4a;
}
.mini-btn.disabled {
  opacity: 0.7;
}
.mini-btn.ghost {
  background: #e2f5ec;
}
.mini-btn-t {
  font-size: 24rpx;
  color: #fff;
  font-weight: 600;
}
.mini-btn-t.ghost {
  color: #1e7a4a;
}
.code-label {
  display: block;
  font-size: 24rpx;
  color: #71727a;
}
.code-value {
  display: block;
  margin-top: 8rpx;
  font-size: 46rpx;
  letter-spacing: 6rpx;
  color: #1a3d2b;
  font-weight: 700;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}
.code-expire {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #71727a;
}
.device-row {
  padding: 12rpx 0;
  border-bottom: 1rpx solid #f5f5f5;
}
.device-row:last-child {
  border-bottom: none;
}
.device-hwid {
  font-size: 24rpx;
  color: #1a3d2b;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}
.ico {
  width: 64rpx;
  height: 64rpx;
  border-radius: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
  margin-right: 24rpx;
  flex-shrink: 0;
}
.bg-m {
  background: #e2f5ec;
}
.bg-b {
  background: #e8f4fb;
}
.bg-o {
  background: #fff3e0;
}
.bg-p {
  background: #f3f0ff;
}
.bg-r {
  background: #fef0f0;
}
.lbl {
  font-size: 28rpx;
  color: #1a3d2b;
}
.lbl.danger,
.danger {
  color: #c0392b;
}
.val {
  font-size: 26rpx;
  color: #9e9ea7;
  margin-right: 8rpx;
}
.api-val {
  max-width: 260rpx;
  overflow: hidden;
  white-space: nowrap;
}
.chev {
  color: #c4c4c4;
  font-size: 46rpx;
  line-height: 1;
}
.sw {
  width: 88rpx;
  height: 48rpx;
  border-radius: 999rpx;
  background: #d1d5db;
  position: relative;
  flex-shrink: 0;
}
.sw.on {
  background: #1e7a4a;
}
.knob {
  position: absolute;
  top: 4rpx;
  left: 4rpx;
  width: 40rpx;
  height: 40rpx;
  background: #fff;
  border-radius: 999rpx;
  box-shadow: 0 2rpx 6rpx rgba(0, 0, 0, 0.12);
}
.sw.on .knob {
  left: 44rpx;
}
</style>
