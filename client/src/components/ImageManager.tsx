import { useState, useCallback } from 'react';
import { trpc } from '@/utils/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  RefreshCw, 
  Trash2, 
  Download, 
  Play, 
  Clock, 
  CheckCircle, 
  XCircle, 
  FileImage,
  Calendar,
  HardDrive,
  Filter,
  AlertCircle
} from 'lucide-react';
import type { ImageWithProcessed, ProcessedImage, ImageProcessingStatus } from '../../../server/src/schema';

interface ImageManagerProps {
  images: ImageWithProcessed[];
  isLoading: boolean;
  onImageDeleted: () => void;
  onRefresh: () => void;
}

export function ImageManager({ images, isLoading, onImageDeleted, onRefresh }: ImageManagerProps) {
  const [statusFilter, setStatusFilter] = useState<ImageProcessingStatus | 'all'>('all');
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDeleteImage = useCallback(async (imageId: number) => {
    try {
      setDeletingId(imageId);
      await trpc.deleteImage.mutate({ id: imageId });
      onImageDeleted();
    } catch (error) {
      console.error('Failed to delete image:', error);
    } finally {
      setDeletingId(null);
    }
  }, [onImageDeleted]);

  const handleProcessImage = useCallback(async (imageId: number) => {
    try {
      setProcessingId(imageId);
      await trpc.processImage.mutate({
        image_id: imageId,
        processing_type: 'background_removal'
      });
      onRefresh();
    } catch (error) {
      console.error('Failed to start processing:', error);
    } finally {
      setProcessingId(null);
    }
  }, [onRefresh]);

  const handleDownload = useCallback(async (imageId?: number, processedImageId?: number) => {
    try {
      setIsDownloading(true);
      const result = await trpc.downloadImage.query({
        image_id: imageId,
        processed_image_id: processedImageId
      });
      console.log('Download requested:', result);
      // In real implementation, this would trigger file download
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      setIsDownloading(false);
    }
  }, []);

  const getImageStatus = useCallback((image: ImageWithProcessed): { status: string; color: string; icon: React.ReactNode } => {
    const processedImages = image.processed_images;
    
    if (processedImages.length === 0) {
      return { status: 'Not processed', color: 'bg-gray-100 text-gray-800', icon: <FileImage className="w-3 h-3" /> };
    }

    const hasCompleted = processedImages.some((p: ProcessedImage) => p.processing_status === 'completed');
    const hasProcessing = processedImages.some((p: ProcessedImage) => 
      p.processing_status === 'pending' || p.processing_status === 'processing'
    );
    const hasFailed = processedImages.some((p: ProcessedImage) => p.processing_status === 'failed');

    if (hasCompleted) {
      return { status: 'Completed', color: 'bg-green-100 text-green-800', icon: <CheckCircle className="w-3 h-3" /> };
    } else if (hasProcessing) {
      return { status: 'Processing', color: 'bg-yellow-100 text-yellow-800', icon: <Clock className="w-3 h-3" /> };
    } else if (hasFailed) {
      return { status: 'Failed', color: 'bg-red-100 text-red-800', icon: <XCircle className="w-3 h-3" /> };
    }

    return { status: 'Unknown', color: 'bg-gray-100 text-gray-800', icon: <FileImage className="w-3 h-3" /> };
  }, []);

  const filteredImages = images.filter((image: ImageWithProcessed) => {
    if (statusFilter === 'all') return true;
    
    return image.processed_images.some((p: ProcessedImage) => p.processing_status === statusFilter);
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto" />
          <p className="text-gray-600">Loading images...</p>
        </div>
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <Card className="bg-gray-50">
        <CardContent className="p-8 text-center">
          <div className="space-y-4">
            <div className="mx-auto w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center">
              <FileImage className="w-8 h-8 text-gray-400" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No images uploaded yet
              </h3>
              <p className="text-gray-600 mb-4">
                Start by uploading some images in the Upload tab
              </p>
              <Button onClick={onRefresh} variant="outline">
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <Select value={statusFilter} onValueChange={(value: string) => setStatusFilter(value as ImageProcessingStatus | 'all')}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Images</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <Badge variant="outline">
            {filteredImages.length} of {images.length} images
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

      {/* Images List */}
      <div className="space-y-4">
        {filteredImages.map((image: ImageWithProcessed) => {
          const imageStatus = getImageStatus(image);
          const hasCompleted = image.processed_images.some((p: ProcessedImage) => p.processing_status === 'completed');
          const canProcess = !image.processed_images.some((p: ProcessedImage) => 
            p.processing_status === 'pending' || p.processing_status === 'processing'
          );
          
          return (
            <Card key={image.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  {/* Image Info */}
                  <div className="flex-1 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-900 mb-1">
                          {image.filename}
                        </h3>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span className="flex items-center">
                            <Calendar className="w-3 h-3 mr-1" />
                            {image.uploaded_at.toLocaleDateString()}
                          </span>
                          <span className="flex items-center">
                            <HardDrive className="w-3 h-3 mr-1" />
                            {(image.file_size / 1024 / 1024).toFixed(2)} MB
                          </span>
                          {image.width && image.height && (
                            <span>{image.width}×{image.height}</span>
                          )}
                        </div>
                      </div>
                      
                      <Badge className={imageStatus.color}>
                        {imageStatus.icon}
                        <span className="ml-1">{imageStatus.status}</span>
                      </Badge>
                    </div>

                    {/* Processing Details */}
                    {image.processed_images.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-gray-700">Processing History</h4>
                        <div className="space-y-1">
                          {image.processed_images.map((processed: ProcessedImage) => (
                            <div key={processed.id} className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded">
                              <div className="flex items-center gap-2">
                                <Badge 
                                  className={
                                    processed.processing_status === 'completed' ? 'bg-green-100 text-green-800 text-xs' :
                                    processed.processing_status === 'failed' ? 'bg-red-100 text-red-800 text-xs' :
                                    processed.processing_status === 'processing' ? 'bg-blue-100 text-blue-800 text-xs' :
                                    'bg-yellow-100 text-yellow-800 text-xs'
                                  }
                                >
                                  {processed.processing_status}
                                </Badge>
                                <span className="text-gray-600">{processed.processing_type}</span>
                                {processed.error_message && (
                                  <span className="text-red-600 text-xs">
                                    ({processed.error_message})
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {processed.processed_at && (
                                  <span className="text-xs text-gray-500">
                                    {processed.processed_at.toLocaleString()}
                                  </span>
                                )}
                                {processed.processing_status === 'completed' && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleDownload(undefined, processed.id)}
                                    disabled={isDownloading}
                                  >
                                    <Download className="w-3 h-3" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDownload(image.id)}
                      disabled={isDownloading}
                    >
                      <Download className="w-4 h-4 mr-1" />
                      Original
                    </Button>

                    {hasCompleted && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                        onClick={() => {
                          const completedProcessed = image.processed_images.find((p: ProcessedImage) => 
                            p.processing_status === 'completed'
                          );
                          if (completedProcessed) {
                            handleDownload(undefined, completedProcessed.id);
                          }
                        }}
                        disabled={isDownloading}
                      >
                        <Download className="w-4 h-4 mr-1" />
                        Processed
                      </Button>
                    )}

                    {canProcess && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleProcessImage(image.id)}
                        disabled={processingId === image.id}
                      >
                        {processingId === image.id ? (
                          <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                        ) : (
                          <Play className="w-4 h-4 mr-1" />
                        )}
                        Process
                      </Button>
                    )}

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 border-red-200 hover:bg-red-50"
                          disabled={deletingId === image.id}
                        >
                          {deletingId === image.id ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Image</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{image.filename}"? This will also delete all processed versions. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteImage(image.id)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredImages.length === 0 && statusFilter !== 'all' && (
        <Card className="bg-gray-50">
          <CardContent className="p-6 text-center">
            <p className="text-gray-600">
              No images found with status: <strong>{statusFilter}</strong>
            </p>
            <Button
              variant="outline"
              onClick={() => setStatusFilter('all')}
              className="mt-2"
            >
              Show All Images
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Stub notification */}
      <Alert className="border-blue-200 bg-blue-50">
        <AlertCircle className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          📌 <strong>Note:</strong> This application uses stub implementations for backend handlers. 
          In the full version, processing and downloads would work with real image data and external AI services.
        </AlertDescription>
      </Alert>
    </div>
  );
}