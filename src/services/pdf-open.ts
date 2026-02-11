export type PendingPdfTab = Window | null;

const isBrowser = () => typeof window !== 'undefined';

const isIOSDevice = () => {
  if (!isBrowser()) return false;
  const ua = window.navigator.userAgent || '';
  const platform = window.navigator.platform || '';
  const touchPoints = window.navigator.maxTouchPoints || 0;
  return /iPad|iPhone|iPod/i.test(ua) || (platform === 'MacIntel' && touchPoints > 1);
};

const isMobileDevice = () => {
  if (!isBrowser()) return false;
  if (isIOSDevice()) return true;
  const ua = window.navigator.userAgent || '';
  return /Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);
};

export const openPendingPdfTab = (): PendingPdfTab => {
  if (!isBrowser()) return null;
  if (isMobileDevice()) return null;
  try {
    const tab = window.open('', '_blank');
    if (tab && tab.document) {
      tab.document.title = 'Generation du PDF...';
      tab.document.body.innerHTML =
        '<p style="font-family:system-ui;padding:20px;">Generation du PDF en cours...</p>';
    }
    return tab;
  } catch {
    return null;
  }
};

export const closePendingPdfTab = (tab?: PendingPdfTab) => {
  if (!tab || tab.closed) return;
  try {
    tab.close();
  } catch {
    // ignore
  }
};

const triggerDownloadAnchor = (href: string, filename: string) => {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

const renderPdfInTab = (tab: Window, src: string, title: string) => {
  if (!tab.document) return false;
  tab.document.title = title;
  tab.document.body.style.margin = '0';
  tab.document.body.innerHTML = '';
  const iframe = tab.document.createElement('iframe');
  iframe.src = src;
  iframe.style.border = '0';
  iframe.style.width = '100vw';
  iframe.style.height = '100vh';
  tab.document.body.appendChild(iframe);
  return true;
};

/**
 * Show the PDF in a fullscreen overlay inside the app.
 * This is the only reliable approach on mobile PWAs (standalone mode)
 * where window.open / window.location.assign / navigator.share all
 * get captured by the PWA scope and redirect back to the app.
 */
const showMobileOverlay = (blob: Blob, blobUrl: string, filename: string) => {
  // Container
  const overlay = document.createElement('div');
  overlay.id = 'pdf-viewer-overlay';
  overlay.style.cssText = [
    'position:fixed',
    'top:0', 'left:0', 'right:0', 'bottom:0',
    'z-index:99999',
    'background:#000',
    'display:flex',
    'flex-direction:column',
  ].join(';');

  // Toolbar
  const toolbar = document.createElement('div');
  toolbar.style.cssText = [
    'display:flex',
    'align-items:center',
    'justify-content:space-between',
    'padding:10px 16px',
    'background:#1a1a1a',
    'flex-shrink:0',
    'gap:8px',
    `padding-top:max(10px, env(safe-area-inset-top))`,
  ].join(';');

  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Fermer';
  closeBtn.style.cssText = [
    'padding:8px 16px',
    'background:#333',
    'color:#fff',
    'border:none',
    'border-radius:8px',
    'font-size:15px',
    'font-weight:600',
    'cursor:pointer',
    '-webkit-tap-highlight-color:transparent',
  ].join(';');
  closeBtn.onclick = () => {
    document.body.removeChild(overlay);
    document.body.style.overflow = '';
  };

  // Filename label
  const label = document.createElement('span');
  label.textContent = filename.length > 28 ? filename.slice(0, 25) + '...' : filename;
  label.style.cssText = 'color:#aaa;font-size:12px;flex:1;text-align:center;overflow:hidden;white-space:nowrap;';

  // Share button (if available)
  const shareBtn = document.createElement('button');
  shareBtn.textContent = 'Partager';
  shareBtn.style.cssText = [
    'padding:8px 16px',
    'background:#ffb703',
    'color:#1a1a1a',
    'border:none',
    'border-radius:8px',
    'font-size:15px',
    'font-weight:600',
    'cursor:pointer',
    '-webkit-tap-highlight-color:transparent',
  ].join(';');
  shareBtn.onclick = async () => {
    try {
      const file = new File([blob], filename, { type: 'application/pdf' });
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file] });
      } else {
        triggerDownloadAnchor(blobUrl, filename);
      }
    } catch {
      triggerDownloadAnchor(blobUrl, filename);
    }
  };

  toolbar.appendChild(closeBtn);
  toolbar.appendChild(label);
  toolbar.appendChild(shareBtn);

  // PDF viewer (iframe)
  const viewer = document.createElement('iframe');
  viewer.src = blobUrl;
  viewer.style.cssText = [
    'flex:1',
    'border:0',
    'width:100%',
    'background:#fff',
  ].join(';');

  overlay.appendChild(toolbar);
  overlay.appendChild(viewer);

  // Prevent background scroll
  document.body.style.overflow = 'hidden';
  document.body.appendChild(overlay);
};

export const presentPdfBlob = ({
  blob,
  filename,
  pendingTab,
}: {
  blob: Blob;
  filename: string;
  pendingTab?: PendingPdfTab;
}) => {
  if (!isBrowser()) return;

  const blobUrl = URL.createObjectURL(blob);
  let opened = false;
  const revokeDelayMs = isMobileDevice() ? 600000 : 120000;

  // ---------------------------------------------------------------
  // MOBILE (PWA-safe)
  // In standalone PWA mode, all external navigation (window.open,
  // location.assign, anchor clicks) gets captured by the PWA scope
  // and bounces the user back. The only reliable approach is to
  // render the PDF inline in a fullscreen overlay.
  // ---------------------------------------------------------------
  if (isMobileDevice()) {
    closePendingPdfTab(pendingTab);
    showMobileOverlay(blob, blobUrl, filename);
    setTimeout(() => URL.revokeObjectURL(blobUrl), revokeDelayMs);
    return;
  }

  // ---------------------------------------------------------------
  // DESKTOP
  // Use the pre-opened tab, or open a new one, or fallback.
  // ---------------------------------------------------------------
  if (!opened && pendingTab && !pendingTab.closed) {
    try {
      pendingTab.location.href = blobUrl;
      opened = true;
    } catch {
      // ignore
    }

    if (!opened) {
      try {
        opened = renderPdfInTab(pendingTab, blobUrl, filename);
      } catch {
        // ignore
      }
    }
  }

  if (!opened) {
    try {
      const tab = window.open(blobUrl, '_blank');
      opened = Boolean(tab);
    } catch {
      // ignore
    }
  }

  if (!opened) {
    try {
      window.location.assign(blobUrl);
      opened = true;
    } catch {
      // ignore
    }
  }

  if (!opened) {
    triggerDownloadAnchor(blobUrl, filename);
  }

  setTimeout(() => URL.revokeObjectURL(blobUrl), revokeDelayMs);
};
