const fs = require('fs');

let css = fs.readFileSync('src/index.css', 'utf8');

// 1. Upgrade Body Background
const oldBody = `body {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  overflow-x: hidden;
  background-color: #0b1120;
  background-image: radial-gradient(circle at 50% -20%, #1e1b4b 0%, #020617 80%, #000000 100%);
  background-attachment: fixed;
  color: #ffffff;
  -webkit-tap-highlight-color: transparent;
}`;

const newBody = `body {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  overflow-x: hidden;
  background-color: #0b0f19;
  background-image:
    radial-gradient(circle at 15% 50%, rgba(30, 27, 75, 0.45), transparent 40%),
    radial-gradient(circle at 85% 30%, rgba(46, 16, 101, 0.4), transparent 45%),
    radial-gradient(circle at 50% 80%, rgba(15, 23, 42, 0.6), transparent 50%),
    linear-gradient(180deg, #0f172a 0%, #020617 100%);
  background-attachment: fixed;
  color: #ffffff;
  -webkit-tap-highlight-color: transparent;
  animation: ambient-pulse 15s ease-in-out infinite alternate;
}

@keyframes ambient-pulse {
  0% { background-position: 0% 0%; }
  50% { background-position: 2% 4%; }
  100% { background-position: -2% -4%; }
}
`;

css = css.replace(oldBody, newBody);

// 2. Refine global glass-card
const oldGlassCard = `.glass-card {
  background: rgba(15, 23, 42, 0.6) !important;
  backdrop-filter: blur(24px) saturate(120%) !important;
  -webkit-backdrop-filter: blur(24px) saturate(120%) !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  box-shadow: 0 10px 40px -10px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.05) !important;
}`;

const newGlassCard = `.glass-card {
  background: rgba(255, 255, 255, 0.03) !important;
  background-image: linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.01) 100%) !important;
  backdrop-filter: blur(32px) saturate(140%) !important;
  -webkit-backdrop-filter: blur(32px) saturate(140%) !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  border-top-color: rgba(255, 255, 255, 0.15) !important;
  border-left-color: rgba(255, 255, 255, 0.12) !important;
  box-shadow: 0 15px 35px -5px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.08) !important;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1) !important;
}

.glass-card:hover {
  background: rgba(255, 255, 255, 0.05) !important;
  border-color: rgba(255, 255, 255, 0.15) !important;
  transform: translateY(-2px);
  box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.15) !important;
}
`;

css = css.replace(oldGlassCard, newGlassCard);

fs.writeFileSync('src/index.css', css);
console.log('CSS updated successfully');
