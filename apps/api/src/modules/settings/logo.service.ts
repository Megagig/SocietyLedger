/**
 * Logo Upload Service
 * Phase 18: TASK-SET-007
 * 
 * Handles association logo upload with validation and processing
 */

import path from 'path';
import fs from 'fs/promises';
import prisma from '../../lib/prisma';

// Configuration
const UPLOAD_DIR = 'uploads/logos';
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_DIMENSIONS = { width: 500, height: 500 };

export interface LogoUploadResult {
  success: boolean;
  logoUrl?: string;
  message: string;
}

/** The file type read from the first bytes, so a renamed or mislabelled file is not taken for a picture. */
export function sniffImageType(buffer: Buffer): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return null;
}

const EXTENSIONS = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' } as const;

/** Removes an old logo file, but only one that really sits in the logo folder (a stored path is never trusted). */
async function removeLogoFile(logoUrl: string): Promise<void> {
  const root = path.resolve(process.cwd(), UPLOAD_DIR);
  const target = path.resolve(process.cwd(), logoUrl.replace(/^\/+/, ''));
  if (path.dirname(target) !== root) return;
  try {
    await fs.unlink(target);
  } catch {
    // Already gone
  }
}

export class LogoService {
  /**
   * Ensure upload directory exists
   */
  static async ensureUploadDir(): Promise<void> {
    try {
      await fs.access(UPLOAD_DIR);
    } catch {
      await fs.mkdir(UPLOAD_DIR, { recursive: true });
    }
  }

  /**
   * Validate uploaded file
   */
  static validateFile(file: Express.Multer.File): { valid: boolean; error?: string } {
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return { valid: false, error: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit` };
    }

    // Check file type: the label the phone sent, and what the bytes really are
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      return { valid: false, error: 'Use a JPEG, PNG or WebP picture.' };
    }
    if (sniffImageType(file.buffer) !== file.mimetype) {
      return { valid: false, error: 'That file is not a real JPEG, PNG or WebP picture.' };
    }

    return { valid: true };
  }

  /**
   * Upload and save logo for an association
   */
  static async uploadLogo(
    associationId: number,
    file: Express.Multer.File,
    userId: number
  ): Promise<LogoUploadResult> {
    // Validate file
    const validation = this.validateFile(file);
    if (!validation.valid) {
      return { success: false, message: validation.error! };
    }

    await this.ensureUploadDir();

    // Generate unique filename
    // The extension follows the checked type, never the uploaded name: the folder is served as-is, so an .html name must not survive.
    const ext = EXTENSIONS[file.mimetype as keyof typeof EXTENSIONS];
    const filename = `logo-${associationId}-${Date.now()}${ext}`;
    const filepath = path.join(UPLOAD_DIR, filename);

    try {
      // Get old logo for cleanup
      const association = await prisma.association.findUnique({
        where: { id: associationId },
        select: { logo: true }
      });

      // Save new file
      await fs.writeFile(filepath, file.buffer);

      // Generate URL (relative path for serving)
      const logoUrl = `/uploads/logos/${filename}`;

      // Update association
      await prisma.association.update({
        where: { id: associationId },
        data: { logo: logoUrl }
      });

      // Create audit log
      await prisma.auditLog.create({
        data: {
          associationId,
          userId,
          action: 'LOGO_UPDATED',
          tableName: 'associations',
          recordId: associationId,
          oldValues: { logo: association?.logo },
          newValues: { logo: logoUrl }
        }
      });

      // Delete old logo file if exists
      if (association?.logo) await removeLogoFile(association.logo);

      return {
        success: true,
        logoUrl,
        message: 'Logo uploaded successfully'
      };
    } catch (error) {
      console.error('Error uploading logo:', error);
      // Clean up file if database update failed
      try {
        await fs.unlink(filepath);
      } catch {
        // Ignore cleanup errors
      }
      return { success: false, message: 'Failed to upload logo' };
    }
  }

  /**
   * Delete logo for an association
   */
  static async deleteLogo(
    associationId: number,
    userId: number
  ): Promise<LogoUploadResult> {
    try {
      const association = await prisma.association.findUnique({
        where: { id: associationId },
        select: { logo: true }
      });

      if (!association?.logo) {
        return { success: false, message: 'No logo to delete' };
      }

      // Update association
      await prisma.association.update({
        where: { id: associationId },
        data: { logo: null }
      });

      // Create audit log
      await prisma.auditLog.create({
        data: {
          associationId,
          userId,
          action: 'LOGO_DELETED',
          tableName: 'associations',
          recordId: associationId,
          oldValues: { logo: association.logo },
          newValues: { logo: null }
        }
      });

      await removeLogoFile(association.logo);

      return { success: true, message: 'Logo deleted successfully' };
    } catch (error) {
      console.error('Error deleting logo:', error);
      return { success: false, message: 'Failed to delete logo' };
    }
  }
}
