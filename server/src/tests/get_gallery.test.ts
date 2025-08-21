import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { imagesTable, processedImagesTable } from '../db/schema';
import { getGallery } from '../handlers/get_gallery';

describe('getGallery', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no images exist', async () => {
    const result = await getGallery();
    expect(result).toEqual([]);
  });

  it('should return empty array when no images have completed processing', async () => {
    // Create test image
    const [image] = await db.insert(imagesTable)
      .values({
        filename: 'test.jpg',
        original_path: '/uploads/test.jpg',
        file_size: 1024,
        mime_type: 'image/jpeg',
        width: 800,
        height: 600
      })
      .returning()
      .execute();

    // Create processed image with failed status
    await db.insert(processedImagesTable)
      .values({
        original_image_id: image.id,
        processed_path: '/processed/test_bg_removed.jpg',
        processing_status: 'failed',
        processing_type: 'background_removal',
        error_message: 'Processing failed'
      })
      .execute();

    const result = await getGallery();
    expect(result).toEqual([]);
  });

  it('should return images with completed processed versions', async () => {
    // Create test image
    const [image] = await db.insert(imagesTable)
      .values({
        filename: 'test.jpg',
        original_path: '/uploads/test.jpg',
        file_size: 1024,
        mime_type: 'image/jpeg',
        width: 800,
        height: 600
      })
      .returning()
      .execute();

    // Create completed processed image
    const [processedImage] = await db.insert(processedImagesTable)
      .values({
        original_image_id: image.id,
        processed_path: '/processed/test_bg_removed.jpg',
        processing_status: 'completed',
        processing_type: 'background_removal',
        file_size: 512,
        width: 800,
        height: 600,
        processed_at: new Date()
      })
      .returning()
      .execute();

    const result = await getGallery();

    expect(result).toHaveLength(1);
    expect(result[0].id).toEqual(image.id);
    expect(result[0].filename).toEqual('test.jpg');
    expect(result[0].original_path).toEqual('/uploads/test.jpg');
    expect(result[0].file_size).toEqual(1024);
    expect(result[0].mime_type).toEqual('image/jpeg');
    expect(result[0].width).toEqual(800);
    expect(result[0].height).toEqual(600);
    expect(result[0].uploaded_at).toBeInstanceOf(Date);
    expect(result[0].updated_at).toBeInstanceOf(Date);

    expect(result[0].processed_images).toHaveLength(1);
    expect(result[0].processed_images[0].id).toEqual(processedImage.id);
    expect(result[0].processed_images[0].processing_status).toEqual('completed');
    expect(result[0].processed_images[0].processing_type).toEqual('background_removal');
    expect(result[0].processed_images[0].processed_path).toEqual('/processed/test_bg_removed.jpg');
    expect(result[0].processed_images[0].file_size).toEqual(512);
    expect(result[0].processed_images[0].processed_at).toBeInstanceOf(Date);
  });

  it('should include multiple processed versions for same image', async () => {
    // Create test image
    const [image] = await db.insert(imagesTable)
      .values({
        filename: 'multi-test.jpg',
        original_path: '/uploads/multi-test.jpg',
        file_size: 2048,
        mime_type: 'image/jpeg',
        width: 1200,
        height: 900
      })
      .returning()
      .execute();

    // Create multiple processed versions
    await db.insert(processedImagesTable)
      .values([
        {
          original_image_id: image.id,
          processed_path: '/processed/multi-test_bg_removed.jpg',
          processing_status: 'completed',
          processing_type: 'background_removal',
          file_size: 1024,
          width: 1200,
          height: 900,
          processed_at: new Date()
        },
        {
          original_image_id: image.id,
          processed_path: '/processed/multi-test_resized.jpg',
          processing_status: 'completed',
          processing_type: 'resize',
          file_size: 800,
          width: 600,
          height: 450,
          processed_at: new Date()
        }
      ])
      .execute();

    const result = await getGallery();

    expect(result).toHaveLength(1);
    expect(result[0].processed_images).toHaveLength(2);

    const bgRemoved = result[0].processed_images.find(p => p.processing_type === 'background_removal');
    const resized = result[0].processed_images.find(p => p.processing_type === 'resize');

    expect(bgRemoved).toBeDefined();
    expect(bgRemoved!.file_size).toEqual(1024);
    expect(resized).toBeDefined();
    expect(resized!.file_size).toEqual(800);
  });

  it('should filter out images with only failed/pending processed versions', async () => {
    // Create test images
    const [image1] = await db.insert(imagesTable)
      .values({
        filename: 'success.jpg',
        original_path: '/uploads/success.jpg',
        file_size: 1024,
        mime_type: 'image/jpeg',
        width: 800,
        height: 600
      })
      .returning()
      .execute();

    const [image2] = await db.insert(imagesTable)
      .values({
        filename: 'failed.jpg',
        original_path: '/uploads/failed.jpg',
        file_size: 1024,
        mime_type: 'image/jpeg',
        width: 800,
        height: 600
      })
      .returning()
      .execute();

    // Create processed images - one completed, one failed
    await db.insert(processedImagesTable)
      .values([
        {
          original_image_id: image1.id,
          processed_path: '/processed/success_bg_removed.jpg',
          processing_status: 'completed',
          processing_type: 'background_removal',
          file_size: 512,
          processed_at: new Date()
        },
        {
          original_image_id: image2.id,
          processed_path: '/processed/failed_bg_removed.jpg',
          processing_status: 'failed',
          processing_type: 'background_removal',
          error_message: 'Processing failed'
        }
      ])
      .execute();

    const result = await getGallery();

    // Should only return the image with completed processing
    expect(result).toHaveLength(1);
    expect(result[0].filename).toEqual('success.jpg');
    expect(result[0].processed_images[0].processing_status).toEqual('completed');
  });

  it('should include image with mixed processing statuses if at least one is completed', async () => {
    // Create test image
    const [image] = await db.insert(imagesTable)
      .values({
        filename: 'mixed.jpg',
        original_path: '/uploads/mixed.jpg',
        file_size: 1024,
        mime_type: 'image/jpeg',
        width: 800,
        height: 600
      })
      .returning()
      .execute();

    // Create mixed processed images - one completed, one failed, one pending
    await db.insert(processedImagesTable)
      .values([
        {
          original_image_id: image.id,
          processed_path: '/processed/mixed_bg_removed.jpg',
          processing_status: 'completed',
          processing_type: 'background_removal',
          file_size: 512,
          processed_at: new Date()
        },
        {
          original_image_id: image.id,
          processed_path: '/processed/mixed_resized.jpg',
          processing_status: 'failed',
          processing_type: 'resize',
          error_message: 'Resize failed'
        },
        {
          original_image_id: image.id,
          processed_path: '/processed/mixed_filtered.jpg',
          processing_status: 'pending',
          processing_type: 'filter'
        }
      ])
      .execute();

    const result = await getGallery();

    expect(result).toHaveLength(1);
    expect(result[0].processed_images).toHaveLength(3);

    const statuses = result[0].processed_images.map(p => p.processing_status);
    expect(statuses).toContain('completed');
    expect(statuses).toContain('failed');
    expect(statuses).toContain('pending');
  });

  it('should sort images by upload date (newest first)', async () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Create test images with different upload dates
    const [oldImage] = await db.insert(imagesTable)
      .values({
        filename: 'old.jpg',
        original_path: '/uploads/old.jpg',
        file_size: 1024,
        mime_type: 'image/jpeg',
        uploaded_at: lastWeek
      })
      .returning()
      .execute();

    const [middleImage] = await db.insert(imagesTable)
      .values({
        filename: 'middle.jpg',
        original_path: '/uploads/middle.jpg',
        file_size: 1024,
        mime_type: 'image/jpeg',
        uploaded_at: yesterday
      })
      .returning()
      .execute();

    const [newImage] = await db.insert(imagesTable)
      .values({
        filename: 'new.jpg',
        original_path: '/uploads/new.jpg',
        file_size: 1024,
        mime_type: 'image/jpeg',
        uploaded_at: now
      })
      .returning()
      .execute();

    // Add completed processed versions for all
    await db.insert(processedImagesTable)
      .values([
        {
          original_image_id: oldImage.id,
          processed_path: '/processed/old_bg_removed.jpg',
          processing_status: 'completed',
          processing_type: 'background_removal',
          processed_at: new Date()
        },
        {
          original_image_id: middleImage.id,
          processed_path: '/processed/middle_bg_removed.jpg',
          processing_status: 'completed',
          processing_type: 'background_removal',
          processed_at: new Date()
        },
        {
          original_image_id: newImage.id,
          processed_path: '/processed/new_bg_removed.jpg',
          processing_status: 'completed',
          processing_type: 'background_removal',
          processed_at: new Date()
        }
      ])
      .execute();

    const result = await getGallery();

    expect(result).toHaveLength(3);
    // Should be sorted by upload date, newest first
    expect(result[0].filename).toEqual('new.jpg');
    expect(result[1].filename).toEqual('middle.jpg');
    expect(result[2].filename).toEqual('old.jpg');
  });
});