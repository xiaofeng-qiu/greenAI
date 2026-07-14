<template>
  <scroll-view scroll-y class="scroll" :show-scrollbar="false">
    <view class="search-head">
      <view class="row gap-16">
        <view class="search-fake grow">
          <input class="search-inp" v-model="query" placeholder="🔍 搜索植物..." placeholder-class="ph" />
        </view>
        <view class="add-btn" @click="goAdd"><text class="add-txt">+ 添加</text></view>
      </view>
    </view>
    <view class="stats row gap-16 px-32 py-20">
      <view class="stat mint grow"><text class="stat-line"><text class="stat-num green">{{ filtered.length }}</text><text class="stat-lbl">株</text></text></view>
      <view class="stat orange grow"><text class="stat-line"><text class="stat-num org">{{ badCount }}</text><text class="stat-lbl darko">待处理</text></text></view>
      <view class="stat white grow"><text class="stat-line"><text class="stat-num dark">{{ goodCount }}</text><text class="stat-lbl gray">良好</text></text></view>
    </view>
    <view class="list px-32 pb-40">
      <view
        v-for="plant in filtered"
        :key="plant.id"
        class="card"
        @click="openDetail(plant.id)"
        @longpress="onPlantActions(plant)"
      >
        <view class="strip" :style="{ backgroundColor: sc(plant) }" />
        <view class="inner row">
          <view class="emoji-box"><text class="emoji">{{ plant.emoji }}</text></view>
          <view class="grow min0">
            <view class="row gap-12 mb-8 row-wrap">
              <text class="name">{{ plant.name }}</text>
              <text class="mini-badge ml-auto" :style="miniBadge(plant)">{{ shortStatus(plant) }}</text>
            </view>
            <text class="meta">📍 {{ plant.location }} · {{ plant.lastCare }}养护</text>
            <view class="row gap-12 bars">
              <text class="tiny" :style="{ color: plant.water < 30 ? '#c0392b' : G }">💧</text>
              <MicroBar flex :value="plant.water" :color="plant.water < 30 ? '#c0392b' : G" />
              <text class="tiny sun">☀️</text>
              <MicroBar flex :value="plant.light" color="#c47000" />
              <text class="tiny zap">⚡</text>
              <MicroBar flex :value="plant.nutrition" :color="plant.nutrition < 40 ? '#c47000' : '#6d4fc4'" />
            </view>
          </view>
          <text class="chev">›</text>
        </view>
      </view>
    </view>
  </scroll-view>
</template>

<script setup>
import { computed, ref } from "vue";
import MicroBar from "../../components/MicroBar.vue";
import { G } from "../../common/constants.js";
import { deletePlant, plantStore } from "../../common/store.js";

const query = ref("");
const plants = computed(() => plantStore.plants);
const filtered = computed(() => {
  const q = query.value.trim();
  if (!q) return plants.value;
  return plants.value.filter(
    (p) => String(p.name || "").includes(q) || String(p.location || "").includes(q)
  );
});
const badCount = computed(() => filtered.value.filter((p) => p.status !== "good").length);
const goodCount = computed(() => filtered.value.filter((p) => p.status === "good").length);

function sc(p) {
  if (p.status === "good") return G;
  if (p.status === "warning") return "#c47000";
  return "#c0392b";
}
function shortStatus(p) {
  if (p.status === "good") return "良好";
  if (p.status === "warning") return "需关注";
  return "紧急";
}
function miniBadge(p) {
  const c = sc(p);
  const bg = p.status === "good" ? "#e2f5ec" : p.status === "warning" ? "#fff3e0" : "#fef0f0";
  return { backgroundColor: bg, color: c };
}
function openDetail(id) {
  uni.navigateTo({ url: `/pages/care/detail?id=${id}` });
}
function goAdd() {
  uni.navigateTo({ url: "/pages/care/add" });
}
function onPlantActions(plant) {
  uni.showActionSheet({
    itemList: ["编辑植物", "查看养护计划", "删除植物"],
    success: (res) => {
      if (res.tapIndex === 0) {
        uni.navigateTo({ url: `/pages/plant-edit/plant-edit?id=${plant.id}` });
        return;
      }
      if (res.tapIndex === 1) {
        uni.navigateTo({ url: `/pages/plant-plan/plant-plan?id=${plant.id}` });
        return;
      }
      uni.showModal({
        title: "删除植物",
        content: `确定删除「${plant.name}」吗？`,
        success: async (m) => {
          if (!m.confirm) return;
          try {
            await deletePlant(plant.id);
            uni.showToast({ title: "已删除", icon: "success" });
          } catch {
            uni.showToast({ title: "删除失败", icon: "none" });
          }
        },
      });
    },
  });
}
</script>

<style scoped>
.scroll { flex: 1; height: 0; background: #f0faf5; }
.row { display: flex; flex-direction: row; align-items: center; }
.grow { flex: 1; }
.min0 { min-width: 0; }
.gap-12 { gap: 12rpx; }
.gap-16 { gap: 16rpx; }
.mb-8 { margin-bottom: 8rpx; }
.px-32 { padding-left: 32rpx; padding-right: 32rpx; }
.py-20 { padding-top: 20rpx; padding-bottom: 20rpx; }
.pb-40 { padding-bottom: 40rpx; }
.search-head { background: #fff; padding: 32rpx 32rpx 24rpx; border-bottom: 1rpx solid #f0f0f0; }
.search-fake { background: #f2f2f5; border-radius: 16rpx; padding: 8rpx 24rpx; }
.search-inp { width: 100%; height: 64rpx; font-size: 26rpx; color: #3a3c3f; }
.ph { font-size: 26rpx; color: #9e9ea7; }
.add-btn { background: #1e7a4a; border-radius: 16rpx; padding: 20rpx 24rpx; flex-shrink: 0; }
.add-txt { color: #fff; font-size: 26rpx; font-weight: 600; }
.stats { justify-content: space-between; }
.stat { border-radius: 16rpx; padding: 16rpx; text-align: center; display: flex; align-items: center; justify-content: center; }
.stat-line { font-size: 0; }
.stat.mint { background: #e2f5ec; }
.stat.orange { background: #fff3e0; }
.stat.white { background: #fff; }
.stat-num { font-size: 32rpx; font-weight: 700; }
.stat-num.green { color: #1e7a4a; }
.stat-num.org { color: #c47000; }
.stat-num.dark { color: #1a3d2b; }
.stat-lbl { font-size: 20rpx; margin-left: 8rpx; color: #3a6347; }
.stat-lbl.darko { color: #7a4f00; }
.stat-lbl.gray { color: #71727a; }
.list { display: flex; flex-direction: column; gap: 16rpx; }
.card { background: #fff; border-radius: 24rpx; overflow: hidden; display: flex; flex-direction: row; box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04); }
.strip { width: 4rpx; flex-shrink: 0; }
.inner { flex: 1; padding: 24rpx; min-width: 0; }
.emoji-box { width: 88rpx; height: 88rpx; background: #f0faf5; border-radius: 16rpx; display: flex; align-items: center; justify-content: center; margin-right: 24rpx; flex-shrink: 0; }
.emoji { font-size: 44rpx; }
.name { font-size: 28rpx; font-weight: 600; color: #1a3d2b; }
.mini-badge { font-size: 18rpx; padding: 4rpx 12rpx; border-radius: 999rpx; font-weight: 500; }
.ml-auto { margin-left: auto; }
.meta { font-size: 20rpx; color: #9e9ea7; display: block; margin-bottom: 12rpx; }
.bars { margin-top: 4rpx; }
.tiny { font-size: 18rpx; flex-shrink: 0; }
.chev { color: #d0d0d0; font-size: 46rpx; line-height: 1; flex-shrink: 0; margin-left: 4rpx; }
.row-wrap { flex-wrap: wrap; }
</style>
