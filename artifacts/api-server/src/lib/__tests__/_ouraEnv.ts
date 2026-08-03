/**
 * @workspace/db throws at IMPORT time when DATABASE_URL is unset. These
 * suites exercise pagination/bootstrap logic against fakes and never
 * connect, but their production imports reach the db package. Import this
 * FIRST so they collect in the canonical no-DB run. Never overrides a
 * real value.
 */
process.env.DATABASE_URL ??= 'postgresql://oura:oura@localhost:5432/oura_unused';
export {};
