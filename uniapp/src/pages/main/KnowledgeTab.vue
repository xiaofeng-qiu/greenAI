<template>
  <view class="page">
    <scroll-view scroll-y class="scroll" :show-scrollbar="false">
      <view class="head">
        <text class="h-title">植物知识库</text>
        <scroll-view scroll-x class="cat-scroll hide-scrollbar" :show-scrollbar="false">
          <view class="cat-row">
            <view v-for="c in CATEGORIES" :key="c" class="cat" :class="{ on: category === c }" @click="category = c">
              <text class="cat-txt">{{ c }}</text>
            </view>
          </view>
        </scroll-view>
      </view>
      <view class="search-row px-32 py-24">
        <view class="search-box grow row">
          <text class="s-ico">🔍</text>
          <input class="inp grow" v-model="query" placeholder="搜索文章..." placeholder-class="ph" />
        </view>
        <text class="cnt">{{ filtered.length }} 篇</text>
      </view>
      <view class="articles px-32 pb-24">
        <view v-for="a in filtered" :key="a.id" class="art row" @click="openArticle(a.id)">
          <view class="art-ico">{{ a.emoji }}</view>
          <view class="grow min0">
            <text class="art-title">{{ a.title }}</text>
            <view class="row gap-12 mt-8 wrap">
              <text class="time">🕐 {{ a.readTime }}</text>
              <text class="diff" :class="a.difficulty === '初级' ? 'd1' : 'd2'">{{ a.difficulty }}</text>
              <text v-if="a.tag" class="tag">{{ a.tag }}</text>
            </view>
          </view>
          <text class="chev">›</text>
        </view>
      </view>
    </scroll-view>
    <view v-if="activeTool" class="mask" @click.self="closeTool">
      <view class="sheet" @click.stop>
        <view class="sheet-head row between">
          <view class="row gap-16">
            <view class="sh-ico" :style="{ backgroundColor: cfg.bg }"><text>📷</text></view>
            <text class="sh-title">{{ cfg.label }}</text>
          </view>
          <view class="close" @click="closeTool"><text>✕</text></view>
        </view>
        <scroll-view scroll-y class="sheet-body">
          <view v-if="phase === 'capture'" class="pad">
            <view class="cap-box" :style="capBoxStyle" @click="doCapture">
              <view class="cap-ico" :style="{ backgroundColor: cfg.bg }"><text class="big">📷</text></view>
              <text class="cap-t" :style="{ color: cfg.color }">点击拍摄照片</text>
            </view>
            <text class="hint">{{ cfg.hint }}</text>
            <view class="btn-full" :style="{ backgroundColor: cfg.color }" @click="doCapture">
              <text class="btn-txt">📷 开始拍摄识别</text>
            </view>
          </view>
          <view v-else-if="phase === 'scanning'" class="scan pad">
            <view class="spin-wrap" :style="{ backgroundColor: cfg.bg }"><text class="spin">⟳</text></view>
            <text class="s1">AI 正在分析...</text>
            <text class="s2">正在识别图像特征，请稍候</text>
            <view class="prog"><view class="prog-in" :style="{ backgroundColor: cfg.color }" /></view>
          </view>
          <view v-else class="pad">
            <view class="res-head row" :style="{ backgroundColor: cfg.bg }">
              <text class="ok">✔</text>
              <view class="grow min0">
                <text class="r1" :style="{ color: cfg.color }">识别完成</text>
                <text class="r2">{{ result.name }}</text>
              </view>
              <view class="conf">
                <text class="c1">置信度</text>
                <text class="c2" :style="{ color: cfg.color }">{{ result.confidence }}%</text>
              </view>
            </view>
            <view class="tags row wrap gap-12 mb-24">
              <text v-for="tag in result.tags" :key="tag" class="tag-pill" :style="{ backgroundColor: cfg.bg, color: cfg.color }">{{ tag }}</text>
            </view>
            <text class="adv-h">{{ result.adviceLabel }}</text>
            <view class="adv-card">
              <view v-for="(item, i) in result.advice" :key="i" class="adv-row row">
                <view class="num" :style="{ backgroundColor: cfg.color }"><text class="nw">{{ i + 1 }}</text></view>
                <text class="adv-txt">{{ item }}</text>
              </view>
            </view>
            <view class="btn-outline" :style="{ borderColor: cfg.color, color: cfg.color }" @click="phase = 'capture'">
              <text>重新识别</text>
            </view>
          </view>
        </scroll-view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import { CATEGORIES, ARTICLES, TOOL_CONFIG } from "../../common/constants.js";
import { plantStore } from "../../common/store.js";
import { request } from "../../utils/request";
import { chooseImageBase64 } from "../../utils/image";

const props = defineProps({
  active: { type: Boolean, default: false },
});

const category = ref("全部");
const query = ref("");
const activeTool = ref(null);
const phase = ref("capture");
const result = ref({ name: "", confidence: 0, tags: [], adviceLabel: "建议", advice: [] });

const toolKeys = ["plantId", "soilId", "pestDiag"];

const filtered = computed(() =>
  ARTICLES.filter((a) => {
    const catOk = category.value === "全部" || a.category === category.value;
    const q = query.value.trim();
    const qOk = !q || a.title.includes(q) || a.category.includes(q);
    return catOk && qOk;
  })
);

const cfg = computed(() => (activeTool.value ? TOOL_CONFIG[activeTool.value] : TOOL_CONFIG.plantId));
const capBoxStyle = computed(() => ({ borderColor: `${cfg.value.color}55`, backgroundColor: `${cfg.value.bg}55` }));

watch(
  () => props.active,
  (v) => {
    if (v && plantStore.pendingTool) {
      startTool(plantStore.pendingTool);
      plantStore.pendingTool = null;
    }
    if (!v) closeTool();
  }
);

function startTool(t) {
  activeTool.value = t;
  phase.value = "capture";
  result.value = { ...TOOL_CONFIG[t].result };
}

function closeTool() {
  activeTool.value = null;
  phase.value = "capture";
}

function openArticle(id) {
  uni.navigateTo({ url: `/pages/knowledge/detail?id=${id}` });
}

function resultFromIdentify(data) {
  const best = data?.best || {};
  return {
    name: best.name || "未识别到植物",
    confidence: best.score ? Math.round(best.score * 100) : 0,
    tags: [best.taxonFamily || "植物识别", ...(best.careDifficulty ? [best.careDifficulty] : [])].filter(Boolean),
    adviceLabel: "养护建议",
    advice: best.careSummary ? [best.careSummary] : ["请在植物详情页补充信息后生成养护计划。"],
  };
}

function resultFromSoil(data) {
  return {
    name: "土壤评估完成",
    confidence: data?.confidence ? Math.round(data.confidence * 100) : 0,
    tags: [data?.soilMoistureHint || "未知湿度", data?.soilFertilityHint || "未知肥力"],
    adviceLabel: "改善建议",
    advice: [data?.wateringTip || "建议结合天气和植物状态调整浇水频率。", data?.rationale || "可在后续继续拍照采样提高准确度。"],
  };
}

async function doCapture() {
  if (!activeTool.value) return;
  try {
    phase.value = "scanning";
    const imageBase64 = await chooseImageBase64();
    if (activeTool.value === "plantId") {
      const data = await request({ path: "/plants/identify", method: "POST", data: { imageBase64 } });
      result.value = resultFromIdentify(data);
    } else if (activeTool.value === "soilId") {
      const data = await request({ path: "/soil/estimate-photo", method: "POST", data: { imageBase64 } });
      result.value = resultFromSoil(data);
    } else {
      result.value = {
        name: "病虫害诊断建议",
        confidence: 85,
        tags: ["叶片病斑", "建议复检"],
        adviceLabel: "处理建议",
        advice: ["先剪除明显病叶并保持通风。", "若 2-3 天持续扩散，建议上传清晰照片到诊断页进一步分析。"],
      };
    }
    phase.value = "result";
  } catch (e) {
    phase.value = "capture";
    uni.showToast({ title: "识别失败，请重试", icon: "none" });
  }
}
</script>

<style scoped>
.page { flex: 1; height: 0; display: flex; flex-direction: column; position: relative; background: #f0faf5; }
.scroll { flex: 1; height: 0; }
.row { display: flex; flex-direction: row; align-items: center; }
.between { justify-content: space-between; }
.grow { flex: 1; }
.min0 { min-width: 0; }
.wrap { flex-wrap: wrap; }
.gap-12 { gap: 12rpx; }
.gap-16 { gap: 16rpx; }
.mt-8 { margin-top: 8rpx; }
.mb-24 { margin-bottom: 24rpx; }
.px-32 { padding-left: 32rpx; padding-right: 32rpx; }
.py-24 { padding-top: 24rpx; padding-bottom: 24rpx; }
.pb-24 { padding-bottom: 24rpx; }
.head { background: #fff; padding: 32rpx 32rpx 0; border-bottom: 1rpx solid #f0f0f0; }
.h-title { font-size: 36rpx; font-weight: 700; color: #1a3d2b; display: block; margin-bottom: 24rpx; }
.cat-scroll { white-space: nowrap; width: 100%; padding-bottom: 24rpx; }
.cat-row { display: flex; flex-direction: row; gap: 16rpx; }
.cat { flex-shrink: 0; padding: 12rpx 28rpx; border-radius: 16rpx; background: #f2f2f5; }
.cat.on { background: #1e7a4a; }
.cat-txt { font-size: 24rpx; color: #71727a; font-weight: 500; }
.cat.on .cat-txt { color: #fff; }
.search-row { display: flex; flex-direction: row; align-items: center; gap: 16rpx; }
.search-box { background: #fff; border-radius: 16rpx; padding: 16rpx 24rpx; box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04); }
.s-ico { margin-right: 12rpx; font-size: 28rpx; }
.inp { font-size: 26rpx; color: #3a3c3f; min-width: 0; }
.ph { color: #b0b3bc; }
.cnt { font-size: 24rpx; color: #9e9ea7; flex-shrink: 0; }
.articles { display: flex; flex-direction: column; gap: 16rpx; }
.art { background: #fff; border-radius: 24rpx; padding: 24rpx 28rpx; box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04); }
.art-ico { width: 80rpx; height: 80rpx; background: #e2f5ec; border-radius: 16rpx; display: flex; align-items: center; justify-content: center; font-size: 36rpx; margin-right: 24rpx; flex-shrink: 0; }
.art-title { font-size: 26rpx; font-weight: 600; color: #1a3d2b; line-height: 1.35; }
.time { font-size: 20rpx; color: #b0b3bc; }
.diff { font-size: 20rpx; padding: 4rpx 12rpx; border-radius: 999rpx; font-weight: 500; }
.diff.d1 { background: #e2f5ec; color: #1e7a4a; }
.diff.d2 { background: #fff3e0; color: #c47000; }
.tag { font-size: 20rpx; padding: 4rpx 12rpx; border-radius: 999rpx; background: #fef0f0; color: #c0392b; font-weight: 500; }
.chev { color: #d0d0d0; font-size: 46rpx; line-height: 1; margin-left: 4rpx; }
.mask { position: absolute; left: 0; right: 0; top: 0; bottom: 0; background: rgba(0, 0, 0, 0.5); z-index: 100; display: flex; flex-direction: column; justify-content: flex-end; }
.sheet { background: #fff; border-radius: 32rpx 32rpx 0 0; max-height: 84%; display: flex; flex-direction: column; }
.sheet-head { padding: 32rpx 40rpx 24rpx; border-bottom: 1rpx solid #f0f0f0; }
.sh-ico { width: 64rpx; height: 64rpx; border-radius: 16rpx; display: flex; align-items: center; justify-content: center; font-size: 32rpx; }
.sh-title { font-size: 30rpx; font-weight: 700; color: #1a3d2b; }
.close { width: 64rpx; height: 64rpx; background: #f2f2f5; border-radius: 999rpx; display: flex; align-items: center; justify-content: center; color: #71727a; font-size: 28rpx; }
.sheet-body { max-height: 60vh; }
.pad { padding: 40rpx; }
.cap-box { height: 360rpx; border-width: 4rpx; border-style: dashed; border-radius: 24rpx; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 24rpx; margin-bottom: 32rpx; }
.cap-ico { width: 112rpx; height: 112rpx; border-radius: 999rpx; display: flex; align-items: center; justify-content: center; }
.big { font-size: 52rpx; }
.cap-t { font-size: 26rpx; font-weight: 600; }
.hint { font-size: 24rpx; color: #71727a; text-align: center; line-height: 1.5; margin-bottom: 40rpx; display: block; }
.btn-full { padding: 32rpx; border-radius: 24rpx; text-align: center; }
.btn-txt { color: #fff; font-size: 32rpx; font-weight: 700; }
.scan { display: flex; flex-direction: column; align-items: center; gap: 32rpx; padding: 80rpx 40rpx; }
.spin-wrap { width: 160rpx; height: 160rpx; border-radius: 999rpx; display: flex; align-items: center; justify-content: center; }
.spin { font-size: 72rpx; animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.s1 { font-size: 30rpx; font-weight: 600; color: #1a3d2b; }
.s2 { font-size: 24rpx; color: #9e9ea7; text-align: center; }
.prog { width: 100%; height: 12rpx; background: #f0f0f0; border-radius: 999rpx; overflow: hidden; margin-top: 16rpx; }
.prog-in { width: 70%; height: 100%; border-radius: 999rpx; }
.res-head { padding: 32rpx; border-radius: 24rpx; margin-bottom: 24rpx; gap: 24rpx; }
.ok { font-size: 44rpx; color: #1e7a4a; }
.r1 { font-size: 26rpx; font-weight: 700; display: block; }
.r2 { font-size: 30rpx; font-weight: 700; color: #1a3d2b; display: block; margin-top: 8rpx; }
.conf { text-align: right; flex-shrink: 0; }
.c1 { font-size: 20rpx; color: #9e9ea7; display: block; }
.c2 { font-size: 36rpx; font-weight: 700; display: block; }
.tag-pill { font-size: 22rpx; padding: 8rpx 20rpx; border-radius: 999rpx; font-weight: 500; }
.adv-h { font-size: 26rpx; font-weight: 700; color: #1a3d2b; margin-bottom: 16rpx; display: block; }
.adv-card { border: 1rpx solid #f0f0f0; border-radius: 24rpx; overflow: hidden; margin-bottom: 32rpx; }
.adv-row { padding: 24rpx 32rpx; border-bottom: 1rpx solid #f8f8f8; gap: 24rpx; align-items: flex-start; }
.adv-row:last-child { border-bottom: none; }
.num { width: 40rpx; height: 40rpx; border-radius: 999rpx; flex-shrink: 0; display: flex; align-items: center; justify-content: center; margin-top: 4rpx; }
.nw { font-size: 20rpx; font-weight: 700; color: #fff; }
.adv-txt { flex: 1; font-size: 26rpx; color: #424d59; line-height: 1.5; }
.btn-outline { border-width: 4rpx; border-style: solid; padding: 28rpx; border-radius: 24rpx; text-align: center; font-size: 28rpx; font-weight: 600; }
.hide-scrollbar ::-webkit-scrollbar { display: none; width: 0; height: 0; }
</style>
