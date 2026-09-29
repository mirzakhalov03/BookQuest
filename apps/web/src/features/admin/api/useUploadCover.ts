import { useMutation } from '@tanstack/react-query';
import type { CoverUpload } from '@bookquest/shared';
import { api } from '@/lib/api/client';

/** `POST /admin/covers`. No cache to touch — the URL only matters once the quest is saved. */
export function useUploadCover() {
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return api.upload<CoverUpload>('/admin/covers', form);
    }
  });
}
