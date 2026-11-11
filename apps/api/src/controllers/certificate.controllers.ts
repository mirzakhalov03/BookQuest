import type { Request, Response } from 'express';
import * as certificateService from '../services/certificate.services.js';
import type { CertificateSampleKey } from '../certificates/samples.js';
import { ok } from '../utils/respond.js';

function sendPng(req: Request, res: Response, png: Buffer, etag: string): void {
  const tag = `"${etag}"`;
  res.setHeader('ETag', tag);
  res.setHeader('Cache-Control', 'public, max-age=86400');
  // Helmet's same-origin default would stop the web app (another origin) showing it, as with covers.
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  if (req.headers['if-none-match'] === tag) {
    res.status(304).end();
    return;
  }
  res.type('png').send(png);
}

/** GET /api/v1/certificates/:code */
export async function getByCode(req: Request, res: Response): Promise<void> {
  ok(res, await certificateService.getCertificateByCode(String(req.params.code)));
}

/** GET /api/v1/certificates/:code/image.png[?download=1] */
export async function getImage(req: Request, res: Response): Promise<void> {
  const { png, etag, data } = await certificateService.getCertificateImage(String(req.params.code));
  const disposition = req.query.download === '1' ? 'attachment' : 'inline';
  res.setHeader('Content-Disposition', `${disposition}; filename="${certificateService.certificateFileName(data)}"`);
  sendPng(req, res, png, etag);
}

/** GET /api/v1/certificates/preview/:sample.png — fixed sample data, stamped SAMPLE. */
export async function getPreview(req: Request, res: Response): Promise<void> {
  const { png, etag } = await certificateService.getSampleImage(req.params.sample as CertificateSampleKey);
  sendPng(req, res, png, etag);
}
