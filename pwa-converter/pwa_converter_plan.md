# PWA to App Store Converter - Product Requirements Document

## Project Overview

Build a web-based tool that converts Progressive Web Apps (PWAs) into installable packages for iOS App Store and Google Play Store, similar to PWABuilder functionality.

## Core Objectives

1. **PWA Analysis**: Scan and validate PWA readiness (manifest, service worker, icons)
2. **Package Generation**: Create native app wrappers for iOS and Android
3. **Store Preparation**: Generate submission-ready packages with proper metadata
4. **Developer Experience**: Provide clear guidance and automated fixes for common issues

## Technical Requirements

### Frontend Stack
- **Framework**: React 18+ with TypeScript
- **Styling**: Tailwind CSS
- **State Management**: Zustand or React Context
- **Forms**: React Hook Form with Zod validation
- **File Handling**: JSZip for package generation
- **Icons**: Lucide React

### Backend Stack  
- **Runtime**: Node.js 18+
- **Framework**: Express.js with TypeScript
- **Package Generation**: 
  - Android: Use Google's Bubblewrap CLI programmatically
  - iOS: Generate Xcode project template with WebKit integration
- **Image Processing**: Sharp for icon generation/resizing
- **Archive Creation**: node-archiver for zip/package creation

### Core Dependencies
```json
{
  "frontend": [
    "react", "typescript", "tailwindcss", "react-hook-form", 
    "zod", "jszip", "lucide-react", "axios"
  ],
  "backend": [
    "express", "typescript", "sharp", "archiver", "cheerio",
    "node-fetch", "cors", "helmet", "rate-limiter-flexible"
  ]
}
```

## Feature Specifications

### 1. PWA Analysis Engine

**Endpoint**: `POST /api/analyze`
**Input**: `{ url: string }`
**Output**: PWA analysis report

#### Implementation Requirements:
```typescript
interface PWAAnalysis {
  url: string;
  score: number; // 0-100
  manifest: ManifestAnalysis;
  serviceWorker: ServiceWorkerAnalysis;
  icons: IconAnalysis;
  errors: ValidationError[];
  suggestions: Suggestion[];
}

interface ManifestAnalysis {
  found: boolean;
  valid: boolean;
  data?: WebAppManifest;
  missing_fields: string[];
  recommended_fields: string[];
}
```

#### Core Logic:
1. Fetch the PWA URL and parse HTML
2. Extract manifest.json link and validate contents
3. Check for service worker registration
4. Validate icon availability and sizes
5. Test HTTPS requirement
6. Generate PWA readiness score

### 2. Icon Processing System

**Purpose**: Generate all required icon sizes for iOS and Android from source icons

#### Requirements:
- Extract icons from manifest
- Generate missing sizes: 16x16 to 1024x1024
- Support PNG, JPEG, WebP input formats
- Output optimized PNG files
- Create platform-specific icon sets

```typescript
interface IconGenerator {
  generateIconSet(sourceIcon: Buffer, platform: 'ios' | 'android'): Promise<IconSet>;
  validateIcons(manifest: WebAppManifest): IconValidation;
}

interface IconSet {
  [size: string]: Buffer; // e.g., "512x512": <image_buffer>
}
```

### 3. Android Package Generator

**Endpoint**: `POST /api/generate/android`
**Input**: PWA analysis + user configuration

#### Implementation:
1. Create Trusted Web Activity (TWA) project structure
2. Generate `build.gradle` with proper dependencies
3. Create Android manifest with PWA metadata
4. Generate launcher icons and splash screens
5. Configure URL mapping and intent filters
6. Build signed APK using Gradle programmatically

```typescript
interface AndroidConfig {
  packageName: string; // com.company.app
  appName: string;
  versionCode: number;
  versionName: string;
  targetUrl: string;
  themeColor: string;
  backgroundColor: string;
  orientation: 'portrait' | 'landscape' | 'any';
}
```

### 4. iOS Package Generator  

**Endpoint**: `POST /api/generate/ios`
**Input**: PWA analysis + user configuration

#### Implementation:
1. Generate Xcode project with WebKit WebView
2. Create Swift app delegate with PWA configuration
3. Generate iOS app icons and launch screens
4. Configure URL schemes and universal links
5. Create Info.plist with proper permissions
6. Package as .xcodeproj for developer download

```typescript
interface iOSConfig {
  bundleId: string; // com.company.app
  appName: string;
  version: string;
  buildNumber: string;
  targetUrl: string;
  urlSchemes: string[];
  orientations: string[];
}
```

### 5. User Interface Components

#### Main Workflow:
1. **URL Input Page**: Enter PWA URL for analysis
2. **Analysis Results**: Show PWA score, issues, and fixes
3. **Platform Selection**: Choose iOS, Android, or both
4. **Configuration Form**: App metadata and settings
5. **Package Generation**: Progress tracking and download

#### Key Components:
```tsx
// Core UI Components
- PWAAnalyzer: URL input and analysis display
- PlatformSelector: iOS/Android package type selection  
- ConfigurationForm: App metadata input form
- ProgressTracker: Package generation status
- DownloadManager: Handle package downloads
- ValidationDisplay: Show errors and suggestions
```

## File Structure

```
pwa-converter/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── PWAAnalyzer.tsx
│   │   │   ├── PlatformSelector.tsx
│   │   │   ├── ConfigurationForm.tsx
│   │   │   ├── ProgressTracker.tsx
│   │   │   └── ValidationDisplay.tsx
│   │   ├── types/
│   │   │   ├── pwa.ts
│   │   │   ├── android.ts
│   │   │   └── ios.ts
│   │   ├── services/
│   │   │   └── api.ts
│   │   └── App.tsx
│   ├── package.json
│   └── tailwind.config.js
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── analyze.ts
│   │   │   ├── android.ts
│   │   │   └── ios.ts
│   │   ├── services/
│   │   │   ├── PWAAnalyzer.ts
│   │   │   ├── AndroidGenerator.ts
│   │   │   ├── iOSGenerator.ts
│   │   │   └── IconProcessor.ts
│   │   ├── templates/
│   │   │   ├── android/
│   │   │   └── ios/
│   │   └── server.ts
│   └── package.json
└── shared/
    └── types.ts
```

## API Specifications

### Analysis Endpoint
```typescript
POST /api/analyze
Content-Type: application/json

Request:
{
  "url": "https://example.com"
}

Response:
{
  "url": "https://example.com",
  "score": 85,
  "manifest": {
    "found": true,
    "valid": true,
    "data": { /* manifest contents */ },
    "missing_fields": ["screenshots"],
    "recommended_fields": ["categories"]
  },
  "serviceWorker": {
    "registered": true,
    "scope": "/",
    "cachingStrategy": "cache-first"
  },
  "icons": {
    "available": ["192x192", "512x512"],
    "missing": ["16x16", "32x32", "180x180"]
  },
  "errors": [],
  "suggestions": [
    {
      "type": "icon",
      "message": "Add more icon sizes for better platform support"
    }
  ]
}
```

### Package Generation Endpoints
```typescript
POST /api/generate/android
Content-Type: application/json

Request:
{
  "pwaUrl": "https://example.com",
  "config": {
    "packageName": "com.example.app",
    "appName": "My PWA App",
    "versionCode": 1,
    "versionName": "1.0.0",
    "themeColor": "#2196F3"
  }
}

Response:
{
  "success": true,
  "packageId": "uuid-here",
  "downloadUrl": "/download/android/uuid-here",
  "expiresAt": "2025-05-24T12:00:00Z"
}
```

## Implementation Phases

### Phase 1: Core Analysis (Week 1)
- [ ] PWA URL fetching and parsing
- [ ] Manifest validation
- [ ] Service worker detection
- [ ] Basic scoring algorithm
- [ ] REST API endpoints

### Phase 2: Frontend Interface (Week 2)  
- [ ] React components for analysis flow
- [ ] Form validation and error handling
- [ ] Progress tracking UI
- [ ] Responsive design implementation

### Phase 3: Android Generation (Week 3)
- [ ] TWA project template
- [ ] Gradle build configuration
- [ ] Icon generation pipeline
- [ ] APK packaging automation

### Phase 4: iOS Generation (Week 4)
- [ ] Xcode project template
- [ ] Swift WebView implementation
- [ ] iOS icon and launch screen generation
- [ ] Project packaging for download

### Phase 5: Polish & Deploy (Week 5)
- [ ] Error handling and edge cases
- [ ] Performance optimization
- [ ] Security review
- [ ] Production deployment

## Quality Assurance

### Testing Requirements
1. **Unit Tests**: Core analysis and generation logic
2. **Integration Tests**: Full PWA-to-package workflows
3. **E2E Tests**: User interface automation
4. **Security Tests**: Input validation, rate limiting
5. **Performance Tests**: Large file handling, concurrent users

### Test PWAs for Validation
```javascript
const testPWAs = [
  'https://web.dev/learn/pwa/getting-started/',
  'https://pokedex.org/',
  'https://squoosh.app/',
  'https://excalidraw.com/'
];
```

## Security Considerations

1. **Input Validation**: Sanitize all URLs and user inputs
2. **Rate Limiting**: Prevent abuse of analysis/generation endpoints  
3. **File Cleanup**: Auto-delete generated packages after expiration
4. **CORS Configuration**: Restrict origins for production
5. **Content Security Policy**: Prevent XSS attacks
6. **Package Signing**: Secure Android APK generation

## Performance Requirements

- **Analysis Response Time**: < 10 seconds for most PWAs
- **Package Generation**: < 60 seconds per platform
- **Concurrent Users**: Support 50+ simultaneous conversions
- **File Size Limits**: Max 50MB for generated packages
- **Uptime**: 99.9% availability target

## Deployment Strategy

### Development Environment
```bash
# Frontend: http://localhost:3000
npm run dev

# Backend: http://localhost:8000  
npm run dev:server
```

### Production Environment
- **Frontend**: Deploy to Vercel/Netlify
- **Backend**: Deploy to Railway/Render with Docker
- **File Storage**: AWS S3 or similar for generated packages
- **CDN**: CloudFlare for global distribution

## Success Metrics

1. **Conversion Rate**: % of analyzed PWAs that generate packages
2. **Success Rate**: % of generated packages that work correctly
3. **User Satisfaction**: App store approval rates
4. **Performance**: Average processing time per conversion
5. **Adoption**: Weekly active users and conversions

## Future Enhancements

1. **Microsoft Store Support**: Windows app generation
2. **Advanced Customization**: Custom splash screens, themes
3. **Batch Processing**: Multiple PWAs at once
4. **API Integration**: Direct publishing to app stores
5. **Analytics Dashboard**: Usage metrics and insights
6. **Plugin System**: Custom platform generators

---

## Getting Started Command

```bash
npx create-pwa-converter my-pwa-tool
cd my-pwa-tool
npm install
npm run dev
```

This PRD provides a comprehensive foundation for building a production-ready PWA to app store converter tool. Focus on implementing the core analysis and generation features first, then expand with additional platforms and advanced features based on user feedback
