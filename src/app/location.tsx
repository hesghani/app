import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { PlacePicker } from '@/components/place-picker';
import { toast } from '@/components/toast';
import { SheetHeader, T } from '@/components/ui';
import { useStore } from '@/store/store';
import { useTheme } from '@/theme';

export default function LocationScreen() {
  const c = useTheme();
  const loc = useStore((s) => s.settings.loc);
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <SheetHeader title="Location" />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <T variant="small" color={c.muted}>
          {loc ? `Now: ${loc.name}. ` : ''}Used only on this phone, to calculate prayer times and the Qibla.
        </T>
        <PlacePicker
          onPick={(place) => {
            useStore.getState().updateSettings({ loc: place });
            toast(`Prayer times set for ${place.name}.`);
            router.back();
          }}
        />
      </ScrollView>
    </View>
  );
}
