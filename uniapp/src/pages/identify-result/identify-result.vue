<template>
  <view class="page">
    <view v-if="result" class="card result-card">
      <image v-if="imageBase64" class="result-img" :src="'data:image/jpeg;base64,' + imageBase64" mode="aspectFill"></image>
      <text class="result-species">{{ result.speciesLabel }}</text>
      <text v-if="result.confidence" class="result-conf">置信度：{{ result.confidence }}%</text>
      <text v-if="result.description" class="result-desc">{{ result.description }}</text>
      <view class="btn-row">
        <view class="btn btn--primary" @tap="onAddPlant">添加此植物</view>
        <view class="btn btn--ghost" @tap="onReIdentify">重新识别</view>
      </view>
    </view>
    <view v-else class="card hint-card">
      <text class="hint-text">暂无识别结果</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { chooseImageBase64 } from "@/utils/image";
import { request } from "@/utils/request";

const IDENTIFY_KEY = "identifyResult";
const IMAGE_KEY = "identifyImage";

const result = ref<any>(null);
const imageBase64 = ref("");

function loadResult() {
  try {
    const saved = uni.getStorageSync(IDENTIFY_KEY);
    result.value = typeof saved === "string" ? JSON.parse(saved) : saved;
  } catch { result.value = null; }
  try {
    imageBase64.value = uni.getStorageSync(IMAGE_KEY) || "";
  } catch { imageBase64.value = ""; }
}

function onAddPlant() {
  if (!result.value) return;
  const r = result.value;
  uni.navigateTo({
    url: `/pages/plant-edit/plant-edit?species=${encodeURIComponent(r.speciesLabel || "")}&description=${encodeURIComponent(r.description || "")}`,
  });
}

async function onReIdentify() {
  try {
    const base64 = await chooseImageBase64();
    uni.showLoading({ title: "识别中", mask: true });
    const data: any = await request({ path: "/plants/identify", method: "POST", data: { imageBase64: base64 } });
    const best = data?.best;
    if (!best || !best.name) {
      uni.showToast({ title: "未识别到植物", icon: "none" });
      return;
    }
    const r = {
      speciesLabel: best.name,
      confidence: best.score || "",
      description: best.baikeDescription || best.careSummary || "已识别到品种",
    };
    result.value = r;
    imageBase64.value = base64;
    uni.setStorageSync(IDENTIFY_KEY, r);
    uni.setStorageSync(IMAGE_KEY, base64);
    uni.showToast({ title: "识别成功", icon: "success" });
  } catch (e: any) {
    const code = e?.statusCode;
    const msg = e?.message || e?.errMsg || "";
    if (msg.includes("cancel") || msg.includes("no_image")) { /* cancelled */ }
    else if (code === 422) uni.showToast({ title: "未识别到植物", icon: "none" });
    else if (code === 502) uni.showToast({ title: "识别服务异常", icon: "none" });
    else if (code === 0 || !code) uni.showToast({ title: "网络连接失败", icon: "none" });
    else uni.showToast({ title: `识别失败（${code || ""}）`, icon: "none" });
  } finally {
    uni.hideLoading();
  }
}

onShow(() => { loadResult(); });
</script>

<style scoped>
.page { padding: 24rpx; }
.card {
  background: #fff;
  border-radius: 20rpx;
  border: 1rpx solid rgba(0,0,0,0.06);
  box-shadow: 0 8rpx 32rpx rgba(0,0,0,0.04);
  padding: 28rpx;
  margin-bottom: 24rpx;
}
.result-img {
  width: 100%;
  height: 400rpx;
  border-radius: 16rpx;
  margin-bottom: 24rpx;
  background: #f5f5f5;
}
.result-species {
  display: block;
  font-size: 32rpx;
  font-weight: 700;
  color: #212121;
  margin-bottom: 8rpx;
}
.result-conf {
  display: block;
  font-size: 26rpx;
  color: #616161;
  margin-bottom: 8rpx;
}
.result-desc {
  display: block;
  font-size: 26rpx;
  color: #616161;
  line-height: 1.55;
  margin-bottom: 24rpx;
}
.btn-row {
  display: flex;
  gap: 16rpx;
}
.btn {
  flex: 1;
  text-align: center;
  padding: 20rpx;
  border-radius: 16rpx;
  font-size: 28rpx;
  font-weight: 600;
}
.btn--primary { background: #43a047; color: #fff; }
.btn--ghost { background: #f5f5f5; color: #616161; }
.hint-card {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200rpx;
}
.hint-text { font-size: 26rpx; color: #9e9e9e; }
</style>
