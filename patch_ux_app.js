const fs = require('fs');

let appSrc = fs.readFileSync('src/App.tsx', 'utf8');

// The main layout uses hardcoded background colors that block the global body background.
// E.g., `bg-slate-950` on the main container. Let's make it transparent.

appSrc = appSrc.replace(
  `className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-20 selection:bg-amber-500/30 overflow-x-hidden relative"`,
  `className="min-h-screen bg-transparent text-slate-100 font-sans pb-20 selection:bg-amber-500/30 overflow-x-hidden relative"`
);

// Remove strict background colors from nav bar to let the glass effect shine
appSrc = appSrc.replace(
  `className="fixed bottom-0 left-0 right-0 bg-slate-900/80 backdrop-blur-md border-t border-slate-800 z-50 px-2 sm:px-6 py-3 flex justify-between items-center max-w-md mx-auto rounded-t-2xl sm:max-w-none sm:rounded-none"`,
  `className="fixed bottom-0 left-0 right-0 glass-card !border-t border-white/10 z-50 px-2 sm:px-6 py-3 flex justify-between items-center max-w-md mx-auto rounded-t-3xl sm:max-w-none sm:rounded-none shadow-[0_-10px_40px_rgba(0,0,0,0.3)]"`
);

appSrc = appSrc.replace(
  `className="fixed top-0 left-0 right-0 bg-slate-950/80 backdrop-blur-md z-40 px-5 py-4 flex justify-between items-center border-b border-slate-800 shadow-sm"`,
  `className="fixed top-0 left-0 right-0 glass-card !border-b border-white/10 z-40 px-5 py-4 flex justify-between items-center shadow-lg"`
);

// Enhance buttons globally where amber is used
appSrc = appSrc.replace(
  /className="bg-gradient-to-r from-amber-500 to-amber-600(.*?)hover:from-amber-400 hover:to-amber-500/g,
  `className="bg-gradient-to-r from-amber-500 to-orange-500 $1 hover:from-amber-400 hover:to-orange-400 shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:shadow-[0_0_30px_rgba(245,158,11,0.5)] transition-all duration-300 transform hover:-translate-y-1`
);

fs.writeFileSync('src/App.tsx', appSrc);
console.log('App UX updated');
