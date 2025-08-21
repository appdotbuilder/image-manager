import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { imagesTable, processedImagesTable } from '../db/schema';
import { type UpdateProcessingStatusInput } from '../schema';
import { updateProcessingStatus } from '../handlers/update_processing_status';
import { eq } from 'drizzle-orm';

// Test data
const testImage = {
  filename: 'test-image.jpg',
  original_path: '/uploads/test-image.jpg',
  file_size: 1024,
  mime_type: 'image/jpeg',
  width: 800,
  height: 600
};

const testProcessedImage = {
  processed_path: '/processed/test-image-bg-removed.png',
  processing_status: 'pending' as const,
  processing_type: 'background_removal'
};

describe('updateProcessingStatus', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should update processing status to completed', async () => {
    // Create prerequisite image and processed image
    const [image] = await db.insert(imagesTable)
      .values(testImage)
      .returning()
      .execute();

    const [processedImage] = await db.insert(processedImagesTable)
      .values({
        ...testProcessedImage,
        original_image_id: image.id
      })
      .returning()
      .execute();

    const input: UpdateProcessingStatusInput = {
      processed_image_id: processedImage.id,
      status: 'completed',
      processed_path: '/processed/test-image-completed.png',
      file_size: 512,
      width: 800,
      height: 600
    };

    const result = await updateProcessingStatus(input);

    // Verify return value
    expect(result.id).toEqual(processedImage.id);
    expect(result.processing_status).toEqual('completed');
    expect(result.processed_path).toEqual('/processed/test-image-completed.png');
    expect(result.file_size).toEqual(512);
    expect(result.width).toEqual(800);
    expect(result.height).toEqual(600);
    expect(result.processed_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.error_message).toBeNull();

    // Verify database was updated
    const [updatedRecord] = await db.select()
      .from(processedImagesTable)
      .where(eq(processedImagesTable.id, processedImage.id))
      .execute();

    expect(updatedRecord.processing_status).toEqual('completed');
    expect(updatedRecord.processed_path).toEqual('/processed/test-image-completed.png');
    expect(updatedRecord.file_size).toEqual(512);
    expect(updatedRecord.processed_at).toBeInstanceOf(Date);
  });

  it('should update processing status to failed with error message', async () => {
    // Create prerequisite image and processed image
    const [image] = await db.insert(imagesTable)
      .values(testImage)
      .returning()
      .execute();

    const [processedImage] = await db.insert(processedImagesTable)
      .values({
        ...testProcessedImage,
        original_image_id: image.id
      })
      .returning()
      .execute();

    const input: UpdateProcessingStatusInput = {
      processed_image_id: processedImage.id,
      status: 'failed',
      error_message: 'Background removal service unavailable'
    };

    const result = await updateProcessingStatus(input);

    // Verify return value
    expect(result.processing_status).toEqual('failed');
    expect(result.error_message).toEqual('Background removal service unavailable');
    expect(result.processed_at).toBeNull(); // Should not be set for failed status

    // Verify database was updated
    const [updatedRecord] = await db.select()
      .from(processedImagesTable)
      .where(eq(processedImagesTable.id, processedImage.id))
      .execute();

    expect(updatedRecord.processing_status).toEqual('failed');
    expect(updatedRecord.error_message).toEqual('Background removal service unavailable');
    expect(updatedRecord.processed_at).toBeNull();
  });

  it('should update only processing status when no optional fields provided', async () => {
    // Create prerequisite image and processed image
    const [image] = await db.insert(imagesTable)
      .values(testImage)
      .returning()
      .execute();

    const [processedImage] = await db.insert(processedImagesTable)
      .values({
        ...testProcessedImage,
        original_image_id: image.id
      })
      .returning()
      .execute();

    const input: UpdateProcessingStatusInput = {
      processed_image_id: processedImage.id,
      status: 'processing'
    };

    const result = await updateProcessingStatus(input);

    // Verify only status and updated_at changed
    expect(result.processing_status).toEqual('processing');
    expect(result.processed_path).toEqual(testProcessedImage.processed_path); // Unchanged
    expect(result.file_size).toBeNull(); // Unchanged
    expect(result.processed_at).toBeNull(); // Should not be set for processing status
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should set processed_at timestamp only when status is completed', async () => {
    // Create prerequisite image and processed image
    const [image] = await db.insert(imagesTable)
      .values(testImage)
      .returning()
      .execute();

    const [processedImage] = await db.insert(processedImagesTable)
      .values({
        ...testProcessedImage,
        original_image_id: image.id
      })
      .returning()
      .execute();

    // Test with processing status - should not set processed_at
    const processingInput: UpdateProcessingStatusInput = {
      processed_image_id: processedImage.id,
      status: 'processing'
    };

    const processingResult = await updateProcessingStatus(processingInput);
    expect(processingResult.processed_at).toBeNull();

    // Test with completed status - should set processed_at
    const completedInput: UpdateProcessingStatusInput = {
      processed_image_id: processedImage.id,
      status: 'completed',
      file_size: 1024
    };

    const completedResult = await updateProcessingStatus(completedInput);
    expect(completedResult.processed_at).toBeInstanceOf(Date);
  });

  it('should throw error when processed image not found', async () => {
    const input: UpdateProcessingStatusInput = {
      processed_image_id: 999999, // Non-existent ID
      status: 'completed'
    };

    expect(updateProcessingStatus(input)).rejects.toThrow(/processed image.*not found/i);
  });

  it('should handle null error message correctly', async () => {
    // Create prerequisite image and processed image
    const [image] = await db.insert(imagesTable)
      .values(testImage)
      .returning()
      .execute();

    const [processedImage] = await db.insert(processedImagesTable)
      .values({
        ...testProcessedImage,
        original_image_id: image.id,
        error_message: 'Previous error message'
      })
      .returning()
      .execute();

    const input: UpdateProcessingStatusInput = {
      processed_image_id: processedImage.id,
      status: 'completed',
      error_message: null // Explicitly clear error message
    };

    const result = await updateProcessingStatus(input);

    expect(result.error_message).toBeNull();

    // Verify database was updated
    const [updatedRecord] = await db.select()
      .from(processedImagesTable)
      .where(eq(processedImagesTable.id, processedImage.id))
      .execute();

    expect(updatedRecord.error_message).toBeNull();
  });

  it('should preserve original fields when not updating them', async () => {
    // Create prerequisite image and processed image with existing values
    const [image] = await db.insert(imagesTable)
      .values(testImage)
      .returning()
      .execute();

    const [processedImage] = await db.insert(processedImagesTable)
      .values({
        ...testProcessedImage,
        original_image_id: image.id,
        file_size: 2048,
        width: 1024,
        height: 768
      })
      .returning()
      .execute();

    const input: UpdateProcessingStatusInput = {
      processed_image_id: processedImage.id,
      status: 'failed',
      error_message: 'Processing failed'
    };

    const result = await updateProcessingStatus(input);

    // Verify original values are preserved
    expect(result.processing_status).toEqual('failed');
    expect(result.error_message).toEqual('Processing failed');
    expect(result.file_size).toEqual(2048); // Preserved
    expect(result.width).toEqual(1024); // Preserved
    expect(result.height).toEqual(768); // Preserved
    expect(result.processed_path).toEqual(testProcessedImage.processed_path); // Preserved
  });
});