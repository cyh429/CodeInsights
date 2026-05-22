# CodeInsights Technical Sharing Deck

10-page HTML presentation for CodeInsights technical sharing.

Second-pass optimized narrative:

- Sharper opening thesis: CodeInsights connects mature coding agent runtimes instead of building a generic Agent kernel.
- Stronger talk arc: diagnosis -> product bet -> architecture -> Agent Mode -> Pipeline Mode -> trust model -> takeaways.
- Reduced visible copy; moved explanation into presenter notes.
- Updated rendered previews after optimization.

## Open

Open `index.html` in a browser.

Keyboard:

- `Left` / `Right`: navigate slides
- `S`: open presenter view
- `N`: show speaker notes overlay
- `T`: switch theme
- `O`: overview

## Files

- `index.html`: presentation content and speaker notes
- `style.css`: deck-specific styling
- `assets/`: copied `html-ppt` runtime assets and CodeInsights diagram images
- `rendered/slide_01.png` through `rendered/slide_10.png`: rendered previews
- `rendered/contact-sheet.png`: visual QA contact sheet

## Verification

- Static checks passed: 10 slides, 10 speaker-note blocks, all local references resolve.
- Playwright rendering passed: all 10 slides rendered at 1920x1080.
- Runtime check passed: keyboard navigation, notes overlay, and presenter popup open correctly.
