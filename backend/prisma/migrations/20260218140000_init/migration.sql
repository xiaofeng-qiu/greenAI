-- CreateEnum
CREATE TYPE "WaterPreference" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "LightLevel" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "CareTaskType" AS ENUM ('water', 'fertilize');

-- CreateEnum
CREATE TYPE "CareTaskStatus" AS ENUM ('pending', 'completed', 'skipped');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "openid" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Shanghai',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "speciesLabel" TEXT NOT NULL,
    "waterPreference" "WaterPreference" NOT NULL,
    "indoor" BOOLEAN NOT NULL,
    "heating" BOOLEAN NOT NULL,
    "lightLevel" "LightLevel" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarePlan" (
    "id" TEXT NOT NULL,
    "plantId" TEXT NOT NULL,
    "baseIntervalDays" INTEGER NOT NULL,
    "horizonDays" INTEGER NOT NULL DEFAULT 14,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CarePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CareTask" (
    "id" TEXT NOT NULL,
    "plantId" TEXT NOT NULL,
    "type" "CareTaskType" NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "CareTaskStatus" NOT NULL DEFAULT 'pending',
    "notifySentAt" TIMESTAMP(3),
    "notifyFailCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CareTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscribeGrant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "quota" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscribeGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "errcode" INTEGER,
    "errmsg" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_openid_key" ON "User"("openid");

-- CreateIndex
CREATE INDEX "Plant_userId_idx" ON "Plant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CarePlan_plantId_key" ON "CarePlan"("plantId");

-- CreateIndex
CREATE INDEX "CareTask_plantId_dueDate_idx" ON "CareTask"("plantId", "dueDate");

-- CreateIndex
CREATE INDEX "CareTask_status_dueDate_idx" ON "CareTask"("status", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "SubscribeGrant_userId_templateId_key" ON "SubscribeGrant"("userId", "templateId");

-- CreateIndex
CREATE INDEX "NotificationLog_taskId_idx" ON "NotificationLog"("taskId");

-- AddForeignKey
ALTER TABLE "Plant" ADD CONSTRAINT "Plant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarePlan" ADD CONSTRAINT "CarePlan_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareTask" ADD CONSTRAINT "CareTask_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscribeGrant" ADD CONSTRAINT "SubscribeGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "CareTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

