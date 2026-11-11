import type { CertificateData } from '@bookquest/shared';

const BASE: Omit<CertificateData, 'fullName' | 'placing' | 'tier'> = {
  code: 'SAMPLE',
  participantNumber: 3042,
  questEdition: 4,
  questYear: 2026,
  bookTitle: 'The Alchemist',
  bookAuthor: 'Paulo Coelho',
  finishedCount: 412,
  issuedAt: '2026-12-14T15:00:00.000Z',
  imageUrl: 'https://example.invalid/sample.png',
  verifyUrl: 'https://example.invalid/verify/SAMPLE'
};

/** Fixed on purpose: a public preview that accepted a name would be a forgery tool. */
export const CERTIFICATE_SAMPLES = {
  gold: { ...BASE, fullName: 'Sofia Karimova', placing: 1, tier: 'gold' },
  silver: { ...BASE, fullName: 'Aziz Rahimov', placing: 2, tier: 'silver' },
  bronze: { ...BASE, fullName: 'Malika Yusupova', placing: 3, tier: 'bronze' },
  participant: { ...BASE, fullName: 'Bobur Tursunov', placing: null, tier: 'participant' },
  long: { ...BASE, fullName: 'Muhammadabdulaziz Abdurakhmonova', placing: null, tier: 'participant' },
  cyrillic: { ...BASE, fullName: 'Дилноза Абдуллаева', placing: 1, tier: 'gold' }
} satisfies Record<string, CertificateData>;

export type CertificateSampleKey = keyof typeof CERTIFICATE_SAMPLES;

export const CERTIFICATE_SAMPLE_KEYS = Object.keys(CERTIFICATE_SAMPLES) as [
  CertificateSampleKey,
  ...CertificateSampleKey[]
];
