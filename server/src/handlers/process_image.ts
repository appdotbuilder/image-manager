import { db } from '../db';
import { imagesTable, processedImagesTable } from '../db/schema';
import { type ProcessImageInput, type ProcessedImage } from '../schema';
import { eq } from 'drizzle-orm';

export const processImage = async (input: ProcessImageInput): Promise<ProcessedImage> => {
  try {
    // 1. Validate that the original image exists
    const existingImages = await db.select()
      .from(imagesTable)
      .where(eq(imagesTable.id, input.image_id))
      .execute();

    if (existingImages.length === 0) {
      throw new Error(`Image with id ${input.image_id} not found`);
    }

    // 2. Create a processed image record with 'pending' status
    const result = await db.insert(processedImagesTable)
      .values({
        original_image_id: input.image_id,
        processed_path: '', // Will be set when processing completes
        processing_status: 'pending',
        processing_type: input.processing_type,
        file_size: null,
        width: null,
        height: null,
        error_message: null,
        processed_at: null
      })
      .returning()
      .execute();

    const processedImage = result[0];

    // 3. Queue the image for background removal processing with external service
    // This would typically involve sending a message to a queue or calling an external API
    // For now, we'll just log that the processing has been queued
    console.log(`Queued image ${input.image_id} for ${input.processing_type} processing`);

    // 4. Return the created processed image record
    return {
      ...processedImage,
      // Convert timestamp fields to Date objects for consistency with schema
      created_at: new Date(processedImage.created_at),
      updated_at: new Date(processedImage.updated_at),
      processed_at: processedImage.processed_at ? new Date(processedImage.processed_at) : null
    };
  } catch (error) {
    console.error('Image processing failed:', error);
    throw error;
  }
};