'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ChatInterface } from "@/app/components/chat-interface";

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      setError(null);
      setSessionId(null);
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
      console.log('Starting upload...');
      const response = await fetch('http://localhost:8000/api/upload-pdf', {
        method: 'POST',
        body: formData,
      });

      console.log('Response status:', response.status);
      const responseText = await response.text();
      console.log('Response text:', responseText);

      if (!response.ok) {
        let errorMessage = 'Failed to upload PDF';
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.detail || errorMessage;
        } catch (e) {
          // If parsing fails, use the raw response text
          errorMessage = responseText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      try {
        const data = JSON.parse(responseText);
        console.log('Upload successful:', data);
        setSessionId(data.session_id);
        
        // Reset the form
        setFile(null);
        if (document.querySelector<HTMLInputElement>('input[type="file"]')) {
          (document.querySelector<HTMLInputElement>('input[type="file"]')!).value = '';
        }
      } catch (e) {
        throw new Error('Invalid response format from server');
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while uploading');
    } finally {
      setUploading(false);
      setUploadProgress(100);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <div className="max-w-4xl mx-auto space-y-8">
        {!sessionId && (
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
        )}

        {sessionId && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Chat with your PDF</h2>
              <Button
                variant="outline"
                onClick={() => {
                  setSessionId(null);
                  setFile(null);
                }}
              >
                Upload Another PDF
              </Button>
            </div>
            <ChatInterface sessionId={sessionId} />
          </div>
        )}
      </div>
    </div>
  );
}
