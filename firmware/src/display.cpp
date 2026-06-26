#include "config.h"
#include "display.h"

#if STAGE_OLED

#  include <TFT_eSPI.h>
#  include <U8g2_for_TFT_eSPI.h>

// ============================================================
//  ST7735S 1.44" 128x128 彩色界面 (TFT_eSPI 绘图 + U8g2 中文字体)
//  SPI 引脚 / 驱动型号由 platformio.ini 的 TFT_eSPI build_flags 指定，
//  背光 PIN_TFT_BL 在 displayInit 手动拉高。
// ============================================================
static TFT_eSPI            tft;
static U8g2_for_TFT_eSPI   u8f;

static const int SCREEN_W = 128;
static const int SCREEN_H = 128;

#  define FONT_CN_BIG   u8g2_font_wqy16_t_gb2312   // 16px 中文（标题/动画）
#  define FONT_CN_SMALL u8g2_font_wqy12_t_gb2312a  // 12px 中文（数据行）

static constexpr uint16_t rgb(uint8_t r, uint8_t g, uint8_t b) {
    return (uint16_t)(((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3));
}

// 配色（植物绿主题）
static const uint16_t COL_BG     = rgb(10, 14, 12);
static const uint16_t COL_HEADER = rgb(24, 96, 60);
static const uint16_t COL_WHITE  = rgb(240, 244, 240);
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

// ============================================================
//  文本助手
// ============================================================
static void textT(int x, int y, const char* s, const uint8_t* font, uint16_t fg) {
    u8f.setFont(font);
    u8f.setFontMode(1);
    u8f.setForegroundColor(fg);
    u8f.drawUTF8(x, y, s);
}

static void textO(int x, int y, const char* s, const uint8_t* font, uint16_t fg, uint16_t bg) {
    u8f.setFont(font);
    u8f.setFontMode(0);
    u8f.setForegroundColor(fg);
    u8f.setBackgroundColor(bg);
    u8f.drawUTF8(x, y, s);
}

static void textCenter(int y, const char* s, const uint8_t* font, uint16_t fg) {
    u8f.setFont(font);
    int w = u8f.getUTF8Width(s);
    textT((SCREEN_W - w) / 2, y, s, font, fg);
}

// ============================================================
//  WiFi 状态图标 (16×12 XBM，彩色)
// ============================================================
#  define WIFI_W 16
#  define WIFI_H 12
static const uint8_t wifi_full_bits[] = {
    0xF0, 0x0F, 0x0C, 0x30, 0x03, 0xC0, 0xC0, 0x03,
    0x30, 0x0C, 0x08, 0x10, 0x80, 0x01, 0x40, 0x02,
    0x00, 0x00, 0x80, 0x01, 0x80, 0x01, 0x00, 0x00,
};

static void drawWifiIcon(bool connected, uint16_t bg) {
    const int ix = SCREEN_W - WIFI_W - 3, iy = 3;
    const uint16_t c = connected ? COL_OK : COL_WARN;

    tft.fillRect(ix - 1, iy - 1, WIFI_W + 4, WIFI_H + 3, bg);
    for (int row = 0; row < WIFI_H; row++) {
        for (int col = 0; col < WIFI_W; col++) {
            uint8_t bits = wifi_full_bits[row * 2 + (col / 8)];
            if (bits & (1 << (col % 8))) tft.drawPixel(ix + col, iy + row, c);
        }
    }
    if (!connected) {
        tft.drawLine(ix + 1, iy + WIFI_H - 1, ix + WIFI_W - 2, iy + 1, COL_WARN);
        tft.drawLine(ix + 2, iy + WIFI_H - 1, ix + WIFI_W - 1, iy + 1, COL_WARN);
    }
}

void displayInit() {
    pinMode(PIN_TFT_BL, OUTPUT);
    digitalWrite(PIN_TFT_BL, HIGH);

    tft.init();
    // rotation 3 = 横屏；且 GREENTAB128 在 rot 2/3 偏移为 0，避免 rot0/1 的 32px
    // 行偏移导致 1/4 雪花（本面板实际不需要 32 偏移）。
    tft.setRotation(3);
    tft.fillScreen(COL_BG);
    u8f.begin(tft);

    Serial.println("[TFT] ST7735S 128x128 (TFT_eSPI) init");

    int cx = SCREEN_W / 2;
    tft.fillRect(cx - 2, 56, 4, 18, COL_FACE);                  // 茎
    tft.fillTriangle(cx, 46, cx - 14, 62, cx + 2, 64, COL_FACE);
    tft.fillTriangle(cx, 46, cx + 14, 62, cx - 2, 64, COL_FACE);
    textCenter(98, "植物管家", FONT_CN_SMALL, COL_WHITE);
    textCenter(116, "启动中...", FONT_CN_SMALL, COL_OK);
    s_mode = MODE_ANIM;
}

// ============================================================
//  开机眨眼动画
// ============================================================
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

// ============================================================
//  浇水回馈：俏皮圆脸 + 单眼 wink
// ============================================================
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

// ============================================================
//  稳定后环境播报：对称笑脸
// ============================================================
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
    drawWifiIcon(wifiConnected, COL_BG);
    s_mode = MODE_SPEAK;
}

// ============================================================
//  数据面板（128x128：标题栏 + 4 行）
// ============================================================
struct RowSpec { int top; uint16_t color; const char* label; };
static const int ROW_TOP0 = 22;
static const int ROW_STEP = 26;

static void drawDataChrome() {
    tft.fillScreen(COL_BG);
    tft.fillRect(0, 0, SCREEN_W, 18, COL_HEADER);
    textT(4, 14, "植物管家", FONT_CN_SMALL, COL_WHITE);

    const RowSpec rows[4] = {
        {ROW_TOP0,             COL_TEMP, "温"},
        {ROW_TOP0 + ROW_STEP,  COL_HUM,  "湿"},
        {ROW_TOP0 + ROW_STEP*2,COL_LUX,  "光"},
        {ROW_TOP0 + ROW_STEP*3,COL_SOIL, "土"},
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
#  if STAGE_PH
        if (d.sensorOK[3]) snprintf(buf, sizeof(buf), "土 %d%% pH%.1f ", d.soilPercent, d.pH);
        else               snprintf(buf, sizeof(buf), "土 %d%% pH-- ", d.soilPercent);
#  else
        snprintf(buf, sizeof(buf), "土 %d%%      ", d.soilPercent);
#  endif
    } else {
        snprintf(buf, sizeof(buf), "土 --       ");
    }
    textO(vx, ROW_TOP0 + ROW_STEP*3 + 15, buf, FONT_CN_SMALL, COL_WHITE, COL_BG);

    drawWifiIcon(d.wifiConnected, COL_HEADER);
}

void displayUpdate(const SensorData& d) {
    if (s_speakingSmileUntil != 0) {
        if ((long)(millis() - s_speakingSmileUntil) < 0) {
            if (s_mode != MODE_SPEAK) { drawSpeakingSmileFace(); s_mode = MODE_SPEAK; }
            drawWifiIcon(d.wifiConnected, COL_BG);
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

#else  // STAGE_OLED == 0

void displayInit() {}
void displayBootAnimation() {}
void displayUpdate(const SensorData&) {}
void displayWateringWink() {}
void displayHoldSpeakingSmile(unsigned long, bool) {}

#endif
