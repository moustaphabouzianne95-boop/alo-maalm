-- DropForeignKey
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_target_id_fkey";

-- DropForeignKey
ALTER TABLE "service_areas" DROP CONSTRAINT "service_areas_service_id_fkey";

-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "target_user_id" UUID;

-- CreateIndex
CREATE INDEX "audit_logs_target_user_id_idx" ON "audit_logs"("target_user_id");

-- AddForeignKey
ALTER TABLE "service_areas" ADD CONSTRAINT "service_areas_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

