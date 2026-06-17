<template>
  <view class="page">
    <view v-if="article" class="card">
      <view class="head">
        <text class="emoji">{{ article.emoji }}</text>
        <view class="meta">
          <text class="title">{{ article.title }}</text>
          <view class="tags">
            <text class="tag">{{ article.category }}</text>
            <text class="tag">{{ article.readTime }}</text>
            <text class="tag">{{ article.difficulty }}</text>
          </view>
        </view>
      </view>
      <view class="body">
        <text class="p">这是一篇关于「{{ article.title }}」的养护知识内容。</text>
        <text class="p">当前为 mock 详情页，用于打通“知识列表 -> 详情页”交互链路。</text>
        <text class="p">后续可替换为后端知识库正文字段或 markdown 渲染。</text>
      </view>
    </view>
    <view v-else class="empty">
      <text>未找到文章</text>
    </view>
  </view>
</template>

<script setup>
import { ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { ARTICLES } from "../../common/constants.js";

const article = ref(null);

onLoad((q) => {
  const id = Number(q?.id || 0);
  article.value = ARTICLES.find((a) => a.id === id) || null;
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
  color: #1e7a4a;
  background: #e2f5ec;
  border-radius: 999rpx;
  padding: 4rpx 12rpx;
}
.body {
  border-top: 1rpx solid #f0f0f0;
  padding-top: 18rpx;
}
.p {
  display: block;
  font-size: 26rpx;
  color: #424d59;
  line-height: 1.7;
  margin-bottom: 14rpx;
}
.empty {
  text-align: center;
  color: #9e9ea7;
  padding-top: 80rpx;
}
</style>
