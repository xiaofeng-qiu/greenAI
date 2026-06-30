#include "config.h"
#include "display.h"

#if STAGE_OLED

#  include <TFT_eSPI.h>
#  include <U8g2_for_TFT_eSPI.h>

// ============================================================
//  ILI9341 横屏 320x240 彩色界面 (TFT_eSPI 绘图 + U8g2 中文字体)
//  SPI 引脚由 platformio.ini 的 TFT_eSPI build_flags 指定，
//  背光 PIN_TFT_BL 在 displayInit 手动拉高。
//  rotation 3 = 横屏，排线/USB 口在左侧（若上下颠倒改 setRotation(1)）。
// ============================================================
static TFT_eSPI            tft;
static U8g2_for_TFT_eSPI   u8f;

static const int SCREEN_W = 320;
static const int SCREEN_H = 240;

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
    const int ix = SCREEN_W - iw - 10, iy = 8;
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
    tft.setRotation(3);                // 横屏 320(W) x 240(H)，排线在左
    tft.fillScreen(COL_BG);
    u8f.begin(tft);

    Serial.println("[TFT] ILI9341 320x240 landscape (TFT_eSPI) init");

    // 启动画面：标题 + 一棵小苗
    int cx = SCREEN_W / 2;
    tft.fillRect(cx - 4, 108, 8, 36, COL_FACE);                      // 茎
    tft.fillTriangle(cx, 90, cx - 26, 122, cx + 4, 128, COL_FACE);   // 左叶
    tft.fillTriangle(cx, 90, cx + 26, 122, cx - 4, 128, COL_FACE);   // 右叶
    textCenter(176, "植物管家", FONT_CN_BIG, COL_WHITE);
    textCenter(202, "启动中...", FONT_CN_SMALL, COL_OK);
    s_mode = MODE_ANIM;
}

// ============================================================
//  开机眨眼动画（眼睛区域用离屏 sprite 双缓冲，避免整屏清屏闪烁）
// ============================================================
static const int EYE_TOP = 50;    // 眼睛精灵在屏幕上的 Y 起点
static const int EYE_H   = 104;   // 精灵高度（覆盖眼睛活动范围）

// 把一帧眼睛画进精灵（精灵内坐标 = 屏幕坐标 - EYE_TOP），再一次性推到屏上
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

// 退路：内存不足时直接画（只清眼睛区域，仍可能轻微闪）
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

    // 背景与标题只画一次（标题在精灵区域之外，不参与逐帧刷新）
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

// ============================================================
//  浇水回馈：俏皮圆脸 + 单眼 wink + 媚眼
// ============================================================
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

    if (frame >= 1) tft.fillRect(rightX - 20, eyeY - 28, 20, 3, COL_FACE);  // 右眉挑

    if (frame <= 0) {
        tft.fillEllipse(rightX, eyeY, 16, 20, COL_SCLERA);
        tft.fillCircle(rightX + 2, eyeY + 2, 8, COL_PUPIL);
        tft.fillCircle(rightX + 6, eyeY - 2, 3, COL_WHITE);
    } else if (frame == 1) {
        tft.fillEllipse(rightX, eyeY, 16, 10, COL_SCLERA);
        tft.fillCircle(rightX + 2, eyeY, 6, COL_PUPIL);
    } else if (frame <= 4) {
        tft.fillRect(rightX - 20, eyeY - 3, 40, 6, COL_FACE);               // 眯眼 wink
    } else {
        tft.fillEllipse(rightX, eyeY, 16, 18, COL_SCLERA);
        tft.fillCircle(rightX + 2, eyeY + 2, 8, COL_PUPIL);
        tft.fillCircle(rightX + 6, eyeY - 2, 3, COL_WHITE);
    }

    if (frame >= 2 && frame <= 4) {   // 小爱心
        tft.fillCircle(262, 58, 6, COL_HEART);
        tft.fillCircle(274, 58, 6, COL_HEART);
        tft.fillTriangle(255, 62, 281, 62, 268, 78, COL_HEART);
    }

    int sd = (frame >= 3) ? 2 : 0;    // 微笑
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

// ============================================================
//  稳定后环境播报：对称笑脸
// ============================================================
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
    tft.fillEllipse(cx, 155, 10, 6, COL_BLUSH);  // 略张的嘴

    textCenter(214, "播报中…", FONT_CN_BIG, COL_OK);
}

void displayHoldSpeakingSmile(unsigned long durationMs, bool wifiConnected) {
    if (durationMs == 0) return;
    s_speakingSmileUntil = millis() + durationMs;
    drawSpeakingSmileFace();
    drawWifiIcon(wifiConnected, COL_BG);
    s_mode = MODE_SPEAK;
}

// ============================================================
//  数据面板（横屏 320x240：标题栏 + 4 行）
// ============================================================
struct RowSpec { int top; uint16_t color; const char* label; };
static const int  ROW_TOP0  = 52;
static const int  ROW_STEP  = 46;

static void drawDataChrome() {
    tft.fillScreen(COL_BG);
    tft.fillRect(0, 0, SCREEN_W, 42, COL_HEADER);
    textT(12, 28, "植物管家", FONT_CN_BIG, COL_WHITE);

    const RowSpec rows[4] = {
        {ROW_TOP0,             COL_TEMP, "温度"},
        {ROW_TOP0 + ROW_STEP,  COL_HUM,  "湿度"},
        {ROW_TOP0 + ROW_STEP*2,COL_LUX,  "光照"},
        {ROW_TOP0 + ROW_STEP*3,COL_SOIL, "土壤"},
    };
    for (int i = 0; i < 4; i++) {
        tft.fillRect(0, rows[i].top, 6, 40, rows[i].color);            // 左侧色条
        tft.fillCircle(26, rows[i].top + 16, 9, rows[i].color);        // 圆点
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

    // 温度
    if (d.sensorOK[0]) snprintf(buf, sizeof(buf), "%.1f℃        ", d.temperature);
    else               snprintf(buf, sizeof(buf), "--          ");
    textO(vx, ROW_TOP0 + 22, buf, FONT_CN_BIG, COL_WHITE, COL_BG);

    // 湿度 + 进度条
    if (d.sensorOK[0]) snprintf(buf, sizeof(buf), "%.0f%%        ", d.humidity);
    else               snprintf(buf, sizeof(buf), "--          ");
    textO(vx, ROW_TOP0 + ROW_STEP + 12, buf, FONT_CN_BIG, COL_WHITE, COL_BG);
    drawBar(vx, ROW_TOP0 + ROW_STEP + 22, barW, 9,
            d.sensorOK[0] ? (int)(d.humidity + 0.5f) : 0, COL_HUM);

    // 光照
    if (d.sensorOK[1]) snprintf(buf, sizeof(buf), "%.0f lx       ", d.lux);
    else               snprintf(buf, sizeof(buf), "--          ");
    textO(vx, ROW_TOP0 + ROW_STEP*2 + 22, buf, FONT_CN_BIG, COL_WHITE, COL_BG);

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
    textO(vx, ROW_TOP0 + ROW_STEP*3 + 12, buf, FONT_CN_BIG, COL_WHITE, COL_BG);
    drawBar(vx, ROW_TOP0 + ROW_STEP*3 + 22, barW, 9,
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
