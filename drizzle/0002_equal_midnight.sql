CREATE TABLE `gmail_oauth_credentials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`encryptedRefreshToken` text NOT NULL,
	`scope` text NOT NULL,
	`senderEmail` varchar(320) NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `gmail_oauth_credentials_id` PRIMARY KEY(`id`)
);
