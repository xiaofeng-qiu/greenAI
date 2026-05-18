-- CreateEnum
CREATE TYPE "SoilMoistureHint" AS ENUM ('very_wet', 'wet', 'moderate', 'dry', 'very_dry');

-- AlterTable
ALTER TABLE "Plant" ADD COLUMN "soilMoistureHint" "SoilMoistureHint";
