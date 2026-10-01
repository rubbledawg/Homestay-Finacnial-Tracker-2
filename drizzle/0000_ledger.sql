CREATE TABLE `ledger` (
	`owner` text PRIMARY KEY NOT NULL,
	`revision` integer NOT NULL,
	`payload` text NOT NULL,
	`updated` text NOT NULL
);
