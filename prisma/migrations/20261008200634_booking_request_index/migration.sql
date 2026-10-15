-- CreateIndex
CREATE INDEX "bookings_request_id_status_idx" ON "bookings"("request_id", "status");
