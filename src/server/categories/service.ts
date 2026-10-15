import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { notFound } from "@/lib/api/errors";
import { paginationMeta } from "@/lib/validation/common";
import { slugify } from "@/lib/utils/slug";

/**
 * Category catalogue.
 *
 * Categories are admin-managed reference data. Public reads are cached with
 * Next's default fetch semantics and always filtered on `isActive` so a
 * disabled category disappears from navigation without touching its services.
 */

export interface CategoryRow {
  id: string;
  slug: string;
  name: string;
  nameFr: string | null;
  nameEn: string | null;
  description: string | null;
  descriptionFr: string | null;
  descriptionEn: string | null;
  icon: string;
  imageUrl: string | null;
  color: string;
  sortOrder: number;
  isActive: boolean;
  servicesCount: number;
  professionalsCount: number;
}

export interface ListCategoriesInput {
  activeOnly?: boolean;
  withCounts?: boolean;
  search?: string;
  page?: number;
  perPage?: number;
}

export async function listCategories(input: ListCategoriesInput = {}) {
  const { activeOnly = true, withCounts = true, search, page = 1, perPage = 100 } = input;

  const where: Prisma.CategoryWhereInput = {
    ...(activeOnly ? { isActive: true } : {}),
    ...(search
      ? {
          OR: [
            { slug: { contains: search, mode: "insensitive" } },
            { name: { contains: search, mode: "insensitive" } },
            { nameFr: { contains: search, mode: "insensitive" } },
            { nameEn: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.category.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      skip: (page - 1) * perPage,
      take: perPage,
      ...(withCounts
        ? {
            include: {
              _count: { select: { services: { where: { status: "PUBLISHED" } }, serviceRequests: true } },
            },
          }
        : {}),
    }),
    prisma.category.count({ where }),
  ]);

  const items = rows.map((row) => {
    const r = row as typeof row & {
      _count?: { services: number; serviceRequests: number };
    };
    return {
      id: r.id,
      slug: r.slug,
      name: r.name,
      nameFr: r.nameFr,
      nameEn: r.nameEn,
      description: r.description,
      descriptionFr: r.descriptionFr,
      descriptionEn: r.descriptionEn,
      icon: r.icon,
      imageUrl: r.imageUrl,
      color: r.color,
      sortOrder: r.sortOrder,
      isActive: r.isActive,
      servicesCount: r._count?.services ?? 0,
      requestsCount: r._count?.serviceRequests ?? 0,
    };
  });

  return { items, ...paginationMeta(page, perPage, total) };
}

/** Counts of *distinct verified professionals* per category — one grouped query. */
export async function professionalsCountByCategory() {
  const rows = await prisma.service.groupBy({
    by: ["categoryId"],
    where: { status: "PUBLISHED", professional: { verificationStatus: "VERIFIED" } },
    _count: { _all: true },
  });
  const map = new Map<string, number>();
  for (const row of rows) map.set(row.categoryId, row._count._all);
  return map;
}

export async function getCategoryBySlug(slug: string, activeOnly = false) {
  const category = await prisma.category.findUnique({
    where: { slug },
    ...(activeOnly ? { where: { slug, isActive: true } } : {}),
    include: { _count: { select: { services: true, serviceRequests: true } } },
  });
  if (!category || (activeOnly && !category.isActive)) throw notFound("Category not found.");
  return category;
}

export async function getCategoryById(id: string) {
  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) throw notFound("Category not found.");
  return category;
}

export async function mapCategoriesBySlug(slugs: string[]) {
  const rows = await prisma.category.findMany({ where: { slug: { in: slugs } } });
  return new Map(rows.map((r) => [r.slug, r]));
}

// ─── Admin writes ────────────────────────────────────────────────────────────

export interface CategoryInput {
  slug?: string;
  name: string;
  nameFr?: string | null;
  nameEn?: string | null;
  description?: string | null;
  descriptionFr?: string | null;
  descriptionEn?: string | null;
  icon?: string;
  imageUrl?: string | null;
  color?: string;
  sortOrder?: number;
  isActive?: boolean;
  parentId?: string | null;
}

export async function createCategory(input: CategoryInput) {
  const slug = slugify(input.slug || input.nameEn || input.name, "categorie");
  return prisma.category.create({
    data: {
      slug,
      name: input.name,
      nameFr: input.nameFr ?? null,
      nameEn: input.nameEn ?? null,
      description: input.description ?? null,
      descriptionFr: input.descriptionFr ?? null,
      descriptionEn: input.descriptionEn ?? null,
      icon: input.icon ?? "Wrench",
      imageUrl: input.imageUrl ?? null,
      color: input.color ?? "#128758",
      sortOrder: input.sortOrder ?? 0,
      isActive: input.isActive ?? true,
      parentId: input.parentId ?? null,
    },
  });
}

export async function updateCategory(id: string, input: Partial<CategoryInput>) {
  const existing = await getCategoryById(id);
  const data: Prisma.CategoryUpdateInput = {};
  if (input.slug !== undefined) data.slug = slugify(input.slug, existing.slug);
  if (input.name !== undefined) data.name = input.name;
  if (input.nameFr !== undefined) data.nameFr = input.nameFr;
  if (input.nameEn !== undefined) data.nameEn = input.nameEn;
  if (input.description !== undefined) data.description = input.description;
  if (input.descriptionFr !== undefined) data.descriptionFr = input.descriptionFr;
  if (input.descriptionEn !== undefined) data.descriptionEn = input.descriptionEn;
  if (input.icon !== undefined) data.icon = input.icon;
  if (input.imageUrl !== undefined) data.imageUrl = input.imageUrl;
  if (input.color !== undefined) data.color = input.color;
  if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
  if (input.isActive !== undefined) data.isActive = input.isActive;
  if (input.parentId !== undefined) data.parent = input.parentId ? { connect: { id: input.parentId } } : undefined;
  return prisma.category.update({ where: { id }, data });
}

export async function setCategoryActive(id: string, isActive: boolean) {
  return prisma.category.update({ where: { id }, data: { isActive } });
}

export async function deleteCategory(id: string) {
  // `Restrict` on Service.categoryId means a category with services cannot be
  // removed — the caller must deactivate it instead. That is intentional: it
  // protects historical requests and bookings.
  return prisma.category.delete({ where: { id } });
}
