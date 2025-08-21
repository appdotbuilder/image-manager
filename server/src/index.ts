import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import schemas
import {
  uploadImageInputSchema,
  processImageInputSchema,
  updateProcessingStatusInputSchema,
  getImagesInputSchema,
  downloadImageInputSchema
} from './schema';

// Import handlers
import { uploadImage } from './handlers/upload_image';
import { getImages } from './handlers/get_images';
import { getImageById } from './handlers/get_image_by_id';
import { processImage } from './handlers/process_image';
import { updateProcessingStatus } from './handlers/update_processing_status';
import { downloadImage } from './handlers/download_image';
import { deleteImage } from './handlers/delete_image';
import { getGallery } from './handlers/get_gallery';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check endpoint
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // Upload a new image
  uploadImage: publicProcedure
    .input(uploadImageInputSchema)
    .mutation(({ input }) => uploadImage(input)),

  // Get all images with optional filtering and pagination
  getImages: publicProcedure
    .input(getImagesInputSchema)
    .query(({ input }) => getImages(input)),

  // Get a specific image by ID with processed versions
  getImageById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => getImageById(input.id)),

  // Get gallery view (images with completed processed versions)
  getGallery: publicProcedure
    .query(() => getGallery()),

  // Start processing an image (background removal)
  processImage: publicProcedure
    .input(processImageInputSchema)
    .mutation(({ input }) => processImage(input)),

  // Update processing status (called by external service)
  updateProcessingStatus: publicProcedure
    .input(updateProcessingStatusInputSchema)
    .mutation(({ input }) => updateProcessingStatus(input)),

  // Download an image (original or processed)
  downloadImage: publicProcedure
    .input(downloadImageInputSchema)
    .query(({ input }) => downloadImage(input)),

  // Delete an image and all its processed versions
  deleteImage: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => deleteImage(input.id)),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`TRPC server listening at port: ${port}`);
}

start();