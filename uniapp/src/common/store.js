import { reactive } from "vue";
import { getApiBase } from "../utils/config";
import { clearToken, getToken, request, setToken } from "../utils/request";
import {
  evaluateSensorAlerts,
  notifyNewSensorAlerts,
} from "../utils/sensorAlerts.js";

const DEVICE_KEY_STORAGE_KEY = "greenai_h5_device_key";
const LEGACY_GUEST_KEY_STORAGE_KEY = "greenai_guest_key";
const LEGACY_LOGGED_OUT_STORAGE_KEY = "greenai_guest_logged_out";
const AUTH_VERSION_STORAGE_KEY = "greenai_auth_version";
const AUTH_VERSION = "h5-device-v2";
let authInFlight = null;

function clampPercent(value, fallback = 50) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function lightFromLux(lux) {
  if (lux == null) return 60;
  const mapped = Math.round((Number(lux) / 15000) * 100);
  return clampPercent(mapped, 60);
}

function nutritionFromPh(phEvaluation) {
  if (!phEvaluation || phEvaluation.status === "unknown") return 60;
  if (phEvaluation.status === "optimal" || phEvaluation.status === "ok") return 82;
  if (
    phEvaluation.status === "too_acidic" ||
    phEvaluation.status === "too_alkaline" ||
    phEvaluation.status === "low" ||
    phEvaluation.status === "high"
  ) return 45;
  return 60;
}

function computeStatus(water, nutrition) {
  if (water < 25 || nutrition < 35) return "danger";
  if (water < 45 || nutrition < 55) return "warning";
  return "good";
}

function locationLabel(plant) {
  if (plant.indoor === true) return "室内";
  if (plant.indoor === false) return "户外";
  return "未知位置";
}

function emojiBySpecies(species) {
  const s = String(species || "");
  if (s.includes("兰")) return "🌺";
  if (s.includes("仙人掌")) return "🌵";
  if (s.includes("多肉")) return "🪴";
  if (s.includes("绿萝")) return "🌿";
  return "🌱";
}

function relDate(isoText) {
  if (!isoText) return "近期";
  const date = new Date(isoText);
  if (Number.isNaN(date.getTime())) return "近期";
  const delta = Date.now() - date.getTime();
  if (delta < 24 * 3600 * 1000) return "今天";
  if (delta < 2 * 24 * 3600 * 1000) return "昨天";
  return `${Math.floor(delta / (24 * 3600 * 1000))}天前`;
}

function sensorLevel(score) {
  if (score < 30) return "danger";
  if (score < 50) return "warning";
  return "good";
}

export const plantStore = reactive({
  plants: [],
  pendingTool: null,
  todayTasks: [],
  weather: null,
  forecast: null,
  devices: [],
  sensorAlerts: [],
  knowledgeArticles: [],
  loading: false,
  error: "",
});

async function requestRaw(path, method = "GET", data = undefined) {
  const url = `${getApiBase()}${path.startsWith("/") ? path : `/${path}`}`;
  const token = getToken();
  return new Promise((resolve, reject) => {
    uni.request({
      url,
      method,
      data: data === undefined ? (method === "GET" ? undefined : {}) : data,
      header: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data || {});
          return;
        }
        reject({ statusCode: res.statusCode || 0, data: res.data });
      },
      fail(err) {
        reject({ statusCode: 0, errMsg: err?.errMsg || "network_error" });
      },
    });
  });
}

function migrateDeviceStorage() {
  if (uni.getStorageSync(AUTH_VERSION_STORAGE_KEY) !== AUTH_VERSION) {
    const currentKey = String(uni.getStorageSync(DEVICE_KEY_STORAGE_KEY) || "");
    const legacyKey = String(uni.getStorageSync(LEGACY_GUEST_KEY_STORAGE_KEY) || "");
    if (!currentKey && legacyKey) {
      uni.setStorageSync(DEVICE_KEY_STORAGE_KEY, legacyKey);
    } else if (!currentKey) {
      clearToken();
    }
    uni.removeStorageSync(LEGACY_GUEST_KEY_STORAGE_KEY);
    uni.removeStorageSync(LEGACY_LOGGED_OUT_STORAGE_KEY);
    uni.setStorageSync(AUTH_VERSION_STORAGE_KEY, AUTH_VERSION);
  }
}

export function getH5DeviceKey() {
  migrateDeviceStorage();
  return String(uni.getStorageSync(DEVICE_KEY_STORAGE_KEY) || "");
}

export function logoutDeviceUser() {
  clearToken();
}

export async function peekDeviceUser() {
  const deviceKey = getH5DeviceKey();
  if (!deviceKey) return null;
  try {
    const payload = await requestRaw("/auth/h5/device/peek", "POST", { deviceKey });
    return payload?.user || null;
  } catch (error) {
    if (error?.statusCode === 404) return null;
    throw error;
  }
}

export async function loginDeviceUser() {
  const deviceKey = getH5DeviceKey();
  if (!deviceKey) throw new Error("device_key_missing");
  const payload = await requestRaw("/auth/h5/device/login", "POST", { deviceKey });
  if (!payload?.token) throw new Error("device_login_failed");
  setToken(payload.token);
  return payload;
}

export async function registerDeviceUser() {
  const deviceKey = getH5DeviceKey();
  const payload = await requestRaw(
    "/auth/h5/device/register",
    "POST",
    deviceKey ? { deviceKey } : {}
  );
  if (!payload?.token || !payload?.deviceKey) {
    throw new Error("device_register_failed");
  }
  uni.setStorageSync(DEVICE_KEY_STORAGE_KEY, payload.deviceKey);
  uni.setStorageSync(AUTH_VERSION_STORAGE_KEY, AUTH_VERSION);
  setToken(payload.token);
  return payload;
}

async function ensureAuthOnce() {
  migrateDeviceStorage();
  const token = getToken();
  if (!token) return false;
  try {
    await request({ path: "/users/me" });
    return true;
  } catch {
    clearToken();
    return false;
  }
}

export async function ensureAuth() {
  if (authInFlight) return authInFlight;
  authInFlight = ensureAuthOnce();
  try {
    return await authInFlight;
  } finally {
    authInFlight = null;
  }
}

async function loadSensorSeries(plantId) {
  try {
    return await request({ path: `/plants/${plantId}/sensor/series` });
  } catch {
    return null;
  }
}

export async function fetchPlantSensorSeries(plantId) {
  const authed = await ensureAuth();
  if (!authed) return null;
  return loadSensorSeries(plantId);
}

function normalizePlant(plant, sensorSeries, todayTasks) {
  const latest = sensorSeries?.latest || null;
  const water = clampPercent(latest?.soilMoisture, 55);
  const light = lightFromLux(latest?.lux);
  const nutrition = nutritionFromPh(sensorSeries?.phEvaluation);
  const name = plant.nickname || plant.speciesLabel || "未命名植物";
  const sensorAlerts = evaluateSensorAlerts({
    plantId: plant.id,
    plantName: name,
    latest,
    phEvaluation: sensorSeries?.phEvaluation,
    hasDevices: Boolean(sensorSeries?.devices?.length),
  });
  const sensorSeverity = sensorAlerts.some((item) => item.severity === "danger")
    ? "danger"
    : sensorAlerts.length
      ? "warning"
      : "good";
  const careStatus = computeStatus(water, nutrition);
  const status =
    careStatus === "danger" || sensorSeverity === "danger"
      ? "danger"
      : careStatus === "warning" || sensorSeverity === "warning"
        ? "warning"
        : "good";
  const newestTask = todayTasks.find((t) => t.plantId === plant.id);
  return {
    id: plant.id,
    name,
    emoji: emojiBySpecies(plant.speciesLabel),
    location: locationLabel(plant),
    water,
    light,
    nutrition,
    status,
    lastCare: relDate(newestTask?.dueDate || plant.updatedAt || plant.createdAt),
    raw: plant,
    sensor: latest,
    sensorAlerts,
    phEvaluation: sensorSeries?.phEvaluation || null,
  };
}

function syncSensorAlerts() {
  const alerts = plantStore.plants.flatMap((plant) => plant.sensorAlerts || []);
  plantStore.sensorAlerts = alerts;
  notifyNewSensorAlerts(alerts);
}

export async function refreshPlantSensors() {
  const rawPlants = plantStore.plants
    .map((plant) => plant.raw)
    .filter(Boolean);
  if (!rawPlants.length) return plantStore.plants;

  const sensorSeriesList = await Promise.all(
    rawPlants.map((plant) => loadSensorSeries(plant.id))
  );
  plantStore.plants = rawPlants.map((plant, index) =>
    normalizePlant(plant, sensorSeriesList[index], plantStore.todayTasks)
  );
  syncSensorAlerts();
  return plantStore.plants;
}

export async function loadDashboardData() {
  plantStore.loading = true;
  plantStore.error = "";
  try {
    const authed = await ensureAuth();
    if (!authed) throw new Error("auth_failed");

    const [plants, tasks] = await Promise.all([
      request({ path: "/plants" }),
      request({ path: "/tasks/today" }),
    ]);
    plantStore.todayTasks = Array.isArray(tasks) ? tasks : [];

    const sensorSeriesList = await Promise.all(
      (Array.isArray(plants) ? plants : []).map((p) => loadSensorSeries(p.id))
    );

    plantStore.plants = (Array.isArray(plants) ? plants : []).map((p, index) =>
      normalizePlant(p, sensorSeriesList[index], plantStore.todayTasks)
    );
    syncSensorAlerts();

    try {
      plantStore.weather = await request({ path: "/weather/current" });
    } catch {
      plantStore.weather = null;
    }

    try {
      plantStore.forecast = await request({ path: "/weather/forecast" });
    } catch {
      plantStore.forecast = null;
    }

    try {
      const devices = await request({ path: "/devices" });
      plantStore.devices = Array.isArray(devices) ? devices : [];
    } catch {
      plantStore.devices = [];
    }
    return true;
  } catch (err) {
    plantStore.error = err?.message || "加载失败";
    plantStore.plants = [];
    return false;
  } finally {
    plantStore.loading = false;
  }
}

export function findPlant(id) {
  return plantStore.plants.find((p) => String(p.id) === String(id));
}

export async function createPlant(payload) {
  await ensureAuth();
  const created = await request({ path: "/plants", method: "POST", data: payload });
  try {
    await request({ path: `/plants/${created.id}/plan/regenerate`, method: "POST", data: {} });
  } catch {
    // ignore plan regenerate failures and still return created
  }
  await loadDashboardData();
  return created;
}

export async function fetchPlantDetail(id) {
  await ensureAuth();
  const [plant, tasks, series] = await Promise.all([
    request({ path: `/plants/${id}` }),
    request({ path: `/plants/${id}/tasks` }),
    loadSensorSeries(id),
  ]);
  return {
    plant,
    tasks: Array.isArray(tasks) ? tasks : [],
    series,
  };
}

export async function createDeviceBindingCode() {
  await ensureAuth();
  return request({ path: "/devices/binding-codes", method: "POST", data: {} });
}

export async function completeTask(taskId) {
  await ensureAuth();
  await request({ path: `/tasks/${taskId}/complete`, method: "POST", data: {} });
  plantStore.todayTasks = plantStore.todayTasks.filter((t) => t.id !== taskId);
  await loadDashboardData();
}

export async function skipTask(taskId) {
  await ensureAuth();
  await request({ path: `/tasks/${taskId}/skip`, method: "POST", data: {} });
  plantStore.todayTasks = plantStore.todayTasks.filter((t) => t.id !== taskId);
  await loadDashboardData();
}

export async function updatePlant(id, payload) {
  await ensureAuth();
  const updated = await request({ path: `/plants/${id}`, method: "PATCH", data: payload });
  try {
    await request({ path: `/plants/${id}/plan/regenerate`, method: "POST", data: {} });
  } catch {
    // ignore regenerate failures
  }
  await loadDashboardData();
  return updated;
}

export async function deletePlant(id) {
  await ensureAuth();
  await request({ path: `/plants/${id}`, method: "DELETE" });
  plantStore.plants = plantStore.plants.filter((p) => String(p.id) !== String(id));
  plantStore.todayTasks = plantStore.todayTasks.filter((t) => String(t.plantId) !== String(id));
  await loadDashboardData();
}

export async function loadDevices() {
  await ensureAuth();
  const devices = await request({ path: "/devices" });
  plantStore.devices = Array.isArray(devices) ? devices : [];
  return plantStore.devices;
}

export async function bindDeviceToPlant(deviceId, plantId) {
  await ensureAuth();
  const updated = await request({
    path: `/devices/${deviceId}`,
    method: "PATCH",
    data: { plantId: plantId || null },
  });
  await loadDevices();
  return updated;
}

export async function updateDevice(deviceId, payload) {
  await ensureAuth();
  const updated = await request({
    path: `/devices/${deviceId}`,
    method: "PATCH",
    data: payload,
  });
  await loadDevices();
  return updated;
}

export async function updateUserMe(payload) {
  await ensureAuth();
  return request({ path: "/users/me", method: "PATCH", data: payload });
}

export async function loadKnowledgeArticles() {
  await ensureAuth();
  try {
    const data = await request({ path: "/knowledge/articles" });
    const list = Array.isArray(data) ? data : data?.items || data?.articles || [];
    plantStore.knowledgeArticles = list;
    return list;
  } catch {
    plantStore.knowledgeArticles = [];
    return [];
  }
}

export async function searchKnowledge(q) {
  await ensureAuth();
  const query = String(q || "").trim();
  if (!query) return loadKnowledgeArticles();
  const data = await request({ path: `/knowledge/search?q=${encodeURIComponent(query)}` });
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.articles)) return data.articles;
  if (Array.isArray(data?.buckets?.articles)) return data.buckets.articles;
  return [];
}

export async function getKnowledgeArticle(slugOrId) {
  await ensureAuth();
  const key = String(slugOrId || "").trim();
  if (!key) return null;
  return request({ path: `/knowledge/articles/${encodeURIComponent(key)}` });
}

export async function diagnoseBySymptoms(payload) {
  await ensureAuth();
  return request({ path: "/diagnose", method: "POST", data: payload });
}

export async function diagnoseByPhoto(payload) {
  await ensureAuth();
  return request({ path: "/diagnose/llm", method: "POST", data: payload });
}

export async function identifyPlant(imageBase64) {
  await ensureAuth();
  return request({ path: "/plants/identify", method: "POST", data: { imageBase64 } });
}

export async function estimateSoilPhoto(payload) {
  await ensureAuth();
  return request({ path: "/soil/estimate-photo", method: "POST", data: payload });
}

export function taskTypeLabel(type) {
  if (type === "water") return "浇水";
  if (type === "fertilize") return "施肥";
  if (type === "repot") return "换盆";
  if (type === "inspect") return "巡检";
  return type || "任务";
}
