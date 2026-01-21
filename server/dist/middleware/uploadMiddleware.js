"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadCardImage = exports.uploadDeckCover = exports.uploadProfilePicture = void 0;
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
// Storage configuration
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        // Determine subfolder based on field name
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
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path_1.default.extname(file.originalname));
    },
});
// File filter (only images)
const fileFilter = (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
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
exports.uploadProfilePicture = upload.single('profile_picture');
exports.uploadDeckCover = upload.single('cover_image');
exports.uploadCardImage = upload.single('card_image');
exports.default = upload;
