import { useEffect, useRef, useState, useCallback } from "react";
import { BrowserQRCodeReader, BrowserCodeReader } from "@zxing/browser";
import { DecodeHintType } from "@zxing/library";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Camera, X, Loader2 } from "lucide-react";

interface QRScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (data: string) => void;
  title?: string;
  description?: string;
}

export function QRScanner({
  isOpen,
  onClose,
  onScan,
  title = "Scan QR Code",
  description = "Position the QR code within the frame to scan",
}: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const readerRef = useRef<BrowserQRCodeReader | null>(null);
  const hasStartedRef = useRef(false);

  const stopScanner = useCallback(() => {
    if (readerRef.current) {
      try {
        // The BrowserQRCodeReader doesn't have a specific stop method
        // The decoding will stop when the component unmounts
        readerRef.current = null;
      } catch (e) {
        console.error("Error stopping scanner:", e);
      }
    }
    setIsScanning(false);
    setIsLoading(false);
  }, []);

  const handleClose = useCallback(() => {
    stopScanner();
    setError(null);
    setHasPermission(null);
    onClose();
  }, [stopScanner, onClose]);

  const startScanner = useCallback(async () => {
    if (!videoRef.current || readerRef.current) return;

    try {
      setError(null);
      setIsLoading(true);

      // First, try to request camera permission explicitly
      console.log("Requesting camera permission...");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
        });
        // Stop the stream immediately, we just wanted to check permissions
        stream.getTracks().forEach((track) => track.stop());
        console.log("Camera permission granted");
      } catch (permError) {
        console.error("Permission error:", permError);
        throw permError;
      }

      const codeReader = new BrowserQRCodeReader();
      readerRef.current = codeReader;

      console.log("Initializing QR scanner...");

      // Get video devices using the static method
      const devices = await BrowserCodeReader.listVideoInputDevices();
      console.log("Found video devices:", devices);

      if (devices.length === 0) {
        throw new Error("No camera devices found");
      }

      // Prefer back camera on mobile devices
      const selectedDevice =
        devices.find(
          (device) =>
            device.label.toLowerCase().includes("back") ||
            device.label.toLowerCase().includes("rear")
        ) || devices[0];

      console.log("Using device:", selectedDevice);

      // Start continuous decoding
      const controls = await codeReader.decodeFromVideoDevice(
        selectedDevice.deviceId,
        videoRef.current,
        (result, err) => {
          if (result) {
            console.log("QR Code detected:", result.getText());
            onScan(result.getText());
            handleClose();
          }
          // Handle errors but filter out common "not found" errors
          if (err) {
            const errorMessage = err?.message || String(err);
            if (
              !errorMessage.includes("NotFoundException") &&
              !errorMessage.includes("No MultiFormat Readers")
            ) {
              // console.warn('Decode warning:', errorMessage);
            }
          }
        }
      );

      console.log("Scanner started successfully");
      setHasPermission(true);
      setIsScanning(true);
      setIsLoading(false);
    } catch (err) {
      console.error("Scanner error:", err);

      if (err instanceof Error) {
        if (
          err.name === "NotAllowedError" ||
          err.message.includes("Permission denied")
        ) {
          setHasPermission(false);
          setError(
            "Camera permission denied. Please allow camera access in your browser settings."
          );
        } else if (
          err.name === "NotFoundError" ||
          err.message.includes("No camera")
        ) {
          setError(
            "No camera found. Please ensure your device has a working camera."
          );
        } else if (err.name === "NotReadableError") {
          setError("Camera is already in use by another application.");
        } else if (err.message.includes("Insecure context")) {
          setError(
            "Camera access requires HTTPS. Please use a secure connection."
          );
        } else {
          setError(`Camera error: ${err.message}`);
        }
      } else {
        setError("Failed to start camera");
      }

      stopScanner();
    }
  }, [onScan, handleClose, stopScanner]);

  useEffect(() => {
    // Reset the hasStartedRef when dialog closes
    if (!isOpen) {
      hasStartedRef.current = false;
      stopScanner();
      return;
    }

    // Check if we're in a secure context
    if (isOpen && !window.isSecureContext) {
      setError(
        "Camera access requires HTTPS. Please use https:// or localhost."
      );
      setHasPermission(false);
      return;
    }

    // Only start scanner once when dialog opens
    if (
      isOpen &&
      !hasStartedRef.current &&
      !isLoading &&
      !isScanning &&
      !error
    ) {
      hasStartedRef.current = true;
      // Delay to ensure dialog is fully rendered
      const timer = setTimeout(() => {
        startScanner();
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [isOpen, isLoading, isScanning, error, startScanner, stopScanner]);

  const handleRetry = () => {
    setError(null);
    setHasPermission(null);
    hasStartedRef.current = false;
    startScanner();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="relative">
          {/* Video element for camera feed */}
          <div className="relative aspect-square bg-black rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
              autoPlay
            />

            {/* Scanning overlay */}
            <div className="absolute inset-0 pointer-events-none">
              {/* Corner markers */}
              <div className="absolute top-8 left-8 w-8 h-8 border-t-2 border-l-2 border-white"></div>
              <div className="absolute top-8 right-8 w-8 h-8 border-t-2 border-r-2 border-white"></div>
              <div className="absolute bottom-8 left-8 w-8 h-8 border-b-2 border-l-2 border-white"></div>
              <div className="absolute bottom-8 right-8 w-8 h-8 border-b-2 border-r-2 border-white"></div>

              {/* Scanning line animation */}
              {isScanning && !error && (
                <div className="absolute inset-x-8 top-8 bottom-8">
                  <div className="h-0.5 bg-green-400 animate-scan"></div>
                </div>
              )}

              {/* Loading indicator */}
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
                  <div className="flex flex-col items-center gap-2 text-white">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <span className="text-sm">Starting camera...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Permission denied or error overlay */}
            {(hasPermission === false || (error && !isLoading)) && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/95 rounded-lg">
                <div className="text-center p-4 max-w-sm">
                  <Camera className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mb-4">
                    {error || "Camera permission is required to scan QR codes"}
                  </p>
                  <Button onClick={handleRetry} variant="secondary">
                    Try Again
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Additional instructions */}
          {isScanning && !error && (
            <p className="text-xs text-muted-foreground text-center mt-2">
              Hold steady and ensure good lighting
            </p>
          )}
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={handleClose}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
