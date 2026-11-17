import { useCallback, useState } from 'react';
import { Alert, Pressable, Share, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type {
  InvitationSummary,
  RosterEntry,
  SiteDetail,
  SiteReview,
  SiteReviewList,
} from '@manage/contracts';
import { ApiClientError, type MemberCandidate as Candidate } from '@manage/api-client';
import { api, messageOf } from '@/lib/api';
import { WEB_URL } from '@/lib/config';
import { useAuth } from '@/lib/auth';
import { useApiResource } from '@/lib/hooks';
import { formatClock, formatDate, formatDateTime, relativeTime } from '@/lib/format';
import { presenceBadge } from '@/components/status';
import { SiteMap } from '@/components/site-map';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Divider,
  EmptyState,
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
  Segmented,
  shadowSoft,
} from '@/components/ui';
import {
  IconAlert,
  IconBuilding,
  IconCheck,
  IconClock,
  IconInfo,
  IconMail,
  IconPin,
  IconRefresh,
  IconScroll,
  IconUsers,
  IconX,
} from '@/components/icons';

type Tab = 'staff' | 'invitations' | 'reviews' | 'settings';

type SiteData = {
  site: SiteDetail;
  roster: RosterEntry[];
  invitations: InvitationSummary[];
};

const STATUS_TONE: Record<InvitationSummary['status'], 'amber' | 'blue' | 'slate' | 'red'> = {
  PENDING: 'amber',
  ACCEPTED: 'blue',
  EXPIRED: 'slate',
  REVOKED: 'red',
};

export default function SiteDetailScreen() {
  const { hasCapability } = useAuth();
  const { siteId } = useLocalSearchParams<{ siteId: string }>();
  const id = typeof siteId === 'string' ? siteId : '';

  if (!hasCapability('owner.sites')) {
    if (hasCapability('staff.today')) return <StaffSiteDetail siteId={id} />;
    return (
      <Screen>
        <Header title="Site" />
        <View className="p-4">
          <Card>
            <EmptyState
              icon={<IconBuilding size={20} />}
              title="Sites are for site owners"
              body="Your account cannot open worksites. Ask a site owner if you need access."
            />
          </Card>
        </View>
      </Screen>
    );
  }

  return <OwnerSiteDetail id={id} />;
}

function OwnerSiteDetail({ id }: { id: string }) {
  const router = useRouter();
  const { me } = useAuth();
  const resource = useApiResource<SiteData>(async () => {
    const [site, roster, invitations] = await Promise.all([
      api.site(id),
      api.roster(id),
      api.invitations(id),
    ]);
    return { site, roster, invitations };
  }, [id]);
  const [tab, setTab] = useState<Tab>('staff');
  const [actionError, setActionError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [lifecycleBusy, setLifecycleBusy] = useState<'archive' | 'restore' | 'delete' | null>(null);

  if (resource.loading && !resource.data) {
    return (
      <Screen>
        <Header title="Site" onBack={() => router.back()} />
        <Loading label="Loading the site" />
      </Screen>
    );
  }

  if (resource.error && !resource.data) {
    return (
      <Screen>
        <Header title="Site" onBack={() => router.back()} />
        <View className="p-5">
          <ErrorNote message={resource.error} onRetry={resource.reload} />
        </View>
      </Screen>
    );
  }

  const { site, roster, invitations } = resource.data as SiteData;
  const onSite = roster.filter((entry) => entry.presence === 'INSIDE').length;
  const pendingInvites = invitations.filter((entry) => entry.status === 'PENDING');
  const archived = Boolean(site.archivedAt) || site.status === 'INACTIVE';

  const changeLifecycle = (action: 'archive' | 'restore' | 'delete') => {
    const copy =
      action === 'delete'
        ? {
            title: 'Delete this site?',
            body: 'The site disappears from your lists. Attendance records and audit entries stay readable for reporting. This cannot be undone from the app.',
            confirm: 'Delete',
          }
        : action === 'archive'
          ? {
              title: 'Archive this site?',
              body: 'Staff can no longer clock in here. The site moves to Previous sites and can be restored later.',
              confirm: 'Archive',
            }
          : {
              title: 'Restore this site?',
              body: 'The site becomes active again and appears in your current sites. Staff assignments are not recreated automatically.',
              confirm: 'Restore',
            };
    Alert.alert(copy.title, copy.body, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: copy.confirm,
        style: action === 'delete' ? 'destructive' : 'default',
        onPress: async () => {
          setLifecycleBusy(action);
          setActionError(null);
          setSaved(null);
          try {
            await api.siteLifecycle(site.id, { action, version: site.version });
            if (action === 'delete') {
              router.back();
              return;
            }
            setSaved(
              action === 'archive'
                ? `${site.name} is archived. It now appears under Previous sites.`
                : `${site.name} is active again.`,
            );
            resource.reload();
          } catch (cause) {
            setActionError(messageOf(cause, 'The site could not be updated.'));
          } finally {
            setLifecycleBusy(null);
          }
        },
      },
    ]);
  };

  return (
    <Screen refreshing={resource.refreshing} onRefresh={resource.refresh}>
      <Header
        eyebrow={archived ? 'Previous site' : 'Workspace'}
        title={site.name}
        subtitle={site.address}
        onBack={() => router.back()}
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Refresh site"
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
        {actionError ? <ErrorNote message={actionError} /> : null}
        {saved ? <Notice tone="success">{saved}</Notice> : null}

        <Card className="mb-4 p-5">
          <View className="flex-row items-center gap-3">
            <IconTile tone="blue">
              <IconBuilding size={18} color="#2457D6" />
            </IconTile>
            <View className="flex-1">
              <Text className="text-[13.5px] font-semibold text-ink">
                {onSite} of {roster.length} staff on site now
              </Text>
              <Text className="mt-0.5 text-[11.5px] text-muted">
                {site.radiusMeters} m radius · {site.timezone}
              </Text>
            </View>
            <Badge tone={archived ? 'slate' : 'blue'}>{archived ? 'Archived' : 'Active'}</Badge>
          </View>
        </Card>

        <SectionTitle>Location</SectionTitle>
        <Card className="mb-4 overflow-hidden p-3">
          <SiteMap
            latitude={site.latitude}
            longitude={site.longitude}
            radiusMeters={site.radiusMeters}
            name={site.name}
          />
          <View className="mt-2.5 flex-row items-start gap-1.5 px-0.5">
            <IconInfo size={12} />
            <Text className="flex-1 text-[11px] leading-4 text-faint">
              Map data © OpenStreetMap contributors. The circle is the site boundary; staff locations are never
              shown on this map.
            </Text>
          </View>
        </Card>

        {archived ? (
          <View className="mb-4">
            <Notice tone="warn">
              This site is archived. Existing records stay readable, but staff cannot clock in until it is restored.
            </Notice>
          </View>
        ) : null}

        <InspectorCard
          site={site}
          roster={roster}
          viewerId={me?.user.id ?? ''}
          onChanged={resource.reload}
          setSaved={setSaved}
          setError={setActionError}
        />

        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'staff', label: 'Staff' },
            { value: 'invitations', label: `Invites${pendingInvites.length ? ` (${pendingInvites.length})` : ''}` },
            { value: 'reviews', label: 'Reviews' },
            { value: 'settings', label: 'Settings' },
          ]}
        />

        {tab === 'staff' ? (
          <StaffTab roster={roster} site={site} onChanged={resource.reload} setSaved={setSaved} />
        ) : null}
        {tab === 'invitations' ? (
          <InvitationsTab
            site={site}
            invitations={invitations}
            onChanged={resource.reload}
            setError={setActionError}
            setSaved={setSaved}
          />
        ) : null}
        {tab === 'reviews' ? <ReviewsTab siteId={site.id} /> : null}
        {tab === 'settings' ? (
          <SiteSettings
            key={`${site.id}-${site.version}`}
            site={site}
            onSaved={(message) => {
              setSaved(message);
              resource.reload();
            }}
            setError={setActionError}
          />
        ) : null}

        <SectionTitle>Site lifecycle</SectionTitle>
        <Card className="p-4">
          {archived ? (
            <>
              <Text className="text-[12.5px] leading-5 text-muted">
                Restore this site to make it active again. Staff must be assigned again if the roster changed.
              </Text>
              <View className="mt-3">
                <Button
                  label="Restore site"
                  onPress={() => changeLifecycle('restore')}
                  loading={lifecycleBusy === 'restore'}
                  disabled={lifecycleBusy !== null}
                  icon={<IconCheck size={16} color="#FFFFFF" />}
                />
              </View>
            </>
          ) : (
            <>
              <Text className="text-[12.5px] leading-5 text-muted">
                Archiving hides the site from staff clock-in and moves it to Previous sites. Deleting hides it from
                your lists while keeping attendance records readable.
              </Text>
              <View className="mt-3 gap-2">
                <Button
                  label="Archive site"
                  variant="secondary"
                  onPress={() => changeLifecycle('archive')}
                  loading={lifecycleBusy === 'archive'}
                  disabled={lifecycleBusy !== null}
                />
                <Button
                  label="Delete site"
                  variant="danger"
                  onPress={() => changeLifecycle('delete')}
                  loading={lifecycleBusy === 'delete'}
                  disabled={lifecycleBusy !== null}
                  icon={<IconX size={16} color="#B42318" />}
                />
              </View>
            </>
          )}
          <Text className="mt-3 text-[11px] leading-4 text-faint">
            Attendance is append-only. Deleting a site never erases recorded shifts or the audit trail.
          </Text>
        </Card>
      </View>
    </Screen>
  );
}

function StaffSiteDetail({ siteId }: { siteId: string }) {
  const router = useRouter();
  const resource = useApiResource<{ site: SiteDetail; reviews: SiteReviewList }>(async () => {
    const [site, reviews] = await Promise.all([api.site(siteId), api.siteReviews(siteId)]);
    return { site, reviews };
  }, [siteId]);
  const [acceptBusy, setAcceptBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [editing, setEditing] = useState(false);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  if (resource.loading && !resource.data) {
    return (
      <Screen>
        <Header title="Site" onBack={() => router.back()} />
        <Loading label="Loading the site" />
      </Screen>
    );
  }

  if (resource.error && !resource.data) {
    return (
      <Screen>
        <Header title="Site" onBack={() => router.back()} />
        <View className="px-5 pt-4">
          <ErrorNote message={resource.error} onRetry={resource.reload} />
        </View>
      </Screen>
    );
  }

  const { site, reviews } = resource.data as { site: SiteDetail; reviews: SiteReviewList };
  const archived = Boolean(site.archivedAt) || site.status === 'INACTIVE';
  const accepted = site.assignmentAcceptedAt !== null;
  const mine = reviews.mine;

  const accept = async () => {
    setAcceptBusy(true);
    setActionError(null);
    setSaved(null);
    try {
      await api.acceptAssignment(site.id);
      setSaved('Assignment accepted. You can clock in from the Today tab.');
      resource.reload();
    } catch (cause) {
      setActionError(messageOf(cause, 'The assignment could not be accepted.'));
    } finally {
      setAcceptBusy(false);
    }
  };

  const startEditing = (review: SiteReview) => {
    setRating(review.rating);
    setComment(review.comment);
    setEditing(true);
    setReviewError(null);
  };

  const submitReview = async () => {
    setReviewError(null);
    if (comment.trim().length < 3) {
      setReviewError('Add a short comment of at least three characters.');
      return;
    }
    setReviewBusy(true);
    try {
      if (mine) {
        await api.updateReview(site.id, mine.id, {
          rating,
          comment: comment.trim(),
          version: mine.version,
        });
      } else {
        await api.createReview(site.id, { rating, comment: comment.trim() });
      }
      setEditing(false);
      setComment('');
      setRating(5);
      resource.reload();
    } catch (cause) {
      setReviewError(messageOf(cause, 'The review could not be saved.'));
    } finally {
      setReviewBusy(false);
    }
  };

  const removeReview = (review: SiteReview) => {
    Alert.alert('Delete your review?', 'Your rating and comment are removed from this site.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setReviewBusy(true);
          setReviewError(null);
          try {
            await api.deleteReview(site.id, review.id);
            setEditing(false);
            resource.reload();
          } catch (cause) {
            setReviewError(messageOf(cause, 'The review could not be deleted.'));
          } finally {
            setReviewBusy(false);
          }
        },
      },
    ]);
  };

  const others = reviews.reviews.filter((review) => !review.mine);

  return (
    <Screen refreshing={resource.refreshing} onRefresh={resource.refresh}>
      <Header
        eyebrow="Your worksite"
        title={site.name}
        subtitle={site.address}
        onBack={() => router.back()}
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Refresh site"
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
        {actionError ? <ErrorNote message={actionError} /> : null}
        {saved ? <Notice tone="success">{saved}</Notice> : null}

        <Card className="mb-4 p-5">
          <View className="flex-row items-center gap-3">
            <IconTile tone={archived ? 'canvas' : 'blue'}>
              <IconBuilding size={18} color={archived ? '#526078' : '#2457D6'} />
            </IconTile>
            <View className="flex-1">
              <Text className="text-[13.5px] font-semibold text-ink">
                {site.teamLeadName ? `Site lead · ${site.teamLeadName}` : 'No site lead assigned'}
              </Text>
              <Text className="mt-0.5 text-[11.5px] text-muted">
                {site.radiusMeters} m radius · {site.timezone}
              </Text>
            </View>
            <Badge tone={archived ? 'slate' : accepted ? 'blue' : 'amber'}>
              {archived ? 'Archived' : accepted ? 'Accepted' : 'Accept first'}
            </Badge>
          </View>
        </Card>

        {!accepted ? (
          <Card className="mb-4 p-5">
            <View className="flex-row items-start gap-3">
              <View className="h-10 w-10 items-center justify-center rounded-xl bg-amber-soft">
                <IconAlert size={18} />
              </View>
              <View className="flex-1">
                <Text className="text-[15px] font-bold text-ink">Accept your site assignment</Text>
                <Text className="mt-1 text-[12.5px] leading-5 text-muted">
                  An owner assigned you to {site.name}. Accepting confirms the site, address and boundary before you
                  can clock in.
                </Text>
                <View className="mt-3">
                  <Button
                    label="Accept assignment"
                    onPress={() => void accept()}
                    loading={acceptBusy}
                    disabled={acceptBusy}
                    icon={<IconCheck size={16} color="#FFFFFF" />}
                  />
                </View>
              </View>
            </View>
          </Card>
        ) : (
          <Card className="mb-4 p-4">
            <View className="flex-row items-start gap-2">
              <IconCheck size={14} color="#2457D6" />
              <Text className="flex-1 text-[12px] leading-4 text-muted">
                Assignment accepted{site.assignmentAcceptedAt ? ` ${relativeTime(site.assignmentAcceptedAt)}` : ''}.
                Clock in and out from the Today tab so your location is checked at the site.
              </Text>
            </View>
          </Card>
        )}

        <SectionTitle>Location</SectionTitle>
        <Card className="mb-4 overflow-hidden p-3">
          <SiteMap
            latitude={site.latitude}
            longitude={site.longitude}
            radiusMeters={site.radiusMeters}
            name={site.name}
          />
          <View className="mt-2.5 flex-row items-start gap-1.5 px-0.5">
            <IconInfo size={12} />
            <Text className="flex-1 text-[11px] leading-4 text-faint">
              Map data © OpenStreetMap contributors. The circle is the site boundary; your live location is only
              used to confirm attendance.
            </Text>
          </View>
        </Card>

        <SectionTitle>Site details</SectionTitle>
        <Card className="mb-4 p-4">
          <KeyValue label="Address" value={site.address} />
          <KeyValue label="Presence radius" value={`${site.radiusMeters} m`} />
          <KeyValue label="Timezone" value={site.timezone} />
          <KeyValue
            label="Shift window"
            value={
              site.expectedHours ? `${site.expectedHours.start} – ${site.expectedHours.end}` : 'Flexible'
            }
          />
          <KeyValue label="Site lead" value={site.teamLeadName ?? 'Not assigned'} />
          <KeyValue label="Inspector" value={site.inspectorName ?? 'Not assigned'} />
          <KeyValue label="Status" value={archived ? 'Archived' : 'Active'} />
        </Card>

        <SectionTitle>Attendance</SectionTitle>
        <Card className="mb-4 p-4">
          <Text className="text-[12.5px] leading-5 text-muted">
            {archived
              ? 'This site is archived. Existing shifts stay readable, but clock-in is unavailable until an owner restores it.'
              : 'One location reading is taken at clock-in. If GPS is weak it is flagged for review rather than guessed, and leaving the site never reduces payable time.'}
          </Text>
          <View className="mt-3 gap-2">
            <Button
              label="Open Today to clock in or out"
              onPress={() => router.push({ pathname: '/', params: { siteId: site.id } })}
              disabled={archived}
              icon={<IconClock size={16} color="#FFFFFF" />}
            />
            <Button
              label="Write a report about this site"
              variant="secondary"
              onPress={() => router.push(`/reports/new?siteId=${site.id}`)}
              icon={<IconScroll size={16} color="#2457D6" />}
            />
          </View>
        </Card>

        <SectionTitle
          right={
            <Text className="text-[11.5px] text-faint">
              {reviews.reviewCount
                ? `${reviews.averageRating} / 5 · ${reviews.reviewCount} review${reviews.reviewCount === 1 ? '' : 's'}`
                : 'No reviews yet'}
            </Text>
          }
        >
          Site reviews
        </SectionTitle>

        {mine && !editing ? (
          <Card className="mb-3 p-4">
            <View className="flex-row items-center justify-between">
              <Text className="text-[13px] font-semibold text-ink">Your review</Text>
              <RatingStars value={mine.rating} size={17} />
            </View>
            <Text className="mt-2 text-[12.5px] leading-5 text-muted">{mine.comment}</Text>
            <Text className="mt-1.5 text-[10.5px] text-faint">Updated {relativeTime(mine.updatedAt)}</Text>
            <View className="mt-3 flex-row gap-2">
              <View className="flex-1">
                <Button
                  label="Edit"
                  variant="secondary"
                  size="sm"
                  onPress={() => startEditing(mine)}
                  disabled={reviewBusy}
                />
              </View>
              <View className="flex-1">
                <Button
                  label="Delete"
                  variant="danger"
                  size="sm"
                  onPress={() => removeReview(mine)}
                  loading={reviewBusy}
                  disabled={reviewBusy}
                />
              </View>
            </View>
          </Card>
        ) : null}

        {!mine || editing ? (
          <Card className="mb-3 p-4">
            <Text className="text-[13px] font-semibold text-ink">
              {mine ? 'Edit your review' : 'Rate this site'}
            </Text>
            <Text className="mt-1 text-[11.5px] leading-4 text-muted">
              One review per person. Owners and your inspector can read it.
            </Text>
            {reviewError ? <View className="mt-3"><ErrorNote message={reviewError} /></View> : null}
            <View className="mt-3">
              <RatingStars value={rating} onChange={setRating} />
            </View>
            <View className="mt-3">
              <Field label="Comment">
                <Input
                  value={comment}
                  onChangeText={setComment}
                  placeholder="What is it like working at this site?"
                  multiline
                  maxLength={1000}
                  className={undefined}
                  style={{ height: 96, paddingTop: 12, textAlignVertical: 'top' }}
                />
              </Field>
            </View>
            <View className="mt-1 flex-row gap-2">
              {editing ? (
                <View className="flex-1">
                  <Button
                    label="Cancel"
                    variant="secondary"
                    onPress={() => {
                      setEditing(false);
                      setComment('');
                      setRating(5);
                      setReviewError(null);
                    }}
                    disabled={reviewBusy}
                  />
                </View>
              ) : null}
              <View className="flex-1">
                <Button
                  label={mine ? 'Save review' : 'Post review'}
                  onPress={() => void submitReview()}
                  loading={reviewBusy}
                  disabled={reviewBusy}
                />
              </View>
            </View>
          </Card>
        ) : null}

        {others.length ? (
          <View className="gap-2">
            {others.map((review) => (
              <Card key={review.id} className="p-4">
                <View className="flex-row items-center gap-3">
                  <Avatar name={review.memberName} size={34} />
                  <View className="flex-1">
                    <Text className="text-[13px] font-semibold text-ink">{review.memberName}</Text>
                    <Text className="text-[10.5px] text-faint">{relativeTime(review.createdAt)}</Text>
                  </View>
                  <RatingStars value={review.rating} size={15} />
                </View>
                <Text className="mt-2 text-[12.5px] leading-5 text-muted">{review.comment}</Text>
              </Card>
            ))}
          </View>
        ) : null}

        {!others.length && !mine ? (
          <Text className="mt-1 text-[11px] leading-4 text-faint">
            Reviews appear here once staff share what it is like to work at this site.
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}

function RatingStars({
  value,
  onChange,
  size = 24,
}: {
  value: number;
  onChange?: (value: number) => void;
  size?: number;
}) {
  return (
    <View className="flex-row items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => {
        const glyph = (
          <Text style={{ fontSize: size, lineHeight: size + 4, color: star <= value ? '#2457D6' : '#CBD4E2' }}>
            ★
          </Text>
        );
        return onChange ? (
          <Pressable
            key={star}
            onPress={() => onChange(star)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`${star} star${star === 1 ? '' : 's'}`}
          >
            {glyph}
          </Pressable>
        ) : (
          <View key={star}>{glyph}</View>
        );
      })}
    </View>
  );
}

function InspectorCard({
  site,
  roster,
  viewerId,
  onChanged,
  setSaved,
  setError,
}: {
  site: SiteDetail;
  roster: RosterEntry[];
  viewerId: string;
  onChanged: () => void;
  setSaved: (message: string | null) => void;
  setError: (message: string | null) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const inspectingSelf = site.inspectorId === viewerId && Boolean(viewerId);
  const staff = roster.filter((entry) => entry.role === 'STAFF');

  const assign = async (inspectorId: string | null) => {
    setBusy(inspectorId ?? 'clear');
    setError(null);
    setSaved(null);
    try {
      const result = await api.setInspector(site.id, inspectorId);
      setSaved(
        result.inspectorId
          ? result.inspectingSelf
            ? `${site.name} is now assigned to you for inspection.`
            : `${result.inspectorName ?? 'The selected staff member'} is now inspecting ${site.name}.`
          : `The inspector for ${site.name} was cleared.`,
      );
      setPicking(false);
      onChanged();
    } catch (cause) {
      setError(messageOf(cause, 'The inspector could not be updated.'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <SectionTitle
        right={
          site.inspectorId ? (
            <Text className="text-[11.5px] text-faint">
              {inspectingSelf ? 'You are inspecting' : site.inspectorName ?? 'Inspector set'}
            </Text>
          ) : (
            <Text className="text-[11.5px] text-faint">Not assigned</Text>
          )
        }
      >
        Inspection
      </SectionTitle>
      <Card className="mb-3 p-4">
        <View className="flex-row items-center gap-3">
          <IconTile tone="blue">
            <IconScroll size={18} color="#2457D6" />
          </IconTile>
          <View className="flex-1">
            <Text className="text-[13.5px] font-semibold text-ink">
              {site.inspectorName ?? 'No inspector yet'}
            </Text>
            <Text className="mt-0.5 text-[11.5px] leading-4 text-muted">
              {inspectingSelf
                ? 'You can write inspection reports for this site from Reports.'
                : site.inspectorName
                  ? 'This staff member can write inspection reports for the site.'
                  : 'Assign a staff member or inspect this site yourself.'}
            </Text>
          </View>
          {inspectingSelf ? <Badge tone="amber">You</Badge> : null}
        </View>

        <View className="mt-3 flex-row flex-wrap gap-2">
          {inspectingSelf ? (
            <Button
              label="Write inspection report"
              onPress={() => router.push(`/reports/new?siteId=${site.id}`)}
              icon={<IconScroll size={16} color="#FFFFFF" />}
            />
          ) : (
            <Button
              label="Inspect this site myself"
              variant="secondary"
              onPress={() => void assign(viewerId)}
              loading={busy === viewerId}
              disabled={busy !== null || !viewerId}
            />
          )}
          {site.inspectorId ? (
            <Button
              label="Clear inspector"
              variant="secondary"
              onPress={() => void assign(null)}
              loading={busy === 'clear'}
              disabled={busy !== null}
            />
          ) : null}
          <Button
            label={picking ? 'Close list' : 'Choose a staff member'}
            variant="secondary"
            onPress={() => setPicking((value) => !value)}
            disabled={busy !== null}
          />
        </View>

        {picking ? (
          <View className="mt-3 rounded-[16px] bg-[#F1F5FB] p-3">
            {staff.length ? (
              staff.map((entry) => (
                <View key={entry.memberId}>
                  <View className="flex-row items-center gap-2.5 py-2">
                    <Avatar name={entry.name} size={30} />
                    <View className="flex-1">
                      <Text className="text-[12.5px] font-semibold text-ink">{entry.name}</Text>
                      <Text className="text-[10.5px] text-muted" numberOfLines={1}>
                        {entry.email}
                      </Text>
                    </View>
                    {site.inspectorId === entry.memberId ? (
                      <Badge tone="blue">Inspector</Badge>
                    ) : (
                      <Pressable
                        onPress={() => void assign(entry.memberId)}
                        hitSlop={8}
                        className="rounded-lg border border-cobalt-border bg-white px-2.5 py-1.5"
                      >
                        <Text className="text-[11.5px] font-semibold text-cobalt">
                          {busy === entry.memberId ? 'Assigning…' : 'Assign'}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                  <Divider />
                </View>
              ))
            ) : (
              <Text className="text-[12px] leading-4 text-muted">
                Assign a staff member to the site first. Only active staff on this site's roster can inspect it.
              </Text>
            )}
          </View>
        ) : null}

        <Text className="mt-3 text-[11px] leading-4 text-faint">
          Inspection reports are labelled separately from staff reports and stay in the organization's report list.
        </Text>
      </Card>
    </>
  );
}

function ReviewsTab({ siteId }: { siteId: string }) {
  const resource = useApiResource<SiteReviewList>(() => api.siteReviews(siteId), [siteId]);

  if (resource.loading && !resource.data) {
    return <Loading label="Loading reviews" />;
  }

  if (resource.error && !resource.data) {
    return (
      <View className="mt-3">
        <ErrorNote message={resource.error} onRetry={resource.reload} />
      </View>
    );
  }

  const reviews = resource.data;
  if (!reviews) return null;

  return (
    <View>
      <SectionTitle
        right={
          <Text className="text-[11.5px] text-faint">
            {reviews.reviewCount
              ? `${reviews.averageRating} / 5 · ${reviews.reviewCount} review${reviews.reviewCount === 1 ? '' : 's'}`
              : 'No reviews yet'}
          </Text>
        }
      >
        Staff feedback
      </SectionTitle>

      {reviews.reviewCount ? (
        <>
          <Card className="mb-3 p-4">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-[30px] font-bold leading-8 tracking-[-0.6px] text-ink">
                  {reviews.averageRating?.toFixed(1)}
                </Text>
                <Text className="mt-0.5 text-[11px] text-faint">Average rating</Text>
              </View>
              <RatingStars value={Math.round(reviews.averageRating ?? 0)} size={22} />
            </View>
          </Card>

          <View className="gap-2">
            {reviews.reviews.map((review) => (
              <Card key={review.id} className="p-4">
                <View className="flex-row items-center gap-3">
                  <Avatar name={review.memberName} size={34} />
                  <View className="flex-1">
                    <Text className="text-[13px] font-semibold text-ink">{review.memberName}</Text>
                    <Text className="text-[10.5px] text-faint">{relativeTime(review.createdAt)}</Text>
                  </View>
                  <RatingStars value={review.rating} size={15} />
                </View>
                <Text className="mt-2 text-[12.5px] leading-5 text-muted">{review.comment}</Text>
              </Card>
            ))}
          </View>
        </>
      ) : (
        <Card>
          <EmptyState
            icon={<IconScroll size={20} />}
            title="No reviews yet"
            body="Assigned staff can rate this site and leave a comment from their worksite screen."
          />
        </Card>
      )}
    </View>
  );
}

function StaffTab({
  site,
  roster,
  onChanged,
  setSaved,
}: {
  site: SiteDetail;
  roster: RosterEntry[];
  onChanged: () => void;
  setSaved: (message: string | null) => void;
}) {
  const router = useRouter();
  const [assignOpen, setAssignOpen] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [query, setQuery] = useState('');
  const [assigning, setAssigning] = useState<string | null>(null);
  const [leadBusy, setLeadBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadCandidates = useCallback(async () => {
    setLoadingCandidates(true);
    setError(null);
    try {
      setCandidates(await api.memberCandidates(site.id));
    } catch (cause) {
      setError(messageOf(cause, 'Staff candidates could not be loaded.'));
    } finally {
      setLoadingCandidates(false);
    }
  }, [site.id]);

  const openAssign = () => {
    setAssignOpen(true);
    setQuery('');
    void loadCandidates();
  };

  const unseen = candidates.filter(
    (candidate) =>
      !roster.some((entry) => entry.memberId === candidate.memberId) &&
      (!query.trim() ||
        candidate.name.toLowerCase().includes(query.trim().toLowerCase()) ||
        candidate.email.toLowerCase().includes(query.trim().toLowerCase())),
  );

  const assign = async (candidate: Candidate) => {
    setAssigning(candidate.memberId);
    setError(null);
    try {
      await api.assignMember(site.id, {
        memberId: candidate.memberId,
        permissionScope: 'CLOCK_AND_HISTORY',
      });
      setSaved(`${candidate.name} is now assigned to ${site.name}.`);
      await loadCandidates();
      onChanged();
    } catch (cause) {
      setError(messageOf(cause, 'The staff member could not be assigned.'));
    } finally {
      setAssigning(null);
    }
  };

  const toggleLead = async (entry: RosterEntry) => {
    setLeadBusy(entry.memberId);
    setError(null);
    try {
      const result = await api.setTeamLead(site.id, entry.isTeamLead ? null : entry.memberId);
      setSaved(
        result.teamLeadId
          ? `${entry.name} is now the site lead for ${site.name}.`
          : `The site lead for ${site.name} was cleared.`,
      );
      onChanged();
    } catch (cause) {
      setError(messageOf(cause, 'The site lead could not be updated.'));
    } finally {
      setLeadBusy(null);
    }
  };

  return (
    <View>
      <SectionTitle
        right={
          <Pressable onPress={assignOpen ? () => setAssignOpen(false) : openAssign} hitSlop={8}>
            <Text className="text-[12px] font-semibold text-cobalt">
              {assignOpen ? 'Close' : 'Assign staff'}
            </Text>
          </Pressable>
        }
      >
        Assigned staff
      </SectionTitle>

      {assignOpen ? (
        <Card className="mb-3 p-4">
          <Text className="text-[13px] font-semibold text-ink">Assign an existing staff member</Text>
          <Text className="mt-1 text-[11.5px] leading-4 text-muted">
            Only active staff in this organization appear here. New people join through an invitation.
          </Text>
          <View className="mt-3">
            <Input
              value={query}
              onChangeText={setQuery}
              placeholder="Search name or email"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          {error ? <View className="mt-3"><ErrorNote message={error} /></View> : null}
          {loadingCandidates ? (
            <Text className="mt-3 text-[12.5px] text-muted">Loading staff…</Text>
          ) : unseen.length ? (
            <View className="mt-3">
              {unseen.map((candidate, index) => (
                <View key={candidate.memberId}>
                  <View className="flex-row items-center gap-2.5 py-2.5">
                    <Avatar name={candidate.name} size={34} />
                    <View className="flex-1">
                      <Text className="text-[13px] font-semibold text-ink">{candidate.name}</Text>
                      <Text className="text-[11.5px] text-muted" numberOfLines={1}>
                        {candidate.email}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => void assign(candidate)}
                      hitSlop={8}
                      className="rounded-lg border border-cobalt-border bg-cobalt-soft px-2.5 py-1.5"
                    >
                      <Text className="text-[11.5px] font-semibold text-cobalt">
                        {assigning === candidate.memberId ? 'Adding…' : 'Assign'}
                      </Text>
                    </Pressable>
                  </View>
                  {index < unseen.length - 1 ? <Divider /> : null}
                </View>
              ))}
            </View>
          ) : (
            <Text className="mt-3 text-[12.5px] text-muted">
              {candidates.length
                ? 'Every active staff member is already assigned to this site.'
                : 'No active staff members are available in this organization yet.'}
            </Text>
          )}
        </Card>
      ) : null}

      {roster.length ? (
        <View className="gap-2">
          {roster.map((entry) => (
            <Pressable
              key={entry.memberId}
              onPress={() => {
                if (entry.role === 'STAFF') router.push(`/team/${entry.memberId}`);
              }}
              disabled={entry.role !== 'STAFF'}
            >
              <Card className="p-4">
                <View className="flex-row items-center gap-3">
                  <Avatar name={entry.name} />
                  <View className="flex-1">
                    <View className="flex-row flex-wrap items-center gap-1.5">
                      <Text className="text-[13.5px] font-semibold text-ink">{entry.name}</Text>
                      {entry.isTeamLead ? <Badge tone="amber">Site lead</Badge> : null}
                    </View>
                    <Text className="mt-0.5 text-[11.5px] text-muted" numberOfLines={1}>
                      {entry.email}
                    </Text>
                    <Text className="mt-0.5 text-[11px] text-faint">
                      {entry.role === 'SITE_OWNER' ? 'Site owner' : 'Staff'} · assigned{' '}
                      {formatDate(entry.assignedAt)}
                      {entry.acceptedAt ? '' : ' · awaiting acceptance'}
                    </Text>
                  </View>
                  <View className="items-end gap-1.5">
                    {presenceBadge(entry.presence)}
                    {entry.clockedInAt ? (
                      <Text className="text-[10.5px] text-muted">
                        since {formatClock(entry.clockedInAt, site.timezone)}
                      </Text>
                    ) : null}
                  </View>
                </View>
                {entry.clockedInAt && entry.lastUpdateAt ? (
                  <Text className="mt-2 border-t border-line pt-2 text-[10.5px] text-faint">
                    Last presence check {relativeTime(entry.lastUpdateAt)}
                  </Text>
                ) : null}
                {entry.role === 'STAFF' ? (
                  <Pressable
                    onPress={() => void toggleLead(entry)}
                    hitSlop={8}
                    className="mt-2 self-end"
                    accessibilityRole="button"
                    accessibilityLabel={entry.isTeamLead ? 'Clear site lead' : 'Make site lead'}
                  >
                    <Text className="text-[11.5px] font-semibold text-cobalt">
                      {leadBusy === entry.memberId
                        ? 'Saving…'
                        : entry.isTeamLead
                          ? 'Clear site lead'
                          : 'Make site lead'}
                    </Text>
                  </Pressable>
                ) : null}
              </Card>
            </Pressable>
          ))}
        </View>
      ) : (
        <Card>
          <EmptyState
            icon={<IconUsers size={20} />}
            title="No one assigned yet"
            body="Invite staff from the Invites tab, or assign an existing staff member with the Assign staff link above."
          />
        </Card>
      )}
    </View>
  );
}

function InvitationsTab({
  site,
  invitations,
  onChanged,
  setError,
  setSaved,
}: {
  site: SiteDetail;
  invitations: InvitationSummary[];
  onChanged: () => void;
  setError: (message: string | null) => void;
  setSaved: (message: string | null) => void;
}) {
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [issued, setIssued] = useState<{ email: string; token: string } | null>(null);

  const invite = async () => {
    if (!email.trim()) return;
    setBusy(true);
    setError(null);
    setSaved(null);
    setIssued(null);
    try {
      const result = await api.invite(site.id, email.trim().toLowerCase(), note.trim() || undefined);
      setEmail('');
      setNote('');
      if (result.developmentToken) {
        setIssued({ email: result.invitation.email, token: result.developmentToken });
      } else {
        setSaved(`Invitation sent to ${result.invitation.email}. It expires in seven days.`);
      }
      onChanged();
    } catch (cause) {
      setError(messageOf(cause, 'The invitation could not be sent.'));
    } finally {
      setBusy(false);
    }
  };

  const share = async (token: string) => {
    const url = `${WEB_URL}/invite?token=${encodeURIComponent(token)}`;
    await Share.share({
      message: `You are invited to join ${site.name} on Manage.\n\nOpen this link to set up your account (single use, expires in seven days):\n${url}`,
    });
  };

  const revoke = (invitation: InvitationSummary) => {
    Alert.alert(
      'Revoke this invitation?',
      `${invitation.email} will not be able to use the link. You can invite them again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: async () => {
            setRevoking(invitation.id);
            setError(null);
            try {
              await api.revokeInvitation(site.id, invitation.id);
              setSaved(`Invitation for ${invitation.email} revoked.`);
              onChanged();
            } catch (cause) {
              setError(messageOf(cause, 'The invitation could not be revoked.'));
            } finally {
              setRevoking(null);
            }
          },
        },
      ],
    );
  };

  const pending = invitations.filter((entry) => entry.status === 'PENDING');
  const history = invitations.filter((entry) => entry.status !== 'PENDING');

  return (
    <View>
      {issued ? (
        <Card className="mb-3 border-cobalt-border bg-[#F8FAFF] p-4">
          <Text className="text-[13.5px] font-bold text-ink">Invitation ready for {issued.email}</Text>
          <Text className="mt-1 text-[11.5px] leading-4.5 text-muted">
            Email delivery is running on the local development adapter, so the API returned the invitation link
            directly. Share it securely — it is single use and expires in seven days.
          </Text>
          <View className="mt-2.5 rounded-lg border border-line bg-white px-3 py-2.5">
            <Text className="text-[11px] leading-4 text-muted" selectable>
              {`${WEB_URL}/invite?token=${issued.token}`}
            </Text>
          </View>
          <View className="mt-3 flex-row gap-2">
            <View className="flex-1">
              <Button label="Share link" onPress={() => void share(issued.token)} />
            </View>
            <View className="flex-1">
              <Button label="Done" variant="secondary" onPress={() => setIssued(null)} />
            </View>
          </View>
        </Card>
      ) : null}

      <SectionTitle>Invite staff</SectionTitle>
      <Card className="p-4">
        <Field label="Work email" hint="They receive a single-use link and join only through it.">
          <Input
            value={email}
            onChangeText={setEmail}
            placeholder="name@company.com"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
          />
        </Field>
        <Field label="Note" optional hint="Included in the invitation email.">
          <Input value={note} onChangeText={setNote} placeholder="e.g. Joining the Lekki site team" maxLength={300} />
        </Field>
        <Button
          label="Send invitation"
          loading={busy}
          onPress={() => void invite()}
          disabled={busy || !email.trim()}
          icon={<IconMail size={16} color="#FFFFFF" />}
        />
      </Card>

      <SectionTitle
        right={pending.length ? <Badge tone="amber">{pending.length} pending</Badge> : undefined}
      >
        Pending invitations
      </SectionTitle>
      {pending.length ? (
        <View className="gap-2">
          {pending.map((invitation) => (
            <Card key={invitation.id} className="p-4">
              <View className="flex-row items-start gap-3">
                <View className="h-9 w-9 items-center justify-center rounded-lg bg-amber-soft">
                  <IconMail size={16} />
                </View>
                <View className="flex-1">
                  <Text className="text-[13px] font-semibold text-ink">{invitation.email}</Text>
                  <Text className="mt-0.5 text-[11.5px] text-muted">
                    Sent {formatDate(invitation.createdAt)}
                  </Text>
                  <Text className="mt-0.5 text-[11px] text-faint">
                    Expires {formatDateTime(invitation.expiresAt)}
                  </Text>
                </View>
                <Pressable onPress={() => revoke(invitation)} hitSlop={8}>
                  <Text className="text-[12px] font-semibold text-danger">
                    {revoking === invitation.id ? 'Revoking…' : 'Revoke'}
                  </Text>
                </Pressable>
              </View>
            </Card>
          ))}
        </View>
      ) : (
        <Card className="p-4">
          <Text className="text-[12.5px] leading-5 text-muted">
            No pending invitations. Staff accounts are only created through an invitation link.
          </Text>
        </Card>
      )}

      {history.length ? (
        <>
          <SectionTitle>Invitation history</SectionTitle>
          <Card className="px-4">
            {history.map((invitation, index) => (
              <View key={invitation.id}>
                <View className="flex-row items-center gap-3 py-3">
                  <View className="flex-1">
                    <Text className="text-[12.5px] font-medium text-ink">{invitation.email}</Text>
                    <Text className="mt-0.5 text-[11px] text-muted">
                      {invitation.acceptedAt ? `Accepted ${formatDate(invitation.acceptedAt)}` : 'Not used'} · sent{' '}
                      {formatDate(invitation.createdAt)}
                    </Text>
                  </View>
                  <Badge tone={STATUS_TONE[invitation.status]}>{invitation.status.toLowerCase()}</Badge>
                </View>
                {index < history.length - 1 ? <Divider /> : null}
              </View>
            ))}
          </Card>
        </>
      ) : null}
    </View>
  );
}

function SiteSettings({
  site,
  onSaved,
  setError,
}: {
  site: SiteDetail;
  onSaved: (message: string) => void;
  setError: (message: string | null) => void;
}) {
  const [name, setName] = useState(site.name);
  const [address, setAddress] = useState(site.address);
  const [timezone, setTimezone] = useState(site.timezone);
  const [radius, setRadius] = useState(String(site.radiusMeters));
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setError(null);
    const radiusMeters = Number(radius);
    if (!Number.isFinite(radiusMeters) || radiusMeters < 50 || radiusMeters > 2000) {
      setError('Use a radius between 50 and 2,000 metres.');
      return;
    }
    setBusy(true);
    try {
      await api.updateSite(site.id, {
        name: name.trim(),
        address: address.trim(),
        timezone: timezone.trim(),
        policy: { radiusMeters: Math.round(radiusMeters) },
        version: site.version,
      });
      onSaved('Site settings saved. New clock-ins use the new policy version.');
    } catch (cause) {
      if (cause instanceof ApiClientError && cause.status === 409) {
        setError('This site changed on another device. The latest version is loaded — check the fields and save again.');
        onSaved('');
      } else {
        setError(messageOf(cause, 'The site settings could not be saved.'));
      }
    } finally {
      setBusy(false);
    }
  };

  const dirty =
    name.trim() !== site.name ||
    address.trim() !== site.address ||
    timezone.trim() !== site.timezone ||
    Number(radius) !== site.radiusMeters;

  return (
    <View>
      <SectionTitle>Site details</SectionTitle>
      <Card className="p-4">
        <Field label="Site name">
          <Input value={name} onChangeText={setName} maxLength={120} />
        </Field>
        <Field label="Address">
          <Input value={address} onChangeText={setAddress} maxLength={300} />
        </Field>
        <Field label="Timezone" hint="IANA name, for example Africa/Lagos.">
          <Input value={timezone} onChangeText={setTimezone} autoCapitalize="none" autoCorrect={false} />
        </Field>
        <Field
          label="Presence radius"
          hint={`50–2,000 m. Currently ${site.radiusMeters} m. A change applies to future checks and bumps the policy version.`}
        >
          <Input value={radius} onChangeText={setRadius} keyboardType="number-pad" maxLength={4} />
        </Field>

        <Button
          label="Save settings"
          loading={busy}
          onPress={() => void save()}
          disabled={busy || !name.trim() || !address.trim() || !timezone.trim() || !dirty}
          icon={<IconCheck size={16} color="#FFFFFF" />}
        />
      </Card>

      <SectionTitle>Policy</SectionTitle>
      <Card className="p-4">
        <KeyValue label="Policy version" value={site.policyVersion} />
        <KeyValue label="Site version" value={site.version} />
        <Divider />
        <KeyValue label="Exit buffer" value={`${site.policy.exitBufferMeters} m`} />
        <KeyValue label="Entry buffer" value={`${site.policy.entryBufferMeters} m`} />
        <KeyValue label="Grace period" value={`${Math.round(site.policy.graceSeconds / 60)} min`} />
        <KeyValue label="Max accuracy" value={`±${site.policy.maxAccuracyMeters} m`} />
        <KeyValue label="Reading freshness" value={`${site.policy.freshnessSeconds} s`} />
        <Divider />
        <KeyValue label="Email alerts" value={site.notificationPreferences.email ? 'On' : 'Off'} />
        <KeyValue label="Push alerts" value={site.notificationPreferences.push ? 'On' : 'Off'} />
        <KeyValue label="On-duty alerts" value={site.notificationPreferences.onDutyAlerts ? 'On' : 'Off'} />
        <View className="mt-2 flex-row items-start gap-2">
          <IconInfo size={13} />
          <Text className="flex-1 text-[11px] leading-4 text-faint">
            Buffers, grace and accuracy limits are managed in the web console. Changes never rewrite recorded
            attendance.
          </Text>
        </View>
      </Card>

      <View className="mt-3 flex-row items-start gap-2">
        <IconPin size={13} />
        <Text className="flex-1 text-[11px] leading-4 text-faint">
          The site centre is {site.latitude.toFixed(5)}, {site.longitude.toFixed(5)}. Move it from the web console if
          the worksite changes.
        </Text>
      </View>
    </View>
  );
}
