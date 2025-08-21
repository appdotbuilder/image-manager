import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { imagesTable, processedImagesTable } from '../db/schema';
import { deleteImage } from '../handlers/delete_image';
import { eq } from 'drizzle-orm';

// Test data
const testImageData = {
  filename: 'test-image.jpg',
  original_path: '/uploads/test-image.jpg',
  file_size: 1024,
  mime_type: 'image/jpeg',
  width: 800,
  height: 600
};

const testProcessedImageData = {
  processed_path: '/processed/test-image-processed.jpg',
  processing_status: 'completed' as const,
  processing_type: 'background_removal',
  file_size: 512,
  width: 800,
  height: 600
};

describe('deleteImage', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should delete an image without processed versions', async () => {
    // Create test image
    const insertResult = await db.insert(imagesTable)
      .values(testImageData)
      .returning()
      .execute();
    
    const imageId = insertResult[0].id;

    // Delete the image
    const result = await deleteImage(imageId);

    // Verify return value
    expect(result.success).toBe(true);

    // Verify image is deleted from database
    const remainingImages = await db.select()
      .from(imagesTable)
      .where(eq(imagesTable.id, imageId))
      .execute();
    
    expect(remainingImages).toHaveLength(0);
  });

  it('should delete an image with processed versions', async () => {
    // Create test image
    const imageInsertResult = await db.insert(imagesTable)
      .values(testImageData)
      .returning()
      .execute();
    
    const imageId = imageInsertResult[0].id;

    // Create processed images
    const processedImageInsertResult = await db.insert(processedImagesTable)
      .values({
        ...testProcessedImageData,
        original_image_id: imageId
      })
      .returning()
      .execute();
    
    const processedImageId = processedImageInsertResult[0].id;

    // Create another processed image
    await db.insert(processedImagesTable)
      .values({
        ...testProcessedImageData,
        original_image_id: imageId,
        processed_path: '/processed/test-image-processed2.jpg',
        processing_type: 'resize'
      })
      .execute();

    // Delete the image
    const result = await deleteImage(imageId);

    // Verify return value
    expect(result.success).toBe(true);

    // Verify original image is deleted
    const remainingImages = await db.select()
      .from(imagesTable)
      .where(eq(imagesTable.id, imageId))
      .execute();
    
    expect(remainingImages).toHaveLength(0);

    // Verify all processed images are deleted
    const remainingProcessedImages = await db.select()
      .from(processedImagesTable)
      .where(eq(processedImagesTable.original_image_id, imageId))
      .execute();
    
    expect(remainingProcessedImages).toHaveLength(0);

    // Verify specific processed image is deleted
    const specificProcessedImage = await db.select()
      .from(processedImagesTable)
      .where(eq(processedImagesTable.id, processedImageId))
      .execute();
    
    expect(specificProcessedImage).toHaveLength(0);
  });

  it('should throw error when image does not exist', async () => {
    const nonExistentId = 999;

    await expect(deleteImage(nonExistentId)).rejects.toThrow(/not found/i);
  });

  it('should handle cascade deletion properly with multiple processed images', async () => {
    // Create multiple test images
    const imageInsertResult1 = await db.insert(imagesTable)
      .values(testImageData)
      .returning()
      .execute();
    
    const imageInsertResult2 = await db.insert(imagesTable)
      .values({
        ...testImageData,
        filename: 'test-image-2.jpg',
        original_path: '/uploads/test-image-2.jpg'
      })
      .returning()
      .execute();
    
    const imageId1 = imageInsertResult1[0].id;
    const imageId2 = imageInsertResult2[0].id;

    // Create processed images for both original images
    await db.insert(processedImagesTable)
      .values([
        {
          ...testProcessedImageData,
          original_image_id: imageId1,
          processing_type: 'background_removal'
        },
        {
          ...testProcessedImageData,
          original_image_id: imageId1,
          processing_type: 'resize',
          processed_path: '/processed/test-image-resize.jpg'
        },
        {
          ...testProcessedImageData,
          original_image_id: imageId2,
          processing_type: 'background_removal',
          processed_path: '/processed/test-image-2-processed.jpg'
        }
      ])
      .execute();

    // Delete only the first image
    const result = await deleteImage(imageId1);

    // Verify successful deletion
    expect(result.success).toBe(true);

    // Verify first image and its processed versions are deleted
    const remainingImages1 = await db.select()
      .from(imagesTable)
      .where(eq(imagesTable.id, imageId1))
      .execute();
    
    expect(remainingImages1).toHaveLength(0);

    const remainingProcessedImages1 = await db.select()
      .from(processedImagesTable)
      .where(eq(processedImagesTable.original_image_id, imageId1))
      .execute();
    
    expect(remainingProcessedImages1).toHaveLength(0);

    // Verify second image and its processed versions still exist
    const remainingImages2 = await db.select()
      .from(imagesTable)
      .where(eq(imagesTable.id, imageId2))
      .execute();
    
    expect(remainingImages2).toHaveLength(1);

    const remainingProcessedImages2 = await db.select()
      .from(processedImagesTable)
      .where(eq(processedImagesTable.original_image_id, imageId2))
      .execute();
    
    expect(remainingProcessedImages2).toHaveLength(1);
  });

  it('should handle deletion when processed images have different statuses', async () => {
    // Create test image
    const imageInsertResult = await db.insert(imagesTable)
      .values(testImageData)
      .returning()
      .execute();
    
    const imageId = imageInsertResult[0].id;

    // Create processed images with different statuses
    await db.insert(processedImagesTable)
      .values([
        {
          ...testProcessedImageData,
          original_image_id: imageId,
          processing_status: 'completed',
          processing_type: 'background_removal'
        },
        {
          ...testProcessedImageData,
          original_image_id: imageId,
          processing_status: 'failed',
          processing_type: 'resize',
          processed_path: '/processed/test-image-resize.jpg',
          error_message: 'Processing failed'
        },
        {
          ...testProcessedImageData,
          original_image_id: imageId,
          processing_status: 'pending',
          processing_type: 'compress',
          processed_path: '/processed/test-image-compress.jpg',
          file_size: null,
          width: null,
          height: null
        }
      ])
      .execute();

    // Delete the image
    const result = await deleteImage(imageId);

    // Verify successful deletion
    expect(result.success).toBe(true);

    // Verify all processed images are deleted regardless of status
    const remainingProcessedImages = await db.select()
      .from(processedImagesTable)
      .where(eq(processedImagesTable.original_image_id, imageId))
      .execute();
    
    expect(remainingProcessedImages).toHaveLength(0);
  });
});