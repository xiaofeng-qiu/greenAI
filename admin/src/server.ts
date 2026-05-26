import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadConfig } from "./config.js";
import { requireAdminAuth } from "./lib/auth.js";
import usersRoutes from "./routes/users.js";
import hardwarePlantsRoutes from "./routes/hardwarePlants.js";
import logsRoutes from "./routes/logs.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");

const config = loadConfig();
const adminAuth = requireAdminAuth(config);

const app = Fastify({ logger: true });

app.get("/health", async () => ({ ok: true, service: "greenai-admin" }));

await app.register(async (inner) => {
  inner.addHook("preHandler", adminAuth);
  await inner.register(usersRoutes);
  await inner.register(hardwarePlantsRoutes);
  await inner.register(logsRoutes(config));
});

await app.register(fastifyStatic, {
  root: publicDir,
  prefix: "/",
});

await app.listen({ port: config.ADMIN_PORT, host: "0.0.0.0" });
