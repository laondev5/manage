import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ReportSummary } from '@manage/contracts';
import { api, messageOf } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApiResource } from '@/lib/hooks';
import { formatDate, formatDateTime, relativeTime } from '@/lib/format';
import {
  Badge,
  Button,
  Card,
  ErrorNote,
  Field,
  Header,
  IconTile,
  Input,
  KeyValue,
  Loading,
  Notice,
  Screen,
  SectionTitle,
  shadowSoft,
} from '@/components/ui';
import { IconInfo, IconRefresh, IconScroll, IconX } from '@/components/icons';

export default function ReportDetailScreen() {
  const router = useRouter();
  const { me } = useAuth();
  const { reportId } = useLocalSearchParams<{ reportId: string }>();
  const id = typeof reportId === 'string' ? reportId : '';
  const resource = useApiResource<ReportSummary>(() => api.report(id), [id]);
  const report = resource.data;

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!report) return;
    setTitle(report.title);
    setBody(report.body);
  }, [report]);

  if (resource.loading && !report) {
    return (
      <Screen>
        <Header title="Report" onBack={() => router.back()} />
        <Loading label="Loading the report" />
      </Screen>
    );
  }

  if (resource.error && !report) {
    return (
      <Screen>
        <Header title="Report" onBack={() => router.back()} />
        <View className="px-5 pt-4">
          <ErrorNote message={resource.error} onRetry={resource.reload} />
        </View>
      </Screen>
    );
  }

  if (!report) return null;

  const mine = me?.user.id === report.authorId;

  const save = async () => {
    setError(null);
    if (title.trim().length < 3) {
      setError('Give the report a title of at least three characters.');
      return;
    }
    if (!body.trim()) {
      setError('The report cannot be empty.');
      return;
    }
    setBusy(true);
    try {
      await api.updateReport(report.id, {
        title: title.trim(),
        body: body.trim(),
        version: report.version,
      });
      setEditing(false);
      resource.reload();
    } catch (cause) {
      setError(messageOf(cause, 'The report could not be updated.'));
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    Alert.alert('Delete this report?', 'It disappears from every list. This cannot be undone in the app.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          setError(null);
          try {
            await api.deleteReport(report.id);
            router.back();
          } catch (cause) {
            setError(messageOf(cause, 'The report could not be deleted.'));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  return (
    <Screen refreshing={resource.refreshing} onRefresh={resource.refresh}>
      <Header
        eyebrow={report.kind === 'INSPECTION' ? 'Inspection report' : 'Report'}
        title={editing ? 'Edit report' : 'Report'}
        subtitle={formatDate(report.reportDate)}
        onBack={() => router.back()}
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Refresh report"
            onPress={resource.refresh}
            hitSlop={10}
            className="h-10 w-10 items-center justify-center rounded-full bg-white"
            style={shadowSoft}
          >
            <IconRefresh size={17} color="#14213D" />
          </Pressable>
        }
      />

      <View className="px-5 pt-4">
        {error ? <ErrorNote message={error} /> : null}

        {editing ? (
          <>
            <Card className="p-4">
              <Field label="Title">
                <Input value={title} onChangeText={setTitle} maxLength={140} />
              </Field>
              <Field label="Report" hint="Editing creates a new version; the previous text stays in the audit trail.">
                <Input
                  value={body}
                  onChangeText={setBody}
                  multiline
                  maxLength={10000}
                  style={{ height: 220, textAlignVertical: 'top', paddingTop: 12 }}
                />
              </Field>
            </Card>
            <View className="mt-4 flex-row gap-2">
              <View className="flex-1">
                <Button
                  label="Cancel"
                  variant="secondary"
                  onPress={() => {
                    setEditing(false);
                    setTitle(report.title);
                    setBody(report.body);
                    setError(null);
                  }}
                  disabled={busy}
                />
              </View>
              <View className="flex-1">
                <Button label="Save changes" onPress={() => void save()} loading={busy} disabled={busy} />
              </View>
            </View>
          </>
        ) : (
          <>
            <Card className="p-5">
              <View className="flex-row items-start gap-3">
                <IconTile tone={report.kind === 'INSPECTION' ? 'canvas' : 'blue'}>
                  <IconScroll size={18} color={report.kind === 'INSPECTION' ? '#526078' : '#2457D6'} />
                </IconTile>
                <View className="flex-1">
                  <Text className="text-[19px] font-bold leading-6 tracking-[-0.3px] text-ink">{report.title}</Text>
                  <Text className="mt-1 text-[12px] text-muted">
                    {report.authorName} · {formatDate(report.reportDate)}
                  </Text>
                  <View className="mt-2.5 flex-row flex-wrap items-center gap-1.5">
                    {report.kind === 'INSPECTION' ? <Badge tone="amber">Inspection</Badge> : null}
                    <Badge tone="slate">{report.siteName ?? 'General team'}</Badge>
                    <Badge tone="slate">v{report.version}</Badge>
                    {mine ? <Badge tone="blue">Yours</Badge> : null}
                  </View>
                </View>
              </View>
              <Text className="mt-4 text-[13.5px] leading-6 text-ink">{report.body}</Text>
            </Card>

            <SectionTitle>Record</SectionTitle>
            <Card className="p-4">
              <KeyValue label="Written" value={relativeTime(report.createdAt)} />
              <KeyValue label="Last updated" value={formatDateTime(report.updatedAt)} />
              <KeyValue label="Scope" value={report.siteName ?? 'General team'} />
            </Card>

            {mine ? (
              <>
                <SectionTitle>Manage</SectionTitle>
                <Card className="p-4">
                  <Text className="text-[12.5px] leading-5 text-muted">
                    You can edit or delete this report. Deleting hides it from every list; the audit trail keeps a
                    record that it existed.
                  </Text>
                  <View className="mt-3 gap-2">
                    <Button
                      label="Edit report"
                      variant="secondary"
                      onPress={() => {
                        setEditing(true);
                        setError(null);
                      }}
                      disabled={busy}
                    />
                    <Button
                      label="Delete report"
                      variant="danger"
                      onPress={remove}
                      loading={busy}
                      disabled={busy}
                      icon={<IconX size={16} color="#B42318" />}
                    />
                  </View>
                </Card>
              </>
            ) : (
              <View className="mt-4">
                <Notice>Only {report.authorName} can edit or delete this report.</Notice>
              </View>
            )}

            <View className="mt-4 flex-row items-start gap-2">
              <IconInfo size={13} />
              <Text className="flex-1 text-[11px] leading-4 text-faint">
                Reports are append-only versions. Owners can read every report in the organization.
              </Text>
            </View>
          </>
        )}
      </View>
    </Screen>
  );
}
