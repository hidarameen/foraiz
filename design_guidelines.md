# Premium Arabic-English Task Management Design Guidelines

## Design Approach
**System:** Shadcn/Tailwind + Linear typography + Stripe restraint + Todoist task patterns
**Principle:** Luxurious, spacious interface with sophisticated task organization through advanced cards, accordions, and purposeful motion.

---

## Typography System
**Font:** IBM Plex Sans Arabic (400, 500, 600, 700 weights)

**Scale:**
- Display: text-5xl md:text-6xl (font-bold)
- Page Headings: text-3xl md:text-4xl (font-semibold)
- Section/Task Group: text-2xl md:text-3xl (font-semibold)
- Task Titles: text-lg md:text-xl (font-semibold)
- Body: text-sm md:text-base (font-normal)
- Meta/Tags: text-xs md:text-sm (font-medium)

**Line Heights:** leading-tight for headings, leading-relaxed for descriptions

---

## Spacing System
**Core Units:** 4, 6, 8, 12, 16, 20, 24
- Cards: p-6 or p-8
- Sections: py-16 md:py-24
- Stack gaps: space-y-4 to space-y-6
- Grid gaps: gap-6 or gap-8

**Containers:** max-w-7xl sections, max-w-4xl content, px-4 md:px-6 lg:px-8

---

## Task Management Components

### Advanced Task Cards (Cyber-Cards)
**Structure:**
- Rounded: rounded-xl with border
- Padding: p-6
- Multi-layer design: Nested sections with dividers
- Header: Task title + priority badge + quick actions
- Body: Description, subtasks, attachments preview
- Footer: Assignee avatars + due date + completion %
- Hover: Subtle elevation (shadow-md) + border glow effect
- Interactive zones: Checkbox (left), expand button (right), drag handle

**Priority Indicators:**
- High: Red accent border-left (border-l-4)
- Medium: Amber accent
- Low: Blue accent
- Visual: Colored dot + text label

**Status Tags:**
- Pill-shaped: rounded-full px-3 py-1
- Placement: Top-right of card header
- States: Not Started, In Progress, Blocked, Completed
- Each has distinct background shade

### Accordion Task Groups
**Implementation:**
- Collapsible sections by project/date/priority
- Header: Title + count badge + expand icon
- Height: h-14 clickable header
- Content: Nested task cards with gap-4
- Animation: Smooth height transition (300ms ease)
- Default: First group expanded, others collapsed
- Border-bottom separator between groups

**Header Design:**
- Background: Subtle shade (bg-gray-50 dark:bg-gray-800)
- Padding: px-6 py-4
- Flex layout: title left, count + icon right
- Active state: Darker background when expanded

### Task Detail Panel (Slide-Over)
**Layout:**
- Width: w-full md:w-2/3 lg:w-1/2 max-w-2xl
- Slides from right (LTR) or left (RTL)
- Full-height with header, scrollable body, sticky footer
- Backdrop: bg-black/40 backdrop-blur-sm

**Sections (stacked with space-y-6):**
1. **Header:** Title editing + status + close button
2. **Properties Grid:** 2-column on desktop, 1-column mobile
   - Priority selector (dropdown with colors)
   - Due date picker (calendar popup)
   - Assignee selector (avatar grid)
   - Tags/labels (multi-select chips)
3. **Description:** Rich text editor area (min-h-32)
4. **Subtasks:** Nested checklist with indent
5. **Attachments:** File upload zone + preview grid
6. **Comments:** Threaded discussion (avatar + text + timestamp)
7. **Activity Log:** Timeline of changes (collapsed by default)

**Footer:** Save + Delete buttons, right-aligned

### Task Creation Modal
**Size:** max-w-3xl, rounded-2xl, p-8
**Quick Create Mode:**
- Single input field (h-11) with placeholder "Add a task..."
- Press Enter: Creates with defaults
- Click: Expands to full form

**Full Form (revealed on click):**
- Title input (large, text-xl)
- Property selectors in 2-column grid
- Description textarea
- Primary action: "Create Task" button (h-12, full-width on mobile)

### Dashboard View Modes
**List View (Default):**
- Accordions by project/date
- Compact cards (h-20 when collapsed)
- Striped backgrounds for visual rhythm

**Board View (Kanban):**
- Columns by status (grid-cols-1 md:grid-cols-3 lg:grid-cols-4)
- Cards draggable between columns
- Column headers: Title + count
- Drop zones with dashed borders

**Calendar View:**
- Month grid with task dots
- Click date: Shows day's tasks in sidebar
- Color coding by priority

### Filters & Search Bar
**Position:** Sticky top after header (h-16)
**Components:**
- Search input (w-full md:w-96) with icon
- Filter dropdowns: Status, Priority, Assignee, Date Range
- View toggle buttons (List/Board/Calendar)
- Sort dropdown (Due Date, Priority, Created)
- Layout: Flexbox with gap-4, wraps on mobile

---

## Animations & Interactions
**Task Card Interactions:**
- Checkbox check: Scale pulse (200ms)
- Card expand: Smooth height + opacity (300ms cubic-bezier)
- Drag & drop: Opacity 0.7, cursor-grabbing
- Completion: Strikethrough + fade-out (400ms)

**Accordion Transitions:**
- Chevron rotation: 300ms
- Content reveal: Height animation (300ms ease-in-out)

**Slide-Over Panel:**
- Entry: Translate-x + fade (250ms)
- Exit: Same animation reversed

**Hover States:**
- Cards: shadow-sm → shadow-md (200ms)
- Buttons: Subtle scale (0.98) on active press

---

## Dark/Light Mode
**Light:** 
- BG: gray-50, Cards: white, Text: gray-900/gray-700
- Borders: gray-200

**Dark:**
- BG: gray-950, Cards: gray-900, Text: gray-50/gray-300  
- Borders: gray-800
- Cyber-card accents: Subtle glow effects with opacity

**Toggle:** Icon button in header (sun/moon), transitions 150ms

---

## RTL Support
- Set `dir="rtl"` dynamically
- Mirror all layouts with Tailwind rtl: variant
- Flip directional icons and slide-over panels
- Use logical properties: ps/pe instead of pl/pr

---

## Images
**Hero Section (Dashboard Landing):**
- Full-width, min-h-[500px] md:min-h-[600px]
- Professional workspace imagery or abstract productivity patterns
- Gradient overlay: from-black/70 via-black/50 to-transparent
- Content: "Manage Your Tasks Efficiently" headline + CTA
- Buttons: backdrop-blur-md bg-white/10 (no hover blur changes)

**Empty States:**
- Illustrations for "No tasks" (centered, max-w-sm)
- Encouragement text + "Create First Task" CTA

**Avatars:**
- User avatars: Circular (w-8 h-8 for cards, w-10 h-10 for detail panel)
- Stacked overlapping for multiple assignees (with count +3)

---

## Icons
**Library:** Lucide React exclusively
**Usage:**
- Task status icons (check-circle, clock, alert-circle)
- Priority flags (flag icon with color variants)
- Action buttons (edit, trash, more-horizontal)
- Navigation (list, layout-board, calendar)
- Size: w-5 h-5 for UI elements, w-4 h-4 for inline

---

## Accessibility
- Focus rings: ring-2 ring-offset-2 on all interactive elements
- Keyboard navigation: Tab through tasks, Enter to expand/edit
- Screen reader labels for icon-only buttons
- Color-blind safe priority colors with text labels
- High contrast ratios (WCAG AA minimum)