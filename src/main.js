import { GameApp } from './app/GameApp.js';
import { loadTemplates } from './ui/screens.js';

// Static HTML templates are loaded once from this repository-relative path.
// No bundler, runtime npm dependency, or third-party UI framework is needed.
try {
  await loadTemplates();
  new GameApp(document.querySelector('#app'));
} catch (error) {
  console.error('Battle Atelier could not start:', error);
  const root = document.querySelector('#app');
  const message = document.createElement('p');
  message.setAttribute('role', 'alert');
  message.textContent = `Unable to load Battle Atelier: ${error.message}`;
  root.replaceChildren(message);
}
