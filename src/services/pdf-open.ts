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
  // Mobile: don't pre-open a tab – new tabs stay in the background on
  // mobile browsers so the user never sees the PDF. We navigate the
  // current window instead (see presentPdfBlob).
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

const triggerAnchor = ({
  href,
  filename,
  forceDownload,
}: {
  href: string;
  filename: string;
  forceDownload: boolean;
}) => {
  const a = document.createElement('a');
  a.href = href;
  a.rel = 'noopener';
  if (forceDownload) {
    a.download = filename;
  } else {
    a.target = '_blank';
  }
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

const openBlobAsDataUrl = (
  blob: Blob,
  onSuccess: (dataUrl: string) => void,
  onError: () => void
) => {
  try {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl) {
        onError();
        return;
      }
      onSuccess(dataUrl);
    };
    reader.onerror = onError;
    reader.readAsDataURL(blob);
  } catch {
    onError();
  }
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
  // MOBILE (iOS + Android + others)
  // On mobile browsers, window.open tabs stay in the background and
  // the user never gets redirected to the PDF. Instead we navigate
  // the current window directly. The user can tap "back" to return.
  // ---------------------------------------------------------------
  if (isMobileDevice()) {
    // Close any pre-opened tab that might have slipped through.
    closePendingPdfTab(pendingTab);

    try {
      window.location.assign(blobUrl);
    } catch {
      // ignore
    }

    // iOS WebKit sometimes silently ignores blob URL navigation for PDFs.
    // Fallback: convert to a data URL and try again after a short delay.
    if (isIOSDevice()) {
      window.setTimeout(() => {
        if (!isBrowser()) return;
        openBlobAsDataUrl(
          blob,
          (dataUrl) => {
            try {
              window.location.assign(dataUrl);
            } catch {
              triggerAnchor({ href: blobUrl, filename, forceDownload: false });
            }
          },
          () => {
            triggerAnchor({ href: blobUrl, filename, forceDownload: false });
          }
        );
      }, 450);
    }

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
    triggerAnchor({ href: blobUrl, filename, forceDownload: true });
  }

  setTimeout(() => URL.revokeObjectURL(blobUrl), revokeDelayMs);
};
