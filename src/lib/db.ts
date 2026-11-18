import { PrismaClient } from "@prisma/client";

/**
 * Client Prisma unique.
 * QUERY_DELAY_MS (tests uniquement) : ajoute un délai à chaque requête pour simuler
 * la distance réseau serveur ↔ base et repérer les pages qui enchaînent trop de requêtes.
 */
function create() {
  const base = new PrismaClient();
  const delay = Number(process.env.QUERY_DELAY_MS) || 0;
  if (!delay) return base;
  return base.$extends({
    query: {
      async $allOperations({ args, query }) {
        await new Promise((r) => setTimeout(r, delay));
        return query(args);
      },
    },
  }) as unknown as PrismaClient;
}

const g = globalThis as unknown as { prisma?: PrismaClient };
export const db = g.prisma ?? create();
if (process.env.NODE_ENV !== "production") g.prisma = db;
