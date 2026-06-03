<template>
  <view class="page">
    <view class="toolbar card">
      <view class="search-bar">
        <text class="search-icon">🔍</text>
        <input
          class="search-input"
          type="text"
          placeholder="搜索我的植物"
          :value="searchQuery"
          @input="onSearchInput"
          confirm-type="search"
        />
      </view>
      <view class="add-btn" @tap="goAdd">＋</view>
    </view>

    <view v-if="needLocationTip" class="loc-hint card" @tap="goSettings">
      <text>开启定位后可根据天气微调浇水节奏</text>
      <text class="loc-hint__go">去「我」设置 ›</text>
    </view>

    <view v-if="displayPlants.length === 0" class="empty card">
      <text>{{ searchQuery ? '没有匹配的植物' : '还没有植物' }}</text>
      <text class="empty-sub">{{ searchQuery ? '换个关键词试试' : '点击右上角 ＋ 添加' }}</text>
    </view>

    <view v-for="p in displayPlants" :key="p.id" class="plant-card card">
      <view class="plant-card__main">
        <view class="plant-avatar">
          <image v-if="plantPhotos[p.id]" class="plant-avatar-img" :src="plantPhotos[p.id]" mode="aspectFill" />
          <text v-else class="plant-avatar-letter">{{ p.nickname.charAt(0) }}</text>
        </view>
        <view class="plant-card__body">
          <text class="plant-card__name">{{ p.nickname }}</text>
          <text class="plant-card__species">{{ p.speciesLabel }}</text>
        </view>
      </view>
      <view v-if="deviceMap[p.id]" class="plant-card__sensor">
        <view class="sensor-row">
          <text class="sensor-item">🌡️ {{ deviceMap[p.id].latestReading?.tempC ?? '--' }}°C</text>
          <text class="sensor-item">💧 {{ deviceMap[p.id].latestReading?.soilMoisture ?? '--' }}%</text>
          <text class="sensor-item">☀️ {{ deviceMap[p.id].latestReading?.lux ?? '--' }} lx</text>
          <text class="sensor-item">🧪 pH {{ deviceMap[p.id].latestReading?.phLevel ?? '--' }}</text>
        </view>
        <text class="sensor-time">设备 {{ deviceMap[p.id].hardwareId }} · 最后上报 {{ deviceMap[p.id].lastSeenAt ? timeAgo(deviceMap[p.id].lastSeenAt) : '从未' }}</text>
      </view>
      <view class="plant-card__actions">
        <view class="pill pill--outline" @tap="goPlan(p.id)">计划</view>
        <view class="pill pill--outline" @tap="goEdit(p.id)">编辑</view>
        <view class="pill pill--danger" @tap="onDelete(p.id)">删除</view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { request, getToken } from "@/utils/request";

interface Plant {
  id: string;
  nickname: string;
  speciesLabel: string;
}
interface SensorReading {
  tempC: number | null;
  soilMoisture: number | null;
  phLevel: number | null;
  lux: number | null;
  measuredAt: string;
}
interface DeviceInfo {
  id: string;
  hardwareId: string;
  label: string | null;
  plantId: string | null;
  lastSeenAt: string | null;
  latestReading: SensorReading | null;
}

const plants = ref<Plant[]>([]);
const searchQuery = ref("");
const needLocationTip = ref(false);
/** plantId → device bound to that plant */
const deviceMap = ref<Record<string, DeviceInfo>>({});
/** plantId → photo dataUrl */
const plantPhotos = ref<Record<string, string>>({});
const PHOTO_STORAGE_PREFIX = "plantPhoto_";

const displayPlants = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return plants.value;
  return plants.value.filter(
    p =>
      p.nickname.toLowerCase().includes(q) ||
      p.speciesLabel.toLowerCase().includes(q)
  );
});

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "刚刚";
  if (mins < 60) return `${mins}分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  return `${days}天前`;
}

async function load() {
  if (!getToken()) return;
  try {
    const [plantList, deviceList] = await Promise.all([
      request<Plant[]>({ path: "/plants" }),
      request<DeviceInfo[]>({ path: "/devices" }),
    ]);
    plants.value = plantList;
    const map: Record<string, DeviceInfo> = {};
    for (const d of deviceList) {
      if (d.plantId) map[d.plantId] = d;
    }
    deviceMap.value = map;
    // Load photos from local storage
    const photos: Record<string, string> = {};
    for (const p of plantList) {
      try {
        const base64 = uni.getStorageSync(PHOTO_STORAGE_PREFIX + p.id);
        if (base64) photos[p.id] = `data:image/jpeg;base64,${base64}`;
      } catch {}
    }
    plantPhotos.value = photos;
  } catch (e: any) {
    const msg = e?.data?.message || e?.errMsg || "";
    uni.showToast({ title: msg || "加载数据失败", icon: "none" });
  }
}

async function loadMeTip() {
  if (!getToken()) return;
  try {
    const me: any = await request({ path: "/users/me" });
    needLocationTip.value = !me.latitude || !me.longitude;
  } catch {}
}

function onSearchInput(e: any) {
  searchQuery.value = e.detail?.value ?? e.target?.value ?? "";
}

function goAdd() {
  uni.navigateTo({ url: "/pages/plant-edit/plant-edit" });
}
function goEdit(id: string) {
  uni.navigateTo({ url: `/pages/plant-edit/plant-edit?id=${id}` });
}
function goPlan(id: string) {
  uni.navigateTo({ url: `/pages/plant-plan/plant-plan?id=${id}` });
}
function goSettings() {
  uni.switchTab({ url: "/pages/me/me" });
}
async function onDelete(id: string) {
  uni.showModal({
    title: "确认删除",
    content: "确定要删除这株植物吗？",
    success: async (res) => {
      if (res.confirm) {
        try {
          await request({ path: `/plants/${id}`, method: "DELETE" });
          plants.value = plants.value.filter(p => p.id !== id);
          uni.showToast({ title: "已删除", icon: "success" });
        } catch {
          uni.showToast({ title: "删除失败", icon: "none" });
        }
      }
    },
  });
}

onShow(() => {
  load();
  loadMeTip();
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
.toolbar {
  display: flex;
  align-items: center;
  gap: 16rpx;
}
.search-bar {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 0 20rpx;
  border-radius: 999rpx;
  background: #f5f5f5;
  min-height: 72rpx;
}
.search-icon { opacity: 0.6; }
.search-input {
  flex: 1;
  font-size: 28rpx;
}
.add-btn {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  background: #43a047;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40rpx;
  font-weight: 300;
}
.loc-hint {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  font-size: 24rpx;
  color: #616161;
}
.loc-hint__go { color: #43a047; font-weight: 600; }
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
  font-size: 28rpx;
  color: #616161;
}
.empty-sub { font-size: 24rpx; color: #9e9e9e; }
.plant-card__main {
  display: flex;
  align-items: center;
  gap: 20rpx;
  margin-bottom: 16rpx;
}
.plant-avatar {
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  background: #e8f5e9;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}
.plant-avatar-letter {
  font-size: 36rpx;
  font-weight: 700;
  color: #43a047;
}
.plant-avatar-img {
  width: 100%;
  height: 100%;
}
.plant-card__body { flex: 1; }
.plant-card__name {
  font-size: 32rpx;
  font-weight: 700;
  color: #212121;
  display: block;
}
.plant-card__species {
  font-size: 24rpx;
  color: #9e9e9e;
  display: block;
  margin-top: 4rpx;
}
.plant-card__actions {
  display: flex;
  gap: 12rpx;
}
.pill {
  padding: 8rpx 24rpx;
  border-radius: 999rpx;
  font-size: 24rpx;
  font-weight: 600;
}
.pill--outline {
  background: transparent;
  border: 2rpx solid #e0e0e0;
  color: #616161;
}
.pill--danger {
  background: #fce8e8;
  color: #a33c3c;
}
.plant-card__sensor {
  background: #f5faf5;
  border-radius: 12rpx;
  padding: 16rpx;
  margin-bottom: 14rpx;
}
.sensor-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}
.sensor-item {
  font-size: 22rpx;
  color: #2e7d32;
  font-weight: 600;
}
.sensor-time {
  display: block;
  font-size: 20rpx;
  color: #9e9e9e;
  margin-top: 8rpx;
}
</style>
