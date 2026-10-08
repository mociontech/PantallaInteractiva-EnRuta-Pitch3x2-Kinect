import '@fontsource/montserrat/400.css';
import '@fontsource/montserrat/600.css';
import '@fontsource/montserrat/700.css';
import '@fontsource/montserrat/800.css';
import './config/tokens.css';
import './config/global.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AdminApp } from './admin/AdminApp';
import { App } from './App';
import { Catalog } from './dev/Catalog';
import { TabletApp } from './tablet/TabletApp';


const root = document.getElementById('root');
if (!root) throw new Error('#root no encontrado');

const isCatalog = import.meta.env.DEV && window.location.pathname === '/dev/components';

// Una sola app con tres vistas: la pared (/), la tablet de registro (/registro) y el operador (/admin).
const path = window.location.pathname.replace(/\/+$/, '');
const view = isCatalog ? <Catalog /> : path === '/registro' ? <TabletApp /> : path === '/admin' ? <AdminApp /> : <App />;

createRoot(root).render(<StrictMode>{view}</StrictMode>);
