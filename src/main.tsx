import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { arrancarPWA } from './app/pwa';
import './app/fuentes';
import './app/estilos.css';

createRoot(document.getElementById('raiz')!).render(<App />);
arrancarPWA();
