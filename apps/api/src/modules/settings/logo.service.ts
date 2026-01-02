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

    // Check file type
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      return { valid: false, error: `Invalid file type. Allowed: ${ALLOWED_TYPES.join(', ')}` };
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
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = `logo-${associationId}-${Date.now()}${ext}`;
    const filepath = path.join(UPLOAD_DIR, filename);

    console.log('📁 Upload details:', {
      filename,
      filepath,
      absolutePath: path.resolve(filepath),
      fileSize: file.size,
      mimeType: file.mimetype
    });

    try {
      // Get old logo for cleanup
      const association = await prisma.association.findUnique({
        where: { id: associationId },
        select: { logo: true }
      });

      // Save new file
      await fs.writeFile(filepath, file.buffer);
      console.log('✅ File written successfully to:', filepath);

      // Verify file was written
      const stats = await fs.stat(filepath);
      console.log('📊 File stats:', { size: stats.size, exists: true });

      // Generate URL (relative path for serving)
      const logoUrl = `/uploads/logos/${filename}`;
      console.log('🔗 Logo URL:', logoUrl);

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
      if (association?.logo) {
        const oldFilePath = path.join(process.cwd(), association.logo.replace(/^\//, ''));
        try {
          await fs.unlink(oldFilePath);
        } catch {
          // Ignore if old file doesn't exist
        }
      }

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

      // Delete file
      const filepath = path.join(process.cwd(), association.logo.replace(/^\//, ''));
      try {
        await fs.unlink(filepath);
      } catch {
        // Ignore if file doesn't exist
      }

      return { success: true, message: 'Logo deleted successfully' };
    } catch (error) {
      console.error('Error deleting logo:', error);
      return { success: false, message: 'Failed to delete logo' };
    }
  }
}
