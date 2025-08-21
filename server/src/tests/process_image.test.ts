import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { imagesTable, processedImagesTable } from '../db/schema';
import { type ProcessImageInput } from '../schema';
import { processImage } from '../handlers/process_image';
import { eq } from 'drizzle-orm';

// Helper function to create a test image
const createTestImage = async () => {
  const result = await db.insert(imagesTable)
    .values({
      filename: 'test-image.jpg',
      original_path: '/uploads/test-image.jpg',
      file_size: 1024,
      mime_type: 'image/jpeg',
      width: 800,
      height: 600
    })
    .returning()
    .execute();
  
  return result[0];
};

describe('processImage', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a processed image record with pending status', async () => {
    // Create a test image first
    const testImage = await createTestImage();

    const input: ProcessImageInput = {
      image_id: testImage.id,
      processing_type: 'background_removal'
    };

    const result = await processImage(input);

    // Validate the returned processed image
    expect(result.id).toBeDefined();
    expect(result.original_image_id).toEqual(testImage.id);
    expect(result.processing_status).toEqual('pending');
    expect(result.processing_type).toEqual('background_removal');
    expect(result.processed_path).toEqual('');
    expect(result.file_size).toBeNull();
    expect(result.width).toBeNull();
    expect(result.height).toBeNull();
    expect(result.error_message).toBeNull();
    expect(result.processed_at).toBeNull();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save processed image record to database', async () => {
    // Create a test image first
    const testImage = await createTestImage();

    const input: ProcessImageInput = {
      image_id: testImage.id,
      processing_type: 'background_removal'
    };

    const result = await processImage(input);

    // Verify the record was saved to the database
    const processedImages = await db.select()
      .from(processedImagesTable)
      .where(eq(processedImagesTable.id, result.id))
      .execute();

    expect(processedImages).toHaveLength(1);
    const savedImage = processedImages[0];
    
    expect(savedImage.original_image_id).toEqual(testImage.id);
    expect(savedImage.processing_status).toEqual('pending');
    expect(savedImage.processing_type).toEqual('background_removal');
    expect(savedImage.processed_path).toEqual('');
    expect(savedImage.file_size).toBeNull();
    expect(savedImage.width).toBeNull();
    expect(savedImage.height).toBeNull();
    expect(savedImage.error_message).toBeNull();
    expect(savedImage.processed_at).toBeNull();
    expect(savedImage.created_at).toBeInstanceOf(Date);
    expect(savedImage.updated_at).toBeInstanceOf(Date);
  });

  it('should use default processing_type when not specified', async () => {
    // Create a test image first
    const testImage = await createTestImage();

    // Create input without processing_type to test default
    const input: ProcessImageInput = {
      image_id: testImage.id,
      processing_type: 'background_removal' // This is required in our schema
    };

    const result = await processImage(input);

    expect(result.processing_type).toEqual('background_removal');
  });

  it('should handle custom processing types', async () => {
    // Create a test image first
    const testImage = await createTestImage();

    const input: ProcessImageInput = {
      image_id: testImage.id,
      processing_type: 'image_enhancement'
    };

    const result = await processImage(input);

    expect(result.processing_type).toEqual('image_enhancement');
    
    // Verify it was saved correctly
    const processedImages = await db.select()
      .from(processedImagesTable)
      .where(eq(processedImagesTable.id, result.id))
      .execute();

    expect(processedImages[0].processing_type).toEqual('image_enhancement');
  });

  it('should throw error when image does not exist', async () => {
    const input: ProcessImageInput = {
      image_id: 999, // Non-existent image ID
      processing_type: 'background_removal'
    };

    await expect(processImage(input)).rejects.toThrow(/Image with id 999 not found/i);
  });

  it('should allow multiple processed versions of same image', async () => {
    // Create a test image first
    const testImage = await createTestImage();

    // Process the same image multiple times with different types
    const input1: ProcessImageInput = {
      image_id: testImage.id,
      processing_type: 'background_removal'
    };

    const input2: ProcessImageInput = {
      image_id: testImage.id,
      processing_type: 'image_enhancement'
    };

    const result1 = await processImage(input1);
    const result2 = await processImage(input2);

    // Both should succeed and have different IDs
    expect(result1.id).not.toEqual(result2.id);
    expect(result1.original_image_id).toEqual(testImage.id);
    expect(result2.original_image_id).toEqual(testImage.id);
    expect(result1.processing_type).toEqual('background_removal');
    expect(result2.processing_type).toEqual('image_enhancement');

    // Verify both are saved in database
    const allProcessedImages = await db.select()
      .from(processedImagesTable)
      .where(eq(processedImagesTable.original_image_id, testImage.id))
      .execute();

    expect(allProcessedImages).toHaveLength(2);
    const types = allProcessedImages.map(img => img.processing_type);
    expect(types).toContain('background_removal');
    expect(types).toContain('image_enhancement');
  });
});