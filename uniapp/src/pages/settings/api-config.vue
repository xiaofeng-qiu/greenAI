<template>
  <view class="page">
    <view class="hero">
      <text class="hero-title">后端连接</text>
      <text class="hero-desc">开发环境可填写电脑的局域网地址；正式发布请使用 HTTPS 域名。</text>
    </view>

    <view class="section-title">API 根地址</view>
    <view class="card">
      <view class="field">
        <input
          class="input"
          :value="apiBase"
          placeholder="例如：http://192.168.1.100:3000"
          :disabled="testing"
          @input="onInput"
        />
        <text class="hint">只填写根地址，不要添加 /health、/users 等接口路径。</text>
      </view>
    </view>

    <view class="status-card">
      <text class="status-label">当前生效地址</text>
      <text class="status-value">{{ effectiveAddress }}</text>
      <text class="status-note">{{ defaultDescription }}</text>
    </view>

    <view class="actions">
      <button class="button secondary" :disabled="testing" @click="testConnection">
        {{ testing ? "测试中…" : "测试连接" }}
      </button>
      <button class="button primary" :disabled="testing" @click="save">
        保存并切换
      </button>
      <button class="button link" :disabled="testing" @click="restoreDefault">
        恢复平台默认地址
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import {
  getApiBase,
  getConfiguredApiBase,
  getDefaultApiBase,
  normalizeApiBase,
  resetApiBase,
  setApiBase,
} from "@/utils/config";
import { clearToken } from "@/utils/request";

const apiBase = ref("");
const testing = ref(false);

const effectiveAddress = computed(() => {
  const entered = apiBase.value.trim();
  if (entered) {
    try {
      return normalizeApiBase(entered);
    } catch {
      return entered;
    }
  }
  return getDefaultApiBase() || "同源地址（H5 开发代理）";
});

const defaultDescription = computed(() => {
  const fallback = getDefaultApiBase();
  return fallback
    ? `平台默认：${fallback}`
    : "平台默认：当前网页同源地址";
});

onLoad(() => {
  apiBase.value = getConfiguredApiBase();
});

function onInput(event: { detail?: { value?: string } }) {
  apiBase.value = event.detail?.value || "";
}

function candidateBase(): string {
  const entered = apiBase.value.trim();
  return entered ? normalizeApiBase(entered) : getDefaultApiBase();
}

function showInvalidAddress() {
  uni.showToast({
    title: "请输入 http:// 或 https:// 开头的有效地址",
    icon: "none",
  });
}

async function testConnection() {
  let base: string;
  try {
    base = candidateBase();
  } catch {
    showInvalidAddress();
    return;
  }

  testing.value = true;
  try {
    await new Promise<void>((resolve, reject) => {
      uni.request({
        url: `${base}/health`,
        method: "GET",
        timeout: 8000,
        success: (response) => {
          if (response.statusCode >= 200 && response.statusCode < 300) {
            resolve();
          } else {
            reject(new Error(`HTTP ${response.statusCode}`));
          }
        },
        fail: reject,
      });
    });
    uni.showToast({ title: "连接成功", icon: "success" });
  } catch {
    uni.showToast({ title: "连接失败，请检查地址和网络", icon: "none" });
  } finally {
    testing.value = false;
  }
}

function save() {
  let next: string;
  try {
    next = apiBase.value.trim() ? normalizeApiBase(apiBase.value) : "";
  } catch {
    showInvalidAddress();
    return;
  }

  const previous = getApiBase();
  setApiBase(next);
  const current = getApiBase();
  if (previous !== current) clearToken();

  uni.showToast({ title: "后端地址已切换", icon: "success" });
  setTimeout(() => uni.navigateBack(), 500);
}

function restoreDefault() {
  const previous = getApiBase();
  resetApiBase();
  apiBase.value = "";
  if (previous !== getApiBase()) clearToken();
  uni.showToast({ title: "已恢复默认地址", icon: "success" });
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  box-sizing: border-box;
  padding: 32rpx 32rpx calc(48rpx + env(safe-area-inset-bottom));
  background: #f0faf5;
}
.hero {
  padding: 32rpx;
  border-radius: 24rpx;
  background: linear-gradient(135deg, #dff5e9, #eefaf4);
  margin-bottom: 36rpx;
}
.hero-title {
  display: block;
  color: #1a3d2b;
  font-size: 38rpx;
  font-weight: 700;
}
.hero-desc {
  display: block;
  color: #4f6f5c;
  font-size: 26rpx;
  line-height: 1.6;
  margin-top: 12rpx;
}
.section-title {
  color: #71727a;
  font-size: 24rpx;
  font-weight: 600;
  margin: 0 8rpx 16rpx;
}
.card,
.status-card {
  background: #fff;
  border-radius: 24rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
}
.field {
  padding: 28rpx;
}
.input {
  box-sizing: border-box;
  width: 100%;
  height: 88rpx;
  padding: 0 24rpx;
  border-radius: 16rpx;
  background: #f5f7f6;
  color: #1a3d2b;
  font-size: 27rpx;
}
.hint {
  display: block;
  margin-top: 16rpx;
  color: #8b9390;
  font-size: 23rpx;
  line-height: 1.5;
}
.status-card {
  padding: 28rpx;
  margin-top: 24rpx;
}
.status-label,
.status-value,
.status-note {
  display: block;
}
.status-label {
  color: #71727a;
  font-size: 23rpx;
}
.status-value {
  margin-top: 12rpx;
  color: #1e7a4a;
  font-size: 27rpx;
  font-weight: 600;
  word-break: break-all;
}
.status-note {
  margin-top: 10rpx;
  color: #9e9ea7;
  font-size: 22rpx;
}
.actions {
  margin-top: 36rpx;
}
.button {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 88rpx;
  border: none;
  border-radius: 18rpx;
  font-size: 28rpx;
  font-weight: 600;
  margin: 0 0 20rpx;
}
.button::after {
  border: none;
}
.button.primary {
  color: #fff;
  background: #1e7a4a;
}
.button.secondary {
  color: #1e7a4a;
  background: #e2f5ec;
}
.button.link {
  color: #71727a;
  background: transparent;
  font-weight: 400;
}
.button[disabled] {
  opacity: 0.55;
}
</style>
