# Group Customization System

The NostrGroups platform now includes a comprehensive customization system that allows group owners to completely customize the look and feel of their groups. This system provides extensive control over visual appearance, layout, typography, and branding.

## Features Overview

### 🎨 Theme & Colors
- **Primary, Secondary, and Accent Colors**: Full color customization with color picker and hex input
- **Background Colors**: Custom background colors with gradient support
- **Dark Mode Support**: Automatic adaptation to user's theme preference
- **Background Patterns**: Choose from dots, grid, waves, geometric patterns, or none

### 📐 Layout Options
- **Layout Styles**: Default, Compact, Magazine, Card Grid
- **Header Styles**: Banner, Minimal, Overlay, Split
- **Content Width**: Narrow, Medium, Wide, Full Width
- **Post Styles**: Default, Minimal, Card, Bubble
- **Sidebar Position**: Left, Right, or None (future feature)

### ✍️ Typography
- **Font Families**: Inter, Roboto, Open Sans, Lato, Poppins, Montserrat, Source Sans Pro
- **Font Sizes**: Small, Medium, Large
- **Font Weights**: Light, Normal, Medium, Bold
- **Line Height**: Adjustable from 1.2 to 2.0

### 🖼️ Visual Elements
- **Custom Banner Images**: Upload or link to custom banner images with adjustable height
- **Logo Images**: Add group logos with flexible positioning (left, center, right)
- **Border Radius**: Adjustable from 0-20px for rounded corners
- **Shadow Intensity**: Customizable shadow effects
- **Animations**: Toggle animations on/off
- **Group Stats**: Show/hide post counts and other statistics

### 🎯 Post Display Options
- **Avatar Display**: Show/hide user avatars
- **Timestamps**: Show/hide post timestamps
- **Reaction Counts**: Show/hide reaction and engagement counts
- **Posts Per Page**: Adjustable pagination (5-50 posts)

### 🔧 Advanced Customization
- **Custom CSS**: Full CSS override capability with CSS variables
- **Custom Branding**: Add custom branding text/watermarks
- **Custom Favicons**: Set custom favicons for the group
- **CSS Variables**: Pre-defined variables for consistent theming

## How to Use

### For Group Owners

1. **Access Customization Settings**
   - Navigate to your group
   - Click "Manage Group" (only visible to owners/moderators)
   - Select the "Customization" tab

2. **Live Preview**
   - Use the "Preview" button to see changes in real-time
   - Toggle between edit and preview modes
   - See exactly how your group will look to visitors

3. **Customization Categories**
   - **Theme**: Colors, gradients, and background patterns
   - **Layout**: Page structure and content organization
   - **Typography**: Font selection and text styling
   - **Visual**: Images, logos, and visual effects
   - **Advanced**: Custom CSS and branding options

4. **Save Changes**
   - Click "Save Changes" to publish your customizations
   - Changes are stored on the Nostr network using NIP-78 (Application-specific data)
   - Customizations are applied immediately to all group visitors

### For Developers

#### Customization Data Structure

Customizations are stored as kind 30078 events with the following structure:

```json
{
  "kind": 30078,
  "content": "{...customization settings JSON...}",
  "tags": [
    ["d", "group-customization-{communityIdentifier}"],
    ["a", "34550:{communityPubkey}:{communityIdentifier}"],
    ["title", "Group Customization Settings"],
    ["description", "Visual customization settings for the group"]
  ]
}
```

#### CSS Variables

The system generates CSS variables that can be used in custom CSS:

```css
:root {
  --group-primary: #3b82f6;
  --group-secondary: #64748b;
  --group-accent: #10b981;
  --group-bg: #ffffff;
  --group-text: #1f2937;
  --group-border-radius: 8px;
  --group-shadow: 0 2px 4px rgba(0,0,0,0.1);
  --group-font-family: Inter, system-ui, -apple-system, sans-serif;
  --group-font-size: 16px;
  --group-font-weight: 400;
  --group-line-height: 1.6;
  --group-banner-height: 200px;
}
```

#### CSS Classes

The system applies these classes for styling:

- `.group-customized`: Applied to the main container when customizations are active
- `.custom-card`: Applied to card elements
- `.custom-button-primary`: Primary button styling
- `.custom-button-secondary`: Secondary button styling
- `.custom-accent`: Accent color elements
- `.custom-banner`: Banner/header image areas
- `.custom-logo`: Logo image positioning
- `.custom-post`: Individual post styling
- `.custom-avatar`: Avatar display control
- `.custom-timestamp`: Timestamp display control
- `.custom-reactions`: Reaction display control
- `.custom-content-width`: Content width constraints

## Header Styles

### Banner Style (Default)
- Traditional banner image with action buttons on the side
- Logo and group info displayed below the banner
- Best for groups with striking banner images

### Minimal Style
- Clean, minimal header with small logo
- Horizontal layout with actions on the right
- Perfect for professional or minimalist groups

### Overlay Style
- Banner image with overlaid text and actions
- Dramatic presentation with text over the banner
- Great for artistic or visually-focused groups

### Split Style
- Two-column layout with info on left, image on right
- Balanced presentation of text and visuals
- Ideal for groups that want equal emphasis on text and imagery

## Background Patterns

- **None**: Solid background color
- **Dots**: Subtle dot pattern overlay
- **Grid**: Grid line pattern
- **Waves**: Organic wave pattern
- **Geometric**: Complex geometric pattern

## Post Styles

- **Default**: Standard post layout with full features
- **Minimal**: Clean, minimal post design with reduced visual elements
- **Card**: Posts displayed as individual cards with shadows and borders
- **Bubble**: Rounded, bubble-like post containers

## Technical Implementation

### Components

- `GroupCustomization.tsx`: Main customization interface
- `useGroupCustomization.ts`: Hook for loading and applying customizations
- `CustomizationPreview.tsx`: Preview component for group owners

### Data Flow

1. Group owner accesses customization settings
2. Settings are saved as Nostr events (kind 30078)
3. `useGroupCustomization` hook loads settings for the group
4. CSS is dynamically generated and injected
5. Customization classes are applied to group elements

### Performance

- Customizations are cached using TanStack Query
- CSS is generated once and reused
- Only groups with customizations load the additional CSS
- Minimal impact on groups without customizations

## Best Practices

### For Group Owners

1. **Start Simple**: Begin with basic color changes before moving to advanced customizations
2. **Test Readability**: Ensure text remains readable with your color choices
3. **Mobile Friendly**: Preview how your customizations look on mobile devices
4. **Brand Consistency**: Use colors and fonts that match your group's brand
5. **Performance**: Avoid overly complex custom CSS that might slow down the page

### For Developers

1. **CSS Variables**: Use the provided CSS variables for consistency
2. **Responsive Design**: Ensure customizations work across all screen sizes
3. **Accessibility**: Maintain proper contrast ratios and accessibility standards
4. **Fallbacks**: Always provide fallbacks for custom fonts and images
5. **Testing**: Test customizations across different browsers and devices

## Future Enhancements

- **Template System**: Pre-built customization templates
- **Import/Export**: Share customization settings between groups
- **Advanced Animations**: More sophisticated animation options
- **Widget System**: Custom widgets and components
- **Theme Marketplace**: Community-shared themes and customizations

## Troubleshooting

### Common Issues

1. **Customizations Not Applying**
   - Check if you're the group owner
   - Ensure changes were saved successfully
   - Try refreshing the page

2. **Colors Not Showing**
   - Verify color values are valid hex codes
   - Check if custom CSS is overriding the colors

3. **Images Not Loading**
   - Ensure image URLs are accessible
   - Check image file formats (JPG, PNG, WebP recommended)
   - Verify CORS settings for external images

4. **Layout Issues**
   - Test different content widths
   - Check custom CSS for conflicts
   - Ensure responsive design principles

### Support

For technical support or feature requests related to group customization:

1. Check the existing documentation
2. Test in preview mode before saving
3. Use the browser's developer tools to debug CSS issues
4. Report bugs with specific customization settings that cause issues

## Conclusion

The Group Customization System provides unprecedented control over group appearance while maintaining the decentralized nature of the Nostr protocol. Group owners can create unique, branded experiences that reflect their community's identity and values.

The system is designed to be both powerful for advanced users and accessible for beginners, with a progressive disclosure approach that allows users to start simple and gradually explore more advanced features as needed.