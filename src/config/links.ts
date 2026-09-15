// =========================================================================
// NEUROLOG APP CONFIGURATION
// Change the app version only in package.json. The UI and Tauri installers
// both read that same version, so app/EXE/MSI versions stay synchronized.
// =========================================================================
import packageInfo from '../../package.json';

export const APP_VERSION = packageInfo.version;

// Edit this URL constant to point to your GitHub repository or release page.
export const GITHUB_REPOSITORY_URL = 'https://github.com/shifting-whistler/NeuroLog';
// =========================================================================
