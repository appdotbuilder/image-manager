import { db } from '../db';
import { imagesTable, processedImagesTable } from '../db/schema';
import { type ImageWithProcessed } from '../schema';
import { eq } from 'drizzle-orm';

export const getImageById = async (id: number): Promise<ImageWithProcessed | null> => {
  try {
    // Query for the main image with its processed versions using a left join
    const results = await db.select()
      .from(imagesTable)
      .leftJoin(processedImagesTable, eq(imagesTable.id, processedImagesTable.original_image_id))
      .where(eq(imagesTable.id, id))
      .execute();

    // If no results, the image doesn't exist
    if (results.length === 0) {
      return null;
    }

    // Extract the image data from the first result (all rows have the same image data)
    const imageData = results[0].images;

    // Group all processed images from the join results
    const processedImages = results
      .map(result => result.processed_images)
      .filter(processed => processed !== null) // Filter out null processed images from left join
      .map(processed => ({
        ...processed!,
        // Convert numeric fields back to numbers (no numeric columns in this table)
      }));

    // Return the image with processed versions
    return {
      ...imageData,
      processed_images: processedImages
    };
  } catch (error) {
    console.error('Failed to get image by ID:', error);
    throw error;
  }
};