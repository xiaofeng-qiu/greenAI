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
  SUBSCRIBE_TEMPLATE_ID: z.string().min(1),
  PORT: z.coerce.number().default(3000),
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(): AppConfig {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid env: ${parsed.error.message}`);
  }
  return parsed.data;
}
