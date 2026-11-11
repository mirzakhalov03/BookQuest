import { Download, Share2 } from 'lucide-react';
import type { CertificateData } from '@bookquest/shared';
import { Button } from '@/components/ui/Button';
import { downloadFile, isInsideTelegram, openExternalLink } from '@/lib/telegram';
import { useUiStore } from '@/stores/ui.store';

const ORDINAL = { 1: '1st', 2: '2nd', 3: '3rd' } as const;

/**
 * The certificate is the PNG the API renders (spec §3), the same file the bot
 * sent. One design in one place, the satori template; nothing here styles it.
 */
export function Certificate({ data }: { data: CertificateData }) {
  const showToast = useUiStore((state) => state.showToast);
  const inTelegram = isInsideTelegram();
  const downloadUrl = `${data.imageUrl}?download=1`;
  const fileName = `BookQuest-${data.questYear}-${data.code}.png`;

  function download() {
    // Older Telegram clients lack downloadFile; the system viewer can still save an opened image.
    if (!downloadFile(downloadUrl, fileName)) openExternalLink(data.imageUrl);
  }

  async function share() {
    try {
      const blob = await (await fetch(data.imageUrl)).blob();
      const file = new File([blob], fileName, { type: blob.type });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'My BookQuest certificate', url: data.verifyUrl });
        return;
      }
    } catch (error) {
      // Closing the share sheet is a choice, not a failure worth a fallback.
      if (error instanceof DOMException && error.name === 'AbortError') return;
    }
    try {
      await navigator.clipboard.writeText(data.verifyUrl);
      showToast('Verification link copied.');
    } catch {
      showToast(data.verifyUrl);
    }
  }

  return (
    <div className="flex flex-col items-start gap-3">
      <img
        src={data.imageUrl}
        width={1123}
        height={794}
        loading="lazy"
        alt={`Certificate for ${data.fullName}, BookQuest ${data.questYear}${
          data.placing ? `, ${ORDINAL[data.placing]} place` : ''
        }`}
        className="certificate-image"
      />
      <div className="flex flex-wrap gap-2">
        {inTelegram ? (
          <Button variant="gold" onClick={download}>
            <Download className="h-5 w-5" aria-hidden="true" /> Download
          </Button>
        ) : (
          // A real link on the web: the browser saves it, and it works with JavaScript mid-load.
          <a
            href={downloadUrl}
            download={fileName}
            className="inline-flex min-h-[3.25rem] items-center justify-center gap-3 rounded-box bg-gold px-6 text-base font-semibold text-[#170F09] hover:bg-[#D5AF57]"
          >
            <Download className="h-5 w-5" aria-hidden="true" /> Download
          </a>
        )}
        {/* Telegram users share from the bot chat, where the photo already is. */}
        {!inTelegram && (
          <Button variant="quiet" onClick={() => void share()}>
            <Share2 className="h-5 w-5" aria-hidden="true" /> Share
          </Button>
        )}
      </div>
    </div>
  );
}
