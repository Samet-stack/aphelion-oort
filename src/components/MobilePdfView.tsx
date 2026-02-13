import React, { useMemo, useState } from 'react';
import { ArrowLeft, Download, ExternalLink, Share2 } from 'lucide-react';

interface MobilePdfViewProps {
  blobUrl: string;
  filename: string;
  onBack: () => void;
}

export const MobilePdfView: React.FC<MobilePdfViewProps> = ({ blobUrl, filename, onBack }) => {
  const [shareError, setShareError] = useState<string | null>(null);

  const shortName = useMemo(() => {
    if (filename.length <= 38) return filename;
    return `${filename.slice(0, 35)}...`;
  }, [filename]);

  const triggerDownload = () => {
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const openInBrowser = () => {
    try {
      const tab = window.open(blobUrl, '_blank', 'noopener,noreferrer');
      if (tab) return;
    } catch {
      // ignore
    }

    try {
      window.location.assign(blobUrl);
    } catch {
      triggerDownload();
    }
  };

  const handleShare = async () => {
    setShareError(null);
    try {
      const response = await fetch(blobUrl);
      const blob = await response.blob();
      const file = new File([blob], filename, { type: 'application/pdf' });

      if (navigator.share) {
        const canShareFile = !navigator.canShare || navigator.canShare({ files: [file] });
        if (canShareFile) {
          try {
            await navigator.share({ files: [file], title: filename });
            return;
          } catch (error) {
            if (error instanceof DOMException && error.name === 'AbortError') {
              return;
            }
          }
        }

        // iOS fallback when file sharing is unavailable.
        try {
          await navigator.share({ title: filename, text: filename });
          return;
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') {
            return;
          }
        }

        triggerDownload();
        return;
      }

      triggerDownload();
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      setShareError('Partage indisponible sur ce téléphone. Utilisez Télécharger.');
    }
  };

  return (
    <div className="mobile-pdf-view">
      <div className="mobile-pdf-view__top">
        <button type="button" className="btn btn--ghost btn--sm" onClick={onBack}>
          <ArrowLeft size={16} /> Retour
        </button>
        <span className="mobile-pdf-view__name">{shortName}</span>
        <div className="mobile-pdf-view__actions">
          <button type="button" className="btn btn--ghost btn--sm" onClick={handleShare}>
            <Share2 size={16} />
          </button>
          <button type="button" className="btn btn--primary btn--sm" onClick={triggerDownload}>
            <Download size={16} />
          </button>
        </div>
      </div>

      {shareError && <p className="mobile-pdf-view__error">{shareError}</p>}

      <div className="mobile-pdf-view__content">
        <iframe
          className="mobile-pdf-view__frame"
          src={blobUrl}
          title={filename}
        />
      </div>

      <div className="mobile-pdf-view__fallback">
        <p>Si le PDF ne s'affiche pas, utilisez un mode externe :</p>
        <div className="mobile-pdf-view__fallback-actions">
          <button type="button" className="btn btn--ghost btn--sm" onClick={openInBrowser}>
            <ExternalLink size={16} /> Ouvrir dans le navigateur
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={triggerDownload}>
            <Download size={16} /> Télécharger
          </button>
        </div>
      </div>
    </div>
  );
};
