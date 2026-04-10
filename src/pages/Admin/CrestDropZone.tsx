import { useState, useRef, useCallback } from "react";
import { uploadClubCrest } from "../../api/adminApi";

interface Props {
  clubId: string;
  currentBadge: string;
  clubName: string;
  onUpdated: (newUrl: string) => void;
}

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];

export default function CrestDropZone({ clubId, currentBadge, clubName, onUpdated }: Props) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imgError, setImgError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      if (!ACCEPTED_TYPES.includes(file.type)) return;
      setUploading(true);
      const url = await uploadClubCrest(clubId, file);
      setUploading(false);
      if (url) {
        setImgError(false);
        onUpdated(url);
      }
    },
    [clubId, onUpdated],
  );

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
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

  const hasBadge = currentBadge && !imgError;

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      className={`relative w-10 h-10 shrink-0 rounded cursor-pointer transition-all ${
        dragging
          ? "ring-2 ring-green-500 bg-green-900/30"
          : "hover:ring-2 hover:ring-gray-500"
      }`}
      title={`Click or drag to upload crest for ${clubName}`}
    >
      {uploading ? (
        <div className="w-full h-full flex items-center justify-center bg-gray-700 rounded">
          <div className="w-5 h-5 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : hasBadge ? (
        <img
          src={currentBadge}
          alt={clubName}
          className="w-full h-full object-contain"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="w-full h-full bg-gray-700 rounded flex items-center justify-center">
          <span className="text-gray-500 text-xs font-bold">
            {clubName.slice(0, 2).toUpperCase()}
          </span>
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
