<template>
  <scroll-view scroll-y class="scroll" :show-scrollbar="false">
    <view class="header">
      <view class="row between mb-24">
        <view>
          <text class="greet">早上好</text>
          <text class="title">植物健康监测</text>
        </view>
        <view class="loc-pill">
          <text class="loc-txt">📍 {{ cityText }}</text>
        </view>
      </view>
      <view class="row weather-row mb-24">
        <view class="row weather-main">
          <text class="sun-emoji">☀️</text>
          <view>
            <text class="temp">{{ tempText }}</text>
            <text class="sub">{{ tempSubText }}</text>
          </view>
        </view>
        <view class="col subcol weather-side">
          <text class="sub">🌬️ 东南风 3级</text>
          <text class="sub">💧 相对湿度 {{ humidityText }}</text>
          <text class="sub">☀️ 紫外线 强</text>
        </view>
      </view>
      <view class="tip-box">
        <text class="tip">{{ tipText }}</text>
      </view>
    </view>

    <view v-if="needsAttention.length" class="px-40 mt-24">
      <view class="alert">
        <text class="alert-ico">⚠️</text>
        <text class="alert-txt">{{ alertText }}</text>
      </view>
    </view>

    <view class="px-40 mt-24">
      <view class="row between mb-16">
        <view class="row gap-24">
          <text class="sec-title">我的植物</text>
          <view class="row gap-12">
            <text class="pill pill-green">共 {{ plants.length }} 株</text>
            <text v-if="needsAttention.length" class="pill pill-orange">{{ needsAttention.length }} 待处理</text>
          </view>
        </view>
        <text class="link" @click="emit('openCare')">全部 ›</text>
      </view>
      <view class="card">
        <view v-for="plant in plants" :key="plant.id" class="plant-row" @click="emit('openPlant', plant.id)">
          <view class="strip" :style="{ backgroundColor: statusColor(plant) }" />
          <view class="emoji-box"><text class="emoji">{{ plant.emoji }}</text></view>
          <view class="grow min0">
            <view class="row gap-12 mb-8 wrap">
              <text class="p-name">{{ plant.name }}</text>
              <text class="badge ml-auto" :style="badgeStyle(plant)">{{ statusLabel(plant) }}</text>
            </view>
            <text class="p-loc">📍 {{ plant.location }}</text>
            <view class="row gap-16 metrics-row">
              <text class="ico" :style="{ color: plant.water < 30 ? '#c0392b' : G }">💧</text>
              <MicroBar class="metric-bar" :value="plant.water" :color="plant.water < 30 ? '#c0392b' : G" />
              <text class="ico sun">☀️</text>
              <MicroBar class="metric-bar" :value="plant.light" color="#c47000" />
              <text class="ico zap">⚡</text>
              <MicroBar class="metric-bar" :value="plant.nutrition" :color="plant.nutrition < 40 ? '#c47000' : '#6d4fc4'" />
            </view>
          </view>
          <text class="chev">›</text>
        </view>
      </view>
    </view>

    <view class="px-40 mt-32 mb-40">
      <text class="sec-title mb-16">常用工具</text>
      <view class="row gap-16">
        <view class="tool" @click="emit('openTool', 'plantId')">
          <view class="tool-ico bg-mint">📷</view>
          <view class="tool-txt-wrap">
            <text class="tool-txt">植物</text>
            <text class="tool-txt">识别</text>
          </view>
        </view>
        <view class="tool" @click="emit('openTool', 'soilId')">
          <view class="tool-ico bg-orange">🔬</view>
          <view class="tool-txt-wrap">
            <text class="tool-txt">土壤</text>
            <text class="tool-txt">识别</text>
          </view>
        </view>
        <view class="tool" @click="emit('openTool', 'pestDiag')">
          <view class="tool-ico bg-red">🐛</view>
          <view class="tool-txt-wrap">
            <text class="tool-txt">病虫</text>
            <text class="tool-txt">诊断</text>
          </view>
        </view>
      </view>
    </view>
  </scroll-view>
</template>

<script setup>
import { computed } from "vue";
import MicroBar from "../../components/MicroBar.vue";
import { G } from "../../common/constants.js";
import { plantStore } from "../../common/store.js";

const emit = defineEmits(["openPlant", "openTool", "openCare"]);

const plants = computed(() => plantStore.plants);
const needsAttention = computed(() => plants.value.filter((p) => p.status !== "good"));

const weather = computed(() => plantStore.weather || {});
const cityText = computed(() => (weather.value.latitude != null ? "已定位" : "上海"));
const tempText = computed(() => (weather.value.temperatureC != null ? `${Math.round(weather.value.temperatureC)}°` : "28°"));
const humidityText = computed(() =>
  weather.value.relativeHumidity != null ? `${Math.round(weather.value.relativeHumidity)}%` : "65%"
);
const tempSubText = computed(() => "晴天  22° / 31°");
const tipText = computed(
  () =>
    "💡 今日光照充足，建议上午10点前完成浇水，阳台植物可充分接受日照，气温偏高注意水分蒸发加快。"
);

const alertText = computed(() =>
  needsAttention.value
    .map((p) => (p.status === "danger" ? `${p.name}严重缺水` : `${p.name}营养不足`))
    .join("，") + "，请及时养护。"
);

function statusColor(p) {
  if (p.status === "good") return G;
  if (p.status === "warning") return "#c47000";
  return "#c0392b";
}
function statusLabel(p) {
  if (p.status === "good") return "良好";
  if (p.status === "warning") return "待养护";
  return "紧急";
}
function badgeStyle(p) {
  const c = statusColor(p);
  const bg = p.status === "good" ? "#e2f5ec" : p.status === "warning" ? "#fff3e0" : "#fef0f0";
  return { backgroundColor: bg, color: c };
}
</script>

<style scoped>
.scroll {
  flex: 1;
  height: 0;
  background: #f0faf5;
}
.header {
  background: #e2f5ec;
  padding: 32rpx 40rpx 40rpx;
}
.row {
  display: flex;
  flex-direction: row;
  align-items: center;
}
.col {
  display: flex;
  flex-direction: column;
}
.between {
  justify-content: space-between;
}
.gap-12 {
  gap: 12rpx;
}
.gap-16 {
  gap: 16rpx;
}
.gap-24 {
  gap: 24rpx;
}
.mb-8 {
  margin-bottom: 8rpx;
}
.mb-16 {
  margin-bottom: 16rpx;
}
.mb-24 {
  margin-bottom: 24rpx;
}
.mt-24 {
  margin-top: 24rpx;
}
.mt-32 {
  margin-top: 32rpx;
}
.mb-40 {
  margin-bottom: 40rpx;
}
.px-40 {
  padding-left: 40rpx;
  padding-right: 40rpx;
}
.ml-auto {
  margin-left: auto;
}
.grow {
  flex: 1;
}
.min0 {
  min-width: 0;
}
.wrap {
  flex-wrap: wrap;
}
.greet {
  font-size: 24rpx;
  color: #3a6347;
  display: block;
}
.title {
  font-size: 38rpx;
  font-weight: 700;
  color: #1a3d2b;
  display: block;
  line-height: 1.2;
}
.loc-pill {
  background: #1e7a4a;
  border-radius: 16rpx;
  padding: 12rpx 20rpx;
}
.loc-txt {
  font-size: 24rpx;
  color: #fff;
}
.weather-row {
  align-items: center;
  justify-content: space-between;
  gap: 24rpx;
}
.weather-main {
  align-items: center;
  min-width: 280rpx;
}
.sun-emoji {
  font-size: 72rpx;
  margin-right: 16rpx;
}
.temp {
  font-size: 60rpx;
  font-weight: 700;
  color: #1a3d2b;
  display: block;
  line-height: 1;
}
.sub {
  font-size: 22rpx;
  color: #3a6347;
}
.subcol {
  flex: 1;
  gap: 8rpx;
}
.weather-side {
  align-items: flex-end;
}
.weather-side .sub {
  text-align: right;
}
.tip-box {
  background: rgba(255, 255, 255, 0.6);
  border-radius: 16rpx;
  padding: 20rpx 24rpx;
  margin-top: 16rpx;
}
.tip {
  font-size: 24rpx;
  color: #1a3d2b;
  line-height: 1.5;
}
.alert {
  background: #fff8ed;
  border: 1rpx solid #ffe4b3;
  border-radius: 16rpx;
  padding: 20rpx 24rpx;
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 12rpx;
}
.alert-ico {
  font-size: 28rpx;
  margin-top: 4rpx;
}
.alert-txt {
  flex: 1;
  font-size: 24rpx;
  color: #7a4f00;
  line-height: 1.4;
}
.sec-title {
  font-size: 26rpx;
  font-weight: 700;
  color: #1a3d2b;
}
.pill {
  font-size: 20rpx;
  padding: 4rpx 16rpx;
  border-radius: 999rpx;
  font-weight: 500;
}
.pill-green {
  background: #e2f5ec;
  color: #1e7a4a;
}
.pill-orange {
  background: #fff3e0;
  color: #b85c00;
}
.link {
  font-size: 24rpx;
  color: #1e7a4a;
}
.card {
  background: #fff;
  border-radius: 24rpx;
  overflow: hidden;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
}
.plant-row {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 16rpx;
  padding: 26rpx 28rpx;
  border-bottom: 1rpx solid #f5f5f5;
}
.plant-row:last-child {
  border-bottom: none;
}
.strip {
  width: 6rpx;
  min-height: 108rpx;
  border-radius: 999rpx;
  flex-shrink: 0;
  margin-top: 2rpx;
}
.emoji-box {
  width: 72rpx;
  height: 72rpx;
  border-radius: 16rpx;
  background: #f7faf8;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.emoji {
  font-size: 42rpx;
}
.p-name {
  font-size: 28rpx;
  font-weight: 600;
  color: #1a3d2b;
}
.p-loc {
  display: block;
  font-size: 21rpx;
  color: #8b95a1;
  margin-bottom: 10rpx;
}
.badge {
  font-size: 18rpx;
  padding: 4rpx 12rpx;
  border-radius: 999rpx;
  font-weight: 500;
}
.ico {
  font-size: 20rpx;
  flex-shrink: 0;
}
.metrics-row {
  align-items: center;
}
.metric-bar {
  flex: 1;
}
.chev {
  color: #d0d0d0;
  font-size: 46rpx;
  margin-top: 28rpx;
  margin-left: 4rpx;
  flex-shrink: 0;
}
.tool {
  flex: 1;
  background: #fff;
  border-radius: 24rpx;
  padding: 28rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
}
.tool-ico {
  width: 80rpx;
  height: 80rpx;
  border-radius: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40rpx;
}
.bg-mint {
  background: #e2f5ec;
}
.bg-orange {
  background: #fff3e0;
}
.bg-red {
  background: #fef0f0;
}
.tool-txt-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2rpx;
}
.tool-txt {
  font-size: 24rpx;
  font-weight: 600;
  color: #1a3d2b;
  text-align: center;
  line-height: 1.2;
}
</style>
