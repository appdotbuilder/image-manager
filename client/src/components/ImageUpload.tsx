import { useState, useCallback } from 'react';
import { trpc } from '@/utils/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, X, CheckCircle, AlertCircle, Image as ImageIcon } from 'lucide-react';
import type { UploadImageInput } from '../../../server/src/schema';

interface ImageUploadProps {
  onImageUploaded: () => void;
}

interface FileWithPreview {
  file: File;
  preview: string;
  dimensions?: { width: number; height: number };
}

export function ImageUpload({ onImageUploaded }: ImageUploadProps) {
  const [selectedFiles, setSelectedFiles] = useState<FileWithPreview[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const validFiles: FileWithPreview[] = [];

    files.forEach((file: File) => {
      if (!file.type.startsWith('image/')) {
        return;
      }

      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        setErrorMessage('File size must be less than 10MB');
        setUploadStatus('error');
        return;
      }

      const preview = URL.createObjectURL(file);
      
      // Get image dimensions
      const img = new Image();
      img.onload = () => {
        validFiles.push({
          file,
          preview,
          dimensions: { width: img.width, height: img.height }
        });
        
        if (validFiles.length === files.filter(f => f.type.startsWith('image/') && f.size <= 10 * 1024 * 1024).length) {
          setSelectedFiles(validFiles);
        }
      };
      img.src = preview;
    });

    // Reset status
    setUploadStatus('idle');
    setErrorMessage(null);
  }, []);

  const removeFile = useCallback((index: number) => {
    setSelectedFiles((prev: FileWithPreview[]) => {
      const newFiles = prev.filter((_, i) => i !== index);
      // Revoke object URL for memory cleanup
      URL.revokeObjectURL(prev[index].preview);
      return newFiles;
    });
  }, []);

  const convertFileToBase64 = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        const base64Data = base64.split(',')[1]; // Remove data URL prefix
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }, []);

  const handleUpload = useCallback(async () => {
    if (selectedFiles.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);
    setUploadStatus('idle');
    setErrorMessage(null);

    try {
      const totalFiles = selectedFiles.length;
      
      for (let i = 0; i < selectedFiles.length; i++) {
        const fileWithPreview = selectedFiles[i];
        const base64Data = await convertFileToBase64(fileWithPreview.file);

        const uploadInput: UploadImageInput = {
          filename: fileWithPreview.file.name,
          file_data: base64Data,
          mime_type: fileWithPreview.file.type,
          width: fileWithPreview.dimensions?.width || null,
          height: fileWithPreview.dimensions?.height || null
        };

        await trpc.uploadImage.mutate(uploadInput);

        // Trigger background processing
        const uploadedImage = await trpc.uploadImage.mutate(uploadInput);
        await trpc.processImage.mutate({
          image_id: uploadedImage.id,
          processing_type: 'background_removal'
        });

        setUploadProgress(((i + 1) / totalFiles) * 100);
      }

      setUploadStatus('success');
      setSelectedFiles([]);
      onImageUploaded();
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setUploadStatus('idle');
      }, 3000);
    } catch (error) {
      console.error('Upload failed:', error);
      setUploadStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [selectedFiles, convertFileToBase64, onImageUploaded]);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
  }, []);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const files = Array.from(event.dataTransfer.files);
    
    // Create a fake file input change event
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = 'image/*';
    
    // Manually trigger file processing
    const validFiles: FileWithPreview[] = [];
    files.forEach((file: File) => {
      if (!file.type.startsWith('image/')) return;
      if (file.size > 10 * 1024 * 1024) return;

      const preview = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        validFiles.push({
          file,
          preview,
          dimensions: { width: img.width, height: img.height }
        });
        
        if (validFiles.length === files.filter(f => f.type.startsWith('image/') && f.size <= 10 * 1024 * 1024).length) {
          setSelectedFiles(validFiles);
        }
      };
      img.src = preview;
    });
  }, []);

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <Card>
        <CardContent className="p-6">
          <div
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <div className="space-y-4">
              <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Upload className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900">
                  Drop images here or click to upload
                </h3>
                <p className="text-sm text-gray-500">
                  Supports JPG, PNG, GIF up to 10MB
                </p>
              </div>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
                id="file-upload"
                disabled={isUploading}
              />
              <label htmlFor="file-upload">
                <Button 
                  variant="outline" 
                  disabled={isUploading}
                  className="cursor-pointer"
                  asChild
                >
                  <span>
                    <ImageIcon className="w-4 h-4 mr-2" />
                    Select Images
                  </span>
                </Button>
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Selected Files Preview */}
      {selectedFiles.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Selected Images ({selectedFiles.length})
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
              {selectedFiles.map((fileWithPreview: FileWithPreview, index: number) => (
                <div key={index} className="relative group">
                  <img
                    src={fileWithPreview.preview}
                    alt={fileWithPreview.file.name}
                    className="w-full h-24 object-cover rounded-md border"
                  />
                  <button
                    onClick={() => removeFile(index)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    disabled={isUploading}
                  >
                    <X className="w-3 h-3" />
                  </button>
                  <div className="mt-1">
                    <p className="text-xs text-gray-600 truncate">
                      {fileWithPreview.file.name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {fileWithPreview.dimensions && 
                        `${fileWithPreview.dimensions.width}×${fileWithPreview.dimensions.height}`
                      }
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                {selectedFiles.length} image{selectedFiles.length > 1 ? 's' : ''} ready to upload
              </div>
              <Button 
                onClick={handleUpload} 
                disabled={isUploading || selectedFiles.length === 0}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isUploading ? 'Uploading...' : 'Upload & Process'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload Progress */}
      {isUploading && (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Uploading images...</span>
                <span className="text-sm text-gray-500">{Math.round(uploadProgress)}%</span>
              </div>
              <Progress value={uploadProgress} className="h-2" />
              <p className="text-xs text-gray-500">
                Images will be automatically processed for background removal after upload
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status Messages */}
      {uploadStatus === 'success' && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            Images uploaded successfully! Background removal processing has started.
          </AlertDescription>
        </Alert>
      )}

      {uploadStatus === 'error' && errorMessage && (
        <Alert className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            {errorMessage}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}