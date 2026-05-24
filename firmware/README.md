# 硬件 Demo 固件 — PlatformIO 工程

针对 **ESP32-S3-N16R8** 的面包板模块化固件，分阶段走通传感器 → 显示 → 声音 → pH。

## 目录结构

```
firmware/
├── platformio.ini        # 板型 / 库 / 编译选项
├── src/
│   └── main.cpp          # 主固件 (所有 Stage 合并在一个文件)
└── README.md             # 本文件
```

## 快速开始

### 1. 安装 PlatformIO

- VS Code → 扩展 → 搜索 **PlatformIO IDE** → 安装
- 或独立安装: https://platformio.org/

### 2. 接线

对照 **[FAST-DEMO-breadboard-layout.svg](../FAST-DEMO-breadboard-layout.svg)** 的面包板布线图。

核心引脚 (代码 `src/main.cpp` 顶部 `Pin Definitions`):

| 信号 | ESP32-S3 引脚 | 模块 |
|------|--------------|------|
| I²C SDA | **GPIO8** | OLED / SHT40 / BH1750 共用 |
| I²C SCL | **GPIO9** | OLED / SHT40 / BH1750 共用 |
| 土壤湿度 AO | **GPIO1** | ADC1_CH0, 电容式模块输出 |
| pH 模块 Po | **GPIO2** | ADC1_CH1, ⚠ 必须分压 (5V→3.3V) |
| TTS TX → ESP RX | **GPIO18** | UART1 RX |
| TTS RX ← ESP TX | **GPIO17** | UART1 TX |
| 内置 LED | **GPIO48** | 心跳指示 |

### 3. 打开工程

```bash
# VS Code: File → Open Folder → 选择 firmware/
# PlatformIO 自动识别 platformio.ini
```

### 4. 编译 & 上传

- 底部蓝色栏 → **→ (Build)** → **→ (Upload)** → **🔍 (Serial Monitor)**
- 或快捷键: `Ctrl+Alt+B` 编译, `Ctrl+Alt+U` 上传

### 5. 分步验收

固件通过 **Stage Toggle** 控制功能开启，按以下顺序逐步验证：

| 阶段 | 需要开的宏 | 验收标准 |
|------|-----------|---------|
| **Step 5** | `STAGE_SERIAL=1` 其余=0 | 串口监视器看到 `T=..,H=..,Lux=..,Soil=..` CSV 行 |
| **Step 6** | 加 `STAGE_OLED=1` | OLED 显示中文四行 (温度/湿度/光照/盆土) |
| **Step 6b** | 再加 `STAGE_TTS=1` | 喇叭每 60 秒播报中文读数 |
| **Step 7** | 再加 `STAGE_PH=1` | 屏上显示 `pH x.x`, 串口输出 pH 值 |

> **每完成一个阶段再开下一个** — 不要一次性全开，否则排障困难。

## 重要提醒

### ⚡ pH 分压 (必须)

pH4502C 等模块通常 **5V 供电, 0~5V 模拟输出**。 ESP32-S3 ADC 最大输入 **3.3V**。

**必须**在 Po → GPIO2 之间加分压电阻 (如 10kΩ + 20kΩ, 分压比 1/3):

```
pH模块 Po ──┬─ 10kΩ ──┬─ GPIO2 (ADC)
            │         │
           GND      20kΩ
                     │
                    GND
```

分压后在代码中设 `PH_VOLTAGE_DIVISOR = 3.0`。

### 中文字体

U8g2 的 `wqy12_t_gb2312a` 字体约 70KB, 编译较慢但一次搞定。  
如果显示乱码: 在 `platformio.ini` 中 `build_flags` 已含 `-DU8G2_USE_ALL_FONTS`。

### TTS 模块协议

代码内置 **SYN6288** 和 **XFS5152** 两种帧格式, 通过 `TTS_MODEL` 宏切换 (`src/main.cpp` 顶部)。  
收到模块后 **先核对卖家手册的通信协议**, 必要时调整 `ttsSpeak()` 函数中的帧结构。

## 排障

| 现象 | 原因 |
|------|------|
| 串口无输出 | COM 口选错; 波特率不是 115200; 板子没启动 |
| I²C 扫不到设备 | SDA/SCL 接反; 没共地; 模块电压不匹配 |
| OLED 显示方块/乱码 | 字库没编译进去; 检查 `U8G2_USE_ALL_FONTS` |
| TTS 无声或乱码 | TX/RX 接反; 波特率不对; 编码不是 GB2312 |
| pH 读数跳变 | 分压电阻没接; 电极未校准; 屏蔽不好 |
| 编译报错 OOM | S3 16MB Flash + 8MB PSRAM, 检查 `platformio.ini` 分区表 |
| TF 卡相关 | 本工程未用 TF 卡 (TTS 使用串口直连) |
