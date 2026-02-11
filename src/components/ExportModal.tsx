import React, { useEffect, useId, useState } from 'react';
import { X, Download, FileSpreadsheet, FileText, Calendar } from 'lucide-react';
import { exportApi } from '../services/api';
import { Button, SurfaceCard } from './ui';

interface ExportModalProps {
  onClose: () => void;
}

interface ExportRow {
  reportId: string;
  createdAt: string;
  siteName?: string;
  clientName?: string;
  address?: string;
  priority?: string;
  category?: string;
  extraWorksCount?: number;
  totalExtraCost?: number;
  description?: string;
}

interface ExcelExportData {
  reports: ExportRow[];
}

export const ExportModal: React.FC<ExportModalProps> = ({ onClose }) => {
  const [format, setFormat] = useState<'csv' | 'excel'>('csv');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const generateExcel = (data: ExcelExportData) => {
    const headers = [
      'ID Rapport',
      'Date',
      'Chantier',
      'Client',
      'Adresse',
      'Priorité',
      'Catégorie',
      'Nb TS',
      'Montant TS',
      'Description',
    ];

    const rows = [headers.join('\t')];

    for (const report of data.reports) {
      const row = [
        report.reportId,
        new Date(report.createdAt).toLocaleDateString('fr-FR'),
        report.siteName || '',
        report.clientName || '',
        report.address || '',
        report.priority || '',
        report.category || '',
        report.extraWorksCount ?? 0,
        report.totalExtraCost ?? 0,
        (report.description || '').substring(0, 100).replace(/\n/g, ' '),
      ];
      rows.push(row.join('\t'));
    }

    const content = rows.join('\n');
    const blob = new Blob([`\uFEFF${content}`], { type: 'application/vnd.ms-excel' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rapports_${new Date().toISOString().split('T')[0]}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const handleExport = async () => {
    setError('');
    setIsLoading(true);
    try {
      const filters = {
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      };
      if (format === 'csv') {
        await exportApi.downloadCSV(filters);
      } else {
        const data = (await exportApi.getExcelData(filters)) as ExcelExportData;
        generateExcel(data);
      }
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur lors de l'export";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId}>
      <SurfaceCard className="modal-card" style={{ maxWidth: '28rem' }}>
        <div className="modal-header">
          <div className="modal-header__left">
            <div className="modal-header__icon">
              <Download size={20} color="#ffb703" />
            </div>
            <div>
              <h3 className="modal-header__title" id={titleId}>
                Exporter les rapports
              </h3>
              <p className="modal-header__subtitle" id={descriptionId}>
                Choisissez le format et la période souhaités.
              </p>
            </div>
          </div>
          <Button onClick={onClose} variant="ghost" size="sm" aria-label="Fermer la fenêtre d'export">
            <X size={20} />
          </Button>
        </div>

        {error && (
          <div className="auth-alert auth-alert--error" role="alert">
            {error}
          </div>
        )}

        <div className="form-grid">
          <div>
            <label className="form-label">Format d'export</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setFormat('csv')}
                className={`permission-btn pressable ${format === 'csv' ? 'permission-btn--active' : ''}`}
                aria-pressed={format === 'csv'}
              >
                <div className="permission-btn__label">
                  <FileText size={18} />
                  CSV
                </div>
                <div className="permission-btn__hint">Compatible Excel</div>
              </button>
              <button
                type="button"
                onClick={() => setFormat('excel')}
                className={`permission-btn pressable ${format === 'excel' ? 'permission-btn--active' : ''}`}
                aria-pressed={format === 'excel'}
              >
                <div className="permission-btn__label">
                  <FileSpreadsheet size={18} />
                  Excel
                </div>
                <div className="permission-btn__hint">Format .xls</div>
              </button>
            </div>
          </div>

          <div className="form-field">
            <label htmlFor="export-start-date">
              <Calendar size={14} aria-hidden="true" />
              Du
            </label>
            <input
              id="export-start-date"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="input"
            />
          </div>

          <div className="form-field">
            <label htmlFor="export-end-date">
              <Calendar size={14} aria-hidden="true" />
              Au
            </label>
            <input
              id="export-end-date"
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="input"
            />
          </div>

          <Button onClick={handleExport} loading={isLoading} className="form-actions--full" aria-label="Télécharger l'export">
            {isLoading ? (
              'Export en cours...'
            ) : (
              <>
                <Download size={18} />
                Télécharger l'export
              </>
            )}
          </Button>
        </div>

        <p className="modal-footer">L'export contient vos rapports et leurs travaux supplémentaires.</p>
      </SurfaceCard>
    </div>
  );
};
