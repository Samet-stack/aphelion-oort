export type LocationSource = 'gps' | 'demo' | 'unavailable';

export interface LocationData {
    lat: number | null;
    lng: number | null;
    accuracy: number | null;
    source: LocationSource;
}

const demoLocation: LocationData = {
    lat: 48.8566,
    lng: 2.3522,
    accuracy: 1200,
    source: 'demo',
};

const unavailableLocation: LocationData = {
    lat: null,
    lng: null,
    accuracy: null,
    source: 'unavailable',
};

export const getLocation = async (): Promise<LocationData> => {
    if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_DEMO_GPS === 'true') {
        return demoLocation;
    }

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
        return unavailableLocation;
    }

    return new Promise<LocationData>((resolve) => {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    source: 'gps',
                });
            },
            () => resolve(unavailableLocation),
            {
                enableHighAccuracy: true,
                timeout: 8000,
                maximumAge: 60000,
            }
        );
    });
};

const formatCoordinate = (value: number, positive: string, negative: string) => {
    const label = value >= 0 ? positive : negative;
    return `${Math.abs(value).toFixed(5)} ${label}`;
};

export const getAddress = async (
    lat: number | null,
    lng: number | null,
    source?: LocationSource
): Promise<string> => {
    if (lat === null || lng === null) {
        return 'Localisation non capturee';
    }

    const coords = `${formatCoordinate(lat, 'N', 'S')} · ${formatCoordinate(lng, 'E', 'W')}`;
    
    if (source === 'demo') {
        return `Coordonnees demo ${coords}`;
    }

    // Try Nominatim for real address
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        
        const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=fr`,
            { 
                headers: { Accept: 'application/json' },
                signal: controller.signal
            }
        );
        
        clearTimeout(timeout);
        
        if (res.ok) {
            const data = await res.json();
            if (data.display_name) {
                // Format: street, city, postcode, country
                const parts = data.display_name.split(', ');
                // Take first 3-4 parts for a cleaner address
                const shortAddress = parts.slice(0, 4).join(', ');
                return shortAddress;
            }
        }
    } catch (err) {
        console.log('Nominatim failed, using coordinates');
    }

    return coords;
};

// Cache for geocoding results (avoid hitting API too much)
const addressCache = new Map<string, string>();

export const getAddressCached = async (
    lat: number | null,
    lng: number | null,
    source?: LocationSource
): Promise<string> => {
    if (lat === null || lng === null) {
        return 'Localisation non capturee';
    }
    
    const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    if (addressCache.has(key)) {
        return addressCache.get(key)!;
    }
    
    const address = await getAddress(lat, lng, source);
    addressCache.set(key, address);
    return address;
};
