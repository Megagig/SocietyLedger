import { useState } from 'react';
import { Alert } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner-native';

import { membersApi } from '@/api/endpoints/members';
import { membersManageApi } from '@/api/endpoints/membersManage';
import { pickProfilePhoto, validateAttachment } from '@/components/forms/attachmentPickers';
import { sessionKeys } from '@/features/session/queries';
import { useTenantKey } from '@/hooks/useTenantKey';
import { t } from '@/lib/i18n';
import { membersKeys } from './queries';

export type PhotoTarget = { kind: 'me' } | { kind: 'member'; id: number };

const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Take, choose or remove a profile photo: for the signed-in member (`me`) or, for an officer with the edit permission, another member.
 * `choose()` opens the native options sheet. Every outcome is reported with a toast, and the screens that show the photo refresh on their own.
 */
export function useProfilePhoto(target: PhotoTarget, hasPhoto: boolean) {
  const queryClient = useQueryClient();
  const tenant = useTenantKey();
  const [busy, setBusy] = useState(false);

  function refresh() {
    queryClient.invalidateQueries({ queryKey: sessionKeys.profile() });
    queryClient.invalidateQueries({ queryKey: membersKeys.all(tenant) });
  }

  async function upload(source: 'camera' | 'library') {
    const picked = await pickProfilePhoto(source);
    if (!picked) return;
    if ('error' in picked) {
      toast.error(picked.error);
      return;
    }
    const problem = validateAttachment(picked.attachment, PHOTO_TYPES);
    if (problem) {
      toast.error(problem);
      return;
    }
    setBusy(true);
    try {
      const { uri, name, type } = picked.attachment;
      if (target.kind === 'me') await membersApi.setMyPhoto({ uri, name, type });
      else await membersManageApi.setMemberPhoto(target.id, { uri, name, type });
      refresh();
      toast.success(t('profile.photo.saved'));
    } catch {
      toast.error(t('profile.photo.failed'));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      if (target.kind === 'me') await membersApi.removeMyPhoto();
      else await membersManageApi.removeMemberPhoto(target.id);
      refresh();
      toast.success(t('profile.photo.removed'));
    } catch {
      toast.error(t('profile.photo.failed'));
    } finally {
      setBusy(false);
    }
  }

  function choose() {
    if (busy) return;
    Alert.alert(t('profile.photo.title'), undefined, [
      { text: t('profile.photo.take'), onPress: () => void upload('camera') },
      { text: t('profile.photo.choose'), onPress: () => void upload('library') },
      ...(hasPhoto ? [{ text: t('profile.photo.remove'), style: 'destructive' as const, onPress: () => void remove() }] : []),
      { text: t('common.cancel'), style: 'cancel' as const },
    ]);
  }

  return { choose, busy };
}
