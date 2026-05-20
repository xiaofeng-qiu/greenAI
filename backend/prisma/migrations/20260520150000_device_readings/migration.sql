-- Device & DeviceReading: third-party / self-built sensor ingest (HMAC-protected /internal/sensors/ingest)

CREATE TABLE "Device" (
  "id"         TEXT PRIMARY KEY,
  "userId"     TEXT NOT NULL,
  "hardwareId" TEXT NOT NULL,
  "label"      TEXT,
  "plantId"    TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3),
  CONSTRAINT "Device_userId_fkey"  FOREIGN KEY ("userId")  REFERENCES "User"("id")  ON DELETE CASCADE  ON UPDATE CASCADE,
  CONSTRAINT "Device_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Device_userId_hardwareId_key" ON "Device" ("userId", "hardwareId");
CREATE INDEX "Device_userId_idx"  ON "Device" ("userId");
CREATE INDEX "Device_plantId_idx" ON "Device" ("plantId");

CREATE TABLE "DeviceReading" (
  "id"           TEXT PRIMARY KEY,
  "deviceId"     TEXT NOT NULL,
  "tempC"        DOUBLE PRECISION,
  "soilMoisture" DOUBLE PRECISION,
  "phLevel"      DOUBLE PRECISION,
  "lux"          DOUBLE PRECISION,
  "measuredAt"   TIMESTAMP(3) NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeviceReading_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "DeviceReading_deviceId_measuredAt_key" ON "DeviceReading" ("deviceId", "measuredAt");
CREATE INDEX "DeviceReading_deviceId_measuredAt_idx" ON "DeviceReading" ("deviceId", "measuredAt");
