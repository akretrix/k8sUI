# Design Tokens, Theming & Brand Asset System

k8sUI (K8SUI) utilizes a comprehensive, dark-mode optimized Multiplatform Design System tailored for high-density Kubernetes cluster monitoring and cloud infrastructure administration.

---

## 1. Brand Color Palette (Kubernetes-Inspired Core)

A trademark-compliant, modern blue spectrum engineered for high-contrast control planes without CNCF trademark infringement:

| Token | Hex Value | Role / Usage |
| :--- | :--- | :--- |
| `brand-50` | `#EEF4FF` | Subtle light tint, light-mode hover |
| `brand-100` | `#DCE7FE` | Badge background, chip container |
| `brand-200` | `#B8D0FC` | Border accent light |
| `brand-300` | `#8FB4FA` | Active nav link text, interactive focus |
| `brand-400` | `#60A5FA` | Hover state, secondary brand glow |
| `brand-500` | `#326CE5` | **Brand Core Primary** (Action buttons, active cluster) |
| `brand-600` | `#2557C7` | Button hover & pressed gradients |
| `brand-700` | `#1D44A5` | Deep pressed state |
| `brand-800` | `#143175` | Dark mesh background |
| `brand-900` | `#0E214F` | Obsidian backdrop tint |

---

## 2. Neutral Canvas Tokens (Dark Mode Default)

Calibrated for prolonged terminal and cluster monitoring with zero eye-strain:

| Token | Hex Value | Tailwind Class | Role |
| :--- | :--- | :--- | :--- |
| `canvas-base` | `#0B0F17` | `bg-canvas-base` | Deep Obsidian background canvas |
| `canvas-surface` | `#111827` | `bg-surface` / `bg-canvas-surface` | Slate 900 card / table surfaces |
| `canvas-elevated` | `#1F2937` | `bg-surface-elevated` | Toolbars, sidebars, modal dialogs |
| `border-subdued` | `#1F2937` | `border-border` | Subtle structural separators |
| `text-primary` | `#F9FAFB` | `text-gray-100` | Main UI typography & metrics |
| `text-muted` | `#9CA3AF` | `text-gray-400` | Secondary labels & timestamps |

---

## 3. Semantic Kubernetes Status Tokens

| Semantic Role | Hex Value | Pulse / Highlight | Meaning |
| :--- | :--- | :--- | :--- |
| `semantic-healthy` | `#10B981` | `#34D399` | Running pods, Ready nodes, Bound PVCs |
| `semantic-warning` | `#F59E0B` | `#FBBF24` | Pending pods, high resource utilization |
| `semantic-critical` | `#EF4444` | `#F87171` | CrashLoopBackOff, OOMKilled, Degraded |
| `semantic-pending` | `#6366F1` | `#818CF8` | Scaling transitions, rolling updates |

---

## 4. Multiplatform Asset Suite Architecture

Vector SVGs and reactive components are organized cleanly across the project:

```
k9sUI/
├── assets/
│   ├── brand/
│   │   ├── app-icon-master-512.svg     # Master 512x512 squircle icon canvas
│   │   ├── favicon-vector.svg          # 32x32 Scalable vector favicon
│   │   ├── logo-symbol.svg             # Isometric cluster cube symbol
│   │   └── logo-monochrome.svg         # High-contrast outline stroke
│   │
│   └── illustrations/
│       ├── no-clusters.svg             # Empty state illustration
│       ├── crash-alert.svg             # Crash & alert state illustration
│       ├── rolling-update.svg          # Rollout transition illustration
│       └── all-systems-operational.svg # Healthy cluster state illustration
│
├── public/
│   ├── favicon.svg                     # Web browser favicon
│   └── app-icon-512.svg                # Web clip & PWA icon
│
└── src/
    ├── assets/brand/
    │   ├── LogoSymbol.tsx              # Reactive SVG symbol
    │   ├── LogoLockup.tsx              # Full horizontal lockup ("K8SUI")
    │   ├── LogoMonochrome.tsx          # Single-tone outline component
    │   ├── EmptyStateIllustrations.tsx # 4 State illustrations
    │   └── MultiplatformMockups.tsx    # Device canvas preview renderer
    │
    └── components/design-system/
        └── DesignSystemShowcase.tsx    # Interactive Design System Explorer
```

---

## 5. CSS Custom Properties (`:root`)

Included globally in `src/index.css`:

```css
:root {
  /* Brand Core (K8s Inspired) */
  --brand-50: #EEF4FF;
  --brand-100: #DCE7FE;
  --brand-500: #326CE5;
  --brand-600: #2557C7;
  --brand-700: #1D44A5;

  /* Neutral Canvas */
  --canvas-base: #0B0F17;
  --canvas-surface: #111827;
  --canvas-elevated: #1F2937;
  --border-subdued: #1F2937;
  --text-primary: #F9FAFB;
  --text-muted: #9CA3AF;

  /* Semantic Status */
  --semantic-healthy: #10B981;
  --semantic-healthy-pulse: #34D399;
  --semantic-warning: #F59E0B;
  --semantic-critical: #EF4444;
  --semantic-pending: #6366F1;
}
```
