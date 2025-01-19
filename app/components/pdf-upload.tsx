'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { API_BASE_URL } from '../config';

export function PDFUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      setError(null);
    } else {
      setError('Please select a valid PDF file');
      setFile(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setUploadProgress(0);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API_BASE_URL}/api/upload-pdf`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to upload PDF');
      }

      const data = await response.json();
      // Here you can handle the response data as needed
      console.log('Upload successful:', data);

      // Reset the form
      setFile(null);
      if (document.querySelector<HTMLInputElement>('input[type="file"]')) {
        (document.querySelector<HTMLInputElement>('input[type="file"]')!).value = '';
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while uploading');
    } finally {
      setUploading(false);
      setUploadProgress(100);
    }
  };

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Upload PDF</h2>
        <div className="grid w-full max-w-sm items-center gap-1.5">
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileChange}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}
        </div>

        <Button
          onClick={handleUpload}
          disabled={!file || uploading}
          className="w-full"
        >
          {uploading ? 'Uploading...' : 'Upload PDF'}
        </Button>

        {uploading && (
          <Progress value={uploadProgress} className="w-full" />
        )}
      </div>
    </Card>
  );
}
