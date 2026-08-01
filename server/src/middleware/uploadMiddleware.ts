import multer from 'multer';
import path from 'path';
import fs from 'fs';
import type { Request, Response, NextFunction } from 'express';

// Ensure upload directory exists
const uploadDir = process.env.UPLOAD_DIR || 'uploads';
const profilesDir = path.join(uploadDir, 'profiles');
const decksDir = path.join(uploadDir, 'decks');

[uploadDir, profilesDir, decksDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// -----------------------------------------------------------------------------
// Security: mimetype whitelist + extension mapping.
// Never derive the extension from originalname (user-controlled → could be
// `photo.php` even with mimetype "image/jpeg"). Always use our own whitelist.
// -----------------------------------------------------------------------------
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
};

const ALLOWED_MIMES = Object.keys(MIME_TO_EXT);

// Storage configuration
const storage = multer.diskStorage({
  destination: (_req, file, cb) => {
    if (file.fieldname === 'profile_picture') {
      cb(null, profilesDir);
    } else if (file.fieldname === 'cover_image') {
      cb(null, decksDir);
    } else {
      cb(null, uploadDir);
    }
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    // Extension from mimetype whitelist, never from user-supplied originalname
    const ext = MIME_TO_EXT[file.mimetype] || '';
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  },
});

// File filter (only images from whitelist)
const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (ALLOWED_MIMES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (JPEG, PNG, GIF, WebP)'));
  }
};

// Multer instance
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '5242880'), // 5MB default
  },
});

// -----------------------------------------------------------------------------
// Magic bytes verification.
// mimetype from Content-Type header is client-controlled and spoofable.
// We check the first bytes of the file to confirm the declared type.
// -----------------------------------------------------------------------------
type ImageKind = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

/**
 * Detects real image type from magic bytes.
 * Returns the detected MIME or null if unknown / not an image.
 */
function detectImageType(buffer: Buffer): ImageKind | null {
  if (buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }
  // GIF87a / GIF89a
  if (buffer.slice(0, 6).toString('ascii').match(/^GIF8[79]a$/)) {
    return 'image/gif';
  }
  // WebP: "RIFF" ???? "WEBP"
  if (
    buffer.slice(0, 4).toString('ascii') === 'RIFF' &&
    buffer.slice(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

/**
 * Middleware to run AFTER multer disk storage. Reads the first 32 bytes of the
 * uploaded file and validates magic bytes match the declared mimetype.
 * On mismatch: unlink the file and respond 400.
 */
export function verifyDiskUploadMagicBytes(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.file || !req.file.path) {
    next();
    return;
  }

  let fd: number | null = null;
  try {
    fd = fs.openSync(req.file.path, 'r');
    const buffer = Buffer.alloc(32);
    fs.readSync(fd, buffer, 0, 32, 0);
    fs.closeSync(fd);
    fd = null;

    const detected = detectImageType(buffer);
    // JPEG can be declared as image/jpg — normalize
    const declared = req.file.mimetype === 'image/jpg' ? 'image/jpeg' : req.file.mimetype;

    if (!detected || detected !== declared) {
      // Cleanup the malicious/misdeclared file
      try {
        fs.unlinkSync(req.file.path);
      } catch {
        /* ignore cleanup errors */
      }
      res.status(400).json({
        error: 'Fichier invalide : le contenu ne correspond pas au type déclaré.',
      });
      return;
    }

    next();
  } catch (err) {
    if (fd !== null) {
      try {
        fs.closeSync(fd);
      } catch {
        /* ignore */
      }
    }
    // Cleanup on error
    if (req.file?.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch {
        /* ignore */
      }
    }
    next(err);
  }
}

/**
 * Same check but for in-memory uploads (card scan) — buffer is on req.file.buffer.
 */
export function verifyMemoryUploadMagicBytes(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.file || !req.file.buffer) {
    next();
    return;
  }

  const detected = detectImageType(req.file.buffer);
  const declared = req.file.mimetype === 'image/jpg' ? 'image/jpeg' : req.file.mimetype;

  if (!detected || detected !== declared) {
    res.status(400).json({
      error: 'Fichier invalide : le contenu ne correspond pas au type déclaré.',
    });
    return;
  }

  next();
}

export const uploadProfilePicture = upload.single('profile_picture');
export const uploadDeckCover = upload.single('cover_image');
export const uploadCardImage = upload.single('card_image');

// Ephemeral in-memory upload for card scanning (photo is never written to disk).
// Limite a 8 MB : les photos iPhone/Android modernes font souvent 2-5 MB en
// JPEG haute qualite. 8 MB donne de la marge sans permettre de bombers un
// serveur avec des PNG geants (Claude Vision refuse au-dela de ~5 MB de base64
// de toute facon).
const scanUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: 8 * 1024 * 1024, // 8 MB max for scan photos
  },
});

/**
 * Wrapper autour de multer scan : intercepte les erreurs multer (LIMIT_FILE_SIZE,
 * fileFilter reject, etc.) et les traduit en 200 + { success: false, error }
 * pour le mobile — au lieu de laisser errorHandler mask le message en prod.
 */
export const uploadCardScan = (req: Request, res: Response, next: NextFunction): void => {
  scanUpload.single('photo')(req, res, (err: any) => {
    if (!err) return next();
    let message = 'Upload de la photo echoue';
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = 'Photo trop volumineuse (max 8 Mo). Reduisez la qualite dans les reglages appareil photo ou reprends une photo plus rapprochee.';
    } else if (err.message) {
      message = err.message;
    }
    res.json({
      success: false,
      error: message,
      remainingScans: undefined,
    });
  });
};

export default upload;
