# Tailwind CSS Troubleshooting Guide

## 🚨 **Veelvoorkomende Problemen en Oplossingen**

### **1. Tailwind Classes Worden Niet Toegepast**

#### **Probleem:**
- Tailwind classes zoals `bg-enosys-bg`, `text-enosys-text` worden niet gerenderd
- Inline styles werken wel, maar Tailwind classes niet
- Browser inspectie toont dat classes aanwezig zijn maar geen effect hebben

#### **Oplossing:**
```bash
# 1. Herstart de development server
npm run dev

# 2. Hard refresh in browser (Cmd+Shift+R / Ctrl+Shift+R)

# 3. Controleer of Tailwind CSS v4 correct is geïnstalleerd
npm list tailwindcss
```

### **2. VS Code IntelliSense Problemen**

#### **Probleem:**
- VS Code herkent Tailwind classes niet
- Geen autocomplete voor Tailwind utilities
- CSS validation errors voor Tailwind syntax

#### **Oplossing:**
De `.vscode/settings.json` is al geconfigureerd met:
```json
{
  "files.associations": {
    "*.css": "tailwindcss"
  },
  "tailwindCSS.includeLanguages": {
    "typescript": "typescript",
    "typescriptreact": "typescriptreact"
  },
  "css.validate": false
}
```

### **3. Custom Colors Worden Niet Herkend**

#### **Probleem:**
- `bg-enosys-bg`, `text-enosys-subtext` etc. worden niet herkend
- Tailwind IntelliSense toont deze als onbekende classes

#### **Oplossing:**
Controleer `tailwind.config.js`:
```javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        enosys: {
          bg: 'var(--enosys-bg)',
          card: 'var(--enosys-card)',
          // ... andere kleuren
        }
      }
    }
  }
}
```

### **4. PostCSS Configuratie Problemen**

#### **Probleem:**
- Tailwind CSS wordt niet verwerkt
- Build errors gerelateerd aan PostCSS

#### **Oplossing:**
Controleer `postcss.config.mjs`:
```javascript
const config = {
  plugins: ["@tailwindcss/postcss"],
};

export default config;
```

### **5. Fallback Strategie: Inline Styles**

#### **Wanneer Tailwind niet werkt:**
Gebruik inline styles als fallback:
```tsx
// In plaats van className="bg-enosys-bg"
<div style={{ backgroundColor: 'var(--enosys-bg)' }}>
```

### **6. Debugging Stappen**

#### **Stap 1: Controleer Browser Console**
```javascript
// Voer dit uit in browser console
console.log(getComputedStyle(document.querySelector('.bg-enosys-bg')));
```

#### **Stap 2: Controleer CSS Output**
- Open DevTools > Sources
- Zoek naar de gegenereerde CSS
- Controleer of Tailwind classes zijn gecompileerd

#### **Stap 3: Controleer Tailwind Config**
```bash
# Test Tailwind configuratie
npx tailwindcss --help
```

### **7. Snelle Fixes**

#### **Fix 1: Cache Leegmaken**
```bash
rm -rf .next
rm -rf node_modules/.cache
npm run dev
```

#### **Fix 2: Dependencies Herinstalleren**
```bash
rm -rf node_modules package-lock.json
npm install
npm run dev
```

#### **Fix 3: Tailwind CSS Herinstalleren**
```bash
npm uninstall tailwindcss @tailwindcss/postcss
npm install tailwindcss@latest @tailwindcss/postcss@latest
```

## 🎯 **Best Practices**

### **1. Altijd Testen**
- Test wijzigingen in browser na elke aanpassing
- Gebruik browser DevTools om CSS te inspecteren
- Controleer of classes daadwerkelijk worden toegepast

### **2. Fallback Strategie**
- Gebruik inline styles voor kritieke styling
- Combineer Tailwind classes met inline styles waar nodig
- Test op verschillende browsers

### **3. Development Workflow**
1. Maak wijzigingen in component
2. Sla bestand op
3. Wacht op hot reload
4. Hard refresh browser
5. Inspecteer in DevTools
6. Gebruik inline styles als fallback

## 🔧 **Hulpmiddelen**

### **VS Code Extensions**
- Tailwind CSS IntelliSense
- PostCSS Language Support
- CSS IntelliSense

### **Browser Extensions**
- Tailwind CSS DevTools
- CSS Peeper

### **Debugging Commands**
```bash
# Controleer Tailwind versie
npx tailwindcss --version

# Test configuratie
npx tailwindcss --config tailwind.config.js --input src/app/globals.css --output test.css

# Build zonder cache
npm run build -- --no-cache
```

## 📝 **Notities**

- **Tailwind CSS v4** heeft andere configuratie dan v3
- **Next.js 15** met Turbopack kan caching problemen veroorzaken
- **Custom CSS properties** werken beter dan Tailwind custom colors in sommige gevallen
- **Inline styles** zijn altijd betrouwbaar als fallback
