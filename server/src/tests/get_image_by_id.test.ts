import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { imagesTable, processedImagesTable } from '../db/schema';
import { getImageById } from '../handlers/get_image_by_id';
import { eq } from 'drizzle-orm';

// Test data
const testImageData = {
  filename: 'test-image.jpg',
  original_path: '/uploads/test-image.jpg',
  file_size: 1024768,
  mime_type: 'image/jpeg',
  width: 1920,
  height: 1080
};

const testProcessedImageData = {
  processed_path: '/processed/test-image-bg-removed.png',
  processing_status: 'completed' as const,
  processing_type: 'background_removal',
  file_size: 512384,
  width: 1920,
  height: 1080,
  error_message: null,
  processed_at: new Date()
};

describe('getImageById', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return image with processed versions when image exists', async () => {
    // Create a test image
    const imageResult = await db.insert(imagesTable)
      .values(testImageData)
      .returning()
      .execute();
    const createdImage = imageResult[0];

    // Create processed versions
    const processedResult1 = await db.insert(processedImagesTable)
      .values({
        ...testProcessedImageData,
        original_image_id: createdImage.id,
        processing_type: 'background_removal'
      })
      .returning()
      .execute();

    const processedResult2 = await db.insert(processedImagesTable)
      .values({
        ...testProcessedImageData,
        original_image_id: createdImage.id,
        processing_type: 'resize',
        processed_path: '/processed/test-image-resized.jpg',
        width: 800,
        height: 600
      })
      .returning()
      .execute();

    // Test the handler
    const result = await getImageById(createdImage.id);

    // Verify the result structure
    expect(result).toBeDefined();
    expect(result).not.toBeNull();
    expect(result!.id).toEqual(createdImage.id);
    expect(result!.filename).toEqual('test-image.jpg');
    expect(result!.original_path).toEqual('/uploads/test-image.jpg');
    expect(result!.file_size).toEqual(1024768);
    expect(result!.mime_type).toEqual('image/jpeg');
    expect(result!.width).toEqual(1920);
    expect(result!.height).toEqual(1080);
    expect(result!.uploaded_at).toBeInstanceOf(Date);
    expect(result!.updated_at).toBeInstanceOf(Date);

    // Verify processed images are included
    expect(result!.processed_images).toHaveLength(2);
    
    // Check first processed image
    const bgRemoved = result!.processed_images.find(p => p.processing_type === 'background_removal');
    expect(bgRemoved).toBeDefined();
    expect(bgRemoved!.original_image_id).toEqual(createdImage.id);
    expect(bgRemoved!.processed_path).toEqual('/processed/test-image-bg-removed.png');
    expect(bgRemoved!.processing_status).toEqual('completed');
    expect(bgRemoved!.file_size).toEqual(512384);
    expect(bgRemoved!.width).toEqual(1920);
    expect(bgRemoved!.height).toEqual(1080);
    expect(bgRemoved!.processed_at).toBeInstanceOf(Date);

    // Check second processed image
    const resized = result!.processed_images.find(p => p.processing_type === 'resize');
    expect(resized).toBeDefined();
    expect(resized!.width).toEqual(800);
    expect(resized!.height).toEqual(600);
    expect(resized!.processed_path).toEqual('/processed/test-image-resized.jpg');
  });

  it('should return image with empty processed array when no processed versions exist', async () => {
    // Create a test image without processed versions
    const imageResult = await db.insert(imagesTable)
      .values(testImageData)
      .returning()
      .execute();
    const createdImage = imageResult[0];

    // Test the handler
    const result = await getImageById(createdImage.id);

    // Verify the result
    expect(result).toBeDefined();
    expect(result).not.toBeNull();
    expect(result!.id).toEqual(createdImage.id);
    expect(result!.filename).toEqual('test-image.jpg');
    expect(result!.processed_images).toHaveLength(0);
    expect(result!.processed_images).toEqual([]);
  });

  it('should return null when image does not exist', async () => {
    // Test with non-existent ID
    const result = await getImageById(99999);

    expect(result).toBeNull();
  });

  it('should handle images with failed processed versions', async () => {
    // Create a test image
    const imageResult = await db.insert(imagesTable)
      .values(testImageData)
      .returning()
      .execute();
    const createdImage = imageResult[0];

    // Create a failed processed version
    await db.insert(processedImagesTable)
      .values({
        original_image_id: createdImage.id,
        processed_path: '/processed/failed-image.jpg',
        processing_status: 'failed',
        processing_type: 'background_removal',
        file_size: null,
        width: null,
        height: null,
        error_message: 'Processing failed due to invalid image format',
        processed_at: null
      })
      .returning()
      .execute();

    // Test the handler
    const result = await getImageById(createdImage.id);

    // Verify the result includes failed processed version
    expect(result).toBeDefined();
    expect(result!.processed_images).toHaveLength(1);
    
    const failedProcessed = result!.processed_images[0];
    expect(failedProcessed.processing_status).toEqual('failed');
    expect(failedProcessed.error_message).toEqual('Processing failed due to invalid image format');
    expect(failedProcessed.file_size).toBeNull();
    expect(failedProcessed.width).toBeNull();
    expect(failedProcessed.height).toBeNull();
    expect(failedProcessed.processed_at).toBeNull();
  });

  it('should verify data persistence in database', async () => {
    // Create a test image
    const imageResult = await db.insert(imagesTable)
      .values(testImageData)
      .returning()
      .execute();
    const createdImage = imageResult[0];

    // Get image through handler
    const handlerResult = await getImageById(createdImage.id);

    // Verify data exists in database directly
    const dbImages = await db.select()
      .from(imagesTable)
      .where(eq(imagesTable.id, createdImage.id))
      .execute();

    expect(dbImages).toHaveLength(1);
    expect(dbImages[0].filename).toEqual(handlerResult!.filename);
    expect(dbImages[0].original_path).toEqual(handlerResult!.original_path);
    expect(dbImages[0].file_size).toEqual(handlerResult!.file_size);
  });
});