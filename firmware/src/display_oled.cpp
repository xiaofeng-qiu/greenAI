#include "config.h"
#include "display.h"

#if STAGE_OLED && (DISPLAY_DRIVER == DISP_OLED)

#include <U8g2lib.h>

// SSD1306 128x64 单色 OLED（HW I²C，与 SHT30 共用 Wire/GPIO5/4）
static U8G2_SSD1306_128X64_NONAME_F_HW_I2C u8g2(U8G2_R0, /*reset=*/U8X8_PIN_NONE);

#define WIFI_W 16
#define WIFI_H 12
static const uint8_t wifi_full_bits[] PROGMEM = {
    0xF0, 0x0F, 0x0C, 0x30, 0x03, 0xC0, 0xC0, 0x03,
    0x30, 0x0C, 0x08, 0x10, 0x80, 0x01, 0x40, 0x02,
    0x00, 0x00, 0x80, 0x01, 0x80, 0x01, 0x00, 0x00,
};

static void drawWifiIcon(bool connected) {
  const int ix = 110, iy = 0;
  u8g2.drawXBMP(ix, iy, WIFI_W, WIFI_H, wifi_full_bits);
  if (!connected) {
    u8g2.drawLine(ix + 1, iy + WIFI_H - 1, ix + WIFI_W - 2, iy + 1);
    u8g2.drawLine(ix + 2, iy + WIFI_H - 1, ix + WIFI_W - 1, iy + 1);
  }
}

void displayInit() {
  if (u8g2.begin()) {
    Serial.println("[OLED] init OK");
    u8g2.setPowerSave(0);
    u8g2.setContrast(255);
    u8g2.enableUTF8Print();
    u8g2.clearBuffer();
    u8g2.setFont(u8g2_font_wqy12_t_gb2312a);
    u8g2.drawUTF8(20, 28, "植物管家");
    u8g2.drawUTF8(28, 50, "启动中...");
    u8g2.sendBuffer();
  } else {
    Serial.println("[OLED] FAIL");
  }
}

// ---- 开机眨眼 ----
static void drawBootFrame(int eyeRy) {
  const int eyeCY = 22, leftCX = 40, rightCX = 88, eyeRx = 20;
  u8g2.clearBuffer();
  u8g2.setDrawColor(1);
  if (eyeRy <= 1) {
    u8g2.drawHLine(leftCX  - eyeRx, eyeCY, eyeRx * 2);
    u8g2.drawHLine(leftCX  - eyeRx, eyeCY + 1, eyeRx * 2);
    u8g2.drawHLine(rightCX - eyeRx, eyeCY, eyeRx * 2);
    u8g2.drawHLine(rightCX - eyeRx, eyeCY + 1, eyeRx * 2);
  } else {
    u8g2.drawFilledEllipse(leftCX,  eyeCY, eyeRx, eyeRy);
    u8g2.drawFilledEllipse(rightCX, eyeCY, eyeRx, eyeRy);
    if (eyeRy >= 10) {
      u8g2.setDrawColor(0);
      u8g2.drawDisc(leftCX  + 3, eyeCY, 6);
      u8g2.drawDisc(rightCX + 3, eyeCY, 6);
      u8g2.setDrawColor(1);
      u8g2.drawDisc(leftCX  + 5, eyeCY - 3, 2);
      u8g2.drawDisc(rightCX + 5, eyeCY - 3, 2);
    }
  }
  u8g2.setDrawColor(1);
  u8g2.setFont(u8g2_font_wqy12_t_gb2312a);
  u8g2.drawUTF8(40, 62, "植物管家");
  u8g2.sendBuffer();
}

void displayBootAnimation() {
  static const int blinkFrames[] = {
    20, 20, 20, 20, 16, 11, 6, 2, 0, 0, 0, 2, 6, 11, 16, 20,
  };
  const int frameCount = sizeof(blinkFrames) / sizeof(blinkFrames[0]);
  for (int loop = 0; loop < 3; loop++)
    for (int i = 0; i < frameCount; i++) { drawBootFrame(blinkFrames[i]); delay(45); }
  drawBootFrame(20);
  delay(300);
}

// ---- 浇水回馈 ----
static void drawWateringWinkFrame(int frame) {
  const int cx = 64, cy = 34;
  u8g2.clearBuffer();
  u8g2.setDrawColor(1);
  u8g2.drawCircle(cx, cy, 22);
  u8g2.drawCircle(cx, cy, 21);
  u8g2.drawDisc(40, 40, 3);
  u8g2.drawDisc(88, 40, 3);

  const int eyeY = 28, leftX = 48, rightX = 80;
  int pupilShift = (frame >= 2 && frame <= 4) ? 4 : 0;
  u8g2.drawFilledEllipse(leftX, eyeY, 8, 10);
  u8g2.setDrawColor(0);
  u8g2.drawDisc(leftX + 1 + pupilShift, eyeY + 1, 4);
  u8g2.setDrawColor(1);
  u8g2.drawDisc(leftX + 3 + pupilShift, eyeY - 1, 2);

  if (frame >= 1) {
    u8g2.drawHLine(rightX - 10, eyeY - 12, 10);
    u8g2.drawHLine(rightX - 9, eyeY - 13, 8);
  }

  u8g2.setDrawColor(1);
  if (frame <= 0) {
    u8g2.drawFilledEllipse(rightX, eyeY, 8, 10);
    u8g2.setDrawColor(0);
    u8g2.drawDisc(rightX + 1, eyeY + 1, 4);
    u8g2.setDrawColor(1);
    u8g2.drawDisc(rightX + 3, eyeY - 1, 2);
  } else if (frame == 1) {
    u8g2.drawFilledEllipse(rightX, eyeY, 8, 5);
    u8g2.setDrawColor(0);
    u8g2.drawDisc(rightX + 1, eyeY, 3);
    u8g2.setDrawColor(1);
  } else if (frame <= 4) {
    u8g2.drawHLine(rightX - 10, eyeY, 20);
    u8g2.drawHLine(rightX - 10, eyeY + 1, 20);
    u8g2.drawHLine(rightX - 9, eyeY - 1, 18);
  } else {
    u8g2.drawFilledEllipse(rightX, eyeY, 8, 9);
    u8g2.setDrawColor(0);
    u8g2.drawDisc(rightX + 1, eyeY + 1, 4);
    u8g2.setDrawColor(1);
    u8g2.drawDisc(rightX + 3, eyeY - 1, 2);
  }

  if (frame >= 2 && frame <= 4) {
    u8g2.drawDisc(98, 22, 2);
    u8g2.drawDisc(101, 22, 2);
    u8g2.drawTriangle(96, 24, 103, 24, 99, 28);
  }

  int smileDrop = (frame >= 3) ? 1 : 0;
  u8g2.drawLine(48, 45 + smileDrop, 56, 51 + smileDrop);
  u8g2.drawLine(56, 51 + smileDrop, 72, 51 + smileDrop);
  u8g2.drawLine(72, 51 + smileDrop, 80, 45 + smileDrop);

  u8g2.setFont(u8g2_font_wqy12_t_gb2312a);
  u8g2.drawUTF8(34, 62, "喝饱啦~");
}

void displayWateringWink() {
  u8g2.setPowerSave(0);
  for (int f = 0; f < 6; f++) {
    drawWateringWinkFrame(f);
    u8g2.sendBuffer();
    delay(95);
  }
  delay(180);
}

// ---- 播报笑脸 ----
static unsigned long s_speakingSmileUntil = 0;

static void drawSpeakingSmileFace() {
  const int cx = 64, cy = 34;
  const int eyeY = 28, leftX = 48, rightX = 80;
  u8g2.clearBuffer();
  u8g2.setDrawColor(1);
  u8g2.drawCircle(cx, cy, 22);
  u8g2.drawCircle(cx, cy, 21);
  u8g2.drawFilledEllipse(leftX, eyeY, 7, 9);
  u8g2.drawFilledEllipse(rightX, eyeY, 7, 9);
  u8g2.setDrawColor(0);
  u8g2.drawDisc(leftX + 1, eyeY + 1, 4);
  u8g2.drawDisc(rightX + 1, eyeY + 1, 4);
  u8g2.setDrawColor(1);
  u8g2.drawDisc(leftX + 2, eyeY - 2, 2);
  u8g2.drawDisc(rightX + 2, eyeY - 2, 2);
  u8g2.drawLine(46, 44, 54, 50);
  u8g2.drawLine(54, 50, 74, 50);
  u8g2.drawLine(74, 50, 82, 44);
  u8g2.setDrawColor(0);
  u8g2.drawFilledEllipse(64, 51, 5, 3);
  u8g2.setDrawColor(1);
  u8g2.setFont(u8g2_font_wqy12_t_gb2312a);
  u8g2.drawUTF8(38, 62, "播报中…");
}

void displayHoldSpeakingSmile(unsigned long durationMs, bool wifiConnected) {
  if (durationMs == 0) return;
  s_speakingSmileUntil = millis() + durationMs;
  u8g2.setPowerSave(0);
  drawSpeakingSmileFace();
  drawWifiIcon(wifiConnected);
  u8g2.sendBuffer();
}

void displayUpdate(const SensorData& d) {
  char buf[48];
  u8g2.setPowerSave(0);

  if (s_speakingSmileUntil != 0) {
    const unsigned long now = millis();
    if ((long)(now - s_speakingSmileUntil) < 0) {
      drawSpeakingSmileFace();
      drawWifiIcon(d.wifiConnected);
      u8g2.sendBuffer();
      return;
    }
    s_speakingSmileUntil = 0;
  }

  u8g2.setFont(u8g2_font_wqy12_t_gb2312a);
  u8g2.clearBuffer();

  if (d.sensorOK[0]) snprintf(buf, sizeof(buf), "温度: %.1f℃", d.temperature);
  else               snprintf(buf, sizeof(buf), "温度: --");
  u8g2.drawUTF8(0, 14, buf);

  if (d.sensorOK[0]) snprintf(buf, sizeof(buf), "湿度: %.0f%%", d.humidity);
  else               snprintf(buf, sizeof(buf), "湿度: --");
  u8g2.drawUTF8(0, 28, buf);

  if (d.sensorOK[1]) snprintf(buf, sizeof(buf), "光照: %.0f lx", d.lux);
  else               snprintf(buf, sizeof(buf), "光照: --");
  u8g2.drawUTF8(0, 42, buf);

  if (d.sensorOK[2]) {
#if STAGE_PH
    if (d.sensorOK[3]) snprintf(buf, sizeof(buf), "土壤: %d%% pH: %.1f", d.soilPercent, d.pH);
    else               snprintf(buf, sizeof(buf), "土壤: %d%% pH: --", d.soilPercent);
#else
    snprintf(buf, sizeof(buf), "土壤: %d%%", d.soilPercent);
#endif
  } else {
    snprintf(buf, sizeof(buf), "土壤: --");
  }
  u8g2.drawUTF8(0, 56, buf);

  drawWifiIcon(d.wifiConnected);
  u8g2.sendBuffer();
}

#elif !STAGE_OLED

// 显示总开关关闭：所有显示接口空实现（仅在 STAGE_OLED==0 时编译，避免与各驱动重复定义）
void displayInit() {}
void displayBootAnimation() {}
void displayUpdate(const SensorData&) {}
void displayWateringWink() {}
void displayHoldSpeakingSmile(unsigned long, bool) {}

#endif
