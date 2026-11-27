import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { LanguageProvider } from './components/language-provider';
import './index.css';
import './theme.css';
import './buy-rent.css';
import './management.css';
import './home-move.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode><LanguageProvider><App /></LanguageProvider></StrictMode>,
);
