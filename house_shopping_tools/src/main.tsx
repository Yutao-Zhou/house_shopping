import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { LanguageProvider } from './components/language-provider';
import './index.css';
import './theme.css';
import './buy-rent.css';
import './management.css';
import './home-move.css';
import './annual-housing-cost.css';
import './school-comparison.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode><LanguageProvider><App /></LanguageProvider></StrictMode>,
);
