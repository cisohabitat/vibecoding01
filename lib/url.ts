/** Returns the link if it is an absolute http(s) URL, else null. */
export function safeLink(link: string | undefined): string | null {
  if (!link) return null;
  try {
    const url = new URL(link.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}
