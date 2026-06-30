#pragma once
// ============================================================
//  TFT 彩屏共享助手（ILI9341 / ST7735 共用）
//  使用前必须先 #define SCREEN_W / SCREEN_H，再 #include 本文件。
//  仅在被选中的那个 TFT 实现文件里编译，故 static 全局不会冲突。
// ============================================================
#include <TFT_eSPI.h>
#include <U8g2_for_TFT_eSPI.h>

static TFT_eSPI          tft;
static U8g2_for_TFT_eSPI u8f;

#define FONT_CN_BIG   u8g2_font_wqy16_t_gb2312   // 16px 中文
#define FONT_CN_SMALL u8g2_font_wqy12_t_gb2312a  // 12px 中文

static constexpr uint16_t rgb(uint8_t r, uint8_t g, uint8_t b) {
  return (uint16_t)(((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3));
}

// 配色（植物绿主题）
static const uint16_t COL_BG     = rgb(10, 14, 12);
static const uint16_t COL_HEADER = rgb(24, 96, 60);
static const uint16_t COL_WHITE  = rgb(240, 244, 240);
static const uint16_t COL_TRACK  = rgb(40, 46, 42);
static const uint16_t COL_TEMP   = rgb(255, 140, 66);
static const uint16_t COL_HUM    = rgb(84, 160, 255);
static const uint16_t COL_LUX    = rgb(255, 205, 77);
static const uint16_t COL_SOIL   = rgb(173, 132, 86);
static const uint16_t COL_OK     = rgb(60, 205, 120);
static const uint16_t COL_WARN   = rgb(235, 80, 80);
static const uint16_t COL_FACE   = rgb(80, 205, 130);
static const uint16_t COL_BLUSH  = rgb(255, 130, 150);
static const uint16_t COL_SCLERA = rgb(245, 248, 245);
static const uint16_t COL_PUPIL  = rgb(28, 40, 70);
static const uint16_t COL_HEART  = rgb(255, 105, 140);

enum DispMode { MODE_NONE, MODE_DATA, MODE_SPEAK, MODE_ANIM };
static DispMode s_mode = MODE_NONE;

// ---- 文本助手 ----
static inline void textT(int x, int y, const char* s, const uint8_t* font, uint16_t fg) {
  u8f.setFont(font);
  u8f.setFontMode(1);                 // 透明
  u8f.setForegroundColor(fg);
  u8f.drawUTF8(x, y, s);
}

static inline void textO(int x, int y, const char* s, const uint8_t* font, uint16_t fg, uint16_t bg) {
  u8f.setFont(font);
  u8f.setFontMode(0);                 // 实底（覆盖旧字）
  u8f.setForegroundColor(fg);
  u8f.setBackgroundColor(bg);
  u8f.drawUTF8(x, y, s);
}

static inline void textCenter(int y, const char* s, const uint8_t* font, uint16_t fg) {
  u8f.setFont(font);
  int w = u8f.getUTF8Width(s);
  textT((SCREEN_W - w) / 2, y, s, font, fg);
}

// ---- WiFi 状态图标 (16×12 XBM，scale 倍放大，彩色) ----
#define WIFI_W 16
#define WIFI_H 12
static const uint8_t wifi_full_bits[] = {
    0xF0, 0x0F, 0x0C, 0x30, 0x03, 0xC0, 0xC0, 0x03,
    0x30, 0x0C, 0x08, 0x10, 0x80, 0x01, 0x40, 0x02,
    0x00, 0x00, 0x80, 0x01, 0x80, 0x01, 0x00, 0x00,
};

static inline void drawWifiIcon(bool connected, uint16_t bg, int scale) {
  const int iw = WIFI_W * scale, ih = WIFI_H * scale;
  const int margin = (scale >= 2) ? 8 : 3;
  const int ix = SCREEN_W - iw - margin, iy = margin;
  const uint16_t c = connected ? COL_OK : COL_WARN;

  tft.fillRect(ix - 2, iy - 2, iw + 6, ih + 4, bg);
  for (int row = 0; row < WIFI_H; row++) {
    for (int col = 0; col < WIFI_W; col++) {
      uint8_t bits = wifi_full_bits[row * 2 + (col / 8)];
      if (bits & (1 << (col % 8)))
        tft.fillRect(ix + col * scale, iy + row * scale, scale, scale, c);
    }
  }
  if (!connected) {
    tft.drawLine(ix + 2, iy + ih - 2, ix + iw - 3, iy + 2, COL_WARN);
    tft.drawLine(ix + 3, iy + ih - 2, ix + iw - 2, iy + 2, COL_WARN);
  }
}
