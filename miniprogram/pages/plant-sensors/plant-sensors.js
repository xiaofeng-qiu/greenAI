const { request } = require("../../utils/api.js");

const METRICS = [
  { key: "tempC", label: "环境温度", unit: "℃", color: "#d97743", min: -10, max: 45 },
  { key: "soilMoisture", label: "土壤湿度", unit: "%", color: "#2a4d3a", min: 0, max: 100 },
  { key: "phLevel", label: "土壤 pH", unit: "", color: "#7a6cb4", min: 3.5, max: 9.0 },
  { key: "lux", label: "光照", unit: "lx", color: "#caa54a", min: 0, max: 20000 },
];

const PH_STATUS_LABELS = {
  optimal: "适宜",
  too_acidic: "偏酸",
  too_alkaline: "偏碱",
  unknown: "暂无数据",
};

function fmtTime(iso) {
  if (!iso) return "";
  const s = String(iso);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/);
  if (!m) return s.slice(0, 16);
  return `${m[2]}-${m[3]} ${m[4]}:${m[5]}`;
}

function fmtNum(v, digits) {
  if (v == null || !Number.isFinite(v)) return "—";
  return Number(v).toFixed(digits);
}

/**
 * 把一组读数压成 28 个柱子的 sparkline：
 *  - 每个柱子 height 百分比 = (v - min) / (max - min)
 *  - 缺值（null）柱用低透明灰条，避免视觉断档
 */
function buildSparkline(readings, metric) {
  const N = 28;
  const values = readings.map((r) => r[metric.key]);
  if (!values.length) return [];
  // 自适应区间：在 metric.{min,max} 与数据实际 min/max 之间取较窄的有效域
  let lo = metric.min;
  let hi = metric.max;
  const fin = values.filter((v) => v != null && Number.isFinite(v));
  if (fin.length > 0) {
    const dmin = Math.min.apply(null, fin);
    const dmax = Math.max.apply(null, fin);
    const pad = Math.max(0.5, (dmax - dmin) * 0.15);
    lo = Math.max(metric.min, dmin - pad);
    hi = Math.min(metric.max, dmax + pad);
    if (hi - lo < 0.5) {
      hi = lo + 0.5;
    }
  }
  const span = hi - lo || 1;
  // 等距抽样到 N 个柱子；不足 N 个时用对应位置的原始值，多出来时按比例下采样
  const bars = [];
  for (let i = 0; i < N; i++) {
    const idx = Math.floor((i * values.length) / N);
    const v = values[idx];
    if (v == null || !Number.isFinite(v)) {
      bars.push({ pct: 8, missing: true, color: metric.color });
    } else {
      const pct = Math.max(2, Math.min(100, ((v - lo) / span) * 100));
      bars.push({ pct, missing: false, color: metric.color });
    }
  }
  return bars;
}

function buildMetricCard(readings, latest, metric) {
  const latestVal = latest ? latest[metric.key] : null;
  const digits = metric.key === "lux" ? 0 : metric.key === "phLevel" ? 1 : 1;
  return {
    key: metric.key,
    label: metric.label,
    unit: metric.unit,
    color: metric.color,
    latestText: fmtNum(latestVal, digits),
    bars: buildSparkline(readings, metric),
  };
}

Page({
  data: {
    plantId: "",
    title: "",
    loading: true,
    errorMsg: "",
    windowHours: 72,
    latestAt: "",
    metrics: [],
    phStatusLabel: "",
    phStatusKey: "unknown",
    phRangeText: "",
    boundDevices: [],
    candidateDevices: [],
    operating: false,
  },
  onLoad(options) {
    const id = options && options.id ? String(options.id) : "";
    if (!id) {
      this.setData({ loading: false, errorMsg: "缺少植物 id" });
      return;
    }
    this.setData({ plantId: id });
    void this.loadAll();
  },
  async loadAll() {
    const id = this.data.plantId;
    if (!id) return;
    this.setData({ loading: true, errorMsg: "" });
    try {
      const [plant, series, devices] = await Promise.all([
        request({ path: `/plants/${id}`, method: "GET" }),
        request({ path: `/plants/${id}/sensor/series?hours=72`, method: "GET" }),
        request({ path: `/devices`, method: "GET" }).catch(() => []),
      ]);
      const readings = Array.isArray(series && series.readings)
        ? series.readings
        : [];
      const latest = (series && series.latest) || null;
      const metrics = METRICS.map((m) => buildMetricCard(readings, latest, m));

      const ph = (series && series.phEvaluation) || { status: "unknown" };
      const phStatusKey = ph.status || "unknown";
      const phRangeText =
        ph.preferredMin != null && ph.preferredMax != null
          ? `适宜区间 pH ${fmtNum(ph.preferredMin, 1)}–${fmtNum(
              ph.preferredMax,
              1
            )}${ph.usedDefaultRange ? "（通用默认）" : ""}`
          : "";

      const boundDevices = (Array.isArray(devices) ? devices : [])
        .filter((d) => d.plantId === id)
        .map((d) => ({
          ...d,
          displayName: d.label || d.hardwareId,
          lastSeenText: d.lastSeenAt ? fmtTime(d.lastSeenAt) : "尚未上报",
        }));
      const candidateDevices = (Array.isArray(devices) ? devices : [])
        .filter((d) => d.plantId !== id)
        .map((d) => ({
          ...d,
          displayName: d.label || d.hardwareId,
          lastSeenText: d.lastSeenAt ? fmtTime(d.lastSeenAt) : "尚未上报",
          boundElsewhere: !!d.plantId,
        }));

      const nick = (plant && plant.nickname) || "";
      const spec = (plant && plant.speciesLabel) || "";
      const title = nick && spec ? `${nick} · ${spec}` : nick || spec || "传感器";

      this.setData({
        loading: false,
        errorMsg: "",
        title,
        windowHours: (series && series.windowHours) || 72,
        latestAt: latest ? fmtTime(latest.measuredAt) : "",
        metrics,
        phStatusKey,
        phStatusLabel: PH_STATUS_LABELS[phStatusKey] || phStatusKey,
        phRangeText,
        boundDevices,
        candidateDevices,
      });
    } catch (e) {
      this.setData({
        loading: false,
        errorMsg:
          (e && e.data && e.data.error) ||
          (e && e.errMsg) ||
          "加载失败，请重试",
      });
    }
  },
  async onBindDevice(e) {
    if (this.data.operating) return;
    const deviceId = e.currentTarget.dataset.id;
    if (!deviceId) return;
    this.setData({ operating: true });
    try {
      await request({
        path: `/devices/${deviceId}`,
        method: "PATCH",
        data: { plantId: this.data.plantId },
      });
      wx.showToast({ title: "已绑定", icon: "success" });
      await this.loadAll();
    } catch (err) {
      wx.showToast({ title: "绑定失败", icon: "none" });
    } finally {
      this.setData({ operating: false });
    }
  },
  onUnbindDevice(e) {
    if (this.data.operating) return;
    const deviceId = e.currentTarget.dataset.id;
    if (!deviceId) return;
    wx.showModal({
      title: "解绑设备",
      content: "解绑后该设备的读数不再参与本植物的浇水/pH 计算。",
      success: async (r) => {
        if (!r.confirm) return;
        this.setData({ operating: true });
        try {
          await request({
            path: `/devices/${deviceId}`,
            method: "PATCH",
            data: { plantId: null },
          });
          wx.showToast({ title: "已解绑", icon: "success" });
          await this.loadAll();
        } catch (err) {
          wx.showToast({ title: "解绑失败", icon: "none" });
        } finally {
          this.setData({ operating: false });
        }
      },
    });
  },
  onGoProvision() {
    wx.navigateTo({ url: "/pages/device-provision/device-provision" });
  },
  onRefresh() {
    void this.loadAll();
  },
});
