-- DropForeignKey
ALTER TABLE "reports" DROP CONSTRAINT "reports_target_id_fkey";

-- AlterTable
ALTER TABLE "reports" ADD COLUMN     "subject_user_id" UUID;

-- CreateIndex
CREATE INDEX "reports_subject_user_id_idx" ON "reports"("subject_user_id");

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_subject_user_id_fkey" FOREIGN KEY ("subject_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
