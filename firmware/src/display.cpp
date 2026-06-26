#include "config.h"
#include "display.h"

#if STAGE_OLED

#  include <TFT_eSPI.h>
#  include <U8g2_for_TFT_eSPI.h>

// ============================================================
//  ILI9341 240x320 彩色界面 (TFT_eSPI 绘图 + U8g2 中文字体)
//  SPI 引脚由 platformio.ini 的 TFT_eSPI build_flags 指定，
//  背光 PIN_TFT_BL 在 displayInit 手动拉高。
// ============================================================
static TFT_eSPI            tft;
static U8g2_for_TFT_eSPI   u8f;

static const int SCREEN_W = 240;
static const int SCREEN_H = 320;

#  define FONT_CN_BIG   u8g2_font_wqy16_t_gb2312   // 16px 中文
#  define FONT_CN_SMALL u8g2_font_wqy12_t_gb2312a  // 12px 中文

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

// 显示模式（用于避免数据面板每秒全屏刷新闪烁）
enum DispMode { MODE_NONE, MODE_DATA, MODE_SPEAK, MODE_ANIM };
static DispMode s_mode = MODE_NONE;

// ============================================================
//  文本助手
// ============================================================
static void textT(int x, int y, const char* s, const uint8_t* font, uint16_t fg) {
    u8f.setFont(font);
    u8f.setFontMode(1);                 // 透明
    u8f.setForegroundColor(fg);
    u8f.drawUTF8(x, y, s);
}

static void textO(int x, int y, const char* s, const uint8_t* font, uint16_t fg, uint16_t bg) {
    u8f.setFont(font);
    u8f.setFontMode(0);                 // 实底（覆盖旧字）
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
//  WiFi 状态图标 (16×12 XBM，2× 放大，彩色)
// ============================================================
#  define WIFI_W 16
#  define WIFI_H 12
static const uint8_t wifi_full_bits[] = {
    0xF0, 0x0F, 0x0C, 0x30, 0x03, 0xC0, 0xC0, 0x03,
    0x30, 0x0C, 0x08, 0x10, 0x80, 0x01, 0x40, 0x02,
    0x00, 0x00, 0x80, 0x01, 0x80, 0x01, 0x00, 0x00,
};

static void drawWifiIcon(bool connected, uint16_t bg) {
    const int scale = 2;
    const int iw = WIFI_W * scale, ih = WIFI_H * scale;
    const int ix = SCREEN_W - iw - 8, iy = 8;
    const uint16_t c = connected ? COL_OK : COL_WARN;

    tft.fillRect(ix - 2, iy - 2, iw + 6, ih + 4, bg);  // 清背景
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

void displayInit() {
    pinMode(PIN_TFT_BL, OUTPUT);
    digitalWrite(PIN_TFT_BL, HIGH);    // 点亮背光

    tft.init();
    tft.setRotation(0);                // 240(W) x 320(H) 竖屏
    tft.fillScreen(COL_BG);
    u8f.begin(tft);

    Serial.println("[TFT] ILI9341 (TFT_eSPI) init");

    // 启动画面：标题 + 一棵小苗
    int cx = SCREEN_W / 2;
    tft.fillRect(cx - 4, 150, 8, 40, COL_FACE);                 // 茎
    tft.fillTriangle(cx, 130, cx - 26, 162, cx + 4, 168, COL_FACE);  // 左叶
    tft.fillTriangle(cx, 130, cx + 26, 162, cx - 4, 168, COL_FACE);  // 右叶
    textCenter(225, "植物管家", FONT_CN_BIG, COL_WHITE);
    textCenter(255, "启动中...", FONT_CN_SMALL, COL_OK);
    s_mode = MODE_ANIM;
}

// ============================================================
//  开机眨眼动画
// ============================================================
static void drawBootFrame(int eyeRy) {
    const int eyeCY = 130, leftCX = 78, rightCX = 162, eyeRx = 42;

    tft.fillScreen(COL_BG);

    if (eyeRy <= 2) {
        tft.fillRect(leftCX  - eyeRx, eyeCY - 2, eyeRx * 2, 5, COL_SCLERA);
        tft.fillRect(rightCX - eyeRx, eyeCY - 2, eyeRx * 2, 5, COL_SCLERA);
    } else {
        tft.fillEllipse(leftCX,  eyeCY, eyeRx, eyeRy, COL_SCLERA);
        tft.fillEllipse(rightCX, eyeCY, eyeRx, eyeRy, COL_SCLERA);
        if (eyeRy >= 20) {
            tft.fillCircle(leftCX  + 6, eyeCY, 13, COL_PUPIL);
            tft.fillCircle(rightCX + 6, eyeCY, 13, COL_PUPIL);
            tft.fillCircle(leftCX  + 10, eyeCY - 6, 4, COL_WHITE);
            tft.fillCircle(rightCX + 10, eyeCY - 6, 4, COL_WHITE);
        }
    }
    textCenter(250, "植物管家", FONT_CN_BIG, COL_FACE);
}

void displayBootAnimation() {
    static const int blinkFrames[] = {
        42, 42, 42, 42, 34, 24, 14, 4, 0, 0, 0, 4, 14, 24, 34, 42,
    };
    const int frameCount = sizeof(blinkFrames) / sizeof(blinkFrames[0]);
    for (int loop = 0; loop < 3; loop++)
        for (int i = 0; i < frameCount; i++) { drawBootFrame(blinkFrames[i]); delay(45); }
    drawBootFrame(42);
    delay(300);
    s_mode = MODE_ANIM;
}

// ============================================================
//  浇水回馈：俏皮圆脸 + 单眼 wink + 媚眼
// ============================================================
static void drawWateringWinkFrame(int frame) {
    const int cx = 120, cy = 150, faceR = 72;
    const int eyeY = 130, leftX = 90, rightX = 150;

    tft.fillScreen(COL_BG);
    for (int t = 0; t < 3; t++) tft.drawCircle(cx, cy, faceR - t, COL_FACE);

    tft.fillCircle(leftX - 18, cy + 18, 6, COL_BLUSH);
    tft.fillCircle(rightX + 18, cy + 18, 6, COL_BLUSH);

    int pupilShift = (frame >= 2 && frame <= 4) ? 7 : 0;
    tft.fillEllipse(leftX, eyeY, 14, 18, COL_SCLERA);
    tft.fillCircle(leftX + 2 + pupilShift, eyeY + 2, 7, COL_PUPIL);
    tft.fillCircle(leftX + 5 + pupilShift, eyeY - 2, 3, COL_WHITE);

    if (frame >= 1) tft.fillRect(rightX - 18, eyeY - 24, 18, 3, COL_FACE);  // 右眉挑

    if (frame <= 0) {
        tft.fillEllipse(rightX, eyeY, 14, 18, COL_SCLERA);
        tft.fillCircle(rightX + 2, eyeY + 2, 7, COL_PUPIL);
        tft.fillCircle(rightX + 5, eyeY - 2, 3, COL_WHITE);
    } else if (frame == 1) {
        tft.fillEllipse(rightX, eyeY, 14, 9, COL_SCLERA);
        tft.fillCircle(rightX + 2, eyeY, 5, COL_PUPIL);
    } else if (frame <= 4) {
        tft.fillRect(rightX - 18, eyeY - 2, 36, 5, COL_FACE);               // 眯眼 wink
    } else {
        tft.fillEllipse(rightX, eyeY, 14, 16, COL_SCLERA);
        tft.fillCircle(rightX + 2, eyeY + 2, 7, COL_PUPIL);
        tft.fillCircle(rightX + 5, eyeY - 2, 3, COL_WHITE);
    }

    if (frame >= 2 && frame <= 4) {   // 小爱心
        tft.fillCircle(196, 96, 5, COL_HEART);
        tft.fillCircle(206, 96, 5, COL_HEART);
        tft.fillTriangle(190, 99, 212, 99, 201, 112, COL_HEART);
    }

    int sd = (frame >= 3) ? 2 : 0;    // 微笑
    for (int t = 0; t < 3; t++) {
        tft.drawLine(90, 180 + sd + t, 105, 192 + sd + t, COL_WHITE);
        tft.drawLine(105, 192 + sd + t, 135, 192 + sd + t, COL_WHITE);
        tft.drawLine(135, 192 + sd + t, 150, 180 + sd + t, COL_WHITE);
    }

    textCenter(270, "喝饱啦~", FONT_CN_BIG, COL_OK);
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
    const int cx = 120, cy = 150, faceR = 72;
    const int eyeY = 130, leftX = 90, rightX = 150;

    tft.fillScreen(COL_BG);
    for (int t = 0; t < 3; t++) tft.drawCircle(cx, cy, faceR - t, COL_FACE);

    tft.fillEllipse(leftX, eyeY, 12, 16, COL_SCLERA);
    tft.fillEllipse(rightX, eyeY, 12, 16, COL_SCLERA);
    tft.fillCircle(leftX + 2, eyeY + 2, 7, COL_PUPIL);
    tft.fillCircle(rightX + 2, eyeY + 2, 7, COL_PUPIL);
    tft.fillCircle(leftX + 4, eyeY - 3, 3, COL_WHITE);
    tft.fillCircle(rightX + 4, eyeY - 3, 3, COL_WHITE);

    for (int t = 0; t < 3; t++) {
        tft.drawLine(86, 178 + t, 102, 190 + t, COL_WHITE);
        tft.drawLine(102, 190 + t, 138, 190 + t, COL_WHITE);
        tft.drawLine(138, 190 + t, 154, 178 + t, COL_WHITE);
    }
    tft.fillEllipse(cx, 193, 9, 5, COL_BLUSH);  // 略张的嘴

    textCenter(270, "播报中…", FONT_CN_BIG, COL_OK);
}

void displayHoldSpeakingSmile(unsigned long durationMs, bool wifiConnected) {
    if (durationMs == 0) return;
    s_speakingSmileUntil = millis() + durationMs;
    drawSpeakingSmileFace();
    drawWifiIcon(wifiConnected, COL_BG);
    s_mode = MODE_SPEAK;
}

// ============================================================
//  数据面板
// ============================================================
struct RowSpec { int top; uint16_t color; const char* label; };
static const int  ROW_TOP0  = 56;
static const int  ROW_STEP  = 64;

static void drawDataChrome() {
    tft.fillScreen(COL_BG);
    tft.fillRect(0, 0, SCREEN_W, 44, COL_HEADER);
    textT(12, 30, "植物管家", FONT_CN_BIG, COL_WHITE);

    const RowSpec rows[4] = {
        {ROW_TOP0,             COL_TEMP, "温度"},
        {ROW_TOP0 + ROW_STEP,  COL_HUM,  "湿度"},
        {ROW_TOP0 + ROW_STEP*2,COL_LUX,  "光照"},
        {ROW_TOP0 + ROW_STEP*3,COL_SOIL, "土壤"},
    };
    for (int i = 0; i < 4; i++) {
        tft.fillRect(0, rows[i].top, 6, 52, rows[i].color);            // 左侧色条
        tft.fillCircle(24, rows[i].top + 22, 9, rows[i].color);        // 圆点
        textT(42, rows[i].top + 28, rows[i].label, FONT_CN_BIG, rows[i].color);
    }
}

static void drawBar(int x, int y, int w, int h, int pct, uint16_t color) {
    if (pct < 0) pct = 0; if (pct > 100) pct = 100;
    tft.fillRect(x, y, w, h, COL_TRACK);
    tft.fillRect(x, y, w * pct / 100, h, color);
}

static void drawDataValues(const SensorData& d) {
    char buf[40];
    const int vx = 118;

    // 温度
    if (d.sensorOK[0]) snprintf(buf, sizeof(buf), "%.1f℃        ", d.temperature);
    else               snprintf(buf, sizeof(buf), "--          ");
    textO(vx, ROW_TOP0 + 28, buf, FONT_CN_BIG, COL_WHITE, COL_BG);

    // 湿度 + 进度条
    if (d.sensorOK[0]) snprintf(buf, sizeof(buf), "%.0f%%        ", d.humidity);
    else               snprintf(buf, sizeof(buf), "--          ");
    textO(vx, ROW_TOP0 + ROW_STEP + 16, buf, FONT_CN_BIG, COL_WHITE, COL_BG);
    drawBar(vx, ROW_TOP0 + ROW_STEP + 26, 104, 8,
            d.sensorOK[0] ? (int)(d.humidity + 0.5f) : 0, COL_HUM);

    // 光照
    if (d.sensorOK[1]) snprintf(buf, sizeof(buf), "%.0f lx       ", d.lux);
    else               snprintf(buf, sizeof(buf), "--          ");
    textO(vx, ROW_TOP0 + ROW_STEP*2 + 28, buf, FONT_CN_BIG, COL_WHITE, COL_BG);

    // 土壤 (+pH) + 进度条
    if (d.sensorOK[2]) {
#  if STAGE_PH
        if (d.sensorOK[3]) snprintf(buf, sizeof(buf), "%d%% pH%.1f   ", d.soilPercent, d.pH);
        else               snprintf(buf, sizeof(buf), "%d%% pH--    ", d.soilPercent);
#  else
        snprintf(buf, sizeof(buf), "%d%%         ", d.soilPercent);
#  endif
    } else {
        snprintf(buf, sizeof(buf), "--          ");
    }
    textO(vx, ROW_TOP0 + ROW_STEP*3 + 16, buf, FONT_CN_BIG, COL_WHITE, COL_BG);
    drawBar(vx, ROW_TOP0 + ROW_STEP*3 + 26, 104, 8,
            d.sensorOK[2] ? d.soilPercent : 0, COL_SOIL);

    drawWifiIcon(d.wifiConnected, COL_HEADER);
}

void displayUpdate(const SensorData& d) {
    // 播报笑脸优先
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
