import { useState, useEffect } from "react";
import { useNostr } from "@/hooks/useNostr";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Palette, 
  Type, 
  Layout, 
  Image as ImageIcon, 
  Settings, 
  Eye,
  Save,
  RotateCcw,
  Upload,
  X
} from "lucide-react";
import { ChaosDemo } from "./ChaosDemo";
import { toast } from "sonner";

interface GroupCustomizationProps {
  communityId: string;
  communityPubkey: string;
  communityIdentifier: string;
  isOwner: boolean;
}

interface CustomizationSettings {
  // Theme & Colors
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  darkMode: boolean;
  
  // Layout
  layoutStyle: 'default' | 'compact' | 'magazine' | 'card-grid' | 'chaos' | 'sideways' | 'diagonal' | 'spiral';
  headerStyle: 'banner' | 'minimal' | 'overlay' | 'split' | 'floating' | 'sideways' | 'upside-down' | 'glitch';
  sidebarPosition: 'left' | 'right' | 'none' | 'top' | 'bottom' | 'floating' | 'everywhere';
  contentWidth: 'narrow' | 'medium' | 'wide' | 'full' | 'random' | 'breathing' | 'expanding';
  
  // Typography
  fontFamily: string;
  fontSize: 'small' | 'medium' | 'large' | 'random' | 'growing' | 'shrinking';
  fontWeight: 'light' | 'normal' | 'medium' | 'bold' | 'random' | 'dancing';
  lineHeight: number;
  textRotation: number;
  textSkew: number;
  letterSpacing: number;
  wordSpacing: number;
  
  // Visual Elements
  borderRadius: number;
  shadowIntensity: number;
  animationsEnabled: boolean;
  gradientBackground: boolean;
  backgroundPattern: 'none' | 'dots' | 'grid' | 'waves' | 'geometric' | 'chaos' | 'matrix' | 'glitch' | 'rainbow';
  
  // Experimental Layout
  pageRotation: number;
  pageSkew: number;
  pageScale: number;
  gravityDirection: 'down' | 'up' | 'left' | 'right' | 'center' | 'random';
  elementsFloat: boolean;
  elementsRotate: boolean;
  elementsBounce: boolean;
  
  // Header Customization
  bannerImage: string;
  bannerHeight: number;
  logoImage: string;
  logoPosition: 'left' | 'center' | 'right' | 'floating' | 'spinning' | 'bouncing';
  showGroupStats: boolean;
  headerGravity: boolean;
  
  // Post Display
  postStyle: 'default' | 'minimal' | 'card' | 'bubble' | 'sticky-notes' | 'polaroid' | 'terminal' | 'comic' | 'glitch';
  showAvatars: boolean;
  showTimestamps: boolean;
  showReactionCounts: boolean;
  postsPerPage: number;
  postsArrangement: 'linear' | 'grid' | 'scattered' | 'spiral' | 'wave' | 'random';
  postRotation: boolean;
  postFloating: boolean;
  
  // Chaos Mode
  chaosMode: boolean;
  chaosIntensity: number;
  randomColors: boolean;
  randomFonts: boolean;
  randomSizes: boolean;
  randomPositions: boolean;
  
  // Interactive Elements
  mouseTrail: boolean;
  clickEffects: boolean;
  hoverChaos: boolean;
  scrollEffects: 'none' | 'parallax' | 'zoom' | 'rotate' | 'glitch' | 'matrix';
  
  // Sound & Motion
  soundEffects: boolean;
  backgroundMusic: string;
  vibrationEffects: boolean;
  
  // Time-based Changes
  timeBasedChanges: boolean;
  hourlyColorShift: boolean;
  weatherEffects: boolean;
  
  // Custom CSS
  customCSS: string;
  
  // Branding
  customFavicon: string;
  customWatermark: string;
  brandingText: string;
  
  // Meta Customization
  breakTheRules: boolean;
  experimentalMode: boolean;
  dangerZone: boolean;
}

const defaultSettings: CustomizationSettings = {
  primaryColor: '#3b82f6',
  secondaryColor: '#64748b',
  accentColor: '#10b981',
  backgroundColor: '#ffffff',
  textColor: '#1f2937',
  darkMode: false,
  
  layoutStyle: 'default',
  headerStyle: 'banner',
  sidebarPosition: 'none',
  contentWidth: 'medium',
  
  fontFamily: 'Inter',
  fontSize: 'medium',
  fontWeight: 'normal',
  lineHeight: 1.6,
  textRotation: 0,
  textSkew: 0,
  letterSpacing: 0,
  wordSpacing: 0,
  
  borderRadius: 8,
  shadowIntensity: 2,
  animationsEnabled: true,
  gradientBackground: false,
  backgroundPattern: 'none',
  
  pageRotation: 0,
  pageSkew: 0,
  pageScale: 1,
  gravityDirection: 'down',
  elementsFloat: false,
  elementsRotate: false,
  elementsBounce: false,
  
  bannerImage: '',
  bannerHeight: 200,
  logoImage: '',
  logoPosition: 'left',
  showGroupStats: true,
  headerGravity: false,
  
  postStyle: 'default',
  showAvatars: true,
  showTimestamps: true,
  showReactionCounts: true,
  postsPerPage: 20,
  postsArrangement: 'linear',
  postRotation: false,
  postFloating: false,
  
  chaosMode: false,
  chaosIntensity: 1,
  randomColors: false,
  randomFonts: false,
  randomSizes: false,
  randomPositions: false,
  
  mouseTrail: false,
  clickEffects: false,
  hoverChaos: false,
  scrollEffects: 'none',
  
  soundEffects: false,
  backgroundMusic: '',
  vibrationEffects: false,
  
  timeBasedChanges: false,
  hourlyColorShift: false,
  weatherEffects: false,
  
  customCSS: '',
  customFavicon: '',
  customWatermark: '',
  brandingText: '',
  
  breakTheRules: false,
  experimentalMode: false,
  dangerZone: false
};

export function GroupCustomization({ 
  communityId, 
  communityPubkey, 
  communityIdentifier, 
  isOwner 
}: GroupCustomizationProps) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { mutate: publishEvent } = useNostrPublish();
  const [settings, setSettings] = useState<CustomizationSettings>(defaultSettings);
  const [previewMode, setPreviewMode] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch existing customization settings
  const { data: customizationEvent, isLoading } = useQuery({
    queryKey: ["group-customization", communityPubkey, communityIdentifier],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      const events = await nostr.query([{
        kinds: [30078], // Application-specific data
        authors: [communityPubkey],
        "#d": [`group-customization-${communityIdentifier}`]
      }], { signal });

      return events[0] || null;
    },
    enabled: !!nostr && !!communityPubkey && !!communityIdentifier,
  });

  // Load settings from event
  useEffect(() => {
    if (customizationEvent?.content) {
      try {
        const loadedSettings = JSON.parse(customizationEvent.content);
        setSettings({ ...defaultSettings, ...loadedSettings });
      } catch (error) {
        console.error('Failed to parse customization settings:', error);
      }
    }
  }, [customizationEvent]);

  const updateSetting = <K extends keyof CustomizationSettings>(
    key: K, 
    value: CustomizationSettings[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const saveSettings = async () => {
    if (!user || !isOwner) {
      toast.error("Only group owners can save customization settings");
      return;
    }

    try {
      publishEvent({
        kind: 30078,
        content: JSON.stringify(settings),
        tags: [
          ["d", `group-customization-${communityIdentifier}`],
          ["a", `34550:${communityPubkey}:${communityIdentifier}`],
          ["title", "Group Customization Settings"],
          ["description", "Visual customization settings for the group"]
        ]
      });

      setHasChanges(false);
      toast.success("Customization settings saved!");
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error("Failed to save settings");
    }
  };

  const resetToDefaults = () => {
    setSettings(defaultSettings);
    setHasChanges(true);
    toast.info("Settings reset to defaults");
  };

  const generateCSS = () => {
    const chaosKeyframes = settings.chaosMode ? `
      @keyframes chaos-spin {
        0% { transform: rotate(0deg) scale(1); }
        25% { transform: rotate(90deg) scale(1.1); }
        50% { transform: rotate(180deg) scale(0.9); }
        75% { transform: rotate(270deg) scale(1.2); }
        100% { transform: rotate(360deg) scale(1); }
      }
      
      @keyframes chaos-float {
        0%, 100% { transform: translateY(0px) translateX(0px); }
        25% { transform: translateY(-20px) translateX(10px); }
        50% { transform: translateY(10px) translateX(-15px); }
        75% { transform: translateY(-15px) translateX(5px); }
      }
      
      @keyframes chaos-bounce {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-30px); }
      }
      
      @keyframes glitch {
        0% { transform: translate(0); }
        20% { transform: translate(-2px, 2px); }
        40% { transform: translate(-2px, -2px); }
        60% { transform: translate(2px, 2px); }
        80% { transform: translate(2px, -2px); }
        100% { transform: translate(0); }
      }
      
      @keyframes matrix-rain {
        0% { transform: translateY(-100vh); opacity: 0; }
        10% { opacity: 1; }
        90% { opacity: 1; }
        100% { transform: translateY(100vh); opacity: 0; }
      }
      
      @keyframes rainbow {
        0% { filter: hue-rotate(0deg); }
        100% { filter: hue-rotate(360deg); }
      }
    ` : '';

    return `
      ${chaosKeyframes}
      
      :root {
        --group-primary: ${settings.randomColors ? 'hsl(' + Math.random() * 360 + ', 70%, 50%)' : settings.primaryColor};
        --group-secondary: ${settings.randomColors ? 'hsl(' + Math.random() * 360 + ', 70%, 50%)' : settings.secondaryColor};
        --group-accent: ${settings.randomColors ? 'hsl(' + Math.random() * 360 + ', 70%, 50%)' : settings.accentColor};
        --group-bg: ${settings.backgroundColor};
        --group-text: ${settings.textColor};
        --group-border-radius: ${settings.borderRadius}px;
        --group-shadow: 0 ${settings.shadowIntensity}px ${settings.shadowIntensity * 2}px rgba(0,0,0,0.1);
        --group-font-family: ${settings.fontFamily};
        --group-line-height: ${settings.lineHeight};
        --chaos-intensity: ${settings.chaosIntensity};
      }
      
      .group-customized {
        font-family: var(--group-font-family);
        line-height: var(--group-line-height);
        ${settings.gradientBackground ? `background: linear-gradient(135deg, ${settings.backgroundColor}, ${settings.secondaryColor});` : `background-color: var(--group-bg);`}
        color: var(--group-text);
        
        ${settings.pageRotation !== 0 ? `transform: rotate(${settings.pageRotation}deg);` : ''}
        ${settings.pageSkew !== 0 ? `transform: ${settings.pageRotation !== 0 ? '' : 'transform:'} skew(${settings.pageSkew}deg);` : ''}
        ${settings.pageScale !== 1 ? `transform: ${settings.pageRotation !== 0 || settings.pageSkew !== 0 ? '' : 'transform:'} scale(${settings.pageScale});` : ''}
        
        ${settings.textRotation !== 0 ? `
          * {
            transform: rotate(${settings.textRotation}deg);
            display: inline-block;
          }
        ` : ''}
        
        ${settings.elementsFloat ? `
          * {
            animation: chaos-float 3s ease-in-out infinite;
          }
        ` : ''}
        
        ${settings.elementsRotate ? `
          * {
            animation: chaos-spin 4s linear infinite;
          }
        ` : ''}
        
        ${settings.elementsBounce ? `
          * {
            animation: chaos-bounce 2s ease-in-out infinite;
          }
        ` : ''}
        
        ${settings.chaosMode ? `
          overflow: hidden;
          ${settings.randomPositions ? `
            * {
              position: relative;
              left: ${Math.random() * 20 - 10}px;
              top: ${Math.random() * 20 - 10}px;
            }
          ` : ''}
        ` : ''}
        
        ${settings.scrollEffects === 'glitch' ? `
          animation: glitch 0.3s infinite;
        ` : ''}
        
        ${settings.backgroundPattern === 'rainbow' ? `
          animation: rainbow 3s linear infinite;
        ` : ''}
      }
      
      ${settings.gravityDirection !== 'down' ? `
        .group-customized {
          ${settings.gravityDirection === 'up' ? 'transform: rotate(180deg);' : ''}
          ${settings.gravityDirection === 'left' ? 'transform: rotate(-90deg);' : ''}
          ${settings.gravityDirection === 'right' ? 'transform: rotate(90deg);' : ''}
          ${settings.gravityDirection === 'center' ? 'transform: perspective(1000px) rotateX(45deg) rotateY(45deg);' : ''}
          ${settings.gravityDirection === 'random' ? `transform: rotate(${Math.random() * 360}deg);` : ''}
        }
      ` : ''}
      
      ${settings.postsArrangement !== 'linear' ? `
        .group-customized .posts-container {
          ${settings.postsArrangement === 'scattered' ? `
            display: flex;
            flex-wrap: wrap;
            gap: 20px;
            > * {
              transform: rotate(${Math.random() * 20 - 10}deg);
              margin: ${Math.random() * 20}px;
            }
          ` : ''}
          ${settings.postsArrangement === 'spiral' ? `
            display: flex;
            flex-direction: column;
            align-items: center;
            > * {
              transform-origin: center;
              animation: chaos-spin 10s linear infinite;
            }
          ` : ''}
          ${settings.postsArrangement === 'wave' ? `
            > * {
              transform: translateY(${Math.sin(Math.random() * Math.PI) * 30}px);
            }
          ` : ''}
        }
      ` : ''}
      
      ${settings.postRotation ? `
        .group-customized .custom-post {
          transform: rotate(${Math.random() * 10 - 5}deg);
          transition: transform 0.3s ease;
        }
        .group-customized .custom-post:hover {
          transform: rotate(${Math.random() * 20 - 10}deg) scale(1.05);
        }
      ` : ''}
      
      ${settings.postFloating ? `
        .group-customized .custom-post {
          animation: chaos-float 4s ease-in-out infinite;
          animation-delay: ${Math.random() * 2}s;
        }
      ` : ''}
      
      ${settings.mouseTrail ? `
        .group-customized {
          cursor: none;
        }
        .group-customized::after {
          content: '✨';
          position: fixed;
          pointer-events: none;
          z-index: 9999;
          animation: chaos-float 1s ease-in-out infinite;
        }
      ` : ''}
      
      ${settings.hoverChaos ? `
        .group-customized *:hover {
          animation: glitch 0.5s infinite;
          background-color: hsl(${Math.random() * 360}, 70%, 50%) !important;
          color: hsl(${Math.random() * 360}, 70%, 90%) !important;
        }
      ` : ''}
      
      ${settings.backgroundPattern === 'matrix' ? `
        .group-customized::before {
          content: '';
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(0, 255, 0, 0.1) 2px,
            rgba(0, 255, 0, 0.1) 4px
          );
          animation: matrix-rain 2s linear infinite;
          pointer-events: none;
          z-index: -1;
        }
      ` : ''}
      
      ${settings.backgroundPattern === 'glitch' ? `
        .group-customized::before {
          content: '';
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(45deg, 
            rgba(255,0,0,0.1) 0%, 
            rgba(0,255,0,0.1) 50%, 
            rgba(0,0,255,0.1) 100%);
          animation: glitch 0.1s infinite;
          pointer-events: none;
          z-index: -1;
        }
      ` : ''}
      
      .group-customized .custom-card {
        border-radius: var(--group-border-radius);
        box-shadow: var(--group-shadow);
        background-color: var(--group-bg);
        
        ${settings.chaosMode ? `
          transform: rotate(${Math.random() * 10 - 5}deg);
          ${settings.randomColors ? `background-color: hsl(${Math.random() * 360}, 70%, 95%);` : ''}
        ` : ''}
      }
      
      .group-customized .custom-button-primary {
        background-color: var(--group-primary);
        border-color: var(--group-primary);
        ${settings.chaosMode ? `animation: chaos-bounce 2s ease-in-out infinite;` : ''}
      }
      
      .group-customized .custom-button-secondary {
        background-color: var(--group-secondary);
        border-color: var(--group-secondary);
      }
      
      .group-customized .custom-accent {
        color: var(--group-accent);
      }
      
      ${settings.breakTheRules ? `
        .group-customized * {
          border: 2px solid hsl(${Math.random() * 360}, 70%, 50%) !important;
          transform: rotate(${Math.random() * 360}deg) !important;
          font-size: ${Math.random() * 2 + 0.5}em !important;
          color: hsl(${Math.random() * 360}, 70%, 50%) !important;
          animation: chaos-spin 1s linear infinite !important;
        }
      ` : ''}
      
      ${settings.dangerZone ? `
        .group-customized {
          animation: glitch 0.1s infinite, rainbow 1s linear infinite;
          filter: blur(${Math.random() * 2}px) contrast(${Math.random() * 2 + 0.5});
        }
        .group-customized * {
          animation: chaos-spin 0.5s linear infinite, chaos-float 1s ease-in-out infinite;
        }
      ` : ''}
      
      ${settings.backgroundPattern !== 'none' && settings.backgroundPattern !== 'matrix' && settings.backgroundPattern !== 'glitch' && settings.backgroundPattern !== 'rainbow' ? `
        .group-customized::before {
          content: '';
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          opacity: 0.05;
          pointer-events: none;
          z-index: -1;
          ${getBackgroundPattern(settings.backgroundPattern)}
        }
      ` : ''}
      
      ${settings.customCSS}
    `;
  };

  const getBackgroundPattern = (pattern: string) => {
    switch (pattern) {
      case 'dots':
        return 'background-image: radial-gradient(circle, currentColor 1px, transparent 1px); background-size: 20px 20px;';
      case 'grid':
        return 'background-image: linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px); background-size: 20px 20px;';
      case 'waves':
        return 'background-image: url("data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="currentColor" fill-opacity="0.1"%3E%3Cpath d="M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");';
      case 'geometric':
        return 'background-image: url("data:image/svg+xml,%3Csvg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="currentColor" fill-opacity="0.1"%3E%3Cpath d="M20 20.5V18H0v-2h20v-2H0v-2h20v-2H0V8h20V6H0V4h20V2H0V0h22v20h2V0h2v20h2V0h2v20h2V0h2v20h2V0h2v20h2v2H20v-1.5zM0 20h2v20H0V20zm4 0h2v20H4V20zm4 0h2v20H8V20zm4 0h2v20h-2V20zm4 0h2v20h-2V20zm4 4h20v2H20v-2zm0 4h20v2H20v-2zm0 4h20v2H20v-2zm0 4h20v2H20v-2z"/%3E%3C/g%3E%3C/svg%3E");';
      case 'chaos':
        return `background-image: 
          radial-gradient(circle at 20% 80%, rgba(255,0,0,0.1) 0%, transparent 50%),
          radial-gradient(circle at 80% 20%, rgba(0,255,0,0.1) 0%, transparent 50%),
          radial-gradient(circle at 40% 40%, rgba(0,0,255,0.1) 0%, transparent 50%);
          background-size: 50px 50px, 30px 30px, 70px 70px;`;
      default:
        return '';
    }
  };

  if (!isOwner) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Group Customization</CardTitle>
          <CardDescription>
            Only group owners can customize the appearance of their groups.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Preview Mode Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Group Customization</h2>
          <p className="text-muted-foreground">
            Customize the look and feel of your group
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setPreviewMode(!previewMode)}
            className="flex items-center gap-2"
          >
            <Eye className="h-4 w-4" />
            {previewMode ? 'Exit Preview' : 'Preview'}
          </Button>
          <Button
            variant="outline"
            onClick={resetToDefaults}
            className="flex items-center gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
          <Button
            onClick={saveSettings}
            disabled={!hasChanges}
            className="flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            Save Changes
          </Button>
        </div>
      </div>

      {hasChanges && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            You have unsaved changes. Don't forget to save your customizations!
          </p>
        </div>
      )}

      {/* Chaos Demo */}
      <ChaosDemo />

      {/* Live Preview */}
      {previewMode && (
        <Card>
          <CardHeader>
            <CardTitle>Live Preview</CardTitle>
            <CardDescription>
              See how your customizations will look
            </CardDescription>
          </CardHeader>
          <CardContent>
            <style dangerouslySetInnerHTML={{ __html: generateCSS() }} />
            <div className="group-customized p-6 border rounded-lg min-h-[300px]">
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  {settings.logoImage && (
                    <img 
                      src={settings.logoImage} 
                      alt="Group Logo" 
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  )}
                  <div>
                    <h3 className="text-xl font-bold">Sample Group Name</h3>
                    <p className="text-muted-foreground">This is how your group will look</p>
                  </div>
                </div>
                
                <div className="custom-card p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    {settings.showAvatars && (
                      <div className="w-8 h-8 bg-gray-300 rounded-full"></div>
                    )}
                    <div>
                      <p className="font-medium">Sample User</p>
                      {settings.showTimestamps && (
                        <p className="text-sm text-muted-foreground">2 hours ago</p>
                      )}
                    </div>
                  </div>
                  <p>This is a sample post to show how your customizations will look in the group.</p>
                  {settings.showReactionCounts && (
                    <div className="flex gap-2">
                      <Badge variant="secondary">👍 5</Badge>
                      <Badge variant="secondary">💬 2</Badge>
                    </div>
                  )}
                </div>
                
                <div className="flex gap-2">
                  <Button className="custom-button-primary">Primary Action</Button>
                  <Button variant="outline" className="custom-button-secondary">Secondary</Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Customization Tabs */}
      <Tabs defaultValue="theme" className="w-full">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="theme" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Theme
          </TabsTrigger>
          <TabsTrigger value="layout" className="flex items-center gap-2">
            <Layout className="h-4 w-4" />
            Layout
          </TabsTrigger>
          <TabsTrigger value="typography" className="flex items-center gap-2">
            <Type className="h-4 w-4" />
            Typography
          </TabsTrigger>
          <TabsTrigger value="visual" className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4" />
            Visual
          </TabsTrigger>
          <TabsTrigger value="chaos" className="flex items-center gap-2 text-red-600">
            <RotateCcw className="h-4 w-4" />
            Chaos
          </TabsTrigger>
          <TabsTrigger value="experimental" className="flex items-center gap-2 text-purple-600">
            <Eye className="h-4 w-4" />
            Experimental
          </TabsTrigger>
          <TabsTrigger value="advanced" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Advanced
          </TabsTrigger>
        </TabsList>

        {/* Theme Tab */}
        <TabsContent value="theme" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Color Scheme</CardTitle>
              <CardDescription>
                Customize the colors used throughout your group
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="primary-color">Primary Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="primary-color"
                      type="color"
                      value={settings.primaryColor}
                      onChange={(e) => updateSetting('primaryColor', e.target.value)}
                      className="w-16 h-10"
                    />
                    <Input
                      value={settings.primaryColor}
                      onChange={(e) => updateSetting('primaryColor', e.target.value)}
                      placeholder="#3b82f6"
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="secondary-color">Secondary Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="secondary-color"
                      type="color"
                      value={settings.secondaryColor}
                      onChange={(e) => updateSetting('secondaryColor', e.target.value)}
                      className="w-16 h-10"
                    />
                    <Input
                      value={settings.secondaryColor}
                      onChange={(e) => updateSetting('secondaryColor', e.target.value)}
                      placeholder="#64748b"
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="accent-color">Accent Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="accent-color"
                      type="color"
                      value={settings.accentColor}
                      onChange={(e) => updateSetting('accentColor', e.target.value)}
                      className="w-16 h-10"
                    />
                    <Input
                      value={settings.accentColor}
                      onChange={(e) => updateSetting('accentColor', e.target.value)}
                      placeholder="#10b981"
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="background-color">Background Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="background-color"
                      type="color"
                      value={settings.backgroundColor}
                      onChange={(e) => updateSetting('backgroundColor', e.target.value)}
                      className="w-16 h-10"
                    />
                    <Input
                      value={settings.backgroundColor}
                      onChange={(e) => updateSetting('backgroundColor', e.target.value)}
                      placeholder="#ffffff"
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="gradient-bg"
                  checked={settings.gradientBackground}
                  onCheckedChange={(checked) => updateSetting('gradientBackground', checked)}
                />
                <Label htmlFor="gradient-bg">Use gradient background</Label>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Layout Tab */}
        <TabsContent value="layout" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Layout Options</CardTitle>
              <CardDescription>
                Configure how your group content is displayed
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="layout-style">Layout Style</Label>
                  <Select
                    value={settings.layoutStyle}
                    onValueChange={(value: any) => updateSetting('layoutStyle', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Default</SelectItem>
                      <SelectItem value="compact">Compact</SelectItem>
                      <SelectItem value="magazine">Magazine</SelectItem>
                      <SelectItem value="card-grid">Card Grid</SelectItem>
                      <SelectItem value="chaos">Chaos Mode</SelectItem>
                      <SelectItem value="sideways">Sideways</SelectItem>
                      <SelectItem value="diagonal">Diagonal</SelectItem>
                      <SelectItem value="spiral">Spiral</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="header-style">Header Style</Label>
                  <Select
                    value={settings.headerStyle}
                    onValueChange={(value: any) => updateSetting('headerStyle', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="banner">Banner</SelectItem>
                      <SelectItem value="minimal">Minimal</SelectItem>
                      <SelectItem value="overlay">Overlay</SelectItem>
                      <SelectItem value="split">Split</SelectItem>
                      <SelectItem value="floating">Floating</SelectItem>
                      <SelectItem value="sideways">Sideways</SelectItem>
                      <SelectItem value="upside-down">Upside Down</SelectItem>
                      <SelectItem value="glitch">Glitch</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="content-width">Content Width</Label>
                  <Select
                    value={settings.contentWidth}
                    onValueChange={(value: any) => updateSetting('contentWidth', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="narrow">Narrow</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="wide">Wide</SelectItem>
                      <SelectItem value="full">Full Width</SelectItem>
                      <SelectItem value="random">Random</SelectItem>
                      <SelectItem value="breathing">Breathing</SelectItem>
                      <SelectItem value="expanding">Expanding</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="post-style">Post Style</Label>
                  <Select
                    value={settings.postStyle}
                    onValueChange={(value: any) => updateSetting('postStyle', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Default</SelectItem>
                      <SelectItem value="minimal">Minimal</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                      <SelectItem value="bubble">Bubble</SelectItem>
                      <SelectItem value="sticky-notes">Sticky Notes</SelectItem>
                      <SelectItem value="polaroid">Polaroid</SelectItem>
                      <SelectItem value="terminal">Terminal</SelectItem>
                      <SelectItem value="comic">Comic Book</SelectItem>
                      <SelectItem value="glitch">Glitch</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Typography Tab */}
        <TabsContent value="typography" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Typography Settings</CardTitle>
              <CardDescription>
                Customize fonts and text appearance
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="font-family">Font Family</Label>
                  <Select
                    value={settings.fontFamily}
                    onValueChange={(value) => updateSetting('fontFamily', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Inter">Inter</SelectItem>
                      <SelectItem value="Roboto">Roboto</SelectItem>
                      <SelectItem value="Open Sans">Open Sans</SelectItem>
                      <SelectItem value="Lato">Lato</SelectItem>
                      <SelectItem value="Poppins">Poppins</SelectItem>
                      <SelectItem value="Montserrat">Montserrat</SelectItem>
                      <SelectItem value="Source Sans Pro">Source Sans Pro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="font-size">Font Size</Label>
                  <Select
                    value={settings.fontSize}
                    onValueChange={(value: any) => updateSetting('fontSize', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="small">Small</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="large">Large</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div>
                <Label htmlFor="line-height">Line Height: {settings.lineHeight}</Label>
                <Slider
                  id="line-height"
                  min={1.2}
                  max={2.0}
                  step={0.1}
                  value={[settings.lineHeight]}
                  onValueChange={([value]) => updateSetting('lineHeight', value)}
                  className="mt-2"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Visual Tab */}
        <TabsContent value="visual" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Visual Elements</CardTitle>
              <CardDescription>
                Configure visual effects and branding
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="banner-image">Banner Image URL</Label>
                <Input
                  id="banner-image"
                  value={settings.bannerImage}
                  onChange={(e) => updateSetting('bannerImage', e.target.value)}
                  placeholder="https://example.com/banner.jpg"
                />
              </div>
              
              <div>
                <Label htmlFor="logo-image">Logo Image URL</Label>
                <Input
                  id="logo-image"
                  value={settings.logoImage}
                  onChange={(e) => updateSetting('logoImage', e.target.value)}
                  placeholder="https://example.com/logo.png"
                />
              </div>
              
              <div>
                <Label htmlFor="border-radius">Border Radius: {settings.borderRadius}px</Label>
                <Slider
                  id="border-radius"
                  min={0}
                  max={20}
                  step={1}
                  value={[settings.borderRadius]}
                  onValueChange={([value]) => updateSetting('borderRadius', value)}
                  className="mt-2"
                />
              </div>
              
              <div>
                <Label htmlFor="background-pattern">Background Pattern</Label>
                <Select
                  value={settings.backgroundPattern}
                  onValueChange={(value: any) => updateSetting('backgroundPattern', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="dots">Dots</SelectItem>
                    <SelectItem value="grid">Grid</SelectItem>
                    <SelectItem value="waves">Waves</SelectItem>
                    <SelectItem value="geometric">Geometric</SelectItem>
                    <SelectItem value="chaos">Chaos</SelectItem>
                    <SelectItem value="matrix">Matrix</SelectItem>
                    <SelectItem value="glitch">Glitch</SelectItem>
                    <SelectItem value="rainbow">Rainbow</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="show-avatars"
                    checked={settings.showAvatars}
                    onCheckedChange={(checked) => updateSetting('showAvatars', checked)}
                  />
                  <Label htmlFor="show-avatars">Show user avatars</Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Switch
                    id="show-timestamps"
                    checked={settings.showTimestamps}
                    onCheckedChange={(checked) => updateSetting('showTimestamps', checked)}
                  />
                  <Label htmlFor="show-timestamps">Show timestamps</Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Switch
                    id="animations"
                    checked={settings.animationsEnabled}
                    onCheckedChange={(checked) => updateSetting('animationsEnabled', checked)}
                  />
                  <Label htmlFor="animations">Enable animations</Label>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Chaos Tab */}
        <TabsContent value="chaos" className="space-y-6">
          <Card className="border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20">
            <CardHeader>
              <CardTitle className="text-red-700 dark:text-red-300 flex items-center gap-2">
                <RotateCcw className="h-5 w-5" />
                Chaos Mode
              </CardTitle>
              <CardDescription className="text-red-600 dark:text-red-400">
                ⚠️ Warning: These settings can make your group completely unpredictable and potentially unusable. Use at your own risk!
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="chaos-mode"
                  checked={settings.chaosMode}
                  onCheckedChange={(checked) => updateSetting('chaosMode', checked)}
                />
                <Label htmlFor="chaos-mode" className="text-red-700 dark:text-red-300">Enable Chaos Mode</Label>
              </div>
              
              {settings.chaosMode && (
                <>
                  <div>
                    <Label htmlFor="chaos-intensity">Chaos Intensity: {settings.chaosIntensity}</Label>
                    <Slider
                      id="chaos-intensity"
                      min={1}
                      max={10}
                      step={1}
                      value={[settings.chaosIntensity]}
                      onValueChange={([value]) => updateSetting('chaosIntensity', value)}
                      className="mt-2"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="random-colors"
                        checked={settings.randomColors}
                        onCheckedChange={(checked) => updateSetting('randomColors', checked)}
                      />
                      <Label htmlFor="random-colors">Random Colors</Label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="random-fonts"
                        checked={settings.randomFonts}
                        onCheckedChange={(checked) => updateSetting('randomFonts', checked)}
                      />
                      <Label htmlFor="random-fonts">Random Fonts</Label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="random-sizes"
                        checked={settings.randomSizes}
                        onCheckedChange={(checked) => updateSetting('randomSizes', checked)}
                      />
                      <Label htmlFor="random-sizes">Random Sizes</Label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="random-positions"
                        checked={settings.randomPositions}
                        onCheckedChange={(checked) => updateSetting('randomPositions', checked)}
                      />
                      <Label htmlFor="random-positions">Random Positions</Label>
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="posts-arrangement">Posts Arrangement</Label>
                    <Select
                      value={settings.postsArrangement}
                      onValueChange={(value: any) => updateSetting('postsArrangement', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="linear">Linear</SelectItem>
                        <SelectItem value="grid">Grid</SelectItem>
                        <SelectItem value="scattered">Scattered</SelectItem>
                        <SelectItem value="spiral">Spiral</SelectItem>
                        <SelectItem value="wave">Wave</SelectItem>
                        <SelectItem value="random">Random Chaos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="post-rotation"
                        checked={settings.postRotation}
                        onCheckedChange={(checked) => updateSetting('postRotation', checked)}
                      />
                      <Label htmlFor="post-rotation">Rotating Posts</Label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="post-floating"
                        checked={settings.postFloating}
                        onCheckedChange={(checked) => updateSetting('postFloating', checked)}
                      />
                      <Label htmlFor="post-floating">Floating Posts</Label>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Experimental Tab */}
        <TabsContent value="experimental" className="space-y-6">
          <Card className="border-purple-200 bg-purple-50/50 dark:border-purple-800 dark:bg-purple-950/20">
            <CardHeader>
              <CardTitle className="text-purple-700 dark:text-purple-300 flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Experimental Features
              </CardTitle>
              <CardDescription className="text-purple-600 dark:text-purple-400">
                🧪 These features are experimental and may not work as expected. They push the boundaries of what's possible in web design.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="page-rotation">Page Rotation: {settings.pageRotation}°</Label>
                  <Slider
                    id="page-rotation"
                    min={-45}
                    max={45}
                    step={1}
                    value={[settings.pageRotation]}
                    onValueChange={([value]) => updateSetting('pageRotation', value)}
                    className="mt-2"
                  />
                </div>
                
                <div>
                  <Label htmlFor="page-skew">Page Skew: {settings.pageSkew}°</Label>
                  <Slider
                    id="page-skew"
                    min={-30}
                    max={30}
                    step={1}
                    value={[settings.pageSkew]}
                    onValueChange={([value]) => updateSetting('pageSkew', value)}
                    className="mt-2"
                  />
                </div>
                
                <div>
                  <Label htmlFor="page-scale">Page Scale: {settings.pageScale}x</Label>
                  <Slider
                    id="page-scale"
                    min={0.5}
                    max={2.0}
                    step={0.1}
                    value={[settings.pageScale]}
                    onValueChange={([value]) => updateSetting('pageScale', value)}
                    className="mt-2"
                  />
                </div>
                
                <div>
                  <Label htmlFor="text-rotation">Text Rotation: {settings.textRotation}°</Label>
                  <Slider
                    id="text-rotation"
                    min={-180}
                    max={180}
                    step={5}
                    value={[settings.textRotation]}
                    onValueChange={([value]) => updateSetting('textRotation', value)}
                    className="mt-2"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="gravity-direction">Gravity Direction</Label>
                <Select
                  value={settings.gravityDirection}
                  onValueChange={(value: any) => updateSetting('gravityDirection', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="down">Down (Normal)</SelectItem>
                    <SelectItem value="up">Up (Reverse)</SelectItem>
                    <SelectItem value="left">Left (Sideways)</SelectItem>
                    <SelectItem value="right">Right (Sideways)</SelectItem>
                    <SelectItem value="center">Center (Implosion)</SelectItem>
                    <SelectItem value="random">Random (Chaos)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="elements-float"
                    checked={settings.elementsFloat}
                    onCheckedChange={(checked) => updateSetting('elementsFloat', checked)}
                  />
                  <Label htmlFor="elements-float">Floating Elements</Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Switch
                    id="elements-rotate"
                    checked={settings.elementsRotate}
                    onCheckedChange={(checked) => updateSetting('elementsRotate', checked)}
                  />
                  <Label htmlFor="elements-rotate">Rotating Elements</Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Switch
                    id="elements-bounce"
                    checked={settings.elementsBounce}
                    onCheckedChange={(checked) => updateSetting('elementsBounce', checked)}
                  />
                  <Label htmlFor="elements-bounce">Bouncing Elements</Label>
                </div>
              </div>
              
              <Separator />
              
              <div>
                <Label htmlFor="scroll-effects">Scroll Effects</Label>
                <Select
                  value={settings.scrollEffects}
                  onValueChange={(value: any) => updateSetting('scrollEffects', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="parallax">Parallax</SelectItem>
                    <SelectItem value="zoom">Zoom</SelectItem>
                    <SelectItem value="rotate">Rotate</SelectItem>
                    <SelectItem value="glitch">Glitch</SelectItem>
                    <SelectItem value="matrix">Matrix</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="mouse-trail"
                    checked={settings.mouseTrail}
                    onCheckedChange={(checked) => updateSetting('mouseTrail', checked)}
                  />
                  <Label htmlFor="mouse-trail">Mouse Trail</Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Switch
                    id="click-effects"
                    checked={settings.clickEffects}
                    onCheckedChange={(checked) => updateSetting('clickEffects', checked)}
                  />
                  <Label htmlFor="click-effects">Click Effects</Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Switch
                    id="hover-chaos"
                    checked={settings.hoverChaos}
                    onCheckedChange={(checked) => updateSetting('hoverChaos', checked)}
                  />
                  <Label htmlFor="hover-chaos">Hover Chaos</Label>
                </div>
              </div>
              
              <Separator />
              
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="time-based-changes"
                    checked={settings.timeBasedChanges}
                    onCheckedChange={(checked) => updateSetting('timeBasedChanges', checked)}
                  />
                  <Label htmlFor="time-based-changes">Time-based Changes</Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Switch
                    id="hourly-color-shift"
                    checked={settings.hourlyColorShift}
                    onCheckedChange={(checked) => updateSetting('hourlyColorShift', checked)}
                  />
                  <Label htmlFor="hourly-color-shift">Hourly Color Shift</Label>
                </div>
              </div>
              
              <div>
                <Label htmlFor="background-music">Background Music URL</Label>
                <Input
                  id="background-music"
                  value={settings.backgroundMusic}
                  onChange={(e) => updateSetting('backgroundMusic', e.target.value)}
                  placeholder="https://example.com/music.mp3"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="sound-effects"
                    checked={settings.soundEffects}
                    onCheckedChange={(checked) => updateSetting('soundEffects', checked)}
                  />
                  <Label htmlFor="sound-effects">Sound Effects</Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Switch
                    id="vibration-effects"
                    checked={settings.vibrationEffects}
                    onCheckedChange={(checked) => updateSetting('vibrationEffects', checked)}
                  />
                  <Label htmlFor="vibration-effects">Vibration Effects</Label>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Advanced Tab */}
        <TabsContent value="advanced" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Advanced Customization</CardTitle>
              <CardDescription>
                Custom CSS and advanced options
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="custom-css">Custom CSS</Label>
                <Textarea
                  id="custom-css"
                  value={settings.customCSS}
                  onChange={(e) => updateSetting('customCSS', e.target.value)}
                  placeholder="/* Add your custom CSS here */"
                  className="font-mono text-sm min-h-[200px]"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Use CSS variables like --group-primary, --group-secondary, etc.
                </p>
              </div>
              
              <Separator />
              
              <div>
                <Label htmlFor="branding-text">Custom Branding Text</Label>
                <Input
                  id="branding-text"
                  value={settings.brandingText}
                  onChange={(e) => updateSetting('brandingText', e.target.value)}
                  placeholder="Powered by YourBrand"
                />
              </div>
              
              <div>
                <Label htmlFor="posts-per-page">Posts Per Page: {settings.postsPerPage}</Label>
                <Slider
                  id="posts-per-page"
                  min={5}
                  max={50}
                  step={5}
                  value={[settings.postsPerPage]}
                  onValueChange={([value]) => updateSetting('postsPerPage', value)}
                  className="mt-2"
                />
              </div>
            </CardContent>
          </Card>
          
          {/* Danger Zone */}
          <Card className="border-red-500 bg-red-50/50 dark:border-red-500 dark:bg-red-950/20">
            <CardHeader>
              <CardTitle className="text-red-700 dark:text-red-300 flex items-center gap-2">
                <X className="h-5 w-5" />
                Danger Zone
              </CardTitle>
              <CardDescription className="text-red-600 dark:text-red-400">
                ☢️ EXTREME WARNING: These settings can completely break your group's usability. Only enable if you know what you're doing!
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="break-the-rules"
                  checked={settings.breakTheRules}
                  onCheckedChange={(checked) => updateSetting('breakTheRules', checked)}
                />
                <Label htmlFor="break-the-rules" className="text-red-700 dark:text-red-300">Break All Design Rules</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="experimental-mode"
                  checked={settings.experimentalMode}
                  onCheckedChange={(checked) => updateSetting('experimentalMode', checked)}
                />
                <Label htmlFor="experimental-mode" className="text-red-700 dark:text-red-300">Experimental Mode</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="danger-zone"
                  checked={settings.dangerZone}
                  onCheckedChange={(checked) => updateSetting('dangerZone', checked)}
                />
                <Label htmlFor="danger-zone" className="text-red-700 dark:text-red-300">Enter the Danger Zone</Label>
              </div>
              
              {settings.dangerZone && (
                <div className="p-4 bg-red-100 dark:bg-red-900/30 rounded-lg border border-red-300 dark:border-red-700">
                  <p className="text-red-800 dark:text-red-200 text-sm font-medium mb-2">
                    🚨 You have entered the Danger Zone! 🚨
                  </p>
                  <p className="text-red-700 dark:text-red-300 text-xs">
                    Your group may become completely unusable. Users may experience motion sickness, 
                    confusion, or inability to read content. Use these powers responsibly!
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Generated CSS Output */}
      <Card>
        <CardHeader>
          <CardTitle>Generated CSS</CardTitle>
          <CardDescription>
            This is the CSS that will be applied to your group
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[200px] w-full">
            <pre className="text-xs bg-muted p-4 rounded-lg overflow-x-auto">
              <code>{generateCSS()}</code>
            </pre>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

export { type CustomizationSettings };