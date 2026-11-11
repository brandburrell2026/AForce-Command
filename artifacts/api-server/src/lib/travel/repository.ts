import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "@workspace/db";
import {
  acceptTravelProposal,
  flightChanges,
  flightIdentity,
  freshMatchingSnapshot,
  travelCloudStateSchema,
  travelSnapshotSchema,
  travelTripsSchema,
  type TravelCloudState,
  type TravelTrip,
  type TravelSnapshot,
} from "@workspace/api-zod";
import { travelDigest } from "./crypto";
export type SavedObservation = { identity: string; snapshot: TravelSnapshot };
export interface TravelAccount extends TravelCloudState {
  observations: Record<string, SavedObservation>;
  linkCiphertext: string | null;
  monitoring: boolean;
}
export class TravelConflict extends Error {
  public current: TravelCloudState;
  constructor(current: TravelCloudState) {
    super("Travel changed on another device. Review both versions.");
    this.current = { revision: current.revision, trips: current.trips };
  }
}
export class TravelRepository {
  constructor(private pool: Pick<Pool, "query" | "connect">) {}
  private async tx<T>(run: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await run(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  private parse(row: Record<string, unknown>): TravelAccount {
    return {
      ...travelCloudStateSchema.parse({
        revision: row["revision"],
        trips: row["trips"],
      }),
      observations: Object.fromEntries(
        Object.entries(
          (row["observations"] ?? {}) as Record<string, SavedObservation>,
        ).map(([id, obs]) => [
          id,
          {
            identity: String(obs.identity),
            snapshot: travelSnapshotSchema.parse(obs.snapshot),
          },
        ]),
      ),
      linkCiphertext:
        typeof row["link_ciphertext"] === "string"
          ? row["link_ciphertext"]
          : null,
      monitoring: row["monitoring"] === true,
    };
  }
  async get(owner: string): Promise<TravelAccount> {
    const r = await this.pool.query(
      "SELECT * FROM aforce_travel_accounts WHERE user_id=$1",
      [owner],
    );
    return r.rows[0]
      ? this.parse(r.rows[0])
      : {
          revision: 0,
          trips: [],
          observations: {},
          linkCiphertext: null,
          monitoring: false,
        };
  }
  async ready(): Promise<boolean> {
    const r = await this.pool.query(
      "SELECT to_regclass('public.aforce_travel_accounts') IS NOT NULL AND to_regclass('public.aforce_travel_devices') IS NOT NULL AND to_regclass('public.aforce_travel_alerts') IS NOT NULL AS ready",
    );
    return r.rows[0]?.ready === true;
  }
  async replace(
    owner: string,
    expected: number,
    trips: TravelTrip[],
  ): Promise<TravelAccount> {
    const parsed = travelTripsSchema.parse(trips);
    return this.tx(async (client) => {
      await client.query(
        "INSERT INTO aforce_travel_accounts(user_id) VALUES($1) ON CONFLICT DO NOTHING",
        [owner],
      );
      const rows = await client.query(
        "SELECT * FROM aforce_travel_accounts WHERE user_id=$1 FOR UPDATE",
        [owner],
      );
      const account = this.parse(rows.rows[0]);
      if (account.revision !== expected) throw new TravelConflict(account);
      const identities = new Map(
        parsed
          .filter((t) => !t.completedAt)
          .flatMap((t) => t.legs.map((l) => [l.id, flightIdentity(l)])),
      );
      const changedIds = account.trips
        .flatMap((t) => t.legs)
        .filter((l) => identities.get(l.id) !== flightIdentity(l))
        .map((l) => l.id);
      const observations = Object.fromEntries(
        Object.entries(account.observations).filter(
          ([id, obs]) => identities.get(id) === obs.identity,
        ),
      );
      const r = await client.query(
        "UPDATE aforce_travel_accounts SET revision=revision+1,trips=$2,observations=$3,updated_at=now() WHERE user_id=$1 RETURNING *",
        [owner, JSON.stringify(parsed), JSON.stringify(observations)],
      );
      // Finished/removed/replaced legs cannot leave an alert pending.
      await client.query(
        "UPDATE aforce_travel_alerts SET state='superseded' WHERE user_id=$1 AND state IN('queued','sending') AND (NOT (leg_id=ANY($2::text[])) OR leg_id=ANY($3::text[]))",
        [owner, [...identities.keys()], changedIds],
      );
      return this.parse(r.rows[0]);
    });
  }
  async observe(
    owner: string,
    legId: string,
    identity: string,
    candidate: TravelSnapshot,
  ): Promise<TravelAccount> {
    const snapshot = travelSnapshotSchema.parse(candidate);
    return this.tx(async (client) => {
      const r = await client.query(
        "SELECT * FROM aforce_travel_accounts WHERE user_id=$1 FOR UPDATE",
        [owner],
      );
      if (!r.rows[0]) throw new Error("Sync this trip before checking status.");
      const account = this.parse(r.rows[0]);
      const trip = account.trips.find(
        (t) => !t.completedAt && t.legs.some((l) => l.id === legId),
      );
      const leg = trip?.legs.find((l) => l.id === legId);
      if (!trip || !leg || flightIdentity(leg) !== identity)
        throw new Error("Journey changed while checking.");
      if (!freshMatchingSnapshot(leg, snapshot)) return account;
      const previous = account.observations[legId];
      if (
        previous?.identity === identity &&
        Date.parse(previous.snapshot.fetchedAt) >=
          Date.parse(snapshot.fetchedAt)
      )
        return account;
      const changes = flightChanges(
        previous?.identity === identity ? previous.snapshot : null,
        snapshot,
      );
      account.observations[legId] = { identity, snapshot };
      await client.query(
        "UPDATE aforce_travel_accounts SET observations=$2 WHERE user_id=$1",
        [owner, JSON.stringify(account.observations)],
      );
      if (changes.length && account.monitoring) {
        const key = travelDigest(
          JSON.stringify([
            legId,
            previous?.snapshot.fetchedAt,
            snapshot.fetchedAt,
            changes,
          ]),
        );
        const devices = await client.query(
          "SELECT device_id FROM aforce_travel_devices WHERE user_id=$1 AND enabled=true",
          [owner],
        );
        for (const device of devices.rows) {
          await client.query(
            "UPDATE aforce_travel_alerts SET state='superseded' WHERE user_id=$1 AND device_id=$2 AND leg_id=$3 AND state='queued'",
            [owner, device.device_id, legId],
          );
          await client.query(
            "INSERT INTO aforce_travel_alerts(id,user_id,device_id,trip_id,leg_id,event_key,expires_at) VALUES($1,$2,$3,$4,$5,$6,now()+interval '24 hours') ON CONFLICT(user_id,device_id,event_key) DO NOTHING",
            [randomUUID(), owner, device.device_id, trip.id, legId, key],
          );
        }
      }
      return account;
    });
  }
  async accept(
    owner: string,
    expected: number,
    legId: string,
    key: string,
  ): Promise<TravelAccount> {
    // The latest observation is rechecked under the same row lock as the commit.
    return this.tx(async (client) => {
      const r = await client.query(
        "SELECT * FROM aforce_travel_accounts WHERE user_id=$1 FOR UPDATE",
        [owner],
      );
      if (!r.rows[0]) throw new Error("Journey missing.");
      const current = this.parse(r.rows[0]);
      if (current.revision !== expected) throw new TravelConflict(current);
      const observation = current.observations[legId];
      if (!observation) throw new Error("Check the flight again.");
      const trips = acceptTravelProposal(
        current.trips,
        legId,
        observation.snapshot,
        key,
      );
      const changed = await client.query(
        "UPDATE aforce_travel_accounts SET revision=revision+1,trips=$2,updated_at=now() WHERE user_id=$1 RETURNING *",
        [owner, JSON.stringify(trips)],
      );
      return this.parse(changed.rows[0]);
    });
  }
  async link(owner: string, ciphertext: string | null): Promise<void> {
    await this.pool.query(
      "INSERT INTO aforce_travel_accounts(user_id,link_ciphertext,linked_at) VALUES($1,$2,CASE WHEN $2::text IS NULL THEN NULL ELSE now() END) ON CONFLICT(user_id) DO UPDATE SET link_ciphertext=EXCLUDED.link_ciphertext,linked_at=EXCLUDED.linked_at",
      [owner, ciphertext],
    );
  }
  async device(
    owner: string,
    id: string,
    tokenCipher: string,
    hash: string,
    enabled: boolean,
  ): Promise<void> {
    await this.tx(async (client) => {
      await client.query(
        "INSERT INTO aforce_travel_accounts(user_id) VALUES($1) ON CONFLICT DO NOTHING",
        [owner],
      );
      await client.query(
        "DELETE FROM aforce_travel_devices WHERE token_hash=$1 AND (user_id<>$2 OR device_id<>$3)",
        [hash, owner, id],
      );
      await client.query(
        "INSERT INTO aforce_travel_devices(user_id,device_id,token_ciphertext,token_hash,enabled) VALUES($1,$2,$3,$4,$5) ON CONFLICT(user_id,device_id) DO UPDATE SET token_ciphertext=EXCLUDED.token_ciphertext,token_hash=EXCLUDED.token_hash,enabled=EXCLUDED.enabled",
        [owner, id, tokenCipher, hash, enabled],
      );
      if (enabled)
        await client.query(
          "UPDATE aforce_travel_accounts SET monitoring=true,next_check_at=now() WHERE user_id=$1",
          [owner],
        );
      else
        await client.query(
          "UPDATE aforce_travel_alerts SET state='superseded' WHERE user_id=$1 AND device_id=$2 AND state IN('queued','sending')",
          [owner, id],
        );
    });
  }
  async disableDevice(owner: string, id: string): Promise<void> {
    await this.pool.query(
      "UPDATE aforce_travel_devices SET enabled=false WHERE user_id=$1 AND device_id=$2",
      [owner, id],
    );
    await this.pool.query(
      "UPDATE aforce_travel_alerts SET state='superseded' WHERE user_id=$1 AND device_id=$2 AND state IN('queued','sending')",
      [owner, id],
    );
  }
  async deviceEnabled(owner: string, id: string): Promise<boolean> {
    const r = await this.pool.query(
      "SELECT enabled FROM aforce_travel_devices WHERE user_id=$1 AND device_id=$2",
      [owner, id],
    );
    return r.rows[0]?.enabled === true;
  }
  async purge(owner: string): Promise<void> {
    await this.pool.query(
      "DELETE FROM aforce_travel_accounts WHERE user_id=$1",
      [owner],
    );
  }
  async claimOwners(): Promise<string[]> {
    const r = await this.pool.query(
      "UPDATE aforce_travel_accounts SET lease_until=now()+interval '3 minutes',next_check_at=now()+interval '5 minutes' WHERE user_id IN(SELECT user_id FROM aforce_travel_accounts a WHERE monitoring=true AND next_check_at<=now() AND (lease_until IS NULL OR lease_until<now()) AND EXISTS(SELECT 1 FROM aforce_travel_devices d WHERE d.user_id=a.user_id AND d.enabled=true) ORDER BY next_check_at LIMIT 2 FOR UPDATE SKIP LOCKED) RETURNING user_id",
    );
    return r.rows.map((row) => row.user_id as string);
  }
  async releaseOwner(owner: string): Promise<void> {
    await this.pool.query(
      "UPDATE aforce_travel_accounts SET lease_until=NULL WHERE user_id=$1",
      [owner],
    );
  }
  async claimAlerts() {
    const r = await this.pool.query(
      "UPDATE aforce_travel_alerts SET lease_until=now()+interval '2 minutes',state=CASE WHEN state='receipt' THEN state ELSE 'sending' END WHERE id IN(SELECT id FROM aforce_travel_alerts WHERE state IN('queued','sending','receipt') AND next_at<=now() AND expires_at>now() AND (lease_until IS NULL OR lease_until<now()) ORDER BY next_at LIMIT 5 FOR UPDATE SKIP LOCKED) RETURNING *",
    );
    return r.rows as Array<{
      id: string;
      user_id: string;
      device_id: string;
      trip_id: string;
      leg_id: string;
      state: string;
      attempts: number;
      ticket_id: string | null;
      created_at: Date;
      expires_at: Date;
    }>;
  }
  async deliveryTarget(job: {
    user_id: string;
    device_id: string;
    trip_id: string;
    leg_id: string;
  }) {
    const r = await this.pool.query(
      "SELECT a.trips,a.monitoring,d.enabled,d.token_ciphertext,d.last_sent_at FROM aforce_travel_accounts a JOIN aforce_travel_devices d ON a.user_id=d.user_id WHERE a.user_id=$1 AND d.device_id=$2",
      [job.user_id, job.device_id],
    );
    const row = r.rows[0];
    if (!row?.monitoring || !row.enabled) return null;
    const trips = travelTripsSchema.parse(row.trips);
    if (
      !trips.some(
        (t) =>
          t.id === job.trip_id &&
          !t.completedAt &&
          t.legs.some((l) => l.id === job.leg_id),
      )
    )
      return null;
    return {
      ciphertext: String(row.token_ciphertext),
      lastSentAt: row.last_sent_at ? new Date(row.last_sent_at).getTime() : 0,
    };
  }
  async finishAlert(
    id: string,
    state: "queued" | "receipt" | "delivered" | "failed" | "superseded",
    nextAt: number,
    ticket: string | null = null,
  ) {
    await this.pool.query(
      "UPDATE aforce_travel_alerts SET state=$2,next_at=$3,ticket_id=COALESCE($4,ticket_id),attempts=attempts+1,lease_until=NULL WHERE id=$1",
      [id, state, new Date(nextAt), ticket],
    );
  }
  async claimDevice(owner: string, device: string) {
    const r = await this.pool.query(
      "UPDATE aforce_travel_devices SET send_lease_until=now()+interval '30 seconds' WHERE user_id=$1 AND device_id=$2 AND enabled=true AND (send_lease_until IS NULL OR send_lease_until<now()) AND (last_sent_at IS NULL OR last_sent_at<now()-interval '10 minutes') RETURNING device_id",
      [owner, device],
    );
    return r.rowCount === 1;
  }
  async sent(owner: string, device: string) {
    await this.pool.query(
      "UPDATE aforce_travel_devices SET last_sent_at=now(),send_lease_until=NULL WHERE user_id=$1 AND device_id=$2",
      [owner, device],
    );
  }
  async sweep() {
    await this.pool.query(
      "DELETE FROM aforce_travel_alerts WHERE expires_at<now() OR (state IN('delivered','failed','superseded') AND created_at<now()-interval '1 day')",
    );
  }
}
let repository: TravelRepository | undefined;
export async function defaultTravelRepository() {
  if (!repository) {
    const { pool } = await import("@workspace/db");
    repository = new TravelRepository(pool);
  }
  return repository;
}
