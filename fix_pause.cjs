const fs = require('fs');
const path = require('path');
const gamesDir = path.join(__dirname, 'src', 'games');
const files = fs.readdirSync(gamesDir).filter(f => f.endsWith('.tsx'));

files.forEach(f => {
  const file = path.join(gamesDir, f);
  let code = fs.readFileSync(file, 'utf8');

  // Let's see if we can safely inject a pause skip
  // Look for `if (!isPausedRef.current`
  // Actually, some games use `isPausedRef.current`, some use `isPaused`.
  
  if (code.includes('if (!isPausedRef.current')) {
    // skip
  }
});
