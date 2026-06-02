<template>
  <view class="page">
    <view v-if="article">
      <view :class="['cover', 'cover--t' + coverTone]">
        <text class="cover-kicker">养护知识</text>
        <text class="cover-title">{{ article.title }}</text>
        <text class="cover-summary">{{ article.summary }}</text>
      </view>
      <view class="scroll-area">
        <view v-for="(sec, i) in sections" :key="i" class="para card">
          <text class="para-text">{{ sec }}</text>
        </view>
      </view>
    </view>
    <view v-else class="loading">
      <text>加载中…</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { request } from "@/utils/request";

const article = ref<any>(null);
const coverTone = ref(0);
const sections = ref<string[]>([]);

onLoad((options) => {
  const id = options?.id || "";
  if (id) loadArticle(id);
});

async function loadArticle(id: string) {
  try {
    const data: any = await request({ path: `/knowledge/articles/${encodeURIComponent(id)}` });
    article.value = data;
    coverTone.value = data.coverTone ?? 0;
    sections.value = data.sections
      ? data.sections.map((s: any) => s.text || s)
      : data.body?.split("\n").filter(Boolean) || [];
  } catch {
    uni.showToast({ title: "加载失败", icon: "none" });
  }
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #fff;
}
.card {
  background: #fff;
  border-radius: 20rpx;
  border: 1rpx solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.04);
  padding: 28rpx;
  margin: 16rpx 24rpx;
}
.cover {
  padding: 48rpx 32rpx;
  text-align: center;
}
.cover--t0 { background: #e8f5e9; }
.cover--t1 { background: #e3f2fd; }
.cover--t2 { background: #fff3e0; }
.cover--t3 { background: #f3e5f5; }
.cover-kicker {
  font-size: 24rpx;
  color: #43a047;
  font-weight: 600;
  display: block;
  margin-bottom: 12rpx;
  text-transform: uppercase;
  letter-spacing: 2rpx;
}
.cover-title {
  font-size: 40rpx;
  font-weight: 800;
  color: #212121;
  display: block;
  margin-bottom: 16rpx;
  line-height: 1.3;
}
.cover-summary {
  font-size: 28rpx;
  color: #616161;
  display: block;
  line-height: 1.5;
}
.scroll-area {
  padding-bottom: 48rpx;
}
.para-text {
  font-size: 28rpx;
  color: #424242;
  line-height: 1.8;
}
.loading {
  display: flex;
  justify-content: center;
  padding: 80rpx 0;
  font-size: 28rpx;
  color: #9e9e9e;
}
</style>
