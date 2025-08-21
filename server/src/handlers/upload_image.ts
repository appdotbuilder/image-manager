import { db } from '../db';
import { imagesTable } from '../db/schema';
import { type UploadImageInput, type Image } from '../schema';
import { writeFile, mkdir } from 'fs/promises';
import { join, extname } from 'path';
import { randomUUID } from 'crypto';
import { existsSync } from 'fs';

export const uploadImage = async (input: UploadImageInput): Promise<Image> => {
  try {
    // Decode base64 file data
    const fileBuffer = Buffer.from(input.file_data, 'base64');
    const fileSize = fileBuffer.length;

    // Generate unique filename
    const fileExtension = extname(input.filename) || getExtensionFromMimeType(input.mime_type);
    const uniqueFilename = `${randomUUID()}${fileExtension}`;
    
    // Create uploads directory if it doesn't exist
    const uploadsDir = join(process.cwd(), 'uploads');
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }

    // Save file to filesystem
    const filePath = join(uploadsDir, uniqueFilename);
    await writeFile(filePath, fileBuffer);

    // Store image metadata in database
    const result = await db.insert(imagesTable)
      .values({
        filename: input.filename,
        original_path: filePath,
        file_size: fileSize,
        mime_type: input.mime_type,
        width: input.width,
        height: input.height
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Image upload failed:', error);
    throw error;
  }
};

// Helper function to get file extension from MIME type
function getExtensionFromMimeType(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/bmp': '.bmp',
    'image/tiff': '.tiff'
  };
  return mimeToExt[mimeType] || '.bin';
}