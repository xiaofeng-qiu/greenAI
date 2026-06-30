# 植物管家 (greenAI) — 固件

针对 **ESP32-S3-N16R8** 的面包板模块化固件：传感器采集 → TFT(ILI9341) 中文显示 → 语音播报（服务端 edge-tts + I2S）→ WiFi 配网 → 后端上报。

## 目录结构

```
firmware/
├── platformio.ini        # 板型 / 库 / 编译选项
├── src/
│   ├── config.h          # Stage 开关、引脚、常量
│   ├── main.cpp          # 主循环 + BOOT 长按复位
│   ├── sensors.{h,cpp}   # SHT30 / BH1750 / 土壤 / pH 汇总采集
│   ├── ph_sensor.{h,cpp} # pH DFRobot 官方算法（10 采样排序去极值取中 6 点）
│   ├── display.{h,cpp}   # TFT(ILI9341) 中文界面 + 眨眼/笑脸动画 + WiFi 状态图标
│   ├── network.{h,cpp}   # WiFi 配网 (SoftAP + Captive Portal) + 上报调度
│   ├── greenai_api.{h,cpp} # greenAI：HMAC + /internal/sensors/ingest、/logs、/devices/config、/tts
│   ├── tts.{h,cpp}       # 语音播报：拉服务端 edge-tts MP3 → ESP8266Audio 解码 → I2S(MAX98357A)
│   └── boot_sound.h      # 开机离线提示音（内置 MP3，由 backend 的 gen:boot-sound 生成）
└── README.md
```

## 快速开始

### 1. 安装 PlatformIO

VS Code → 扩展 → 搜索 **PlatformIO IDE** → 安装。

### 2. 接线

对照 [FAST-DEMO-breadboard-layout.svg](../FAST-DEMO-breadboard-layout.svg)。引脚定义见 [src/config.h](src/config.h)：

| 信号 | ESP32-S3 引脚 | 模块 |
|------|--------------|------|
| I²C0 SDA / SCL | **GPIO5 / GPIO4** | SHT30（⚠ 旧 OLED 移除后失去上拉，需自补 4.7kΩ 到 3V3） |
| I²C1 SDA / SCL | **GPIO6 / GPIO7** | BH1750（独占总线避免地址冲突） |
| TFT SCK / SDI(MOSI) | **GPIO12 / GPIO11** | ILI9341 240×320 SPI |
| TFT CS / DC / RESET | **GPIO10 / GPIO13 / GPIO14** | 片选 / 命令数据 / 复位 |
| TFT LED(背光) | **GPIO21** | HIGH 点亮；不调光可直接接 3V3 |
| 土壤湿度 AO | **GPIO1** | ADC1, 电容式模块输出 |
| pH 模块 Po | **GPIO2** | ADC1, ⚠ 必须分压 5V→3.3V |
| I2S BCLK / LRC / DIN | **GPIO17 / GPIO18 / GPIO16** | MAX98357A 数字功放（原 LU6288 已弃用） |
| BOOT 按钮 | **GPIO0** | 长按 5 秒清凭证 + 重启 |
| 内置 RGB 灯 | **GPIO48** | WS2812 状态灯（绿心跳/黄慢闪/红快闪） |

> TFT 屏 **VCC→3V3、GND→GND**；SDO(MISO) 与触摸 `T_*`（XPT2046）暂不接、不驱动。彩色 UI 用 `TFT_eSPI` 绘图，中文用 `U8g2_for_TFT_eSPI`（复用 wqy GB2312 字体）。
>
> **MAX98357A（I2S 功放）**：`BCLK→17  LRC→18  DIN→16`；`VIN→5V`（4-8Ω 3W 喇叭大音量必须 5V，否则削顶/欠压重启）；`GND` 共地；`SD→3V3`（常开）；`GAIN` 悬空(9dB)；喇叭 `⊕/⊖` 接喇叭，**⊖ 绝不接地**（BTL 差分）。⚠ 功放/喇叭线远离 **GPIO0(BOOT)**，避免干扰误触发。

### 3. 编译 & 上传

```bash
~/.platformio/penv/Scripts/pio.exe run -t upload -t monitor
```

或 VS Code 状态栏：**Build → Upload → Serial Monitor**。

### 4. 配网

首次开机或长按 BOOT 5 秒后，设备进入配网模式：

1. 手机/电脑连接 SoftAP **`植物管家-配网`**（开放，无密码）
2. 系统通常自动弹出配网页面；否则浏览器访问 `http://192.168.4.1`
3. 选择 WiFi → 输入密码 → 填写 **后端 API 根地址**（如 `http://192.168.1.10:3000`，**不要**带 `/internal/...` 路径）→ **用户 ID**、**上报密钥**（与服务器 `SENSOR_HMAC_SECRET` 相同，≥16 字符）→ 可选 **植物 ID** → **保存并连接**
4. 屏幕右上角 WiFi 图标常亮即表示连接成功；带斜杠表示未连接

配网凭证保存在 NVS 命名空间 `plantguard`（键：`ssid` / `pass` / `apiBase` / `bindCode` / `userId` / `sensorKey` / `plantId`）。`bindCode` 用于一次性 claim；成功后固件会写入 `userId` 并清除 `bindCode`。

### 云端上报（greenAI）

当 `apiBase`、`bindCode`（小程序生成的绑定码）已写入 NVS 且 STA 联网、NTP 有效时，固件会先 `POST {apiBase}/devices/claim-binding-code` 换取 `userId`（及可选 `sensorKey`），再按间隔上报传感器读数。连接后 **SNTP 校时**，再对 JSON 原文做 **SHA256 + HMAC-SHA256**，请求 `POST {apiBase}/internal/sensors/ingest` 与 `POST {apiBase}/internal/sensors/logs`（含上电 `device_boot`、上报失败等日志）。协议见 [docs/engineering/miniprogram-third-party-sensors.md](../docs/engineering/miniprogram-third-party-sensors.md) §6。

## Stage 开关

[src/config.h](src/config.h) 顶部按需开关功能：

```c
#define STAGE_SERIAL       1   // 串口 CSV 输出
#define STAGE_OLED         1   // TFT(ILI9341) 中文显示（沿用此开关名）
#define STAGE_TTS          1   // 语音播报（服务端 edge-tts → I2S）
#define STAGE_PH           1   // pH 读取
#define STAGE_WIFI_PROV    1   // SoftAP 配网
#define STAGE_WIFI_UPLOAD  1   // 上报后端
```

建议**逐个打开**验证，不要一次全开。

## 重要提醒

### ⚡ pH 分压（必须）

pH4502C 等模块为 **5V 供电，0~5V 模拟输出**，ESP32-S3 ADC 最大 **3.3V**。两种接法二选一：

1. **3.3V 直供**（推荐，最简单）：模块 VCC 接 ESP32-S3 的 3V3，Po 直接进 GPIO2。`config.h` 中保持 `PH_USE_VOLTAGE_DIVIDER_3 = 0`。
2. **5V 供电 + 1/3 分压**：Po → 10kΩ → GPIO2，同节点再串 20kΩ 到 GND。`config.h` 中置 `PH_USE_VOLTAGE_DIVIDER_3 = 1`（读数会乘 3 还原原始电压）。

```
pH模块 Po ──┬─ 10kΩ ──┬─ GPIO2
            │         │
           GND      20kΩ
                     │
                    GND
```

pH 算法在 [src/ph_sensor.cpp](src/ph_sensor.cpp)：10 次 `analogRead` → 排序 → 去掉最高/最低各 2 点 → 中间 6 点平均 → `pH = PH_SLOPE * V + PH_OFFSET`。校准只需改 [src/config.h](src/config.h) 中的 `PH_SLOPE` / `PH_OFFSET`。

### 中文字体

彩色文字用 `U8g2_for_TFT_eSPI` 渲染 U8g2 字体：数据面板 `u8g2_font_wqy16_t_gb2312`（16px），小字 `u8g2_font_wqy12_t_gb2312a`。无需 `enableUTF8Print()`，直接 `u8f.drawUTF8(x, y_baseline, "中文")`。

### 显示驱动（ILI9341 彩色）

屏幕走 4 线 SPI，使用 **TFT_eSPI** 做彩色绘图（圆/椭圆/三角/进度条/动画），文字叠加用 **U8g2_for_TFT_eSPI** 取得中文字形与颜色。SPI 引脚、驱动型号在 `platformio.ini` 的 `build_flags` 里配置（`-DILI9341_DRIVER`、`-DTFT_MOSI=11`、`-DTFT_SCLK=12`、`-DTFT_CS=10`、`-DTFT_DC=13`、`-DTFT_RST=14` 等）；背光 `PIN_TFT_BL`(GPIO21) 在 `displayInit()` 拉高。数据面板用「模式判断 + 实底字体覆盖」避免每秒全屏刷新闪烁。

### 语音播报（服务端 edge-tts + I2S，已替换 LU6288）

合成放到**服务端**，设备只负责**联网拉音频 + 解码播放**，音质好、文案可动态：

- **后端**：`POST /internal/tts`（HMAC 同 `/internal/sensors/ingest`），入参 `{ hardwareId, text }`，返回 **24kHz 单声道 MP3**。实现 `backend/src/services/edgeTts.ts` 通过子进程调用官方维护的 **edge-tts (Python)**——
  ```bash
  pip install edge-tts          # 服务器/开发机都要装
  ```
  命令名可用环境变量 `EDGE_TTS_BIN` 覆盖（如 `EDGE_TTS_BIN="python -m edge_tts"`）。
- **固件**：`tts.cpp` 用 `greenaiFetchTts()` 拉 MP3 进内存，`ESP8266Audio`（`AudioGeneratorMP3` + `AudioOutputI2S`）解码经 I2S 推 MAX98357A。`ttsSpeak()` 为阻塞式（播报偶发，可接受）。
  - 库锁定 `earlephilhower/ESP8266Audio@1.9.7`（新版需 Arduino core 3.x 的 `i2s_std.h`，本工程 core 2.0.x 用旧 I2S）。
  - 音量在 `tts.cpp` 的 `out.SetGain(0.5f)`（破音就降到 0.3）。
- **触发点**：联网后温度稳定时**环境播报一次**；检测到**浇水**时播报回馈句（文案可由小程序经 `/internal/devices/config` 下发）。

### 开机离线提示音（未配网也能响）

开机时还没联网，服务端 TTS 用不了，故用**烧进 flash 的 MP3** 离线播放（`ttsPlayBootClip()`）：

```bash
cd backend
npm run gen:boot-sound -- "植物管家已启动"     # 用 edge-tts 合成并写 firmware/src/boot_sound.h
# 若 edge-tts 不在 PATH：EDGE_TTS_BIN="python -m edge_tts" npm run gen:boot-sound -- "植物管家已启动"
```

未生成时 `boot_sound.h` 为占位（`HAS_BOOT_SOUND 0`），开机不出声但可正常编译。

### 双 I²C 总线

SHT30 与 BH1750 默认地址段会冲突；本工程让 BH1750 独占 `Wire1`，SHT30 用 `Wire`。⚠ 旧 OLED 移除后，`Wire`(GPIO5/4) 失去原 OLED 模块自带的 4.7kΩ 上拉，**需在 SDA/SCL 各补一颗 4.7kΩ 上拉到 3V3**，否则 SHT30 可能读不到。

## BOOT 长按复位

正常运行时**按住 BOOT 键 5 秒**：
- RGB 灯红色快闪作为反馈
- 触发后清空 NVS 中保存的 SSID / 密码 / API 与上报相关字段
- 自动重启进入配网模式

短按或不足 5 秒释放不会触发。**安全防护**：BOOT(GPIO0) 必须**先检测到松开(高)才武装**——若上电时 GPIO0 已被拉低（接线/功放干扰），不会误判为长按而清凭证死循环（见排障）。

## 排障

| 现象 | 原因 |
|------|------|
| 串口无输出 | COM 口选错；波特率不是 115200；USB CDC 还在重连 |
| I²C 扫不到设备 | SDA/SCL 接反；没共地；上拉电阻缺失 |
| 屏幕中文乱码 / 方块 | 字库没编译进去（检查 `U8G2_USE_ALL_FONTS`） |
| 屏幕全黑 / 不亮 | 背光 LED 未接 GPIO21 或 3V3；CS/DC/RESET 接错；SPI 引脚顺序不符 |
| 屏幕花屏 | SPI 线过长；SCK/MOSI 接反；电源不稳 |
| SHT30 读不到 | `Wire`(GPIO5/4) 缺 4.7kΩ 上拉（旧 OLED 移除后需自补） |
| 配网页打不开 | 浏览器没走 captive portal；手动访问 `192.168.4.1` |
| `request handler not found` 日志 | 无害，captive portal 探测路径，已 fallback 到主页 |
| `Connection reset by peer` | 无害，手机端切页/息屏导致 |
| pH 读数跳变 | 分压电阻没接；探头未校准；探头空气中浮动正常 |
| 土壤湿度不准 | 标定值（`SOIL_ADC_DRY` / `SOIL_ADC_WET`）需按探头在 3.3V 下实测调整 |
| pH 不准 | 确认 3.3V 直供或分压开关 `PH_USE_VOLTAGE_DIVIDER_3` 与 pH4/7 缓冲液，再改 `PH_SLOPE` / `PH_OFFSET` |
| pH 始终 14 或 0 | GPIO2 浮空 / 没共地 / 5V 直进未分压（ADC 饱和）|
| 移动后面板不停重启 | 串口看 `[RESET]`：`brownout`→USB/5V/GND 接触不良；`sw`→勿碰 BOOT(GPIO0) |
| 播放破音 | `SetGain` 太大（降到 0.3）；功放 VIN 没接 5V（4-8Ω 喇叭必须 5V）；GAIN 脚别接高；电源加 220-470µF 电容 |
| 一直重启且打印清 ssid/pass/... 的 NOT_FOUND | BOOT 长按被误触发（GPIO0 被拉低）：功放/喇叭线远离 GPIO0；查 SD/GAIN 别误接 0；已加「松开才武装」防护 |
| 联网了却没声音 | 设备未绑定(`sensorKey`)/`apiBase` 未填；服务器没装 `edge-tts` 或无外网；串口看 `[TTS]` 行 |
| 开机没声音 | 没生成开机音（`boot clip not embedded`）→ 在 backend 跑 `npm run gen:boot-sound` 后重新烧录 |
| 编译报 `driver/i2s_std.h not found` | ESP8266Audio 版本过新，需锁 `@1.9.7`（本工程 Arduino core 2.0.x 用旧 I2S）|
