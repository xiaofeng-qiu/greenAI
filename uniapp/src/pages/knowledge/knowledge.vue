<template>
  <view class="page">
    <view class="hero">
      <text class="hero__title">发现</text>
      <text class="hero__desc">常见室内植物与养护要点</text>
    </view>

    <view class="search-wrap card">
      <input
        class="search-input"
        placeholder="搜索标题或正文关键词"
        :value="searchQuery"
        @input="onSearchInput"
        confirm-type="search"
      />
    </view>

    <view v-if="articles.length === 0" class="empty card">
      <text>无匹配条目，请尝试其他关键词。</text>
    </view>

    <view
      v-for="a in articles"
      :key="a.id"
      class="article-row card"
      @tap="onOpen(a.id)"
    >
      <view :class="['thumb', 'thumb--t' + (a.coverTone || 0)]">
        <text class="thumb__glyph">{{ a.thumbGlyph }}</text>
      </view>
      <view class="article-row__body">
        <text class="article-row__title">{{ a.title }}</text>
        <text class="article-row__summary">{{ a.summary }}</text>
      </view>
      <text class="chevron">›</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { request } from "@/utils/request";

interface Article {
  id: string;
  title: string;
  summary: string;
  coverTone?: number;
  thumbGlyph?: string;
}

const articles = ref<Article[]>([]);
const searchQuery = ref("");
let searchTimer: ReturnType<typeof setTimeout> | null = null;

function decorateArticles(list: any[]): Article[] {
  return list.map(a => ({
    ...a,
    coverTone: a.coverTone ?? 0,
    thumbGlyph: (a.title || "?").charAt(0),
  }));
}

async function loadArticles() {
  try {
    const data: any[] = await request({ path: "/knowledge/articles" });
    articles.value = decorateArticles(data);
  } catch {}
}

function onSearchInput(e: any) {
  const q = e.detail?.value ?? e.target?.value ?? "";
  searchQuery.value = q;
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => doSearch(q), 400);
}

async function doSearch(q: string) {
  if (!q.trim()) {
    loadArticles();
    return;
  }
  try {
    const data: any = await request({ path: `/knowledge/search?q=${encodeURIComponent(q)}&limit=15` });
    const bucketArticles: any[] = data.buckets?.articles ?? data.articles ?? [];
    const mapped = bucketArticles.map((a: any) => ({
      id: a.slug || a.id,
      title: a.title,
      summary: a.snippet || a.summary,
      coverTone: a.coverTone ?? 0,
    }));
    articles.value = decorateArticles(mapped);
  } catch {}
}

function onOpen(id: string) {
  uni.navigateTo({
    url: `/pages/knowledge/detail?id=${encodeURIComponent(id)}`,
  });
}

onShow(() => {
  loadArticles();
});
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
  padding: 28rpx;
  margin-bottom: 24rpx;
}
.hero {
  margin-bottom: 24rpx;
}
.hero__title {
  font-size: 48rpx;
  font-weight: 800;
  color: #212121;
  display: block;
}
.hero__desc {
  font-size: 26rpx;
  color: #616161;
  margin-top: 8rpx;
  display: block;
}
.search-wrap {
  padding: 0 28rpx;
  margin-bottom: 24rpx;
}
.search-input {
  height: 80rpx;
  font-size: 28rpx;
}
.empty {
  display: flex;
  justify-content: center;
  font-size: 26rpx;
  color: #9e9e9e;
}
.article-row {
  display: flex;
  align-items: center;
  gap: 20rpx;
}
.thumb {
  width: 80rpx;
  height: 80rpx;
  border-radius: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36rpx;
  flex-shrink: 0;
}
.thumb--t0 { background: #e8f5e9; }
.thumb--t1 { background: #e3f2fd; }
.thumb--t2 { background: #fff3e0; }
.thumb--t3 { background: #f3e5f5; }
.thumb__glyph { font-weight: 700; }
.article-row__body {
  flex: 1;
  min-width: 0;
}
.article-row__title {
  font-size: 28rpx;
  font-weight: 600;
  color: #212121;
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.article-row__summary {
  font-size: 24rpx;
  color: #9e9e9e;
  display: block;
  margin-top: 4rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.chevron {
  font-size: 32rpx;
  color: #bdbdbd;
  flex-shrink: 0;
}
</style>
