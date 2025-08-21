import { db } from '../db';
import { imagesTable, processedImagesTable } from '../db/schema';
import { eq } from 'drizzle-orm';

export const deleteImage = async (id: number): Promise<{ success: boolean }> => {
  try {
    // First, check if the image exists
    const images = await db.select()
      .from(imagesTable)
      .where(eq(imagesTable.id, id))
      .execute();

    if (images.length === 0) {
      throw new Error(`Image with id ${id} not found`);
    }

    // Delete all associated processed images first (due to foreign key constraint)
    await db.delete(processedImagesTable)
      .where(eq(processedImagesTable.original_image_id, id))
      .execute();

    // Delete the original image record
    await db.delete(imagesTable)
      .where(eq(imagesTable.id, id))
      .execute();

    return { success: true };
  } catch (error) {
    console.error('Image deletion failed:', error);
    throw error;
  }
};