<template>
  <view class="page">
    <view class="hero">
      <text class="hero-title">问题诊断</text>
      <text class="hero-desc">可拍照评估盆土干湿度与肥力，或勾选症状做规则参考。结果仅供参考。</text>
    </view>

    <view class="expert-card card">
      <text class="expert-title">人工 / 专家</text>
      <text class="expert-body">复杂病虫害或整株萎蔫时，建议联系线下园艺师或平台客服，并附上清晰照片与环境说明。</text>
    </view>

    <view v-if="llmDiagnoseEnabled" class="soil-panel card" id="soil-panel">
      <text class="soil-panel-title">🪴 土壤诊断</text>
      <text class="soil-panel-hint">拍摄盆土特写照片，AI 评估干湿度与肥力状态</text>
      <text class="soil-panel-hint">{{ llmImageLabel }}</text>
      <view class="soil-btn-row">
        <view class="btn btn--primary" @tap="onPickImage">选择 / 拍摄盆土照片</view>
        <view :class="['btn', 'btn--ghost', !llmImageBase64 ? 'btn--disabled' : '']" @tap="onSubmitLlm">评估土壤</view>
      </view>
    </view>
    <view v-else class="muted-card card">当前未启用视觉大模型诊断（服务器未配置 DIAGNOSE_LLM_API_KEY）。仍可使用下方规则诊断。</view>

    <view v-if="soilResult" class="soil-result card">
      <text class="soil-result-title">土壤评估结果</text>
      <view class="soil-row">
        <text class="soil-label">干湿度</text>
        <text :class="['soil-tag', 'soil-tag--' + soilResult.moistureKey]">{{ soilResult.moistureLabel }}</text>
        <text v-if="soilResult.confidence" class="soil-conf">置信度 {{ soilResult.confidence }}%</text>
      </view>
      <view class="soil-row">
        <text class="soil-label">肥力</text>
        <text class="soil-tag soil-tag--fertility">{{ soilResult.fertilityLabel }}</text>
      </view>
      <view v-if="soilResult.rationale" class="soil-block">
        <text class="soil-block-title">分析依据</text>
        <text class="soil-block-text">{{ soilResult.rationale }}</text>
      </view>
      <view v-if="soilResult.wateringTip" class="soil-block">
        <text class="soil-block-title">养护建议</text>
        <text class="soil-block-text soil-block-tip">{{ soilResult.wateringTip }}</text>
      </view>
    </view>

    <text class="section-title">规则诊断</text>
    <view class="card">
      <view class="field">
        <text class="field-label">关联植物（可选）</text>
        <picker mode="selector" :range="plantLabels" :value="plantPickerIndex" @change="onPlantPickerChange">
          <view class="picker-value">{{ plantLabels[plantPickerIndex] }}</view>
        </picker>
      </view>

      <view v-for="group in symptomGroups" :key="group.group" class="symptom-group">
        <text class="symptom-group-title">{{ group.group }}</text>
        <label v-for="sym in group.items" :key="sym.id" class="symptom-item">
          <checkbox :checked="sym.checked" color="#2a4d3a" @tap="onSymptomTap(sym.id)" />
          <text class="symptom-text">{{ sym.label }}</text>
        </label>
      </view>

      <view :class="['submit-btn', submitDisabled ? 'submit-btn--disabled' : '']" @tap="onSubmit">
        生成参考意见
      </view>
    </view>

    <view v-if="result" class="result-section">
      <text class="section-title">参考意见</text>
      <view v-for="cause in result.causes" :key="cause.id" class="cause-card card">
        <text class="cause-title">{{ cause.title }}</text>
        <text class="cause-summary">{{ cause.summary }}</text>
        <text v-for="(act, i) in cause.actions" :key="i" class="cause-action">· {{ act }}</text>
      </view>
      <view v-for="(tip, i) in result.contextTips" :key="i" class="tip-block">{{ tip }}</view>
      <view v-if="result.relatedArticles && result.relatedArticles.length" class="related-card card">
        <text class="related-title">延伸阅读</text>
        <view v-for="article in result.relatedArticles" :key="article.slug" class="related-row" @tap="onOpenArticle(article.slug)">
          <text class="related-row-title">{{ article.title }}</text>
          <text v-if="article.summary" class="related-row-sum">{{ article.summary }}</text>
        </view>
      </view>
      <text class="disclaimer">{{ result.disclaimer }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { request } from "@/utils/request";
import { chooseImageBase64 } from "@/utils/image";

const MOISTURE_MAP: Record<string, string> = {
  very_wet: "很湿", wet: "偏湿", moderate: "适中", dry: "偏干", very_dry: "很干",
};

const FERTILITY_MAP: Record<string, string> = {
  unknown: "未知", depleted: "贫瘠", adequate: "适中", rich: "肥沃",
};

interface SymptomItem {
  id: string;
  label: string;
  group: string;
  checked: boolean;
}

interface SymptomGroup {
  group: string;
  items: SymptomItem[];
}

const symptomGroups = ref<SymptomGroup[]>([]);
const plantLabels = ref<string[]>(["不关联植物"]);
const plantIds = ref<string[]>([""]);
const plantPickerIndex = ref(0);
const selectedIds = ref<string[]>([]);
const submitDisabled = computed(() => selectedIds.value.length === 0);
const result = ref<any>(null);
const llmDiagnoseEnabled = ref(false);
const llmImageBase64 = ref("");
const llmImageLabel = ref("");
const soilResult = ref<any>(null);

onLoad(async (options) => {
  await Promise.all([loadCatalog(), loadPlants()]);
  if (options) {
    const plantId = (options as any).plantId;
    if (plantId) {
      const idx = plantIds.value.indexOf(plantId);
      if (idx >= 0) plantPickerIndex.value = idx;
    }
    if ((options as any).mode === "soil") {
      nextTick(() => {
        const query = uni.createSelectorQuery();
        query.select("#soil-panel").boundingClientRect((rect: any) => {
          if (rect) uni.pageScrollTo({ scrollTop: rect.top - 20, duration: 300 });
        }).exec();
      });
    }
  }
});

async function loadCatalog() {
  try {
    const data: any = await request({ path: "/diagnose/catalog" });
    const list = (data && data.symptoms) || [];
    llmDiagnoseEnabled.value = Boolean(data && data.llmDiagnoseEnabled);
    const groups = groupSymptoms(list);
    symptomGroups.value = groups;
  } catch {
    uni.showToast({ title: "加载症状失败", icon: "none" });
  }
}

async function loadPlants() {
  try {
    const raw: any[] = await request({ path: "/plants" });
    const plants = Array.isArray(raw) ? raw : [];
    plantLabels.value = ["不关联植物"].concat(plants.map((p) => p.nickname || p.speciesLabel || "植物"));
    plantIds.value = [""].concat(plants.map((p) => p.id));
  } catch {}
}

function groupSymptoms(list: any[]): SymptomGroup[] {
  const m = new Map<string, SymptomItem[]>();
  for (const s of list) {
    const g = s.group || "其它";
    if (!m.has(g)) m.set(g, []);
    m.get(g)!.push({ ...s, checked: false });
  }
  return Array.from(m.entries()).map(([group, items]) => ({ group, items }));
}

function onPlantPickerChange(e: any) {
  plantPickerIndex.value = Number(e.detail?.value ?? 0);
}

function onSymptomTap(id: string) {
  const idx = selectedIds.value.indexOf(id);
  if (idx >= 0) {
    selectedIds.value.splice(idx, 1);
  } else {
    selectedIds.value.push(id);
  }
  for (const g of symptomGroups.value) {
    for (const s of g.items) {
      s.checked = selectedIds.value.includes(s.id);
    }
  }
}

function onPickImage() {
  chooseImageBase64()
    .then((base64) => {
      llmImageBase64.value = base64;
      llmImageLabel.value = "已选择照片，可提交 AI 分析";
    })
    .catch(() => {
      uni.showToast({ title: "未选择图片", icon: "none" });
    });
}

async function onSubmitLlm() {
  if (!llmImageBase64.value || llmImageBase64.value.length < 80) {
    uni.showToast({ title: "请先选择清晰盆土照片", icon: "none" });
    return;
  }
  uni.showLoading({ title: "AI 分析中", mask: true });
  try {
    const plantId = plantIds.value[plantPickerIndex.value] || undefined;
    const data: any = await request({
      path: "/soil/estimate-photo",
      method: "POST",
      data: { imageBase64: llmImageBase64.value, plantId },
    });
    const moistureKey = data?.soilMoistureHint || "moderate";
    soilResult.value = {
      moistureKey,
      moistureLabel: MOISTURE_MAP[moistureKey] || moistureKey,
      fertilityLabel: FERTILITY_MAP[data?.soilFertilityHint] || data?.soilFertilityHint || "未知",
      rationale: data?.rationale || "",
      wateringTip: data?.wateringTip || "",
      confidence: data?.confidence ? Math.round(data.confidence * 100) : 0,
    };
  } catch (e: any) {
    const code = e?.statusCode;
    const msg = code === 503 ? "未启用 AI 诊断" : code === 502 ? "AI 服务异常" : "AI 请求失败";
    uni.showToast({ title: msg, icon: "none" });
  } finally {
    uni.hideLoading();
  }
}

async function onSubmit() {
  if (!selectedIds.value.length) {
    uni.showToast({ title: "请至少选一项症状", icon: "none" });
    return;
  }
  const plantId = plantIds.value[plantPickerIndex.value] || undefined;
  const body: any = { symptomIds: selectedIds.value };
  if (plantId) body.plantId = plantId;
  uni.showLoading({ title: "分析中", mask: true });
  try {
    const data = await request({ path: "/diagnose", method: "POST", data: body });
    result.value = data;
    uni.pageScrollTo({ scrollTop: 0, duration: 300 });
  } catch {
    uni.showToast({ title: "请求失败", icon: "none" });
  } finally {
    uni.hideLoading();
  }
}

function onOpenArticle(slug: string) {
  if (!slug) return;
  uni.navigateTo({ url: `/pages/knowledge/detail?id=${encodeURIComponent(slug)}` });
}
</script>

<style scoped>
.page { padding: 24rpx; padding-bottom: calc(24rpx + env(safe-area-inset-bottom)); }
.card { background: #fff; border-radius: 20rpx; border: 1rpx solid rgba(0,0,0,0.06); box-shadow: 0 8rpx 32rpx rgba(0,0,0,0.04); padding: 28rpx; margin-bottom: 24rpx; }
.hero { margin-bottom: 24rpx; }
.hero-title { font-size: 36rpx; font-weight: 800; color: #212121; display: block; margin-bottom: 8rpx; }
.hero-desc { font-size: 26rpx; color: #9e9e9e; line-height: 1.5; }
.expert-card { padding: 28rpx 28rpx 32rpx; }
.expert-title { display: block; font-size: 28rpx; font-weight: 800; color: #212121; margin-bottom: 10rpx; }
.expert-body { display: block; font-size: 26rpx; line-height: 1.55; color: #616161; }
.section-title { font-size: 28rpx; font-weight: 700; color: #212121; margin: 16rpx 0 12rpx; display: block; }
.soil-panel { padding: 28rpx 28rpx 32rpx; }
.soil-panel-title { display: block; font-size: 30rpx; font-weight: 800; color: #212121; margin-bottom: 8rpx; }
.soil-panel-hint { display: block; font-size: 24rpx; color: #9e9e9e; margin-bottom: 20rpx; line-height: 1.45; }
.soil-btn-row { display: flex; flex-wrap: wrap; gap: 16rpx; }
.btn { padding: 16rpx 28rpx; border-radius: 999rpx; font-size: 26rpx; font-weight: 600; }
.btn--primary { background: #43a047; color: #f4faf6; }
.btn--ghost { border: 2rpx solid #e0e0e0; color: #43a047; background: #fff; }
.btn--disabled { opacity: 0.45; pointer-events: none; }
.muted-card { padding: 28rpx; font-size: 26rpx; color: #616161; line-height: 1.55; }
.soil-result { background: #f8f6f0; border: 1rpx solid rgba(139,119,90,0.2); }
.soil-result-title { display: block; font-size: 28rpx; font-weight: 800; color: #5d4a2e; margin-bottom: 16rpx; }
.soil-row { display: flex; align-items: center; gap: 12rpx; margin-bottom: 12rpx; flex-wrap: wrap; }
.soil-label { font-size: 26rpx; color: #9e9e9e; font-weight: 600; min-width: 5em; }
.soil-tag { display: inline-flex; align-items: center; padding: 4rpx 18rpx; border-radius: 999rpx; font-size: 24rpx; font-weight: 700; }
.soil-tag--very_wet, .soil-tag--wet { background: #d4edda; color: #155724; }
.soil-tag--moderate { background: #fff3cd; color: #856404; }
.soil-tag--dry, .soil-tag--very_dry { background: #f8d7da; color: #721c24; }
.soil-tag--fertility { background: #e2e3f0; color: #383d6e; }
.soil-conf { font-size: 22rpx; color: #9e9e9e; }
.soil-block { margin-top: 16rpx; padding-top: 14rpx; border-top: 1rpx solid #e0e0e0; }
.soil-block-title { display: block; font-size: 26rpx; font-weight: 700; color: #212121; margin-bottom: 8rpx; }
.soil-block-text { display: block; font-size: 24rpx; color: #616161; line-height: 1.6; }
.soil-block-tip { padding: 14rpx 18rpx; background: #f0f9f4; border-radius: 12rpx; color: #2d6a4f; }
.field { margin-bottom: 16rpx; }
.field-label { display: block; font-size: 22rpx; font-weight: 700; letter-spacing: 0.05em; color: #9e9e9e; text-transform: uppercase; margin-bottom: 14rpx; }
.picker-value { padding: 22rpx 24rpx; font-size: 28rpx; color: #212121; background: #fafafa; border-radius: 12rpx; border: 1rpx solid #e0e0e0; }
.symptom-group { margin-bottom: 8rpx; }
.symptom-group-title { display: block; font-size: 24rpx; font-weight: 800; color: #43a047; margin: 28rpx 0 12rpx; letter-spacing: 0.04em; }
.symptom-item { display: flex; align-items: flex-start; padding: 20rpx 0; border-bottom: 1rpx solid #f5f5f5; }
.symptom-text { flex: 1; margin-left: 16rpx; font-size: 28rpx; color: #212121; line-height: 1.45; }
.submit-btn { margin-top: 32rpx; text-align: center; padding: 26rpx 24rpx; border-radius: 16rpx; font-size: 30rpx; font-weight: 700; color: #f4faf6; background: linear-gradient(135deg, #43a047, #66bb6a); }
.submit-btn--disabled { opacity: 0.45; pointer-events: none; }
.result-section { padding-bottom: 48rpx; }
.cause-card { padding: 28rpx; border-left: 6rpx solid #66bb6a; }
.cause-title { display: block; font-size: 32rpx; font-weight: 800; color: #212121; margin-bottom: 12rpx; }
.cause-summary { display: block; font-size: 26rpx; color: #616161; line-height: 1.55; margin-bottom: 16rpx; }
.cause-action { display: block; font-size: 26rpx; color: #616161; line-height: 1.55; padding-left: 4rpx; margin-bottom: 6rpx; }
.tip-block { font-size: 26rpx; color: #1565c0; background: #e3f2fd; padding: 18rpx 20rpx; border-radius: 12rpx; line-height: 1.5; margin-bottom: 16rpx; }
.related-card { padding: 24rpx 28rpx 28rpx; }
.related-title { display: block; font-size: 28rpx; font-weight: 800; color: #212121; margin-bottom: 16rpx; }
.related-row { padding: 20rpx 0; border-bottom: 1rpx solid #f5f5f5; }
.related-row:last-child { border-bottom: none; }
.related-row-title { display: block; font-size: 28rpx; font-weight: 600; color: #43a047; }
.related-row-sum { display: block; font-size: 24rpx; color: #616161; line-height: 1.45; margin-top: 8rpx; }
.disclaimer { display: block; font-size: 22rpx; color: #9e9e9e; line-height: 1.5; margin-top: 16rpx; }
</style>
