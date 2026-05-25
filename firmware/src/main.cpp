/**
 * @file main.cpp
 * @brief PlantGuardian 硬件 Demo — 双总线
 *
 * 关键：SHT30 与 OLED 共用 HW I²C (Wire, GPIO5/4)，
 * 借用 OLED 模块板载上拉电阻 解决 SHT30 单独使用时
 * 内部 45kΩ 弱上拉读不稳的问题（测试程序证明此布线工作）。
 *
 * 总线分配:
 *   Wire  (I²C0, GPIO5 SDA / GPIO4 SCL): SHT30 + OLED (SSD1306)
 *   Wire1 (I²C1, GPIO6 SDA / GPIO7 SCL): BH1750
 */

#include <Arduino.h>
#include <Wire.h>

// ============================================================
//  Stage Toggles
// ============================================================
#define STAGE_SERIAL     1
#define STAGE_OLED       1
#define STAGE_TTS        0
#define STAGE_PH         1

#define TTS_MODEL_SYN6288   0
#define TTS_MODEL_XFS5152   1
#define TTS_MODEL           TTS_MODEL_SYN6288

// ============================================================
//  Pin Definitions
// ============================================================
//  Wire (I²C0): SHT30 + OLED 共用
#define PIN_SHT_SDA        5
#define PIN_SHT_SCL        4

//  Wire1 (I²C1): BH1750
#define PIN_LIGHT_SDA      6
#define PIN_LIGHT_SCL      7

//  模拟输入
#define PIN_SOIL_MOISTURE  1
#define PIN_PH             2

//  TTS UART1
#define PIN_TTS_RX         18
#define PIN_TTS_TX         17

//  板载 LED
#define PIN_LED_BUILTIN    48

const int SOIL_DRY_MAX   = 1200;
const int SOIL_WET_MIN   = 2800;

// ============================================================
//  OLED (HW I²C，与 SHT30 共线)
// ============================================================
#if STAGE_OLED
#  include <U8g2lib.h>
   U8G2_SSD1306_128X64_NONAME_F_HW_I2C u8g2(U8G2_R0, /*reset=*/U8X8_PIN_NONE);
#endif

#if STAGE_PH
   const float PH_VOLTAGE_DIVISOR = 3.0;
   float PH_SLOPE  = 3.0;
   float PH_OFFSET = 0.0;
#endif

// ============================================================
//  TTS
// ============================================================
#if STAGE_TTS
#  include <HardwareSerial.h>
   HardwareSerial TTS_Serial(1);

   void ttsSpeak(const char* text) {
       size_t dataLen = strlen(text);
       size_t frameLen = 1 + dataLen;
       uint8_t xor_check = 0;
       TTS_Serial.write(0xFD);  xor_check ^= 0xFD;
       TTS_Serial.write((uint8_t)(frameLen >> 8));
       TTS_Serial.write((uint8_t)(frameLen & 0xFF));
       xor_check ^= (uint8_t)(frameLen >> 8);
       xor_check ^= (uint8_t)(frameLen & 0xFF);
       TTS_Serial.write(0x01);  xor_check ^= 0x01;
       for (size_t i = 0; i < dataLen; i++) {
           uint8_t c = (uint8_t)text[i];
           TTS_Serial.write(c);
           xor_check ^= c;
       }
#if TTS_MODEL == TTS_MODEL_SYN6288
       TTS_Serial.write(xor_check);
#endif
       TTS_Serial.flush();
   }
#endif

// ============================================================
//  BH1750 (Wire1)
// ============================================================
#include <BH1750.h>
BH1750 lightMeter(0x23);

bool bh1750Init() {
    if (lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE, 0x23, &Wire1)) return true;
    if (lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE, 0x5C, &Wire1)) return true;
    return false;
}

// ============================================================
//  SHT30 (Wire) — 完全照搬测试程序工作版本
// ============================================================
#include <DFRobot_SHT3x.h>
DFRobot_SHT3x sht3x(&Wire, /*addr=*/0x44);

bool sht3xInit() {
    int tries = 0;
    while (sht3x.begin() != 0) {
        if (++tries >= 5) {
            Serial.println("[SHT30] begin() FAIL after 5 tries");
            return false;
        }
        Serial.println("SHT30 初始化失败，请检查接线！");
        delay(1000);
    }
    Serial.println("SHT30 初始化成功");
    Serial.print("SHT30 序列号: ");
    Serial.println(sht3x.readSerialNumber());
    if (!sht3x.softReset()) {
        Serial.println("SHT30 软件复位失败");
    }
    delay(100);
    return true;
}

// ============================================================
//  传感器数据结构
// ============================================================
struct SensorData {
    float temperature = NAN;
    float humidity    = NAN;
    float lux         = NAN;
    int   soilRaw     = 0;
    int   soilPercent = 0;
    float pH          = NAN;
    bool  sensorOK[4] = {false, false, false, false}; // SHT/BH/Soil/pH
};

bool g_sht3xAvailable  = false;
bool g_bh1750Available = false;

SensorData readAllSensors() {
    SensorData d;

    if (g_sht3xAvailable) {
        float t = sht3x.getTemperatureC();
        float h = sht3x.getHumidityRH();
        if (!isnan(t) && !isnan(h)) {
            d.temperature = t;
            d.humidity    = h;
            d.sensorOK[0] = true;
        }
    }

    if (g_bh1750Available) {
        float lux = lightMeter.readLightLevel();
        if (lux >= 0 && !isnan(lux)) {
            d.lux = lux;
            d.sensorOK[1] = true;
        }
    }

    d.soilRaw = analogRead(PIN_SOIL_MOISTURE);
    d.sensorOK[2] = true;
    if (d.soilRaw <= SOIL_DRY_MAX) {
        d.soilPercent = 0;
    } else if (d.soilRaw >= SOIL_WET_MIN) {
        d.soilPercent = 99;
    } else {
        d.soilPercent = map(d.soilRaw, SOIL_DRY_MAX, SOIL_WET_MIN, 0, 99);
        d.soilPercent = constrain(d.soilPercent, 0, 99);
    }

#if STAGE_PH
    int phRaw = analogRead(PIN_PH);
    if (phRaw > 0) {
        float voltage = phRaw * (3.3f / 4095.0f) * PH_VOLTAGE_DIVISOR;
        d.pH = PH_SLOPE * voltage + PH_OFFSET;
        d.pH = constrain(d.pH, 0.0f, 14.0f);
        d.sensorOK[3] = true;
    }
#endif

    return d;
}

// ============================================================
//  OLED 显示
// ============================================================
#if STAGE_OLED
void displayUpdate(const SensorData& d) {
    char buf[32];
    u8g2.setPowerSave(0);
    u8g2.setFont(u8g2_font_6x10_tf);
    u8g2.clearBuffer();

    if (d.sensorOK[0]) snprintf(buf, sizeof(buf), "T:%.1f C", d.temperature);
    else               snprintf(buf, sizeof(buf), "T:-- C");
    u8g2.drawUTF8(0, 14, buf);

    if (d.sensorOK[0]) snprintf(buf, sizeof(buf), "H:%.0f%%", d.humidity);
    else               snprintf(buf, sizeof(buf), "H:--%%");
    u8g2.drawUTF8(0, 29, buf);

    if (d.sensorOK[1]) snprintf(buf, sizeof(buf), "L:%.0f lx", d.lux);
    else               snprintf(buf, sizeof(buf), "L:-- lx");
    u8g2.drawUTF8(0, 44, buf);

    if (d.sensorOK[2]) {
#if STAGE_PH
        if (d.sensorOK[3]) snprintf(buf, sizeof(buf), "Soil:%d pH:%.1f", d.soilPercent, d.pH);
        else               snprintf(buf, sizeof(buf), "Soil:%d pH:--", d.soilPercent);
#else
        snprintf(buf, sizeof(buf), "Soil:%d", d.soilPercent);
#endif
    } else {
        snprintf(buf, sizeof(buf), "Soil:--");
    }
    u8g2.drawUTF8(0, 59, buf);

    u8g2.sendBuffer();
}
#endif

// ============================================================
//  TTS 播报
// ============================================================
#if STAGE_TTS
unsigned long lastTTSMillis = 0;
const unsigned long TTS_INTERVAL_MS = 60000;

void ttsLoop(const SensorData& d) {
    unsigned long now = millis();
    if (now - lastTTSMillis < TTS_INTERVAL_MS && lastTTSMillis != 0) return;
    lastTTSMillis = now;

    char numBuf[16];
    char fullText[128] = {0};
    strcat(fullText, "当前环境");
    if (d.sensorOK[0]) {
        dtostrf(d.temperature, 1, 1, numBuf);
        strcat(fullText, "温度");  strcat(fullText, numBuf);  strcat(fullText, "摄氏度");
        dtostrf(d.humidity, 1, 0, numBuf);
        strcat(fullText, "湿度");  strcat(fullText, numBuf);  strcat(fullText, "百分之");
    }
    if (d.sensorOK[2]) {
        snprintf(numBuf, sizeof(numBuf), "%d", d.soilPercent);
        strcat(fullText, "盆土湿度");  strcat(fullText, numBuf);
    }
#if STAGE_PH
    if (d.sensorOK[3]) {
        dtostrf(d.pH, 1, 1, numBuf);
        strcat(fullText, "酸碱度");  strcat(fullText, numBuf);
    }
#endif
    ttsSpeak(fullText);
}
#endif

// ============================================================
//  Serial CSV
// ============================================================
#if STAGE_SERIAL
void serialPrint(const SensorData& d) {
    Serial.printf("T=%.1f,H=%.0f%%,Lux=%.0f,Soil=%d(%d%%),",
                  d.temperature, d.humidity, d.lux, d.soilRaw, d.soilPercent);
#if STAGE_PH
    if (d.sensorOK[3]) Serial.printf("pH=%.1f", d.pH);
    else               Serial.print("pH=--");
#endif
    Serial.println();
}
#endif

// ============================================================
//  I²C 总线恢复：用 9 个 SCL 脉冲解锁被 slave 钉死 SDA 的情况
//  (SHT3x clock-stretch 超时后会卡住 SDA 低电平直到下个 STOP)
// ============================================================
static void i2cBusRecover(int sdaPin, int sclPin) {
    pinMode(sdaPin, INPUT_PULLUP);
    pinMode(sclPin, OUTPUT);
    delayMicroseconds(10);
    if (digitalRead(sdaPin) == HIGH) {
        // SDA 没被钉死，无需恢复
        return;
    }
    Serial.printf("[I2C] SDA(GPIO%d) stuck LOW, recovering...\n", sdaPin);
    for (int i = 0; i < 9; i++) {
        digitalWrite(sclPin, LOW);
        delayMicroseconds(5);
        digitalWrite(sclPin, HIGH);
        delayMicroseconds(5);
        if (digitalRead(sdaPin) == HIGH) {
            Serial.printf("[I2C] released after %d clocks\n", i + 1);
            break;
        }
    }
    // 发一个 STOP: SDA 低->高 while SCL 高
    pinMode(sdaPin, OUTPUT);
    digitalWrite(sdaPin, LOW);
    delayMicroseconds(5);
    digitalWrite(sclPin, HIGH);
    delayMicroseconds(5);
    digitalWrite(sdaPin, HIGH);
    delayMicroseconds(5);
    // 释放回输入态供 Wire 接管
    pinMode(sdaPin, INPUT);
    pinMode(sclPin, INPUT);
}

// ============================================================
//  Setup
// ============================================================
void setup() {
    Serial.begin(115200);
    delay(1000);
    Serial.println("\n==============================================");
    Serial.println(" PlantGuardian — Dual-bus (Wire shared SHT30+OLED)");
    Serial.println("==============================================");

    pinMode(PIN_LED_BUILTIN, OUTPUT);
    digitalWrite(PIN_LED_BUILTIN, LOW);

    // --- 先解锁可能卡死的 I²C 从机 ---
    i2cBusRecover(PIN_SHT_SDA,  PIN_SHT_SCL);
    i2cBusRecover(PIN_LIGHT_SDA, PIN_LIGHT_SCL);

    // --- Wire: SHT30 + OLED 共用 ---
    Wire.begin(PIN_SHT_SDA, PIN_SHT_SCL);
    Serial.printf("[Wire ] SDA=GPIO%d SCL=GPIO%d (SHT30 + OLED)\n", PIN_SHT_SDA, PIN_SHT_SCL);

    // --- Wire1: BH1750 ---
    Wire1.begin(PIN_LIGHT_SDA, PIN_LIGHT_SCL);
    Serial.printf("[Wire1] SDA=GPIO%d SCL=GPIO%d (BH1750)\n", PIN_LIGHT_SDA, PIN_LIGHT_SCL);
    delay(50);

    // --- OLED 先 init (用其板载上拉电阻稳定 Wire 总线) ---
#if STAGE_OLED
    if (u8g2.begin()) {
        Serial.println("[OLED] init OK");
        u8g2.setPowerSave(0);
        u8g2.setContrast(255);
        u8g2.setFont(u8g2_font_6x10_tf);
        u8g2.clearBuffer();
        u8g2.drawStr(5, 20, "PlantGuardian");
        u8g2.drawStr(5, 40, "Booting...");
        u8g2.sendBuffer();
    } else {
        Serial.println("[OLED] FAIL");
    }
#endif

    // --- SHT30 ---
    g_sht3xAvailable = sht3xInit();

    // --- BH1750 ---
    if (bh1750Init()) {
        Serial.println("[BH1750] OK");
        g_bh1750Available = true;
    } else {
        Serial.println("[BH1750] FAIL");
    }

    analogReadResolution(12);
    Serial.printf("[ADC] Soil=GPIO%d, pH=GPIO%d\n", PIN_SOIL_MOISTURE, PIN_PH);

#if STAGE_TTS
    TTS_Serial.begin(9600, SERIAL_8N1, PIN_TTS_RX, PIN_TTS_TX);
    Serial.printf("[TTS] UART1 RX=GPIO%d TX=GPIO%d @9600\n", PIN_TTS_RX, PIN_TTS_TX);
#endif

    Serial.println("--- Setup complete ---");
    Serial.printf("[STATUS] SHT30=%s  BH1750=%s\n",
                  g_sht3xAvailable  ? "OK" : "FAIL",
                  g_bh1750Available ? "OK" : "FAIL");
    Serial.println();
}

// ============================================================
//  Loop
// ============================================================
unsigned long lastSensorMillis = 0;
const unsigned long SENSOR_INTERVAL_MS = 2000;
SensorData lastData;

void loop() {
    unsigned long now = millis();
    if (now - lastSensorMillis >= SENSOR_INTERVAL_MS || lastSensorMillis == 0) {
        lastSensorMillis = now;
        lastData = readAllSensors();
#if STAGE_SERIAL
        serialPrint(lastData);
#endif
#if STAGE_TTS
        ttsLoop(lastData);
#endif
    }
#if STAGE_OLED
    displayUpdate(lastData);
#endif
    delay(500);
}
