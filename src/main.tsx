import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import { installGameFeelRuntime } from './lib/gameFeelRuntime';
import { installGameClarityRuntime } from './lib/gameClarityRuntime';
import { installArcadeCohesionRuntime } from './lib/arcadeCohesionRuntime';
import { installP22PromotionRuntime } from './lib/p22PromotionRuntime';
import { installMobileRuntimeCompatibility } from './lib/mobileRuntime';
import './index.css';
import './p17-game-feel.css';
import './p18-clarity-accessibility.css';
import './p19-arcade-cohesion.css';
import './p22-mid-a-promotion.css';

installMobileRuntimeCompatibility();
installGameFeelRuntime();
installGameClarityRuntime();
installArcadeCohesionRuntime();
installP22PromotionRuntime();

window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  window.location.reload();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
