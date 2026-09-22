import './styles.css';
import { CONFIG_ELEMENT_ID } from '../constants';
import type { ClientConfig } from '../types';
import { createPalette, type Palette } from './palette';

function readConfig(): ClientConfig | undefined {
  const element = document.getElementById(CONFIG_ELEMENT_ID);
  if (!element?.textContent) return undefined;
  try {
    return JSON.parse(element.textContent) as ClientConfig;
  } catch {
    return undefined;
  }
}

let palette: Palette | undefined;

if (typeof document !== 'undefined') {
  const config = readConfig();
  if (config) palette = createPalette(config);
}

export function onRouteDidUpdate() {
  palette?.hide();
}
