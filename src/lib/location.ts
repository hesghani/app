import * as Location from 'expo-location';

import { nearestCity } from '@/data/cities';
import type { Place } from './model';
import { deviceTimeZone } from './time';

/** Asks for location once and names it after the nearest known city. Nothing is sent anywhere. */
export async function currentPlace(): Promise<{ place: Place } | { error: string }> {
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) return { error: 'Location is off for Mizan. Pick your city instead.' };
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const lat = +pos.coords.latitude.toFixed(4);
    const lng = +pos.coords.longitude.toFixed(4);
    const { city, km } = nearestCity(lat, lng);
    return {
      place: {
        name: km < 40 ? city.name : km < 150 ? `Near ${city.name}` : 'Current location',
        country: km < 150 ? city.country : '',
        lat,
        lng,
        tz: deviceTimeZone(),
      },
    };
  } catch {
    return { error: 'Couldn’t get your location. Pick your city instead.' };
  }
}
