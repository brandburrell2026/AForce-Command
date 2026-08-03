import { describe, it, expect } from 'vitest';
import { resolveHealthConnectAvailability } from '../availability';

describe('resolveHealthConnectAvailability — platform gate', () => {
  it('iOS is always unsupported_platform regardless of sdkStatus', () => {
    expect(resolveHealthConnectAvailability('SDK_AVAILABLE', 'ios')).toEqual({
      availability: 'unavailable',
      userAction: 'unsupported_platform',
    });
  });

  it('Android below API 28 is unsupported_platform even if sdkStatus somehow reports available', () => {
    expect(resolveHealthConnectAvailability('SDK_AVAILABLE', 'android', 26)).toEqual({
      availability: 'unavailable',
      userAction: 'unsupported_platform',
    });
  });
});

describe('resolveHealthConnectAvailability — Android 9–13 (updatable module, API 28–33)', () => {
  it('SDK_AVAILABLE ⇒ available, no action', () => {
    expect(resolveHealthConnectAvailability('SDK_AVAILABLE', 'android', 31)).toEqual({
      availability: 'available',
      userAction: 'none',
    });
  });

  it('SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED ⇒ needs_update, install_update', () => {
    expect(resolveHealthConnectAvailability('SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED', 'android', 30)).toEqual({
      availability: 'needs_update',
      userAction: 'install_update',
    });
  });

  it('SDK_UNAVAILABLE (not installed yet) ⇒ needs_update, install_update — same fixable action', () => {
    expect(resolveHealthConnectAvailability('SDK_UNAVAILABLE', 'android', 28)).toEqual({
      availability: 'needs_update',
      userAction: 'install_update',
    });
  });

  it('API level exactly at the floor (28) and ceiling (33) both stay in the updatable-module branch', () => {
    expect(resolveHealthConnectAvailability('SDK_UNAVAILABLE', 'android', 33).userAction).toBe('install_update');
  });
});

describe('resolveHealthConnectAvailability — Android 14+ (built-in, API 34+)', () => {
  it('SDK_AVAILABLE ⇒ available, no action', () => {
    expect(resolveHealthConnectAvailability('SDK_AVAILABLE', 'android', 34)).toEqual({
      availability: 'available',
      userAction: 'none',
    });
  });

  it('SDK_UNAVAILABLE on a built-in OS ⇒ unsupported_platform, NOT install_update (nothing to install)', () => {
    expect(resolveHealthConnectAvailability('SDK_UNAVAILABLE', 'android', 34)).toEqual({
      availability: 'unavailable',
      userAction: 'unsupported_platform',
    });
  });

  it('SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED on a built-in OS ⇒ system_update, NOT install_update (no Play Store page for this tier)', () => {
    expect(resolveHealthConnectAvailability('SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED', 'android', 34)).toEqual({
      availability: 'needs_update',
      userAction: 'system_update',
    });
  });

  it('SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED stays system_update well above API 34 too', () => {
    expect(resolveHealthConnectAvailability('SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED', 'android', 36).userAction).toBe(
      'system_update',
    );
  });
});

describe('resolveHealthConnectAvailability — unknown API level (benefit of the doubt)', () => {
  it('SDK_UNAVAILABLE with no androidApiLevel given resolves to the fixable install_update case', () => {
    expect(resolveHealthConnectAvailability('SDK_UNAVAILABLE', 'android')).toEqual({
      availability: 'needs_update',
      userAction: 'install_update',
    });
  });

  it('SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED with no androidApiLevel given is install_update, NOT system_update (unknown level never qualifies for the built-in tier)', () => {
    expect(resolveHealthConnectAvailability('SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED', 'android')).toEqual({
      availability: 'needs_update',
      userAction: 'install_update',
    });
  });
});
