import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { imagesTable } from '../db/schema';
import { type UploadImageInput } from '../schema';
import { uploadImage } from '../handlers/upload_image';
import { eq } from 'drizzle-orm';
import { readFile, unlink } from 'fs/promises';
import { existsSync } from 'fs';

// Create a small test image in base64 format (1x1 PNG)
const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9lq5oYwAAAABJRU5ErkJggg==';

const testInput: UploadImageInput = {
  filename: 'test-image.png',
  file_data: testImageBase64,
  mime_type: 'image/png',
  width: 100,
  height: 100
};

describe('uploadImage', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should upload an image successfully', async () => {
    const result = await uploadImage(testInput);

    // Verify basic properties
    expect(result.filename).toEqual('test-image.png');
    expect(result.mime_type).toEqual('image/png');
    expect(result.width).toEqual(100);
    expect(result.height).toEqual(100);
    expect(result.id).toBeDefined();
    expect(result.uploaded_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);

    // Verify file size calculation
    const expectedSize = Buffer.from(testImageBase64, 'base64').length;
    expect(result.file_size).toEqual(expectedSize);

    // Verify original_path is set
    expect(result.original_path).toContain('uploads/');
    expect(result.original_path).toMatch(/\.png$/);

    // Clean up uploaded file
    if (existsSync(result.original_path)) {
      await unlink(result.original_path);
    }
  });

  it('should save image to database', async () => {
    const result = await uploadImage(testInput);

    // Query database to verify record was saved
    const images = await db.select()
      .from(imagesTable)
      .where(eq(imagesTable.id, result.id))
      .execute();

    expect(images).toHaveLength(1);
    const savedImage = images[0];
    expect(savedImage.filename).toEqual('test-image.png');
    expect(savedImage.mime_type).toEqual('image/png');
    expect(savedImage.width).toEqual(100);
    expect(savedImage.height).toEqual(100);
    expect(savedImage.file_size).toEqual(Buffer.from(testImageBase64, 'base64').length);
    expect(savedImage.uploaded_at).toBeInstanceOf(Date);
    expect(savedImage.updated_at).toBeInstanceOf(Date);

    // Clean up uploaded file
    if (existsSync(result.original_path)) {
      await unlink(result.original_path);
    }
  });

  it('should create physical file on filesystem', async () => {
    const result = await uploadImage(testInput);

    // Verify file exists
    expect(existsSync(result.original_path)).toBe(true);

    // Verify file content matches original
    const savedFileBuffer = await readFile(result.original_path);
    const originalBuffer = Buffer.from(testImageBase64, 'base64');
    expect(savedFileBuffer.equals(originalBuffer)).toBe(true);

    // Clean up uploaded file
    await unlink(result.original_path);
  });

  it('should handle image without dimensions', async () => {
    const inputWithoutDimensions: UploadImageInput = {
      filename: 'no-dimensions.png',
      file_data: testImageBase64,
      mime_type: 'image/png',
      width: null,
      height: null
    };

    const result = await uploadImage(inputWithoutDimensions);

    expect(result.width).toBeNull();
    expect(result.height).toBeNull();
    expect(result.filename).toEqual('no-dimensions.png');

    // Clean up uploaded file
    if (existsSync(result.original_path)) {
      await unlink(result.original_path);
    }
  });

  it('should generate unique filenames for same input filename', async () => {
    const result1 = await uploadImage(testInput);
    const result2 = await uploadImage(testInput);

    // Both should have different paths despite same input filename
    expect(result1.original_path).not.toEqual(result2.original_path);
    
    // Both files should exist
    expect(existsSync(result1.original_path)).toBe(true);
    expect(existsSync(result2.original_path)).toBe(true);

    // Clean up uploaded files
    await unlink(result1.original_path);
    await unlink(result2.original_path);
  });

  it('should handle different image formats', async () => {
    const jpegInput: UploadImageInput = {
      filename: 'test-image.jpg',
      file_data: testImageBase64, // Using same test data for simplicity
      mime_type: 'image/jpeg',
      width: 200,
      height: 150
    };

    const result = await uploadImage(jpegInput);

    expect(result.filename).toEqual('test-image.jpg');
    expect(result.mime_type).toEqual('image/jpeg');
    expect(result.width).toEqual(200);
    expect(result.height).toEqual(150);
    expect(result.original_path).toMatch(/\.jpg$/);

    // Clean up uploaded file
    if (existsSync(result.original_path)) {
      await unlink(result.original_path);
    }
  });

  it('should handle filename without extension using mime type', async () => {
    const inputWithoutExt: UploadImageInput = {
      filename: 'test-image',
      file_data: testImageBase64,
      mime_type: 'image/webp',
      width: 50,
      height: 50
    };

    const result = await uploadImage(inputWithoutExt);

    expect(result.filename).toEqual('test-image');
    expect(result.mime_type).toEqual('image/webp');
    expect(result.original_path).toMatch(/\.webp$/);

    // Clean up uploaded file
    if (existsSync(result.original_path)) {
      await unlink(result.original_path);
    }
  });
});