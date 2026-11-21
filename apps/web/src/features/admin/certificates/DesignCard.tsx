import { useState } from 'react';
import type { AdminQuest, CertificateTier } from '@bookquest/shared';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { useUiStore } from '@/stores/ui.store';
import { errorMessage } from '@/lib/api/errorMessage';
import { useT } from '@/i18n';
import { ImagePicker } from '../quest/components/ImagePicker';
import { useUpdateQuest } from '../api/useUpdateQuest';

/** Upload, replace or remove one tier's artwork. It saves at once: there's no form around it. */
export function DesignCard({ quest, tier }: { quest: AdminQuest; tier: CertificateTier }) {
  const t = useT().admin.certificates;
  const update = useUpdateQuest(quest.id);
  const showToast = useUiStore((state) => state.showToast);
  const current = quest.certificateDesigns[tier] ?? '';
  // A replacement waiting for "yes": already uploaded, not yet attached.
  const [pending, setPending] = useState<string | null>(null);
  const [, setUploading] = useState(false);

  const save = (url: string) =>
    update.mutate(
      { certificateDesigns: { [tier]: url || null } },
      {
        onSuccess: () => showToast(url ? t.designSaved : t.designRemoved),
        onError: (error) => showToast(errorMessage(error))
      }
    );

  return (
    <section className="flex flex-col gap-2 rounded-box border border-[color:var(--rule)] p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="m-0 font-medium text-paper">{t.tiers[tier]}</h3>
        {!current && <span className="text-xs text-amber">{t.placeholderBadge}</span>}
      </div>
      <ImagePicker
        shape="certificate"
        value={current}
        onChange={(url) => (current && url ? setPending(url) : save(url))}
        onUploadingChange={setUploading}
        labels={{
          title: t.tiers[tier],
          alt: t.designAlt(t.tiers[tier]),
          choose: t.uploadDesign,
          replace: t.replaceDesign,
          view: t.viewDesign,
          remove: t.removeDesign
        }}
      />
      <p className="m-0 text-xs text-taupe">{t.designHint}</p>

      <Sheet
        open={pending !== null}
        onClose={() => setPending(null)}
        title={t.replaceTitle}
        actions={
          <>
            <Button variant="quiet" onClick={() => setPending(null)}>
              {t.keepCurrent}
            </Button>
            <Button
              onClick={() => {
                if (pending) save(pending);
                setPending(null);
              }}
            >
              {t.replaceDesign}
            </Button>
          </>
        }
      >
        <p className="m-0 text-paper-dim">{t.replaceBody}</p>
      </Sheet>
    </section>
  );
}
