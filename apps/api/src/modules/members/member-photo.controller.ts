import type { NextFunction, Request, RequestHandler, Response } from 'express';
import multer from 'multer';
import { prisma } from '../../lib/prisma';
import { MAX_PHOTO_BYTES, PhotoError, presentMemberPhoto, removeMemberPhoto, setMemberPhoto } from '../../services/member-photo.service';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_PHOTO_BYTES, files: 1 } });

/** Reads the picture from the `photo` field. A bad or oversized file is answered here, before any processing. */
export const photoUpload: RequestHandler = (req, res, next) => {
  upload.single('photo')(req, res, (error: unknown) => {
    if (!error) return next();
    const tooLarge = error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE';
    res.status(400).json({
      success: false,
      code: tooLarge ? 'FILE_TOO_LARGE' : 'INVALID_FILE',
      message: tooLarge ? 'The photo is larger than 5MB.' : 'Choose one JPEG, PNG or WebP photo.',
    });
  });
};

function fail(res: Response, error: unknown) {
  if (error instanceof PhotoError) {
    const status = error.code === 'MEMBER_NOT_FOUND' ? 404 : 400;
    return res.status(status).json({ success: false, code: error.code, message: error.message });
  }
  console.error('[member-photo] error:', error);
  return res.status(500).json({ success: false, message: 'Could not update the photo. Try again.' });
}

async function audit(req: Request, associationId: number, memberId: number, action: 'MEMBER_PHOTO_SET' | 'MEMBER_PHOTO_REMOVED') {
  const userId = req.user?.id;
  if (!userId) return;
  try {
    await prisma.auditLog.create({
      data: { associationId, userId, action, tableName: 'members', recordId: memberId, newValues: { by: userId } },
    });
  } catch (error) {
    // The photo is already saved; a failed audit write must not report the whole action as failed.
    console.error('[member-photo] audit log failed:', error);
  }
}

/** The member row for the signed-in user, or null when their login is not linked to a member. */
async function ownMemberId(req: Request): Promise<number | null> {
  const associationId = req.user?.associationId;
  const userId = req.user?.id;
  if (!associationId || !userId) return null;
  const member = await prisma.member.findFirst({ where: { associationId, userId }, select: { id: true } });
  return member?.id ?? null;
}

async function respondWithMember(req: Request, res: Response, memberId: number) {
  const member = await prisma.member.findUniqueOrThrow({
    where: { id: memberId },
    select: { id: true, photoKey: true, photoThumbKey: true, photoUpdatedAt: true },
  });
  const { id, photoUrl, thumbUrl, photoUpdatedAt } = await presentMemberPhoto(member, req.hostname);
  return res.status(200).json({ success: true, data: { id, photoUrl, thumbUrl, photoUpdatedAt } });
}

async function save(req: Request, res: Response, associationId: number, memberId: number) {
  if (!req.file) return res.status(400).json({ success: false, code: 'INVALID_FILE', message: 'Choose a photo to upload.' });
  try {
    await setMemberPhoto(associationId, memberId, req.file.buffer);
    await audit(req, associationId, memberId, 'MEMBER_PHOTO_SET');
    return await respondWithMember(req, res, memberId);
  } catch (error) {
    return fail(res, error);
  }
}

async function clear(req: Request, res: Response, associationId: number, memberId: number) {
  try {
    await removeMemberPhoto(associationId, memberId);
    await audit(req, associationId, memberId, 'MEMBER_PHOTO_REMOVED');
    return await respondWithMember(req, res, memberId);
  } catch (error) {
    return fail(res, error);
  }
}

export const memberPhotoController = {
  /** PUT /members/me/photo: a member sets their own photo. */
  async setMine(req: Request, res: Response, _next?: NextFunction) {
    const associationId = req.user?.associationId;
    const memberId = await ownMemberId(req);
    if (!associationId || !memberId) return res.status(404).json({ success: false, message: 'Your login is not linked to a member profile.' });
    return save(req, res, associationId, memberId);
  },

  /** DELETE /members/me/photo */
  async removeMine(req: Request, res: Response) {
    const associationId = req.user?.associationId;
    const memberId = await ownMemberId(req);
    if (!associationId || !memberId) return res.status(404).json({ success: false, message: 'Your login is not linked to a member profile.' });
    return clear(req, res, associationId, memberId);
  },

  /** PUT /members/:id/photo: an admin sets a member's photo. The association check is inside the service lookups. */
  async setFor(req: Request, res: Response) {
    const associationId = req.user?.associationId;
    const memberId = Number(req.params.id);
    if (!associationId || !Number.isInteger(memberId)) return res.status(400).json({ success: false, message: 'Member id is required' });
    return save(req, res, associationId, memberId);
  },

  /** DELETE /members/:id/photo */
  async removeFor(req: Request, res: Response) {
    const associationId = req.user?.associationId;
    const memberId = Number(req.params.id);
    if (!associationId || !Number.isInteger(memberId)) return res.status(400).json({ success: false, message: 'Member id is required' });
    return clear(req, res, associationId, memberId);
  },
};
