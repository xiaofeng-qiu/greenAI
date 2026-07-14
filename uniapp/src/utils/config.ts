/** H5 使用同源路径（开发时由 Vite 代理），避免远程浏览器把 localhost:3000 指向本机。 */
function detectApiBase(): string {
  if (typeof window !== "undefined" && window.location) {
    return "";
  }
  // uni-app 非 web 平台（小程序等）回退
  return "http://127.0.0.1:3000";
}

export const API_BASE_URL = detectApiBase();

/** 本地持久化 JWT 的 storage key */
export const TOKEN_STORAGE_KEY = "greenai_token";
