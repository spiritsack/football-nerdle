import { useState, useRef, useCallback } from "react";

interface Props {
  currentImage: string;
  alt: string;
  title: string;
  fallbackText: string;
  shape?: "square" | "circle";
  upload: (file: File) => Promise<string | null>;
  onUpdated: (newUrl: string) => void;
}

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];

export default function ImageDropZone({
  currentImage,
  alt,
  title,
  fallbackText,
  shape = "square",
  upload,
  onUpdated,
}: Props) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imgError, setImgError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      if (!ACCEPTED_TYPES.includes(file.type)) return;
      setUploading(true);
      const url = await upload(file);
      setUploading(false);
      if (url) {
        setImgError(false);
        onUpdated(url);
      }
    },
    [upload, onUpdated],
  );

  function handleDragOver(e: React.DragEvent) {
    // Only react to file drags — row-reorder drags pass through to the row
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleClick() {
    fileInputRef.current?.click();
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset so the same file can be re-selected
    e.target.value = "";
  }

  const hasImage = currentImage && !imgError;
  const rounded = shape === "circle" ? "rounded-full" : "rounded";

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      className={`relative w-10 h-10 shrink-0 cursor-pointer transition-all ${rounded} ${
        dragging
          ? "ring-2 ring-green-500 bg-green-900/30"
          : "hover:ring-2 hover:ring-gray-500"
      }`}
      title={title}
    >
      {uploading ? (
        <div className={`w-full h-full flex items-center justify-center bg-gray-700 ${rounded}`}>
          <div className="w-5 h-5 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : hasImage ? (
        <img
          src={currentImage}
          alt={alt}
          referrerPolicy="no-referrer"
          className={`w-full h-full ${rounded} ${shape === "circle" ? "object-cover bg-gray-700" : "object-contain"}`}
          onError={() => setImgError(true)}
        />
      ) : (
        <div className={`w-full h-full bg-gray-700 flex items-center justify-center ${rounded}`}>
          <span className="text-gray-500 text-xs font-bold">{fallbackText}</span>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        onChange={handleFileInput}
        className="hidden"
      />
    </div>
  );
}
