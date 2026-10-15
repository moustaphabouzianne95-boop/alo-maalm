import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * A Prisma client *or* an interactive-transaction client.
 *
 * Services accept this so they can join the caller's transaction: accepting an
 * offer, creating a booking, recomputing counters and emitting notifications
 * all commit or roll back together (§53).
 */
export type DbClient = PrismaClient | Prisma.TransactionClient;

export function isTransactionClient(client: DbClient): client is Prisma.TransactionClient {
  return !(client as PrismaClient).$transaction;
}
