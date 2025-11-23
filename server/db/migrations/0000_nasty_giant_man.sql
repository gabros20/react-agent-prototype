CREATE TABLE `collection_definitions` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'published' NOT NULL,
	`elements_structure` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `collection_definitions_slug_unique` ON `collection_definitions` (`slug`);--> statement-breakpoint
CREATE TABLE `collection_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`collection_id` text NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`collection_id`) REFERENCES `collection_definitions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `collection_entries_slug_unique` ON `collection_entries` (`slug`);--> statement-breakpoint
CREATE TABLE `conversation_images` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`image_id` text NOT NULL,
	`message_id` text,
	`uploaded_at` integer NOT NULL,
	`order_index` integer,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`image_id`) REFERENCES `images`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `entry_contents` (
	`id` text PRIMARY KEY NOT NULL,
	`entry_id` text NOT NULL,
	`locale_code` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`entry_id`) REFERENCES `collection_entries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`locale_code`) REFERENCES `locales`(`code`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `environments` (
	`id` text PRIMARY KEY NOT NULL,
	`site_id` text NOT NULL,
	`name` text NOT NULL,
	`is_protected` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `image_metadata` (
	`id` text PRIMARY KEY NOT NULL,
	`image_id` text NOT NULL,
	`description` text,
	`detailed_description` text,
	`tags` text,
	`categories` text,
	`objects` text,
	`colors` text,
	`mood` text,
	`style` text,
	`composition` text,
	`searchable_text` text,
	`alt_text` text,
	`caption` text,
	`generated_at` integer,
	`model` text,
	FOREIGN KEY (`image_id`) REFERENCES `images`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `image_metadata_image_id_unique` ON `image_metadata` (`image_id`);--> statement-breakpoint
CREATE TABLE `image_processing_queue` (
	`id` text PRIMARY KEY NOT NULL,
	`image_id` text NOT NULL,
	`job_type` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`priority` text DEFAULT 'normal' NOT NULL,
	`parameters` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`error` text,
	`created_at` integer NOT NULL,
	`started_at` integer,
	`completed_at` integer,
	FOREIGN KEY (`image_id`) REFERENCES `images`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `image_variants` (
	`id` text PRIMARY KEY NOT NULL,
	`image_id` text NOT NULL,
	`variant_type` text NOT NULL,
	`format` text NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`file_size` integer NOT NULL,
	`file_path` text NOT NULL,
	`cdn_url` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`image_id`) REFERENCES `images`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `images` (
	`id` text PRIMARY KEY NOT NULL,
	`filename` text NOT NULL,
	`original_filename` text NOT NULL,
	`media_type` text NOT NULL,
	`storage_type` text DEFAULT 'filesystem' NOT NULL,
	`file_path` text,
	`cdn_url` text,
	`thumbnail_data` blob,
	`file_size` integer NOT NULL,
	`width` integer,
	`height` integer,
	`md5_hash` text,
	`sha256_hash` text,
	`status` text DEFAULT 'processing' NOT NULL,
	`error` text,
	`uploaded_at` integer NOT NULL,
	`processed_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `images_sha256_hash_unique` ON `images` (`sha256_hash`);--> statement-breakpoint
CREATE TABLE `locales` (
	`code` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `media` (
	`id` text PRIMARY KEY NOT NULL,
	`site_id` text NOT NULL,
	`environment_id` text NOT NULL,
	`name` text NOT NULL,
	`path` text NOT NULL,
	`mime_type` text NOT NULL,
	`mime_group` text NOT NULL,
	`width` integer,
	`height` integer,
	`duration` integer,
	`alt` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`environment_id`) REFERENCES `environments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`tool_name` text,
	`step_idx` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `navigation_items` (
	`id` text PRIMARY KEY NOT NULL,
	`navigation_id` text NOT NULL,
	`parent_id` text,
	`value` text NOT NULL,
	`target_type` text NOT NULL,
	`target_uuid` text,
	`url` text,
	`sort_order` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`navigation_id`) REFERENCES `navigations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `navigations` (
	`id` text PRIMARY KEY NOT NULL,
	`site_id` text NOT NULL,
	`environment_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`environment_id`) REFERENCES `environments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `page_section_contents` (
	`id` text PRIMARY KEY NOT NULL,
	`page_section_id` text NOT NULL,
	`locale_code` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`page_section_id`) REFERENCES `page_sections`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`locale_code`) REFERENCES `locales`(`code`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `page_section_images` (
	`id` text PRIMARY KEY NOT NULL,
	`page_section_id` text NOT NULL,
	`image_id` text NOT NULL,
	`field_name` text NOT NULL,
	`sort_order` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`page_section_id`) REFERENCES `page_sections`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`image_id`) REFERENCES `images`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `page_sections` (
	`id` text PRIMARY KEY NOT NULL,
	`page_id` text NOT NULL,
	`section_def_id` text NOT NULL,
	`sort_order` integer NOT NULL,
	`status` text DEFAULT 'published' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`page_id`) REFERENCES `pages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`section_def_id`) REFERENCES `section_definitions`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `pages` (
	`id` text PRIMARY KEY NOT NULL,
	`site_id` text NOT NULL,
	`environment_id` text NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`indexing` integer DEFAULT true NOT NULL,
	`meta` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`environment_id`) REFERENCES `environments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pages_slug_unique` ON `pages` (`slug`);--> statement-breakpoint
CREATE TABLE `section_definitions` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'published' NOT NULL,
	`elements_structure` text NOT NULL,
	`template_key` text NOT NULL,
	`default_variant` text DEFAULT 'default' NOT NULL,
	`css_bundle` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `section_definitions_key_unique` ON `section_definitions` (`key`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`checkpoint` text,
	`working_context` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sites` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`name` text NOT NULL,
	`domain` text,
	`preview_domain` text,
	`default_environment_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `teams` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
