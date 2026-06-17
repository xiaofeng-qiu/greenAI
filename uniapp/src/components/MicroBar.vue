<template>
  <view class="wrap" :class="flex ? 'wrap--flex' : ''">
    <view class="inner" :style="{ width: value + '%', backgroundColor: color }" />
  </view>
</template>

<script setup>
defineProps({
  value: { type: Number, default: 0 },
  color: { type: String, default: "#1e7a4a" },
  flex: { type: Boolean, default: false },
});
</script>

<style scoped>
.wrap {
  height: 4rpx;
  border-radius: 4rpx;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.1);
  width: 56rpx;
}
.wrap--flex {
  flex: 1;
  width: auto;
  background: #eef2ee;
}
.inner {
  height: 100%;
  border-radius: 4rpx;
}
</style>
