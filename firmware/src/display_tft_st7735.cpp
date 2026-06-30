#include "config.h"

#if STAGE_OLED && (DISPLAY_DRIVER == DISP_ST7735)

#include "display.h"

#define SCREEN_W 128
#define SCREEN_H 128
#include "display_tft_common.h"

static const int WIFI_SCALE = 1;

void displayInit() {
  pinMode(PIN_TFT_BL, OUTPUT);
  digitalWrite(PIN_TFT_BL, HIGH);

  tft.init();
  // rotation 3 = 横屏；GREENTAB128 在 rot 2/3 偏移为 0，避免 1/4 雪花
  tft.setRotation(3);
  tft.fillScreen(COL_BG);
  u8f.begin(tft);
  Serial.println("[TFT] ST7735S 128x128 init");

  int cx = SCREEN_W / 2;
  tft.fillRect(cx - 2, 56, 4, 18, COL_FACE);
  tft.fillTriangle(cx, 46, cx - 14, 62, cx + 2, 64, COL_FACE);
  tft.fillTriangle(cx, 46, cx + 14, 62, cx - 2, 64, COL_FACE);
  textCenter(98, "植物管家", FONT_CN_SMALL, COL_WHITE);
  textCenter(116, "启动中...", FONT_CN_SMALL, COL_OK);
  s_mode = MODE_ANIM;
}

// ---- 开机眨眼 ----
static void drawBootFrame(int eyeRy) {
  const int eyeCY = 52, leftCX = 44, rightCX = 84, eyeRx = 22;
  tft.fillScreen(COL_BG);
  if (eyeRy <= 2) {
    tft.fillRect(leftCX  - eyeRx, eyeCY - 1, eyeRx * 2, 3, COL_SCLERA);
    tft.fillRect(rightCX - eyeRx, eyeCY - 1, eyeRx * 2, 3, COL_SCLERA);
  } else {
    tft.fillEllipse(leftCX,  eyeCY, eyeRx, eyeRy, COL_SCLERA);
    tft.fillEllipse(rightCX, eyeCY, eyeRx, eyeRy, COL_SCLERA);
    if (eyeRy >= 11) {
      tft.fillCircle(leftCX  + 3, eyeCY, 7, COL_PUPIL);
      tft.fillCircle(rightCX + 3, eyeCY, 7, COL_PUPIL);
      tft.fillCircle(leftCX  + 5, eyeCY - 3, 2, COL_WHITE);
      tft.fillCircle(rightCX + 5, eyeCY - 3, 2, COL_WHITE);
    }
  }
  textCenter(112, "植物管家", FONT_CN_SMALL, COL_FACE);
}

void displayBootAnimation() {
  static const int blinkFrames[] = {
    22, 22, 22, 22, 17, 12, 6, 2, 0, 0, 0, 2, 6, 12, 17, 22,
  };
  const int frameCount = sizeof(blinkFrames) / sizeof(blinkFrames[0]);
  for (int loop = 0; loop < 3; loop++)
    for (int i = 0; i < frameCount; i++) { drawBootFrame(blinkFrames[i]); delay(45); }
  drawBootFrame(22);
  delay(300);
  s_mode = MODE_ANIM;
}

// ---- 浇水回馈 ----
static void drawWateringWinkFrame(int frame) {
  const int cx = 64, cy = 60, faceR = 40;
  const int eyeY = 52, leftX = 50, rightX = 78;

  tft.fillScreen(COL_BG);
  for (int t = 0; t < 2; t++) tft.drawCircle(cx, cy, faceR - t, COL_FACE);
  tft.fillCircle(leftX - 12, cy + 10, 4, COL_BLUSH);
  tft.fillCircle(rightX + 12, cy + 10, 4, COL_BLUSH);

  int pupilShift = (frame >= 2 && frame <= 4) ? 4 : 0;
  tft.fillEllipse(leftX, eyeY, 8, 10, COL_SCLERA);
  tft.fillCircle(leftX + 1 + pupilShift, eyeY + 1, 4, COL_PUPIL);
  tft.fillCircle(leftX + 3 + pupilShift, eyeY - 1, 2, COL_WHITE);

  if (frame >= 1) tft.fillRect(rightX - 10, eyeY - 14, 10, 2, COL_FACE);

  if (frame <= 0) {
    tft.fillEllipse(rightX, eyeY, 8, 10, COL_SCLERA);
    tft.fillCircle(rightX + 1, eyeY + 1, 4, COL_PUPIL);
    tft.fillCircle(rightX + 3, eyeY - 1, 2, COL_WHITE);
  } else if (frame == 1) {
    tft.fillEllipse(rightX, eyeY, 8, 5, COL_SCLERA);
    tft.fillCircle(rightX + 1, eyeY, 3, COL_PUPIL);
  } else if (frame <= 4) {
    tft.fillRect(rightX - 10, eyeY - 1, 20, 3, COL_FACE);
  } else {
    tft.fillEllipse(rightX, eyeY, 8, 9, COL_SCLERA);
    tft.fillCircle(rightX + 1, eyeY + 1, 4, COL_PUPIL);
    tft.fillCircle(rightX + 3, eyeY - 1, 2, COL_WHITE);
  }

  if (frame >= 2 && frame <= 4) {
    tft.fillCircle(104, 36, 3, COL_HEART);
    tft.fillCircle(110, 36, 3, COL_HEART);
    tft.fillTriangle(101, 38, 113, 38, 107, 46, COL_HEART);
  }

  int sd = (frame >= 3) ? 1 : 0;
  for (int t = 0; t < 2; t++) {
    tft.drawLine(50, 74 + sd + t, 58, 80 + sd + t, COL_WHITE);
    tft.drawLine(58, 80 + sd + t, 70, 80 + sd + t, COL_WHITE);
    tft.drawLine(70, 80 + sd + t, 78, 74 + sd + t, COL_WHITE);
  }
  textCenter(116, "喝饱啦~", FONT_CN_SMALL, COL_OK);
}

void displayWateringWink() {
  for (int f = 0; f < 6; f++) { drawWateringWinkFrame(f); delay(95); }
  delay(180);
  s_mode = MODE_ANIM;
}

// ---- 播报笑脸 ----
static unsigned long s_speakingSmileUntil = 0;

static void drawSpeakingSmileFace() {
  const int cx = 64, cy = 60, faceR = 40;
  const int eyeY = 52, leftX = 50, rightX = 78;

  tft.fillScreen(COL_BG);
  for (int t = 0; t < 2; t++) tft.drawCircle(cx, cy, faceR - t, COL_FACE);

  tft.fillEllipse(leftX, eyeY, 7, 9, COL_SCLERA);
  tft.fillEllipse(rightX, eyeY, 7, 9, COL_SCLERA);
  tft.fillCircle(leftX + 1, eyeY + 1, 4, COL_PUPIL);
  tft.fillCircle(rightX + 1, eyeY + 1, 4, COL_PUPIL);
  tft.fillCircle(leftX + 2, eyeY - 2, 2, COL_WHITE);
  tft.fillCircle(rightX + 2, eyeY - 2, 2, COL_WHITE);

  for (int t = 0; t < 2; t++) {
    tft.drawLine(48, 72 + t, 58, 80 + t, COL_WHITE);
    tft.drawLine(58, 80 + t, 70, 80 + t, COL_WHITE);
    tft.drawLine(70, 80 + t, 80, 72 + t, COL_WHITE);
  }
  tft.fillEllipse(cx, 81, 5, 3, COL_BLUSH);
  textCenter(116, "播报中…", FONT_CN_SMALL, COL_OK);
}

void displayHoldSpeakingSmile(unsigned long durationMs, bool wifiConnected) {
  if (durationMs == 0) return;
  s_speakingSmileUntil = millis() + durationMs;
  drawSpeakingSmileFace();
  drawWifiIcon(wifiConnected, COL_BG, WIFI_SCALE);
  s_mode = MODE_SPEAK;
}

// ---- 数据面板（128x128：标题栏 + 4 行）----
struct RowSpec { int top; uint16_t color; };
static const int ROW_TOP0 = 22;
static const int ROW_STEP = 26;

static void drawDataChrome() {
  tft.fillScreen(COL_BG);
  tft.fillRect(0, 0, SCREEN_W, 18, COL_HEADER);
  textT(4, 14, "植物管家", FONT_CN_SMALL, COL_WHITE);

  const RowSpec rows[4] = {
    {ROW_TOP0,              COL_TEMP},
    {ROW_TOP0 + ROW_STEP,   COL_HUM },
    {ROW_TOP0 + ROW_STEP*2, COL_LUX },
    {ROW_TOP0 + ROW_STEP*3, COL_SOIL},
  };
  for (int i = 0; i < 4; i++) {
    tft.fillRect(0, rows[i].top, 4, 22, rows[i].color);
    tft.fillCircle(11, rows[i].top + 10, 5, rows[i].color);
  }
}

static void drawDataValues(const SensorData& d) {
  char buf[40];
  const int vx = 22;

  if (d.sensorOK[0]) snprintf(buf, sizeof(buf), "温 %.1f℃    ", d.temperature);
  else               snprintf(buf, sizeof(buf), "温 --       ");
  textO(vx, ROW_TOP0 + 15, buf, FONT_CN_SMALL, COL_WHITE, COL_BG);

  if (d.sensorOK[0]) snprintf(buf, sizeof(buf), "湿 %.0f%%     ", d.humidity);
  else               snprintf(buf, sizeof(buf), "湿 --       ");
  textO(vx, ROW_TOP0 + ROW_STEP + 15, buf, FONT_CN_SMALL, COL_WHITE, COL_BG);

  if (d.sensorOK[1]) snprintf(buf, sizeof(buf), "光 %.0flx    ", d.lux);
  else               snprintf(buf, sizeof(buf), "光 --       ");
  textO(vx, ROW_TOP0 + ROW_STEP*2 + 15, buf, FONT_CN_SMALL, COL_WHITE, COL_BG);

  if (d.sensorOK[2]) {
#if STAGE_PH
    if (d.sensorOK[3]) snprintf(buf, sizeof(buf), "土 %d%% pH%.1f ", d.soilPercent, d.pH);
    else               snprintf(buf, sizeof(buf), "土 %d%% pH-- ", d.soilPercent);
#else
    snprintf(buf, sizeof(buf), "土 %d%%      ", d.soilPercent);
#endif
  } else {
    snprintf(buf, sizeof(buf), "土 --       ");
  }
  textO(vx, ROW_TOP0 + ROW_STEP*3 + 15, buf, FONT_CN_SMALL, COL_WHITE, COL_BG);

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
