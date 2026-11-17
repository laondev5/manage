import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { SiteSummary } from '@manage/contracts';
import { api, messageOf } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApiResource } from '@/lib/hooks';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorNote,
  Field,
  Header,
  Input,
  Notice,
  Screen,
  SectionTitle,
} from '@/components/ui';
import { IconCheck, IconInfo, IconScroll } from '@/components/icons';

type ReportTarget = { key: string; siteId: string | null; name: string; detail: string };

export default function NewReportScreen() {
  const router = useRouter();
  const { me, hasCapability } = useAuth();
  const { siteId: siteIdParam } = useLocalSearchParams<{ siteId?: string }>();
  const isStaff = hasCapability('staff.today');
  const isOwner = hasCapability('owner.reports');
  const resource = useApiResource<SiteSummary[]>(() => api.sites('current'), []);
  const sites = useMemo(() => resource.data ?? [], [resource.data]);

  const targets = useMemo<ReportTarget[]>(() => {
    if (isStaff) {
      return [
        { key: 'general', siteId: null, name: 'General team', detail: 'Not tied to a single site' },
        ...sites.map((site) => ({
          key: site.id,
          siteId: site.id,
          name: site.name,
          detail: site.address,
        })),
      ];
    }
    if (!isOwner || !me) return [];
    return sites
      .filter((site) => site.inspectorId === me.user.id)
      .map((site) => ({
        key: site.id,
        siteId: site.id,
        name: site.name,
        detail: site.address,
      }));
  }, [isStaff, isOwner, me, sites]);

  const [selectedKey, setSelectedKey] = useState<string | null>(
    typeof siteIdParam === 'string' ? siteIdParam : isStaff ? 'general' : null,
  );
  const selected =
    targets.find((target) => target.key === selectedKey) ??
    targets.find((target) => target.siteId === siteIdParam) ??
    null;
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isStaff && !isOwner) {
    return (
      <Screen>
        <Header title="New report" onBack={() => router.back()} />
        <View className="px-5 pt-4">
          <Card>
            <EmptyState
              icon={<IconScroll size={20} />}
              title="Reports are not available"
              body="Staff write reports. Ask a site owner if you need access."
            />
          </Card>
        </View>
      </Screen>
    );
  }

  const submit = async () => {
    setError(null);
    if (!selected) {
      setError('Choose where this report belongs.');
      return;
    }
    if (title.trim().length < 3) {
      setError('Give the report a title of at least three characters.');
      return;
    }
    if (!body.trim()) {
      setError('Write what happened before submitting.');
      return;
    }
    setBusy(true);
    try {
      const report = await api.createReport({
        title: title.trim(),
        body: body.trim(),
        ...(selected.siteId ? { siteId: selected.siteId } : {}),
      });
      router.replace(`/reports/${report.id}`);
    } catch (cause) {
      setError(messageOf(cause, 'The report could not be saved.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Header
        eyebrow={isStaff ? 'Your notes' : 'Inspection'}
        title="Write a report"
        subtitle={
          isStaff
            ? 'Saved to your organization for site owners to read.'
            : 'Only sites where you are the inspector are listed.'
        }
        onBack={() => router.back()}
      />

      <View className="px-5 pt-4">
        {error ? <ErrorNote message={error} /> : null}

        <SectionTitle>Report about</SectionTitle>
        <Card className="p-4">
          {targets.length ? (
            <View className="gap-2">
              {targets.map((target) => {
                const active = selected?.key === target.key;
                return (
                  <Pressable
                    key={target.key}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    onPress={() => setSelectedKey(target.key)}
                    className={`rounded-[14px] border px-3.5 py-3 ${
                      active ? 'border-cobalt bg-cobalt-soft' : 'border-line bg-white'
                    }`}
                  >
                    <View className="flex-row items-center justify-between gap-3">
                      <View className="flex-1">
                        <Text className="text-[13.5px] font-semibold text-ink">{target.name}</Text>
                        <Text className="mt-0.5 text-[11.5px] leading-4 text-muted" numberOfLines={1}>
                          {target.detail}
                        </Text>
                      </View>
                      {active ? <IconCheck size={16} color="#2457D6" /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <Text className="text-[12.5px] leading-5 text-muted">
              {resource.loading
                ? 'Loading your sites…'
                : isOwner
                  ? 'You are not the inspector for any active site yet. Open a site and choose “Inspect this site myself”, then come back.'
                  : 'You are not assigned to an active site yet. You can still write a general team report once the list loads.'}
            </Text>
          )}
        </Card>

        <SectionTitle>Details</SectionTitle>
        <Card className="p-4">
          <Field label="Title" hint="A short summary, for example “Damaged pallets on the loading dock”.">
            <Input
              value={title}
              onChangeText={setTitle}
              placeholder="What is this report about?"
              maxLength={140}
            />
          </Field>
          <Field label="Report" hint="Facts, times and anything the owner should follow up.">
            <Input
              value={body}
              onChangeText={setBody}
              placeholder="Describe what happened…"
              multiline
              maxLength={10000}
              style={{ height: 160, textAlignVertical: 'top', paddingTop: 12 }}
            />
          </Field>
          <View className="flex-row items-center gap-1.5">
            <Badge tone="slate">{body.trim().length} / 10,000 characters</Badge>
          </View>
        </Card>

        <View className="mt-5">
          <Button
            label={selected?.siteId && !isStaff ? 'Submit inspection report' : 'Submit report'}
            onPress={() => void submit()}
            loading={busy}
            disabled={busy || !targets.length}
            icon={<IconCheck size={16} color="#FFFFFF" />}
          />
        </View>

        <View className="mt-4 flex-row items-start gap-2">
          <IconInfo size={13} />
          <Text className="flex-1 text-[11px] leading-4 text-faint">
            Reports are versioned. Owners and the author can read them; only the author can edit or delete.
          </Text>
        </View>

        {isOwner ? (
          <View className="mt-4">
            <Notice>
              Inspection reports written by an owner are labelled “Inspection” so the team can tell them apart from
              staff notes.
            </Notice>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}
