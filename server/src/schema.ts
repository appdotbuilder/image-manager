import { z } from 'zod';

// Image processing status enum
export const imageProcessingStatusSchema = z.enum(['pending', 'processing', 'completed', 'failed']);
export type ImageProcessingStatus = z.infer<typeof imageProcessingStatusSchema>;

// Base image schema
export const imageSchema = z.object({
  id: z.number(),
  filename: z.string(),
  original_path: z.string(),
  file_size: z.number().int(),
  mime_type: z.string(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  uploaded_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Image = z.infer<typeof imageSchema>;

// Processed image schema
export const processedImageSchema = z.object({
  id: z.number(),
  original_image_id: z.number(),
  processed_path: z.string(),
  processing_status: imageProcessingStatusSchema,
  processing_type: z.string(), // e.g., 'background_removal'
  file_size: z.number().int().nullable(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  error_message: z.string().nullable(),
  processed_at: z.coerce.date().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type ProcessedImage = z.infer<typeof processedImageSchema>;

// Combined image with processed versions
export const imageWithProcessedSchema = z.object({
  id: z.number(),
  filename: z.string(),
  original_path: z.string(),
  file_size: z.number().int(),
  mime_type: z.string(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  uploaded_at: z.coerce.date(),
  updated_at: z.coerce.date(),
  processed_images: z.array(processedImageSchema)
});

export type ImageWithProcessed = z.infer<typeof imageWithProcessedSchema>;

// Input schema for uploading images
export const uploadImageInputSchema = z.object({
  filename: z.string(),
  file_data: z.string(), // Base64 encoded file data
  mime_type: z.string(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable()
});

export type UploadImageInput = z.infer<typeof uploadImageInputSchema>;

// Input schema for processing images
export const processImageInputSchema = z.object({
  image_id: z.number(),
  processing_type: z.string().default('background_removal')
});

export type ProcessImageInput = z.infer<typeof processImageInputSchema>;

// Input schema for updating processing status
export const updateProcessingStatusInputSchema = z.object({
  processed_image_id: z.number(),
  status: imageProcessingStatusSchema,
  processed_path: z.string().optional(),
  file_size: z.number().int().optional(),
  width: z.number().int().optional(),
  height: z.number().int().optional(),
  error_message: z.string().nullable().optional()
});

export type UpdateProcessingStatusInput = z.infer<typeof updateProcessingStatusInputSchema>;

// Query schema for getting images with filters
export const getImagesInputSchema = z.object({
  include_processed: z.boolean().default(true),
  processing_status: imageProcessingStatusSchema.optional(),
  limit: z.number().int().positive().max(100).default(50),
  offset: z.number().int().nonnegative().default(0)
});

export type GetImagesInput = z.infer<typeof getImagesInputSchema>;

// Download image input schema
export const downloadImageInputSchema = z.object({
  image_id: z.number().optional(),
  processed_image_id: z.number().optional()
}).refine(
  (data) => data.image_id !== undefined || data.processed_image_id !== undefined,
  { message: "Either image_id or processed_image_id must be provided" }
);

export type DownloadImageInput = z.infer<typeof downloadImageInputSchema>;