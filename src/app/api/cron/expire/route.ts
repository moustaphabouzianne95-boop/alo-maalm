import { NextResponse, type NextRequest } from "next/server";
import { expireStaleRequests } from "@/server/requests/service";
import { expireStaleOffers } from "@/server/offers/service";

/**
 * Housekeeping job: closes requests past their TTL and expires offers whose
 * validity window passed (§14). Idempotent, so it is safe to fire often.
 *
 * Protected by a shared secret header — a cron URL must not be callable by
 * anybody who guesses it. Configure `CRON_SECRET` and point your scheduler at
 * `POST /api/cron/expire` with `Authorization: Bearer <CRON_SECRET>`.
 */
async function runExpire(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const header = req.headers.get("authorization");
    if (header !== `Bearer ${secret}`) {
      return NextResponse.json({ success: false, error: { code: "UNAUTHENTICATED", message: "Invalid cron secret." } }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    // Fail closed in production rather than exposing a free "expire everything".
    return NextResponse.json(
      { success: false, error: { code: "SERVICE_UNAVAILABLE", message: "CRON_SECRET is not configured." } },
      { status: 503 }
    );
  }

  const [requests, offers] = await Promise.all([expireStaleRequests(), expireStaleOffers()]);
  return NextResponse.json({ success: true, data: { ...requests, ...offers } });
}

/** Vercel Cron calls GET. Manual schedulers may still POST. */
export async function GET(req: NextRequest) {
  return runExpire(req);
}

export async function POST(req: NextRequest) {
  return runExpire(req);
}
