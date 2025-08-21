import { useState, useCallback, useEffect } from 'react';
import { trpc } from '@/utils/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, X, CheckCircle, AlertCircle, Image as ImageIcon, Clipboard } from 'lucide-react';
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
  const [showPasteHint, setShowPasteHint] = useState(false);

  const validateAndProcessFile = useCallback((file: File): Promise<FileWithPreview | null> => {
    return new Promise((resolve) => {
      if (!file.type.startsWith('image/')) {
        setErrorMessage('Only image files are allowed');
        setUploadStatus('error');
        resolve(null);
        return;
      }

      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        setErrorMessage('File size must be less than 10MB');
        setUploadStatus('error');
        resolve(null);
        return;
      }

      const preview = URL.createObjectURL(file);
      
      // Get image dimensions
      const img = new Image();
      img.onload = () => {
        resolve({
          file,
          preview,
          dimensions: { width: img.width, height: img.height }
        });
      };
      img.onerror = () => {
        URL.revokeObjectURL(preview);
        setErrorMessage('Invalid image file');
        setUploadStatus('error');
        resolve(null);
      };
      img.src = preview;
    });
  }, []);

  const addFilesToSelection = useCallback(async (files: File[]) => {
    const validFiles: FileWithPreview[] = [];
    
    for (const file of files) {
      const processedFile = await validateAndProcessFile(file);
      if (processedFile) {
        validFiles.push(processedFile);
      }
    }

    if (validFiles.length > 0) {
      setSelectedFiles((prev: FileWithPreview[]) => [...prev, ...validFiles]);
      // Reset status on successful addition
      setUploadStatus('idle');
      setErrorMessage(null);
    }
  }, [validateAndProcessFile]);

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    await addFilesToSelection(files);
  }, [addFilesToSelection]);

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

        // Upload image and get the returned image object
        const uploadedImage = await trpc.uploadImage.mutate(uploadInput);
        
        // Trigger background processing using the uploaded image ID
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

  const handleDrop = useCallback(async (event: React.DragEvent) => {
    event.preventDefault();
    const files = Array.from(event.dataTransfer.files);
    await addFilesToSelection(files);
  }, [addFilesToSelection]);

  const handlePaste = useCallback(async (event: ClipboardEvent) => {
    const clipboardItems = event.clipboardData?.items;
    if (!clipboardItems) return;

    const imageFiles: File[] = [];
    
    for (let i = 0; i < clipboardItems.length; i++) {
      const item = clipboardItems[i];
      if (item.type.indexOf('image') === 0) {
        const file = item.getAsFile();
        if (file) {
          // Create a proper filename for pasted images
          const timestamp = new Date().getTime();
          const extension = item.type.split('/')[1] || 'png';
          const fileName = `pasted-image-${timestamp}.${extension}`;
          
          // Create a new File object with proper name
          const namedFile = new File([file], fileName, {
            type: item.type,
            lastModified: Date.now()
          });
          
          imageFiles.push(namedFile);
        }
      }
    }

    if (imageFiles.length > 0) {
      event.preventDefault();
      await addFilesToSelection(imageFiles);
      setShowPasteHint(false);
    }
  }, [addFilesToSelection]);

  const handlePasteFromClipboard = useCallback(async () => {
    try {
      const clipboardItems = await navigator.clipboard.read();
      const imageFiles: File[] = [];

      for (const clipboardItem of clipboardItems) {
        for (const type of clipboardItem.types) {
          if (type.startsWith('image/')) {
            const blob = await clipboardItem.getType(type);
            const timestamp = new Date().getTime();
            const extension = type.split('/')[1] || 'png';
            const fileName = `clipboard-image-${timestamp}.${extension}`;
            
            const file = new File([blob], fileName, {
              type: type,
              lastModified: Date.now()
            });
            
            imageFiles.push(file);
          }
        }
      }

      if (imageFiles.length > 0) {
        await addFilesToSelection(imageFiles);
      } else {
        setErrorMessage('No images found in clipboard');
        setUploadStatus('error');
      }
    } catch (error) {
      console.error('Clipboard access failed:', error);
      setErrorMessage('Clipboard access denied. Please paste using Ctrl+V instead.');
      setUploadStatus('error');
    }
  }, [addFilesToSelection]);

  // Add global paste event listener
  useEffect(() => {
    const handleGlobalPaste = (event: ClipboardEvent) => {
      // Only handle paste if no input is focused and we're on the upload tab
      const activeElement = document.activeElement as HTMLElement | null;
      const isInputFocused = activeElement?.tagName === 'INPUT' || 
                           activeElement?.tagName === 'TEXTAREA' || 
                           activeElement?.contentEditable === 'true';
      
      if (!isInputFocused) {
        handlePaste(event);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      // Show paste hint when Ctrl+V is pressed (but don't interfere with actual paste)
      if ((event.ctrlKey || event.metaKey) && event.key === 'v') {
        setShowPasteHint(true);
        setTimeout(() => setShowPasteHint(false), 3000);
      }
    };

    document.addEventListener('paste', handleGlobalPaste);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('paste', handleGlobalPaste);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handlePaste]);

  return (
    <div className="space-y-6">
      {/* Paste Hint */}
      {showPasteHint && (
        <Alert className="border-blue-200 bg-blue-50">
          <Clipboard className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            Paste your images now! Images from your clipboard will be automatically added.
          </AlertDescription>
        </Alert>
      )}

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
                  Drop images here, paste from clipboard, or click to upload
                </h3>
                <p className="text-sm text-gray-500">
                  Supports JPG, PNG, GIF up to 10MB • Use Ctrl+V to paste images
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
              <div className="flex gap-2">
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
                <Button 
                  variant="outline" 
                  onClick={handlePasteFromClipboard}
                  disabled={isUploading}
                  className="text-blue-600 border-blue-200 hover:bg-blue-50"
                >
                  <Clipboard className="w-4 h-4 mr-2" />
                  Paste from Clipboard
                </Button>
              </div>
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
                    <p className="text-xs text-gray-600 truncate" title={fileWithPreview.file.name}>
                      {fileWithPreview.file.name}
                    </p>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-400">
                        {fileWithPreview.dimensions && 
                          `${fileWithPreview.dimensions.width}×${fileWithPreview.dimensions.height}`
                        }
                      </span>
                      {fileWithPreview.file.name.startsWith('pasted-image-') || 
                       fileWithPreview.file.name.startsWith('clipboard-image-') ? (
                        <span className="text-blue-600 flex items-center">
                          <Clipboard className="w-3 h-3" />
                        </span>
                      ) : null}
                    </div>
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

      {/* Instructions */}
      {selectedFiles.length === 0 && uploadStatus === 'idle' && (
        <Card className="border-blue-200 bg-blue-50/30">
          <CardContent className="p-4">
            <div className="text-center space-y-2">
              <div className="flex justify-center items-center space-x-4 text-sm text-blue-800">
                <div className="flex items-center">
                  <ImageIcon className="w-4 h-4 mr-1" />
                  Click to select
                </div>
                <div className="flex items-center">
                  <Upload className="w-4 h-4 mr-1" />
                  Drag & drop
                </div>
                <div className="flex items-center">
                  <Clipboard className="w-4 h-4 mr-1" />
                  Paste (Ctrl+V)
                </div>
              </div>
              <p className="text-xs text-blue-600">
                All images will show a preview before upload and be automatically processed for background removal
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}