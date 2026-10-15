# SmartPantry Promotional Assets

These PNGs are composed from the seven supplied real Android screenshots, not
generated or reconstructed app interfaces. No app code or runtime data is changed
by the export script. The presentation uses a near-black background, orange
accents, restrained geometric phone frames and Segoe UI typography.

## Deliverables

| File | Size | Use |
| --- | --- | --- |
| images/smartpantry-hero.png | 2400 x 1350 | README hero, release announcement |
| images/smartpantry-screenshots.png | 2400 x 1840 | Six-screen overview, release gallery |
| images/framed/*.png | 454 x 960 | Individual phone frames, transparent background |
| images/screenshots/*.png | Original capture dimensions | Reusable, public-safe source captures |

Hero: Home, Inventory, Recipes, Shopping List. Grid: Home, Inventory, Recipes,
Statistics, Shopping List, More. Individual frames include all seven captures,
including Scanner. Profile is not shown because its screenshot was not supplied.

## Fidelity and Privacy

- Screenshots are scaled proportionally within phone frames, never stretched.
  Only their black outer corners are masked to follow the bezel.
- No product data, recipe images, camera preview, account details or UI elements
  are fabricated. Populated pantry, recipe, shopping and statistics states remain
  exactly as captured. Scanner still shows the actual camera-permission screen
  and is available as an individual export rather than in the main compositions.
  The Sync feature label describes implemented functionality; the
  composition does not invent a sync-success screen.
- The personal email on More is irreversibly covered in the public source copy
  and all derived promotional exports. Original user attachments remain untouched.
  The README gallery in `docs/screenshots` deliberately uses byte-identical
  originals, as requested, including the unredacted email on More. Review that
  original before publishing the repository publicly.
- Source captures are approximately 385 pixels wide. The large canvas exports do
  not create additional screenshot detail; view individual captures at native size
  for maximum sharpness.

## Re-Export

On Windows, using System.Drawing supplied by .NET (no new npm dependencies):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/generate-showcase.ps1
```

This reads `docs/images/screenshots` and recreates the hero, grid and framed PNGs.
To import a new set, pass seven source files using `-SourceFiles`, ordered Home,
Inventory, Recipes, Statistics, Shopping List, More, Scanner. Importing More applies the privacy redaction
at the original capture coordinates; re-check those coordinates if its resolution
or profile layout changes. Subsequent re-exports use the already-sanitized copies.

## Stronger Future Captures

For a populated release gallery, capture native-resolution PNGs on one device,
preferably 1080 x 2400 portrait. Keep English, Dark theme, Orange accent and normal
font scaling throughout. Capture Home, Inventory, Scanner, Recipes, Shopping List,
Profile in that order. Load actual test products and recipe results, grant camera
permission manually, dismiss keyboards/dialogs and use a disposable profile with
no private contact details. Keep the actual UI unchanged; do not paint content
onto empty states. Do not include emulator chrome or pre-applied phone frames.
