import { useEffect, useRef, useState } from 'react';
import { Download, Share2 } from 'lucide-react';
import type { CertificateData } from '@bookquest/shared';
import { Button } from '@/components/ui/Button';
import { downloadFile, isInsideTelegram, openExternalLink } from '@/lib/telegram';
import { useUiStore } from '@/stores/ui.store';
import { useT } from '@/i18n';

/** `?download=1` asks the API for an attachment; set through URL so an existing query survives. */
function withDownloadFlag(imageUrl: string): string {
  const url = new URL(imageUrl);
  url.searchParams.set('download', '1');
  return url.href;
}

/**
 * The certificate is the PNG the API renders (spec §3), the same file the bot
 * sent. One design in one place, the satori template; nothing here styles it.
 */
export function Certificate({ data }: { data: CertificateData }) {
  const showToast = useUiStore((state) => state.showToast);
  const t = useT();
  const inTelegram = isInsideTelegram();
  const downloadUrl = withDownloadFlag(data.imageUrl);
  const fileName = `BookQuest-${data.questYear}-${data.code}.png`;
  const [frameRef, settled] = useSettleOnView();

  function download() {
    // Older Telegram clients lack downloadFile; the system viewer can still save an opened image.
    if (!downloadFile(downloadUrl, fileName)) openExternalLink(data.imageUrl);
  }

  async function share() {
    try {
      const blob = await (await fetch(data.imageUrl)).blob();
      const file = new File([blob], fileName, { type: blob.type });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: t.profile.shareTitle, url: data.verifyUrl });
        return;
      }
    } catch (error) {
      // Closing the share sheet is a choice, not a failure worth a fallback.
      if (error instanceof DOMException && error.name === 'AbortError') return;
    }
    try {
      await navigator.clipboard.writeText(data.verifyUrl);
      showToast(t.profile.linkCopied);
    } catch {
      showToast(data.verifyUrl);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <figure ref={frameRef} className={`cert-frame ${settled ? 'is-in' : ''}`} data-tier={data.tier}>
        <img
          src={data.imageUrl}
          width={1123}
          height={794}
          loading="lazy"
          alt={t.profile.certificateAlt(data.fullName, data.questYear, data.placing ? t.common.place(data.placing) : null)}
          className="certificate-image"
        />
        <figcaption className="cert-chip">{t.profile.tiers[data.tier]}</figcaption>
      </figure>
      <div className="flex flex-wrap gap-2">
        {inTelegram ? (
          <Button variant="gold" onClick={download}>
            <Download className="h-5 w-5" aria-hidden="true" /> {t.profile.download}
          </Button>
        ) : (
          // A real link on the web: the browser saves it, and it works with JavaScript mid-load.
          <a
            href={downloadUrl}
            download={fileName}
            className="inline-flex min-h-[3.25rem] items-center justify-center gap-3 rounded-box bg-gold px-6 text-base font-semibold text-[#170F09] hover:bg-[#D5AF57]"
          >
            <Download className="h-5 w-5" aria-hidden="true" /> {t.profile.download}
          </a>
        )}
        {/* Telegram users share from the bot chat, where the photo already is. */}
        {!inTelegram && (
          <Button variant="quiet" onClick={() => void share()}>
            <Share2 className="h-5 w-5" aria-hidden="true" /> {t.profile.share}
          </Button>
        )}
      </div>
      <p className="m-0 text-xs text-taupe-dim">{t.profile.verifyCode(data.code)}</p>
    </div>
  );
}

/** True once the frame has scrolled into view, so the tilt-and-settle plays where it's seen. */
function useSettleOnView() {
  const ref = useRef<HTMLElement>(null);
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') return setSettled(true);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setSettled(true);
        observer.disconnect();
      },
      { threshold: 0.35 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, settled] as const;
}
