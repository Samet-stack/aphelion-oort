export type PendingPdfTab = Window | null;

export type MobilePdfRequest = {
  blobUrl: string;
  filename: string;
};

const MOBILE_PDF_EVENT = 'siteflow:mobile-pdf-request';

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

let mobilePdfListenerCount = 0;

export const onMobilePdfRequested = (
  handler: (payload: MobilePdfRequest) => void
) => {
  if (!isBrowser()) return () => {};

  const listener = (event: Event) => {
    const custom = event as CustomEvent<MobilePdfRequest>;
    if (!custom.detail) return;
    handler(custom.detail);
  };

  mobilePdfListenerCount += 1;
  window.addEventListener(MOBILE_PDF_EVENT, listener as EventListener);

  return () => {
    window.removeEventListener(MOBILE_PDF_EVENT, listener as EventListener);
    mobilePdfListenerCount = Math.max(0, mobilePdfListenerCount - 1);
  };
};

export const revokePdfUrl = (blobUrl?: string | null) => {
  if (!blobUrl) return;
  try {
    URL.revokeObjectURL(blobUrl);
  } catch {
    // ignore
  }
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

const emitMobilePdfRequest = (payload: MobilePdfRequest) => {
  if (!isBrowser()) return;
  const event = new CustomEvent<MobilePdfRequest>(MOBILE_PDF_EVENT, { detail: payload });
  window.dispatchEvent(event);
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

  // Mobile: render a dedicated in-app PDF page. This avoids popup/PWA limitations.
  if (isMobileDevice()) {
    closePendingPdfTab(pendingTab);

    if (mobilePdfListenerCount > 0) {
      emitMobilePdfRequest({ blobUrl, filename });
      // Safety cleanup in case the mobile viewer is never closed.
      setTimeout(() => revokePdfUrl(blobUrl), 3600000);
      return;
    }

    // Last fallback when no in-app listener is mounted.
    try {
      window.location.assign(blobUrl);
      opened = true;
    } catch {
      // ignore
    }

    if (!opened) {
      triggerDownloadAnchor(blobUrl, filename);
    }

    setTimeout(() => revokePdfUrl(blobUrl), revokeDelayMs);
    return;
  }

  // Desktop
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

  setTimeout(() => revokePdfUrl(blobUrl), revokeDelayMs);
};
