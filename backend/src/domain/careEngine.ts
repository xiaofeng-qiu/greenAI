export type WaterPreference = "low" | "medium" | "high";
export type LightLevel = "low" | "medium" | "high";

export type PlantEnv = {
  indoor: boolean;
  heating: boolean;
  lightLevel: LightLevel;
};

const BASE_DAYS: Record<WaterPreference, number> = {
  low: 10,
  medium: 7,
  high: 4,
};

export function computeWaterIntervalDays(
  preference: WaterPreference,
  env: PlantEnv
): number {
  let days = BASE_DAYS[preference];
  if (env.indoor) days *= 1.05;
  if (env.heating) days *= 0.9;
  if (env.lightLevel === "high") days *= 0.95;
  if (env.lightLevel === "low") days *= 1.05;
  return Math.max(2, Math.floor(days));
}

export type GeneratedWaterTask = {
  plantId: string;
  dueDate: Date;
};

export function generateWaterTasks(input: {
  asOf: Date;
  intervalDays: number;
  horizonDays: number;
  plantId: string;
}): GeneratedWaterTask[] {
  const { asOf, intervalDays, horizonDays, plantId } = input;
  const tasks: GeneratedWaterTask[] = [];
  const start = startOfUtcDay(asOf);
  let cursor = new Date(start);
  const end = addDays(start, horizonDays);
  while (cursor < end) {
    tasks.push({ plantId, dueDate: new Date(cursor) });
    cursor = addDays(cursor, intervalDays);
  }
  return tasks;
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}
