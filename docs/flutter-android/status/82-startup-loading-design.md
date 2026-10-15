# KhmerX Startup and Loading Motion

## Implementation

The motion is pure Flutter with `AnimationController`, `CustomPainter`, and the
existing PNG brand assets. No dependency or new animation asset was added.

## Startup timeline

| Time | Element | Motion |
| ---: | --- | --- |
| 0 ms | Background | `#F7F9FC` is already visible; the first Flutter frame stays empty. |
| 0–1044 ms | Full KhmerX logo | Fade from 0 to 1, translate 10dp to 0, and scale 0.96 to 1 with `easeOutCubic`. |
| 648–1404 ms | `FAST · SIMPLE · CLEAR` | Fade in with `easeOut`, settling 6dp into the final position. |
| 936–1620 ms | Localized startup tagline | Fade in with `easeOut`; the text keeps a 1.45 line height and a width constraint for Khmer. |
| 1296–1800 ms | Bottom arc | Fade in while the reusable loader remains available for the resolution wait. |
| 1800 ms | Exit | The existing router fade handles the transition to the next route. |

The success path waits for the 1800ms sequence when the backend resolves faster.
The failure path completes the sequence and holds the final brand frame before
showing the localized retry action. Reduced motion skips directly to the final
frame.

## Loading timeline

`BrandLoader` keeps its public `size`, `light`, `dots`, and `mark` API. The arc
uses a 1400ms linear loop with a rotating sweep gradient and round caps. The K
mark has a small sinusoidal scale pulse. The `BrandLoader.small` constructor
provides a 20dp button-sized variant. `light=true` uses a white arc and white
surface behind the existing K asset; `mark=false` renders only the arc.

## Brand tokens

- Primary blue: `#1677FF`
- Cyan transition: the existing logo gradient near `#00AEFF`
- Ink: `#071631`
- App and native splash background: `#F7F9FC`

The animation uses the supplied logo files without redrawing or replacing the
mark. It avoids particles, money imagery, and other lending-specific effects.

## Validation evidence

- `flutter analyze`: passed with no issues.
- `flutter build apk --debug`: passed.
- `flutter test`: 404 passed; one pre-existing KYC schema test failed at
  `test/features/kyc/kyc_test.dart:109` (`Bad state: No element`).
- Emulator `emulator-5554` cold-start captures are stored beside this file,
  including 0, 300, 600, 1000, 1500ms, and the post-start Telegram code screen.

## Known limitation

Android 12 and later may keep the system splash background visible while the
debug Flutter engine initializes. On this emulator the 300–600ms captures are
the plain `#F7F9FC` native transition frame; the Flutter logo sequence begins
once the engine has produced its first frame. Android versions below 12 use the
existing window background behavior. The 0ms adb capture can still contain the
launcher because the activity launch is asynchronous; the first Flutter frame
is the same empty `#F7F9FC` surface.
