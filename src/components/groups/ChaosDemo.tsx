import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Zap, 
  RotateCcw, 
  Sparkles, 
  Gamepad2, 
  Volume2, 
  VolumeX,
  Eye,
  EyeOff
} from "lucide-react";

interface ChaosDemoProps {
  onChaosToggle?: (enabled: boolean) => void;
}

export function ChaosDemo({ onChaosToggle }: ChaosDemoProps) {
  const [chaosEnabled, setChaosEnabled] = useState(false);
  const [demoEffects, setDemoEffects] = useState({
    rainbow: false,
    spin: false,
    float: false,
    glitch: false,
    sound: false
  });

  const toggleChaos = () => {
    const newState = !chaosEnabled;
    setChaosEnabled(newState);
    onChaosToggle?.(newState);
    
    if (newState) {
      // Start demo effects
      setDemoEffects({
        rainbow: true,
        spin: true,
        float: true,
        glitch: false,
        sound: false
      });
    } else {
      // Stop all effects
      setDemoEffects({
        rainbow: false,
        spin: false,
        float: false,
        glitch: false,
        sound: false
      });
    }
  };

  const toggleEffect = (effect: keyof typeof demoEffects) => {
    setDemoEffects(prev => ({
      ...prev,
      [effect]: !prev[effect]
    }));
  };

  // Add demo styles
  useEffect(() => {
    const styleId = 'chaos-demo-styles';
    let styleElement = document.getElementById(styleId) as HTMLStyleElement;
    
    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = styleId;
      document.head.appendChild(styleElement);
    }
    
    const keyframes = `
      @keyframes demo-rainbow {
        0% { filter: hue-rotate(0deg); }
        100% { filter: hue-rotate(360deg); }
      }
      
      @keyframes demo-spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      
      @keyframes demo-float {
        0%, 100% { transform: translateY(0px); }
        50% { transform: translateY(-10px); }
      }
      
      @keyframes demo-glitch {
        0% { transform: translate(0); }
        20% { transform: translate(-2px, 2px); }
        40% { transform: translate(-2px, -2px); }
        60% { transform: translate(2px, 2px); }
        80% { transform: translate(2px, -2px); }
        100% { transform: translate(0); }
      }
      
      .demo-rainbow {
        animation: demo-rainbow 2s linear infinite;
      }
      
      .demo-spin {
        animation: demo-spin 3s linear infinite;
      }
      
      .demo-float {
        animation: demo-float 2s ease-in-out infinite;
      }
      
      .demo-glitch {
        animation: demo-glitch 0.3s infinite;
      }
    `;
    
    styleElement.textContent = keyframes;
    
    return () => {
      const element = document.getElementById(styleId);
      if (element) {
        element.remove();
      }
    };
  }, []);

  const demoClasses = [
    demoEffects.rainbow ? 'demo-rainbow' : '',
    demoEffects.spin ? 'demo-spin' : '',
    demoEffects.float ? 'demo-float' : '',
    demoEffects.glitch ? 'demo-glitch' : ''
  ].filter(Boolean).join(' ');

  return (
    <Card className={`border-2 border-dashed ${chaosEnabled ? 'border-purple-500 bg-purple-50/50 dark:border-purple-400 dark:bg-purple-950/20' : 'border-gray-300'} ${demoClasses}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className={`h-5 w-5 ${chaosEnabled ? 'text-purple-600' : 'text-gray-500'}`} />
          Chaos Mode Demo
          {chaosEnabled && (
            <Badge variant="secondary" className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
              ACTIVE
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          {chaosEnabled 
            ? "🌪️ Chaos is unleashed! Try the effect buttons below."
            : "Experience the power of chaos before applying it to your group."
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={toggleChaos}
            variant={chaosEnabled ? "destructive" : "default"}
            className="flex items-center gap-2"
          >
            {chaosEnabled ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {chaosEnabled ? "Stop Chaos" : "Start Chaos"}
          </Button>
          
          {chaosEnabled && (
            <>
              <Button
                onClick={() => toggleEffect('rainbow')}
                variant={demoEffects.rainbow ? "secondary" : "outline"}
                size="sm"
                className="flex items-center gap-2"
              >
                <Sparkles className="h-4 w-4" />
                Rainbow
              </Button>
              
              <Button
                onClick={() => toggleEffect('spin')}
                variant={demoEffects.spin ? "secondary" : "outline"}
                size="sm"
                className="flex items-center gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Spin
              </Button>
              
              <Button
                onClick={() => toggleEffect('float')}
                variant={demoEffects.float ? "secondary" : "outline"}
                size="sm"
                className="flex items-center gap-2"
              >
                <Gamepad2 className="h-4 w-4" />
                Float
              </Button>
              
              <Button
                onClick={() => toggleEffect('glitch')}
                variant={demoEffects.glitch ? "secondary" : "outline"}
                size="sm"
                className="flex items-center gap-2"
              >
                <Zap className="h-4 w-4" />
                Glitch
              </Button>
              
              <Button
                onClick={() => toggleEffect('sound')}
                variant={demoEffects.sound ? "secondary" : "outline"}
                size="sm"
                className="flex items-center gap-2"
                title="Click anywhere to hear sound effects"
              >
                {demoEffects.sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                Sound
              </Button>
            </>
          )}
        </div>
        
        {chaosEnabled && (
          <div className="p-4 bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 rounded-lg">
            <p className="text-sm text-purple-800 dark:text-purple-200 mb-2">
              <strong>Demo Effects Active:</strong>
            </p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(demoEffects).map(([effect, active]) => (
                <Badge 
                  key={effect}
                  variant={active ? "default" : "secondary"}
                  className={active ? "bg-purple-600" : ""}
                >
                  {effect.charAt(0).toUpperCase() + effect.slice(1)}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-purple-700 dark:text-purple-300 mt-2">
              💡 This is just a preview! The full chaos mode has many more effects and customization options.
            </p>
          </div>
        )}
        
        {!chaosEnabled && (
          <div className="text-center py-8 text-gray-500">
            <Zap className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Click "Start Chaos" to see what happens...</p>
            <p className="text-xs mt-1">Don't worry, this is just a safe demo!</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}