/** Max upload size in bytes. GridFS has no 16 MB document cap. Override with MAX_UPLOAD_SIZE_MB (default 1024 = 1 GB). */
function resolveMaxUploadMb(): number {
  const raw = process.env.MAX_UPLOAD_SIZE_MB;
  const parsed = parseInt(String(raw ?? '1024'), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1024;
}

export const MAX_UPLOAD_MB = resolveMaxUploadMb();
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

/** Human-readable limit for API error messages (French). */
export const MAX_UPLOAD_LABEL =
  MAX_UPLOAD_MB % 1024 === 0 ? `${MAX_UPLOAD_MB / 1024} Go` : `${MAX_UPLOAD_MB} Mo`;

export const GRIDFS_BUCKET = 'media_files';
