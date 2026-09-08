const path = require("path");
const fs = require("fs");
const multer = require("multer");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

const useMemory = Boolean(process.env.VERCEL) || process.env.UPLOAD_DRIVER === "memory";

function storageFor(folder) {
  if (useMemory) {
    return multer.memoryStorage();
  }
  const dest = path.join(process.env.UPLOAD_DIR || "uploads", folder);
  ensureDir(dest);
  return multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dest),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "").toLowerCase() || ".jpg";
      cb(null, `${folder}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    },
  });
}

function fileFilter(_req, file, cb) {
  const ok = /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype);
  cb(ok ? null : new Error("Only image files are allowed"), ok);
}

const limits = { fileSize: 2 * 1024 * 1024 };

const uploadPackage = multer({ storage: storageFor("packages"), fileFilter, limits });
const uploadDestination = multer({ storage: storageFor("destinations"), fileFilter, limits });
const uploadAvatar = multer({ storage: storageFor("avatars"), fileFilter, limits });
const uploadAgent = multer({ storage: storageFor("agents"), fileFilter, limits });

module.exports = { uploadPackage, uploadDestination, uploadAvatar, uploadAgent };
