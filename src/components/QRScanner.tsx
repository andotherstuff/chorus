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
import { AlertCircle, Camera, X, Loader2, SwitchCamera } from "lucide-react";

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
  const lastScannedRef = useRef<string | null>(null);
  const scanTimeoutRef = useRef<number | null>(null);
  const isProcessingRef = useRef(false);
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const [isSwitching, setIsSwitching] = useState(false);

  const stopScanner = useCallback(() => {
    if (controlsRef.current) {
      try {
        controlsRef.current.stop();
        controlsRef.current = null;
      } catch (e) {
        console.error("Error stopping controls:", e);
      }
    }
    
    if (readerRef.current) {
      try {
        // The BrowserQRCodeReader doesn't have a specific stop method
        // The decoding will stop when the component unmounts
        readerRef.current = null;
      } catch (e) {
        console.error("Error stopping scanner:", e);
      }
    }
    
    // Clear any pending timeout
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
    
    setIsScanning(false);
    setIsLoading(false);
    isProcessingRef.current = false;
    
    // Don't reset switching state here as it's managed by switchCamera
  }, []);

  const handleClose = useCallback(() => {
    stopScanner();
    setError(null);
    setHasPermission(null);
    lastScannedRef.current = null;
    onClose();
  }, [stopScanner, onClose]);

  const startScanner = useCallback(async () => {
    if (!videoRef.current) return;
    
    // Don't start if we're already starting/scanning and not switching cameras
    if ((readerRef.current || isScanning) && !selectedCameraId) return;

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

      // Create new reader instance
      const codeReader = new BrowserQRCodeReader();
      readerRef.current = codeReader;

      console.log("Initializing QR scanner...");

      // Get video devices using the static method
      const devices = await BrowserCodeReader.listVideoInputDevices();
      console.log("Found video devices:", devices);

      if (devices.length === 0) {
        throw new Error("No camera devices found");
      }

      // Store available cameras
      setAvailableCameras(devices);

      // Select camera
      let deviceToUse: MediaDeviceInfo;
      
      if (selectedCameraId) {
        // Use the selected camera if specified
        deviceToUse = devices.find(d => d.deviceId === selectedCameraId) || devices[0];
      } else {
        // Try to find the back camera first
        const backCamera = devices.find(
          (device) => {
            const label = device.label.toLowerCase();
            return (
              label.includes("back") ||
              label.includes("rear") ||
              label.includes("environment") ||
              // iOS specific labels
              label.includes("0, facing back") ||
              label.includes("camera 0") || // Often the back camera on iOS
              // Additional patterns
              label.includes("camera2 0") ||
              label.includes("video 0")
            );
          }
        );
        
        // If no back camera found, try to avoid front camera
        const nonFrontCamera = devices.find(
          (device) => {
            const label = device.label.toLowerCase();
            return !(
              label.includes("front") ||
              label.includes("user") ||
              label.includes("facetime") ||
              label.includes("1, facing front") ||
              label.includes("camera2 1") ||
              label.includes("video 1")
            );
          }
        );
        
        deviceToUse = backCamera || nonFrontCamera || devices[0];
        setSelectedCameraId(deviceToUse.deviceId);
      }

      console.log("Using device:", deviceToUse);

      // Stop any existing controls before starting new ones
      if (controlsRef.current) {
        try {
          controlsRef.current.stop();
          controlsRef.current = null;
        } catch (e) {
          console.error("Error stopping existing controls:", e);
        }
      }

      // Clear video element before starting new stream
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }

      // Small delay to ensure cleanup on iOS
      await new Promise(resolve => setTimeout(resolve, 100));

      // Start continuous decoding
      const controls = await codeReader.decodeFromVideoDevice(
        deviceToUse.deviceId,
        videoRef.current,
        (result, err) => {
          // Only process if we haven't already processed a scan
          if (result && !isProcessingRef.current) {
            const scannedText = result.getText();
            
            // Check if this is a duplicate scan within 2 seconds
            if (lastScannedRef.current === scannedText && scanTimeoutRef.current) {
              return; // Ignore duplicate
            }
            
            // Mark as processing to prevent further scans
            isProcessingRef.current = true;
            
            console.log("QR Code detected:", scannedText);
            lastScannedRef.current = scannedText;
            
            // Set a timeout to reset the last scanned reference
            if (scanTimeoutRef.current) {
              clearTimeout(scanTimeoutRef.current);
            }
            scanTimeoutRef.current = window.setTimeout(() => {
              lastScannedRef.current = null;
              scanTimeoutRef.current = null;
            }, 2000);
            
            // Stop scanning immediately
            stopScanner();
            
            // Call the onScan callback
            onScan(scannedText);
            
            // Close the dialog
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

      controlsRef.current = controls;
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
  }, [selectedCameraId, onScan, handleClose, stopScanner, isScanning]);

  const switchCamera = useCallback(async () => {
    if (availableCameras.length <= 1 || isSwitching) return;
    
    // Set switching state
    setIsSwitching(true);
    
    // Find the next camera in the list
    const currentIndex = availableCameras.findIndex(
      cam => cam.deviceId === selectedCameraId
    );
    const nextIndex = (currentIndex + 1) % availableCameras.length;
    const nextCamera = availableCameras[nextIndex];
    
    console.log("Switching from camera:", selectedCameraId, "to:", nextCamera.deviceId);
    
    // Set loading state while switching
    setIsLoading(true);
    setIsScanning(false);
    
    // Stop current stream completely
    if (controlsRef.current) {
      try {
        controlsRef.current.stop();
        controlsRef.current = null;
      } catch (e) {
        console.error("Error stopping controls during switch:", e);
      }
    }
    
    // Clear the video element and stop all tracks
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => {
        track.stop();
        console.log("Stopped track:", track.label);
      });
      videoRef.current.srcObject = null;
    }
    
    // Reset reader
    if (readerRef.current) {
      readerRef.current = null;
    }
    
    // Update selected camera
    setSelectedCameraId(nextCamera.deviceId);
    
    // For iOS Safari, we need a longer delay and full re-initialization
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !('MSStream' in window);
    const delay = isIOS ? 800 : 300;
    
    // Wait before restarting with new camera
    setTimeout(() => {
      hasStartedRef.current = false;
      setIsSwitching(false);
      startScanner();
    }, delay);
  }, [availableCameras, selectedCameraId, isSwitching, startScanner]);

  useEffect(() => {
    // Reset the hasStartedRef when dialog closes
    if (!isOpen) {
      hasStartedRef.current = false;
      isProcessingRef.current = false;
      lastScannedRef.current = null;
      setSelectedCameraId(null);
      setAvailableCameras([]);
      setIsSwitching(false);
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
    isProcessingRef.current = false;
    lastScannedRef.current = null;
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

            {/* Camera switch button - only show if multiple cameras and scanning */}
            {isScanning && availableCameras.length > 1 && !error && (
              <div className="absolute top-4 right-4 pointer-events-auto">
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={switchCamera}
                  disabled={isSwitching || isLoading}
                  className="bg-black/50 hover:bg-black/70 text-white border-0"
                  title="Switch camera"
                >
                  {isSwitching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <SwitchCamera className="h-4 w-4" />
                  )}
                </Button>
              </div>
            )}

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
