---
name: Movie Partner
colors:
  surface: '#131312'
  surface-dim: '#131312'
  surface-bright: '#3a3938'
  surface-container-lowest: '#0e0e0d'
  surface-container-low: '#1c1c1a'
  surface-container: '#20201e'
  surface-container-high: '#2a2a29'
  surface-container-highest: '#353533'
  on-surface: '#e5e2e0'
  on-surface-variant: '#dfbec8'
  inverse-surface: '#e5e2e0'
  inverse-on-surface: '#31302f'
  outline: '#a68992'
  outline-variant: '#584048'
  surface-tint: '#ffb0cd'
  primary: '#ffb0cd'
  on-primary: '#640039'
  primary-container: '#d12b81'
  on-primary-container: '#fff7f7'
  inverse-primary: '#b60b6c'
  secondary: '#c0c1ff'
  on-secondary: '#1000a9'
  secondary-container: '#3131c0'
  on-secondary-container: '#b0b2ff'
  tertiary: '#89ceff'
  on-tertiary: '#00344d'
  tertiary-container: '#007aae'
  on-tertiary-container: '#f6faff'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffd9e4'
  primary-fixed-dim: '#ffb0cd'
  on-primary-fixed: '#3e0021'
  on-primary-fixed-variant: '#8d0052'
  secondary-fixed: '#e1e0ff'
  secondary-fixed-dim: '#c0c1ff'
  on-secondary-fixed: '#07006c'
  on-secondary-fixed-variant: '#2f2ebe'
  tertiary-fixed: '#c9e6ff'
  tertiary-fixed-dim: '#89ceff'
  on-tertiary-fixed: '#001e2f'
  on-tertiary-fixed-variant: '#004c6e'
  background: '#131312'
  on-background: '#e5e2e0'
  surface-variant: '#353533'
  surface-deep: '#090909'
  surface-elevated: '#1E1E1E'
  text-primary: '#E6E6E6'
  text-muted: '#9CA3AF'
  glass-stroke: rgba(255, 255, 255, 0.08)
typography:
  display-lg:
    fontFamily: Sora
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Sora
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
  headline-lg-mobile:
    fontFamily: Sora
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  title-md:
    fontFamily: Sora
    fontSize: 20px
    fontWeight: '500'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 32px
  sidebar-width: 280px
  chat-width: 320px
---

## Brand & Style

The design system is engineered for immersive, shared digital experiences. It targets a tech-savvy, social audience that values fluid interaction during low-light usage. The aesthetic is **Modern Glassmorphism** with a "Midnight Studio" feel—combining deep, ink-like backgrounds with high-vibrancy interactive accents.

The interface stays out of the way of content (videos and games) while providing a tactile, high-end feel through the use of translucent layers and soft, colored glows. It evokes a sense of being in a private, neon-lit lounge where the digital world feels physical and responsive.

## Colors

The palette is optimized for OLED displays and long-duration nighttime sessions. 

- **Primary & Secondary:** A high-energy duo of Magenta (#D12B81) and Indigo (#6366F1) creates a dynamic range for interactive elements like "Join Room" buttons or active chat pings.
- **Neutral Foundation:** The base is a true-black variant (#090909) to maximize contrast with content, while the secondary neutral (#141413) provides depth for containers.
- **Accents:** Use Tertiary Blue for informative states (e.g., system messages) and Primary Magenta for urgent or celebratory actions.

## Typography

This design system uses a three-tier font strategy:
- **Sora (Headlines):** A geometric sans-serif that brings a futuristic, tech-forward vibe to room titles and landing sections.
- **Inter (Body):** Selected for maximum legibility in chat interfaces and settings menus. It remains neutral and highly functional.
- **JetBrains Mono (Labels/System):** Used for metadata, timestamps, and user counts to emphasize the "virtual space" and technical nature of the app.

Scale your line heights generously to ensure readability in busy social environments. Use `display-lg` sparingly for hero sections or empty-state titles.

## Layout & Spacing

The layout follows a **Hybrid Fluid Model**. Content areas (video/games) expand to fill all available space between fixed utility sidebars.

- **Desktop:** A three-pane architecture. Left sidebar for room navigation (280px), center for primary content (fluid), and right sidebar for social/chat (320px).
- **Tablets:** The chat sidebar becomes an overlay or a bottom-sheet to maximize the content viewport.
- **Mobile:** Single-column view with a "Content-First" priority. Navigation and Chat are accessed via gestures or bottom tabs.

Spacing is based on a 4px grid. Use 16px as the standard padding for cards and 8px for internal component spacing to maintain a compact, "app-like" density.

## Elevation & Depth

Hierarchy is established through **Tonal Layers** and **Backdrop Blurs** rather than traditional shadows.

- **Level 0 (Background):** #090909. For the main canvas.
- **Level 1 (Panels):** #141413 with a 1px `glass-stroke`. Used for sidebars and toolbars.
- **Level 2 (Cards/Popovers):** Semi-transparent #1E1E1E (80% opacity) with a 12px backdrop blur. This creates the "glass" effect, allowing content colors to subtly bleed through the UI.
- **Interactivity:** Elements being hovered or dragged should receive a 4px soft outer glow using the `primary_color` at 20% opacity.

## Shapes

The shape language is "Squircle-inspired," leaning towards a friendly but sophisticated roundness.

- **Standard Elements:** Use `rounded` (0.5rem) for buttons, input fields, and small cards.
- **Large Containers:** Use `rounded-lg` (1rem) for main content areas and large modal dialogs.
- **Avatars & Active Indicators:** Use full pill-shapes/circles to distinguish human elements from functional UI.

## Components

### Buttons
- **Primary:** Solid background using `primary_color` with white text. High-gloss finish.
- **Secondary:** Outlined with `glass-stroke` and a subtle 5% white hover fill.
- **Icon Buttons:** No background by default; active state shows a circular background in `secondary_color`.

### Chat & Messaging
- **Bubbles:** Subtle dark-grey backgrounds for others; `secondary_color` for own messages.
- **Avatars:** Circular with a 2px stroke. Presence indicators (online/away) positioned at bottom-right.
- **Timestamps:** Rendered in `label-sm` using `text-muted`.

### Video Player
- **Controls:** Positioned on a gradient overlay (bottom-to-top, black to transparent).
- **Progress Bar:** 4px height, using `primary_color` for the progress fill.

### Room Lists
- **Cards:** Feature a 16:9 thumbnail with `rounded-lg` corners. 
- **Active State:** A 2px `primary_color` border with a subtle neon glow effect.

### Input Fields
- **Search/Chat Input:** Deep background (#090909) with a `glass-stroke` border. Focus state changes border to `secondary_color`.