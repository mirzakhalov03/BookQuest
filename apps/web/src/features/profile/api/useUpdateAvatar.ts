import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AvatarId, SessionUser } from '@bookquest/shared';
import { updateProfile } from '@/lib/auth/authApi';
import { authKeys } from '@/lib/auth/useAuth';
import { useUiStore } from '@/stores/ui.store';

/**
 * Optimistic: the pass shows the new avatar the moment it's tapped, and
 * rolls back with a toast if the save fails.
 */
export function useUpdateAvatar() {
  const queryClient = useQueryClient();
  const showToast = useUiStore((state) => state.showToast);

  return useMutation({
    mutationFn: (avatar: AvatarId | null) => updateProfile({ avatar }),
    onMutate: async (avatar) => {
      await queryClient.cancelQueries({ queryKey: authKeys.me() });
      const previous = queryClient.getQueryData<SessionUser>(authKeys.me());
      if (previous) queryClient.setQueryData(authKeys.me(), { ...previous, avatar });
      return { previous };
    },
    onError: (_error, _avatar, context) => {
      if (context?.previous) queryClient.setQueryData(authKeys.me(), context.previous);
      showToast("Couldn't save your avatar. Try again.");
    },
    onSuccess: (user) => queryClient.setQueryData(authKeys.me(), user)
  });
}
