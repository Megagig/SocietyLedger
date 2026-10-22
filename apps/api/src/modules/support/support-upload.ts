import { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { ALLOWED_ATTACHMENT_TYPES, MAX_ATTACHMENT_SIZE } from './support.types';

export const MAX_ATTACHMENTS = 3;

// Attachments go to memory; the controller streams each buffer to storage right after, so nothing lands on disk.
// Applied to create and reply only — a JSON request passes straight through (multer ignores non-multipart bodies).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_ATTACHMENT_SIZE, files: MAX_ATTACHMENTS },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_ATTACHMENT_TYPES.includes(file.mimetype)) cb(null, true);
    else cb(new Error('That file type is not supported. Attach a photo, a PDF or a common document.'));
  },
});

/** Runs multer and turns its failures into the 400 JSON the clients show, instead of a stack-trace 500. */
export function attachFiles(req: Request, res: Response, next: NextFunction) {
  upload.array('files', MAX_ATTACHMENTS)(req, res, (error: unknown) => {
    if (!error) return next();
    let message = error instanceof Error ? error.message : 'Could not read your files';
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') message = `Each file must be ${Math.round(MAX_ATTACHMENT_SIZE / 1024 / 1024)}MB or smaller.`;
      else if (error.code === 'LIMIT_FILE_COUNT' || error.code === 'LIMIT_UNEXPECTED_FILE') message = `You can attach up to ${MAX_ATTACHMENTS} files.`;
    }
    res.status(400).json({ success: false, error: message, message });
  });
}
