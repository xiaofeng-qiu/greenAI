<template>
  <view class="page">
    <view v-if="result" class="card">
      <image v-if="imageBase64" class="result-img" :src="'data:image/jpeg;base64,' + imageBase64" mode="aspectFill"></image>
      <text class="result-title">土壤评估结果</text>
      <view class="soil-row">
        <text class="soil-label">干湿度</text>
        <text :class="['soil-tag', 'soil-tag--' + result.moistureKey]">{{ result.moistureLabel }}</text>
        <text v-if="result.confidence" class="soil-conf">置信度 {{ result.confidence }}%</text>
      </view>
      <view class="soil-row">
        <text class="soil-label">肥力</text>
        <text class="soil-tag soil-tag--fertility">{{ result.fertilityLabel }}</text>
      </view>
      <view v-if="result.rationale" class="soil-block">
        <text class="soil-block-title">分析依据</text>
        <text class="soil-block-text">{{ result.rationale }}</text>
      </view>
      <view v-if="result.wateringTip" class="soil-block">
        <text class="soil-block-title">养护建议</text>
        <text class="soil-block-text soil-block-tip">{{ result.wateringTip }}</text>
      </view>
      <view class="btn-row">
        <view class="btn btn--primary" @tap="onReAssess">重新评估</view>
      </view>
    </view>
    <view v-else class="card hint-card">
      <text class="hint-text">暂无土壤评估结果</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { chooseImageBase64 } from "@/utils/image";
import { request } from "@/utils/request";

const SOIL_KEY = "soilResult";
const IMAGE_KEY = "soilImage";

const result = ref<any>(null);
const imageBase64 = ref("");

function loadResult() {
  try {
    const saved = uni.getStorageSync(SOIL_KEY);
    result.value = typeof saved === "string" ? JSON.parse(saved) : saved;
  } catch { result.value = null; }
  try {
    imageBase64.value = uni.getStorageSync(IMAGE_KEY) || "";
  } catch { imageBase64.value = ""; }
}

async function onReAssess() {
  try {
    const base64 = await chooseImageBase64();
    uni.showLoading({ title: "分析中", mask: true });
    const data: any = await request({ path: "/soil/estimate-photo", method: "POST", data: { imageBase64: base64 } });
    const moistureMap: Record<string, string> = { very_wet: "很湿", wet: "偏湿", moderate: "适中", dry: "偏干", very_dry: "很干" };
    const moistureKey = data?.soilMoistureHint || "moderate";
    const r = {
      moistureKey,
      moistureLabel: moistureMap[moistureKey] || moistureKey,
      fertilityLabel: data?.soilFertilityHint || "未知",
      rationale: data?.rationale || "",
      wateringTip: data?.wateringTip || "",
      confidence: data?.confidence ? Math.round(data.confidence * 100) : 0,
    };
    result.value = r;
    imageBase64.value = base64;
    uni.setStorageSync(SOIL_KEY, r);
    uni.setStorageSync(IMAGE_KEY, base64);
    uni.showToast({ title: "分析完成", icon: "success" });
  } catch (e: any) {
    const detail = e?.data?.detail || "";
    if (e?.statusCode === 502) uni.showToast({ title: detail || "AI 服务异常", icon: "none" });
    else uni.showToast({ title: "请求失败", icon: "none" });
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
.result-title {
  display: block;
  font-size: 28rpx;
  font-weight: 800;
  color: #5d4a2e;
  margin-bottom: 16rpx;
}
.soil-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 12rpx;
  flex-wrap: wrap;
}
.soil-label {
  font-size: 26rpx;
  color: #9e9e9e;
  font-weight: 600;
  min-width: 5em;
}
.soil-tag {
  display: inline-flex;
  align-items: center;
  padding: 4rpx 18rpx;
  border-radius: 999rpx;
  font-size: 24rpx;
  font-weight: 700;
}
.soil-tag--very_wet, .soil-tag--wet { background: #d4edda; color: #155724; }
.soil-tag--moderate { background: #fff3cd; color: #856404; }
.soil-tag--dry, .soil-tag--very_dry { background: #f8d7da; color: #721c24; }
.soil-tag--fertility { background: #e2e3f0; color: #383d6e; }
.soil-conf {
  font-size: 22rpx;
  color: #9e9e9e;
}
.soil-block {
  margin-top: 16rpx;
  padding-top: 14rpx;
  border-top: 1rpx solid #e0e0e0;
}
.soil-block-title {
  display: block;
  font-size: 26rpx;
  font-weight: 700;
  color: #212121;
  margin-bottom: 8rpx;
}
.soil-block-text {
  display: block;
  font-size: 24rpx;
  color: #616161;
  line-height: 1.6;
}
.soil-block-tip {
  padding: 14rpx 18rpx;
  background: #f0f9f4;
  border-radius: 12rpx;
  color: #2d6a4f;
}
.btn-row {
  margin-top: 24rpx;
}
.btn {
  text-align: center;
  padding: 20rpx;
  border-radius: 16rpx;
  font-size: 28rpx;
  font-weight: 600;
}
.btn--primary { background: #43a047; color: #fff; }
.hint-card {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200rpx;
}
.hint-text { font-size: 26rpx; color: #9e9e9e; }
</style>
