import { z } from "zod";

const postgresUrl = z.string().refine(
  (s) => s.startsWith("postgresql://") || s.startsWith("postgres://"),
  "must be postgres connection string"
);

const envSchema = z.object({
  DATABASE_URL: postgresUrl,
  JWT_SECRET: z.string().min(16),
  WECHAT_APPID: z.string().min(1),
  WECHAT_SECRET: z.string().min(1),
  CRON_HMAC_SECRET: z.string().min(16),
  /** 设备端 HMAC 密钥：用于 POST /internal/sensors/ingest 与 POST /internal/sensors/logs；未配置时两接口均返回 503。 */
  SENSOR_HMAC_SECRET: z.string().min(16).optional(),
  /** 仅本地开发使用：开放独立传感器模拟控制台 API。接口无需用户 JWT，生产环境必须保持为 0。 */
  ENABLE_DEV_SENSOR_SIMULATOR: z.enum(["0", "1"]).default("0"),
  SUBSCRIBE_TEMPLATE_ID: z.string().min(1),
  PORT: z.coerce.number().default(3000),
  /** Baidu AI 开放平台「植物识别」；两者皆配置时启用 POST /plants/identify */
  BAIDU_API_KEY: z.string().optional(),
  BAIDU_SECRET_KEY: z.string().optional(),
  /** OpenAI 兼容多模态对话；配置 API Key 时启用 POST /diagnose/llm（拍照/大模型诊断） */
  DIAGNOSE_LLM_API_KEY: z.string().optional(),
  DIAGNOSE_LLM_BASE_URL: z.string().optional(),
  DIAGNOSE_LLM_MODEL: z.string().optional(),
});

export type AppConfig = z.infer<typeof envSchema>;

export function isBaiduPlantIdentifyConfigured(
  c: AppConfig
): c is AppConfig & { BAIDU_API_KEY: string; BAIDU_SECRET_KEY: string } {
  return Boolean(c.BAIDU_API_KEY && c.BAIDU_SECRET_KEY);
}

export type DiagnoseLlmSettings = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

/** 当 `DIAGNOSE_LLM_API_KEY` 非空时启用视觉诊断；Base URL / Model 有默认值。 */
export function resolveDiagnoseLlmSettings(
  c: AppConfig
): DiagnoseLlmSettings | null {
  const key = c.DIAGNOSE_LLM_API_KEY?.trim();
  if (!key) return null;
  const rawBase = c.DIAGNOSE_LLM_BASE_URL?.trim();
  let baseUrl = "https://api.openai.com/v1";
  if (rawBase) {
    try {
      baseUrl = new URL(rawBase).toString().replace(/\/$/, "");
    } catch {
      /* keep default */
    }
  }
  const model = c.DIAGNOSE_LLM_MODEL?.trim() || "gpt-4o-mini";
  return { apiKey: key, baseUrl, model };
}

export function loadConfig(): AppConfig {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid env: ${parsed.error.message}`);
  }
  return parsed.data;
}
