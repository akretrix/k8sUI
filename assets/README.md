# K8SUI — Asset & Brand Directory

This directory contains master brand vectors, multiplatform icon templates, empty state illustrations, and design tokens for the Kubernetes Cluster Management Application.

---

## Directory Structure

```
assets/
├── brand/
│   ├── app-icon-master-512.svg     # 512x512 Master squircle canvas with isometric cube & glowing node
│   ├── favicon-vector.svg          # 32x32 Vector favicon with emerald active status vertex
│   ├── logo-symbol.svg             # Standalone isometric cluster cube symbol (1:1 ratio)
│   └── logo-monochrome.svg         # Single-tone outline vector for high-contrast / CLI / monochrome
│
├── illustrations/
│   ├── no-clusters.svg             # Empty hexagonal docking platform waiting for cluster link
│   ├── crash-alert.svg             # Fractured isometric node with alert indicators & lightning cracks
│   ├── rolling-update.svg          # Dual interlocking orbital gear rings for zero-downtime rollouts
│   └── all-systems-operational.svg # Glowing emerald node mesh with signal paths & healthy heartbeat
│
├── icons/                          # Resource type icons (Pod, Deployment, Service, PVC, etc.)
│   └── src/
│
└── README.md                       # This catalog document
```

---

## Multiplatform Specifications

| Target Platform | File / Format | Canvas Size | Characteristics |
| :--- | :--- | :--- | :--- |
| **Web Favicon** | `public/favicon.svg` | `32x32` Vector | Scalable SVG with high-contrast active dot |
| **PWA / Web Clip** | `public/app-icon-512.svg` | `512x512` | Continuous curvature squircle with 8% inner gradient glow |
| **iOS Master** | `assets/brand/app-icon-master-512.svg` | `1024x1024` Master | Solid canvas, zero transparency, safe-zone centered |
| **Android Adaptive** | Foreground + Background Mesh | `432x432` | Modular foreground symbol + radial dot-grid background mesh |
| **macOS / Windows** | Desktop Dock Icon | `512x512` Squircle | Continuous curvature squircle with subtle drop shadow |

---

## React Component Equivalents

All brand assets are also provided as tree-shakeable, reactive TypeScript SVG components in `src/assets/brand/`:
* `<LogoSymbol size={48} hasGlow={true} />`
* `<LogoLockup symbolSize={36} theme="dark" />`
* `<LogoMonochrome size={36} color="currentColor" />`
* `<NoClustersIllustration size={280} />`
* `<CrashAlertIllustration size={280} />`
* `<RollingUpdateIllustration size={280} />`
* `<AllSystemsOperationalIllustration size={280} />`
