#include "config.h"

#if STAGE_OLED && (DISPLAY_DRIVER == DISP_ILI9341)

#include "display.h"

// 横屏 320x240（面板原生 240x320，rotation 3 转横屏，排线在左）
#define SCREEN_W 320
#define SCREEN_H 240
#include "display_tft_common.h"

static const int WIFI_SCALE = 2;

void displayInit() {
  pinMode(PIN_TFT_BL, OUTPUT);
  digitalWrite(PIN_TFT_BL, HIGH);

  tft.init();
  tft.setRotation(3);                 // 横屏，排线/USB 口在左（颠倒改 1）
  tft.fillScreen(COL_BG);
  u8f.begin(tft);
  Serial.println("[TFT] ILI9341 320x240 landscape init");

  int cx = SCREEN_W / 2;
  tft.fillRect(cx - 4, 108, 8, 36, COL_FACE);
  tft.fillTriangle(cx, 90, cx - 26, 122, cx + 4, 128, COL_FACE);
  tft.fillTriangle(cx, 90, cx + 26, 122, cx - 4, 128, COL_FACE);
  textCenter(176, "植物管家", FONT_CN_BIG, COL_WHITE);
  textCenter(202, "启动中...", FONT_CN_SMALL, COL_OK);
  s_mode = MODE_ANIM;
}

// ---- 开机眨眼（眼睛区域用 sprite 双缓冲，避免整屏清屏闪烁）----
static const int EYE_TOP = 50;
static const int EYE_H   = 104;

static void drawBootEyes(TFT_eSprite& spr, int eyeRy) {
  const int eyeCY = 100 - EYE_TOP, leftCX = 110, rightCX = 210, eyeRx = 46;
  spr.fillSprite(COL_BG);
  if (eyeRy <= 2) {
    spr.fillRect(leftCX  - eyeRx, eyeCY - 2, eyeRx * 2, 5, COL_SCLERA);
    spr.fillRect(rightCX - eyeRx, eyeCY - 2, eyeRx * 2, 5, COL_SCLERA);
  } else {
    spr.fillEllipse(leftCX,  eyeCY, eyeRx, eyeRy, COL_SCLERA);
    spr.fillEllipse(rightCX, eyeCY, eyeRx, eyeRy, COL_SCLERA);
    if (eyeRy >= 22) {
      spr.fillCircle(leftCX  + 7, eyeCY, 15, COL_PUPIL);
      spr.fillCircle(rightCX + 7, eyeCY, 15, COL_PUPIL);
      spr.fillCircle(leftCX  + 12, eyeCY - 7, 5, COL_WHITE);
      spr.fillCircle(rightCX + 12, eyeCY - 7, 5, COL_WHITE);
    }
  }
  spr.pushSprite(0, EYE_TOP);
}

static void drawBootFrameDirect(int eyeRy) {
  const int eyeCY = 100, leftCX = 110, rightCX = 210, eyeRx = 46;
  tft.fillRect(0, EYE_TOP, SCREEN_W, EYE_H, COL_BG);
  if (eyeRy <= 2) {
    tft.fillRect(leftCX  - eyeRx, eyeCY - 2, eyeRx * 2, 5, COL_SCLERA);
    tft.fillRect(rightCX - eyeRx, eyeCY - 2, eyeRx * 2, 5, COL_SCLERA);
  } else {
    tft.fillEllipse(leftCX,  eyeCY, eyeRx, eyeRy, COL_SCLERA);
    tft.fillEllipse(rightCX, eyeCY, eyeRx, eyeRy, COL_SCLERA);
    if (eyeRy >= 22) {
      tft.fillCircle(leftCX  + 7, eyeCY, 15, COL_PUPIL);
      tft.fillCircle(rightCX + 7, eyeCY, 15, COL_PUPIL);
      tft.fillCircle(leftCX  + 12, eyeCY - 7, 5, COL_WHITE);
      tft.fillCircle(rightCX + 12, eyeCY - 7, 5, COL_WHITE);
    }
  }
}

void displayBootAnimation() {
  static const int blinkFrames[] = {
    46, 46, 46, 46, 36, 26, 16, 6, 0, 0, 0, 6, 16, 26, 36, 46,
  };
  const int frameCount = sizeof(blinkFrames) / sizeof(blinkFrames[0]);

  tft.fillScreen(COL_BG);
  textCenter(200, "植物管家", FONT_CN_BIG, COL_FACE);

  TFT_eSprite spr = TFT_eSprite(&tft);
  spr.setColorDepth(16);
  bool useSprite = (spr.createSprite(SCREEN_W, EYE_H) != nullptr);

  for (int loop = 0; loop < 3; loop++) {
    for (int i = 0; i < frameCount; i++) {
      if (useSprite) drawBootEyes(spr, blinkFrames[i]);
      else           drawBootFrameDirect(blinkFrames[i]);
      delay(45);
    }
  }
  if (useSprite) { drawBootEyes(spr, 46); spr.deleteSprite(); }
  else           drawBootFrameDirect(46);
  delay(300);
  s_mode = MODE_ANIM;
}

// ---- 浇水回馈：俏皮圆脸 + 单眼 wink ----
static void drawWateringWinkFrame(int frame) {
  const int cx = 160, cy = 112, faceR = 80;
  const int eyeY = 95, leftX = 125, rightX = 195;

  tft.fillScreen(COL_BG);
  for (int t = 0; t < 3; t++) tft.drawCircle(cx, cy, faceR - t, COL_FACE);
  tft.fillCircle(leftX - 22, cy + 22, 7, COL_BLUSH);
  tft.fillCircle(rightX + 22, cy + 22, 7, COL_BLUSH);

  int pupilShift = (frame >= 2 && frame <= 4) ? 8 : 0;
  tft.fillEllipse(leftX, eyeY, 16, 20, COL_SCLERA);
  tft.fillCircle(leftX + 2 + pupilShift, eyeY + 2, 8, COL_PUPIL);
  tft.fillCircle(leftX + 6 + pupilShift, eyeY - 2, 3, COL_WHITE);

  if (frame >= 1) tft.fillRect(rightX - 20, eyeY - 28, 20, 3, COL_FACE);

  if (frame <= 0) {
    tft.fillEllipse(rightX, eyeY, 16, 20, COL_SCLERA);
    tft.fillCircle(rightX + 2, eyeY + 2, 8, COL_PUPIL);
    tft.fillCircle(rightX + 6, eyeY - 2, 3, COL_WHITE);
  } else if (frame == 1) {
    tft.fillEllipse(rightX, eyeY, 16, 10, COL_SCLERA);
    tft.fillCircle(rightX + 2, eyeY, 6, COL_PUPIL);
  } else if (frame <= 4) {
    tft.fillRect(rightX - 20, eyeY - 3, 40, 6, COL_FACE);
  } else {
    tft.fillEllipse(rightX, eyeY, 16, 18, COL_SCLERA);
    tft.fillCircle(rightX + 2, eyeY + 2, 8, COL_PUPIL);
    tft.fillCircle(rightX + 6, eyeY - 2, 3, COL_WHITE);
  }

  if (frame >= 2 && frame <= 4) {
    tft.fillCircle(262, 58, 6, COL_HEART);
    tft.fillCircle(274, 58, 6, COL_HEART);
    tft.fillTriangle(255, 62, 281, 62, 268, 78, COL_HEART);
  }

  int sd = (frame >= 3) ? 2 : 0;
  for (int t = 0; t < 3; t++) {
    tft.drawLine(125, 140 + sd + t, 145, 154 + sd + t, COL_WHITE);
    tft.drawLine(145, 154 + sd + t, 175, 154 + sd + t, COL_WHITE);
    tft.drawLine(175, 154 + sd + t, 195, 140 + sd + t, COL_WHITE);
  }
  textCenter(214, "喝饱啦~", FONT_CN_BIG, COL_OK);
}

void displayWateringWink() {
  for (int f = 0; f < 6; f++) { drawWateringWinkFrame(f); delay(95); }
  delay(180);
  s_mode = MODE_ANIM;
}

// ---- 播报笑脸 ----
static unsigned long s_speakingSmileUntil = 0;

static void drawSpeakingSmileFace() {
  const int cx = 160, cy = 112, faceR = 80;
  const int eyeY = 95, leftX = 125, rightX = 195;

  tft.fillScreen(COL_BG);
  for (int t = 0; t < 3; t++) tft.drawCircle(cx, cy, faceR - t, COL_FACE);

  tft.fillEllipse(leftX, eyeY, 14, 18, COL_SCLERA);
  tft.fillEllipse(rightX, eyeY, 14, 18, COL_SCLERA);
  tft.fillCircle(leftX + 2, eyeY + 2, 8, COL_PUPIL);
  tft.fillCircle(rightX + 2, eyeY + 2, 8, COL_PUPIL);
  tft.fillCircle(leftX + 5, eyeY - 3, 3, COL_WHITE);
  tft.fillCircle(rightX + 5, eyeY - 3, 3, COL_WHITE);

  for (int t = 0; t < 3; t++) {
    tft.drawLine(120, 138 + t, 142, 152 + t, COL_WHITE);
    tft.drawLine(142, 152 + t, 178, 152 + t, COL_WHITE);
    tft.drawLine(178, 152 + t, 200, 138 + t, COL_WHITE);
  }
  tft.fillEllipse(cx, 155, 10, 6, COL_BLUSH);
  textCenter(214, "播报中…", FONT_CN_BIG, COL_OK);
}

void displayHoldSpeakingSmile(unsigned long durationMs, bool wifiConnected) {
  if (durationMs == 0) return;
  s_speakingSmileUntil = millis() + durationMs;
  drawSpeakingSmileFace();
  drawWifiIcon(wifiConnected, COL_BG, WIFI_SCALE);
  s_mode = MODE_SPEAK;
}

// ---- 数据面板 ----
struct RowSpec { int top; uint16_t color; const char* label; };
static const int ROW_TOP0 = 52;
static const int ROW_STEP = 46;

static void drawDataChrome() {
  tft.fillScreen(COL_BG);
  tft.fillRect(0, 0, SCREEN_W, 42, COL_HEADER);
  textT(12, 28, "植物管家", FONT_CN_BIG, COL_WHITE);

  const RowSpec rows[4] = {
    {ROW_TOP0,              COL_TEMP, "温度"},
    {ROW_TOP0 + ROW_STEP,   COL_HUM,  "湿度"},
    {ROW_TOP0 + ROW_STEP*2, COL_LUX,  "光照"},
    {ROW_TOP0 + ROW_STEP*3, COL_SOIL, "土壤"},
  };
  for (int i = 0; i < 4; i++) {
    tft.fillRect(0, rows[i].top, 6, 40, rows[i].color);
    tft.fillCircle(26, rows[i].top + 16, 9, rows[i].color);
    textT(44, rows[i].top + 22, rows[i].label, FONT_CN_BIG, rows[i].color);
  }
}

static void drawBar(int x, int y, int w, int h, int pct, uint16_t color) {
  if (pct < 0) pct = 0; if (pct > 100) pct = 100;
  tft.fillRect(x, y, w, h, COL_TRACK);
  tft.fillRect(x, y, w * pct / 100, h, color);
}

static void drawDataValues(const SensorData& d) {
  char buf[40];
  const int vx = 150;
  const int barW = 150;

  if (d.sensorOK[0]) snprintf(buf, sizeof(buf), "%.1f℃        ", d.temperature);
  else               snprintf(buf, sizeof(buf), "--          ");
  textO(vx, ROW_TOP0 + 22, buf, FONT_CN_BIG, COL_WHITE, COL_BG);

  if (d.sensorOK[0]) snprintf(buf, sizeof(buf), "%.0f%%        ", d.humidity);
  else               snprintf(buf, sizeof(buf), "--          ");
  textO(vx, ROW_TOP0 + ROW_STEP + 12, buf, FONT_CN_BIG, COL_WHITE, COL_BG);
  drawBar(vx, ROW_TOP0 + ROW_STEP + 22, barW, 9,
          d.sensorOK[0] ? (int)(d.humidity + 0.5f) : 0, COL_HUM);

  if (d.sensorOK[1]) snprintf(buf, sizeof(buf), "%.0f lx       ", d.lux);
  else               snprintf(buf, sizeof(buf), "--          ");
  textO(vx, ROW_TOP0 + ROW_STEP*2 + 22, buf, FONT_CN_BIG, COL_WHITE, COL_BG);

  if (d.sensorOK[2]) {
#if STAGE_PH
    if (d.sensorOK[3]) snprintf(buf, sizeof(buf), "%d%% pH%.1f   ", d.soilPercent, d.pH);
    else               snprintf(buf, sizeof(buf), "%d%% pH--    ", d.soilPercent);
#else
    snprintf(buf, sizeof(buf), "%d%%         ", d.soilPercent);
#endif
  } else {
    snprintf(buf, sizeof(buf), "--          ");
  }
  textO(vx, ROW_TOP0 + ROW_STEP*3 + 12, buf, FONT_CN_BIG, COL_WHITE, COL_BG);
  drawBar(vx, ROW_TOP0 + ROW_STEP*3 + 22, barW, 9,
          d.sensorOK[2] ? d.soilPercent : 0, COL_SOIL);

  drawWifiIcon(d.wifiConnected, COL_HEADER, WIFI_SCALE);
}

void displayUpdate(const SensorData& d) {
  if (s_speakingSmileUntil != 0) {
    if ((long)(millis() - s_speakingSmileUntil) < 0) {
      if (s_mode != MODE_SPEAK) { drawSpeakingSmileFace(); s_mode = MODE_SPEAK; }
      drawWifiIcon(d.wifiConnected, COL_BG, WIFI_SCALE);
      return;
    }
    s_speakingSmileUntil = 0;
    s_mode = MODE_NONE;
  }

  if (s_mode != MODE_DATA) {
    drawDataChrome();
    s_mode = MODE_DATA;
  }
  drawDataValues(d);
}

#endif
