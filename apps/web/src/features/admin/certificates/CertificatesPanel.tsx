import { useState } from 'react';
import { CERTIFICATE_TIERS, type CertificateDelivery } from '@bookquest/shared';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { Rule } from '@/components/ui/Rule';
import { ApiRequestError } from '@/lib/api/client';
import { formatCount } from '@/lib/format';
import { useUiStore } from '@/stores/ui.store';
import { useCertificateDelivery, useSendCertificates } from '../api/useCertificateDelivery';
import { certificatePreviewUrl } from './previewUrl';
import { useT } from '@/i18n';
import { errorMessage } from '@/lib/api/errorMessage';

/**
 * On `/admin/results`: preview the four tiers, then send every finisher their
 * certificate (spec §5). Sending is explicit, never automatic: organisers look
 * at the final board before about a thousand people get something permanent.
 */
export function CertificatesPanel() {
  const delivery = useCertificateDelivery();
  const send = useSendCertificates();
  const showToast = useUiStore((state) => state.showToast);
  const [confirming, setConfirming] = useState(false);
  const { common, admin } = useT();
  const t = admin.certificates;
  const status = delivery.data;

  const sending = status?.status === 'sending';
  const allDone = status !== undefined && status.total > 0 && status.pending === 0;

  function confirmSend() {
    send.mutate(undefined, {
      onSuccess: () => showToast(t.sentToast),
      onError: (error) => showToast(error instanceof ApiRequestError ? errorMessage(error) : t.startFailed),
      onSettled: () => setConfirming(false)
    });
  }

  return (
    <section className="flex flex-col gap-3">
      <p className="type-label m-0">{t.title}</p>
      <Rule />

      <div className="grid grid-cols-2 gap-3">
        {CERTIFICATE_TIERS.map((tier) => (
          <figure key={tier} className="m-0 flex flex-col gap-1">
            <img
              src={certificatePreviewUrl(tier)}
              width={1123}
              height={794}
              loading="lazy"
              alt={t.sampleAlt(t.tiers[tier])}
              className="certificate-image"
            />
            <figcaption className="text-sm text-taupe">{t.tiers[tier]}</figcaption>
          </figure>
        ))}
      </div>

      {status && <DeliveryLine status={status} />}
      {sending && status && (
        <progress
          className="h-2 w-full accent-gold"
          max={status.total}
          value={status.total - status.pending}
          aria-label={t.progressAria}
        />
      )}

      <Button
        type="button"
        variant="gold"
        disabled={!status || sending || allDone || send.isPending}
        onClick={() => setConfirming(true)}
      >
        {allDone ? t.allSent : sending ? t.sending : t.send}
      </Button>

      <Sheet
        open={confirming}
        onClose={() => setConfirming(false)}
        title={t.confirmTitle(formatCount(status?.pending ?? 0))}
        actions={
          <>
            <Button type="button" variant="quiet" onClick={() => setConfirming(false)}>
              {common.cancel}
            </Button>
            <Button type="button" variant="gold" onClick={confirmSend} disabled={send.isPending}>
              {send.isPending ? t.starting : t.sendNow}
            </Button>
          </>
        }
      >
        <p className="m-0 text-sm text-taupe">
          {t.confirmBody(formatCount(status?.pendingReachable ?? 0))}
        </p>
      </Sheet>
    </section>
  );
}

function DeliveryLine({ status }: { status: CertificateDelivery }) {
  const processed = status.total - status.pending;
  const t = useT().admin.certificates;

  let text: string;
  if (status.status === 'idle') {
    text = t.idle(formatCount(status.total));
  } else if (status.status === 'sending') {
    text = t.progress(formatCount(processed), formatCount(status.total));
  } else {
    text = t.summary(formatCount(status.delivered), formatCount(status.inAppOnly), formatCount(status.blocked));
    if (status.failed > 0) text += t.failed(formatCount(status.failed));
    if (status.status === 'interrupted') text += t.interrupted;
  }

  return (
    <p className="m-0 text-paper-dim" aria-live="polite">
      {text}
    </p>
  );
}
