<template>
  <view class="page">
    <scroll-view scroll-y class="scroll">
      <view class="pad">
        <view class="photo" :class="{ ok: captured }" @click="captured = !captured">
          <template v-if="captured">
            <view class="check-circle"><text class="check">✓</text></view>
            <text class="p1" :style="{ color: G }">照片已拍摄</text>
            <text class="p2">点击重新拍照</text>
          </template>
          <template v-else>
            <view class="cam-bg"><text class="cam">📷</text></view>
            <text class="p1" :style="{ color: G }">拍摄植物照片</text>
            <text class="p2 gray">用于识别植物种类和健康状况</text>
          </template>
        </view>
        <text class="label">名称</text>
        <input class="inp" v-model="name" placeholder="输入植物名称（如：蝴蝶兰）" />
        <text class="label">位置</text>
        <view class="inp row between" @click="showLoc = !showLoc">
          <text :class="location ? 'dark' : 'ph'">{{ location || "选择种植位置" }}</text>
          <text class="arrow">▼</text>
        </view>
        <view v-if="showLoc" class="loc-card">
          <view v-for="loc in LOCATIONS" :key="loc" class="loc-row row" @click="pickLoc(loc)">
            <text :style="{ color: G }">📍</text>
            <text class="loc-t grow">{{ loc }}</text>
            <text v-if="location === loc" :style="{ color: G }">✓</text>
          </view>
        </view>
        <view class="tip">
          <text class="tip-h">📡 自动监测</text>
          <text class="tip-b"
            >添加后，系统将根据您的位置自动获取天气数据，并结合传感器读数持续监测植物健康状况。</text
          >
        </view>
      </view>
    </scroll-view>
    <view class="foot pad-h">
      <view class="btn" :class="{ disabled: !canSubmit || submitting }" @click="submit">
        <text class="btn-t">确认添加</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from "vue";
import { G, LOCATIONS } from "../../common/constants.js";
import { createPlant } from "../../common/store.js";

const name = ref("");
const location = ref("");
const showLoc = ref(false);
const captured = ref(false);
const submitting = ref(false);

const canSubmit = computed(() => name.value.trim() && location.value);

function pickLoc(loc) {
  location.value = loc;
  showLoc.value = false;
}

function locationToIndoor(loc) {
  return loc !== "户外";
}

async function submit() {
  if (!canSubmit.value || submitting.value) return;
  submitting.value = true;
  try {
    await createPlant({
      nickname: name.value.trim(),
      speciesLabel: name.value.trim(),
      waterPreference: "medium",
      indoor: locationToIndoor(location.value),
      heating: false,
      lightLevel: location.value === "阳台" || location.value === "户外" ? "high" : "medium",
      soilMoistureHint: "moderate",
      careTips: `位置：${location.value}`,
    });
    uni.showToast({ title: "已添加", icon: "success" });
    setTimeout(() => {
      uni.navigateBack();
    }, 400);
  } catch {
    uni.showToast({ title: "添加失败", icon: "none" });
  } finally {
    submitting.value = false;
  }
}
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
  height: 0;
}
.pad {
  padding: 40rpx;
}
.pad-h {
  padding-left: 40rpx;
  padding-right: 40rpx;
}
.photo {
  height: 340rpx;
  border-radius: 24rpx;
  border: 4rpx dashed #b8d9c8;
  background: #f5fdf8;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24rpx;
  margin-bottom: 40rpx;
}
.photo.ok {
  border-color: #1e7a4a;
  background: #e2f5ec;
}
.check-circle {
  width: 112rpx;
  height: 112rpx;
  border-radius: 999rpx;
  background: #1e7a4a;
  display: flex;
  align-items: center;
  justify-content: center;
}
.check {
  color: #fff;
  font-size: 56rpx;
  font-weight: 700;
}
.cam-bg {
  width: 112rpx;
  height: 112rpx;
  border-radius: 999rpx;
  background: #e2f5ec;
  display: flex;
  align-items: center;
  justify-content: center;
}
.cam {
  font-size: 52rpx;
}
.p1 {
  font-size: 28rpx;
  font-weight: 600;
}
.p2 {
  font-size: 24rpx;
  color: #71727a;
}
.p2.gray {
  color: #9e9ea7;
}
.label {
  font-size: 30rpx;
  font-weight: 700;
  color: #1a3d2b;
  display: block;
  margin-bottom: 16rpx;
}
.inp {
  width: 100%;
  box-sizing: border-box;
  background: #f2f2f5;
  border-radius: 24rpx;
  padding: 32rpx;
  font-size: 30rpx;
  color: #424d59;
  margin-bottom: 40rpx;
}
.row {
  display: flex;
  flex-direction: row;
  align-items: center;
}
.between {
  justify-content: space-between;
}
.grow {
  flex: 1;
}
.dark {
  color: #424d59;
}
.ph {
  color: #b0b3bc;
}
.arrow {
  color: #666;
  font-size: 24rpx;
}
.loc-card {
  background: #fff;
  border-radius: 24rpx;
  overflow: hidden;
  box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.08);
  margin-bottom: 40rpx;
  margin-top: -24rpx;
}
.loc-row {
  padding: 28rpx 32rpx;
  border-bottom: 1rpx solid #f5f5f5;
  gap: 24rpx;
}
.loc-t {
  font-size: 30rpx;
  color: #3a3c3f;
}
.tip {
  background: #e2f5ec;
  border: 1rpx solid #c3e8d6;
  border-radius: 24rpx;
  padding: 32rpx;
}
.tip-h {
  font-size: 26rpx;
  font-weight: 600;
  color: #1a3d2b;
  display: block;
  margin-bottom: 8rpx;
}
.tip-b {
  font-size: 26rpx;
  color: #3a6347;
  line-height: 1.5;
}
.foot {
  flex-shrink: 0;
  padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
  padding-top: 24rpx;
  background: #f0faf5;
}
.btn {
  background: #1e7a4a;
  border-radius: 24rpx;
  padding: 36rpx;
  text-align: center;
}
.btn.disabled {
  background: #b8d9c8;
}
.btn-t {
  color: #fff;
  font-size: 36rpx;
  font-weight: 700;
}
</style>
