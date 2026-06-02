<template>
  <view class="page">
    <view class="section-title">基础信息</view>
    <view class="card">
      <view class="field">
        <text class="label">昵称</text>
        <input class="input" placeholder="例如：客厅绿萝" :value="nickname" @input="onInput('nickname', $event)" />
      </view>
      <view class="field">
        <text class="label">品种 / 学名</text>
        <input class="input" placeholder="例如：Epipremnum aureum" :value="speciesLabel" @input="onInput('speciesLabel', $event)" />
      </view>
    </view>

    <view class="section-title">环境与节奏</view>
    <view class="card">
      <view class="field">
        <text class="label">浇水频率偏好</text>
        <picker mode="selector" :range="waterLabels" :value="waterIndex" @change="onPicker('waterIndex', $event)">
          <view class="picker-value">{{ waterLabels[waterIndex] }}</view>
        </picker>
      </view>
      <view class="field field--row">
        <text class="label label--inline">室内养护</text>
        <switch color="#43A047" :checked="indoor" @change="onSwitch('indoor', $event)" />
      </view>
      <view class="field field--row">
        <text class="label label--inline">供暖环境</text>
        <switch color="#43A047" :checked="heating" @change="onSwitch('heating', $event)" />
      </view>
      <view class="field">
        <text class="label">光照条件</text>
        <picker mode="selector" :range="lightLabels" :value="lightIndex" @change="onPicker('lightIndex', $event)">
          <view class="picker-value">{{ lightLabels[lightIndex] }}</view>
        </picker>
      </view>
      <view class="field">
        <text class="label">盆土干湿（自评）</text>
        <picker mode="selector" :range="soilLabels" :value="soilIndex" @change="onPicker('soilIndex', $event)">
          <view class="picker-value">{{ soilLabels[soilIndex] }}</view>
        </picker>
      </view>
    </view>

    <view class="section-title">计划细节（可选）</view>
    <view class="card">
      <view class="field">
        <text class="label">科属</text>
        <input class="input" placeholder="例如：天南星科" :value="taxonFamily" @input="onInput('taxonFamily', $event)" />
      </view>
      <view class="field">
        <text class="label">养护难度</text>
        <input class="input" placeholder="新手 / 进阶 / 专家" :value="careDifficulty" @input="onInput('careDifficulty', $event)" />
      </view>
      <view class="field">
        <text class="label">参考浇水量（ml）</text>
        <input class="input" type="digit" placeholder="例如：200" :value="waterAmountMl" @input="onInput('waterAmountMl', $event)" />
      </view>
      <view class="field">
        <text class="label">常用肥料类型</text>
        <input class="input" placeholder="例如：观叶植物液肥" :value="fertilizerType" @input="onInput('fertilizerType', $event)" />
      </view>
      <view class="field">
        <text class="label">注意事项</text>
        <textarea class="textarea" placeholder="换盆、通风、忌暴晒等" :value="careTips" @input="onInput('careTips', $event)" maxlength="2000" />
      </view>
    </view>

    <view class="submit-wrap">
      <view class="submit-btn" @tap="onSubmit">{{ isEdit ? '保存修改' : '保存植物' }}</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { request } from "@/utils/request";

const plantId = ref("");
const isEdit = ref(false);
const nickname = ref("");
const speciesLabel = ref("");
const waterIndex = ref(1);
const waterLabels = ["低", "中", "高"];
const indoor = ref(true);
const heating = ref(false);
const lightIndex = ref(1);
const lightLabels = ["弱", "中", "强"];
const soilIndex = ref(0);
const soilLabels = ["不填（默认）", "很湿", "偏湿", "适中", "偏干", "很干"];
const taxonFamily = ref("");
const careDifficulty = ref("");
const waterAmountMl = ref("");
const fertilizerType = ref("");
const careTips = ref("");

const WATER_RANGE = ["low", "medium", "high"];
const LIGHT_RANGE = ["low", "medium", "high"];
const SOIL_VALUES: (string | null)[] = [null, "very_wet", "wet", "moderate", "dry", "very_dry"];

onLoad((options) => {
  if (options?.id) {
    plantId.value = options.id;
    isEdit.value = true;
    loadPlant(options.id);
  }
});

async function loadPlant(id: string) {
  try {
    const p: any = await request({ path: `/plants/${id}` });
    nickname.value = p.nickname || "";
    speciesLabel.value = p.speciesLabel || "";
    taxonFamily.value = p.taxonFamily || "";
    careDifficulty.value = p.careDifficulty || "";
    waterAmountMl.value = p.waterAmountMl != null ? String(p.waterAmountMl) : "";
    fertilizerType.value = p.fertilizerType || "";
    careTips.value = p.careTips || "";
    waterIndex.value = Math.max(0, WATER_RANGE.indexOf(p.waterPreference));
    indoor.value = Boolean(p.indoor);
    heating.value = Boolean(p.heating);
    lightIndex.value = Math.max(0, LIGHT_RANGE.indexOf(p.lightLevel));
    const si = SOIL_VALUES.indexOf(p.soilMoistureHint);
    soilIndex.value = si >= 0 ? si : 0;
  } catch {
    uni.showToast({ title: "加载失败", icon: "none" });
    setTimeout(() => uni.navigateBack(), 1500);
  }
}

function onInput(field: string, e: any) {
  const val = e.detail?.value ?? "";
  if (field === "nickname") nickname.value = val;
  else if (field === "speciesLabel") speciesLabel.value = val;
  else if (field === "taxonFamily") taxonFamily.value = val;
  else if (field === "careDifficulty") careDifficulty.value = val;
  else if (field === "waterAmountMl") waterAmountMl.value = val;
  else if (field === "fertilizerType") fertilizerType.value = val;
  else if (field === "careTips") careTips.value = val;
}

function onPicker(field: string, e: any) {
  const idx = Number(e.detail?.value ?? 0);
  if (field === "waterIndex") waterIndex.value = idx;
  else if (field === "lightIndex") lightIndex.value = idx;
  else if (field === "soilIndex") soilIndex.value = idx;
}

function onSwitch(field: string, e: any) {
  const val = Boolean(e.detail?.value ?? false);
  if (field === "indoor") indoor.value = val;
  else if (field === "heating") heating.value = val;
}

async function onSubmit() {
  if (!nickname.value.trim() || !speciesLabel.value.trim()) {
    uni.showToast({ title: "请填写昵称和品种", icon: "none" });
    return;
  }

  const body: Record<string, unknown> = {
    nickname: nickname.value.trim(),
    speciesLabel: speciesLabel.value.trim(),
    waterPreference: WATER_RANGE[waterIndex.value],
    indoor: indoor.value,
    heating: heating.value,
    lightLevel: LIGHT_RANGE[lightIndex.value],
  };

  const smh = SOIL_VALUES[soilIndex.value];
  if (smh != null) body.soilMoistureHint = smh;
  if (taxonFamily.value.trim()) body.taxonFamily = taxonFamily.value.trim();
  if (careDifficulty.value.trim()) body.careDifficulty = careDifficulty.value.trim();
  const wm = Number(waterAmountMl.value);
  if (waterAmountMl.value.trim() && Number.isFinite(wm) && wm > 0) body.waterAmountMl = Math.round(wm);
  if (fertilizerType.value.trim()) body.fertilizerType = fertilizerType.value.trim();
  if (careTips.value.trim()) body.careTips = careTips.value.trim();

  try {
    if (isEdit.value) {
      await request({ path: `/plants/${plantId.value}`, method: "PATCH", data: body });
      await request({ path: `/plants/${plantId.value}/plan/regenerate`, method: "POST", data: {} });
    } else {
      await request({ path: "/plants", method: "POST", data: body });
    }
    uni.showToast({ title: "已保存", icon: "success" });
    setTimeout(() => uni.navigateBack(), 800);
  } catch {
    uni.showToast({ title: "保存失败", icon: "none" });
  }
}
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
  padding: 8rpx 8rpx 12rpx;
  margin-bottom: 24rpx;
}
.section-title {
  font-size: 24rpx;
  font-weight: 700;
  color: #9e9e9e;
  text-transform: uppercase;
  margin: 16rpx 0 8rpx;
  letter-spacing: 2rpx;
}
.field {
  padding: 24rpx 20rpx;
  border-bottom: 1rpx solid #f5f5f5;
}
.field:last-child { border-bottom: none; }
.field--row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.label {
  display: block;
  font-size: 22rpx;
  font-weight: 700;
  color: #9e9e9e;
  text-transform: uppercase;
  letter-spacing: 1rpx;
  margin-bottom: 16rpx;
}
.field--row .label { margin-bottom: 0; }
.label--inline {
  font-size: 28rpx;
  font-weight: 600;
  color: #212121;
  text-transform: none;
  letter-spacing: 0;
}
.input {
  width: 100%;
  padding: 22rpx 24rpx;
  font-size: 30rpx;
  line-height: 1.2;
  min-height: 74rpx;
  color: #212121;
  background: #f5f5f5;
  border-radius: 12rpx;
  border: 1rpx solid rgba(0, 0, 0, 0.08);
  box-sizing: border-box;
}
.textarea {
  width: 100%;
  min-height: 160rpx;
  padding: 22rpx 24rpx;
  font-size: 28rpx;
  line-height: 1.5;
  color: #212121;
  background: #f5f5f5;
  border-radius: 12rpx;
  border: 1rpx solid rgba(0, 0, 0, 0.08);
  box-sizing: border-box;
}
.picker-value {
  padding: 22rpx 24rpx;
  font-size: 30rpx;
  color: #212121;
  background: #f5f5f5;
  border-radius: 12rpx;
  border: 1rpx solid rgba(0, 0, 0, 0.08);
}
.submit-wrap {
  margin-top: 48rpx;
  margin-bottom: 24rpx;
}
.submit-btn {
  width: 100%;
  text-align: center;
  padding: 28rpx 24rpx;
  border-radius: 20rpx;
  font-size: 30rpx;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, #43a047, #66bb6a);
  box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.06);
}
</style>
