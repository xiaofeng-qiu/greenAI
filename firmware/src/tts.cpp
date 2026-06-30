#include "config.h"
#include "tts.h"

#if STAGE_TTS

#  include <Preferences.h>
#  include <cmath>
#  include <cstring>
#  include <cstdlib>

#  include <AudioFileSourcePROGMEM.h>
#  include <AudioGeneratorMP3.h>
#  include <AudioOutputI2S.h>

#  include "display.h"
#  include "greenai_api.h"
#  include "boot_sound.h"

// ============================================================
//  语音输出：文本 → 后端 /internal/tts (edge-tts) 返回 MP3 →
//            ESP8266Audio 解码 → I2S 推 MAX98357A 播放。
//  接口 ttsSpeak/ttsLoop/ttsSpeakWatering 保持不变（仅底层换实现）。
// ============================================================

// ---- 浇水回馈文案 (NVS 缓存) ----
static const char* WATERING_DEFAULT_MSG =
    "谢谢你记得我，每一滴水都带着你的温度呢。";
static String g_waterMsg;
static bool   g_waterMsgLoaded = false;

void ttsInit() {
    Serial.printf("[TTS] I2S out BCLK=%d LRC=%d DIN=%d (edge-tts MP3 via /internal/tts)\n",
                  PIN_I2S_BCLK, PIN_I2S_LRC, PIN_I2S_DIN);
}

// 解码并播放内存中的 MP3（阻塞直到放完）。
static void playMp3Buffer(const uint8_t* buf, size_t len) {
    AudioFileSourcePROGMEM src(buf, len);
    AudioOutputI2S out;
    out.SetPinout(PIN_I2S_BCLK, PIN_I2S_LRC, PIN_I2S_DIN);
    out.SetGain(0.5f);                 // 音量 0..1；偏大会削顶破音，破音就再降(0.3)

    AudioGeneratorMP3 mp3;
    if (!mp3.begin(&src, &out)) {
        Serial.println("[TTS] mp3 begin fail");
        return;
    }
    while (mp3.isRunning()) {
        if (!mp3.loop()) break;
        yield();
    }
    mp3.stop();
}

void ttsPlayBootClip() {
#  if HAS_BOOT_SOUND
    Serial.printf("[TTS] play boot clip (offline, %u bytes)\n", (unsigned)BOOT_SOUND_MP3_LEN);
    playMp3Buffer(BOOT_SOUND_MP3, BOOT_SOUND_MP3_LEN);
#  else
    Serial.println("[TTS] boot clip not embedded — run `npm run gen:boot-sound` in backend");
#  endif
}

void ttsSpeak(const char* text) {
    if (!text || !text[0]) return;
    uint8_t* buf = nullptr;
    size_t   len = 0;
    if (!greenaiFetchTts(text, &buf, &len)) {
        Serial.printf("[TTS] fetch fail (未联网/未配置/服务端错误): \"%s\"\n", text);
        return;
    }
    Serial.printf("[TTS] play %u bytes: \"%s\"\n", (unsigned)len, text);
    playMp3Buffer(buf, len);
    free(buf);
}

// ---- 上电后仅播报一次环境读数（逻辑与原实现一致）----
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
        if (fabs(tNow - s_lastStableT) < 0.5f)
            s_tempStableCnt++;
        else
            s_tempStableCnt = 1;
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

// ============================================================
//  浇水回馈
// ============================================================
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

#else  // STAGE_TTS == 0

void ttsInit() {}
void ttsSpeak(const char*) {}
void ttsPlayBootClip() {}
void ttsLoop(const SensorData&) {}
void ttsSpeakWatering() {}
void ttsInvalidateConfig() {}

#endif
