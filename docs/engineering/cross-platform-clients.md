# 跨端客户端（H5 · App · 微信 · 鸿蒙）

设计稿 **GreenAI Bot**（首页 / 养护 / 知识 / 我 + 白底绿叶色）在仓库中的落地：

- **uni-app 跨端工程**（`uniapp/`）：Vue 3 + Vite + 官方 `@dcloudio` 依赖；支持 **H5、App（Android/iOS 资源包）、微信小程序、鸿蒙小程序（mp-harmony）** 等目标。**此为当前主推客户端。**
- **微信原生小程序**（`miniprogram/`）：⛔ **不再维护**，旧代码保留作参考。

详见 [`uniapp/README.md`](../../uniapp/README.md)。
## 接口与鉴权（各端共用）

- **Base URL**：uni-app 自动取 `window.location.hostname:3000`（见 `src/utils/config.ts`），部署后改为 HTTPS 生产域名。
- **鉴权**：JWT（`Authorization: Bearer …`），登录流程在小程序侧为 `wx.login` + 后端换 token；App 侧需单独实现微信开放平台移动应用登录，或手机号/邮箱等（产品决策）。

## 方案对比（手机 + 鸿蒙）

| 方案 | Android / iOS | 微信小程序 | 鸿蒙 NEXT | 说明 |
|------|----------------|------------|------------|------|
| **uni-app（Vue）** | 发行到 App-plus / 新运行时 | 良好支持 | 官方在推 uni-app x / Ark 适配，需跟进版本文档 | 一套 Vue 语法多端，国内生态与中文文档友好；与设计稿 WXML 不共享，需重写模板。 |
| **Taro + React** | 可接 React Native 或 Taro 鸿蒙实验通道 | 官方支持 | 视 Taro/DCloud 版本 | 适合团队以 React 为主。 |
| **Flutter** | 极佳 | 无官方小程序同构；小程序仍保留原生 | 鸿蒙侧有社区/官方进展，需评估版本 | UI 自绘与 **Material 绿** 一致性好；与现有小程序 **零模板复用**，可共享 OpenAPI 文档与部分业务常量。 |

**当前选型**：已采用 **uni-app**（`uniapp/`）。若后续极重图形性能或需完全脱离 DCloud 工具链，可再评估 **Flutter** 独立 App 与小程序双轨。

## uni-app 已实现

- Tab：**首页 · 养护 · 知识 · 我**；工具类从首页「常用工具」三宫格进入。
- 全局色：白底 + 主色 `#43A047`。
- 首页：天气大卡、待办浇水/施肥统计、植物横滑、三宫格工具、今日任务卡片。
- **植物识别**（`onIdentify`）：拍照 → `uni.compressImage`（非 H5）→ `fetch` 读取 base64 → `POST /plants/identify` → 结果通过 `uni.setStorageSync` 持久化，适配页面被回收后恢复。
- **土壤评估**（`onSoil`）：拍照 → LLM `POST /soil/estimate-photo` → 展示干湿度/肥力/置信度/养护建议，结果也持久化。
- **病虫害诊断**（`onDiagnose`）：跳转 `pages/diagnose/diagnose`，可勾选症状 + 补充文字 + 拍照 → LLM 诊断。
- 详细错误处理：413/422/400/401/502/503/网络故障各有中文提示。

## 下一步（uni-app）

1. 替换 `src/static/tab/` 占位图标为设计稿切图。
2. **鸿蒙**：使用 `dev:mp-harmony` / `build:mp-harmony`；**HarmonyOS NEXT** 策略以 [uni 官方鸿蒙文档](https://uniapp.dcloud.net.cn/) 为准。
3. **App 上架**：配置 `manifest.json` 应用名、包名、图标；Android/iOS 真机包按 DCloud 云打包或离线集成流程。
