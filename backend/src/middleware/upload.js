const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = process.env.UPLOAD_PATH || './uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userDir = path.join(uploadDir, req.user?.id || 'temp');
    if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });
    cb(null, userDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF, JPG, and PNG files are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 },
});

module.exports = upload;
