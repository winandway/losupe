import type { Dict } from "@/i18n/es";

export function ShareLinks({ url, title, dict }: { url: string; title: string; dict: Dict }) {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  const links = [
    { name: "WhatsApp", href: `https://wa.me/?text=${t}%20${u}` },
    { name: "X", href: `https://x.com/intent/tweet?url=${u}&text=${t}` },
    { name: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
    { name: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}` },
  ];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-bold uppercase tracking-widest text-muted">
        {dict.article.share}
      </span>
      {links.map((l) => (
        <a
          key={l.name}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={dict.article.shareOn(l.name)}
          className="rounded-full border border-line px-3 py-1 text-xs font-semibold text-ink hover:bg-paper"
        >
          {l.name}
        </a>
      ))}
    </div>
  );
}
