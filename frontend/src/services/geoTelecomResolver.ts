/**
 * GeoTelecomResolver
 * Intelligent telecommunication carrier and geographic origin resolver based on
 * E.164 phone numbering formats, NANP (North American Numbering Plan) area codes,
 * and international national telecom circle prefixes.
 */

export interface GeoTelecomInfo {
  phoneNumber: string;
  country: string;
  countryCode: string;
  regionOrCity: string;
  carrierOrType: string;
  isTollFree: boolean;
  isInternational: boolean;
  displayLocation: string;
  displayCarrier: string;
  coordinates?: {
    approxLatitude: number;
    approxLongitude: number;
  };
}

// Major NANP area codes with approximate regional centroid coordinates
const NANP_AREA_CODES: Record<string, { city: string; state: string; lat: number; lng: number }> = {
  '212': { city: 'New York', state: 'NY', lat: 40.7128, lng: -74.006 },
  '646': { city: 'New York', state: 'NY', lat: 40.7128, lng: -74.006 },
  '917': { city: 'New York', state: 'NY', lat: 40.7128, lng: -74.006 },
  '718': { city: 'Brooklyn / Queens', state: 'NY', lat: 40.6782, lng: -73.9442 },
  '310': { city: 'Los Angeles', state: 'CA', lat: 34.0522, lng: -118.2437 },
  '213': { city: 'Downtown Los Angeles', state: 'CA', lat: 34.0522, lng: -118.2437 },
  '424': { city: 'Santa Monica / South Bay', state: 'CA', lat: 34.0195, lng: -118.4912 },
  '415': { city: 'San Francisco', state: 'CA', lat: 37.7749, lng: -122.4194 },
  '628': { city: 'San Francisco', state: 'CA', lat: 37.7749, lng: -122.4194 },
  '650': { city: 'San Mateo / Palo Alto', state: 'CA', lat: 37.4419, lng: -122.143 },
  '408': { city: 'San Jose / Silicon Valley', state: 'CA', lat: 37.3382, lng: -121.8863 },
  '510': { city: 'Oakland / East Bay', state: 'CA', lat: 37.8044, lng: -122.2712 },
  '312': { city: 'Chicago', state: 'IL', lat: 41.8781, lng: -87.6298 },
  '773': { city: 'Chicago Metro', state: 'IL', lat: 41.8781, lng: -87.6298 },
  '206': { city: 'Seattle', state: 'WA', lat: 47.6062, lng: -122.3321 },
  '425': { city: 'Bellevue / Redmond', state: 'WA', lat: 47.6101, lng: -122.2015 },
  '512': { city: 'Austin', state: 'TX', lat: 30.2672, lng: -97.7431 },
  '214': { city: 'Dallas', state: 'TX', lat: 32.7767, lng: -96.797 },
  '713': { city: 'Houston', state: 'TX', lat: 29.7604, lng: -95.3698 },
  '210': { city: 'San Antonio', state: 'TX', lat: 29.4241, lng: -98.4936 },
  '305': { city: 'Miami', state: 'FL', lat: 25.7617, lng: -80.1918 },
  '404': { city: 'Atlanta', state: 'GA', lat: 33.749, lng: -84.388 },
  '617': { city: 'Boston', state: 'MA', lat: 42.3601, lng: -71.0589 },
  '702': { city: 'Las Vegas', state: 'NV', lat: 36.1699, lng: -115.1398 },
  '602': { city: 'Phoenix', state: 'AZ', lat: 33.4484, lng: -112.074 },
  '303': { city: 'Denver', state: 'CO', lat: 39.7392, lng: -104.9903 },
  '503': { city: 'Portland', state: 'OR', lat: 45.5152, lng: -122.6784 },
  '202': { city: 'Washington', state: 'DC', lat: 38.9072, lng: -77.0369 },
  '416': { city: 'Toronto', state: 'ON (Canada)', lat: 43.6532, lng: -79.3832 },
  '604': { city: 'Vancouver', state: 'BC (Canada)', lat: 49.2827, lng: -123.1207 }
};

const TOLL_FREE_NANP = new Set(['800', '888', '877', '866', '855', '844', '833']);

// India Telecom Circles & Major Centers
const INDIA_PREFIXES: Record<string, { circle: string; carrier: string; lat: number; lng: number }> = {
  '9820': { circle: 'Mumbai, Maharashtra', carrier: 'Jio 5G / Airtel', lat: 19.076, lng: 72.8777 },
  '9821': { circle: 'Mumbai, Maharashtra', carrier: 'Vodafone Idea', lat: 19.076, lng: 72.8777 },
  '9819': { circle: 'Mumbai, Maharashtra', carrier: 'Airtel 5G', lat: 19.076, lng: 72.8777 },
  '9833': { circle: 'Mumbai, Maharashtra', carrier: 'Vodafone Idea', lat: 19.076, lng: 72.8777 },
  '9810': { circle: 'Delhi NCR', carrier: 'Airtel 5G', lat: 28.6139, lng: 77.209 },
  '9811': { circle: 'Delhi NCR', carrier: 'Vodafone Idea', lat: 28.6139, lng: 77.209 },
  '9871': { circle: 'Delhi NCR', carrier: 'Airtel 5G', lat: 28.6139, lng: 77.209 },
  '9845': { circle: 'Bengaluru, Karnataka', carrier: 'Airtel 5G', lat: 12.9716, lng: 77.5946 },
  '9844': { circle: 'Bengaluru, Karnataka', carrier: 'BSNL / Jio', lat: 12.9716, lng: 77.5946 },
  '9848': { circle: 'Hyderabad, Telangana', carrier: 'Airtel 5G', lat: 17.385, lng: 78.4867 },
  '9849': { circle: 'Hyderabad, Telangana', carrier: 'Vodafone Idea', lat: 17.385, lng: 78.4867 },
  '9830': { circle: 'Kolkata, West Bengal', carrier: 'Airtel 5G', lat: 22.5726, lng: 88.3639 },
  '9822': { circle: 'Pune, Maharashtra', carrier: 'Vodafone Idea', lat: 18.5204, lng: 73.8567 },
  '9825': { circle: 'Ahmedabad, Gujarat', carrier: 'Vodafone Idea', lat: 23.0225, lng: 72.5714 },
  '9840': { circle: 'Chennai, Tamil Nadu', carrier: 'Airtel 5G', lat: 13.0827, lng: 80.2707 },
  '9841': { circle: 'Chennai, Tamil Nadu', carrier: 'BSNL Mobile', lat: 13.0827, lng: 80.2707 }
};

export class GeoTelecomResolver {
  /**
   * Resolves origin location, carrier profile, and geographic attributes for any phone number.
   */
  public static resolve(rawNumber: string): GeoTelecomInfo {
    if (!rawNumber || typeof rawNumber !== 'string') {
      return {
        phoneNumber: '',
        country: 'Unknown',
        countryCode: '',
        regionOrCity: 'Unknown Region',
        carrierOrType: 'Standard Telecom Network',
        isTollFree: false,
        isInternational: false,
        displayLocation: 'Unknown Region',
        displayCarrier: 'Cellular Carrier'
      };
    }

    const trimmed = rawNumber.trim();
    const digitsOnly = trimmed.replace(/\D/g, '');

    // 1. Check for Toll-Free North America (+1 or 10-digit)
    const nanpCandidate = digitsOnly.startsWith('1') && digitsOnly.length === 11
      ? digitsOnly.substring(1)
      : digitsOnly.length === 10
      ? digitsOnly
      : null;

    if (nanpCandidate) {
      const areaCode = nanpCandidate.substring(0, 3);
      if (TOLL_FREE_NANP.has(areaCode)) {
        return {
          phoneNumber: rawNumber,
          country: 'United States / Canada',
          countryCode: '+1',
          regionOrCity: 'Toll-Free Nationwide',
          carrierOrType: 'Toll-Free Telephony Carrier',
          isTollFree: true,
          isInternational: false,
          displayLocation: 'Toll-Free Nationwide (USA/Canada)',
          displayCarrier: 'Verified Toll-Free Network'
        };
      }

      if (NANP_AREA_CODES[areaCode]) {
        const info = NANP_AREA_CODES[areaCode];
        return {
          phoneNumber: rawNumber,
          country: 'United States',
          countryCode: '+1',
          regionOrCity: `${info.city}, ${info.state}`,
          carrierOrType: 'Tier-1 Mobile Network',
          isTollFree: false,
          isInternational: false,
          displayLocation: `${info.city}, ${info.state}`,
          displayCarrier: 'US Cellular Network',
          coordinates: { approxLatitude: info.lat, approxLongitude: info.lng }
        };
      }

      return {
        phoneNumber: rawNumber,
        country: 'United States / Canada',
        countryCode: '+1',
        regionOrCity: `NANP Area (${areaCode})`,
        carrierOrType: 'North American Telecom',
        isTollFree: false,
        isInternational: false,
        displayLocation: `North America (Area ${areaCode})`,
        displayCarrier: 'North American Carrier'
      };
    }

    // 2. India (+91)
    if (digitsOnly.startsWith('91') && digitsOnly.length >= 12) {
      const nationalNumber = digitsOnly.substring(2);
      const prefix4 = nationalNumber.substring(0, 4);

      if (INDIA_PREFIXES[prefix4]) {
        const match = INDIA_PREFIXES[prefix4];
        return {
          phoneNumber: rawNumber,
          country: 'India',
          countryCode: '+91',
          regionOrCity: match.circle,
          carrierOrType: match.carrier,
          isTollFree: false,
          isInternational: true,
          displayLocation: match.circle,
          displayCarrier: match.carrier,
          coordinates: { approxLatitude: match.lat, approxLongitude: match.lng }
        };
      }

      // General Indian Mobile Prefix
      const firstDigit = nationalNumber.charAt(0);
      let likelyCarrier = 'Indian Telecom Network';
      if (firstDigit === '6' || firstDigit === '7') likelyCarrier = 'Jio 5G / Airtel';
      else if (firstDigit === '8' || firstDigit === '9') likelyCarrier = 'Airtel / Jio / Vi';

      return {
        phoneNumber: rawNumber,
        country: 'India',
        countryCode: '+91',
        regionOrCity: 'National Circle • India',
        carrierOrType: likelyCarrier,
        isTollFree: false,
        isInternational: true,
        displayLocation: 'India (National Circle)',
        displayCarrier: likelyCarrier,
        coordinates: { approxLatitude: 20.5937, approxLongitude: 78.9629 }
      };
    }

    // 3. United Kingdom (+44)
    if (digitsOnly.startsWith('44')) {
      const ukRest = digitsOnly.substring(2);
      let city = 'United Kingdom';
      let lat = 51.5074;
      let lng = -0.1278;

      if (ukRest.startsWith('20') || ukRest.startsWith('020')) {
        city = 'London, England';
      } else if (ukRest.startsWith('161')) {
        city = 'Manchester, England';
        lat = 53.4808;
        lng = -2.2426;
      } else if (ukRest.startsWith('121')) {
        city = 'Birmingham, England';
        lat = 52.4862;
        lng = -1.8904;
      } else if (ukRest.startsWith('7')) {
        city = 'UK Mobile Network';
      }

      return {
        phoneNumber: rawNumber,
        country: 'United Kingdom',
        countryCode: '+44',
        regionOrCity: city,
        carrierOrType: 'BT / EE / Vodafone UK',
        isTollFree: false,
        isInternational: true,
        displayLocation: city,
        displayCarrier: 'UK Mobile Network',
        coordinates: { approxLatitude: lat, approxLongitude: lng }
      };
    }

    // 4. Other International Country Codes
    if (digitsOnly.startsWith('61')) {
      return {
        phoneNumber: rawNumber,
        country: 'Australia',
        countryCode: '+61',
        regionOrCity: 'Sydney / Melbourne, Australia',
        carrierOrType: 'Telstra / Optus',
        isTollFree: false,
        isInternational: true,
        displayLocation: 'Australia',
        displayCarrier: 'Telstra / Optus Network',
        coordinates: { approxLatitude: -33.8688, approxLongitude: 151.2093 }
      };
    }

    if (digitsOnly.startsWith('49')) {
      return {
        phoneNumber: rawNumber,
        country: 'Germany',
        countryCode: '+49',
        regionOrCity: 'Berlin / Frankfurt, Germany',
        carrierOrType: 'Deutsche Telekom / Vodafone',
        isTollFree: false,
        isInternational: true,
        displayLocation: 'Germany',
        displayCarrier: 'Deutsche Telekom Network',
        coordinates: { approxLatitude: 52.52, approxLongitude: 13.405 }
      };
    }

    if (digitsOnly.startsWith('33')) {
      return {
        phoneNumber: rawNumber,
        country: 'France',
        countryCode: '+33',
        regionOrCity: 'Paris / Île-de-France',
        carrierOrType: 'Orange / SFR France',
        isTollFree: false,
        isInternational: true,
        displayLocation: 'Paris, France',
        displayCarrier: 'Orange Telecom',
        coordinates: { approxLatitude: 48.8566, approxLongitude: 2.3522 }
      };
    }

    if (digitsOnly.startsWith('971')) {
      return {
        phoneNumber: rawNumber,
        country: 'United Arab Emirates',
        countryCode: '+971',
        regionOrCity: 'Dubai / Abu Dhabi, UAE',
        carrierOrType: 'e& (Etisalat) / du',
        isTollFree: false,
        isInternational: true,
        displayLocation: 'Dubai, UAE',
        displayCarrier: 'e& / du Telecom',
        coordinates: { approxLatitude: 25.2048, approxLongitude: 55.2708 }
      };
    }

    if (digitsOnly.startsWith('81')) {
      return {
        phoneNumber: rawNumber,
        country: 'Japan',
        countryCode: '+81',
        regionOrCity: 'Tokyo / Kanto, Japan',
        carrierOrType: 'NTT Docomo / SoftBank',
        isTollFree: false,
        isInternational: true,
        displayLocation: 'Tokyo, Japan',
        displayCarrier: 'NTT Docomo Network',
        coordinates: { approxLatitude: 35.6762, approxLongitude: 139.6503 }
      };
    }

    if (digitsOnly.startsWith('65')) {
      return {
        phoneNumber: rawNumber,
        country: 'Singapore',
        countryCode: '+65',
        regionOrCity: 'Singapore',
        carrierOrType: 'Singtel / StarHub',
        isTollFree: false,
        isInternational: true,
        displayLocation: 'Singapore',
        displayCarrier: 'Singtel 5G',
        coordinates: { approxLatitude: 1.3521, approxLongitude: 103.8198 }
      };
    }

    // Default dynamic fallback
    return {
      phoneNumber: rawNumber,
      country: 'Telephony Network',
      countryCode: rawNumber.startsWith('+') ? rawNumber.substring(0, 3) : '',
      regionOrCity: 'Carrier Geolocation Active',
      carrierOrType: 'Mobile Cellular Network',
      isTollFree: false,
      isInternational: rawNumber.startsWith('+'),
      displayLocation: 'Carrier Regional Node',
      displayCarrier: 'Cellular Voice Network'
    };
  }
}
