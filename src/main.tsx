import '@fontsource/montserrat/600.css';
import '@fontsource/montserrat/800.css';
import './config/tokens.css';
import './config/wireframe.css';
import './config/global.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { Catalog } from './dev/Catalog';

document.documentElement.dataset.phase = 'wireframe';

const root = document.getElementById('root');
if (!root) throw new Error('#root no encontrado');

const isCatalog = import.meta.env.DEV && window.location.pathname === '/dev/components';

createRoot(root).render(<StrictMode>{isCatalog ? <Catalog /> : <App />}</StrictMode>);
