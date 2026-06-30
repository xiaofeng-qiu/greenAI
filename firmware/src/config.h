#pragma once

// ============================================================
//  Stage Toggles — set 1 to enable, 0 to disable
// ============================================================
#define STAGE_SERIAL       1
#define STAGE_OLED         1   // 显示总开关（沿用此名）：1=启用所选屏，0=不驱动任何屏
#define STAGE_TTS          1
#define STAGE_PH           1
#define STAGE_WIFI_PROV    1   // SoftAP 配网
#define STAGE_WIFI_UPLOAD  1

// ============================================================
//  硬件变体选择 flag（默认见下；可在 platformio.ini 的 build_flags 覆盖）
// ============================================================
// 显示驱动
#define DISP_OLED          0   // SSD1306 128x64 单色 OLED (U8g2/I²C)
#define DISP_ILI9341       1   // ILI9341 240x320 彩色 (TFT_eSPI)，横屏 320x240
#define DISP_ST7735        2   // ST7735 1.44" 128x128 彩色 (TFT_eSPI)
#ifndef DISPLAY_DRIVER
#  define DISPLAY_DRIVER   DISP_ILI9341
#endif

// 语音引擎
#define TTS_EDGE           0   // 服务端 edge-tts 合成 MP3 → ESP8266Audio 解码 → I2S(MAX98357A)
#define TTS_LU6288         1   // 老方案：LU6288 UART 本地合成（GBK）
#ifndef TTS_ENGINE
#  define TTS_ENGINE       TTS_EDGE
#endif

/**
 * 量产配网：将 GREENAI_PROVISION_EMBED_API_BASE 置 1，并设置 GREENAI_API_BASE_DEFAULT
 * 为带引号的 API 根 URL（无路径尾斜杠，如 "https://api.example.com"），配网页将注入该地址
 * 且不再展示「后端 API 根地址」输入框。
 * 开发/自托管：保持 GREENAI_PROVISION_EMBED_API_BASE 为 0；GREENAI_API_BASE_DEFAULT 可为 ""，
 * 在配网页折叠区填写 API。
 */
#ifndef GREENAI_PROVISION_EMBED_API_BASE
#  define GREENAI_PROVISION_EMBED_API_BASE 0
#endif
#ifndef GREENAI_API_BASE_DEFAULT
#  define GREENAI_API_BASE_DEFAULT ""
#endif

// 语音：服务端 edge-tts 合成 → 后端 /internal/tts 返回 MP3 → 设备 ESP8266Audio 解码经 I2S 推 MAX98357A。（已替换原 LU6288 UART 方案）

// ============================================================
//  Pin Definitions
// ============================================================
// Wire  (I²C0): SHT30（旧 OLED 已移除；OLED 曾提供的 4.7kΩ 上拉需自行补到 SDA/SCL）
#define PIN_SHT_SDA        5
#define PIN_SHT_SCL        4

// TFT ILI9341 240x320 (4-wire SPI)，TFT_eSPI 彩色 + U8g2 中文字体
//   屏丝印 → ESP32-S3：VCC→3V3  GND→GND  CS→10  RESET→14  DC→13
//            SDI(MOSI)→11  SCK→12  LED(背光)→21  SDO(MISO) 不接
//   触摸 (XPT2046, T_*) 暂不接线/不驱动。
//   注意：SPI/CS/DC/RST 引脚由 platformio.ini 的 TFT_eSPI build_flags 配置，
//        下面这些宏仅作文档对照；代码里只用 PIN_TFT_BL 控制背光。
#define PIN_TFT_SCLK       12
#define PIN_TFT_MOSI       11
#define PIN_TFT_MISO       -1   // SDO 仅显示用途不读，留空
#define PIN_TFT_CS         10
#define PIN_TFT_DC         13
#define PIN_TFT_RST        14
#define PIN_TFT_BL         21   // 背光，HIGH 点亮；不需控制可直接接 3V3

// Wire1 (I²C1): BH1750
#define PIN_LIGHT_SDA      6
#define PIN_LIGHT_SCL      7

// 模拟输入
#define PIN_SOIL_MOISTURE  1
#define PIN_PH             2

// 语音引脚（按 TTS_ENGINE 二选一使用；GPIO 复用，编译期只编一种引擎）
//   TTS_EDGE  → I2S 输出 (MAX98357A)：BCLK→17  LRC→18  DIN→16
//               VIN→5V/3V3  GND→GND  SD→3V3(常开)  GAIN→悬空(9dB)；喇叭 4-8Ω 3W（⊖ 勿接地）
//   TTS_LU6288→ UART1：模块 TX→ESP RX(GPIO18)，模块 RX←ESP TX(GPIO17)
#define PIN_I2S_BCLK       17
#define PIN_I2S_LRC        18
#define PIN_I2S_DIN        16
#define PIN_TTS_RX         18   // LU6288 UART RX (模块 TX → 此脚)
#define PIN_TTS_TX         17   // LU6288 UART TX (此脚 → 模块 RX)

/** LU6288 调试：每次 ttsSpeak 后读模块 TX→ESP RX 并打印 hex；调通后可改 0。 */
#ifndef TTS_DEBUG_MODULE_RX
#  define TTS_DEBUG_MODULE_RX 1
#endif

// 板载 LED
#define PIN_LED_BUILTIN    48

// BOOT 按钮（ESP32-S3-DevKitC 默认是 GPIO0，低电平按下）
#define PIN_BOOT_BUTTON    0

// 长按 BOOT 多少毫秒触发清凭证 + 重启
#define BOOT_LONG_PRESS_MS 5000UL

// ============================================================
//  Sensor Constants
// ============================================================
// 电容式 V2.0 @ 3.3V：raw 越大越干（本探头实测：空气 ~3250，清水 ~1530）
#define SOIL_ADC_DRY       3260
#define SOIL_ADC_WET       1520

// pH：V = 还原到模块 Po 侧的电压(伏)：Vgpio=phRaw*3.3/4095；分压开启时 V=3*Vgpio，否则 V=Vgpio。
//       pH = PH_SLOPE * V + PH_OFFSET。未标定前默认斜率仅作占位。
// 单点 pH7：在 pH7.01 缓冲液里读 pH_read，PH_OFFSET += (7.0f - pH_read)，斜率可先不动。
// 两点 pH4+pH7：记 V7、V4，PH_SLOPE=(7-4)/(V7-V4)，PH_OFFSET=7 - PH_SLOPE*V7。
#define PH_SLOPE                   3.5f
#define PH_OFFSET                  2.1f  // 单点 pH7：缓冲液里曾读 4.9 → +2.1；若当时不是 pH7 液请重标
#define PH_USE_VOLTAGE_DIVIDER_3   1   // 1 = Po 经 10k+20k 分压到 GPIO2
#define PH_ADC_HIGH_SAT_RAW        4080  // raw≥此值不报 pH（ADC 顶格）
