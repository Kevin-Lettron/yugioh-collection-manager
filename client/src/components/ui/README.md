# UI Components Library

This directory contains reusable UI components for the YuGiOh Collection Manager application. All components are built with TypeScript, TailwindCSS, and follow accessibility best practices.

## Components

### Button
A versatile button component with multiple variants and sizes.

**Props:**
- `variant`: 'primary' | 'secondary' | 'danger' | 'ghost' (default: 'primary')
- `size`: 'sm' | 'md' | 'lg' (default: 'md')
- `isLoading`: boolean (default: false)
- All standard button HTML attributes

**Example:**
```tsx
import { Button } from '@/components/ui';

<Button variant="primary" size="md" onClick={handleClick}>
  Click Me
</Button>

<Button variant="danger" isLoading>
  Processing...
</Button>
```

---

### Input
A text input component with label, error states, and icon support.

**Props:**
- `label`: string (optional)
- `error`: string (optional)
- `helperText`: string (optional)
- `leftIcon`: ReactNode (optional)
- `rightIcon`: ReactNode (optional)
- All standard input HTML attributes

**Example:**
```tsx
import { Input } from '@/components/ui';

<Input
  label="Card Name"
  placeholder="Enter card name..."
  error={errors.cardName}
  helperText="Search by card name"
/>

<Input
  placeholder="Search..."
  leftIcon={<SearchIcon />}
/>
```

---

### Select
A dropdown select component with label and error states.

**Props:**
- `label`: string (optional)
- `error`: string (optional)
- `helperText`: string (optional)
- `options`: SelectOption[] (required)
- `placeholder`: string (optional)
- All standard select HTML attributes

**Example:**
```tsx
import { Select } from '@/components/ui';

const options = [
  { value: 'monster', label: 'Monster' },
  { value: 'spell', label: 'Spell' },
  { value: 'trap', label: 'Trap' },
];

<Select
  label="Card Type"
  options={options}
  placeholder="Select card type..."
  value={selectedType}
  onChange={handleChange}
/>
```

---

### Modal
A modal dialog component with overlay and keyboard navigation.

**Props:**
- `isOpen`: boolean (required)
- `onClose`: () => void (required)
- `title`: string (optional)
- `children`: ReactNode (required)
- `footer`: ReactNode (optional)
- `size`: 'sm' | 'md' | 'lg' | 'xl' (default: 'md')
- `closeOnOverlayClick`: boolean (default: true)
- `closeOnEscape`: boolean (default: true)
- `showCloseButton`: boolean (default: true)

**Example:**
```tsx
import { Modal, Button } from '@/components/ui';

<Modal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="Add Card to Collection"
  footer={
    <>
      <Button variant="ghost" onClick={() => setIsOpen(false)}>
        Cancel
      </Button>
      <Button variant="primary" onClick={handleSubmit}>
        Add Card
      </Button>
    </>
  }
>
  <p>Modal content goes here...</p>
</Modal>
```

---

### Badge
A badge component for displaying statuses, particularly banlist statuses.

**Props:**
- `variant`: 'Forbidden' | 'Limited' | 'Semi-Limited' | 'Unlimited' | 'default' | 'success' | 'warning' | 'error' | 'info' (default: 'default')
- `size`: 'sm' | 'md' | 'lg' (default: 'md')
- `children`: ReactNode (required)

**Example:**
```tsx
import { Badge } from '@/components/ui';

<Badge variant="Forbidden">Forbidden</Badge>
<Badge variant="Limited">Limited</Badge>
<Badge variant="Semi-Limited">Semi-Limited</Badge>
<Badge variant="success" size="sm">Active</Badge>
```

---

### Toggle
A toggle switch component for boolean settings.

**Props:**
- `checked`: boolean (required)
- `onChange`: (checked: boolean) => void (required)
- `label`: string (optional)
- `disabled`: boolean (default: false)
- `id`: string (optional)
- `className`: string (optional)

**Example:**
```tsx
import { Toggle } from '@/components/ui';

<Toggle
  checked={respectBanlist}
  onChange={setRespectBanlist}
  label="Respect Banlist"
/>
```

---

### Card
A card container component with sub-components for structured layouts.

**Props:**
- `variant`: 'default' | 'bordered' | 'elevated' (default: 'default')
- `padding`: 'none' | 'sm' | 'md' | 'lg' (default: 'md')
- `children`: ReactNode (required)

**Sub-components:**
- `CardHeader`: Header section
- `CardTitle`: Title heading
- `CardDescription`: Description text
- `CardContent`: Main content area
- `CardFooter`: Footer section

**Example:**
```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Button } from '@/components/ui';

<Card variant="elevated">
  <CardHeader>
    <CardTitle>Dark Magician</CardTitle>
    <CardDescription>DARK Spellcaster</CardDescription>
  </CardHeader>
  <CardContent>
    <p>ATK/2500 DEF/2100</p>
  </CardContent>
  <CardFooter>
    <Button>Add to Deck</Button>
  </CardFooter>
</Card>
```

---

### Spinner
A loading spinner component with size and color variants.

**Props:**
- `size`: 'sm' | 'md' | 'lg' | 'xl' (default: 'md')
- `color`: 'primary' | 'secondary' | 'white' | 'current' (default: 'primary')
- `className`: string (optional)
- `label`: string (default: 'Loading...')

**SpinnerOverlay Props:**
- `message`: string (optional)

**Example:**
```tsx
import { Spinner, SpinnerOverlay } from '@/components/ui';

<Spinner size="lg" color="primary" />

{isLoading && <SpinnerOverlay message="Loading cards..." />}
```

---

## Importing Components

All components can be imported from the barrel export:

```tsx
import {
  Button,
  Input,
  Select,
  Modal,
  Badge,
  Toggle,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
  Spinner,
  SpinnerOverlay,
} from '@/components/ui';
```

Or import individually:

```tsx
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
```

---

## Styling

All components use TailwindCSS for styling. Make sure TailwindCSS is properly configured in your project.

## Accessibility

All components follow WAI-ARIA best practices:
- Proper ARIA attributes
- Keyboard navigation support
- Focus management
- Screen reader support
- Semantic HTML elements

## TypeScript

All components are fully typed with TypeScript. Import types as needed:

```tsx
import type { ButtonProps, InputProps, SelectOption } from '@/components/ui';
```
