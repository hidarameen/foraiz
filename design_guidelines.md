# Premium Arabic-English Application Design Guidelines

## Design Approach
**Selected System:** Shadcn/Tailwind with influences from Linear (typography hierarchy), Stripe (restraint & spacing), and Vercel (modern minimalism)

**Core Principle:** Create a luxurious, spacious interface that feels premium through generous whitespace and precise typography, not ornamentation.

---

## Typography System

**Font Family:**
- Primary: IBM Plex Sans Arabic (supports Arabic + Latin seamlessly)
- Weights: 400 (Regular), 500 (Medium), 600 (SemiBold), 700 (Bold)

**Type Scale:**
- Hero/Display: text-5xl md:text-6xl lg:text-7xl (font-bold)
- Page Headings: text-3xl md:text-4xl (font-semibold)
- Section Headings: text-2xl md:text-3xl (font-semibold)
- Card Titles: text-lg md:text-xl (font-semibold)
- Body Large: text-base md:text-lg (font-normal)
- Body: text-sm md:text-base (font-normal)
- Caption/Meta: text-xs md:text-sm (font-medium)

**Line Heights:** Use leading-tight for headings, leading-relaxed for body text

---

## Layout & Spacing System

**Core Spacing Units:** Use Tailwind units of 4, 6, 8, 12, 16, 20, 24 for consistency
- Component padding: p-6 or p-8
- Section padding: py-16 md:py-24 lg:py-32
- Card gaps: gap-6 or gap-8
- Stack spacing: space-y-4 or space-y-6

**Container Strategy:**
- Max widths: max-w-7xl for sections, max-w-4xl for content-heavy areas
- Always center with mx-auto
- Side padding: px-4 md:px-6 lg:px-8

**Grid Patterns:**
- Dashboard: 12-column grid with sidebar (280px fixed)
- Cards/Features: grid-cols-1 md:grid-cols-2 lg:grid-cols-3
- Forms: Single column max-w-2xl centered

---

## Component Library

### Navigation
- Fixed header: backdrop-blur-lg with border-b
- Height: h-16 md:h-20
- Logo left, navigation center, actions right
- Mobile: Slide-out drawer with overlay

### Hero Section (Landing Pages)
- **Large Hero Image Required:** Full-width, high-quality imagery (1920x1080+)
- Height: min-h-[600px] md:min-h-[700px]
- Content overlay with gradient backdrop
- Buttons with blurred backgrounds: `backdrop-blur-md bg-white/10 dark:bg-black/10`
- Center-aligned content with max-w-4xl

### Cards
- Rounded corners: rounded-xl
- Borders: border with subtle treatment
- Padding: p-6 or p-8
- Hover: subtle scale transform-scale-105 transition-transform
- Shadow: Minimal - shadow-sm with hover:shadow-md

### Forms & Inputs
- Height: h-11 for inputs
- Rounded: rounded-lg
- Focus rings: ring-2 ring-offset-2 on focus
- Labels: text-sm font-medium mb-2
- Helper text: text-xs below input
- Spacing between fields: space-y-6

### Buttons
- Primary: Filled background, font-semibold, h-11, px-6, rounded-lg
- Secondary: Outline variant
- Sizes: sm (h-9 px-4), default (h-11 px-6), lg (h-12 px-8)
- Icon buttons: Square aspect ratio

### Data Tables
- Sticky header with backdrop-blur
- Alternating row backgrounds (subtle)
- Row height: h-14
- Cell padding: px-6 py-4
- Hover: Subtle row highlight

### Modals/Dialogs
- Backdrop: bg-black/50 with backdrop-blur-sm
- Content: max-w-2xl, rounded-2xl
- Padding: p-8
- Header border-b separator

### Dashboard Sidebar
- Width: 280px fixed desktop, full-width mobile drawer
- Sticky navigation with icon + text
- Active state: Subtle background highlight
- Grouped sections with dividers

---

## Dark/Light Mode Strategy

**Light Mode:**
- Background: Soft whites/off-whites (gray-50, white)
- Cards: white with subtle borders
- Text: gray-900 headings, gray-700 body

**Dark Mode:**
- Background: True blacks and deep grays (gray-950, gray-900)
- Cards: gray-800 with subtle borders
- Text: gray-50 headings, gray-300 body

**Implementation:** Use Tailwind's dark: variant consistently
- Borders: `border-gray-200 dark:border-gray-800`
- Backgrounds: `bg-white dark:bg-gray-900`
- Text: `text-gray-900 dark:text-gray-50`

---

## RTL Support (Arabic)
- Set `dir="rtl"` dynamically
- Mirror layouts: Use Tailwind's rtl: variant
- Flip padding/margins: `ps-4 pe-6` instead of `pl-4 pr-6`
- Icons: Flip directional icons in RTL

---

## Images

**Hero Image:**
- Placement: Full-width header of landing pages
- Type: Professional, aspirational lifestyle or abstract geometric patterns
- Treatment: Subtle gradient overlay (from-black/60 to-transparent)
- Resolution: Minimum 1920x1080, optimized WebP

**Feature/Section Images:**
- Product screenshots: Clean, high-contrast with subtle shadows
- Illustrations: Minimal, geometric style supporting brand
- Team photos: Professional headshots in consistent circular frames

**Image Loading:** Always use skeleton loaders with matching aspect ratios

---

## Animations (Minimal)
- Page transitions: Simple fade (150ms)
- Hover states: scale/shadow changes (200ms ease-out)
- Modal entry: Gentle fade + scale (250ms)
- **No scroll-triggered animations** except subtle fade-in on initial load

---

## Key Improvements to Implement

1. **Consistent 8px spacing grid** throughout
2. **Unified card design pattern** across all features
3. **Standardized form layouts** with proper validation states
4. **Accessible focus states** on all interactive elements
5. **Smooth theme transitions** (150ms) on mode toggle
6. **Responsive typography** scaling naturally
7. **Generous whitespace** - minimum 24px between major sections
8. **Icon consistency** - use Lucide React icons exclusively
9. **Loading states** for all async operations
10. **Empty states** with illustrations for zero-data scenarios