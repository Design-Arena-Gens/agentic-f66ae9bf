"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useMemo, useRef, useState } from "react";

type BodyPixModule = typeof import("@tensorflow-models/body-pix");
type BodyPixNet = import("@tensorflow-models/body-pix").BodyPix;
type TfModule = typeof import("@tensorflow/tfjs");

const uploadHint =
  "PNG recommended for best quality. Photos with people yield the most accurate results.";

export default function HomePage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const bodyPixModuleRef = useRef<BodyPixModule | null>(null);
  const netRef = useRef<BodyPixNet | null>(null);
  const tfModuleRef = useRef<TfModule | null>(null);
  const tfReadyRef = useRef(false);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const buttonLabel = useMemo(() => {
    if (isProcessing) return "Removing background…";
    return sourceUrl ? "Choose another image" : "Upload image";
  }, [isProcessing, sourceUrl]);

  const clearObjectUrl = useCallback((url: string | null) => {
    if (url && url.startsWith("blob:")) {
      URL.revokeObjectURL(url);
    }
  }, []);

  const ensureNet = useCallback(async () => {
    if (!tfReadyRef.current) {
      tfModuleRef.current = await import("@tensorflow/tfjs");
      await import("@tensorflow/tfjs-backend-webgl");
      try {
        await tfModuleRef.current.setBackend("webgl");
      } catch {
        await tfModuleRef.current.setBackend("cpu");
      }
      await tfModuleRef.current.ready();
      tfReadyRef.current = true;
    }
    if (!bodyPixModuleRef.current) {
      bodyPixModuleRef.current = await import("@tensorflow-models/body-pix");
    }
    if (!netRef.current) {
      netRef.current = await bodyPixModuleRef.current.load({
        architecture: "MobileNetV1",
        outputStride: 16,
        multiplier: 0.75,
        quantBytes: 2
      });
    }
    return netRef.current;
  }, []);

  const runBackgroundRemoval = useCallback(
    async (file: File) => {
      setIsProcessing(true);
      setError(null);
      setResultUrl(null);
      clearObjectUrl(sourceUrl);
      clearObjectUrl(resultUrl);

      try {
        const objectUrl = URL.createObjectURL(file);
        setSourceUrl(objectUrl);
        setFileName(file.name.replace(/\.[^.]+$/, "") || "ali-bg-remover");

        const image = await new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error("Failed to load image"));
          img.src = objectUrl;
        });

        const net = await ensureNet();
        const segmentation = await net.segmentPerson(image, {
          internalResolution: "medium",
          segmentationThreshold: 0.7
        });

        const canvas = document.createElement("canvas");
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext("2d");

        if (!context) {
          throw new Error("Canvas context unavailable");
        }

        const imageData = context.createImageData(image.width, image.height);
        const { data } = segmentation;
        for (let i = 0; i < data.length; i += 1) {
          const offset = i * 4;
          const visible = data[i] === 1;
          imageData.data[offset] = 255;
          imageData.data[offset + 1] = 255;
          imageData.data[offset + 2] = 255;
          imageData.data[offset + 3] = visible ? 255 : 0;
        }

        context.putImageData(imageData, 0, 0);
        context.globalCompositeOperation = "source-in";
        context.drawImage(image, 0, 0);

        const transparentUrl = canvas.toDataURL("image/png");
        clearObjectUrl(resultUrl);
        setResultUrl(transparentUrl);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unknown processing error";
        setError(message);
      } finally {
        setIsProcessing(false);
      }
    },
    [clearObjectUrl, ensureNet, resultUrl, sourceUrl]
  );

  const handleFileInput = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      runBackgroundRemoval(file);
    },
    [runBackgroundRemoval]
  );

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLLabelElement>) => {
      event.preventDefault();
      const file = event.dataTransfer.files?.[0];
      if (!file) return;
      runBackgroundRemoval(file);
    },
    [runBackgroundRemoval]
  );

  const handleDragOver = useCallback((event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
  }, []);

  const downloadFileName = useMemo(() => {
    if (!fileName) return "ali-bg-remover.png";
    return `${fileName.trim().replace(/\s+/g, "-").toLowerCase()}-no-bg.png`;
  }, [fileName]);

  return (
    <main className="page">
      <section className="hero">
        <div className="hero__badge">ALI BG REMOVER</div>
        <h1>Remove photo backgrounds in seconds.</h1>
        <p className="hero__description">
          Upload your portrait and let our AI isolate the subject with a crisp
          transparent background. Perfect for product shots, profile photos,
          thumbnails, and more.
        </p>
        <label
          className={`dropzone ${
            isProcessing ? "dropzone--disabled" : ""
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileInput}
            hidden
            disabled={isProcessing}
          />
          <div className="dropzone__content">
            <div className="dropzone__icon" aria-hidden="true">
              ⬆️
            </div>
            <div>
              <p className="dropzone__headline">{buttonLabel}</p>
              <p className="dropzone__hint">{uploadHint}</p>
            </div>
          </div>
        </label>
        <button
          className="dropzone__button"
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isProcessing}
        >
          {buttonLabel}
        </button>
        {error ? <p className="hero__error">{error}</p> : null}
      </section>
      <section className="results">
        <div className="results__preview">
          <div className="results__card">
            <h2>Original</h2>
            {sourceUrl ? (
              <img src={sourceUrl} alt="Original upload" />
            ) : (
              <div className="placeholder">
                <span>Upload an image to get started</span>
              </div>
            )}
          </div>
          <div className="results__card">
            <h2>Background Removed</h2>
            {isProcessing ? (
              <div className="placeholder placeholder--processing">
                <span>Processing…</span>
              </div>
            ) : resultUrl ? (
              <img src={resultUrl} alt="Transparent background result" />
            ) : (
              <div className="placeholder">
                <span>Transparent PNG will appear here</span>
              </div>
            )}
          </div>
        </div>
        {resultUrl ? (
          <a
            className="download"
            href={resultUrl}
            download={downloadFileName}
          >
            Download PNG
          </a>
        ) : null}
      </section>
      <footer className="footer">
        <p>
          Tip: For best results, use high-contrast photos where the subject is
          clearly separated from the background.
        </p>
      </footer>
    </main>
  );
}
