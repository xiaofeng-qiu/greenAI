export type SensorAlertSeverity = "warning" | "danger";

export type SensorAlert = {
  code: string;
  severity: SensorAlertSeverity;
  message: string;
};

export type SensorAlertReading = {
  tempC?: number | null;
  soilMoisture?: number | null;
  phLevel?: number | null;
  lux?: number | null;
};

export type SensorPhEvaluation = {
  status?: string;
};

export function evaluateSensorReadingAlerts(
  reading: SensorAlertReading,
  phEvaluation?: SensorPhEvaluation | null
): SensorAlert[] {
  const alerts: SensorAlert[] = [];
  const temp = Number(reading.tempC);
  if (reading.tempC != null && Number.isFinite(temp)) {
    if (temp < 5 || temp > 40) {
      alerts.push({ code: "temperature", severity: "danger", message: `温度异常：${temp.toFixed(1)}°C` });
    } else if (temp < 10 || temp > 35) {
      alerts.push({ code: "temperature", severity: "warning", message: `温度需关注：${temp.toFixed(1)}°C` });
    }
  }

  const moisture = Number(reading.soilMoisture);
  if (reading.soilMoisture != null && Number.isFinite(moisture)) {
    if (moisture < 15) {
      alerts.push({ code: "moisture_low", severity: "danger", message: `土壤严重缺水：${Math.round(moisture)}%` });
    } else if (moisture < 25) {
      alerts.push({ code: "moisture_low", severity: "warning", message: `土壤湿度偏低：${Math.round(moisture)}%` });
    } else if (moisture > 90) {
      alerts.push({ code: "moisture_high", severity: "danger", message: `土壤湿度过高：${Math.round(moisture)}%` });
    } else if (moisture > 80) {
      alerts.push({ code: "moisture_high", severity: "warning", message: `土壤湿度偏高：${Math.round(moisture)}%` });
    }
  }

  const ph = Number(reading.phLevel);
  if (reading.phLevel != null && Number.isFinite(ph)) {
    if (phEvaluation?.status === "too_acidic") {
      alerts.push({ code: "ph", severity: "warning", message: `土壤偏酸：pH ${ph.toFixed(1)}` });
    } else if (phEvaluation?.status === "too_alkaline") {
      alerts.push({ code: "ph", severity: "warning", message: `土壤偏碱：pH ${ph.toFixed(1)}` });
    }
  }

  const lux = Number(reading.lux);
  if (reading.lux != null && Number.isFinite(lux)) {
    if (lux > 100000) {
      alerts.push({ code: "light", severity: "danger", message: `光照过强：${Math.round(lux)} lx` });
    } else if (lux > 50000) {
      alerts.push({ code: "light", severity: "warning", message: `光照偏强：${Math.round(lux)} lx` });
    }
  }

  return alerts;
}
