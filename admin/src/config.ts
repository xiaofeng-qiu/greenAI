import { z } from "zod";

const postgresUrl = z.string().refine(
  (s) => s.startsWith("postgresql://") || s.startsWith("postgres://"),
  "must be postgres connection string"
);

const envSchema = z.object({
  DATABASE_URL: postgresUrl,
  /** 运维控制台 API 与静态页共用；Bearer 令牌，请勿泄露。 */
  ADMIN_API_TOKEN: z.string().min(24),
  ADMIN_PORT: z.coerce.number().default(3100),
  /**
   * 可选：宿主机上的应用日志文件（如 JSON Lines），用于「系统日志」页尾部查看。
   * 未配置时仅展示库内通知/任务错误等聚合。
   */
  ADMIN_SYSTEM_LOG_PATH: z.string().min(1).optional(),
});

export type AdminConfig = z.infer<typeof envSchema>;

export function loadConfig(): AdminConfig {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid admin env: ${parsed.error.message}`);
  }
  return parsed.data;
}
