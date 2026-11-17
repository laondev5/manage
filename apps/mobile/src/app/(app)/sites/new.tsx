import { useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { api, messageOf } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  Button,
  Card,
  ErrorNote,
  Field,
  Header,
  Input,
  Notice,
  Screen,
  SectionTitle,
} from '@/components/ui';
import { IconCheck, IconInfo, IconPin } from '@/components/icons';

const deviceTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Lagos';
  } catch {
    return 'Africa/Lagos';
  }
};

export default function NewSiteScreen() {
  const router = useRouter();
  const { me } = useAuth();
  const organizationId =
    me?.activeOrganizationId ??
    me?.memberships.find((membership) => membership.role === 'SITE_OWNER')?.organizationId ??
    me?.memberships[0]?.organizationId ??
    '';

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [timezone, setTimezone] = useState(deviceTimezone);
  const [radius, setRadius] = useState('150');
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fillFromDevice = async () => {
    setLocating(true);
    setError(null);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setError('Location permission was not granted. Enter the coordinates manually.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLatitude(position.coords.latitude.toFixed(6));
      setLongitude(position.coords.longitude.toFixed(6));
    } catch {
      setError('The device location could not be read. Enter the coordinates manually.');
    } finally {
      setLocating(false);
    }
  };

  const submit = async () => {
    setError(null);
    const lat = Number(latitude);
    const lng = Number(longitude);
    const radiusMeters = Number(radius);
    if (!organizationId) {
      setError('No organization is active for this account. Switch organization and try again.');
      return;
    }
    if (name.trim().length < 2) {
      setError('Enter a site name of at least two characters.');
      return;
    }
    if (address.trim().length < 4) {
      setError('Enter the site address.');
      return;
    }
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      setError('Latitude must be between -90 and 90.');
      return;
    }
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      setError('Longitude must be between -180 and 180.');
      return;
    }
    if (!Number.isFinite(radiusMeters) || radiusMeters < 50 || radiusMeters > 2000) {
      setError('Use a presence radius between 50 and 2,000 metres.');
      return;
    }
    setBusy(true);
    try {
      const site = await api.createSite({
        organizationId,
        name: name.trim(),
        address: address.trim(),
        latitude: lat,
        longitude: lng,
        timezone: timezone.trim(),
        policy: { radiusMeters: Math.round(radiusMeters) },
      });
      router.replace(`/sites/${site.id}`);
    } catch (cause) {
      setError(messageOf(cause, 'The site could not be created.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Header
        eyebrow="New site"
        title="Create a worksite"
        subtitle="New clock-ins use this boundary policy from the first shift."
        onBack={() => router.back()}
      />

      <View className="px-5 pt-4">
        {error ? <ErrorNote message={error} /> : null}

        <SectionTitle>Site details</SectionTitle>
        <Card className="p-4">
          <Field label="Site name">
            <Input value={name} onChangeText={setName} placeholder="Ikeja distribution centre" maxLength={120} />
          </Field>
          <Field label="Address">
            <Input
              value={address}
              onChangeText={setAddress}
              placeholder="12 Kudirat Abiola Way, Lagos"
              maxLength={300}
            />
          </Field>
          <Field label="Timezone" hint="IANA name. Defaults to this device's timezone.">
            <Input value={timezone} onChangeText={setTimezone} autoCapitalize="none" autoCorrect={false} />
          </Field>
        </Card>

        <SectionTitle
          right={
            <Button
              label={locating ? 'Locating…' : 'Use my location'}
              variant="secondary"
              onPress={() => void fillFromDevice()}
              loading={locating}
              icon={<IconPin size={14} color="#2457D6" />}
            />
          }
        >
          Site centre
        </SectionTitle>
        <Card className="p-4">
          <Field label="Latitude" hint="Decimal degrees, for example 6.601840.">
            <Input
              value={latitude}
              onChangeText={setLatitude}
              placeholder="6.601840"
              keyboardType="numbers-and-punctuation"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </Field>
          <Field label="Longitude" hint="Decimal degrees, for example 3.351480.">
            <Input
              value={longitude}
              onChangeText={setLongitude}
              placeholder="3.351480"
              keyboardType="numbers-and-punctuation"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </Field>
          <Field
            label="Presence radius"
            hint="50–2,000 m. Staff outside this radius after the grace period can raise a departure alert."
          >
            <Input value={radius} onChangeText={setRadius} keyboardType="number-pad" maxLength={4} />
          </Field>
        </Card>

        <View className="mt-3 flex-row items-start gap-2">
          <IconInfo size={13} />
          <Text className="flex-1 text-[11px] leading-4 text-faint">
            You can fine-tune buffers, grace and accuracy limits from the site settings after creating it. Changes
            are versioned and never rewrite recorded attendance.
          </Text>
        </View>

        <View className="mt-5">
          <Button
            label="Create site"
            onPress={() => void submit()}
            loading={busy}
            disabled={busy}
            icon={<IconCheck size={16} color="#FFFFFF" />}
          />
        </View>

        <View className="mt-4">
          <Notice>Staff are added by invitation only. Nobody can assign themselves to a site.</Notice>
        </View>
      </View>
    </Screen>
  );
}
