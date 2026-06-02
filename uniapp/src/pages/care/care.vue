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
        <view class="plant-avatar">{{ p.avatarLetter }}</view>
        <view class="plant-card__body">
          <text class="plant-card__name">{{ p.nickname }}</text>
          <text class="plant-card__species">{{ p.speciesLabel }}</text>
        </view>
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

const plants = ref<Plant[]>([]);
const searchQuery = ref("");
const needLocationTip = ref(false);

const displayPlants = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return plants.value;
  return plants.value.filter(
    p =>
      p.nickname.toLowerCase().includes(q) ||
      p.speciesLabel.toLowerCase().includes(q)
  );
});

async function load() {
  if (!getToken()) return;
  try {
    plants.value = await request({ path: "/plants" });
  } catch {}
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
  font-size: 36rpx;
  font-weight: 700;
  color: #43a047;
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
</style>
