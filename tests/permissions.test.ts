import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import {
  assessPasswordStrength,
  hashPassword,
  isPasswordAcceptable,
  verifyPassword,
} from "@/lib/auth/password";
import {
  assertOwnership,
  assertRole,
  canAccessRoleArea,
  canDecideOffer,
  canManageBooking,
  canManageOffer,
  canManageRequest,
  canManageService,
  canModerate,
  canWriteReview,
  homePathForRole,
  roleForPath,
} from "@/lib/permissions";
import { validateUpload } from "@/lib/storage";
import {
  BOOKING_TRANSITIONS,
  bookingActorRole,
  canPerformTransition,
  canTransitionBooking,
} from "@/server/bookings/service";
import { canTransitionRequest, OFFERABLE_STATUSES } from "@/server/requests/service";

const customer = { id: "customer-1", role: "CUSTOMER" as const };
const professional = { id: "pro-1", role: "PROFESSIONAL" as const };
const other = { id: "other-1", role: "CUSTOMER" as const };
const admin = { id: "admin-1", role: "ADMIN" as const };
const booking = { customerId: customer.id, professionalId: professional.id, status: "IN_PROGRESS" as const };

describe("route guards", () => {
  it("sends each role to its own home and blocks the others", () => {
    expect(homePathForRole("ADMIN")).toBe("/admin");
    expect(homePathForRole("PROFESSIONAL")).toBe("/professional");
    expect(homePathForRole("CUSTOMER")).toBe("/dashboard");

    expect(roleForPath("/admin/users")).toEqual(["ADMIN"]);
    expect(roleForPath("/professional/offers")).toEqual(["PROFESSIONAL", "ADMIN"]);
    expect(roleForPath("/dashboard/bookings")).toEqual(["CUSTOMER", "PROFESSIONAL", "ADMIN"]);
    expect(roleForPath("/services")).toBeNull();

    expect(canAccessRoleArea("CUSTOMER", "/admin")).toBe(false);
    expect(canAccessRoleArea("CUSTOMER", "/professional/services")).toBe(false);
    expect(canAccessRoleArea("PROFESSIONAL", "/admin/reports")).toBe(false);
    expect(canAccessRoleArea("ADMIN", "/admin/users/abc")).toBe(true);
    expect(canAccessRoleArea("PROFESSIONAL", "/professional")).toBe(true);
    expect(canAccessRoleArea(null, "/dashboard")).toBe(false);
    expect(canAccessRoleArea("CUSTOMER", "/")).toBe(true);
  });
});

describe("resource ownership", () => {
  it("lets the owner or an admin manage a resource, and nobody else", () => {
    expect(canManageService(professional, { ownerUserId: professional.id })).toBe(true);
    expect(canManageService(customer, { ownerUserId: professional.id })).toBe(false);
    expect(canManageService(professional, { ownerUserId: customer.id })).toBe(false);
    expect(canManageService(admin, { ownerUserId: customer.id })).toBe(true);

    expect(canManageRequest(customer, { customerId: customer.id })).toBe(true);
    expect(canManageRequest(professional, { customerId: customer.id })).toBe(false);

    expect(canManageOffer(professional, { professionalId: professional.id })).toBe(true);
    expect(canManageOffer(customer, { professionalId: professional.id })).toBe(false);
    expect(canDecideOffer(customer, { customerId: customer.id })).toBe(true);
    expect(canDecideOffer(other, { customerId: customer.id })).toBe(false);
    expect(canDecideOffer(admin, { customerId: customer.id })).toBe(true);

    expect(canManageBooking(customer, booking)).toBe(true);
    expect(canManageBooking(professional, booking)).toBe(true);
    expect(canManageBooking(other, booking)).toBe(false);
    expect(canManageBooking(null, booking)).toBe(false);

    expect(canModerate(admin)).toBe(true);
    expect(canModerate(professional)).toBe(false);
    expect(canModerate(null)).toBe(false);
  });

  it("rejects a review unless the customer owns a completed booking", () => {
    expect(canWriteReview(customer, { customerId: customer.id, status: "COMPLETED" })).toBe(true);
    expect(canWriteReview(customer, { customerId: customer.id, status: "IN_PROGRESS" })).toBe(false);
    expect(canWriteReview(customer, { customerId: customer.id, status: "CANCELLED" })).toBe(false);
    expect(canWriteReview(professional, { customerId: customer.id, status: "COMPLETED" })).toBe(false);
    expect(canWriteReview(admin, { customerId: customer.id, status: "COMPLETED" })).toBe(false);
    expect(canWriteReview(null, { customerId: customer.id, status: "COMPLETED" })).toBe(false);
  });

  it("throws when a role or owner check fails", () => {
    expect(() => assertRole(customer, "ADMIN")).toThrow(ApiError);
    expect(() => assertRole(admin, "ADMIN")).not.toThrow();
    expect(() => assertRole(null, "CUSTOMER")).toThrow(ApiError);
    expect(() => assertOwnership(other, customer.id)).toThrow(ApiError);
    expect(() => assertOwnership(admin, customer.id)).not.toThrow();
  });
});

describe("booking and request state machines", () => {
  it("only allows the published booking transitions", () => {
    expect(canTransitionBooking("PENDING", "CONFIRMED")).toBe(true);
    expect(canTransitionBooking("PENDING", "COMPLETED")).toBe(false);
    expect(canTransitionBooking("CONFIRMED", "IN_PROGRESS")).toBe(true);
    expect(canTransitionBooking("IN_PROGRESS", "COMPLETED")).toBe(true);
    expect(canTransitionBooking("COMPLETED", "CANCELLED")).toBe(false);
    expect(canTransitionBooking("CANCELLED", "COMPLETED")).toBe(false);
    expect(BOOKING_TRANSITIONS.COMPLETED).toEqual([]);
  });

  it("lets the customer confirm completion and stops the professional from self-completing", () => {
    expect(bookingActorRole(customer, booking)).toBe("CUSTOMER");
    expect(bookingActorRole(professional, booking)).toBe("PROFESSIONAL");
    expect(bookingActorRole(admin, booking)).toBe("ADMIN");
    expect(bookingActorRole(other, booking)).toBeNull();

    expect(canPerformTransition(professional, { ...booking, status: "PENDING" }, "CONFIRMED")).toBe(true);
    expect(canPerformTransition(customer, { ...booking, status: "PENDING" }, "CONFIRMED")).toBe(false);
    expect(canPerformTransition(professional, booking, "COMPLETED")).toBe(false);
    expect(canPerformTransition(customer, booking, "COMPLETED")).toBe(true);
    expect(canPerformTransition(admin, booking, "COMPLETED")).toBe(true);
    expect(canPerformTransition(other, booking, "COMPLETED")).toBe(false);
    expect(canPerformTransition(customer, { ...booking, status: "CANCELLED" }, "COMPLETED")).toBe(false);
  });

  it("keeps closed requests closed to new offers", () => {
    expect(canTransitionRequest("OPEN", "RECEIVING_OFFERS")).toBe(true);
    expect(canTransitionRequest("RECEIVING_OFFERS", "OFFER_SELECTED")).toBe(true);
    expect(canTransitionRequest("COMPLETED", "OPEN")).toBe(false);
    expect(canTransitionRequest("CANCELLED", "RECEIVING_OFFERS")).toBe(false);
    expect(OFFERABLE_STATUSES).toEqual(["OPEN", "RECEIVING_OFFERS"]);
  });
});

describe("password policy", () => {
  it("rejects short passwords and verifies a real bcrypt hash", async () => {
    expect(isPasswordAcceptable("short")).toBe(false);
    expect(isPasswordAcceptable("Demo@12345")).toBe(true);
    expect(assessPasswordStrength("Demo@12345").missing).toEqual([]);

    const hash = await hashPassword("Demo@12345");
    expect(hash).not.toContain("Demo@12345");
    expect(await verifyPassword("Demo@12345", hash)).toBe(true);
    expect(await verifyPassword("wrong-password", hash)).toBe(false);
    expect(await verifyPassword("Demo@12345", "")).toBe(false);
  });
});

describe("uploads and optional cloud imports", () => {
  it("accepts jpeg and rejects empty, svg, and oversized files", () => {
    const ok = new File([new Uint8Array([1, 2, 3])], "photo.jpg", { type: "image/jpeg" });
    expect(validateUpload(ok)).toBe("image/jpeg");

    expect(() => validateUpload(new File([], "empty.jpg", { type: "image/jpeg" }))).toThrow(ApiError);
    expect(() => validateUpload(new File([new Uint8Array([1])], "icon.svg", { type: "image/svg+xml" }))).toThrow(
      ApiError
    );
    const huge = new File([new Uint8Array(6 * 1024 * 1024)], "huge.jpg", { type: "image/jpeg" });
    expect(() => validateUpload(huge)).toThrow(ApiError);
  });

  it("does not leave a static import of the optional S3 SDK for the bundler to resolve", () => {
    const storage = readFileSync(path.join(process.cwd(), "src/lib/storage/index.ts"), "utf8");
    const mailer = readFileSync(path.join(process.cwd(), "src/lib/notifications/mailer.ts"), "utf8");
    expect(storage).not.toMatch(/import\(\s*["']@aws-sdk\/client-s3["']/);
    expect(mailer).not.toMatch(/import\(\s*["']nodemailer["']/);
    expect(storage).toContain("optionalImport");
    expect(mailer).toContain("optionalImport");
  });
});
