import { z } from 'zod';
import { CERTIFICATE_SAMPLE_KEYS } from '../certificates/samples.js';

// Loose on purpose: normalizeCertificateCode decides; this only bounds the input.
export const certificateCodeParams = z.object({ code: z.string().min(6).max(32) });
export const certificateImageQuery = z.object({ download: z.literal('1').optional() });
export const certificateSampleParams = z.object({ sample: z.enum(CERTIFICATE_SAMPLE_KEYS) });
