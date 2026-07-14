<template>
  <view class="page">
    <view class="hero">
      <text class="eyebrow">配网</text>
      <text class="title">传感器接入</text>
      <text class="desc">设备通电后通过家庭 Wi-Fi 把读数直接上报到云端；App 只负责一次性把 Wi-Fi 凭据写入设备。</text>
    </view>

    <view class="card">
      <text class="kicker">配网步骤（SoftAP + 绑定码）</text>
      <view v-for="step in steps" :key="step.n" class="step">
        <view class="num">{{ step.n }}</view>
        <view class="body">
          <text class="step-title">{{ step.title }}</text>
          <text class="step-desc">{{ step.desc }}</text>
        </view>
      </view>
    </view>

    <view class="card note">
      <text class="kicker">说明</text>
      <text class="line">数据通路始终是「设备 → 云端」HTTPS 直连。绑定码仅用于一次性把设备登记到你的账户。</text>
    </view>

    <view class="actions">
      <view class="btn ghost" @click="goProfile">去个人中心生成绑定码</view>
      <view class="btn primary" @click="onExplain">说明与检查清单</view>
    </view>
  </view>
</template>

<script setup>
const steps = [
  {
    n: 1,
    title: "在「我」页生成绑定码",
    desc: "打开 我 → 传感器绑定码 →「生成绑定码」，复制 8 位数字码（约 10 分钟内有效）。",
  },
  {
    n: 2,
    title: "设备进入 SoftAP 配网",
    desc: "通电后连接 Wi-Fi 热点「植物管家-配网」，浏览器打开 http://192.168.4.1",
  },
  {
    n: 3,
    title: "填写家庭 Wi-Fi 与绑定码",
    desc: "输入家中 2.4G Wi-Fi 名称与密码，粘贴绑定码。自托管时在折叠区填写后端根地址（无路径）。",
  },
  {
    n: 4,
    title: "保存并等待设备联网",
    desc: "联网后固件自动 claim 完成登记；之后在「我」页设备列表或植物编辑页把设备绑到具体植物。",
  },
];

function goProfile() {
  uni.navigateBack({
    fail: () => {
      uni.reLaunch({ url: "/pages/main/main" });
    },
  });
}

function onExplain() {
  uni.showModal({
    title: "SoftAP + 绑定码闭环",
    content:
      "当前固件已支持：配网页填写绑定码 → 联网后自动与当前用户绑定。请先在「我」页生成绑定码，再按上方步骤在设备配网页完成提交。",
    confirmText: "知道了",
    showCancel: false,
  });
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #f0faf5;
  padding: 32rpx 40rpx calc(48rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
}
.hero {
  margin-bottom: 28rpx;
}
.eyebrow {
  display: block;
  font-size: 22rpx;
  color: #3a6347;
  margin-bottom: 8rpx;
}
.title {
  display: block;
  font-size: 40rpx;
  font-weight: 700;
  color: #1a3d2b;
  margin-bottom: 12rpx;
}
.desc {
  display: block;
  font-size: 26rpx;
  color: #3a6347;
  line-height: 1.5;
}
.card {
  background: #fff;
  border-radius: 24rpx;
  padding: 32rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
}
.kicker {
  display: block;
  font-size: 24rpx;
  font-weight: 700;
  color: #71727a;
  margin-bottom: 20rpx;
}
.step {
  display: flex;
  flex-direction: row;
  gap: 20rpx;
  margin-bottom: 24rpx;
}
.step:last-child {
  margin-bottom: 0;
}
.num {
  width: 48rpx;
  height: 48rpx;
  border-radius: 999rpx;
  background: #e2f5ec;
  color: #1e7a4a;
  font-size: 24rpx;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.body {
  flex: 1;
  min-width: 0;
}
.step-title {
  display: block;
  font-size: 28rpx;
  font-weight: 700;
  color: #1a3d2b;
  margin-bottom: 6rpx;
}
.step-desc {
  display: block;
  font-size: 24rpx;
  color: #5f6b76;
  line-height: 1.5;
}
.line {
  display: block;
  font-size: 24rpx;
  color: #5f6b76;
  line-height: 1.5;
}
.actions {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-top: 8rpx;
}
.btn {
  border-radius: 24rpx;
  padding: 28rpx;
  text-align: center;
  font-size: 28rpx;
  font-weight: 700;
}
.btn.primary {
  background: #1e7a4a;
  color: #fff;
}
.btn.ghost {
  background: #e2f5ec;
  color: #1e7a4a;
}
</style>
