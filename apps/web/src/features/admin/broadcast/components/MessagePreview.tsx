/** Telegram's own dark-theme bubble colours, on purpose: this previews how the DM will look there, not in BookQuest. */
export function MessagePreview({ message }: { message: string }) {
  return (
    <figure className="m-0 flex flex-col gap-2">
      <figcaption className="type-label">In Telegram</figcaption>
      <div className="max-w-[22rem] self-start rounded-2xl rounded-bl-md bg-[#182533] px-3 py-2 text-[#f5f5f5]">
        <p className="m-0 text-sm font-semibold text-[#6ab3f3]">BookQuest</p>
        <p className="m-0 whitespace-pre-wrap break-words text-[0.95rem] leading-snug">{message}</p>
      </div>
    </figure>
  );
}
