CREATE TYPE "public"."inquiry_status" AS ENUM('new', 'contacted', 'closed');--> statement-breakpoint
ALTER TABLE "inquiries" ADD COLUMN "status" "inquiry_status" DEFAULT 'new' NOT NULL;