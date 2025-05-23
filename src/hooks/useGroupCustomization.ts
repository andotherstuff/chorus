import { useQuery } from "@tanstack/react-query";
import { useNostr } from "@/hooks/useNostr";
import { useEffect } from "react";
import type { CustomizationSettings } from "@/components/groups/GroupCustomization";
import { chaosEffects } from "@/lib/chaos-effects";

interface UseGroupCustomizationProps {
  communityPubkey: string;
  communityIdentifier: string;
  enabled?: boolean;
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

export function useGroupCustomization({ 
  communityPubkey, 
  communityIdentifier, 
  enabled = true 
}: UseGroupCustomizationProps) {
  const { nostr } = useNostr();

  const { data: customizationEvent, isLoading, error } = useQuery({
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
    enabled: !!nostr && !!communityPubkey && !!communityIdentifier && enabled,
  });

  // Parse settings from event content
  const settings: CustomizationSettings = (() => {
    if (!customizationEvent?.content) {
      return defaultSettings;
    }

    try {
      const loadedSettings = JSON.parse(customizationEvent.content);
      return { ...defaultSettings, ...loadedSettings };
    } catch (error) {
      console.error('Failed to parse customization settings:', error);
      return defaultSettings;
    }
  })();

  // Generate CSS from settings
  const generateCSS = (settings: CustomizationSettings) => {
    const getBackgroundPattern = (pattern: string) => {
      switch (pattern) {
        case 'dots':
          return 'background-image: radial-gradient(circle, currentColor 1px, transparent 1px); background-size: 20px 20px;';
        case 'grid':
          return 'background-image: linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px); background-size: 20px 20px;';
        case 'waves':
          return 'background-image: url("data:image/svg+xml,%3Csvg width=\\"60\\" height=\\"60\\" viewBox=\\"0 0 60 60\\" xmlns=\\"http://www.w3.org/2000/svg\\"%3E%3Cg fill=\\"none\\" fill-rule=\\"evenodd\\"%3E%3Cg fill=\\"currentColor\\" fill-opacity=\\"0.1\\"%3E%3Cpath d=\\"M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\\"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");';
        case 'geometric':
          return 'background-image: url("data:image/svg+xml,%3Csvg width=\\"40\\" height=\\"40\\" viewBox=\\"0 0 40 40\\" xmlns=\\"http://www.w3.org/2000/svg\\"%3E%3Cg fill=\\"currentColor\\" fill-opacity=\\"0.1\\"%3E%3Cpath d=\\"M20 20.5V18H0v-2h20v-2H0v-2h20v-2H0V8h20V6H0V4h20V2H0V0h22v20h2V0h2v20h2V0h2v20h2V0h2v20h2v2H20v-1.5zM0 20h2v20H0V20zm4 0h2v20H4V20zm4 0h2v20H8V20zm4 0h2v20h-2V20zm4 0h2v20h-2V20zm4 4h20v2H20v-2zm0 4h20v2H20v-2zm0 4h20v2H20v-2zm0 4h20v2H20v-2z\\"/%3E%3C/g%3E%3C/svg%3E");';
        default:
          return '';
      }
    };

    const fontSizeMap = {
      small: '14px',
      medium: '16px',
      large: '18px'
    };

    const fontWeightMap = {
      light: '300',
      normal: '400',
      medium: '500',
      bold: '700'
    };

    return `
      :root {
        --group-primary: ${settings.primaryColor};
        --group-secondary: ${settings.secondaryColor};
        --group-accent: ${settings.accentColor};
        --group-bg: ${settings.backgroundColor};
        --group-text: ${settings.textColor};
        --group-border-radius: ${settings.borderRadius}px;
        --group-shadow: 0 ${settings.shadowIntensity}px ${settings.shadowIntensity * 2}px rgba(0,0,0,0.1);
        --group-font-family: ${settings.fontFamily}, system-ui, -apple-system, sans-serif;
        --group-font-size: ${fontSizeMap[settings.fontSize]};
        --group-font-weight: ${fontWeightMap[settings.fontWeight]};
        --group-line-height: ${settings.lineHeight};
        --group-banner-height: ${settings.bannerHeight}px;
      }
      
      .group-customized {
        font-family: var(--group-font-family);
        font-size: var(--group-font-size);
        font-weight: var(--group-font-weight);
        line-height: var(--group-line-height);
        ${settings.gradientBackground ? 
          `background: linear-gradient(135deg, ${settings.backgroundColor}, ${settings.secondaryColor});` : 
          `background-color: var(--group-bg);`
        }
        color: var(--group-text);
        ${!settings.animationsEnabled ? 'transition: none !important;' : ''}
      }
      
      .group-customized * {
        ${!settings.animationsEnabled ? 'transition: none !important; animation: none !important;' : ''}
      }
      
      .group-customized .custom-card {
        border-radius: var(--group-border-radius);
        box-shadow: var(--group-shadow);
        background-color: var(--group-bg);
        border: 1px solid rgba(0,0,0,0.1);
      }
      
      .group-customized .custom-button-primary {
        background-color: var(--group-primary);
        border-color: var(--group-primary);
        color: white;
      }
      
      .group-customized .custom-button-primary:hover {
        background-color: color-mix(in srgb, var(--group-primary) 90%, black);
        border-color: color-mix(in srgb, var(--group-primary) 90%, black);
      }
      
      .group-customized .custom-button-secondary {
        background-color: var(--group-secondary);
        border-color: var(--group-secondary);
        color: white;
      }
      
      .group-customized .custom-button-secondary:hover {
        background-color: color-mix(in srgb, var(--group-secondary) 90%, black);
        border-color: color-mix(in srgb, var(--group-secondary) 90%, black);
      }
      
      .group-customized .custom-accent {
        color: var(--group-accent);
      }
      
      .group-customized .custom-banner {
        height: var(--group-banner-height);
        ${settings.bannerImage ? `background-image: url('${settings.bannerImage}');` : ''}
        background-size: cover;
        background-position: center;
        background-repeat: no-repeat;
      }
      
      .group-customized .custom-logo {
        ${settings.logoPosition === 'center' ? 'margin: 0 auto;' : ''}
        ${settings.logoPosition === 'right' ? 'margin-left: auto;' : ''}
      }
      
      .group-customized .custom-post {
        ${settings.postStyle === 'card' ? `
          background: var(--group-bg);
          border: 1px solid rgba(0,0,0,0.1);
          border-radius: var(--group-border-radius);
          padding: 1rem;
          margin-bottom: 1rem;
          box-shadow: var(--group-shadow);
        ` : ''}
        ${settings.postStyle === 'bubble' ? `
          background: var(--group-bg);
          border-radius: 18px;
          padding: 1rem;
          margin-bottom: 1rem;
          position: relative;
        ` : ''}
        ${settings.postStyle === 'minimal' ? `
          border-bottom: 1px solid rgba(0,0,0,0.1);
          padding: 0.5rem 0;
          margin-bottom: 0.5rem;
        ` : ''}
      }
      
      .group-customized .custom-avatar {
        ${!settings.showAvatars ? 'display: none;' : ''}
      }
      
      .group-customized .custom-timestamp {
        ${!settings.showTimestamps ? 'display: none;' : ''}
      }
      
      .group-customized .custom-reactions {
        ${!settings.showReactionCounts ? 'display: none;' : ''}
      }
      
      .group-customized .custom-content-width {
        ${settings.contentWidth === 'narrow' ? 'max-width: 600px;' : ''}
        ${settings.contentWidth === 'medium' ? 'max-width: 800px;' : ''}
        ${settings.contentWidth === 'wide' ? 'max-width: 1200px;' : ''}
        ${settings.contentWidth === 'full' ? 'max-width: 100%;' : ''}
        margin: 0 auto;
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
      
      ${settings.brandingText ? `
        .group-customized::after {
          content: '${settings.brandingText}';
          position: fixed;
          bottom: 10px;
          right: 10px;
          font-size: 10px;
          opacity: 0.5;
          pointer-events: none;
          z-index: 1000;
        }
      ` : ''}
      
      ${settings.customCSS}
    `;
  };

  const css = generateCSS(settings);

  // Apply CSS to document
  useEffect(() => {
    if (!enabled) return;

    const styleId = `group-customization-${communityPubkey}-${communityIdentifier}`;
    let styleElement = document.getElementById(styleId) as HTMLStyleElement;
    
    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = styleId;
      document.head.appendChild(styleElement);
    }
    
    styleElement.textContent = css;

    // Apply favicon if specified
    if (settings.customFavicon) {
      const favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
      if (favicon) {
        favicon.href = settings.customFavicon;
      }
    }

    // Initialize chaos effects
    if (enabled && (settings.mouseTrail || settings.clickEffects || settings.hoverChaos || 
        settings.soundEffects || settings.backgroundMusic || settings.chaosMode || 
        settings.timeBasedChanges || settings.hourlyColorShift)) {
      chaosEffects.init({
        mouseTrail: settings.mouseTrail,
        clickEffects: settings.clickEffects,
        hoverChaos: settings.hoverChaos,
        soundEffects: settings.soundEffects,
        vibrationEffects: settings.vibrationEffects,
        timeBasedChanges: settings.timeBasedChanges,
        hourlyColorShift: settings.hourlyColorShift,
        chaosMode: settings.chaosMode,
        chaosIntensity: settings.chaosIntensity,
        backgroundMusic: settings.backgroundMusic
      });
    }

    return () => {
      // Clean up when component unmounts or settings change
      const element = document.getElementById(styleId);
      if (element) {
        element.remove();
      }
      
      // Clean up chaos effects
      chaosEffects.cleanup();
    };
  }, [css, enabled, communityPubkey, communityIdentifier, settings.customFavicon, 
      settings.mouseTrail, settings.clickEffects, settings.hoverChaos, settings.soundEffects,
      settings.backgroundMusic, settings.chaosMode, settings.timeBasedChanges, settings.hourlyColorShift]);

  return {
    settings,
    css,
    isLoading,
    error,
    hasCustomization: !!customizationEvent
  };
}