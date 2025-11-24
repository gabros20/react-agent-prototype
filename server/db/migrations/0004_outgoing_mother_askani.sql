ALTER TABLE `collection_entries` ADD `status` text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE `collection_entries` ADD `published_at` integer;--> statement-breakpoint
ALTER TABLE `collection_entries` ADD `author` text;--> statement-breakpoint
ALTER TABLE `collection_entries` ADD `excerpt` text;--> statement-breakpoint
ALTER TABLE `collection_entries` ADD `featured_image` text;--> statement-breakpoint
ALTER TABLE `collection_entries` ADD `category` text;