<template>
  <view class="page">
    <view class="brand">
      <view class="logo">🌿</view>
      <text class="title">GreenAI Bot</text>
      <text class="subtitle">选择本机绑定用户继续使用</text>
    </view>

    <view v-if="loading" class="state-card">
      <text class="state-text">正在检查本机用户…</text>
    </view>

    <template v-else-if="boundUser">
      <text class="section-title">已存在的用户</text>
      <view class="user-card selected" @click="selected = true">
        <view class="avatar">👤</view>
        <view class="user-info">
          <text class="user-name">{{ boundUser.label }}</text>
          <text class="user-meta">{{ boundUser.plantCount }} 株植物 · 创建于 {{ createdDate }}</text>
        </view>
        <view class="radio"><view v-if="selected" class="radio-dot" /></view>
      </view>
      <button class="primary" :disabled="submitting || !selected" @click="login">
        {{ submitting ? "登录中…" : "登录此用户" }}
      </button>
    </template>

    <template v-else>
      <view class="state-card">
        <text class="empty-icon">🌱</text>
        <text class="empty-title">本机尚未绑定用户</text>
        <text class="empty-desc">创建后，该浏览器只会绑定这个用户。清除浏览器数据会被视为新设备。</text>
      </view>
      <button class="primary" :disabled="submitting" @click="register">
        {{ submitting ? "创建中…" : "创建并绑定用户" }}
      </button>
    </template>

    <button class="server-link" :disabled="submitting" @click="openServerSettings">
      ⚙️ 服务器设置
    </button>
    <text v-if="errorText" class="error">{{ errorText }}</text>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import {
  ensureAuth,
  loginDeviceUser,
  peekDeviceUser,
  registerDeviceUser,
} from "@/common/store.js";
import { getToken } from "@/utils/request";

interface BoundUser {
  id: string;
  label: string;
  createdAt: string;
  plantCount: number;
}

const loading = ref(true);
const submitting = ref(false);
const selected = ref(true);
const boundUser = ref<BoundUser | null>(null);
const errorText = ref("");

const createdDate = computed(() => {
  const date = new Date(boundUser.value?.createdAt || "");
  if (Number.isNaN(date.getTime())) return "未知日期";
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
});

onShow(loadLoginState);

async function loadLoginState() {
  loading.value = true;
  errorText.value = "";
  try {
    if (getToken() && (await ensureAuth())) {
      enterApp();
      return;
    }
    boundUser.value = await peekDeviceUser();
    selected.value = Boolean(boundUser.value);
  } catch {
    boundUser.value = null;
    errorText.value = "无法连接后端，请检查服务器设置";
  } finally {
    loading.value = false;
  }
}

async function login() {
  if (!selected.value || submitting.value) return;
  submitting.value = true;
  errorText.value = "";
  try {
    await loginDeviceUser();
    enterApp();
  } catch {
    errorText.value = "登录失败，请检查后端连接";
  } finally {
    submitting.value = false;
  }
}

async function register() {
  if (submitting.value) return;
  submitting.value = true;
  errorText.value = "";
  try {
    await registerDeviceUser();
    enterApp();
  } catch (error: any) {
    if (error?.statusCode === 409) {
      await loadLoginState();
      errorText.value = "本机已绑定用户，请选择该用户登录";
    } else {
      errorText.value = "创建失败，请检查后端连接";
    }
  } finally {
    submitting.value = false;
  }
}

function enterApp() {
  uni.reLaunch({ url: "/pages/main/main" });
}

function openServerSettings() {
  uni.navigateTo({ url: "/pages/settings/api-config" });
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  box-sizing: border-box;
  padding: 120rpx 40rpx calc(48rpx + env(safe-area-inset-bottom));
  background: linear-gradient(180deg, #e2f5ec 0, #f0faf5 38%, #f0faf5 100%);
}
.brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 72rpx;
}
.logo {
  width: 128rpx;
  height: 128rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 32rpx;
  background: #fff;
  box-shadow: 0 12rpx 32rpx rgba(30, 122, 74, 0.12);
  font-size: 72rpx;
}
.title {
  margin-top: 28rpx;
  color: #1a3d2b;
  font-size: 44rpx;
  font-weight: 700;
}
.subtitle {
  margin-top: 12rpx;
  color: #5f7869;
  font-size: 26rpx;
}
.section-title {
  display: block;
  margin: 0 8rpx 18rpx;
  color: #71727a;
  font-size: 24rpx;
  font-weight: 600;
}
.user-card,
.state-card {
  background: #fff;
  border: 2rpx solid transparent;
  border-radius: 28rpx;
  box-shadow: 0 4rpx 18rpx rgba(0, 0, 0, 0.05);
}
.user-card {
  display: flex;
  align-items: center;
  padding: 32rpx;
}
.user-card.selected {
  border-color: #1e7a4a;
}
.avatar {
  width: 92rpx;
  height: 92rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 24rpx;
  background: #e2f5ec;
  font-size: 48rpx;
}
.user-info {
  flex: 1;
  min-width: 0;
  margin-left: 24rpx;
}
.user-name,
.user-meta {
  display: block;
}
.user-name {
  color: #1a3d2b;
  font-size: 30rpx;
  font-weight: 700;
}
.user-meta {
  margin-top: 10rpx;
  color: #818a85;
  font-size: 23rpx;
}
.radio {
  width: 38rpx;
  height: 38rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 3rpx solid #1e7a4a;
  border-radius: 50%;
}
.radio-dot {
  width: 20rpx;
  height: 20rpx;
  border-radius: 50%;
  background: #1e7a4a;
}
.state-card {
  padding: 52rpx 36rpx;
  text-align: center;
}
.state-text,
.empty-icon,
.empty-title,
.empty-desc {
  display: block;
}
.state-text {
  color: #71727a;
  font-size: 26rpx;
}
.empty-icon {
  font-size: 72rpx;
}
.empty-title {
  margin-top: 20rpx;
  color: #1a3d2b;
  font-size: 30rpx;
  font-weight: 700;
}
.empty-desc {
  margin-top: 14rpx;
  color: #7b8580;
  font-size: 24rpx;
  line-height: 1.6;
}
.primary,
.server-link {
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
}
.primary::after,
.server-link::after {
  border: none;
}
.primary {
  height: 92rpx;
  margin-top: 32rpx;
  border-radius: 20rpx;
  color: #fff;
  background: #1e7a4a;
  font-size: 29rpx;
  font-weight: 600;
}
.server-link {
  margin-top: 24rpx;
  color: #66736c;
  background: transparent;
  font-size: 25rpx;
}
.primary[disabled],
.server-link[disabled] {
  opacity: 0.55;
}
.error {
  display: block;
  margin-top: 20rpx;
  color: #c0392b;
  text-align: center;
  font-size: 24rpx;
}
</style>
