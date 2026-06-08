const fs = require('fs');

let appSrc = fs.readFileSync('src/App.tsx', 'utf8');

// The auth modal uses a very dark background. Let's make it a bit more translucent
// so the beautiful new global background bleeds through nicely.

// Let's replace the rigid slate-950 background of the auth overlay with a premium translucent blur
const oldOverlay = `fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-4 overflow-hidden`;
const newOverlay = `fixed inset-0 z-[100] bg-black/60 backdrop-blur-[32px] flex items-center justify-center p-4 overflow-hidden`;

appSrc = appSrc.replace(oldOverlay, newOverlay);

// Modify the auth card's gradient to be even more glass-like and premium
const oldAuthCard = `className="relative w-full max-w-sm glass-card rounded-[2.5rem] p-8 pb-10 flex flex-col items-center border border-slate-700/50 shadow-2xl z-10 overflow-hidden bg-gradient-to-b from-slate-900/90 to-slate-950/90"`;
const newAuthCard = `className="relative w-full max-w-sm glass-card rounded-[2.5rem] p-8 pb-10 flex flex-col items-center border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] z-10 overflow-hidden bg-gradient-to-br from-white/5 to-transparent"`;

appSrc = appSrc.replace(oldAuthCard, newAuthCard);

fs.writeFileSync('src/App.tsx', appSrc);
console.log('App.tsx updated successfully');
