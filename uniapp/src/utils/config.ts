/** 用户自定义后端地址；留空时使用当前平台默认值。 */
export const API_BASE_STORAGE_KEY = "greenai_api_base";

/** H5 使用同源路径（开发时由 Vite 代理），其他平台默认访问设备本机。 */
export function getDefaultApiBase(): string {
  if (typeof window !== "undefined" && window.location) {
    return "";
  }
  return "http://127.0.0.1:3000";
}

export function normalizeApiBase(value: string): string {
  const trimmed = String(value || "").trim().replace(/\/+$/, "");
  if (!trimmed) return "";

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("invalid_api_url");
  }
  if (!["http:", "https:"].includes(parsed.protocol) || !parsed.hostname) {
    throw new Error("invalid_api_url");
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error("invalid_api_url");
  }
  return parsed.toString().replace(/\/+$/, "");
}

export function getConfiguredApiBase(): string {
  try {
    const saved = uni.getStorageSync(API_BASE_STORAGE_KEY);
    return typeof saved === "string" ? normalizeApiBase(saved) : "";
  } catch {
    return "";
  }
}

/** 每次请求动态读取，保存设置后无需重启应用即可切换。 */
export function getApiBase(): string {
  return getConfiguredApiBase() || getDefaultApiBase();
}

export function setApiBase(value: string): string {
  const normalized = normalizeApiBase(value);
  if (normalized) {
    uni.setStorageSync(API_BASE_STORAGE_KEY, normalized);
  } else {
    uni.removeStorageSync(API_BASE_STORAGE_KEY);
  }
  return normalized;
}

export function resetApiBase() {
  uni.removeStorageSync(API_BASE_STORAGE_KEY);
}

/** 本地持久化 JWT 的 storage key */
export const TOKEN_STORAGE_KEY = "greenai_token";
