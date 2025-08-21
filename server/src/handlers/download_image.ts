import { db } from '../db';
import { imagesTable, processedImagesTable } from '../db/schema';
import { type DownloadImageInput } from '../schema';
import { eq } from 'drizzle-orm';
import { promises as fs } from 'fs';

export interface DownloadImageResponse {
    filename: string;
    file_data: string; // Base64 encoded file data
    mime_type: string;
    file_size: number;
}

export const downloadImage = async (input: DownloadImageInput): Promise<DownloadImageResponse> => {
    try {
        let imageRecord: any;
        let filePath: string;
        let filename: string;
        let mimeType: string;
        let fileSize: number;

        // Determine whether to download original or processed image
        if (input.image_id !== undefined) {
            // Download original image
            const results = await db.select()
                .from(imagesTable)
                .where(eq(imagesTable.id, input.image_id))
                .execute();

            if (results.length === 0) {
                throw new Error(`Original image with id ${input.image_id} not found`);
            }

            imageRecord = results[0];
            filePath = imageRecord.original_path;
            filename = imageRecord.filename;
            mimeType = imageRecord.mime_type;
            fileSize = imageRecord.file_size;
        } else if (input.processed_image_id !== undefined) {
            // Download processed image
            const results = await db.select()
                .from(processedImagesTable)
                .where(eq(processedImagesTable.id, input.processed_image_id))
                .execute();

            if (results.length === 0) {
                throw new Error(`Processed image with id ${input.processed_image_id} not found`);
            }

            imageRecord = results[0];
            filePath = imageRecord.processed_path;
            
            // Get original image filename and mime_type for processed images
            const originalResults = await db.select()
                .from(imagesTable)
                .where(eq(imagesTable.id, imageRecord.original_image_id))
                .execute();

            if (originalResults.length === 0) {
                throw new Error(`Original image for processed image ${input.processed_image_id} not found`);
            }

            const originalImage = originalResults[0];
            // Create a filename that indicates it's processed
            const originalName = originalImage.filename;
            const extensionIndex = originalName.lastIndexOf('.');
            const baseName = extensionIndex > 0 ? originalName.substring(0, extensionIndex) : originalName;
            const extension = extensionIndex > 0 ? originalName.substring(extensionIndex) : '';
            filename = `${baseName}_${imageRecord.processing_type}${extension}`;
            
            mimeType = originalImage.mime_type;
            fileSize = imageRecord.file_size || 0;
        } else {
            throw new Error('Either image_id or processed_image_id must be provided');
        }

        // Read the file from storage
        const fileBuffer = await fs.readFile(filePath);
        
        // Convert to base64
        const fileData = fileBuffer.toString('base64');

        return {
            filename,
            file_data: fileData,
            mime_type: mimeType,
            file_size: fileSize
        };
    } catch (error) {
        console.error('Image download failed:', error);
        throw error;
    }
};