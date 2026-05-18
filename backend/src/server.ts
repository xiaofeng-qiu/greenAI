import Fastify from "fastify";
import cors from "@fastify/cors";
import { loadConfig } from "./config.js";
import prismaPlugin from "./plugins/prisma.js";
import authRoutes from "./routes/auth.js";
import healthRoutes from "./routes/health.js";
import internalJobsRoutes from "./routes/internalJobs.js";
import plantsRoutes from "./routes/plants.js";
import subscribeRoutes from "./routes/subscribe.js";
import tasksRoutes from "./routes/tasks.js";

const config = loadConfig();

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await app.register(prismaPlugin);
await app.register(healthRoutes);
await app.register(authRoutes);
await app.register(plantsRoutes);
await app.register(tasksRoutes);
await app.register(subscribeRoutes);
await app.register(internalJobsRoutes);

await app.listen({ port: config.PORT, host: "0.0.0.0" });
