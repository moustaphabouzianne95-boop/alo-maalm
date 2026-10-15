import type { OfferStatus, Prisma, ReviewStatus, ServiceStatus, VerificationStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { paginationMeta, type PaginationInput } from "@/lib/validation/common";

/** Shared admin queues. API routes and the dashboard read the same queries. */

export async function listAdminProfessionals(
  input: Partial<PaginationInput> & { verification?: VerificationStatus; city?: string; search?: string } = {}
) {
  const page = Math.max(1, input.page ?? 1);
  const perPage = Math.min(50, Math.max(1, input.perPage ?? 15));
  const where: Prisma.ProfessionalProfileWhereInput = {
    ...(input.verification ? { verificationStatus: input.verification } : {}),
    ...(input.city ? { city: input.city } : {}),
    ...(input.search
      ? {
          OR: [
            { businessName: { contains: input.search, mode: "insensitive" } },
            { slug: { contains: input.search, mode: "insensitive" } },
            { user: { identity: { fullName: { contains: input.search, mode: "insensitive" } } } },
          ],
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    prisma.professionalProfile.findMany({
      where,
      orderBy: [{ verificationStatus: "asc" }, { createdAt: "desc" }],
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        user: { select: { id: true, email: true, phone: true, status: true, createdAt: true, identity: { select: { fullName: true } } } },
        documents: { orderBy: { createdAt: "desc" }, take: 4 },
        _count: { select: { services: true, reviews: true } },
      },
    }),
    prisma.professionalProfile.count({ where }),
  ]);
  return { items, ...paginationMeta(page, perPage, total) };
}

export async function listAdminServices(
  input: Partial<PaginationInput> & { status?: ServiceStatus; search?: string; category?: string } = {}
) {
  const page = Math.max(1, input.page ?? 1);
  const perPage = Math.min(50, Math.max(1, input.perPage ?? 15));
  const where: Prisma.ServiceWhereInput = {
    ...(input.status ? { status: input.status } : {}),
    ...(input.category ? { category: { slug: input.category } } : {}),
    ...(input.search
      ? {
          OR: [
            { title: { contains: input.search, mode: "insensitive" } },
            { slug: { contains: input.search, mode: "insensitive" } },
            { professional: { businessName: { contains: input.search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    prisma.service.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }],
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        category: { select: { id: true, slug: true, name: true, nameFr: true, nameEn: true, icon: true } },
        professional: {
          select: {
            id: true,
            slug: true,
            businessName: true,
            verificationStatus: true,
            user: { select: { id: true, identity: { select: { fullName: true } } } },
          },
        },
      },
    }),
    prisma.service.count({ where }),
  ]);
  return { items, ...paginationMeta(page, perPage, total) };
}

export async function listAdminReviews(
  input: Partial<PaginationInput> & { status?: ReviewStatus; rating?: number; search?: string } = {}
) {
  const page = Math.max(1, input.page ?? 1);
  const perPage = Math.min(50, Math.max(1, input.perPage ?? 15));
  const where: Prisma.ReviewWhereInput = {
    ...(input.status ? { status: input.status } : {}),
    ...(input.rating ? { rating: input.rating } : {}),
    ...(input.search
      ? {
          OR: [
            { comment: { contains: input.search, mode: "insensitive" } },
            { author: { identity: { fullName: { contains: input.search, mode: "insensitive" } } } },
            { booking: { reference: { contains: input.search.toUpperCase() } } },
          ],
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    prisma.review.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        author: { select: { id: true, identity: { select: { fullName: true } } } },
        professional: { select: { id: true, slug: true, businessName: true, userId: true } },
        booking: { select: { id: true, reference: true, title: true, price: true } },
      },
    }),
    prisma.review.count({ where }),
  ]);
  return { items, ...paginationMeta(page, perPage, total) };
}

export async function listAdminOffers(input: Partial<PaginationInput> & { status?: OfferStatus; search?: string } = {}) {
  const page = Math.max(1, input.page ?? 1);
  const perPage = Math.min(50, Math.max(1, input.perPage ?? 15));
  const where: Prisma.OfferWhereInput = {
    ...(input.status ? { status: input.status } : {}),
    ...(input.search
      ? {
          OR: [
            { reference: { contains: input.search.toUpperCase(), mode: "insensitive" } },
            { request: { title: { contains: input.search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    prisma.offer.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      select: {
        id: true,
        reference: true,
        price: true,
        status: true,
        createdAt: true,
        message: true,
        professional: { select: { id: true, identity: { select: { fullName: true } }, professionalProfile: { select: { businessName: true, slug: true } } } },
        request: { select: { id: true, reference: true, title: true } },
      },
    }),
    prisma.offer.count({ where }),
  ]);
  return { items, ...paginationMeta(page, perPage, total) };
}
