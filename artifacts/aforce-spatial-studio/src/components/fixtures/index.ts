import type { ComponentType } from "react";

import type { FixtureKind } from "@/scene/model";

import { ApparelGallery } from "./ApparelGallery";
import { Centerpiece } from "./Centerpiece";
import { ContentStudio } from "./ContentStudio";
import { HydrationBar } from "./HydrationBar";
import { LockInTunnel } from "./LockInTunnel";
import { OSDemoStation } from "./OSDemoStation";
import type { FixtureProps } from "./types";

export const FIXTURE_COMPONENTS: Record<FixtureKind, ComponentType<FixtureProps>> = {
  centerpiece: Centerpiece,
  "hydration-bar": HydrationBar,
  "lock-in-tunnel": LockInTunnel,
  "os-demo-station": OSDemoStation,
  "apparel-gallery": ApparelGallery,
  "content-studio": ContentStudio,
};

export type { FixtureProps } from "./types";
