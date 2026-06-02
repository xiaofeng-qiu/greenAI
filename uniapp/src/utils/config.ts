/** API 根地址。浏览器下自动取当前 hostname + 3000 端口，不依赖 Vite 代理。 */
function detectApiBase(): string {
  if (typeof window !== "undefined" && window.location) {
    const loc = window.location;
    return `${loc.protocol}//${loc.hostname}:3000`;
  }
  // uni-app 非 web 平台（小程序等）回退
  return "http://127.0.0.1:3000";
}

export const API_BASE_URL = detectApiBase();

/** 本地持久化 JWT 的 storage key */
export const TOKEN_STORAGE_KEY = "greenai_token";
