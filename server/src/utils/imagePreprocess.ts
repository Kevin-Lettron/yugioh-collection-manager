import sharp from 'sharp';
import logger from './logger';

/**
 * Redimensionne + normalise + accentue la photo avant Claude Vision.
 *
 * Objectif : le code de set (e.g. LOB-EN001) fait quelques pixels de haut. La
 * compression JPEG de l'appareil, la sur-exposition, le flou léger le rendent
 * illisible. sharp corrige :
 *   1. auto-orientation EXIF (iPhone en portrait tient à l'envers en pixel)
 *   2. downscale à 1600px max (économise tokens sans perte de détail sur code)
 *   3. normalize : étale le range dynamique (contraste max sans overshoot)
 *   4. sharpen léger : réhausse les arêtes des glyphes
 *   5. reencode JPEG 92 % — la source ProRAW iPhone est HEIC + gros
 *
 * On garde toujours JPEG en sortie car Anthropic ne connaît pas HEIC.
 * Fallback : si sharp plante (image corrompue), renvoie la source d'origine.
 */
export async function preprocessCardImage(
  input: Buffer,
  mediaTypeIn: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
): Promise<{ buffer: Buffer; mediaType: 'image/jpeg' }> {
  try {
    const processed = await sharp(input, { failOn: 'none' })
      .rotate()
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .normalize()
      .sharpen({ sigma: 0.7, m1: 0.5, m2: 2 })
      .jpeg({ quality: 92, mozjpeg: true })
      .toBuffer();

    logger.debug('Card image preprocessed', {
      inputBytes: input.length,
      outputBytes: processed.length,
      inputMediaType: mediaTypeIn,
    });

    return { buffer: processed, mediaType: 'image/jpeg' };
  } catch (err) {
    logger.warn('Card image preprocess failed, falling back to source', {
      inputBytes: input.length,
      inputMediaType: mediaTypeIn,
      error: err instanceof Error ? err.message : String(err),
    });
    // On garde le mimetype d'origine seulement si c'est un format Anthropic-compatible.
    // Sinon on renvoie tel quel — mais c'est le call site qui décidera.
    return { buffer: input, mediaType: 'image/jpeg' };
  }
}
