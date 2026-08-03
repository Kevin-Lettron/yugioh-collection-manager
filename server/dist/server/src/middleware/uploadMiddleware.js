"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadCardScan = exports.uploadCardImage = exports.uploadDeckCover = exports.uploadProfilePicture = void 0;
exports.verifyDiskUploadMagicBytes = verifyDiskUploadMagicBytes;
exports.verifyMemoryUploadMagicBytes = verifyMemoryUploadMagicBytes;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// Ensure upload directory exists
const uploadDir = process.env.UPLOAD_DIR || 'uploads';
const profilesDir = path_1.default.join(uploadDir, 'profiles');
const decksDir = path_1.default.join(uploadDir, 'decks');
[uploadDir, profilesDir, decksDir].forEach((dir) => {
    if (!fs_1.default.existsSync(dir)) {
        fs_1.default.mkdirSync(dir, { recursive: true });
    }
});
// -----------------------------------------------------------------------------
// Security: mimetype whitelist + extension mapping.
// Never derive the extension from originalname (user-controlled → could be
// `photo.php` even with mimetype "image/jpeg"). Always use our own whitelist.
// -----------------------------------------------------------------------------
const MIME_TO_EXT = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
};
const ALLOWED_MIMES = Object.keys(MIME_TO_EXT);
// Storage configuration
const storage = multer_1.default.diskStorage({
    destination: (_req, file, cb) => {
        if (file.fieldname === 'profile_picture') {
            cb(null, profilesDir);
        }
        else if (file.fieldname === 'cover_image') {
            cb(null, decksDir);
        }
        else {
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
const fileFilter = (_req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype)) {
        cb(null, true);
    }
    else {
        cb(new Error('Only image files are allowed (JPEG, PNG, GIF, WebP)'));
    }
};
// Multer instance
const upload = (0, multer_1.default)({
    storage,
    fileFilter,
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE || '5242880'), // 5MB default
    },
});
/**
 * Detects real image type from magic bytes.
 * Returns the detected MIME or null if unknown / not an image.
 */
function detectImageType(buffer) {
    if (buffer.length < 12)
        return null;
    // JPEG: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
        return 'image/jpeg';
    }
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47 &&
        buffer[4] === 0x0d &&
        buffer[5] === 0x0a &&
        buffer[6] === 0x1a &&
        buffer[7] === 0x0a) {
        return 'image/png';
    }
    // GIF87a / GIF89a
    if (buffer.slice(0, 6).toString('ascii').match(/^GIF8[79]a$/)) {
        return 'image/gif';
    }
    // WebP: "RIFF" ???? "WEBP"
    if (buffer.slice(0, 4).toString('ascii') === 'RIFF' &&
        buffer.slice(8, 12).toString('ascii') === 'WEBP') {
        return 'image/webp';
    }
    return null;
}
/**
 * Middleware to run AFTER multer disk storage. Reads the first 32 bytes of the
 * uploaded file and validates magic bytes match the declared mimetype.
 * On mismatch: unlink the file and respond 400.
 */
function verifyDiskUploadMagicBytes(req, res, next) {
    if (!req.file || !req.file.path) {
        next();
        return;
    }
    let fd = null;
    try {
        fd = fs_1.default.openSync(req.file.path, 'r');
        const buffer = Buffer.alloc(32);
        fs_1.default.readSync(fd, buffer, 0, 32, 0);
        fs_1.default.closeSync(fd);
        fd = null;
        const detected = detectImageType(buffer);
        // JPEG can be declared as image/jpg — normalize
        const declared = req.file.mimetype === 'image/jpg' ? 'image/jpeg' : req.file.mimetype;
        if (!detected || detected !== declared) {
            // Cleanup the malicious/misdeclared file
            try {
                fs_1.default.unlinkSync(req.file.path);
            }
            catch {
                /* ignore cleanup errors */
            }
            res.status(400).json({
                error: 'Fichier invalide : le contenu ne correspond pas au type déclaré.',
            });
            return;
        }
        next();
    }
    catch (err) {
        if (fd !== null) {
            try {
                fs_1.default.closeSync(fd);
            }
            catch {
                /* ignore */
            }
        }
        // Cleanup on error
        if (req.file?.path) {
            try {
                fs_1.default.unlinkSync(req.file.path);
            }
            catch {
                /* ignore */
            }
        }
        next(err);
    }
}
/**
 * Same check but for in-memory uploads (card scan) — buffer is on req.file.buffer.
 */
function verifyMemoryUploadMagicBytes(req, res, next) {
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
exports.uploadProfilePicture = upload.single('profile_picture');
exports.uploadDeckCover = upload.single('cover_image');
exports.uploadCardImage = upload.single('card_image');
// Ephemeral in-memory upload for card scanning (photo is never written to disk).
//
// La limite Anthropic (~5 MB de base64) n'est PAS la contrainte : la photo passe
// par preprocessCardImage (sharp) qui la redimensionne a 1600 px et la reencode
// en JPEG 92 % avant l'appel a Claude. Quelle que soit la taille entrante, ce qui
// part vers l'API fait quelques centaines de Ko. Cette limite ne protege donc que
// la memoire du serveur pendant l'upload.
//
// 20 MB couvre les capteurs 50-200 Mpx des telephones recents en pleine qualite.
//
// /!\ nginx impose sa propre limite en amont (`client_max_body_size`, 10M dans
// DEPLOYMENT-GUIDE.md). Au-dela, nginx renvoie un 413 AVANT que Node ne voie la
// requete, et l'utilisateur n'a pas le message ci-dessous. Les deux valeurs
// doivent etre relevees ensemble.
const MAX_SCAN_BYTES = parseInt(process.env.MAX_SCAN_FILE_SIZE || String(20 * 1024 * 1024), 10);
const scanUpload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    fileFilter,
    limits: {
        fileSize: MAX_SCAN_BYTES,
    },
});
/**
 * Wrapper autour de multer scan : intercepte les erreurs multer (LIMIT_FILE_SIZE,
 * fileFilter reject, etc.) et les traduit en 200 + { success: false, error }
 * pour le mobile — au lieu de laisser errorHandler mask le message en prod.
 */
const uploadCardScan = (req, res, next) => {
    scanUpload.single('photo')(req, res, (err) => {
        if (!err)
            return next();
        let message = 'Upload de la photo echoue';
        if (err.code === 'LIMIT_FILE_SIZE') {
            const maxMo = Math.round(MAX_SCAN_BYTES / (1024 * 1024));
            message = `Photo trop volumineuse (max ${maxMo} Mo). Reduisez la qualite dans les reglages appareil photo ou reprends une photo plus rapprochee.`;
        }
        else if (err.message) {
            message = err.message;
        }
        res.json({
            success: false,
            error: message,
            remainingScans: undefined,
        });
    });
};
exports.uploadCardScan = uploadCardScan;
exports.default = upload;
