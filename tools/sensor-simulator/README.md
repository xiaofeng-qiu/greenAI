# GreenAI Sensor Simulator

独立的本地开发控制台，用于管理模拟植物与传感器，并向后端写入传感器读数。

## 启动

1. 启动 PostgreSQL 与后端，并设置 `ENABLE_DEV_SENSOR_SIMULATOR=1`。
2. 在仓库根目录运行：

```bash
npm install --prefix tools/sensor-simulator
npm run dev:sensor-simulator
```

3. 打开 `http://localhost:5174`。

开发服务器将 `/dev/*` 代理到 `http://127.0.0.1:3000`。该控制台不提供生产鉴权，
不得在启用开发接口的情况下部署到公网。
