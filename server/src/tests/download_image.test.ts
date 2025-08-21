import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { imagesTable, processedImagesTable } from '../db/schema';
import { type DownloadImageInput } from '../schema';
import { downloadImage } from '../handlers/download_image';
import { eq, sql } from 'drizzle-orm';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Helper function to create a test file
const createTestFile = async (filename: string, content: string): Promise<string> => {
    const filePath = join(tmpdir(), filename);
    await fs.writeFile(filePath, content, 'utf-8');
    return filePath;
};

// Helper function to cleanup test file
const cleanupTestFile = async (filePath: string): Promise<void> => {
    try {
        await fs.unlink(filePath);
    } catch (error) {
        // Ignore errors if file doesn't exist
    }
};

describe('downloadImage', () => {
    beforeEach(createDB);
    afterEach(resetDB);

    it('should download original image', async () => {
        const testContent = 'test image content';
        const testFilePath = await createTestFile('test_original.jpg', testContent);

        try {
            // Create test image record
            const imageResults = await db.insert(imagesTable)
                .values({
                    filename: 'test_original.jpg',
                    original_path: testFilePath,
                    file_size: testContent.length,
                    mime_type: 'image/jpeg',
                    width: 800,
                    height: 600
                })
                .returning()
                .execute();

            const image = imageResults[0];

            const input: DownloadImageInput = {
                image_id: image.id
            };

            const result = await downloadImage(input);

            // Verify response structure
            expect(result.filename).toEqual('test_original.jpg');
            expect(result.mime_type).toEqual('image/jpeg');
            expect(result.file_size).toEqual(testContent.length);
            expect(result.file_data).toEqual(Buffer.from(testContent, 'utf-8').toString('base64'));
        } finally {
            await cleanupTestFile(testFilePath);
        }
    });

    it('should download processed image with modified filename', async () => {
        const originalContent = 'original image content';
        const processedContent = 'processed image content';
        const originalFilePath = await createTestFile('original.png', originalContent);
        const processedFilePath = await createTestFile('processed.png', processedContent);

        try {
            // Create original image record
            const imageResults = await db.insert(imagesTable)
                .values({
                    filename: 'original.png',
                    original_path: originalFilePath,
                    file_size: originalContent.length,
                    mime_type: 'image/png',
                    width: 1024,
                    height: 768
                })
                .returning()
                .execute();

            const originalImage = imageResults[0];

            // Create processed image record
            const processedResults = await db.insert(processedImagesTable)
                .values({
                    original_image_id: originalImage.id,
                    processed_path: processedFilePath,
                    processing_status: 'completed',
                    processing_type: 'background_removal',
                    file_size: processedContent.length,
                    width: 1024,
                    height: 768
                })
                .returning()
                .execute();

            const processedImage = processedResults[0];

            const input: DownloadImageInput = {
                processed_image_id: processedImage.id
            };

            const result = await downloadImage(input);

            // Verify response structure
            expect(result.filename).toEqual('original_background_removal.png');
            expect(result.mime_type).toEqual('image/png');
            expect(result.file_size).toEqual(processedContent.length);
            expect(result.file_data).toEqual(Buffer.from(processedContent, 'utf-8').toString('base64'));
        } finally {
            await cleanupTestFile(originalFilePath);
            await cleanupTestFile(processedFilePath);
        }
    });

    it('should handle filename without extension for processed image', async () => {
        const originalContent = 'original content';
        const processedContent = 'processed content';
        const originalFilePath = await createTestFile('noext', originalContent);
        const processedFilePath = await createTestFile('noext_processed', processedContent);

        try {
            // Create original image record
            const imageResults = await db.insert(imagesTable)
                .values({
                    filename: 'noext',
                    original_path: originalFilePath,
                    file_size: originalContent.length,
                    mime_type: 'image/webp',
                    width: 500,
                    height: 300
                })
                .returning()
                .execute();

            const originalImage = imageResults[0];

            // Create processed image record
            const processedResults = await db.insert(processedImagesTable)
                .values({
                    original_image_id: originalImage.id,
                    processed_path: processedFilePath,
                    processing_status: 'completed',
                    processing_type: 'resize',
                    file_size: processedContent.length,
                    width: 250,
                    height: 150
                })
                .returning()
                .execute();

            const processedImage = processedResults[0];

            const input: DownloadImageInput = {
                processed_image_id: processedImage.id
            };

            const result = await downloadImage(input);

            // Verify processed filename generation for files without extension
            expect(result.filename).toEqual('noext_resize');
            expect(result.mime_type).toEqual('image/webp');
            expect(result.file_size).toEqual(processedContent.length);
        } finally {
            await cleanupTestFile(originalFilePath);
            await cleanupTestFile(processedFilePath);
        }
    });

    it('should throw error when original image not found', async () => {
        const input: DownloadImageInput = {
            image_id: 999999
        };

        await expect(downloadImage(input)).rejects.toThrow(/Original image with id 999999 not found/i);
    });

    it('should throw error when processed image not found', async () => {
        const input: DownloadImageInput = {
            processed_image_id: 999999
        };

        await expect(downloadImage(input)).rejects.toThrow(/Processed image with id 999999 not found/i);
    });

    it('should throw error when processed image has missing original', async () => {
        const processedContent = 'orphaned processed image';
        const processedFilePath = await createTestFile('orphaned.jpg', processedContent);

        try {
            // Use raw SQL to insert a processed image record that references a non-existent original image
            // This bypasses foreign key constraints temporarily to simulate data corruption
            
            // First, disable foreign key constraints
            await db.execute(sql`SET session_replication_role = replica`);
            
            // Insert the orphaned processed image
            await db.execute(sql`
                INSERT INTO processed_images (original_image_id, processed_path, processing_status, processing_type, file_size, created_at, updated_at)
                VALUES (999999, ${processedFilePath}, 'completed', 'filter', ${processedContent.length}, NOW(), NOW())
            `);
            
            // Re-enable foreign key constraints
            await db.execute(sql`SET session_replication_role = DEFAULT`);

            // Get the ID of the inserted processed image
            const processedResults = await db.select()
                .from(processedImagesTable)
                .where(eq(processedImagesTable.original_image_id, 999999))
                .execute();

            const processedImage = processedResults[0];

            const input: DownloadImageInput = {
                processed_image_id: processedImage.id
            };

            await expect(downloadImage(input)).rejects.toThrow(/Original image for processed image \d+ not found/i);
        } finally {
            // Make sure to re-enable constraints even if test fails
            try {
                await db.execute(sql`SET session_replication_role = DEFAULT`);
            } catch (e) {
                // Ignore errors when resetting
            }
            await cleanupTestFile(processedFilePath);
        }
    });

    it('should throw error when file does not exist on filesystem', async () => {
        const nonExistentPath = '/path/that/does/not/exist.jpg';
        
        // Create image record with non-existent file path
        const imageResults = await db.insert(imagesTable)
            .values({
                filename: 'missing.jpg',
                original_path: nonExistentPath,
                file_size: 1000,
                mime_type: 'image/jpeg',
                width: 400,
                height: 300
            })
            .returning()
            .execute();

        const image = imageResults[0];

        const input: DownloadImageInput = {
            image_id: image.id
        };

        await expect(downloadImage(input)).rejects.toThrow();
    });

    it('should handle processed images with null file_size', async () => {
        const originalContent = 'original image';
        const processedContent = 'processed image';
        const originalFilePath = await createTestFile('original_null_size.jpg', originalContent);
        const processedFilePath = await createTestFile('processed_null_size.jpg', processedContent);

        try {
            // Create original image record
            const imageResults = await db.insert(imagesTable)
                .values({
                    filename: 'original_null_size.jpg',
                    original_path: originalFilePath,
                    file_size: originalContent.length,
                    mime_type: 'image/jpeg',
                    width: 200,
                    height: 150
                })
                .returning()
                .execute();

            const originalImage = imageResults[0];

            // Create processed image record with null file_size
            const processedResults = await db.insert(processedImagesTable)
                .values({
                    original_image_id: originalImage.id,
                    processed_path: processedFilePath,
                    processing_status: 'completed',
                    processing_type: 'enhance',
                    file_size: null, // Explicitly null
                    width: 200,
                    height: 150
                })
                .returning()
                .execute();

            const processedImage = processedResults[0];

            const input: DownloadImageInput = {
                processed_image_id: processedImage.id
            };

            const result = await downloadImage(input);

            // Should default to 0 when file_size is null
            expect(result.file_size).toEqual(0);
            expect(result.filename).toEqual('original_null_size_enhance.jpg');
            expect(result.file_data).toEqual(Buffer.from(processedContent, 'utf-8').toString('base64'));
        } finally {
            await cleanupTestFile(originalFilePath);
            await cleanupTestFile(processedFilePath);
        }
    });
});