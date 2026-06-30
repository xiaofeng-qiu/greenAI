<template>
  <scroll-view scroll-y class="scroll" :show-scrollbar="false">
    <view class="header">
      <text class="h1">个人中心</text>
      <view class="row user">
        <view class="avatar">🌿</view>
        <view class="grow min0">
          <text class="name">植物爱好者</text>
          <text class="loc">📍 上海市浦东新区</text>
          <view class="row badges">
            <text class="b1">养护达人</text>
            <text class="b2">4株植物</text>
          </view>
        </view>
      </view>
    </view>
    <view class="stats-wrap px-40">
      <view class="stats row">
        <view class="cell grow">
          <text class="v green">28</text>
          <text class="l">养护天数</text>
        </view>
        <view class="cell grow border-l">
          <text class="v green">4</text>
          <text class="l">我的植物</text>
        </view>
        <view class="cell grow border-l">
          <text class="v green">92%</text>
          <text class="l">健康率</text>
        </view>
      </view>
    </view>
    <view class="sec px-40">
      <text class="sec-t">位置与天气</text>
      <view class="card">
        <view class="cell-btn row" @click="noop">
          <view class="ico bg-m">📍</view>
          <text class="lbl grow">当前位置</text>
          <text class="val">上海市</text>
          <text class="chev">›</text>
        </view>
        <view class="cell-btn row" @click="noop">
          <view class="ico bg-b">⚙️</view>
          <text class="lbl grow">天气数据源</text>
          <text class="val">和风天气</text>
          <text class="chev">›</text>
        </view>
      </view>
    </view>
    <view class="sec px-40">
      <text class="sec-t">通知设置</text>
      <view class="card">
        <view class="cell-btn row" @click="notifications = !notifications">
          <view class="ico bg-o">🔔</view>
          <text class="lbl grow">养护提醒</text>
          <view class="sw" :class="{ on: notifications }"><view class="knob" /></view>
        </view>
        <view class="cell-btn row" @click="weatherAlerts = !weatherAlerts">
          <view class="ico bg-b">🔔</view>
          <text class="lbl grow">天气预警</text>
          <view class="sw" :class="{ on: weatherAlerts }"><view class="knob" /></view>
        </view>
      </view>
    </view>
    <view class="sec px-40 mb-48">
      <text class="sec-t">其他</text>
      <view class="card">
        <view class="cell-btn row" @click="noop">
          <view class="ico bg-o">⭐</view>
          <text class="lbl grow">给应用评分</text>
          <text class="chev">›</text>
        </view>
        <view class="cell-btn row" @click="noop">
          <view class="ico bg-p">❓</view>
          <text class="lbl grow">帮助与反馈</text>
          <text class="chev">›</text>
        </view>
        <view class="cell-btn row" @click="noop">
          <view class="ico bg-m">🔒</view>
          <text class="lbl grow">隐私政策</text>
          <text class="chev">›</text>
        </view>
      </view>
    </view>
    <view class="px-40 mb-48">
      <view class="card">
        <view class="cell-btn row" @click="noop">
          <view class="ico bg-r">🚪</view>
          <text class="lbl grow danger">退出登录</text>
          <text class="chev">›</text>
        </view>
      </view>
    </view>
  </scroll-view>
</template>

<script setup>
import { ref } from "vue";

const notifications = ref(true);
const weatherAlerts = ref(true);
function noop() {}
</script>

<style scoped>
.scroll {
  flex: 1;
  height: 0;
  background: #f0faf5;
}
.row {
  display: flex;
  flex-direction: row;
  align-items: center;
}
.grow {
  flex: 1;
}
.min0 {
  min-width: 0;
}
.px-40 {
  padding-left: 40rpx;
  padding-right: 40rpx;
}
.mb-48 {
  margin-bottom: 48rpx;
}
.header {
  background: #e2f5ec;
  padding: 40rpx 40rpx 48rpx;
}
.h1 {
  font-size: 36rpx;
  font-weight: 700;
  color: #1a3d2b;
  display: block;
  margin-bottom: 32rpx;
}
.user {
  gap: 32rpx;
  align-items: flex-start;
}
.avatar {
  width: 128rpx;
  height: 128rpx;
  background: rgba(255, 255, 255, 0.6);
  border-radius: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 72rpx;
  flex-shrink: 0;
}
.name {
  font-size: 36rpx;
  font-weight: 700;
  color: #1a3d2b;
  display: block;
}
.loc {
  font-size: 26rpx;
  color: #3a6347;
  display: block;
  margin-top: 8rpx;
}
.badges {
  gap: 16rpx;
  margin-top: 16rpx;
}
.b1 {
  background: #1e7a4a;
  color: #fff;
  font-size: 22rpx;
  padding: 8rpx 16rpx;
  border-radius: 999rpx;
  font-weight: 500;
}
.b2 {
  background: rgba(255, 255, 255, 0.6);
  color: #1a3d2b;
  font-size: 22rpx;
  padding: 8rpx 16rpx;
  border-radius: 999rpx;
  font-weight: 500;
}
.stats-wrap {
  margin-top: -24rpx;
  margin-bottom: 32rpx;
}
.stats {
  background: #fff;
  border-radius: 24rpx;
  padding: 32rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
}
.cell {
  text-align: center;
}
.border-l {
  border-left: 1rpx solid #f0f0f0;
}
.v {
  font-size: 44rpx;
  font-weight: 700;
  display: block;
}
.v.green {
  color: #1e7a4a;
}
.l {
  font-size: 22rpx;
  color: #71727a;
  margin-top: 8rpx;
  display: block;
}
.sec {
  margin-bottom: 24rpx;
}
.sec-t {
  font-size: 24rpx;
  color: #71727a;
  font-weight: 600;
  letter-spacing: 2rpx;
  display: block;
  margin-bottom: 16rpx;
  padding-left: 8rpx;
}
.card {
  background: #fff;
  border-radius: 24rpx;
  overflow: hidden;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
}
.cell-btn {
  padding: 28rpx 32rpx;
  border-bottom: 1rpx solid #f5f5f5;
}
.cell-btn:last-child {
  border-bottom: none;
}
.ico {
  width: 64rpx;
  height: 64rpx;
  border-radius: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
  margin-right: 24rpx;
  flex-shrink: 0;
}
.bg-m {
  background: #e2f5ec;
}
.bg-b {
  background: #e8f4fb;
}
.bg-o {
  background: #fff3e0;
}
.bg-p {
  background: #f3f0ff;
}
.bg-r {
  background: #fef0f0;
}
.lbl {
  font-size: 28rpx;
  color: #1a3d2b;
}
.lbl.danger,
.danger {
  color: #c0392b;
}
.val {
  font-size: 26rpx;
  color: #9e9ea7;
  margin-right: 8rpx;
}
.chev {
  color: #c4c4c4;
  font-size: 46rpx;
  line-height: 1;
}
.sw {
  width: 88rpx;
  height: 48rpx;
  border-radius: 999rpx;
  background: #d1d5db;
  position: relative;
  flex-shrink: 0;
}
.sw.on {
  background: #1e7a4a;
}
.knob {
  position: absolute;
  top: 4rpx;
  left: 4rpx;
  width: 40rpx;
  height: 40rpx;
  background: #fff;
  border-radius: 999rpx;
  box-shadow: 0 2rpx 6rpx rgba(0, 0, 0, 0.12);
}
.sw.on .knob {
  left: 44rpx;
}
</style>
