# How to Generate PDF from HTML

## Quick Method (Recommended)

1. **Open the HTML file:**
   - File: `docs/research/Cross-DEX-Analysis-Nov-2025-PRINT.html`
   - Should already be open in your browser
   
2. **Print to PDF:**
   - Press `Cmd + P` (Mac) or `Ctrl + P` (Windows)
   - Select "Save as PDF" as the destination
   - Choose these settings:
     - Paper size: A4
     - Margins: Default
     - Scale: 100% (or "Fit to page")
     - Background graphics: ✅ Enabled
   - Click "Save"
   - Save as: `Cross-DEX-Analysis-Nov-2025.pdf`

## Alternative: Using Chrome DevTools

1. Open the HTML file in Chrome
2. Press `Cmd + Option + I` to open DevTools
3. Press `Cmd + Shift + P` to open Command Palette
4. Type "PDF" and select "Print to PDF"
5. Configure:
   - Display header/footer: No
   - Print background: Yes
   - Scale: 1
6. Save

## Alternative: Using wkhtmltopdf (if installed)

```bash
cd /Users/koen/Desktop/Liquilab

wkhtmltopdf \
  --enable-local-file-access \
  --page-size A4 \
  --margin-top 20mm \
  --margin-bottom 20mm \
  --margin-left 25mm \
  --margin-right 25mm \
  --print-media-type \
  docs/research/Cross-DEX-Analysis-Nov-2025-PRINT.html \
  docs/research/Cross-DEX-Analysis-Nov-2025.pdf
```

## Files Generated

- ✅ `Cross-DEX-Analysis-Nov-2025-PRINT.html` - Print-ready HTML with styling
- ✅ `Cross-DEX-Analysis-Nov-2025.html` - Simple HTML version
- ✅ `Cross-DEX-Analysis-Nov-2025.md` - Original markdown
- ⏳ `Cross-DEX-Analysis-Nov-2025.pdf` - You need to generate this via print

## Styling Features

The HTML includes:
- Professional LiquiLab branding (aqua colors)
- Print-optimized layout (A4, proper margins)
- Table of Contents
- Styled tables with hover effects
- Code blocks with syntax highlighting
- Page breaks before major sections
- Proper typography (Georgia serif font)
- Cover page with metadata
- Footer with disclaimer

## File Sizes

- HTML: ~150 KB
- Expected PDF: ~500 KB - 1 MB

## Distribution

Once you have the PDF:
1. Upload to website: `liquilab.io/research/cross-dex-analysis-nov-2025.pdf`
2. Share on social media with download link
3. Email to press contacts
4. Include in press kit

---

**Note:** The HTML file is already styled for perfect PDF output. Just print it!

