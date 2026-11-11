import { useState } from 'react';
import { CERTIFICATE_TIERS, type CertificateDelivery, type CertificateTier } from '@bookquest/shared';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { Rule } from '@/components/ui/Rule';
import { ApiRequestError } from '@/lib/api/client';
import { formatCount } from '@/lib/format';
import { useUiStore } from '@/stores/ui.store';
import { useCertificateDelivery, useSendCertificates } from '../api/useCertificateDelivery';
import { certificatePreviewUrl } from './previewUrl';

const TIER_LABEL: Record<CertificateTier, string> = {
  gold: '1st place',
  silver: '2nd place',
  bronze: '3rd place',
  participant: 'Everyone else'
};

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
  const status = delivery.data;

  const sending = status?.status === 'sending';
  const allDone = status !== undefined && status.total > 0 && status.pending === 0;

  function confirmSend() {
    send.mutate(undefined, {
      onSuccess: () => showToast('Certificates on their way.'),
      onError: (error) => showToast(error instanceof ApiRequestError ? error.message : 'Could not start sending.'),
      onSettled: () => setConfirming(false)
    });
  }

  return (
    <section className="flex flex-col gap-3">
      <p className="type-label m-0">Certificates</p>
      <Rule />

      <div className="grid grid-cols-2 gap-3">
        {CERTIFICATE_TIERS.map((tier) => (
          <figure key={tier} className="m-0 flex flex-col gap-1">
            <img
              src={certificatePreviewUrl(tier)}
              width={1123}
              height={794}
              loading="lazy"
              alt={`Sample ${TIER_LABEL[tier]} certificate`}
              className="certificate-image"
            />
            <figcaption className="text-sm text-taupe">{TIER_LABEL[tier]}</figcaption>
          </figure>
        ))}
      </div>

      {status && <DeliveryLine status={status} />}
      {sending && status && (
        <progress
          className="h-2 w-full accent-gold"
          max={status.total}
          value={status.total - status.pending}
          aria-label="Certificates sent"
        />
      )}

      <Button
        type="button"
        variant="gold"
        disabled={!status || sending || allDone || send.isPending}
        onClick={() => setConfirming(true)}
      >
        {allDone ? 'All certificates sent' : sending ? 'Sending…' : 'Send certificates'}
      </Button>

      <Sheet
        open={confirming}
        onClose={() => setConfirming(false)}
        title={`Send to ${formatCount(status?.pending ?? 0)} finishers?`}
        actions={
          <>
            <Button type="button" variant="quiet" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button type="button" variant="gold" onClick={confirmSend} disabled={send.isPending}>
              {send.isPending ? 'Starting…' : 'Send now'}
            </Button>
          </>
        }
      >
        <p className="m-0 text-sm text-taupe">
          {formatCount(status?.pendingReachable ?? 0)} get it in Telegram, the rest in the app. Everyone can download
          it from their profile. It can’t be unsent.
        </p>
      </Sheet>
    </section>
  );
}

function DeliveryLine({ status }: { status: CertificateDelivery }) {
  const processed = status.total - status.pending;

  let text: string;
  if (status.status === 'idle') {
    text = `${formatCount(status.total)} finishers haven’t been sent their certificate yet.`;
  } else if (status.status === 'sending') {
    text = `Sending… ${formatCount(processed)} of ${formatCount(status.total)}`;
  } else {
    text =
      `${formatCount(status.delivered)} delivered in Telegram · ${formatCount(status.inAppOnly)} in-app only · ` +
      `${formatCount(status.blocked)} blocked the bot`;
    if (status.failed > 0) text += ` · ${formatCount(status.failed)} failed, send again to retry`;
    if (status.status === 'interrupted') text += '. The last send was interrupted: press Send to finish it.';
  }

  return (
    <p className="m-0 text-paper-dim" aria-live="polite">
      {text}
    </p>
  );
}
