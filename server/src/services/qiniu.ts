import crypto from 'crypto';
import qiniu from 'qiniu';

export function isQiniuConfigured(): boolean {
  return Boolean(
    process.env.QINIU_ACCESS_KEY &&
      process.env.QINIU_SECRET_KEY &&
      process.env.QINIU_BUCKET,
  );
}

export function frameKeyFromHash(hash: string): string {
  return `frames/${hash.slice(0, 32)}.jpg`;
}

export function cdnUrl(key: string): string {
  const domain = (process.env.QINIU_CDN_DOMAIN || '').replace(/\/$/, '');
  if (domain.startsWith('http')) return `${domain}/${key}`;
  if (domain) return `https://${domain}/${key}`;
  return `https://${process.env.QINIU_BUCKET}.qiniudn.com/${key}`;
}

function decodeBase64Image(imageBase64: string): Buffer {
  const payload = imageBase64.startsWith('data:')
    ? imageBase64.slice(imageBase64.indexOf(',') + 1)
    : imageBase64;
  return Buffer.from(payload, 'base64');
}

export function hashFrameBuffer(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function getMac(): qiniu.auth.digest.Mac {
  return new qiniu.auth.digest.Mac(
    process.env.QINIU_ACCESS_KEY!,
    process.env.QINIU_SECRET_KEY!,
  );
}

function getBucket(): string {
  return process.env.QINIU_BUCKET!;
}

function statObject(key: string): Promise<boolean> {
  const mac = getMac();
  const config = new qiniu.conf.Config();
  const bucketManager = new qiniu.rs.BucketManager(mac, config);

  return new Promise((resolve, reject) => {
    bucketManager.stat(getBucket(), key, (err, _body, info) => {
      if (err) {
        reject(err);
        return;
      }
      if (info?.statusCode === 200) {
        resolve(true);
        return;
      }
      if (info?.statusCode === 612) {
        resolve(false);
        return;
      }
      reject(new Error(`Kodo stat failed: ${info?.statusCode ?? 'unknown'}`));
    });
  });
}

function uploadObject(key: string, buffer: Buffer): Promise<void> {
  const mac = getMac();
  const config = new qiniu.conf.Config();
  const formUploader = new qiniu.form_up.FormUploader(config);
  const putExtra = new qiniu.form_up.PutExtra();
  const putPolicy = new qiniu.rs.PutPolicy({ scope: getBucket() });
  const uploadToken = putPolicy.uploadToken(mac);

  return new Promise((resolve, reject) => {
    formUploader.put(uploadToken, key, buffer, putExtra, (err, _body, info) => {
      if (err) {
        reject(err);
        return;
      }
      if (info?.statusCode === 200) {
        resolve();
        return;
      }
      reject(new Error(`Kodo upload failed: ${info?.statusCode ?? 'unknown'}`));
    });
  });
}

async function resolveByKey(key: string, frameHash: string | null): Promise<{
  imageUrl: string;
  kodoHit: boolean;
  frameHash: string | null;
}> {
  const exists = await statObject(key);
  if (!exists) {
    throw new Error(`Kodo 对象不存在: ${key}`);
  }
  return {
    imageUrl: cdnUrl(key),
    kodoHit: true,
    frameHash,
  };
}

/** Stat/upload frame to Kodo and return CDN URL for LLM (server-side upload). */
export async function resolveImageUrl(
  imageBase64?: string,
  imageKey?: string,
): Promise<{ imageUrl: string | null; kodoHit: boolean; frameHash: string | null }> {
  if (!isQiniuConfigured()) {
    return { imageUrl: null, kodoHit: false, frameHash: null };
  }

  if (imageKey?.trim()) {
    const key = imageKey.trim();
    const hashMatch = key.match(/^frames\/([a-f0-9]{32})\.jpg$/i);
    const frameHash = hashMatch?.[1] ?? null;
    return resolveByKey(key, frameHash);
  }

  if (!imageBase64) {
    return { imageUrl: null, kodoHit: false, frameHash: null };
  }

  const buffer = decodeBase64Image(imageBase64);
  const frameHash = hashFrameBuffer(buffer);
  const key = frameKeyFromHash(frameHash);

  const exists = await statObject(key);
  if (exists) {
    return {
      imageUrl: cdnUrl(key),
      kodoHit: true,
      frameHash: frameHash.slice(0, 32),
    };
  }

  await uploadObject(key, buffer);
  return {
    imageUrl: cdnUrl(key),
    kodoHit: false,
    frameHash: frameHash.slice(0, 32),
  };
}
