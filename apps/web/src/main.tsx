import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { initTelegram } from './lib/telegram';
import './styles/index.css';

initTelegram();

/**
 * `import.meta.env` is replaced at build time, so with the flag unset this
 * whole branch — and the mock module behind it — is dropped from the bundle.
 * It is awaited before the first render because the mock has to own `fetch`
 * and the Telegram bridge before anything asks either of them a question.
 */
async function start(): Promise<void> {
  if (import.meta.env.VITE_MOCK_API === 'true' || import.meta.env.VITE_MOCK_API === '1') {
    const { installMockApi } = await import('./lib/api/mock');
    installMockApi();
  }

  const container = document.getElementById('root');
  if (!container) throw new Error('Missing #root element');

  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

void start();
