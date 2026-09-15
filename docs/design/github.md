repo: JHee0209/montage-web
branch: main
path: packages/wds-theme, packages/wds

## Last sync
date: 2026-09-09T01:17:29Z

### Updated in this project
- Pulled Montage (Wanted Lab, MIT) design tokens: atomic color scales, semantic light theme, spacing, breakpoints, typography, elevation
- Read button/text-field/chip/card/progress-indicator component styles as the visual reference for common components
- Built "Design System.dc.html": token reference + laundry-queue components (buttons, inputs, status badges, machine cards, queue list, timer/progress, modal, toast, nav)
- Added site-specific accent: lightBlue for washers, redOrange for dryers (not in original Montage usage)

## Screen map
| Project screen | Repo source |
| --- | --- |
| Design System.dc.html — colors | packages/wds-theme/src/theme/atomic/*.ts, semantic/index.ts |
| Design System.dc.html — typography | packages/wds/src/components/typography/style.ts |
| Design System.dc.html — spacing/radius/elevation | packages/wds-theme/src/theme/spacing, semantic/index.ts (elevation.shadow) |
| Design System.dc.html — button | packages/wds/src/components/button/style.ts |
| Design System.dc.html — input | packages/wds/src/components/text-field/style.ts |
| Design System.dc.html — badge | packages/wds/src/components/chip/style.ts |
| Design System.dc.html — card | packages/wds/src/components/card/style.ts |
| Design System.dc.html — progress | packages/wds/src/components/progress-indicator/style.ts |
