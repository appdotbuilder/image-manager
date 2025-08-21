import { useState, useCallback } from 'react';
import { trpc } from '@/utils/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Download, 
  RefreshCw, 
  Eye, 
  Calendar, 
  FileImage, 
  Zap,
  AlertCircle
} from 'lucide-react';
import type { ImageWithProcessed, ProcessedImage } from '../../../server/src/schema';

interface ImageGalleryProps {
  images: ImageWithProcessed[];
  isLoading: boolean;
  onRefresh: () => void;
}

export function ImageGallery({ images, isLoading, onRefresh }: ImageGalleryProps) {
  const [selectedImage, setSelectedImage] = useState<ImageWithProcessed | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const completedImages = images.filter((image: ImageWithProcessed) => 
    image.processed_images.some((p: ProcessedImage) => p.processing_status === 'completed')
  );

  const handleDownload = useCallback(async (imageId?: number, processedImageId?: number) => {
    try {
      setIsDownloading(true);
      
      const result = await trpc.downloadImage.query({
        image_id: imageId,
        processed_image_id: processedImageId
      });

      // The download handler should return file data or a download URL
      // For now, we'll show a success message as this is a stub implementation
      console.log('Download requested:', result);
      
      // In a real implementation, this would trigger a file download
      // window.open(result.downloadUrl, '_blank');
      
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      setIsDownloading(false);
    }
  }, []);

  const getCompletedProcessedImage = useCallback((image: ImageWithProcessed): ProcessedImage | null => {
    return image.processed_images.find((p: ProcessedImage) => p.processing_status === 'completed') || null;
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto" />
          <p className="text-gray-600">Loading gallery...</p>
        </div>
      </div>
    );
  }

  if (completedImages.length === 0) {
    return (
      <Card className="bg-gray-50">
        <CardContent className="p-8 text-center">
          <div className="space-y-4">
            <div className="mx-auto w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center">
              <FileImage className="w-8 h-8 text-gray-400" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No processed images yet
              </h3>
              <p className="text-gray-600 mb-4">
                Upload some images to see them here after processing
              </p>
              <Button onClick={onRefresh} variant="outline">
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh Gallery
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Gallery Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-gray-900">
            🎨 Processed Images
          </h3>
          <Badge variant="secondary">
            {completedImages.length} image{completedImages.length > 1 ? 's' : ''}
          </Badge>
        </div>
        <Button 
          onClick={onRefresh} 
          variant="outline" 
          size="sm"
          disabled={isLoading}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Gallery Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {completedImages.map((image: ImageWithProcessed) => {
          const processedImage = getCompletedProcessedImage(image);
          
          return (
            <Card 
              key={image.id} 
              className="group hover:shadow-lg transition-all duration-200 overflow-hidden bg-white"
            >
              <CardContent className="p-0">
                {/* Image Preview */}
                <div className="relative">
                  <div className="aspect-square bg-gray-100 flex items-center justify-center">
                    {/* In a real implementation, this would show the actual processed image */}
                    <div className="text-center p-4">
                      <FileImage className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">Processed Image</p>
                      <p className="text-xs text-gray-400">{image.filename}</p>
                    </div>
                  </div>
                  
                  {/* Overlay with actions */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setSelectedImage(image)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleDownload(undefined, processedImage?.id)}
                        disabled={isDownloading}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Processing badge */}
                  <div className="absolute top-2 right-2">
                    <Badge className="bg-green-100 text-green-800 border-green-200">
                      <Zap className="w-3 h-3 mr-1" />
                      Processed
                    </Badge>
                  </div>
                </div>

                {/* Image Info */}
                <div className="p-4">
                  <h4 className="font-medium text-gray-900 truncate mb-1">
                    {image.filename}
                  </h4>
                  
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                    <span className="flex items-center">
                      <Calendar className="w-3 h-3 mr-1" />
                      {image.uploaded_at.toLocaleDateString()}
                    </span>
                    {image.width && image.height && (
                      <span>{image.width}×{image.height}</span>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => handleDownload(image.id)}
                      disabled={isDownloading}
                    >
                      <Download className="w-3 h-3 mr-1" />
                      Original
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 bg-blue-600 hover:bg-blue-700"
                      onClick={() => handleDownload(undefined, processedImage?.id)}
                      disabled={isDownloading}
                    >
                      <Download className="w-3 h-3 mr-1" />
                      Processed
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Image Detail Modal */}
      {selectedImage && (
        <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>{selectedImage.filename}</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* Image Comparison */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Original */}
                <div className="space-y-2">
                  <h4 className="font-medium text-gray-900">Original</h4>
                  <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center">
                    <div className="text-center p-4">
                      <FileImage className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">Original Image</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => handleDownload(selectedImage.id)}
                    disabled={isDownloading}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download Original
                  </Button>
                </div>

                {/* Processed */}
                <div className="space-y-2">
                  <h4 className="font-medium text-gray-900">Background Removed</h4>
                  <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center">
                    <div className="text-center p-4">
                      <FileImage className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">Processed Image</p>
                    </div>
                  </div>
                  <Button
                    className="w-full bg-blue-600 hover:bg-blue-700"
                    onClick={() => {
                      const processedImage = getCompletedProcessedImage(selectedImage);
                      if (processedImage) {
                        handleDownload(undefined, processedImage.id);
                      }
                    }}
                    disabled={isDownloading}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download Processed
                  </Button>
                </div>
              </div>

              {/* Image Details */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3">Image Details</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Size:</span>
                    <p className="font-medium">{(selectedImage.file_size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Dimensions:</span>
                    <p className="font-medium">
                      {selectedImage.width && selectedImage.height 
                        ? `${selectedImage.width}×${selectedImage.height}` 
                        : 'Unknown'
                      }
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">Type:</span>
                    <p className="font-medium">{selectedImage.mime_type}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Uploaded:</span>
                    <p className="font-medium">{selectedImage.uploaded_at.toLocaleDateString()}</p>
                  </div>
                </div>
              </div>

              {/* Processing Status */}
              <div className="space-y-2">
                <h4 className="font-medium text-gray-900">Processing Status</h4>
                {selectedImage.processed_images.map((processed: ProcessedImage, index: number) => (
                  <div key={processed.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Badge 
                        className={
                          processed.processing_status === 'completed' ? 'bg-green-100 text-green-800' :
                          processed.processing_status === 'failed' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }
                      >
                        {processed.processing_status}
                      </Badge>
                      <span className="text-sm font-medium">{processed.processing_type}</span>
                    </div>
                    {processed.processed_at && (
                      <span className="text-xs text-gray-500">
                        {processed.processed_at.toLocaleString()}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Download stub notification */}
      <Alert className="border-blue-200 bg-blue-50">
        <AlertCircle className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          📌 <strong>Note:</strong> Download functionality is currently a stub implementation. 
          In the full version, clicking download buttons would retrieve and save the actual image files.
        </AlertDescription>
      </Alert>
    </div>
  );
}