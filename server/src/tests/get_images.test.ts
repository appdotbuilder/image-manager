import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { imagesTable, processedImagesTable } from '../db/schema';
import { type GetImagesInput } from '../schema';
import { getImages } from '../handlers/get_images';

describe('getImages', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper function to create test image
  const createTestImage = async (filename: string = 'test.jpg') => {
    const result = await db.insert(imagesTable)
      .values({
        filename,
        original_path: `/uploads/${filename}`,
        file_size: 1024,
        mime_type: 'image/jpeg',
        width: 800,
        height: 600
      })
      .returning()
      .execute();
    return result[0];
  };

  // Helper function to create processed image
  const createProcessedImage = async (originalImageId: number, status: 'pending' | 'processing' | 'completed' | 'failed' = 'completed') => {
    const result = await db.insert(processedImagesTable)
      .values({
        original_image_id: originalImageId,
        processed_path: `/processed/bg_removed_${originalImageId}.jpg`,
        processing_status: status,
        processing_type: 'background_removal',
        file_size: status === 'completed' ? 512 : null,
        width: status === 'completed' ? 800 : null,
        height: status === 'completed' ? 600 : null,
        processed_at: status === 'completed' ? new Date() : null
      })
      .returning()
      .execute();
    return result[0];
  };

  it('should return empty array when no images exist', async () => {
    const input: GetImagesInput = {
      include_processed: true,
      limit: 50,
      offset: 0
    };

    const result = await getImages(input);

    expect(result).toEqual([]);
  });

  it('should return images without processed versions when include_processed is false', async () => {
    const image = await createTestImage('test1.jpg');
    await createProcessedImage(image.id);

    const input: GetImagesInput = {
      include_processed: false,
      limit: 50,
      offset: 0
    };

    const result = await getImages(input);

    expect(result).toHaveLength(1);
    expect(result[0].id).toEqual(image.id);
    expect(result[0].filename).toEqual('test1.jpg');
    expect(result[0].processed_images).toEqual([]);
    expect(result[0].uploaded_at).toBeInstanceOf(Date);
    expect(result[0].updated_at).toBeInstanceOf(Date);
  });

  it('should return images with processed versions when include_processed is true', async () => {
    const image = await createTestImage('test2.jpg');
    const processedImage = await createProcessedImage(image.id);

    const input: GetImagesInput = {
      include_processed: true,
      limit: 50,
      offset: 0
    };

    const result = await getImages(input);

    expect(result).toHaveLength(1);
    expect(result[0].id).toEqual(image.id);
    expect(result[0].filename).toEqual('test2.jpg');
    expect(result[0].processed_images).toHaveLength(1);
    expect(result[0].processed_images[0].id).toEqual(processedImage.id);
    expect(result[0].processed_images[0].processing_status).toEqual('completed');
    expect(result[0].processed_images[0].processing_type).toEqual('background_removal');
    expect(result[0].processed_images[0].created_at).toBeInstanceOf(Date);
    expect(result[0].processed_images[0].updated_at).toBeInstanceOf(Date);
  });

  it('should apply pagination correctly', async () => {
    // Create 5 images
    const images = await Promise.all([
      createTestImage('test1.jpg'),
      createTestImage('test2.jpg'),
      createTestImage('test3.jpg'),
      createTestImage('test4.jpg'),
      createTestImage('test5.jpg')
    ]);

    // Test first page
    const firstPageInput: GetImagesInput = {
      include_processed: false,
      limit: 2,
      offset: 0
    };

    const firstPage = await getImages(firstPageInput);
    expect(firstPage).toHaveLength(2);

    // Test second page
    const secondPageInput: GetImagesInput = {
      include_processed: false,
      limit: 2,
      offset: 2
    };

    const secondPage = await getImages(secondPageInput);
    expect(secondPage).toHaveLength(2);

    // Test third page
    const thirdPageInput: GetImagesInput = {
      include_processed: false,
      limit: 2,
      offset: 4
    };

    const thirdPage = await getImages(thirdPageInput);
    expect(thirdPage).toHaveLength(1);

    // Ensure different results on each page
    const allIds = [...firstPage, ...secondPage, ...thirdPage].map(img => img.id);
    const uniqueIds = [...new Set(allIds)];
    expect(uniqueIds).toHaveLength(5);
  });

  it('should filter by processing status correctly', async () => {
    const image1 = await createTestImage('completed.jpg');
    const image2 = await createTestImage('pending.jpg');
    const image3 = await createTestImage('failed.jpg');

    await createProcessedImage(image1.id, 'completed');
    await createProcessedImage(image2.id, 'pending');
    await createProcessedImage(image3.id, 'failed');

    // Filter for completed images only
    const completedInput: GetImagesInput = {
      include_processed: true,
      processing_status: 'completed',
      limit: 50,
      offset: 0
    };

    const completedResults = await getImages(completedInput);
    expect(completedResults).toHaveLength(1);
    expect(completedResults[0].filename).toEqual('completed.jpg');
    expect(completedResults[0].processed_images[0].processing_status).toEqual('completed');

    // Filter for pending images only
    const pendingInput: GetImagesInput = {
      include_processed: true,
      processing_status: 'pending',
      limit: 50,
      offset: 0
    };

    const pendingResults = await getImages(pendingInput);
    expect(pendingResults).toHaveLength(1);
    expect(pendingResults[0].filename).toEqual('pending.jpg');
    expect(pendingResults[0].processed_images[0].processing_status).toEqual('pending');
  });

  it('should handle multiple processed images per original image', async () => {
    const image = await createTestImage('multi_processed.jpg');
    
    // Create multiple processed versions
    const processed1 = await createProcessedImage(image.id, 'completed');
    const processed2 = await db.insert(processedImagesTable)
      .values({
        original_image_id: image.id,
        processed_path: `/processed/resized_${image.id}.jpg`,
        processing_status: 'completed',
        processing_type: 'resize',
        file_size: 256,
        width: 400,
        height: 300
      })
      .returning()
      .execute();

    const input: GetImagesInput = {
      include_processed: true,
      limit: 50,
      offset: 0
    };

    const result = await getImages(input);

    expect(result).toHaveLength(1);
    expect(result[0].processed_images).toHaveLength(2);
    
    const processedTypes = result[0].processed_images.map(p => p.processing_type);
    expect(processedTypes).toContain('background_removal');
    expect(processedTypes).toContain('resize');
  });

  it('should handle images without processed versions gracefully', async () => {
    const image1 = await createTestImage('with_processed.jpg');
    const image2 = await createTestImage('without_processed.jpg');
    
    // Only create processed image for first image
    await createProcessedImage(image1.id);

    const input: GetImagesInput = {
      include_processed: true,
      limit: 50,
      offset: 0
    };

    const result = await getImages(input);

    expect(result).toHaveLength(2);
    
    // Find each image in results
    const withProcessed = result.find(img => img.filename === 'with_processed.jpg');
    const withoutProcessed = result.find(img => img.filename === 'without_processed.jpg');

    expect(withProcessed).toBeDefined();
    expect(withProcessed!.processed_images).toHaveLength(1);
    
    expect(withoutProcessed).toBeDefined();
    expect(withoutProcessed!.processed_images).toEqual([]);
  });

  it('should respect default values from Zod schema', async () => {
    await createTestImage('default_test.jpg');

    // Test with minimal input (should use defaults)
    const minimalInput = {} as GetImagesInput;
    
    const result = await getImages(minimalInput);
    
    expect(result).toHaveLength(1);
    expect(result[0].processed_images).toEqual([]); // include_processed defaults to true, but no processed images exist
  });

  it('should handle date fields correctly', async () => {
    const image = await createTestImage('date_test.jpg');
    const processedImage = await createProcessedImage(image.id, 'completed'); // Ensure completed status for processed_at

    const input: GetImagesInput = {
      include_processed: true,
      limit: 50,
      offset: 0
    };

    const result = await getImages(input);

    expect(result).toHaveLength(1);
    
    // Check original image dates
    expect(result[0].uploaded_at).toBeInstanceOf(Date);
    expect(result[0].updated_at).toBeInstanceOf(Date);
    
    // Check processed image dates
    expect(result[0].processed_images[0].created_at).toBeInstanceOf(Date);
    expect(result[0].processed_images[0].updated_at).toBeInstanceOf(Date);
    expect(result[0].processed_images[0].processed_at).toBeInstanceOf(Date);
    
    // Test that pending processed images have null processed_at
    const pendingProcessed = await createProcessedImage(image.id, 'pending');
    const pendingResult = await getImages(input);
    
    const pendingProcessedImage = pendingResult[0].processed_images.find(p => p.processing_status === 'pending');
    expect(pendingProcessedImage).toBeDefined();
    expect(pendingProcessedImage!.processed_at).toBeNull();
  });
});