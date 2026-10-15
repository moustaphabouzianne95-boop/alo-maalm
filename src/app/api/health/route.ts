import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getStorage } from "@/lib/storage";

/**
 * Liveness + dependency probe for load balancers and uptime checks.
 * Never exposes connection strings or internal hostnames.
 */
export async function GET() {
  const started = Date.now();
  let database: "up" | "down" = "down";
  try {
    await prisma.$queryRaw`SELECT 1`;
    database = "up";
  } catch {
    database = "down";
  }
  const storage = getStorage();
  const healthy = database === "up";
  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      database,
      storage: storage.name,
      latencyMs: Date.now() - started,
      time: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 }
  );
}
