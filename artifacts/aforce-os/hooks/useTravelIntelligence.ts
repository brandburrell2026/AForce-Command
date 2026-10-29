import React from "react";
import { useAuth } from "@clerk/expo";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { travelCloudStateSchema, flightIdentity } from "@workspace/api-zod";
import { API_BASE } from "@/lib/apiBase";
import { travelStorage } from "@/services/travel/storage";
import {
  createTravelDocuments,
  travelDocumentSchema,
  type TravelDocument,
} from "@/services/travel/intelligence";
const documents = createTravelDocuments(travelStorage);
export class TravelSyncConflict extends Error {
  constructor(public remote: z.infer<typeof travelCloudStateSchema>) {
    super(
      "Another device has a different version. Review both before replacing either.",
    );
  }
}
export function useTravelIntelligence(enabled = true) {
  const { userId, isSignedIn, isLoaded, getToken } = useAuth();
  const owner = isLoaded && isSignedIn ? userId : null;
  const client = useQueryClient();
  const key = ["travel-intelligence-v2", owner];
  const ownerRef = React.useRef(owner);
  ownerRef.current = owner;
  const query = useQuery({
    queryKey: key,
    queryFn: () => documents.load(owner!),
    enabled: enabled && !!owner,
    retry: false,
  });
  const request = async (
    path: string,
    method = "GET",
    body?: unknown,
  ): Promise<any> => {
    if (!owner || ownerRef.current !== owner) throw new Error("Sign in again.");
    const token = await getToken();
    if (!token || ownerRef.current !== owner) throw new Error("Sign in again.");
    const response = await fetch(`${API_BASE}/travel/intelligence${path}`, {
      method,
      redirect: "error",
      signal: AbortSignal.timeout(15000),
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const value = await response.json().catch(() => ({
      error:
        "Travel Intelligence is not available from this server yet. Your local trips are safe.",
    }));
    if (ownerRef.current !== owner) throw new Error("Account changed.");
    if (response.status === 409)
      throw new TravelSyncConflict(travelCloudStateSchema.parse(value.current));
    if (!response.ok)
      throw new Error(value.error ?? "Travel service unavailable.");
    return value;
  };
  const write = async (document: TravelDocument) => {
    if (!owner || ownerRef.current !== owner)
      throw new Error("Account changed.");
    const prior = client.getQueryData<TravelDocument>(key);
    const parsed = travelDocumentSchema.parse({
      ...document,
      localVersion: (prior?.localVersion ?? 0) + 1,
    });
    const identities = new Map(
      parsed.trips
        .filter((t) => !t.completedAt)
        .flatMap((t) => t.legs.map((l) => [l.id, flightIdentity(l)])),
    );
    parsed.observations = Object.fromEntries(
      Object.entries(parsed.observations).filter(
        ([id, obs]) => identities.get(id) === obs.identity,
      ),
    );
    try {
      await documents.save(owner, parsed, prior?.localVersion ?? 0);
    } catch (error) {
      await client.invalidateQueries({ queryKey: key, exact: true });
      throw error;
    }
    if (ownerRef.current === owner) client.setQueryData(key, parsed);
    return parsed;
  };
  const current = () => {
    const doc = client.getQueryData<TravelDocument>(key);
    if (!doc) throw new Error("Wait for your saved trips to load.");
    return doc;
  };
  const applyRemote = async (value: any, replaceLocal = false) => {
    const cloud = travelCloudStateSchema.parse({
      revision: value.revision,
      trips: value.trips,
    });
    const local = current();
    if (
      !replaceLocal &&
      ((local.dirty &&
        JSON.stringify(local.trips) !== JSON.stringify(cloud.trips)) ||
        cloud.revision < local.revision)
    )
      throw new TravelSyncConflict(cloud);
    return write({
      ...local,
      ...cloud,
      dirty: false,
      sync: true,
      ...(value.observations ? { observations: value.observations } : {}),
      ...(typeof value.linked === "boolean" ? { linked: value.linked } : {}),
    });
  };
  const sync = async (consent = false) => {
    const doc = current();
    if (!doc.sync && !consent)
      throw new Error("Enable cloud sync first to check provider updates.");
    const remote = await request("/state");
    if (doc.dirty) {
      if (remote.revision !== doc.revision)
        throw new TravelSyncConflict(
          travelCloudStateSchema.parse({
            revision: remote.revision,
            trips: remote.trips,
          }),
        );
      return applyRemote(
        await request("/state", "PUT", {
          revision: doc.revision,
          trips: doc.trips,
          consent: true,
        }),
      );
    }
    return applyRemote(remote);
  };
  return {
    owner,
    query,
    request,
    write,
    applyRemote,
    sync,
    current,
    save: async (trips: TravelDocument["trips"]) => {
      const before = current();
      await write({ ...before, trips, dirty: true });
      if (before.sync) {
        try {
          return await applyRemote(
            await request("/state", "PUT", {
              revision: before.revision,
              trips,
              consent: true,
            }),
          );
        } catch (error) {
          if (error instanceof TravelSyncConflict) throw error;
          throw new Error(
            "Saved on this device. Cloud sync is pending; other devices and monitoring still use the previous plan. Use Sync when connected.",
          );
        }
      }
      return current();
    },
  };
}
