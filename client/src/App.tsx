import { useState, useEffect, useCallback } from 'react';
import { trpc } from '@/utils/trpc';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ImageUpload } from '@/components/ImageUpload';
import { ImageGallery } from '@/components/ImageGallery';
import { ImageManager } from '@/components/ImageManager';
import { Badge } from '@/components/ui/badge';
import { Upload, Images, Settings } from 'lucide-react';
import type { ImageWithProcessed } from '../../server/src/schema';

function App() {
  const [images, setImages] = useState<ImageWithProcessed[]>([]);
  const [galleryImages, setGalleryImages] = useState<ImageWithProcessed[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('upload');

  const loadImages = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await trpc.getImages.query({});
      setImages(result);
    } catch (error) {
      console.error('Failed to load images:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadGallery = useCallback(async () => {
    try {
      const result = await trpc.getGallery.query();
      setGalleryImages(result);
    } catch (error) {
      console.error('Failed to load gallery:', error);
    }
  }, []);

  useEffect(() => {
    loadImages();
    loadGallery();
  }, [loadImages, loadGallery]);

  const handleImageUploaded = useCallback(() => {
    loadImages();
    loadGallery();
  }, [loadImages, loadGallery]);

  const handleImageDeleted = useCallback(() => {
    loadImages();
    loadGallery();
  }, [loadImages, loadGallery]);

  const totalImages = images.length;
  const processedCount = images.filter(img => 
    img.processed_images.some(p => p.processing_status === 'completed')
  ).length;
  const pendingCount = images.filter(img => 
    img.processed_images.some(p => p.processing_status === 'pending' || p.processing_status === 'processing')
  ).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            🖼️ Image Studio
          </h1>
          <p className="text-lg text-gray-600 mb-6">
            Upload, process, and manage your images with AI-powered background removal
          </p>
          
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto mb-8">
            <Card className="bg-white/70 backdrop-blur-sm">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-blue-600">{totalImages}</div>
                <div className="text-sm text-gray-600">Total Images</div>
              </CardContent>
            </Card>
            <Card className="bg-white/70 backdrop-blur-sm">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-green-600">{processedCount}</div>
                <div className="text-sm text-gray-600">Processed</div>
              </CardContent>
            </Card>
            <Card className="bg-white/70 backdrop-blur-sm">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-orange-600">{pendingCount}</div>
                <div className="text-sm text-gray-600">Processing</div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Main Content */}
        <Card className="bg-white/80 backdrop-blur-sm shadow-xl">
          <CardContent className="p-0">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3 bg-gray-100/50">
                <TabsTrigger value="upload" className="flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  Upload
                </TabsTrigger>
                <TabsTrigger value="gallery" className="flex items-center gap-2">
                  <Images className="w-4 h-4" />
                  Gallery
                  {galleryImages.length > 0 && (
                    <Badge variant="secondary" className="ml-1">
                      {galleryImages.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="manage" className="flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  Manage
                  {totalImages > 0 && (
                    <Badge variant="secondary" className="ml-1">
                      {totalImages}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="upload" className="p-6">
                <div className="space-y-6">
                  <div className="text-center">
                    <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                      Upload New Image
                    </h2>
                    <p className="text-gray-600">
                      Upload your images to automatically remove backgrounds with AI
                    </p>
                  </div>
                  <ImageUpload onImageUploaded={handleImageUploaded} />
                </div>
              </TabsContent>

              <TabsContent value="gallery" className="p-6">
                <div className="space-y-6">
                  <div className="text-center">
                    <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                      Processed Gallery
                    </h2>
                    <p className="text-gray-600">
                      View and download your images with backgrounds removed
                    </p>
                  </div>
                  <ImageGallery 
                    images={galleryImages} 
                    isLoading={isLoading}
                    onRefresh={loadGallery}
                  />
                </div>
              </TabsContent>

              <TabsContent value="manage" className="p-6">
                <div className="space-y-6">
                  <div className="text-center">
                    <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                      Manage Images
                    </h2>
                    <p className="text-gray-600">
                      View all your images, check processing status, and manage your collection
                    </p>
                  </div>
                  <ImageManager 
                    images={images} 
                    isLoading={isLoading}
                    onImageDeleted={handleImageDeleted}
                    onRefresh={loadImages}
                  />
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8 text-gray-500 text-sm">
          <p>✨ Powered by AI background removal technology</p>
        </div>
      </div>
    </div>
  );
}

export default App;