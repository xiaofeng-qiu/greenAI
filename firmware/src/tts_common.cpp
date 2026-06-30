#include "config.h"
#include "tts.h"

#if STAGE_TTS

#  include <Preferences.h>
#  include <cmath>
#  include <cstring>

#  include "display.h"

// ============================================================
//  与具体引擎无关的语音逻辑（环境播报状态机 / 浇水文案 / 配置失效）。
//  底层发声 ttsSpeak()、ttsInit()、ttsPlayBootClip() 由所选引擎文件实现
//  （tts_edge.cpp 或 tts_lu6288.cpp）。
// ============================================================

// ---- 浇水回馈文案 (NVS 缓存) ----
static const char* WATERING_DEFAULT_MSG =
    "谢谢你记得我，每一滴水都带着你的温度呢。";
static String g_waterMsg;
static bool   g_waterMsgLoaded = false;

// ---- 上电后仅播报一次环境读数 ----
static bool          s_envAnnounced   = false;
static float         s_lastStableT    = NAN;
static uint8_t       s_tempStableCnt  = 0;
static unsigned long s_envWaitStartMs = 0;

static void ttsSpeakEnvironmentOnce(const SensorData& d) {
  char numBuf[16];
  char fullText[128] = {0};
  strcat(fullText, "当前环境");
  if (d.sensorOK[0]) {
    dtostrf(d.temperature, 1, 1, numBuf);
    strcat(fullText, "温度");
    strcat(fullText, numBuf);
    strcat(fullText, "摄氏度");
    dtostrf(d.humidity, 1, 0, numBuf);
    strcat(fullText, "湿度");
    strcat(fullText, numBuf);
    strcat(fullText, "百分之");
  }
  if (d.sensorOK[2]) {
    snprintf(numBuf, sizeof(numBuf), "%d", d.soilPercent);
    strcat(fullText, "盆土湿度");
    strcat(fullText, numBuf);
  }
#  if STAGE_PH
  if (d.sensorOK[3]) {
    dtostrf(d.pH, 1, 1, numBuf);
    strcat(fullText, "酸碱度");
    strcat(fullText, numBuf);
  }
#  endif
  size_t textLen = strlen(fullText);
  unsigned long holdMs = 5500UL + (unsigned long)textLen * 100UL;
  if (holdMs < 8000UL) holdMs = 8000UL;
  if (holdMs > 24000UL) holdMs = 24000UL;
#  if STAGE_OLED
  displayHoldSpeakingSmile(holdMs, d.wifiConnected);
#  endif
  ttsSpeak(fullText);
}

void ttsLoop(const SensorData& d) {
  if (s_envAnnounced) return;
  if (s_envWaitStartMs == 0) s_envWaitStartMs = millis();

  if (!d.sensorOK[0]) {
    s_lastStableT   = NAN;
    s_tempStableCnt = 0;
    return;
  }

  const float tNow = d.temperature;
  if (isnan(s_lastStableT)) {
    s_lastStableT = tNow;
    s_tempStableCnt = 1;
  } else {
    if (fabs(tNow - s_lastStableT) < 0.5f) s_tempStableCnt++;
    else                                   s_tempStableCnt = 1;
    s_lastStableT = tNow;
  }

  const bool stableEnough = (s_tempStableCnt >= 4);
  const bool timeoutFallback =
      (millis() - s_envWaitStartMs > 25000UL) && d.sensorOK[0];

  if (stableEnough || timeoutFallback) {
    s_envAnnounced = true;
    Serial.printf("[TTS] env one-shot (stable=%d timeout=%d)\n", stableEnough ? 1 : 0,
                  timeoutFallback && !stableEnough ? 1 : 0);
    ttsSpeakEnvironmentOnce(d);
  }
}

void ttsInvalidateConfig() {
  g_waterMsgLoaded = false;
}

void ttsSpeakWatering() {
  if (!g_waterMsgLoaded) {
    Preferences p;
    if (p.begin("plantguard", /*readOnly=*/true)) {
      if (p.isKey("waterMsg")) g_waterMsg = p.getString("waterMsg", "");
      else g_waterMsg = WATERING_DEFAULT_MSG;
      p.end();
    } else {
      g_waterMsg = WATERING_DEFAULT_MSG;
    }
    if (g_waterMsg.length() == 0) g_waterMsg = WATERING_DEFAULT_MSG;
    g_waterMsgLoaded = true;
    Serial.printf("[WATER] msg=\"%s\"\n", g_waterMsg.c_str());
  }
  ttsSpeak(g_waterMsg.c_str());
}

#else  // STAGE_TTS == 0 —— 全部空实现（含引擎接口）

void ttsInit() {}
void ttsSpeak(const char*) {}
void ttsPlayBootClip() {}
void ttsLoop(const SensorData&) {}
void ttsSpeakWatering() {}
void ttsInvalidateConfig() {}

#endif
