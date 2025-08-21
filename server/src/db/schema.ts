import { serial, text, pgTable, timestamp, integer, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enum for image processing status
export const imageProcessingStatusEnum = pgEnum('image_processing_status', [
  'pending',
  'processing', 
  'completed',
  'failed'
]);

// Images table - stores original uploaded images
export const imagesTable = pgTable('images', {
  id: serial('id').primaryKey(),
  filename: text('filename').notNull(),
  original_path: text('original_path').notNull(), // File system path or cloud storage URL
  file_size: integer('file_size').notNull(), // File size in bytes
  mime_type: text('mime_type').notNull(), // e.g., 'image/jpeg', 'image/png'
  width: integer('width'), // Image width in pixels (nullable until processed)
  height: integer('height'), // Image height in pixels (nullable until processed)
  uploaded_at: timestamp('uploaded_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Processed images table - stores processed versions of original images
export const processedImagesTable = pgTable('processed_images', {
  id: serial('id').primaryKey(),
  original_image_id: integer('original_image_id').references(() => imagesTable.id).notNull(),
  processed_path: text('processed_path').notNull(), // Path to processed image
  processing_status: imageProcessingStatusEnum('processing_status').default('pending').notNull(),
  processing_type: text('processing_type').notNull(), // e.g., 'background_removal'
  file_size: integer('file_size'), // File size in bytes (nullable until processing complete)
  width: integer('width'), // Processed image width (nullable until processing complete)
  height: integer('height'), // Processed image height (nullable until processing complete)
  error_message: text('error_message'), // Error details if processing failed
  processed_at: timestamp('processed_at'), // When processing was completed
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Relations
export const imagesRelations = relations(imagesTable, ({ many }) => ({
  processed_images: many(processedImagesTable)
}));

export const processedImagesRelations = relations(processedImagesTable, ({ one }) => ({
  original_image: one(imagesTable, {
    fields: [processedImagesTable.original_image_id],
    references: [imagesTable.id]
  })
}));

// TypeScript types for the table schemas
export type Image = typeof imagesTable.$inferSelect; // For SELECT operations
export type NewImage = typeof imagesTable.$inferInsert; // For INSERT operations

export type ProcessedImage = typeof processedImagesTable.$inferSelect;
export type NewProcessedImage = typeof processedImagesTable.$inferInsert;

// Export all tables for proper query building
export const tables = { 
  images: imagesTable, 
  processed_images: processedImagesTable 
};