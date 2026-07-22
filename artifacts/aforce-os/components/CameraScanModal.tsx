/**
 * CameraScanModal — native barcode/QR scanner.
 *
 * Wraps expo-camera's `CameraView` with a styled overlay matching the
 * AForce OS look. Handles permission prompts, dedupes rapid-fire reads
 * from the camera, and reports the first valid code via onScan.
 *
 * Web preview: renders nothing — the parent screen falls back to its
 * existing mock-scan tray on web. (`expo-camera` is iOS/Android only.)
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Icon, type IconName } from './Icon';

import { Colors } from "@/theme/colors";

export type CameraScanResult = {
  type: string;
  data: string;
  kind: "barcode" | "qr";
};

interface Props {
  visible: boolean;
  onClose: () => void;
  onScan: (result: CameraScanResult) => void;
}

// Typed via the consumer side; expo-camera only ships these as a string union.
const SUPPORTED_BARCODES = [
  "ean13",
  "ean8",
  "upc_a",
  "upc_e",
  "code128",
  "code39",
  "qr",
  "pdf417",
  "datamatrix",
];

export function CameraScanModal({ visible, onClose, onScan }: Props) {
  if (Platform.OS === "web") return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Mount body ONLY while visible so the camera unmounts between sessions
          and we get a fresh `armed` + permission state on every open. */}
      {visible ? <CameraScanBody onClose={onClose} onScan={onScan} /> : null}
    </Modal>
  );
}

function CameraScanBody({
  onClose,
  onScan,
}: {
  onClose: () => void;
  onScan: (r: CameraScanResult) => void;
}) {
  // Lazy require so web bundling never tries to resolve the native module.
  const ExpoCamera = require("expo-camera") as typeof import("expo-camera");
  const { CameraView, useCameraPermissions } = ExpoCamera;

  const [permission, requestPermission] = useCameraPermissions();
  const [armed, setArmed] = useState(true);
  const lastScannedRef = useRef<{ data: string; at: number } | null>(null);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission().catch(() => {});
    }
  }, [permission, requestPermission]);

  const handleScanned = useCallback(
    (event: { type: string; data: string }) => {
      if (!armed) return;
      // Debounce identical reads within 1.2s — cameras fire many per second.
      const last = lastScannedRef.current;
      const now = Date.now();
      if (last && last.data === event.data && now - last.at < 1200) return;
      lastScannedRef.current = { data: event.data, at: now };

      setArmed(false);
      onScan({
        type: event.type,
        data: event.data,
        kind: event.type === "qr" ? "qr" : "barcode",
      });
    },
    [armed, onScan],
  );

  const reArm = () => setArmed(true);

  if (!permission) {
    return (
      <View style={styles.container}>
        <View style={styles.centerBox}>
          <Text style={styles.statusText}>Preparing camera…</Text>
        </View>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <View style={styles.centerBox}>
          <Icon name="camera-off" size={36} color={Colors.text.muted} />
          <Text style={styles.statusTitle}>Camera access needed</Text>
          <Text style={styles.statusText}>
            AForce OS uses your camera to scan hydration product barcodes.
          </Text>
          <Pressable style={styles.primaryBtn} onPress={() => requestPermission().catch(() => {})}>
            <Text style={styles.primaryBtnText}>GRANT ACCESS</Text>
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={onClose}>
            <Text style={styles.secondaryBtnText}>CANCEL</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: SUPPORTED_BARCODES as never }}
        onBarcodeScanned={armed ? handleScanned : undefined}
      />

      {/* Dim overlay with viewfinder cutout */}
      <View pointerEvents="none" style={styles.overlay}>
        <View style={styles.reticule}>
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
        </View>
        <Text style={styles.hint}>
          {armed ? "POINT AT BARCODE OR QR" : "READ — TAP TO SCAN AGAIN"}
        </Text>
      </View>

      <View style={styles.topBar}>
        <Pressable onPress={onClose} hitSlop={12} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Close scanner">
          <Icon name="x" size={22} color={Colors.text.primary} />
        </Pressable>
        <Text style={styles.topBarTitle}>AFORCE HYDROSCAN</Text>
        <View style={{ width: 36 }} />
      </View>

      {!armed && (
        <Pressable style={styles.rescanBtn} onPress={reArm}>
          <Icon name="refresh-cw" size={14} color={Colors.text.primary} />
          <Text style={styles.rescanBtnText}>SCAN AGAIN</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  centerBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 14,
  },
  statusTitle: {
    color: Colors.text.primary,
    fontSize: 18,
    fontWeight: "700",
    marginTop: 12,
  },
  statusText: {
    color: Colors.text.secondary,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    maxWidth: 320,
  },
  primaryBtn: {
    marginTop: 12,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.states.PEAK.primary,
    backgroundColor: `${Colors.states.PEAK.primary}22`,
  },
  primaryBtnText: {
    color: Colors.states.PEAK.primary,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
  },
  secondaryBtn: { marginTop: 4, padding: 10 },
  secondaryBtnText: { color: Colors.text.muted, fontSize: 11, letterSpacing: 1 },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  reticule: { width: 240, height: 240 },
  corner: {
    position: "absolute",
    width: 28,
    height: 28,
    borderColor: Colors.states.PEAK.primary,
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 },
  hint: {
    color: Colors.text.primary,
    marginTop: 24,
    fontSize: 11,
    letterSpacing: 1.4,
    fontWeight: "600",
  },

  topBar: {
    position: "absolute",
    top: 0, left: 0, right: 0,
    paddingTop: 56, paddingBottom: 14, paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  topBarTitle: {
    color: Colors.text.primary,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.6,
  },
  iconBtn: {
    width: 36, height: 36,
    alignItems: "center", justifyContent: "center",
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  rescanBtn: {
    position: "absolute",
    bottom: 56,
    alignSelf: "center",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  rescanBtnText: {
    color: Colors.text.primary,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
});
