<template>
  <view class="page">
    <view v-if="article" class="card">
      <view class="head">
        <text class="emoji">{{ article.emoji || "📖" }}</text>
        <view class="meta">
          <text class="title">{{ article.title }}</text>
          <view class="tags">
            <text v-if="article.category" class="tag">{{ article.category }}</text>
            <text v-if="article.layer" class="tag">{{ article.layer }}</text>
          </view>
        </view>
      </view>
      <view class="body">
        <text v-if="article.summary" class="p">{{ article.summary }}</text>
        <text class="p">{{ article.body || "暂无正文" }}</text>
      </view>
    </view>
    <view v-else class="empty">
      <text>{{ loading ? "加载中…" : "未找到文章" }}</text>
    </view>
  </view>
</template>

<script setup>
import { ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { ARTICLES } from "../../common/constants.js";
import { getKnowledgeArticle } from "../../common/store.js";

const article = ref(null);
const loading = ref(false);

onLoad(async (q) => {
  const id = String(q?.id || "").trim();
  if (!id) return;
  loading.value = true;
  try {
    const data = await getKnowledgeArticle(id);
    article.value = {
      emoji: "📖",
      title: data.title,
      category: data.locale || "zh",
      layer: data.layer,
      summary: data.summary,
      body: data.body,
    };
  } catch {
    const local = ARTICLES.find((a) => String(a.id) === id);
    article.value = local
      ? {
          emoji: local.emoji,
          title: local.title,
          category: local.category,
          layer: local.difficulty,
          summary: "",
          body: `这是关于「${local.title}」的本地兜底内容。`,
        }
      : null;
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #f0faf5;
  padding: 24rpx;
}
.card {
  background: #fff;
  border-radius: 24rpx;
  padding: 28rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
}
.head {
  display: flex;
  gap: 20rpx;
  margin-bottom: 20rpx;
}
.emoji {
  width: 72rpx;
  height: 72rpx;
  border-radius: 16rpx;
  background: #e2f5ec;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36rpx;
}
.meta {
  flex: 1;
}
.title {
  font-size: 34rpx;
  font-weight: 700;
  color: #1a3d2b;
}
.tags {
  margin-top: 10rpx;
  display: flex;
  gap: 10rpx;
  flex-wrap: wrap;
}
.tag {
  font-size: 20rpx;
  padding: 4rpx 12rpx;
  border-radius: 999rpx;
  background: #e2f5ec;
  color: #1e7a4a;
}
.body {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.p {
  font-size: 28rpx;
  color: #424d59;
  line-height: 1.6;
  white-space: pre-wrap;
}
.empty {
  padding: 80rpx;
  text-align: center;
  color: #999;
}
</style>
