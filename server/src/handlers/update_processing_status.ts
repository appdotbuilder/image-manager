import { db } from '../db';
import { processedImagesTable } from '../db/schema';
import { type UpdateProcessingStatusInput, type ProcessedImage } from '../schema';
import { eq } from 'drizzle-orm';

export const updateProcessingStatus = async (input: UpdateProcessingStatusInput): Promise<ProcessedImage> => {
  try {
    // Build update values dynamically based on input
    const updateValues: Record<string, any> = {
      processing_status: input.status,
      updated_at: new Date()
    };

    // Set processed_at timestamp if status is completed
    if (input.status === 'completed') {
      updateValues['processed_at'] = new Date();
    }

    // Update optional fields if provided
    if (input.processed_path !== undefined) {
      updateValues['processed_path'] = input.processed_path;
    }

    if (input.file_size !== undefined) {
      updateValues['file_size'] = input.file_size;
    }

    if (input.width !== undefined) {
      updateValues['width'] = input.width;
    }

    if (input.height !== undefined) {
      updateValues['height'] = input.height;
    }

    if (input.error_message !== undefined) {
      updateValues['error_message'] = input.error_message;
    }

    // Update the processed image record
    const result = await db.update(processedImagesTable)
      .set(updateValues)
      .where(eq(processedImagesTable.id, input.processed_image_id))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error(`Processed image with ID ${input.processed_image_id} not found`);
    }

    return result[0];
  } catch (error) {
    console.error('Processing status update failed:', error);
    throw error;
  }
};