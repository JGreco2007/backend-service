import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["admin", "agent"]);
export const propertyStatus = pgEnum("property_status", ["available", "pending", "sold"]);
export const inquiryStatus = pgEnum("inquiry_status", ["new", "contacted", "closed"]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 255 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    role: userRole("role").notNull().default("agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Used on every login lookup (WHERE email = ...) — must be unique and indexed.
    uniqueIndex("users_email_idx").on(table.email),
  ]
);

export const properties = pgTable(
  "properties",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    priceCents: integer("price_cents").notNull(),
    acres: numeric("acres", { precision: 10, scale: 2 }),
    status: propertyStatus("status").notNull().default("available"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Listing pages filter WHERE status = 'available', etc.
    index("properties_status_idx").on(table.status),
    // Joined against users for "listings by agent" and used in FK lookups.
    index("properties_created_by_idx").on(table.createdBy),
  ]
);

export const inquiries = pgTable(
  "inquiries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    propertyId: uuid("property_id").references(() => properties.id, { onDelete: "set null" }),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 50 }),
    message: text("message"),
    // Agent-managed lead status — the only field an agent can update on an
    // inquiry; the submitted contact details are never editable by them.
    status: inquiryStatus("status").notNull().default("new"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Joined against properties for "inquiries on this listing".
    index("inquiries_property_id_idx").on(table.propertyId),
    // Looked up when checking a repeat inquirer.
    index("inquiries_email_idx").on(table.email),
    // Inbox views sort/filter by recency.
    index("inquiries_created_at_idx").on(table.createdAt),
  ]
);

export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // SHA-256 hash of the opaque refresh token — the raw token is only ever
    // seen by the client (in the httpOnly cookie); we never store it.
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    revoked: boolean("revoked").notNull().default(false),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // /refresh looks up by hash on every call.
    uniqueIndex("refresh_tokens_token_hash_idx").on(table.tokenHash),
    // logout-all-devices and "revoke on password/email change" both do
    // WHERE user_id = ... AND revoked = false.
    index("refresh_tokens_user_id_idx").on(table.userId),
  ]
);

export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("password_reset_tokens_token_hash_idx").on(table.tokenHash),
    index("password_reset_tokens_user_id_idx").on(table.userId),
  ]
);

export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // Client-supplied Idempotency-Key header value.
    key: varchar("key", { length: 255 }).notNull(),
    // sha256(route + canonicalized body) — detects the same key being
    // reused for a materially different request, which is a client bug,
    // not a legitimate retry.
    requestHash: varchar("request_hash", { length: 64 }).notNull(),
    // Null until the original request finishes — lets a concurrent request
    // with the same key see "still in flight" instead of racing the handler.
    responseStatus: integer("response_status"),
    responseBody: jsonb("response_body"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("idempotency_keys_key_idx").on(table.key)]
);

export const usersRelations = relations(users, ({ many }) => ({
  properties: many(properties),
  refreshTokens: many(refreshTokens),
  passwordResetTokens: many(passwordResetTokens),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, { fields: [refreshTokens.userId], references: [users.id] }),
}));

export const passwordResetTokensRelations = relations(passwordResetTokens, ({ one }) => ({
  user: one(users, { fields: [passwordResetTokens.userId], references: [users.id] }),
}));

export const propertiesRelations = relations(properties, ({ one, many }) => ({
  owner: one(users, { fields: [properties.createdBy], references: [users.id] }),
  inquiries: many(inquiries),
}));

export const inquiriesRelations = relations(inquiries, ({ one }) => ({
  property: one(properties, { fields: [inquiries.propertyId], references: [properties.id] }),
}));
