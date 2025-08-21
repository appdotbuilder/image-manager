import { db } from '../db';
import { imagesTable, processedImagesTable } from '../db/schema';
import { type ImageWithProcessed } from '../schema';
import { eq, desc } from 'drizzle-orm';

export const getGallery = async (): Promise<ImageWithProcessed[]> => {
  try {
    // Query all images with their processed versions, joining the tables
    const results = await db.select()
      .from(imagesTable)
      .leftJoin(processedImagesTable, eq(imagesTable.id, processedImagesTable.original_image_id))
      .orderBy(desc(imagesTable.uploaded_at))
      .execute();

    // Group results by image to build the nested structure
    const imageMap = new Map<number, ImageWithProcessed>();

    for (const result of results) {
      const image = result.images;
      const processedImage = result.processed_images;

      if (!imageMap.has(image.id)) {
        // Initialize image with empty processed_images array
        imageMap.set(image.id, {
          id: image.id,
          filename: image.filename,
          original_path: image.original_path,
          file_size: image.file_size,
          mime_type: image.mime_type,
          width: image.width,
          height: image.height,
          uploaded_at: image.uploaded_at,
          updated_at: image.updated_at,
          processed_images: []
        });
      }

      // Add processed image if it exists
      if (processedImage) {
        const imageWithProcessed = imageMap.get(image.id)!;
        imageWithProcessed.processed_images.push({
          id: processedImage.id,
          original_image_id: processedImage.original_image_id,
          processed_path: processedImage.processed_path,
          processing_status: processedImage.processing_status,
          processing_type: processedImage.processing_type,
          file_size: processedImage.file_size,
          width: processedImage.width,
          height: processedImage.height,
          error_message: processedImage.error_message,
          processed_at: processedImage.processed_at,
          created_at: processedImage.created_at,
          updated_at: processedImage.updated_at
        });
      }
    }

    // Filter to only include images that have at least one successfully processed version
    const galleryImages = Array.from(imageMap.values()).filter(image => 
      image.processed_images.some(processed => processed.processing_status === 'completed')
    );

    return galleryImages;
  } catch (error) {
    console.error('Gallery retrieval failed:', error);
    throw error;
  }
};