import {createRoot} from 'react-dom/client';
import App from '../App';
import {colors, uiAppearance} from '../src/ui/tokens';
import './styles.css';
document.documentElement.style.colorScheme = uiAppearance;
document.documentElement.style.setProperty('--ui-background', colors.background);
document.documentElement.style.setProperty('--ui-focus', colors.secondaryForeground);
createRoot(document.getElementById('root')!).render(<App/>);
