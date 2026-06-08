const fs = require('fs');
let css = fs.readFileSync('src/index.css', 'utf8');

// Ensure that other cards that might have hardcoded backgrounds use the new glass effect
css += `
/* Force deep glass effect on specific heavy cards */
.bg-slate-900,
.bg-slate-950,
.bg-slate-800 {
    background-color: transparent !important;
}

div[class*="bg-slate-9"] {
    background-color: rgba(15, 23, 42, 0.4) !important;
    backdrop-filter: blur(16px);
}

/* Premium text gradient for primary headings */
h1.text-amber-500, h2.text-amber-500 {
    background: linear-gradient(135deg, #fcd34d 0%, #f59e0b 50%, #b45309 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    text-shadow: 0 2px 15px rgba(245, 158, 11, 0.3);
}

/* Enhancing inputs */
input {
    background: rgba(0, 0, 0, 0.2) !important;
    border: 1px solid rgba(255, 255, 255, 0.1) !important;
    transition: all 0.3s ease !important;
}
input:focus {
    background: rgba(0, 0, 0, 0.4) !important;
    border-color: rgba(245, 166, 35, 0.5) !important;
    box-shadow: 0 0 0 4px rgba(245, 166, 35, 0.1) !important;
}
`;

fs.writeFileSync('src/index.css', css);
console.log('CSS enhancements added');
