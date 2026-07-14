# GreenAI Bot · uni-app

基于 **Vue 3 + Vite + uni-app** 的跨端前端工程，支持 H5 / App / 各端小程序。与仓库内 **Fastify 后端** 共用同一套 REST API。

## 环境

- Node.js **≥ 18**
- 依赖与官方 `dcloudio/uni-preset-vue`（vite-ts）对齐；锁版本见 `package.json`。

## 安装与运行

```bash
cd uniapp
npm install
npm run dev:h5
```

- **微信小程序**：`npm run dev:mp-weixin`（需在 `src/manifest.json` → `mp-weixin` 填写真实 `appid`）。
- **鸿蒙小程序**：`npm run dev:mp-harmony`（需本机已按 DCloud 文档配置对应工具链）。
- **App 资源包**：`npm run dev:app-android` / `npm run build:app-android`（真机 APK/AAB 通常还需 HBuilderX 云打包或离线壳工程）。

## 配置 API

`src/utils/config.ts` 提供平台默认值：
- **H5**：使用当前网页同源地址，开发时由 Vite 代理到本机 `3000` 端口
- **非 Web 平台**：回退 `http://127.0.0.1:3000`

用户可在「我 → 连接设置 → 后端 API 地址」填写局域网或远程服务地址，并测试连接。地址持久化在本地 storage，切换后会清除旧服务器的 JWT 并自动重新登录。

JWT 通过 `uni.setStorageSync('greenai_token', …)` 持久化（key 见 `config.ts`）。

## Tab 图标

`npm install` 后于仓库根目录执行一次：

```bash
node scripts/write-uniapp-tab-placeholders.mjs
```

会生成 `src/static/tab/*.png` 占位图；发布前请替换为设计稿切图。

## 关键功能说明

### 图片处理（`src/utils/image.ts`）

`chooseImageBase64()` 流程：
1. `uni.chooseImage` 选择/拍照
2. App/小程序端：`uni.compressImage` 压缩（quality: 90），H5 端跳过（`typeof uni.compressImage` 守卫）
3. `fetch` → `blob` → `FileReader.readAsDataURL` → 提取 base64

### 植物识别（首页 `onIdentify`）

1. 选图 → 压缩 → base64 → `POST /plants/identify { imageBase64 }`
2. 后端转发百度 AI 植物识别 API
3. 成功后结果写入 `uni.setStorageSync('identifyResult', …)`，页面 `onShow` 时恢复
4. 可关闭结果卡片（`removeStorageSync`）

### 土壤评估（首页 `onSoil`）

1. 选图 → 压缩 → base64 → `POST /soil/estimate-photo { imageBase64 }`
2. 后端用 LLM（DashScope Qwen-VL）分析盆土
3. 展示干湿度/肥力/置信度/养护建议
4. 结果同植物识别一样持久化到 storage

### 病虫害诊断（`pages/diagnose/diagnose`）

跳转诊断页，支持拍照 + 勾选症状 + 文字补充 → LLM 诊断。

## 与原生小程序的关系

- **uni-app 为主前端**，原生小程序（`miniprogram/`）已不再维护。
- 若需微信小程序版本，用 `build:mp-weixin` 产出目录导入微信开发者工具。

## 后端要点

- Fastify `bodyLimit: 20MB`（base64 图片可能超过默认 1MB）
- 百度 AI 植物识别需配置 `BAIDU_API_KEY + BAIDU_SECRET_KEY`
- 土壤/诊断 LLM 默认 DashScope `qwen3-vl-plus-2025-09-23`（已在 `.env` 中排除 `response_format: json_object`）
- 本地开发 `DATABASE_URL` 需用 `localhost` 而非 `db`
