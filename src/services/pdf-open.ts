export type PendingPdfTab = Window | null;

const isBrowser = () => typeof window !== 'undefined';
const isIOSDevice = () => {
  if (!isBrowser()) return false;
  const ua = window.navigator.userAgent || '';
  const platform = window.navigator.platform || '';
  const touchPoints = window.navigator.maxTouchPoints || 0;
  return /iPad|iPhone|iPod/i.test(ua) || (platform === 'MacIntel' && touchPoints > 1);
};

export const openPendingPdfTab = (): PendingPdfTab => {
  if (!isBrowser() || isIOSDevice()) return null;
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

const openBlobAsDataUrl = (blob: Blob, onError: () => void) => {
  try {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl) {
        onError();
        return;
      }
      try {
        window.location.assign(dataUrl);
      } catch {
        onError();
      }
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

  // iOS WebKit may silently ignore blob navigation in some contexts.
  // We try blob URL first, then fallback to a data URL, then an anchor open.
  if (isIOSDevice()) {
    closePendingPdfTab(pendingTab);
    const initialHref = window.location.href;

    try {
      window.location.assign(blobUrl);
    } catch {
      // ignore
    }

    window.setTimeout(() => {
      if (!isBrowser()) return;
      if (document.visibilityState === 'hidden') return;
      if (window.location.href !== initialHref) return;

      openBlobAsDataUrl(blob, () => {
        triggerAnchor({ href: blobUrl, filename, forceDownload: false });
      });
    }, 450);

    setTimeout(() => URL.revokeObjectURL(blobUrl), 120000);
    return;
  }

  if (!opened && pendingTab && !pendingTab.closed) {
    try {
      pendingTab.location.href = blobUrl;
      opened = true;
    } catch {
      // ignore
    }

    if (!opened) {
      try {
        if (pendingTab.document) {
          pendingTab.document.title = filename;
          pendingTab.document.body.style.margin = '0';
          pendingTab.document.body.innerHTML = '';
          const iframe = pendingTab.document.createElement('iframe');
          iframe.src = blobUrl;
          iframe.style.border = '0';
          iframe.style.width = '100vw';
          iframe.style.height = '100vh';
          pendingTab.document.body.appendChild(iframe);
          opened = true;
        }
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
      // Mobile-safe fallback: open the PDF in the current tab.
      window.location.assign(blobUrl);
      opened = true;
    } catch {
      // ignore
    }
  }

  if (!opened) {
    triggerAnchor({ href: blobUrl, filename, forceDownload: true });
  }

  setTimeout(() => URL.revokeObjectURL(blobUrl), 120000);
};
