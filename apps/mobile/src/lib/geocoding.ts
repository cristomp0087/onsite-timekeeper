import { logger } from './logger';

export interface GeocodingResult {
  latitude: number;
  longitude: number;
  address: string;
  city?: string;
  country?: string;
}

// Usar Nominatim (OpenStreetMap) - 100% gratuito
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';

export async function searchAddress(query: string): Promise<GeocodingResult[]> {
  try {
    const response = await fetch(
      `${NOMINATIM_URL}/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'OnSiteFlow/1.0',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    return data.map((item: any) => ({
      latitude: parseFloat(item.lat),
      longitude: parseFloat(item.lon),
      address: item.display_name,
      city: item.address?.city || item.address?.town || item.address?.village,
      country: item.address?.country,
    }));
  } catch (error) {
    logger.error('geocoding', 'Error searching address', {
      error: String(error),
    });
    return [];
  }
}

export async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<string | null> {
  try {
    const response = await fetch(
      `${NOMINATIM_URL}/reverse?lat=${latitude}&lon=${longitude}&format=json`,
      {
        headers: {
          'User-Agent': 'OnSiteFlow/1.0',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.display_name || null;
  } catch (error) {
    logger.error('geocoding', 'Error reverse geocoding', {
      error: String(error),
    });
    return null;
  }
}
