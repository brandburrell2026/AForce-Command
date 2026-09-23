import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(__dirname, '..', 'advancedVisual', 'SkinIACameraCaptureScreen.tsx'), 'utf8');

describe('SkinIA controlled camera capture', () => {
  it('uses the approved editorial scan framing and clear user-triggered permission flow', () => {
    for (const label of ['SKINIA VISUAL CHECK / SCAN', 'ALIGN FACE / EVEN LIGHT / NO FILTERS', 'Camera status', 'Capture review image']) expect(source).toContain(label);
    expect(source).toContain('onRequest={() => { void requestPermission(); }}');
  });

  it('offers an in-place quality retry without skipping the capture gate', () => {
    expect(source).toContain("if (state === 'QUALITY_INSUFFICIENT') return <QualityInsufficient onExit={onExit} onRetry={retryCapture} reason={qualityReason} />;");
    expect(source).toContain('action="Try another capture" onAction={onRetry} secondary="Back to SkinIA" onSecondary={onExit}');
    expect(source).toContain("title=\"Unable to Analyze\"");
    expect(source).not.toContain('Capture quality</Text><Text style={styles.metaValue}>{ready ? \'READY\'');
    expect(source).toContain("setReady(false);");
  });

  it('shows only a transient, internal QA quality code after a rejected capture', () => {
    expect(source).toContain('nextQualityReason = quality.reason');
    expect(source).toContain('nextQualityReason = analysis.state');
    expect(source).toContain('setQualityReason(nextQualityReason)');
    expect(source).toContain('setQualityReason(null)');
    expect(source).toContain("process.env.EXPO_PUBLIC_INTERNAL_TESTFLIGHT === 'true' && qaCode");
    expect(source).toContain('INTERNAL QA CODE: {qaCode}');
    expect(source).toContain('picture?.release();');
  });

  it('distinguishes a passed capture with closed observation admission in internal QA only', () => {
    expect(source).toContain("!SKINIA_MEMBER_OBSERVATIONS_ADMITTED && result.kind === 'NON_RESULT'");
    expect(source).toContain("'OBSERVATIONS_NOT_ADMITTED'");
    expect(source).toContain('qaCode={qaCode}');
    expect(source).toContain("process.env.EXPO_PUBLIC_INTERNAL_TESTFLIGHT === 'true' && qaCode");
  });

  it('keeps the face guide visible and captures detail without added JPEG blur', () => {
    expect(source).toContain('Center your full face, 30–45 cm away, with even light in front of you.');
    expect(source).toContain('backgroundColor: withAlpha(edStock.black, 0.34)');
    expect(source).toContain('backgroundColor: withAlpha(edStock.black, 0.06)');
    expect(source).toContain('takePictureAsync({ pictureRef: true, quality: 1 })');
  });

  it('uses an ephemeral native picture reference, not a preview file or encoded payload', () => {
    expect(source).toContain("takePictureAsync({ pictureRef: true");
    expect(source).toContain('finally {');
    expect(source).toContain('picture?.release();');
    expect(source.indexOf('picture?.release();')).toBeLessThan(source.indexOf('setState(nextState);'));
    const implementation = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    for (const forbidden of ['base64:', 'exif:', 'uri:', 'FileSystem', 'AsyncStorage', 'SecureStore', 'fetch(', 'upload']) expect(implementation, forbidden).not.toContain(forbidden);
  });

  it('runs in-memory feature extraction but withholds unvalidated observations', () => {
    expect(source).toContain('extractSkinIAImageFeatures(picture)');
    expect(source).toContain('deriveSkinIAExperimentalCandidates');
    expect(source).toContain('resolveSkinIAInternalObservation');
    expect(source).toContain('resolveSkinIAMemberResult(outcome)');
    expect(source).toContain("title={result.kind === 'OBSERVATION' ? 'Your visual check.' : 'Unable to Analyze'}");
    expect(source).not.toContain('candidateCount');
    expect(source).toContain('sessionBaseline.current = null');
  });

  it('preserves denied, unavailable, and cancel-safe states', () => {
    for (const label of ['PERMISSION DENIED', 'UNKNOWN', 'Cancel and discard']) expect(source).toContain(label);
    expect(source).toContain('isLive.current = false');
  });
});
