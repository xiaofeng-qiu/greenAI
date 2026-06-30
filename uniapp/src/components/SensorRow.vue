<template>
  <view class="row sensor">
    <text class="ico" :style="{ color: icolor }">{{ icon }}</text>
    <text class="lbl">{{ label }}</text>
    <view class="track grow">
      <view class="fill" :style="{ width: value + '%', backgroundColor: barColor }" />
    </view>
    <text class="pct" :style="{ color: barColor }">{{ value }}%</text>
    <text class="tag" :style="{ backgroundColor: tagBg, color: barColor }">{{ tagText }}</text>
  </view>
</template>

<script setup>
import { computed } from "vue";
import { G } from "../common/constants.js";

const props = defineProps({
  icon: { type: String, default: "💧" },
  icolor: { type: String, default: G },
  label: { type: String, required: true },
  value: { type: Number, required: true },
  level: { type: String, required: true },
});

const barColor = computed(() => {
  if (props.level === "good") return G;
  if (props.level === "warning") return "#c47000";
  return "#c0392b";
});
const tagText = computed(() => {
  if (props.level === "good") return "适宜";
  if (props.level === "warning") return "偏低";
  return "严重不足";
});
const tagBg = computed(() => {
  if (props.level === "good") return "#e2f5ec";
  if (props.level === "warning") return "#fff3e0";
  return "#fef0f0";
});
</script>

<style scoped>
.row {
  display: flex;
  flex-direction: row;
  align-items: center;
}
.sensor {
  gap: 16rpx;
}
.ico {
  font-size: 26rpx;
  flex-shrink: 0;
}
.lbl {
  width: 112rpx;
  flex-shrink: 0;
  font-size: 24rpx;
  color: #3a3c3f;
}
.grow {
  flex: 1;
  min-width: 0;
}
.track {
  height: 16rpx;
  border-radius: 16rpx;
  background: #f0f0f0;
  overflow: hidden;
}
.fill {
  height: 100%;
  border-radius: 16rpx;
}
.pct {
  width: 56rpx;
  text-align: right;
  font-size: 24rpx;
  font-weight: 600;
  flex-shrink: 0;
}
.tag {
  font-size: 20rpx;
  padding: 4rpx 12rpx;
  border-radius: 999rpx;
  font-weight: 500;
  flex-shrink: 0;
}
</style>
