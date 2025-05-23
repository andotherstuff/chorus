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
  layoutStyle: 'default' | 'compact' | 'magazine' | 'card-grid';
  headerStyle: 'banner' | 'minimal' | 'overlay' | 'split';
  sidebarPosition: 'left' | 'right' | 'none';
  contentWidth: 'narrow' | 'medium' | 'wide' | 'full';
  
  // Typography
  fontFamily: string;
  fontSize: 'small' | 'medium' | 'large';
  fontWeight: 'light' | 'normal' | 'medium' | 'bold';
  lineHeight: number;
  
  // Visual Elements
  borderRadius: number;
  shadowIntensity: number;
  animationsEnabled: boolean;
  gradientBackground: boolean;
  backgroundPattern: 'none' | 'dots' | 'grid' | 'waves' | 'geometric';
  
  // Header Customization
  bannerImage: string;
  bannerHeight: number;
  logoImage: string;
  logoPosition: 'left' | 'center' | 'right';
  showGroupStats: boolean;
  
  // Post Display
  postStyle: 'default' | 'minimal' | 'card' | 'bubble';
  showAvatars: boolean;
  showTimestamps: boolean;
  showReactionCounts: boolean;
  postsPerPage: number;
  
  // Custom CSS
  customCSS: string;
  
  // Branding
  customFavicon: string;
  customWatermark: string;
  brandingText: string;
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
  
  borderRadius: 8,
  shadowIntensity: 2,
  animationsEnabled: true,
  gradientBackground: false,
  backgroundPattern: 'none',
  
  bannerImage: '',
  bannerHeight: 200,
  logoImage: '',
  logoPosition: 'left',
  showGroupStats: true,
  
  postStyle: 'default',
  showAvatars: true,
  showTimestamps: true,
  showReactionCounts: true,
  postsPerPage: 20,
  
  customCSS: '',
  customFavicon: '',
  customWatermark: '',
  brandingText: ''
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
    return `
      :root {
        --group-primary: ${settings.primaryColor};
        --group-secondary: ${settings.secondaryColor};
        --group-accent: ${settings.accentColor};
        --group-bg: ${settings.backgroundColor};
        --group-text: ${settings.textColor};
        --group-border-radius: ${settings.borderRadius}px;
        --group-shadow: 0 ${settings.shadowIntensity}px ${settings.shadowIntensity * 2}px rgba(0,0,0,0.1);
        --group-font-family: ${settings.fontFamily};
        --group-line-height: ${settings.lineHeight};
      }
      
      .group-customized {
        font-family: var(--group-font-family);
        line-height: var(--group-line-height);
        ${settings.gradientBackground ? `background: linear-gradient(135deg, ${settings.backgroundColor}, ${settings.secondaryColor});` : `background-color: var(--group-bg);`}
        color: var(--group-text);
      }
      
      .group-customized .custom-card {
        border-radius: var(--group-border-radius);
        box-shadow: var(--group-shadow);
        background-color: var(--group-bg);
      }
      
      .group-customized .custom-button-primary {
        background-color: var(--group-primary);
        border-color: var(--group-primary);
      }
      
      .group-customized .custom-button-secondary {
        background-color: var(--group-secondary);
        border-color: var(--group-secondary);
      }
      
      .group-customized .custom-accent {
        color: var(--group-accent);
      }
      
      ${settings.backgroundPattern !== 'none' ? `
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
        <TabsList className="grid w-full grid-cols-5">
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