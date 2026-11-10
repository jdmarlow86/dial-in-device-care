# Dial-In Device Care

A responsive, browser-based device maintenance assistant. The first release focuses on local file analysis and works across desktop and mobile browsers.

## MVP features
- Responsive dashboard for desktop, tablet, and mobile.
- Storage analysis for user-selected files and folders.
- Large-file identification and sorting.
- Exact duplicate detection using SHA-256 fingerprints.
- CSV report export.
- Installable Progressive Web App shell with basic offline caching.
- Local-only analysis; selected file contents are not uploaded.

## Browser capabilities and limitations
- Folder selection uses the File System Access API where supported, notably Chromium-based desktop browsers on HTTPS or localhost.
- Other browsers fall back to user-selected files through the standard file picker.
- Standard file inputs are read-only and do not grant permission to delete or modify original files.
- Folder access is requested in read-only mode. This MVP does not delete files.
- This MVP does not scan the entire device, clear operating-system caches, manage startup apps, inspect other apps' private storage, or claim to improve CPU performance.
- Mobile browsers have stricter file-system access than desktop browsers. iOS support is especially limited.
- Duplicate scanning reads candidate files into browser memory to compute hashes. Large selections can consume substantial memory; start with a modest selection.

## Privacy
All analysis happens locally in the browser. There is no account, analytics service, backend, or file upload in this MVP. File names, file contents, and scan results are not transmitted to Dial-In Consulting. The interface uses system fonts and does not require third-party font or analytics requests.

## Run locally
Serve the repository over localhost (for example, with VS Code Live Server or `python -m http.server`). HTTPS or localhost is required for secure browser APIs and service workers.

## Deploy
Enable GitHub Pages for this repository using the `main` branch and root folder. The app URL will be:

https://jdmarlow86.github.io/dial-in-device-care/

## Planned improvements
- Memory-efficient duplicate hashing for large files.
- File-type and folder-category breakdowns.
- Better browser and platform capability detection.
- Optional user-approved deletion for supported directory handles, with explicit confirmation.
- More detailed downloadable reports.
- Accessibility and cross-browser testing.

## Safety approach
Device Care is an analyzer and decision aid, not an aggressive one-click cleaner. It must never delete files automatically or label files as safe to remove solely because they are large, old, or duplicated.
