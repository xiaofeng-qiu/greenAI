import {
  PrismaClient,
  CareTaskStatus,
  CareTaskType,
  LightLevel,
  WaterPreference,
} from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.upsert({
    where: { openid: "dev" },
    update: {
      timezone: "Asia/Shanghai",
      latitude: 31.2304,
      longitude: 121.4737,
      locationLabel: "上海",
      airConditioning: true,
    },
    create: {
      openid: "dev",
      timezone: "Asia/Shanghai",
      latitude: 31.2304,
      longitude: 121.4737,
      locationLabel: "上海",
      airConditioning: true,
    },
  });

  const user2 = await prisma.user.upsert({
    where: { openid: "dev-mock-2" },
    update: {
      timezone: "Asia/Shanghai",
      latitude: 30.2741,
      longitude: 120.1551,
      locationLabel: "杭州",
      airConditioning: false,
    },
    create: {
      openid: "dev-mock-2",
      timezone: "Asia/Shanghai",
      latitude: 30.2741,
      longitude: 120.1551,
      locationLabel: "杭州",
      airConditioning: false,
    },
  });

  const plants = [
    {
      id: "mock-plant-001",
      userId: user.id,
      nickname: "客厅绿萝",
      speciesLabel: "绿萝",
      waterPreference: WaterPreference.medium,
      indoor: true,
      heating: false,
      lightLevel: LightLevel.medium,
      careTips: "避免暴晒，保持通风",
    },
    {
      id: "mock-plant-002",
      userId: user.id,
      nickname: "阳台多肉",
      speciesLabel: "多肉植物",
      waterPreference: WaterPreference.low,
      indoor: true,
      heating: false,
      lightLevel: LightLevel.high,
      careTips: "少量浇水，保持通风和光照。",
    },
    {
      id: "mock-plant-003",
      userId: user.id,
      nickname: "书房蝴蝶兰",
      speciesLabel: "蝴蝶兰",
      waterPreference: WaterPreference.high,
      indoor: true,
      heating: true,
      lightLevel: LightLevel.medium,
      careTips: "保持湿润，避免冷风直吹。",
    },
    {
      id: "mock-plant-004",
      userId: user2.id,
      nickname: "窗边薄荷",
      speciesLabel: "薄荷",
      waterPreference: WaterPreference.high,
      indoor: false,
      heating: false,
      lightLevel: LightLevel.high,
      careTips: "喜水喜光，及时修剪。",
    },
  ];

  for (const plant of plants) {
    await prisma.plant.upsert({
      where: { id: plant.id },
      update: plant,
      create: plant,
    });

    await prisma.carePlan.upsert({
      where: { plantId: plant.id },
      update: { baseIntervalDays: 3, horizonDays: 14 },
      create: {
        plantId: plant.id,
        baseIntervalDays: 3,
        horizonDays: 14,
      },
    });
  }

  const now = new Date();
  const hour = 60 * 60 * 1000;
  const taskDefs = [
    {
      id: "mock-task-water-001",
      plantId: "mock-plant-001",
      type: CareTaskType.water,
      dueDate: new Date(now.getTime() + 2 * hour),
      status: CareTaskStatus.pending,
    },
    {
      id: "mock-task-fertilize-001",
      plantId: "mock-plant-001",
      type: CareTaskType.fertilize,
      dueDate: new Date(now.getTime() + 6 * hour),
      status: CareTaskStatus.pending,
    },
    {
      id: "mock-task-inspect-002",
      plantId: "mock-plant-002",
      type: CareTaskType.inspect,
      dueDate: new Date(now.getTime() + 4 * hour),
      status: CareTaskStatus.pending,
    },
    {
      id: "mock-task-water-003",
      plantId: "mock-plant-003",
      type: CareTaskType.water,
      dueDate: new Date(now.getTime() + 1 * hour),
      status: CareTaskStatus.pending,
    },
    {
      id: "mock-task-repot-004",
      plantId: "mock-plant-004",
      type: CareTaskType.repot,
      dueDate: new Date(now.getTime() + 24 * hour),
      status: CareTaskStatus.pending,
    },
    {
      id: "mock-task-completed-001",
      plantId: "mock-plant-001",
      type: CareTaskType.water,
      dueDate: new Date(now.getTime() - 24 * hour),
      status: CareTaskStatus.completed,
    },
  ];

  for (const task of taskDefs) {
    await prisma.careTask.upsert({
      where: { id: task.id },
      update: task,
      create: task,
    });
  }

  const devices = [
    {
      id: "mock-device-001",
      userId: user.id,
      hardwareId: "HW-MOCK-001",
      label: "客厅探针",
      plantId: "mock-plant-001",
    },
    {
      id: "mock-device-002",
      userId: user.id,
      hardwareId: "HW-MOCK-002",
      label: "阳台探针",
      plantId: "mock-plant-002",
    },
  ];

  for (const d of devices) {
    await prisma.device.upsert({
      where: { id: d.id },
      update: d,
      create: d,
    });
  }

  const readings = [
    {
      id: "mock-reading-001",
      deviceId: "mock-device-001",
      tempC: 25.2,
      soilMoisture: 62,
      phLevel: 6.2,
      lux: 4500,
      measuredAt: new Date(now.getTime() - 30 * 60 * 1000),
    },
    {
      id: "mock-reading-002",
      deviceId: "mock-device-001",
      tempC: 26.1,
      soilMoisture: 58,
      phLevel: 6.3,
      lux: 5200,
      measuredAt: new Date(now.getTime() - 10 * 60 * 1000),
    },
    {
      id: "mock-reading-003",
      deviceId: "mock-device-002",
      tempC: 29.0,
      soilMoisture: 34,
      phLevel: 6.8,
      lux: 9800,
      measuredAt: new Date(now.getTime() - 8 * 60 * 1000),
    },
  ];

  for (const r of readings) {
    await prisma.deviceReading.upsert({
      where: { id: r.id },
      update: r,
      create: r,
    });
  }

  const [userCount, plantCount, taskCount, deviceCount, readingCount] =
    await Promise.all([
      prisma.user.count(),
      prisma.plant.count(),
      prisma.careTask.count(),
      prisma.device.count(),
      prisma.deviceReading.count(),
    ]);

  console.log(
    `Mock seed ready: users=${userCount}, plants=${plantCount}, tasks=${taskCount}, devices=${deviceCount}, readings=${readingCount}`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
