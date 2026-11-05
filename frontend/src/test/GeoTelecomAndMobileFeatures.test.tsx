import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GeoTelecomResolver } from '../services/geoTelecomResolver';
import { CapacitorService } from '../services/capacitorService';

describe('GeoTelecomResolver & Mobile Telephony Feature Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('GeoTelecomResolver', () => {
    it('resolves San Francisco, CA for +1 (415) area code', () => {
      const res = GeoTelecomResolver.resolve('+1 (415) 555-0199');
      expect(res.country).toBe('United States');
      expect(res.countryCode).toBe('+1');
      expect(res.regionOrCity).toContain('San Francisco');
      expect(res.displayLocation).toContain('San Francisco, CA');
      expect(res.isTollFree).toBe(false);
      expect(res.coordinates?.approxLatitude).toBeCloseTo(37.7749, 2);
    });

    it('resolves New York, NY for 212 area code', () => {
      const res = GeoTelecomResolver.resolve('2125550123');
      expect(res.country).toBe('United States');
      expect(res.regionOrCity).toContain('New York');
      expect(res.displayLocation).toContain('New York, NY');
      expect(res.isTollFree).toBe(false);
    });

    it('identifies Toll-Free NANP numbers (800, 888, 877)', () => {
      const res800 = GeoTelecomResolver.resolve('+1-800-273-8255');
      expect(res800.isTollFree).toBe(true);
      expect(res800.displayLocation).toContain('Toll-Free');
      expect(res800.carrierOrType).toContain('Toll-Free');

      const res888 = GeoTelecomResolver.resolve('18884321000');
      expect(res888.isTollFree).toBe(true);
    });

    it('resolves Indian mobile and telecom circles (+91)', () => {
      const resMumbai = GeoTelecomResolver.resolve('+91 98200 12345');
      expect(resMumbai.country).toBe('India');
      expect(resMumbai.countryCode).toBe('+91');
      expect(resMumbai.regionOrCity).toContain('Mumbai');
      expect(resMumbai.displayLocation).toContain('Mumbai');

      const resDelhi = GeoTelecomResolver.resolve('+91 98100 54321');
      expect(resDelhi.country).toBe('India');
      expect(resDelhi.regionOrCity).toContain('Delhi NCR');
    });

    it('resolves UK area codes (+44 20 London)', () => {
      const resUK = GeoTelecomResolver.resolve('+44 20 7946 0919');
      expect(resUK.country).toBe('United Kingdom');
      expect(resUK.countryCode).toBe('+44');
      expect(resUK.regionOrCity).toContain('London');
    });

    it('safely handles empty or null input strings without crashing', () => {
      const resEmpty = GeoTelecomResolver.resolve('');
      expect(resEmpty.country).toBe('Unknown');
      expect(resEmpty.displayLocation).toBe('Unknown Region');

      const resNull = GeoTelecomResolver.resolve(null as any);
      expect(resNull.country).toBe('Unknown');
    });
  });

  describe('Emergency GPS SOS & Location Acquisition', () => {
    it('retrieves device GPS coordinates when geolocation API is available', async () => {
      const mockGeolocation = {
        getCurrentPosition: vi.fn((success) => {
          success({
            coords: {
              latitude: 37.774929,
              longitude: -122.419416,
              accuracy: 12
            }
          });
        })
      };
      Object.assign(navigator, { geolocation: mockGeolocation });

      const loc = await CapacitorService.getEmergencyLocation();
      expect(loc.success).toBe(true);
      expect(loc.latitude).toBeCloseTo(37.774929, 4);
      expect(loc.longitude).toBeCloseTo(-122.419416, 4);
      expect(loc.mapsUrl).toContain('maps.google.com/?q=37.774929,-122.419416');
    });

    it('handles geolocation permission denial gracefully', async () => {
      const mockGeolocation = {
        getCurrentPosition: vi.fn((_success, error) => {
          error({ message: 'User denied Geolocation' });
        })
      };
      Object.assign(navigator, { geolocation: mockGeolocation });

      const loc = await CapacitorService.getEmergencyLocation();
      expect(loc.success).toBe(false);
      expect(loc.error).toContain('User denied Geolocation');
    });

    it('dispatches emergency distress payload via clipboard fallback', async () => {
      const writeTextSpy = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText: writeTextSpy }, share: undefined });

      const res = await CapacitorService.broadcastEmergencySos({
        phoneNumber: '+1-555-911-0000',
        mapsUrl: 'https://maps.google.com/?q=37.7749,-122.4194'
      });

      expect(res.success).toBe(true);
      expect(writeTextSpy).toHaveBeenCalledWith(
        expect.stringContaining('[EMERGENCY SOS]')
      );
    });
  });
});
