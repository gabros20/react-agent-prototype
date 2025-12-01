CREATE TABLE `conversation_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`conversation_index` integer NOT NULL,
	`user_prompt` text NOT NULL,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	`metrics` text,
	`model_info` text,
	`entries` text,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
