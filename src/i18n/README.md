# Localization Guide

## Overview

This app is internationalized using react-i18next with support for multiple languages.

## Supported Languages

- English (en) - Default
- Spanish (es) 
- French (fr) - Placeholder
- German (de) - Placeholder
- Japanese (ja) - Placeholder

## Adding Translations

### For existing strings:

1. Find the translation key in `/src/i18n/locales/en/translation.json`
2. Add the translated string to the corresponding language file

### For new strings:

1. Add the string to all language files under the appropriate category
2. Use the translation in your component:

```tsx
import { useTranslation } from 'react-i18next';
// or
import { useTranslation } from '@/hooks/useTranslation';

function MyComponent() {
  const { t } = useTranslation();
  
  return <div>{t('common.loading')}</div>;
}
```

## Translation Key Structure

Keys are organized by feature/page:
- `common.*` - Common UI strings
- `welcome.*` - Welcome/landing page
- `onboarding.*` - New user onboarding
- `profile.*` - Profile related
- `groups.*` - Groups functionality  
- `wallet.*` - Wallet/ecash features
- `settings.*` - Settings page
- `auth.*` - Authentication
- `errors.*` - Error messages
- `time.*` - Time formatting
- `footer.*` - Footer content

## Adding a New Language

1. Create a new translation file: `/src/i18n/locales/[lang]/translation.json`
2. Copy the English translation file as a template
3. Add the language to the `languages` array in `/src/components/settings/LanguageSelector.tsx`
4. Import and add to resources in `/src/i18n/i18n.ts`

## Language Selection

Users can change their language in Settings. The selected language is stored in localStorage and persists across sessions.

## Interpolation

For dynamic values, use interpolation:

```json
{
  "greeting": "Hello {{name}}!"
}
```

```tsx
t('greeting', { name: 'Alice' }) // "Hello Alice!"
```

## Pluralization

For plural forms:

```json
{
  "items": "{{count}} item",
  "items_plural": "{{count}} items"
}
```

```tsx
t('items', { count: 1 }) // "1 item"
t('items', { count: 5 }) // "5 items"
```