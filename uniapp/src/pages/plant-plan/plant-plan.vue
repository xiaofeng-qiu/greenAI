<template>
  <view class="page">
    <view class="hero">
      <text class="hero__eyebrow">计划</text>
      <text class="hero__title">待办与历史</text>
      <text class="hero__desc">浇水、施肥与换盆/巡检等长周期任务</text>
    </view>

    <view v-if="loadError" class="card muted-card">{{ loadError }}</view>

    <view v-if="tasks.length === 0 && !loadError" class="card empty-card">暂无任务记录</view>

    <view v-for="t in tasks" :key="t.id" class="card task-row">
      <view class="task-head">
        <text :class="['badge', 'badge--' + t.type]">{{ t.displayType }}</text>
        <text :class="['status', 'status--' + t.status]">{{ t.displayStatus }}</text>
      </view>
      <text class="task-due">计划日：{{ t.displayDue }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { request } from "@/utils/request";

const plantId = ref("");
const tasks = ref<any[]>([]);
const loadError = ref("");

const typeMap: Record<string, string> = { water: "浇水", fertilize: "施肥", repot: "换盆", inspect: "检查" };
const statusMap: Record<string, string> = { pending: "待办", completed: "已完成", skipped: "已跳过" };

onLoad((options) => {
  const id = options?.id || "";
  if (!id) {
    loadError.value = "缺少植物 id";
    return;
  }
  plantId.value = id;
  loadTasks(id);
});

async function loadTasks(id: string) {
  try {
    const raw: any[] = await request({ path: `/plants/${id}/tasks` });
    tasks.value = (Array.isArray(raw) ? raw : []).map(t => ({
      ...t,
      displayType: typeMap[t.type] || t.type,
      displayStatus: statusMap[t.status] || t.status,
      displayDue: t.dueDate ? String(t.dueDate).slice(0, 16).replace("T", " ") : "",
    }));
  } catch {
    loadError.value = "加载失败";
  }
}
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
  margin-bottom: 16rpx;
}
.hero { margin-bottom: 24rpx; }
.hero__eyebrow {
  font-size: 24rpx;
  font-weight: 700;
  color: #43a047;
  text-transform: uppercase;
  letter-spacing: 2rpx;
  display: block;
  margin-bottom: 8rpx;
}
.hero__title {
  font-size: 40rpx;
  font-weight: 800;
  color: #212121;
  display: block;
}
.hero__desc {
  font-size: 24rpx;
  color: #616161;
  margin-top: 8rpx;
  display: block;
}
.muted-card, .empty-card {
  text-align: center;
  font-size: 26rpx;
  color: #9e9e9e;
}
.task-row {}
.task-head {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 12rpx;
}
.badge {
  padding: 4rpx 16rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
  font-weight: 600;
}
.badge--water { background: #e3f2fd; color: #1565c0; }
.badge--fertilize { background: #fff3e0; color: #e65100; }
.badge--repot { background: #f3e5f5; color: #7b1fa2; }
.badge--inspect { background: #e8f5e9; color: #2e7d32; }
.status {
  font-size: 22rpx;
  color: #9e9e9e;
}
.status--completed { color: #43a047; }
.status--skipped { color: #bdbdbd; }
.task-due {
  font-size: 26rpx;
  color: #616161;
}
</style>
