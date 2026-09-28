CREATE TYPE "public"."admin_role" AS ENUM('admin', 'super_admin');--> statement-breakpoint
CREATE TYPE "public"."content_page_key" AS ENUM('prayer_wall', 'camp_guidelines', 'quiz_rules', 'game_rules', 'two_by_two_guidelines', 'venue');--> statement-breakpoint
CREATE TYPE "public"."event_category" AS ENUM('session', 'worship', 'meal', 'games', 'prayer', 'fellowship', 'free_time', 'travel', 'other');--> statement-breakpoint
CREATE TYPE "public"."notification_kind" AS ENUM('announcement', 'event_reminder', 'schedule_change');--> statement-breakpoint
CREATE TYPE "public"."team_role" AS ENUM('captain', 'vice_captain', 'spoc');--> statement-breakpoint
CREATE TYPE "public"."venue_kind" AS ENUM('camp', 'hospital', 'other');--> statement-breakpoint
CREATE TABLE "admin" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "admin_role" DEFAULT 'admin' NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "camp" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"timezone" text DEFAULT 'Asia/Kolkata' NOT NULL,
	"access_code_hash" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "camp_day" (
	"id" serial PRIMARY KEY NOT NULL,
	"camp_id" integer NOT NULL,
	"date" text NOT NULL,
	"day_number" integer NOT NULL,
	"label" text,
	"two_by_two_reveal_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "camp_day_number_positive" CHECK ("camp_day"."day_number" > 0),
	CONSTRAINT "camp_day_date_iso" CHECK ("camp_day"."date" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
);
--> statement-breakpoint
CREATE TABLE "contact" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_id" integer NOT NULL,
	"name" text NOT NULL,
	"role" text,
	"phone" text,
	"photo_url" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_category" (
	"id" serial PRIMARY KEY NOT NULL,
	"camp_id" integer NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_page" (
	"id" serial PRIMARY KEY NOT NULL,
	"camp_id" integer NOT NULL,
	"key" "content_page_key" NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_section" (
	"id" serial PRIMARY KEY NOT NULL,
	"page_id" integer NOT NULL,
	"heading" text,
	"body" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event" (
	"id" serial PRIMARY KEY NOT NULL,
	"camp_day_id" integer NOT NULL,
	"title" text NOT NULL,
	"subtitle" text,
	"category" "event_category" DEFAULT 'other' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"session_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_ends_after_start" CHECK ("event"."ends_at" > "event"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "link" (
	"id" serial PRIMARY KEY NOT NULL,
	"camp_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"url" text NOT NULL,
	"category" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification" (
	"id" serial PRIMARY KEY NOT NULL,
	"camp_id" integer NOT NULL,
	"kind" "notification_kind" NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"url" text,
	"event_id" integer,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"recipient_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "person" (
	"id" serial PRIMARY KEY NOT NULL,
	"camp_id" integer NOT NULL,
	"name" text NOT NULL,
	"gender" text,
	"phone" text,
	"email" text,
	"photo_url" text,
	"team_id" integer,
	"room_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_subscription" (
	"id" serial PRIMARY KEY NOT NULL,
	"camp_id" integer NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"muted_categories" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "room" (
	"id" serial PRIMARY KEY NOT NULL,
	"camp_id" integer NOT NULL,
	"description" text NOT NULL,
	"location" text,
	"sort_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" serial PRIMARY KEY NOT NULL,
	"camp_id" integer NOT NULL,
	"topic" text NOT NULL,
	"speaker" text,
	"reference" text,
	"outline" text,
	"reflections" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "song" (
	"id" serial PRIMARY KEY NOT NULL,
	"camp_id" integer NOT NULL,
	"number" integer NOT NULL,
	"title" text NOT NULL,
	"first_line" text,
	"lyrics" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team" (
	"id" serial PRIMARY KEY NOT NULL,
	"camp_id" integer NOT NULL,
	"name" text NOT NULL,
	"logo_url" text,
	"contact_phone" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_leader" (
	"team_id" integer NOT NULL,
	"person_id" integer NOT NULL,
	"role" "team_role" NOT NULL,
	CONSTRAINT "team_leader_team_id_person_id_role_pk" PRIMARY KEY("team_id","person_id","role")
);
--> statement-breakpoint
CREATE TABLE "two_by_two" (
	"id" serial PRIMARY KEY NOT NULL,
	"camp_day_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "two_by_two_partner" (
	"two_by_two_id" integer NOT NULL,
	"person_id" integer NOT NULL,
	CONSTRAINT "two_by_two_partner_two_by_two_id_person_id_pk" PRIMARY KEY("two_by_two_id","person_id")
);
--> statement-breakpoint
CREATE TABLE "venue" (
	"id" serial PRIMARY KEY NOT NULL,
	"camp_id" integer NOT NULL,
	"kind" "venue_kind" DEFAULT 'other' NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"latitude" text,
	"longitude" text,
	"phone" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "camp_day" ADD CONSTRAINT "camp_day_camp_id_camp_id_fk" FOREIGN KEY ("camp_id") REFERENCES "public"."camp"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact" ADD CONSTRAINT "contact_category_id_contact_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."contact_category"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_category" ADD CONSTRAINT "contact_category_camp_id_camp_id_fk" FOREIGN KEY ("camp_id") REFERENCES "public"."camp"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_page" ADD CONSTRAINT "content_page_camp_id_camp_id_fk" FOREIGN KEY ("camp_id") REFERENCES "public"."camp"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_section" ADD CONSTRAINT "content_section_page_id_content_page_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."content_page"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_camp_day_id_camp_day_id_fk" FOREIGN KEY ("camp_day_id") REFERENCES "public"."camp_day"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_session_id_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."session"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "link" ADD CONSTRAINT "link_camp_id_camp_id_fk" FOREIGN KEY ("camp_id") REFERENCES "public"."camp"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_camp_id_camp_id_fk" FOREIGN KEY ("camp_id") REFERENCES "public"."camp"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person" ADD CONSTRAINT "person_camp_id_camp_id_fk" FOREIGN KEY ("camp_id") REFERENCES "public"."camp"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person" ADD CONSTRAINT "person_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person" ADD CONSTRAINT "person_room_id_room_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."room"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscription" ADD CONSTRAINT "push_subscription_camp_id_camp_id_fk" FOREIGN KEY ("camp_id") REFERENCES "public"."camp"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room" ADD CONSTRAINT "room_camp_id_camp_id_fk" FOREIGN KEY ("camp_id") REFERENCES "public"."camp"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_camp_id_camp_id_fk" FOREIGN KEY ("camp_id") REFERENCES "public"."camp"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "song" ADD CONSTRAINT "song_camp_id_camp_id_fk" FOREIGN KEY ("camp_id") REFERENCES "public"."camp"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team" ADD CONSTRAINT "team_camp_id_camp_id_fk" FOREIGN KEY ("camp_id") REFERENCES "public"."camp"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_leader" ADD CONSTRAINT "team_leader_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_leader" ADD CONSTRAINT "team_leader_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "two_by_two" ADD CONSTRAINT "two_by_two_camp_day_id_camp_day_id_fk" FOREIGN KEY ("camp_day_id") REFERENCES "public"."camp_day"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "two_by_two_partner" ADD CONSTRAINT "two_by_two_partner_two_by_two_id_two_by_two_id_fk" FOREIGN KEY ("two_by_two_id") REFERENCES "public"."two_by_two"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "two_by_two_partner" ADD CONSTRAINT "two_by_two_partner_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue" ADD CONSTRAINT "venue_camp_id_camp_id_fk" FOREIGN KEY ("camp_id") REFERENCES "public"."camp"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "admin_username_idx" ON "admin" USING btree ("username");--> statement-breakpoint
CREATE UNIQUE INDEX "camp_day_camp_date_idx" ON "camp_day" USING btree ("camp_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "camp_day_camp_number_idx" ON "camp_day" USING btree ("camp_id","day_number");--> statement-breakpoint
CREATE INDEX "contact_category_idx" ON "contact" USING btree ("category_id","sort_order");--> statement-breakpoint
CREATE INDEX "contact_category_camp_idx" ON "contact_category" USING btree ("camp_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "content_page_camp_key_idx" ON "content_page" USING btree ("camp_id","key");--> statement-breakpoint
CREATE INDEX "content_section_page_idx" ON "content_section" USING btree ("page_id","sort_order");--> statement-breakpoint
CREATE INDEX "event_camp_day_idx" ON "event" USING btree ("camp_day_id");--> statement-breakpoint
CREATE INDEX "event_starts_at_idx" ON "event" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "link_camp_idx" ON "link" USING btree ("camp_id","sort_order");--> statement-breakpoint
CREATE INDEX "notification_camp_idx" ON "notification" USING btree ("camp_id","sent_at");--> statement-breakpoint
CREATE INDEX "person_camp_idx" ON "person" USING btree ("camp_id");--> statement-breakpoint
CREATE INDEX "person_team_idx" ON "person" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "person_room_idx" ON "person" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "person_name_idx" ON "person" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "push_subscription_endpoint_idx" ON "push_subscription" USING btree ("endpoint");--> statement-breakpoint
CREATE INDEX "room_camp_sort_idx" ON "room" USING btree ("camp_id","sort_key");--> statement-breakpoint
CREATE INDEX "session_camp_idx" ON "session" USING btree ("camp_id");--> statement-breakpoint
CREATE UNIQUE INDEX "song_camp_number_idx" ON "song" USING btree ("camp_id","number");--> statement-breakpoint
CREATE INDEX "song_search_idx" ON "song" USING gin (to_tsvector('english', "title" || ' ' || coalesce("lyrics", '')));--> statement-breakpoint
CREATE INDEX "team_camp_idx" ON "team" USING btree ("camp_id");--> statement-breakpoint
CREATE INDEX "two_by_two_camp_day_idx" ON "two_by_two" USING btree ("camp_day_id");--> statement-breakpoint
CREATE INDEX "two_by_two_partner_person_idx" ON "two_by_two_partner" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "venue_camp_idx" ON "venue" USING btree ("camp_id","sort_order");