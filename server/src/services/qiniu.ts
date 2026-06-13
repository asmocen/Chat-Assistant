export function isQiniuConfigured(): boolean {
  return Boolean(
    process.env.QINIU_ACCESS_KEY &&
      process.env.QINIU_SECRET_KEY &&
      process.env.QINIU_BUCKET,
  );
}

export function frameKeyFromHash(hash: string): string {
  return `frames/${hash}.jpg`;
}

export function cdnUrl(key: string): string {
  const domain = (process.env.QINIU_CDN_DOMAIN || '').replace(/\/$/, '');
  if (domain.startsWith('http')) return `${domain}/${key}`;
  if (domain) return `https://${domain}/${key}`;
  return `https://${process.env.QINIU_BUCKET}.qiniudn.com/${key}`;
}

/** Day 1: placeholder — full upload in Day 2 */
export async function resolveImageUrl(
  imageBase64?: string,
  _imageKey?: string,
): Promise<{ imageUrl: string | null; kodoHit: boolean; frameHash: string | null }> {
  if (!imageBase64 || !isQiniuConfigured()) {
    return { imageUrl: null, kodoHit: false, frameHash: null };
  }
  // Day 2: stat/upload to Kodo
  return { imageUrl: null, kodoHit: false, frameHash: null };
}
