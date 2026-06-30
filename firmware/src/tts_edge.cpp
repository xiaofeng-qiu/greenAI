#include "config.h"
#include "tts.h"

#if STAGE_TTS && (TTS_ENGINE == TTS_EDGE)

#  include <cstdlib>

#  include <AudioFileSourcePROGMEM.h>
#  include <AudioGeneratorMP3.h>
#  include <AudioOutputI2S.h>

#  include "greenai_api.h"
#  include "boot_sound.h"

// 文本 → 后端 /internal/tts (edge-tts) 返回 MP3 → ESP8266Audio 解码 → I2S(MAX98357A)

void ttsInit() {
  Serial.printf("[TTS] edge-tts/I2S out BCLK=%d LRC=%d DIN=%d\n",
                PIN_I2S_BCLK, PIN_I2S_LRC, PIN_I2S_DIN);
}

// 解码并播放内存中的 MP3（阻塞直到放完）。
static void playMp3Buffer(const uint8_t* buf, size_t len) {
  AudioFileSourcePROGMEM src(buf, len);
  AudioOutputI2S out;
  out.SetPinout(PIN_I2S_BCLK, PIN_I2S_LRC, PIN_I2S_DIN);
  out.SetGain(0.5f);                 // 偏大会削顶破音，破音就降到 0.3
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

#endif
