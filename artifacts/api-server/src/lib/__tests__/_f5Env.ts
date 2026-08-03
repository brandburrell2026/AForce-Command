/**
 * @workspace/db throws at IMPORT time when DATABASE_URL is unset. This
 * suite uses in-memory fakes and never connects, but its production
 * imports reach the db package. Import FIRST so it collects in the
 * canonical no-DB run. Never overrides a real value.
 */
process.env.DATABASE_URL ??= 'postgresql://f5:f5@localhost:5432/f5_unused';
export {};
