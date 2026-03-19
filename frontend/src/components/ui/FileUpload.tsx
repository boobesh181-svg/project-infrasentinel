import { useMemo, useState } from "react";
import { UploadCloud } from "lucide-react";

type FileUploadProps = {
  onFileSelect: (file: File | null) => void;
  maxSizeMb?: number;
};

const acceptedTypes = ["application/pdf", "image/png", "image/jpeg"];

const FileUpload = ({ onFileSelect, maxSizeMb = 10 }: FileUploadProps) => {
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");

  const maxSizeBytes = useMemo(() => maxSizeMb * 1024 * 1024, [maxSizeMb]);

  const validateAndSet = (file: File | null) => {
    if (!file) {
      setFileName("");
      setError(null);
      onFileSelect(null);
      return;
    }

    if (!acceptedTypes.includes(file.type)) {
      setError("Only PDF or image files are allowed.");
      onFileSelect(null);
      return;
    }

    if (file.size > maxSizeBytes) {
      setError(`File exceeds ${maxSizeMb}MB limit.`);
      onFileSelect(null);
      return;
    }

    setError(null);
    setFileName(file.name);
    onFileSelect(file);
  };

  return (
    <div className="space-y-2">
      <label htmlFor="evidence-file" className="sr-only">
        Upload evidence file
      </label>
      <div className="rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center transition-all duration-150 hover:border-blue-400 hover:bg-blue-50/30">
        <UploadCloud className="mx-auto mb-2 h-6 w-6 text-slate-500" />
        <p className="text-sm text-slate-700">Drag and drop file or browse</p>
        <p className="mt-1 text-xs text-slate-500">Allowed: PDF / PNG / JPG, max {maxSizeMb}MB</p>
        <input
          id="evidence-file"
          type="file"
          className="mt-3 block w-full text-sm"
          accept="application/pdf,image/png,image/jpeg"
          onChange={(event) => validateAndSet(event.target.files?.[0] ?? null)}
          aria-describedby="evidence-file-help"
        />
      </div>
      <p id="evidence-file-help" className="text-xs text-slate-500">
        {fileName ? `Selected: ${fileName}` : "No file selected."}
      </p>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
};

export default FileUpload;
