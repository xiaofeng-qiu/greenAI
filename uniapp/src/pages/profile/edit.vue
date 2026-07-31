<template>
  <view class="page">
    <view class="avatar-wrap">
      <view class="avatar">🌿</view>
      <text class="avatar-hint">当前头像</text>
    </view>

    <text class="section-title">个人信息</text>
    <view class="card">
      <view class="field">
        <text class="label">用户名称</text>
        <input
          class="input"
          :value="displayName"
          maxlength="40"
          placeholder="请输入用户名称"
          @input="onNameInput"
        />
        <text class="counter">{{ displayName.length }}/40</text>
      </view>
      <view class="field readonly">
        <text class="label">用户 ID</text>
        <text class="user-id">{{ userId || "—" }}</text>
      </view>
    </view>

    <button class="save" :disabled="saving" @click="save">
      {{ saving ? "保存中…" : "保存修改" }}
    </button>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { ensureAuth, updateUserMe } from "@/common/store.js";
import { request } from "@/utils/request";

const displayName = ref("");
const userId = ref("");
const saving = ref(false);

onLoad(async () => {
  try {
    if (!(await ensureAuth())) {
      uni.reLaunch({ url: "/pages/auth/login" });
      return;
    }
    const user: any = await request({ path: "/users/me" });
    displayName.value = String(user?.displayName || "");
    userId.value = String(user?.id || "");
  } catch {
    uni.showToast({ title: "个人资料加载失败", icon: "none" });
  }
});

function onNameInput(event: { detail?: { value?: string } }) {
  displayName.value = String(event.detail?.value || "");
}

async function save() {
  const name = displayName.value.trim();
  if (!name || name.length > 40) {
    uni.showToast({ title: "名称需为 1–40 个字符", icon: "none" });
    return;
  }
  if (saving.value) return;
  saving.value = true;
  try {
    await updateUserMe({ displayName: name });
    displayName.value = name;
    uni.showToast({ title: "保存成功", icon: "success" });
    setTimeout(() => uni.navigateBack(), 500);
  } catch {
    uni.showToast({ title: "保存失败，请稍后重试", icon: "none" });
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  box-sizing: border-box;
  padding: 48rpx 32rpx calc(48rpx + env(safe-area-inset-bottom));
  background: #f0faf5;
}
.avatar-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 48rpx;
}
.avatar {
  width: 152rpx;
  height: 152rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 36rpx;
  background: #e2f5ec;
  box-shadow: 0 8rpx 24rpx rgba(30, 122, 74, 0.12);
  font-size: 84rpx;
}
.avatar-hint {
  margin-top: 16rpx;
  color: #7a8a81;
  font-size: 23rpx;
}
.section-title {
  display: block;
  margin: 0 8rpx 16rpx;
  color: #71727a;
  font-size: 24rpx;
  font-weight: 600;
}
.card {
  overflow: hidden;
  border-radius: 24rpx;
  background: #fff;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
}
.field {
  position: relative;
  padding: 28rpx;
  border-bottom: 1rpx solid #f1f3f2;
}
.field:last-child {
  border-bottom: none;
}
.label {
  display: block;
  margin-bottom: 16rpx;
  color: #3d5145;
  font-size: 25rpx;
  font-weight: 600;
}
.input {
  box-sizing: border-box;
  width: 100%;
  height: 84rpx;
  padding: 0 88rpx 0 22rpx;
  border-radius: 16rpx;
  background: #f5f7f6;
  color: #1a3d2b;
  font-size: 28rpx;
}
.counter {
  position: absolute;
  right: 48rpx;
  bottom: 56rpx;
  color: #9ba49f;
  font-size: 21rpx;
}
.readonly {
  background: #fafbfa;
}
.user-id {
  color: #7a847f;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 23rpx;
  word-break: break-all;
}
.save {
  height: 92rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 40rpx;
  border: none;
  border-radius: 20rpx;
  color: #fff;
  background: #1e7a4a;
  font-size: 29rpx;
  font-weight: 600;
}
.save::after {
  border: none;
}
.save[disabled] {
  opacity: 0.55;
}
</style>
