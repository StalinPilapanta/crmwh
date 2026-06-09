"use client";

import { useState, useCallback, useRef } from "react";
import { Upload, X, FileText, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface KnowledgeDocument {
  id: string;
  name: string;
  file_size: number;
  status: "processing" | "ready" | "error";
  created_at: string;
}

interface KnowledgeUploadProps {
  agentId: string;
  documents: KnowledgeDocument[];
  onDocumentsChange: (documents: KnowledgeDocument[]) => void;
}

export function KnowledgeUpload({
  agentId,
  documents,
  onDocumentsChange,
}: KnowledgeUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const files = Array.from(e.dataTransfer.files).filter(
        (f) => f.type === "application/pdf"
      );
      if (files.length > 0) {
        uploadFiles(files);
      } else {
        setError("Solo se permiten archivos PDF");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [agentId]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length > 0) {
        uploadFiles(files);
      }
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [agentId]
  );

  async function uploadFiles(files: File[]) {
    setError(null);
    setUploading(true);

    for (const file of files) {
      try {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch(`/api/agents/${agentId}/knowledge`, {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Error al subir archivo");
        }

        const { document } = await response.json();
        onDocumentsChange([document, ...documents]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al subir archivo");
      }
    }

    setUploading(false);
  }

  async function handleDelete(docId: string) {
    try {
      const response = await fetch(`/api/agents/${agentId}/knowledge/${docId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Error al eliminar");
      }

      onDocumentsChange(documents.filter((d) => d.id !== docId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar");
    }
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 cursor-pointer transition-colors",
          isDragOver
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
        )}
      >
        {uploading ? (
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        ) : (
          <Upload className="h-8 w-8 text-muted-foreground" />
        )}
        <div className="text-center">
          <p className="text-sm font-medium">
            {uploading ? "Subiendo..." : "Arrastra archivos PDF aquí"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            o haz clic para seleccionar (máx. 10MB)
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <p>{error}</p>
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Document list */}
      {documents.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">
            Documentos ({documents.length})
          </h4>
          <div className="divide-y rounded-lg border">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center gap-3 px-4 py-3"
              >
                <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{doc.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(doc.file_size)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {doc.status === "processing" && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                  {doc.status === "ready" && (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  )}
                  {doc.status === "error" && (
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  )}
                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-destructive transition-colors"
                    aria-label={`Eliminar ${doc.name}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
