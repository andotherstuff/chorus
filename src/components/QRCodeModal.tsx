import { QRCodeSVG } from 'qrcode.react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Copy, Download } from 'lucide-react';
import { toast } from 'sonner';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  profileUrl: string;
  displayName: string;
  title?: string;
  description?: string;
  downloadPrefix?: string;
}

export function QRCodeModal({ 
  isOpen, 
  onClose, 
  profileUrl, 
  displayName,
  title = "Share Profile",
  description = `Scan this QR code to view ${displayName}'s profile`,
  downloadPrefix = "profile"
}: QRCodeModalProps) {
  const handleCopyLink = () => {
    navigator.clipboard.writeText(profileUrl);
    const linkType = title.includes('Group') ? 'Group' : 'Profile';
    toast.success(`${linkType} link copied to clipboard`);
  };

  const handleDownloadQR = () => {
    // Get the QR code SVG element
    const svg = document.getElementById('profile-qr-code');
    if (!svg) return;

    // Convert SVG to canvas
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      
      // Convert canvas to download link
      const pngUrl = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.download = `${displayName}-${downloadPrefix}-qr.png`;
      downloadLink.href = pngUrl;
      downloadLink.click();
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center space-y-4 py-4">
          <div className="bg-white p-4 rounded-lg">
            <QRCodeSVG
              id="profile-qr-code"
              value={profileUrl}
              size={200}
              level="M"
              includeMargin={false}
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleCopyLink}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy Link
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleDownloadQR}
            >
              <Download className="h-4 w-4 mr-2" />
              Download QR
            </Button>
          </div>
          <p className="text-xs text-muted-foreground text-center break-all">
            {profileUrl}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}