const STALE_AFTER_MS = 10 * 60 * 1000;
const NOTIFY_COOLDOWN_MS = 10 * 60 * 1000;
const notifiedAt = new Map();

function alert(plantId, plantName, code, severity, message) {
  return { id: `${plantId}:${code}`, plantId, plantName, code, severity, message };
}

export function evaluateSensorAlerts({
  plantId,
  plantName,
  latest,
  phEvaluation,
  hasDevices = false,
}) {
  if (!latest) {
    return hasDevices
      ? [alert(plantId, plantName, "no_data", "warning", "传感器尚未上报数据")]
      : [];
  }

  const measuredAt = new Date(latest.measuredAt || "").getTime();
  if (Number.isFinite(measuredAt) && Date.now() - measuredAt > STALE_AFTER_MS) {
    return [
      alert(plantId, plantName, "stale", "warning", "传感器超过 10 分钟未更新"),
    ];
  }

  const alerts = [];
  const temp = Number(latest.tempC);
  if (latest.tempC != null && Number.isFinite(temp)) {
    if (temp < 5 || temp > 40) {
      alerts.push(alert(plantId, plantName, "temperature", "danger", `温度异常：${temp.toFixed(1)}°C`));
    } else if (temp < 10 || temp > 35) {
      alerts.push(alert(plantId, plantName, "temperature", "warning", `温度需关注：${temp.toFixed(1)}°C`));
    }
  }

  const moisture = Number(latest.soilMoisture);
  if (latest.soilMoisture != null && Number.isFinite(moisture)) {
    if (moisture < 15) {
      alerts.push(alert(plantId, plantName, "moisture_low", "danger", `土壤严重缺水：${Math.round(moisture)}%`));
    } else if (moisture < 25) {
      alerts.push(alert(plantId, plantName, "moisture_low", "warning", `土壤湿度偏低：${Math.round(moisture)}%`));
    } else if (moisture > 90) {
      alerts.push(alert(plantId, plantName, "moisture_high", "danger", `土壤湿度过高：${Math.round(moisture)}%`));
    } else if (moisture > 80) {
      alerts.push(alert(plantId, plantName, "moisture_high", "warning", `土壤湿度偏高：${Math.round(moisture)}%`));
    }
  }

  const ph = Number(latest.phLevel);
  if (latest.phLevel != null && Number.isFinite(ph)) {
    if (phEvaluation?.status === "too_acidic") {
      alerts.push(alert(plantId, plantName, "ph", "warning", `土壤偏酸：pH ${ph.toFixed(1)}`));
    } else if (phEvaluation?.status === "too_alkaline") {
      alerts.push(alert(plantId, plantName, "ph", "warning", `土壤偏碱：pH ${ph.toFixed(1)}`));
    }
  }

  const lux = Number(latest.lux);
  if (latest.lux != null && Number.isFinite(lux)) {
    if (lux > 100000) {
      alerts.push(alert(plantId, plantName, "light", "danger", `光照过强：${Math.round(lux)} lx`));
    } else if (lux > 50000) {
      alerts.push(alert(plantId, plantName, "light", "warning", `光照偏强：${Math.round(lux)} lx`));
    }
  }

  return alerts;
}

export function notifyNewSensorAlerts(alerts) {
  const now = Date.now();
  const newlyActive = alerts.filter((item) => {
    const key = `${item.id}:${item.severity}`;
    const previous = notifiedAt.get(key) || 0;
    if (now - previous < NOTIFY_COOLDOWN_MS) return false;
    notifiedAt.set(key, now);
    return true;
  });
  if (!newlyActive.length) return;
  const first = newlyActive[0];
  uni.$emit("sensor-alert-banner", {
    count: newlyActive.length,
    severity: newlyActive.some((item) => item.severity === "danger")
      ? "danger"
      : "warning",
    message:
      newlyActive.length === 1
        ? `${first.plantName}：${first.message}`
        : `检测到 ${newlyActive.length} 项传感器异常，请及时查看`,
  });
}
