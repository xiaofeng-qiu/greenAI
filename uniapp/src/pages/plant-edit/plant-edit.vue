<template>
  <view class="page">
    <view v-if="!isEdit && !photoPreview" class="identify-btn" @tap="onIdentify">
      <text class="identify-ico">📷</text>
      <text class="identify-text">拍照识别植物，自动填写信息</text>
    </view>
    <view v-if="!isEdit && photoPreview" class="photo-preview" @tap="onIdentify">
      <image class="photo-img" :src="photoPreview" mode="aspectFill" />
      <text class="photo-retake">重新拍照</text>
    </view>

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

    <template v-if="deviceLabels.length > 1">
      <text class="section-title">绑定设备（可选）</text>
      <view class="card">
        <view class="field">
          <text class="label">关联传感器</text>
          <picker mode="selector" :range="deviceLabels" :value="deviceIndex" @change="onDeviceChange">
            <view class="picker-value">{{ deviceLabels[deviceIndex] }}</view>
          </picker>
        </view>
      </view>
    </template>

    <view class="submit-wrap">
      <view class="submit-btn" @tap="onSubmit">{{ isEdit ? '保存修改' : '保存植物' }}</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { request, clearToken } from "@/utils/request";
import { chooseImageBase64 } from "@/utils/image";

interface Device {
  id: string;
  hardwareId: string;
  label: string | null;
  plantId: string | null;
  lastSeenAt: string | null;
}

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

const devices = ref<Device[]>([]);
const deviceLabels = ref<string[]>(["无"]);
const deviceIndex = ref(0);
const boundDeviceId = ref("");
/** Set after create, triggers assessment sheet */
const newPlantId = ref("");
/** Devices in picker order: [null, boundDevice?, ...unbound] */
const orderedDevices = ref<(Device | null)[]>([null]);

const photoPreview = ref("");
const identifyImageBase64 = ref("");
const PHOTO_STORAGE_PREFIX = "plantPhoto_";

const WATER_RANGE = ["low", "medium", "high"];
const LIGHT_RANGE = ["low", "medium", "high"];
const SOIL_VALUES: (string | null)[] = [null, "very_wet", "wet", "moderate", "dry", "very_dry"];

onLoad((options) => {
  if (options?.id) {
    plantId.value = options.id;
    isEdit.value = true;
    loadPlant(options.id);
  }
  if (options?.species) {
    speciesLabel.value = decodeURIComponent(options.species);
  }
  if (options?.description) {
    careTips.value = decodeURIComponent(options.description);
  }
  loadDevices();
});

async function loadDevices() {
  try {
    const list: Device[] = await request({ path: "/devices" });
    devices.value = list;
    buildDevicePicker();
  } catch {}
}

function buildDevicePicker() {
  const list = devices.value;
  const bound = list.find(d => d.plantId === plantId.value);
  const unbound = list.filter(d => !d.plantId);
  const ordered: (Device | null)[] = [null];
  if (bound) {
    boundDeviceId.value = bound.id;
    ordered.push(bound);
  }
  ordered.push(...unbound);
  orderedDevices.value = ordered;
  deviceLabels.value = ordered.map(d => {
    if (!d) return "无";
    const name = d.label || d.hardwareId;
    if (d.plantId === plantId.value && d.plantId) return `${name}（已绑定）`;
    return name;
  });
  deviceIndex.value = bound ? ordered.indexOf(bound) : 0;
}

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

/** Returns device to bind (bind=true) or unbind (bind=false), or undefined if unchanged */
function getSelectedDevice(): { id: string; bind: boolean } | undefined {
  const sel = orderedDevices.value[deviceIndex.value];
  if (!sel) {
    // "无" selected — unbind if currently bound
    if (boundDeviceId.value) return { id: boundDeviceId.value, bind: false };
    return undefined;
  }
  if (sel.plantId === plantId.value) return undefined; // same binding
  return { id: sel.id, bind: true };
}

function onPicker(field: string, e: any) {
  const idx = Number(e.detail?.value ?? 0);
  if (field === "waterIndex") waterIndex.value = idx;
  else if (field === "lightIndex") lightIndex.value = idx;
  else if (field === "soilIndex") soilIndex.value = idx;
}

function onDeviceChange(e: any) {
  deviceIndex.value = Number(e.detail?.value ?? 0);
}

async function onIdentify() {
  try {
    const base64 = await chooseImageBase64();
    photoPreview.value = `data:image/jpeg;base64,${base64}`;
    identifyImageBase64.value = base64;
    uni.showLoading({ title: "识别中", mask: true });
    const data: any = await request({ path: "/plants/identify", method: "POST", data: { imageBase64: base64 } });
    const best = data?.best;
    if (!best || !best.name) {
      uni.showToast({ title: "未识别到植物", icon: "none" });
      return;
    }
    nickname.value = best.name;
    speciesLabel.value = best.name;
    if (best.taxonFamily) taxonFamily.value = best.taxonFamily;
    if (best.careDifficulty) careDifficulty.value = best.careDifficulty;
    if (best.careSummary) careTips.value = best.careSummary;
    uni.showToast({ title: `识别成功：${best.name}`, icon: "success" });
  } catch (e: any) {
    const code = e?.statusCode;
    const msg = e?.message || e?.errMsg || "";
    if (msg.includes("cancel") || msg.includes("no_image")) { photoPreview.value = ""; identifyImageBase64.value = ""; return; }
    if (code === 503) uni.showToast({ title: "服务端未配置识别", icon: "none" });
    else if (code === 422) uni.showToast({ title: "未识别到植物", icon: "none" });
    else if (code === 502) uni.showToast({ title: "识别服务异常", icon: "none" });
    else if (code === 400) uni.showToast({ title: "图片数据异常", icon: "none" });
    else if (code === 401) { clearToken(); uni.showToast({ title: "登录失效，请重新登录", icon: "none" }); }
    else if (code === 0 || !code) uni.showToast({ title: "网络连接失败", icon: "none" });
    else uni.showToast({ title: "识别失败", icon: "none" });
  } finally {
    uni.hideLoading();
  }
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

  // Check duplicate nickname
  if (!isEdit.value) {
    try {
      const existing: any[] = await request({ path: "/plants" });
      const dup = existing.find(p => p.nickname === nickname.value.trim());
      if (dup) {
        uni.showToast({ title: "昵称已存在，请修改", icon: "none" });
        return;
      }
    } catch {}
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
      // Handle device binding/unbinding
      const selectedDevice = getSelectedDevice();
      if (selectedDevice !== undefined) {
        await request({
          path: `/devices/${selectedDevice.id}`,
          method: "PATCH",
          data: { plantId: selectedDevice.bind ? plantId.value : null },
        });
      }
      uni.showToast({ title: "已保存", icon: "success" });
      setTimeout(() => uni.navigateBack(), 800);
    } else {
      const plant: any = await request({ path: "/plants", method: "POST", data: body });
      newPlantId.value = plant.id;
      // Bind device if selected
      const sel = orderedDevices.value[deviceIndex.value];
      if (sel) {
        try {
          await request({ path: `/devices/${sel.id}`, method: "PATCH", data: { plantId: plant.id } });
        } catch {}
      }
      // Save photo to local storage for care list display
      if (identifyImageBase64.value) {
        try { uni.setStorageSync(PHOTO_STORAGE_PREFIX + plant.id, identifyImageBase64.value); } catch {}
      }
      showAssessmentSheet();
    }
  } catch {
    uni.showToast({ title: "保存失败", icon: "none" });
  }
}

function showAssessmentSheet() {
  uni.showActionSheet({
    itemList: ["土壤拍照评估", "植物拍照诊断", "绑定硬件传感器", "稍后再说"],
    success: (res) => {
      if (res.tapIndex === 0) onSoilAssess();
      else if (res.tapIndex === 1) onPhotoDiagnose();
      else if (res.tapIndex === 2) onBindDevice();
      else goBack();
    },
    fail: () => goBack(),
  });
}

async function onSoilAssess() {
  try {
    const base64 = await chooseImageBase64();
    uni.showLoading({ title: "评估中", mask: true });
    await request({ path: "/soil/estimate-photo", method: "POST", data: { imageBase64: base64, plantId: newPlantId.value } });
    await request({ path: `/plants/${newPlantId.value}/plan/regenerate`, method: "POST", data: {} });
    uni.showToast({ title: "评估完成，已创建养护计划", icon: "success" });
  } catch {
    uni.showToast({ title: "评估失败，可稍后补充", icon: "none" });
  } finally {
    uni.hideLoading();
    goBack();
  }
}

async function onPhotoDiagnose() {
  uni.navigateTo({ url: `/pages/diagnose/diagnose?plantId=${newPlantId.value}` });
}

function onBindDevice() {
  uni.navigateTo({ url: `/pages/plant-edit/plant-edit?id=${newPlantId.value}` });
}

function goBack() {
  setTimeout(() => uni.navigateBack(), 400);
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
.identify-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  padding: 28rpx;
  border-radius: 20rpx;
  background: linear-gradient(135deg, #e8f5e9, #f1f8e9);
  border: 2rpx dashed #a5d6a7;
  margin-bottom: 24rpx;
}
.identify-ico {
  font-size: 40rpx;
}
.identify-text {
  font-size: 28rpx;
  font-weight: 600;
  color: #2e7d32;
}
.photo-preview {
  position: relative;
  margin-bottom: 24rpx;
  border-radius: 20rpx;
  overflow: hidden;
}
.photo-img {
  width: 100%;
  height: 360rpx;
  display: block;
  background: #f5f5f5;
}
.photo-retake {
  position: absolute;
  bottom: 16rpx;
  right: 16rpx;
  background: rgba(0,0,0,0.6);
  color: #fff;
  font-size: 24rpx;
  padding: 8rpx 20rpx;
  border-radius: 999rpx;
}
</style>
