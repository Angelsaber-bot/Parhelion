/** Non-destructive translation layer for the existing homepage; no asset or layout replacement. */
import { createLanguageToggle, localizeDom, onLanguageChange } from '../shared-client/i18n';
const nav = document.querySelector<HTMLElement>('.topbar-links') ?? document.querySelector<HTMLElement>('nav') ?? document.body;
createLanguageToggle(nav);
function refresh() {
  localizeDom(document);
  // The source DOM, images, CSS, links and input state remain owned by the installed site.
}
refresh(); onLanguageChange(refresh);
