import { db } from '../db';
import { imagesTable, processedImagesTable } from '../db/schema';
import { type GetImagesInput, type ImageWithProcessed } from '../schema';
import { eq, and, inArray, type SQL } from 'drizzle-orm';

export const getImages = async (input: GetImagesInput): Promise<ImageWithProcessed[]> => {
  try {
    let images: any[];

    // Handle different query patterns based on filtering needs
    if (input.processing_status) {
      // When filtering by processing status, we need to join
      const conditions: SQL<unknown>[] = [
        eq(processedImagesTable.processing_status, input.processing_status)
      ];

      const joinedResults = await db.select()
        .from(imagesTable)
        .innerJoin(
          processedImagesTable,
          eq(imagesTable.id, processedImagesTable.original_image_id)
        )
        .where(and(...conditions))
        .limit(input.limit)
        .offset(input.offset)
        .execute();

      // Extract images from joined results
      images = joinedResults.map(result => result.images);
    } else {
      // Simple query without joins
      images = await db.select()
        .from(imagesTable)
        .limit(input.limit)
        .offset(input.offset)
        .execute();
    }

    // If no processed images need to be included or no images found
    if (!input.include_processed || images.length === 0) {
      return images.map(image => ({
        ...image,
        processed_images: []
      }));
    }

    // Get all image IDs for fetching processed images
    const imageIds = images.map(image => image.id);

    // Fetch all processed images for these image IDs efficiently
    const allProcessedImages = imageIds.length > 0 
      ? await db.select()
          .from(processedImagesTable)
          .where(inArray(processedImagesTable.original_image_id, imageIds))
          .execute()
      : [];

    // Group processed images by original_image_id
    const processedImagesByOriginalId = allProcessedImages.reduce((acc, processed) => {
      if (!acc[processed.original_image_id]) {
        acc[processed.original_image_id] = [];
      }
      acc[processed.original_image_id].push(processed);
      return acc;
    }, {} as Record<number, typeof allProcessedImages>);

    // Combine images with their processed versions
    return images.map(image => ({
      ...image,
      processed_images: processedImagesByOriginalId[image.id] || []
    }));
  } catch (error) {
    console.error('Get images failed:', error);
    throw error;
  }
};