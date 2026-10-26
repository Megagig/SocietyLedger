/**
 * Member profile photos: the server must clean whatever it is sent, and the links it hands out must be private, stable and never leak keys.
 * Uses the real image library and real URL signing; only the database and the storage upload are replaced.
 */
process.env.MINIO_ENDPOINT = 'http://minio.test:9000';
process.env.MINIO_ACCESS_KEY = 'test-access';
process.env.MINIO_SECRET_KEY = 'test-secret';
process.env.MINIO_BUCKET = 'test-bucket';

const mockMember = {
  findFirst: jest.fn(),
  update: jest.fn(),
};
jest.mock('../../src/lib/prisma', () => ({ prisma: { member: mockMember } }));

const mockUpload = jest.fn(async (key: string) => key);
const mockDelete = jest.fn(async () => undefined);
jest.mock('../../src/lib/storage', () => {
  const actual = jest.requireActual('../../src/lib/storage');
  return { ...actual, uploadFile: (...a: unknown[]) => mockUpload(...(a as [string])), deleteFile: (...a: unknown[]) => mockDelete(...(a as [])) };
});

import sharp from 'sharp';
import { getStablePresignedUrl, STABLE_URL_WINDOW_SECONDS } from '../../src/lib/storage';
import {
  MAX_PHOTO_BYTES,
  PHOTO_SIZE,
  PhotoError,
  THUMB_SIZE,
  photoKeys,
  presentMemberPhoto,
  processPhoto,
  removeMemberPhoto,
  setMemberPhoto,
} from '../../src/services/member-photo.service';

async function picture(width: number, height: number, format: 'jpeg' | 'png' | 'webp' = 'jpeg', extra?: (s: sharp.Sharp) => sharp.Sharp) {
  let image = sharp({ create: { width, height, channels: 3, background: '#336699' } });
  if (extra) image = extra(image);
  return image[format]().toBuffer();
}

beforeEach(() => {
  mockMember.findFirst.mockReset();
  mockMember.update.mockReset();
  mockUpload.mockClear();
  mockDelete.mockClear();
});

describe('processPhoto', () => {
  it('crops any shape to a square profile photo and a small thumbnail', async () => {
    const { photo, thumb } = await processPhoto(await picture(900, 600));
    const [p, t] = await Promise.all([sharp(photo).metadata(), sharp(thumb).metadata()]);
    expect([p.width, p.height, p.format]).toEqual([PHOTO_SIZE, PHOTO_SIZE, 'jpeg']);
    expect([t.width, t.height, t.format]).toEqual([THUMB_SIZE, THUMB_SIZE, 'jpeg']);
    expect(thumb.length).toBeLessThan(photo.length);
  });

  it.each(['png', 'webp'] as const)('accepts %s', async (format) => {
    const { photo } = await processPhoto(await picture(300, 300, format));
    expect((await sharp(photo).metadata()).format).toBe('jpeg');
  });

  it('removes the location and device details a phone attaches', async () => {
    const withExif = await picture(400, 400, 'jpeg', (s) => s.withExif({ IFD0: { Make: 'SecretPhoneBrand', Copyright: 'someone' } }));
    expect((await sharp(withExif).metadata()).exif).toBeDefined();
    const { photo, thumb } = await processPhoto(withExif);
    expect((await sharp(photo).metadata()).exif).toBeUndefined();
    expect((await sharp(thumb).metadata()).exif).toBeUndefined();
    expect(photo.toString('latin1')).not.toContain('SecretPhoneBrand');
  });

  it('straightens a photo that was taken sideways', async () => {
    const sideways = await sharp({ create: { width: 800, height: 400, channels: 3, background: '#336699' } })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    const { photo } = await processPhoto(sideways);
    const meta = await sharp(photo).metadata();
    expect([meta.width, meta.height]).toEqual([PHOTO_SIZE, PHOTO_SIZE]);
    expect(meta.orientation === undefined || meta.orientation === 1).toBe(true);
  });

  it('refuses a file that is not a picture, whatever it is called', async () => {
    await expect(processPhoto(Buffer.from('%PDF-1.4 not an image at all'))).rejects.toMatchObject({ code: 'INVALID_IMAGE' });
    await expect(processPhoto(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>'))).rejects.toMatchObject({ code: 'INVALID_IMAGE' });
  });

  it('refuses a picture in a format we do not accept', async () => {
    const gif = await sharp({ create: { width: 20, height: 20, channels: 3, background: '#fff' } }).gif().toBuffer();
    await expect(processPhoto(gif)).rejects.toMatchObject({ code: 'INVALID_IMAGE' });
  });

  it('refuses a file over 5MB', async () => {
    await expect(processPhoto(Buffer.alloc(MAX_PHOTO_BYTES + 1))).rejects.toMatchObject({ code: 'FILE_TOO_LARGE' });
  });

  it('throws PhotoError so the route can answer with a clear message', async () => {
    await expect(processPhoto(Buffer.from('nope'))).rejects.toBeInstanceOf(PhotoError);
  });
});

describe('photoKeys', () => {
  it('keeps each association and member apart and changes with every upload', () => {
    const a = photoKeys(5, 9, 1000);
    const b = photoKeys(5, 9, 2000);
    expect(a.photoKey).toBe('members/5/9/photo-1000.jpg');
    expect(a.photoThumbKey).toBe('members/5/9/thumb-1000.jpg');
    expect(a.photoKey).not.toBe(b.photoKey);
    expect(photoKeys(6, 9, 1000).photoKey).not.toBe(a.photoKey);
  });
});

describe('setMemberPhoto and removeMemberPhoto', () => {
  it('stores both sizes, saves the keys, and deletes the previous photo', async () => {
    mockMember.findFirst.mockResolvedValue({ id: 9, photoKey: 'members/5/9/photo-old.jpg', photoThumbKey: 'members/5/9/thumb-old.jpg' });
    mockMember.update.mockResolvedValue({});

    await setMemberPhoto(5, 9, await picture(500, 500));

    expect(mockUpload).toHaveBeenCalledTimes(2);
    const data = mockMember.update.mock.calls[0][0].data;
    expect(data.photoKey).toMatch(/^members\/5\/9\/photo-\d+\.jpg$/);
    expect(data.photoThumbKey).toMatch(/^members\/5\/9\/thumb-\d+\.jpg$/);
    expect(data.photoUpdatedAt).toBeInstanceOf(Date);
    expect(mockDelete).toHaveBeenCalledWith('members/5/9/photo-old.jpg');
    expect(mockDelete).toHaveBeenCalledWith('members/5/9/thumb-old.jpg');
  });

  it('only looks inside the association it was given, so another association cannot be touched', async () => {
    mockMember.findFirst.mockResolvedValue(null);
    await expect(setMemberPhoto(5, 9, await picture(100, 100))).rejects.toMatchObject({ code: 'MEMBER_NOT_FOUND' });
    expect(mockMember.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 9, associationId: 5 } }));
    expect(mockUpload).not.toHaveBeenCalled();
    expect(mockMember.update).not.toHaveBeenCalled();
  });

  it('does not change anything when the file is not a picture', async () => {
    mockMember.findFirst.mockResolvedValue({ id: 9, photoKey: 'old', photoThumbKey: 'old-t' });
    await expect(setMemberPhoto(5, 9, Buffer.from('junk'))).rejects.toMatchObject({ code: 'INVALID_IMAGE' });
    expect(mockUpload).not.toHaveBeenCalled();
    expect(mockMember.update).not.toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('cleans up the new files and keeps the old photo when saving fails', async () => {
    mockMember.findFirst.mockResolvedValue({ id: 9, photoKey: 'old', photoThumbKey: 'old-t' });
    mockMember.update.mockRejectedValue(new Error('db down'));
    await expect(setMemberPhoto(5, 9, await picture(100, 100))).rejects.toThrow('db down');
    const deleted = mockDelete.mock.calls.map((c) => (c as unknown[])[0]);
    expect(deleted).not.toContain('old');
    expect(deleted).toHaveLength(2);
  });

  it('removing a photo clears the keys and deletes the files, and is harmless when there is none', async () => {
    mockMember.findFirst.mockResolvedValue({ id: 9, photoKey: 'p', photoThumbKey: 't' });
    mockMember.update.mockResolvedValue({});
    await removeMemberPhoto(5, 9);
    expect(mockMember.update).toHaveBeenCalledWith({ where: { id: 9 }, data: { photoKey: null, photoThumbKey: null, photoUpdatedAt: null } });
    expect(mockDelete).toHaveBeenCalledTimes(2);

    mockDelete.mockClear();
    mockMember.findFirst.mockResolvedValue({ id: 9, photoKey: null, photoThumbKey: null });
    await expect(removeMemberPhoto(5, 9)).resolves.toBeUndefined();
    expect(mockDelete).not.toHaveBeenCalled();
  });
});

describe('stable signed links', () => {
  const at = (iso: string) => new Date(iso);

  it('gives the identical link to everyone asking in the same six-hour window', async () => {
    const a = await getStablePresignedUrl('members/5/9/photo-1.jpg', undefined, at('2026-10-26T06:01:00Z'));
    const b = await getStablePresignedUrl('members/5/9/photo-1.jpg', undefined, at('2026-10-26T11:59:00Z'));
    expect(a).toBe(b);
  });

  it('gives a new link in the next window, and every link is valid for at least six hours', async () => {
    const a = await getStablePresignedUrl('members/5/9/photo-1.jpg', undefined, at('2026-10-26T11:59:00Z'));
    const b = await getStablePresignedUrl('members/5/9/photo-1.jpg', undefined, at('2026-10-26T12:01:00Z'));
    expect(a).not.toBe(b);
    const expires = Number(new URL(a).searchParams.get('X-Amz-Expires'));
    expect(expires).toBe(STABLE_URL_WINDOW_SECONDS * 2);
    expect(expires - STABLE_URL_WINDOW_SECONDS).toBeGreaterThanOrEqual(6 * 3600);
  });

  it('points at the right file and carries a signature', async () => {
    const url = new URL(await getStablePresignedUrl('members/5/9/photo-1.jpg', undefined, at('2026-10-26T06:01:00Z')));
    expect(url.pathname).toBe('/test-bucket/members/5/9/photo-1.jpg');
    expect(url.searchParams.get('X-Amz-Signature')).toBeTruthy();
  });
});

describe('presentMemberPhoto', () => {
  it('replaces the storage keys with links and never exposes the keys', async () => {
    const out = await presentMemberPhoto({ id: 9, firstName: 'Ada', photoKey: 'members/5/9/photo-1.jpg', photoThumbKey: 'members/5/9/thumb-1.jpg' });
    expect(out.photoUrl).toContain('/test-bucket/members/5/9/photo-1.jpg');
    expect(out.thumbUrl).toContain('/test-bucket/members/5/9/thumb-1.jpg');
    expect(out).not.toHaveProperty('photoKey');
    expect(out).not.toHaveProperty('photoThumbKey');
    expect(out.firstName).toBe('Ada');
  });

  it('gives null links when there is no photo, which is the cue to show initials', async () => {
    const out = await presentMemberPhoto({ id: 9, photoKey: null, photoThumbKey: null });
    expect(out.photoUrl).toBeNull();
    expect(out.thumbUrl).toBeNull();
  });
});
