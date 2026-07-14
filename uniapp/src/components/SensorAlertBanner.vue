<template>
  <view v-if="visible" class="banner" :class="severity">
    <text class="icon">{{ severity === "danger" ? "🚨" : "⚠️" }}</text>
    <view class="content">
      <text class="title">传感器异常</text>
      <text class="message">{{ message }}</text>
    </view>
    <text class="close" @click="hide">×</text>
  </view>
</template>

<script setup>
import { onMounted, onUnmounted, ref } from "vue";

const visible = ref(false);
const message = ref("");
const severity = ref("warning");
let hideTimer = null;

function show(payload = {}) {
  message.value = payload.message || "检测到传感器异常，请及时查看";
  severity.value = payload.severity === "danger" ? "danger" : "warning";
  visible.value = true;
  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = setTimeout(hide, 6000);
}

function hide() {
  visible.value = false;
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
}

onMounted(() => {
  uni.$on("sensor-alert-banner", show);
});

onUnmounted(() => {
  uni.$off("sensor-alert-banner", show);
  if (hideTimer) clearTimeout(hideTimer);
});
</script>

<style scoped>
.banner {
  position: fixed;
  top: calc(env(safe-area-inset-top) + 20rpx);
  left: 24rpx;
  right: 24rpx;
  z-index: 9999;
  display: flex;
  align-items: flex-start;
  gap: 18rpx;
  padding: 24rpx 24rpx;
  border: 2rpx solid #efb64d;
  border-radius: 20rpx;
  background: #fff8e8;
  box-shadow: 0 12rpx 36rpx rgba(79, 54, 12, 0.2);
}
.banner.danger {
  border-color: #df7769;
  background: #fff0ee;
  box-shadow: 0 12rpx 36rpx rgba(126, 35, 25, 0.22);
}
.icon {
  flex-shrink: 0;
  font-size: 34rpx;
}
.content {
  flex: 1;
  min-width: 0;
}
.title,
.message {
  display: block;
}
.title {
  color: #6c4a0c;
  font-size: 25rpx;
  font-weight: 700;
}
.danger .title {
  color: #9d3024;
}
.message {
  margin-top: 6rpx;
  color: #745e32;
  font-size: 23rpx;
  line-height: 1.45;
}
.danger .message {
  color: #81433c;
}
.close {
  flex-shrink: 0;
  padding: 0 4rpx;
  color: #8b8171;
  font-size: 38rpx;
  line-height: 1;
}
</style>
