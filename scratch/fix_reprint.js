const fs = require('fs');
const path = 'c:\\Users\\ELANGO\\OneDrive\\Desktop\\Sushmitha akka gold shop\\client\\src\\App.jsx';
let content = fs.readFileSync(path, 'utf8');

// The exact target string from the current state of the file
const target = `                  {loan.status === 'Active' && (
                    <button onClick={() => onRelease(loan.id)} title="Release Asset" className="p-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/10 rounded-lg hover:bg-emerald-500 hover:text-white transition-all">
                       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    </button>
                  )}`;

// The replacement ternary
const replacement = `                  {loan.status === 'Active' ? (
                    <button onClick={() => onRelease(loan.id)} title="Release Asset" className="p-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/10 rounded-lg hover:bg-emerald-500 hover:text-white transition-all">
                       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    </button>
                  ) : (
                    <button onClick={() => onPrintReceipt(loan, 'settlement')} title="Reprint Settlement" className="p-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/10 rounded-lg hover:bg-emerald-500 hover:text-white transition-all">
                       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </button>
                  )}`;

// Find and replace
if (content.includes('{loan.status === \'Active\' && (')) {
    console.log('Found target logic. Applying fix...');
    // Replace the specific block
    const newContent = content.replace(/\{\s*loan\.status\s*===\s*'Active'\s*&&\s*\(\s*<button\s*onClick=\{\(\)\s*=>\s*onRelease\(loan\.id\)\}[^]*?<\/button>\s*\)\s*\}/, replacement);
    fs.writeFileSync(path, newContent);
    console.log('Success.');
} else {
    console.log('Target logic not found or already updated.');
}
