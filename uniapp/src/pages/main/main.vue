<template>
  <view class="page-root" :style="{ paddingTop: statusBarH + 'px' }">
    <view class="content">
      <HomeTab v-show="tab === 0" @open-plant="goDetail" @open-tool="onToolFromHome" @open-care="goCareTab" />
      <CareTab v-show="tab === 1" />
      <KnowledgeTab v-show="tab === 2" :active="tab === 2" />
      <ProfileTab v-show="tab === 3" />
    </view>
    <view class="tabbar" :style="{ paddingBottom: safeBottom + 'px' }">
      <view v-for="(item, i) in tabs" :key="item.key" class="tab-item" @click="tab = i">
        <text class="tab-ico">{{ item.icon }}</text>
        <text class="tab-txt" :style="tabStyle(i)">{{ item.label }}</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { onShow } from "@dcloudio/uni-app";
import HomeTab from "./HomeTab.vue";
import CareTab from "./CareTab.vue";
import KnowledgeTab from "./KnowledgeTab.vue";
import ProfileTab from "./ProfileTab.vue";
import { G, GRAY } from "../../common/constants.js";
import { loadDashboardData, plantStore } from "../../common/store.js";

const tab = ref(0);
const statusBarH = ref(20);
const safeBottom = ref(0);
let mainLoadPromise = null;
let redirectingToLogin = false;

const tabs = [
  { key: "home", label: "首页", icon: "🏠" },
  { key: "care", label: "养护", icon: "🌱" },
  { key: "knowledge", label: "知识", icon: "📖" },
  { key: "profile", label: "我", icon: "👤" },
];

onMounted(async () => {
  try {
    const sys = uni.getSystemInfoSync();
    statusBarH.value = sys.statusBarHeight || 20;
    safeBottom.value = sys.safeAreaInsets?.bottom || 0;
  } catch {
    statusBarH.value = 20;
    safeBottom.value = 0;
  }
  await loadOrRedirect();
});

onShow(async () => {
  await loadOrRedirect();
});

async function loadOrRedirect() {
  if (redirectingToLogin) return;
  if (!mainLoadPromise) {
    mainLoadPromise = loadDashboardData().finally(() => {
      mainLoadPromise = null;
    });
  }
  const loaded = await mainLoadPromise;
  if (!loaded && !redirectingToLogin) {
    redirectingToLogin = true;
    uni.reLaunch({ url: "/pages/auth/login" });
  }
}

function tabStyle(i) {
  const on = tab.value === i;
  return {
    color: on ? G : GRAY,
    fontWeight: on ? "600" : "400",
  };
}

function goDetail(id) {
  uni.navigateTo({ url: `/pages/care/detail?id=${id}` });
}

function onToolFromHome(tool) {
  if (tool === "plantId") {
    uni.navigateTo({ url: "/pages/identify-result/identify-result" });
    return;
  }
  if (tool === "soilId") {
    uni.navigateTo({ url: "/pages/soil-result/soil-result" });
    return;
  }
  if (tool === "pestDiag") {
    uni.navigateTo({ url: "/pages/diagnose/diagnose" });
    return;
  }
  plantStore.pendingTool = tool;
  tab.value = 2;
}

function goCareTab() {
  tab.value = 1;
}
</script>

<style scoped>
.page-root {
  min-height: 100vh;
  background: #e8ecf0;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}
.content {
  flex: 1;
  height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding-bottom: calc(120rpx + env(safe-area-inset-bottom));
}
.tabbar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 100;
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  background: #fff;
  border-top: 1rpx solid rgba(0, 0, 0, 0.05);
  padding-top: 16rpx;
  padding-left: 16rpx;
  padding-right: 16rpx;
  min-height: 120rpx;
}
.tab-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
  padding-bottom: 8rpx;
}
.tab-ico {
  font-size: 40rpx;
  line-height: 1;
}
.tab-txt {
  font-size: 20rpx;
  line-height: 28rpx;
}
</style>
