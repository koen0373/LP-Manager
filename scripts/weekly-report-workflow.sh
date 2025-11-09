#!/bin/bash
# Complete Weekly Report Workflow
# Generates report, social media content, and PDF

set -e

echo "🚀 LiquiLab Weekly Report Automation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1. Generate weekly report markdown
echo "📊 Step 1: Generating weekly report..."
node scripts/generate-weekly-report.js

if [ $? -ne 0 ]; then
  echo "❌ Failed to generate report"
  exit 1
fi

echo ""
echo "✅ Report generated successfully"
echo ""

# 2. Generate social media content
echo "📱 Step 2: Generating social media content..."
node scripts/generate-social-media.js

if [ $? -ne 0 ]; then
  echo "❌ Failed to generate social media content"
  exit 1
fi

echo ""
echo "✅ Social media content generated"
echo ""

# 3. Get week info for file paths
WEEK=$(date +"%V")
YEAR=$(date +"%Y")
WEEK_PADDED=$(printf "%02d" $WEEK)
REPORT_DIR="docs/research/weekly"
REPORT_FILE="${REPORT_DIR}/Cross-DEX-Report-${YEAR}-W${WEEK_PADDED}.md"
HTML_FILE="${REPORT_DIR}/Cross-DEX-Report-${YEAR}-W${WEEK_PADDED}.html"
SOCIAL_DIR="${REPORT_DIR}/W${WEEK_PADDED}-social"

# 4. Convert markdown to HTML
echo "📄 Step 3: Converting to HTML..."

cat > "${HTML_FILE}" << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LiquiLab Weekly Report</title>
    <style>
        @page { margin: 2cm; size: A4; }
        @media print {
            .no-print { display: none; }
            h1 { page-break-before: always; }
            h2, h3 { page-break-after: avoid; }
            table, pre { page-break-inside: avoid; }
        }
        body {
            font-family: 'Georgia', serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 40px 20px;
        }
        h1 { color: #00B8D4; border-bottom: 3px solid #00B8D4; padding-bottom: 10px; }
        h2 { color: #0097A7; border-bottom: 2px solid #B2EBF2; padding-bottom: 8px; }
        h3 { color: #00838F; }
        table { border-collapse: collapse; width: 100%; margin: 20px 0; }
        th { background: #00B8D4; color: white; padding: 12px; text-align: left; }
        td { padding: 10px; border-bottom: 1px solid #ddd; }
        tr:hover { background-color: #f5f5f5; }
        code { background-color: #f4f4f4; padding: 2px 6px; border-radius: 3px; }
        pre { background-color: #f8f8f8; border-left: 4px solid #00B8D4; padding: 15px; }
        .print-button {
            position: fixed;
            top: 20px;
            right: 20px;
            background: #00B8D4;
            color: white;
            padding: 12px 24px;
            border-radius: 6px;
            cursor: pointer;
            border: none;
            font-size: 14pt;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        }
    </style>
</head>
<body>
    <button class="print-button no-print" onclick="window.print()">📄 Save as PDF</button>
EOF

# Convert markdown to HTML body and append
pandoc "${REPORT_FILE}" --to html >> "${HTML_FILE}"

cat >> "${HTML_FILE}" << 'EOF'
    
    <div style="margin-top: 60px; padding-top: 20px; border-top: 2px solid #B2EBF2; text-align: center; color: #666;">
        <p><strong>© 2025 LiquiLab.</strong> All rights reserved.</p>
        <p>For real-time analytics, visit <a href="https://app.liquilab.io" style="color: #00B8D4;">app.liquilab.io</a></p>
    </div>
</body>
</html>
EOF

echo "✅ HTML generated: ${HTML_FILE}"
echo ""

# 5. Open HTML for manual PDF export
echo "📄 Step 4: Opening HTML for PDF export..."
echo ""
echo "▶️  HTML file will open in your browser"
echo "▶️  Press Cmd+P (Mac) or Ctrl+P (Windows)"
echo "▶️  Select 'Save as PDF'"
echo "▶️  Enable 'Background graphics'"
echo "▶️  Save to: ${REPORT_DIR}/Cross-DEX-Report-${YEAR}-W${WEEK_PADDED}.pdf"
echo ""

open "${HTML_FILE}"

sleep 2

# 6. Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ WEEKLY REPORT WORKFLOW COMPLETE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📁 FILES GENERATED:"
echo ""
echo "📄 Report (Markdown):"
echo "   ${REPORT_FILE}"
echo ""
echo "📄 Report (HTML):"
echo "   ${HTML_FILE}"
echo ""
echo "📱 Social Media Content:"
echo "   ${SOCIAL_DIR}/linkedin.txt"
echo "   ${SOCIAL_DIR}/twitter-thread.txt"
echo "   ${SOCIAL_DIR}/tweet-{1-7}.txt"
echo "   ${SOCIAL_DIR}/instagram.txt"
echo "   ${SOCIAL_DIR}/reddit.txt"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 NEXT STEPS:"
echo ""
echo "1. ✅ Generate PDF from HTML (Cmd+P in browser)"
echo "2. 📤 Upload PDF to website: liquilab.io/research/"
echo "3. 📱 Post on social media (content ready in ${SOCIAL_DIR})"
echo "4. 📧 Send to email subscribers"
echo "5. 💬 Share in Discord/Telegram"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🔔 Schedule this script with cron for automatic weekly reports:"
echo "   0 10 * * 1 cd /path/to/Liquilab && ./scripts/weekly-report-workflow.sh"
echo ""
echo "   (Runs every Monday at 10:00 AM)"
echo ""
echo "✨ Done!"
echo ""

