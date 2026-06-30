#include "config.h"
#include "tts.h"

#if STAGE_TTS && (TTS_ENGINE == TTS_LU6288)

#  include <HardwareSerial.h>
#  include <cstring>

#  include "tts_utf8_gbk.h"

// 老方案：LU6288 类模块（UART 标记协议 + GBK 本地合成）。开机即可离线发声。
static HardwareSerial TTS_Serial(1);

static void lu6288MusicOff() {
  TTS_Serial.print("<M>0");
  delay(50);
  TTS_Serial.flush();
}

static void lu6288SpeakGbkPayload(const uint8_t* gbk, size_t len) {
  lu6288MusicOff();
  TTS_Serial.print("<G>");
  for (size_t i = 0; i < len; i++) TTS_Serial.write(gbk[i]);
  TTS_Serial.flush();
}

#  if TTS_DEBUG_MODULE_RX
static void ttsDrainModuleRx() {
  while (TTS_Serial.available()) (void)TTS_Serial.read();
}

static void ttsLogModuleRx(unsigned waitMs) {
  delay(15);
  uint8_t buf[40];
  size_t  n = 0;
  unsigned long t0 = millis();
  while (millis() - t0 < waitMs && n < sizeof(buf)) {
    int c = TTS_Serial.read();
    if (c >= 0) buf[n++] = (uint8_t)c;
    else        delay(1);
  }
  if (n == 0) {
    Serial.println("[TTS] module RX: (no bytes — TX→GPIO18? 共地? 供电?)");
    return;
  }
  Serial.printf("[TTS] module RX (%u B): ", (unsigned)n);
  for (size_t i = 0; i < n; i++) Serial.printf("%02X ", buf[i]);
  Serial.println();
}
#  endif

void ttsInit() {
  TTS_Serial.begin(9600, SERIAL_8N1, PIN_TTS_RX, PIN_TTS_TX);
  Serial.printf("[TTS] LU6288 UART1 RX=GPIO%d TX=GPIO%d @9600\n", PIN_TTS_RX, PIN_TTS_TX);
  delay(100);
  lu6288MusicOff();
#  if TTS_DEBUG_MODULE_RX
  ttsDrainModuleRx();
#  endif
}

void ttsSpeak(const char* text) {
  if (!text || !text[0]) return;
#  if TTS_DEBUG_MODULE_RX
  ttsDrainModuleRx();
#  endif
  uint8_t payload[220];
  size_t payLen = ttsUtf8ToGbk(text, payload, sizeof(payload));
  if (payLen == 0) {
    Serial.println("[TTS] speak skipped: empty after UTF-8→GBK");
    return;
  }
  if (payLen > 200) payLen = 200;
  lu6288SpeakGbkPayload(payload, payLen);
  Serial.printf("[TTS] LU6288 speak GBK %u B (src len=%u)\n", (unsigned)payLen, (unsigned)strlen(text));
#  if TTS_DEBUG_MODULE_RX
  ttsLogModuleRx(100);
#  endif
}

// LU6288 本地合成，开机离线直接念这句（无需内置 MP3）。
void ttsPlayBootClip() {
  ttsSpeak("植物管家已启动");
}

#endif
