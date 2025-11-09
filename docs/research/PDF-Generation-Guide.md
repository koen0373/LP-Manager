# Cross-DEX Analysis Report - PDF Generation Guide

## Quick Start

### Option 1: Using Pandoc (Recommended)

```bash
# Install pandoc (macOS)
brew install pandoc

# Install LaTeX for PDF generation
brew install --cask mactex-no-gui

# Generate PDF
pandoc reports/Cross-DEX-Analysis-Nov-2025.md \
  -o reports/Cross-DEX-Analysis-Nov-2025.pdf \
  --pdf-engine=xelatex \
  -V geometry:margin=1in \
  -V fontsize=11pt \
  -V documentclass=report \
  -V colorlinks=true \
  --highlight-style=tango \
  --toc \
  --toc-depth=2
```

### Option 2: Using Markdown to PDF (VS Code Extension)

1. Install **Markdown PDF** extension in VS Code
2. Open `reports/Cross-DEX-Analysis-Nov-2025.md`
3. Press `Cmd+Shift+P` (macOS) or `Ctrl+Shift+P` (Windows)
4. Type "Markdown PDF: Export (pdf)"
5. Press Enter

### Option 3: Using Online Converter

1. Visit https://www.markdowntopdf.com/
2. Upload `reports/Cross-DEX-Analysis-Nov-2025.md`
3. Click "Convert"
4. Download PDF

### Option 4: Using Google Docs

1. Open https://docs.google.com
2. File → New → Document
3. Copy-paste markdown content
4. File → Download → PDF Document (.pdf)

---

## Professional Styling Tips

### Custom CSS (for web-based converters)

```css
@page {
  margin: 2cm;
}

body {
  font-family: 'Georgia', serif;
  line-height: 1.6;
  color: #333;
}

h1 {
  color: #00B8D4;
  border-bottom: 3px solid #00B8D4;
  padding-bottom: 0.3em;
}

h2 {
  color: #0097A7;
  border-bottom: 2px solid #B2EBF2;
  padding-bottom: 0.2em;
}

table {
  border-collapse: collapse;
  width: 100%;
  margin: 1em 0;
}

th {
  background-color: #00B8D4;
  color: white;
  padding: 12px;
  text-align: left;
}

td {
  padding: 10px;
  border-bottom: 1px solid #ddd;
}

tr:hover {
  background-color: #f5f5f5;
}

code {
  background-color: #f4f4f4;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'Monaco', monospace;
}

blockquote {
  border-left: 4px solid #00B8D4;
  padding-left: 1em;
  margin-left: 0;
  color: #666;
}
```

---

## Branding Additions

### Cover Page (prepend to markdown)

```markdown
---
title: "Cross-DEX Liquidity Provider Analysis"
subtitle: "Flare Network V3 Ecosystem Research Report"
author: "LiquiLab Research Team"
date: "November 2025"
logo: "public/brand/logo.svg"
---

![LiquiLab Logo](../public/brand/logo.svg){width=200px}

<div style="page-break-after: always;"></div>
```

### Footer (append to markdown)

```markdown
---

## Disclaimer

This report is provided for informational purposes only. The data presented is derived from public blockchain records and does not constitute financial advice. LiquiLab makes no representations regarding the accuracy or completeness of third-party data.

**Important Notice:**
- Past performance does not guarantee future results
- Cryptocurrency investments carry significant risk
- Users should conduct their own research before making investment decisions
- LiquiLab is not affiliated with Enosys or SparkDEX

---

**LiquiLab™** and **RangeBand™** are trademarks of LiquiLab B.V.

For the latest data and real-time analytics, visit [app.liquilab.io](https://app.liquilab.io)
```

---

## File Locations

- **Markdown Source:** `reports/Cross-DEX-Analysis-Nov-2025.md`
- **Output PDF:** `reports/Cross-DEX-Analysis-Nov-2025.pdf`
- **Branding Assets:** `public/brand/`

---

## Distribution Checklist

- [ ] Generate PDF with TOC
- [ ] Verify all tables render correctly
- [ ] Check page breaks
- [ ] Add cover page with LiquiLab branding
- [ ] Add footer with disclaimer
- [ ] Test on mobile devices
- [ ] Create compressed version for email (<5MB)
- [ ] Upload to website/press kit
- [ ] Share on social media
- [ ] Send to media contacts

---

## Press Release Templates

### Twitter/X
```
📊 NEW RESEARCH: Only 8.9% of Flare Network LPs use both Enosys and SparkDEX — but they control 34.6% of all liquidity!

Our latest report reveals the "Super LP" phenomenon driving Flare's V3 ecosystem.

🔗 Read the full report: [link]

#Flare #DeFi #LiquidityMining
```

### LinkedIn
```
🔬 LiquiLab Research: Cross-DEX Behavior on Flare Network

We analyzed 74,857 liquidity positions across 8,594 wallets to understand how LPs navigate Flare's multi-DEX ecosystem.

Key findings:
• 761 "Super LPs" control 34.6% of all positions
• Cross-DEX users average 34.1 positions (vs 8.7 network avg)
• Top 10 wallets hold 7.15% of network liquidity

This data reveals opportunities for:
✓ DEX operators to capture multi-platform users
✓ LPs to optimize cross-platform yields
✓ The ecosystem to mature through better tooling

Full report available at [link]

#DeFi #DataAnalytics #FlareNetwork
```

### Email Subject Lines
- "New Research: The 8.9% of LPs Controlling 35% of Flare's Liquidity"
- "Cross-DEX Analysis: Flare Network's Power User Phenomenon"
- "LiquiLab Report: Multi-Platform LP Behavior on Flare"

---

## Contact

For questions about this report or data requests:
- **Email:** research@liquilab.io
- **Website:** https://liquilab.io
- **Twitter:** @LiquiLab

---

**Generated:** November 9, 2025

