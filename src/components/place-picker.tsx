import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Divider, Field, Row, T } from '@/components/ui';
import { CITIES, citiesInZone, searchCities, type City } from '@/data/cities';
import { currentPlace } from '@/lib/location';
import type { Place } from '@/lib/model';
import { deviceTimeZone } from '@/lib/time';
import { useTheme } from '@/theme';

/** GPS in one tap, or a built-in city list that works offline. */
export function PlacePicker({ onPick }: { onPick: (p: Place) => void }) {
  const c = useTheme();
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const near = citiesInZone(deviceTimeZone()).slice(0, 5);
  const list: City[] = query.trim() ? searchCities(query) : near.length ? near : CITIES.slice(0, 5);

  return (
    <View style={{ gap: 14 }}>
      <Button
        label={busy ? 'Finding you…' : 'Use my location'}
        icon="locate"
        disabled={busy}
        onPress={async () => {
          setBusy(true);
          setError(null);
          const res = await currentPlace();
          setBusy(false);
          if ('place' in res) onPick(res.place);
          else setError(res.error);
        }}
      />
      {error ? (
        <T variant="small" color={c.danger}>
          {error}
        </T>
      ) : null}
      <Field label={query || !near.length ? 'Search a city' : 'Or pick a city near you'} value={query} onChangeText={setQuery} placeholder="City or country" autoCorrect={false} />
      <View>
        {list.length ? (
          list.map((city, i) => (
            <View key={`${city.name}-${city.country}`}>
              {i > 0 ? <Divider /> : null}
              <Row
                accessibilityRole="button"
                onPress={() => onPick({ name: city.name, country: city.country, lat: city.lat, lng: city.lng, tz: city.tz })}
                style={styles.city}>
                <T variant="body" style={{ flex: 1, fontWeight: '600' }}>
                  {city.name}
                </T>
                <T variant="small" color={c.muted}>
                  {city.country}
                </T>
              </Row>
            </View>
          ))
        ) : (
          <T variant="small" color={c.muted}>
            Not in the built-in list yet. Use your location instead.
          </T>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  city: { paddingVertical: 13 },
});
