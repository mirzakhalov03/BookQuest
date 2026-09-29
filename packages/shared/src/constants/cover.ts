/** One source for cover limits and copy, so the browser pre-check and the API always agree. */
export const COVER_MAX_BYTES = 5 * 1024 * 1024;

export const COVER_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type CoverContentType = (typeof COVER_CONTENT_TYPES)[number];

export const COVER_MESSAGES = {
  tooLarge: 'That file is over 5MB.',
  wrongType: 'Only JPEG, PNG or WebP images.',
  missing: 'Choose an image to upload.'
} as const;

/** `POST /admin/covers` response data. */
export interface CoverUpload {
  url: string;
}
