// Registers the service worker built from src/pwa/sw.ts, so the game plays offline once it has loaded. index.html
// holds the manifest link and the tags Safari reads for a home screen app.
export function registerServiceWorker(): void
{
	// A host that forbids workers, such as a sandboxed frame, still gets the game.
	if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
}
