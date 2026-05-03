import sharp from 'sharp';

export type ExtractedImageMetadata = {
  width: number | null;
  height: number | null;
  blurDataURL: string | null;
};

/**
 * Read dimensions and (optionally) a tiny JPEG blur data URL for LQIP /
 * next/image placeholders. Soft-fails individual steps so uploads can still
 * succeed without blur or dimensions.
 *
 * Pass `{ generateBlur: false }` to skip blur generation — useful when the
 * uploader unchecks "Generate blur placeholder" in the upload dialog (saves
 * a few KB per entry and a bit of upload-time CPU).
 */
export async function extractImageMetadata(
  buffer: Buffer,
  options: { generateBlur?: boolean } = {},
): Promise<ExtractedImageMetadata> {
  const { generateBlur = true } = options;
  let width: number | null = null;
  let height: number | null = null;
  let blurDataURL: string | null = null;

  try {
    const meta = await sharp(buffer).metadata();
    if (typeof meta.width === 'number' && meta.width > 0) width = meta.width;
    if (typeof meta.height === 'number' && meta.height > 0) height = meta.height;
  } catch {
    /* unreadable as image — leave nulls */
  }

  if (generateBlur) {
    try {
      const blurred = await sharp(buffer).resize(10, 10, { fit: 'inside' }).jpeg({ quality: 60 }).toBuffer();
      blurDataURL = `data:image/jpeg;base64,${blurred.toString('base64')}`;
    } catch {
      /* blur optional */
    }
  }

  return { width, height, blurDataURL };
}
