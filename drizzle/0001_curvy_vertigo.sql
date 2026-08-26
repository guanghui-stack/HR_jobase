CREATE TABLE `community_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`content` varchar(1000) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `community_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `email_dispatches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`jobId` int,
	`kind` enum('job_match','preference_confirmation') NOT NULL,
	`recipient` varchar(320) NOT NULL,
	`status` enum('queued','sent','failed') NOT NULL DEFAULT 'queued',
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `email_dispatches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `job_interests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`jobId` int NOT NULL,
	`level` enum('following','interested','high') NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `job_interests_id` PRIMARY KEY(`id`),
	CONSTRAINT `job_interests_user_job_unique` UNIQUE(`userId`,`jobId`)
);
--> statement-breakpoint
CREATE TABLE `job_preferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`contactEmail` varchar(320) NOT NULL,
	`fields` text NOT NULL,
	`emailEnabled` enum('yes','no') NOT NULL DEFAULT 'yes',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `job_preferences_id` PRIMARY KEY(`id`),
	CONSTRAINT `job_preferences_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(180) NOT NULL,
	`company` varchar(160) NOT NULL,
	`field` varchar(80) NOT NULL,
	`location` varchar(160) NOT NULL,
	`employmentType` varchar(80) NOT NULL,
	`workMode` varchar(80) NOT NULL,
	`summary` text NOT NULL,
	`description` text NOT NULL,
	`salaryLabel` varchar(120),
	`status` enum('draft','published','paused','closed') NOT NULL DEFAULT 'draft',
	`createdBy` int NOT NULL,
	`publishedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `community_messages_createdAt_idx` ON `community_messages` (`createdAt`);--> statement-breakpoint
CREATE INDEX `email_dispatches_userId_idx` ON `email_dispatches` (`userId`);--> statement-breakpoint
CREATE INDEX `email_dispatches_jobId_idx` ON `email_dispatches` (`jobId`);--> statement-breakpoint
CREATE INDEX `job_interests_job_idx` ON `job_interests` (`jobId`);--> statement-breakpoint
CREATE INDEX `jobs_status_idx` ON `jobs` (`status`);--> statement-breakpoint
CREATE INDEX `jobs_field_idx` ON `jobs` (`field`);--> statement-breakpoint
CREATE INDEX `jobs_createdBy_idx` ON `jobs` (`createdBy`);