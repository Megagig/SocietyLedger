import sharp from 'sharp';
import { prisma } from '../lib/prisma';
import { deleteFile, getStablePresignedUrl, uploadFile } from '../lib/storage';

/** What the cleaned photo looks like: a square for the profile screens and a small one for lists. */
export const PHOTO_SIZE = 512;
export const THUMB_SIZE = 128;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ACCEPTED_FORMATS = new Set(['jpeg', 'png', 'webp']);
/** Guards against a tiny file that decodes to an enormous image (a decompression bomb). */
const MAX_INPUT_PIXELS = 40_000_000;

export class PhotoError extends Error {
  constructor(readonly code: 'INVALID_IMAGE' | 'FILE_TOO_LARGE' | 'MEMBER_NOT_FOUND', message: string) {
    super(message);
  }
}

export interface ProcessedPhoto {
  photo: Buffer;
  thumb: Buffer;
}

/**
 * Checks the real file (not its name or the type the client claims), straightens it, crops it to a centred square and re-encodes it.
 * Re-encoding drops everything the phone attached to the picture, including GPS location and device details.
 */
export async function processPhoto(input: Buffer): Promise<ProcessedPhoto> {
  if (input.length > MAX_PHOTO_BYTES) throw new PhotoError('FILE_TOO_LARGE', 'The photo is larger than 5MB.');

  let format: string | undefined;
  try {
    format = (await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS }).metadata()).format;
  } catch {
    throw new PhotoError('INVALID_IMAGE', 'That file is not a picture we can read. Use a JPEG, PNG or WebP photo.');
  }
  if (!format || !ACCEPTED_FORMATS.has(format)) {
    throw new PhotoError('INVALID_IMAGE', 'Use a JPEG, PNG or WebP photo.');
  }

  const base = () => sharp(input, { limitInputPixels: MAX_INPUT_PIXELS }).rotate();
  try {
    const [photo, thumb] = await Promise.all([
      base().resize(PHOTO_SIZE, PHOTO_SIZE, { fit: 'cover', position: 'attention' }).jpeg({ quality: 82, mozjpeg: true }).toBuffer(),
      base().resize(THUMB_SIZE, THUMB_SIZE, { fit: 'cover', position: 'attention' }).jpeg({ quality: 78, mozjpeg: true }).toBuffer(),
    ]);
    return { photo, thumb };
  } catch {
    throw new PhotoError('INVALID_IMAGE', 'That file is not a picture we can read. Use a JPEG, PNG or WebP photo.');
  }
}

/**
 * Keys carry the upload time, so a replaced photo gets a brand-new address and phones and browsers
 * that cached the old picture fetch the new one straight away.
 */
export function photoKeys(associationId: number, memberId: number, at: number = Date.now()): { photoKey: string; photoThumbKey: string } {
  return {
    photoKey: `members/${associationId}/${memberId}/photo-${at}.jpg`,
    photoThumbKey: `members/${associationId}/${memberId}/thumb-${at}.jpg`,
  };
}

/** Saves a member's photo, replacing any earlier one. The caller has already decided who is allowed to do this. */
export async function setMemberPhoto(associationId: number, memberId: number, input: Buffer): Promise<void> {
  const member = await prisma.member.findFirst({ where: { id: memberId, associationId }, select: { id: true, photoKey: true, photoThumbKey: true } });
  if (!member) throw new PhotoError('MEMBER_NOT_FOUND', 'Member not found');

  const { photo, thumb } = await processPhoto(input);
  const keys = photoKeys(associationId, memberId);
  await uploadFile(keys.photoKey, photo, 'image/jpeg');
  try {
    await uploadFile(keys.photoThumbKey, thumb, 'image/jpeg');
    await prisma.member.update({ where: { id: memberId }, data: { ...keys, photoUpdatedAt: new Date() } });
  } catch (error) {
    await Promise.all([deleteFile(keys.photoKey), deleteFile(keys.photoThumbKey)]);
    throw error;
  }
  await Promise.all([member.photoKey && deleteFile(member.photoKey), member.photoThumbKey && deleteFile(member.photoThumbKey)]);
}

/** Back to initials. Safe to call when there is no photo. */
export async function removeMemberPhoto(associationId: number, memberId: number): Promise<void> {
  const member = await prisma.member.findFirst({ where: { id: memberId, associationId }, select: { id: true, photoKey: true, photoThumbKey: true } });
  if (!member) throw new PhotoError('MEMBER_NOT_FOUND', 'Member not found');
  await prisma.member.update({ where: { id: memberId }, data: { photoKey: null, photoThumbKey: null, photoUpdatedAt: null } });
  await Promise.all([member.photoKey && deleteFile(member.photoKey), member.photoThumbKey && deleteFile(member.photoThumbKey)]);
}

type WithPhotoKeys = { photoKey?: string | null; photoThumbKey?: string | null; photoUpdatedAt?: Date | string | null };

/**
 * Turns a member row's storage keys into links the apps can use, and removes the keys themselves from what is sent out.
 * Anything without a photo gets `photoUrl: null`, which is the apps' cue to show initials.
 */
export async function presentMemberPhoto<T extends WithPhotoKeys>(
  member: T,
  requestHost?: string,
): Promise<Omit<T, 'photoKey' | 'photoThumbKey'> & { photoUrl: string | null; thumbUrl: string | null }> {
  const { photoKey, photoThumbKey, ...rest } = member;
  let photoUrl: string | null = null;
  let thumbUrl: string | null = null;
  if (photoKey) {
    try {
      [photoUrl, thumbUrl] = await Promise.all([
        getStablePresignedUrl(photoKey, requestHost),
        photoThumbKey ? getStablePresignedUrl(photoThumbKey, requestHost) : Promise.resolve(null),
      ]);
    } catch (error) {
      // A storage hiccup must never break a members list: show initials this time.
      console.error('[member-photo] could not sign photo link:', error);
    }
  }
  return { ...rest, photoUrl, thumbUrl };
}

/** `presentMemberPhoto` for a list. */
export function presentMemberPhotos<T extends WithPhotoKeys>(members: T[], requestHost?: string) {
  return Promise.all(members.map((m) => presentMemberPhoto(m, requestHost)));
}
