import { reactive } from "vue";
import { API_BASE_URL } from "../utils/config";
import { clearToken, getToken, request, setToken } from "../utils/request";

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
  if (phEvaluation.status === "ok") return 82;
  if (phEvaluation.status === "low" || phEvaluation.status === "high") return 45;
  return 30;
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
  loading: false,
  error: "",
});

async function requestRaw(path, method = "GET", data = undefined) {
  const url = `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
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

export async function ensureAuth() {
  const token = getToken();
  if (token) {
    try {
      await request({ path: "/users/me" });
      return true;
    } catch {
      // Token may be from another database/environment.
      clearToken();
    }
  }
  try {
    const payload = await requestRaw("/auth/dev", "POST", {});
    if (payload && payload.token) {
      setToken(payload.token);
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}

async function loadSensorSeries(plantId) {
  try {
    return await request({ path: `/plants/${plantId}/sensor/series` });
  } catch {
    return null;
  }
}

function normalizePlant(plant, sensorSeries, todayTasks) {
  const latest = sensorSeries?.latest || null;
  const water = clampPercent(latest?.soilMoisture, 55);
  const light = lightFromLux(latest?.lux);
  const nutrition = nutritionFromPh(sensorSeries?.phEvaluation);
  const status = computeStatus(water, nutrition);
  const newestTask = todayTasks.find((t) => t.plantId === plant.id);
  return {
    id: plant.id,
    name: plant.nickname || plant.speciesLabel || "未命名植物",
    emoji: emojiBySpecies(plant.speciesLabel),
    location: locationLabel(plant),
    water,
    light,
    nutrition,
    status,
    lastCare: relDate(newestTask?.dueDate || plant.updatedAt || plant.createdAt),
    raw: plant,
    sensor: latest,
  };
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

    try {
      plantStore.weather = await request({ path: "/weather/current" });
    } catch {
      plantStore.weather = null;
    }
  } catch (err) {
    plantStore.error = err?.message || "加载失败";
    plantStore.plants = [];
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
