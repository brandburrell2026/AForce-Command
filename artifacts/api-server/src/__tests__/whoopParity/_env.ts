/**
 * @workspace/db throws at IMPORT time when DATABASE_URL is unset. These
 * parity tests never touch a database, but their import chain reaches the
 * db package. Import this module FIRST so the suite collects and runs in
 * the canonical (no-DB) test environment instead of joining the baseline
 * collection failures. A real value, when present, is never overridden.
 */
process.env.DATABASE_URL ??= 'postgresql://parity:parity@localhost:5432/parity_unused';
export {};
