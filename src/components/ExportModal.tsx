import React, { useState } from 'react';
import { X, Download, FileSpreadsheet, FileText, Calendar } from 'lucide-react';
import { exportApi } from '../services/api';

interface ExportModalProps {
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({ onClose }) => {
  const [format, setFormat] = useState<'csv' | 'excel'>('csv');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleExport = async () => {
    setError('');
    setIsLoading(true);

    try {
      const filters = {
        startDate: startDate || undefined,
        endDate: endDate || undefined
      };

      if (format === 'csv') {
        await exportApi.downloadCSV(filters);
      } else {
        const data = await exportApi.getExcelData(filters);
        // Convertir en CSV pour Excel avec tabulation
        generateExcel(data);
      }

      onClose();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'export');
    } finally {
      setIsLoading(false);
    }
  };

  const generateExcel = (data: any) => {
    // Créer un CSV avec séparateur tab pour Excel
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
      'Description'
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
        report.extraWorksCount,
        report.totalExtraCost,
        (report.description || '').substring(0, 100).replace(/\n/g, ' ')
      ];
      rows.push(row.join('\t'));
    }

    const csv = rows.join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'application/vnd.ms-excel' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rapports_${new Date().toISOString().split('T')[0]}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 50,
      padding: '1rem'
    }}>
      <div className="card" style={{ width: '100%', maxWidth: '28rem', padding: '1.5rem', borderRadius: '1rem', background: '#111827', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem', background: 'rgba(255, 183, 3, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Download size={20} color="#ffb703" />
            </div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold' }}>Exporter les rapports</h3>
          </div>
          <button
            onClick={onClose}
            className="link-btn"
            style={{ padding: '0.5rem', borderRadius: '0.5rem' }}
          >
            <X size={20} />
          </button>
        </div>

        {error && (
          <div style={{ marginBottom: '1rem', padding: '0.75rem', borderRadius: '0.5rem', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.5)', color: '#f87171', fontSize: '0.875rem' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'grid', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
              Format d'export
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setFormat('csv')}
                style={{
                  padding: '1rem',
                  borderRadius: '0.5rem',
                  border: format === 'csv' ? '1px solid #ffb703' : '1px solid rgba(255, 255, 255, 0.1)',
                  background: format === 'csv' ? 'rgba(255, 183, 3, 0.1)' : 'transparent',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <FileText size={24} style={{ margin: '0 auto 0.5rem', display: 'block' }} />
                <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>CSV</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Compatible Excel</div>
              </button>
              <button
                type="button"
                onClick={() => setFormat('excel')}
                style={{
                  padding: '1rem',
                  borderRadius: '0.5rem',
                  border: format === 'excel' ? '1px solid #ffb703' : '1px solid rgba(255, 255, 255, 0.1)',
                  background: format === 'excel' ? 'rgba(255, 183, 3, 0.1)' : 'transparent',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <FileSpreadsheet size={24} style={{ margin: '0 auto 0.5rem', display: 'block' }} />
                <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>Excel</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Format .xls</div>
              </button>
            </div>
          </div>

          <div>
            <label style={{ display: 'flex', fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem', alignItems: 'center' }}>
              <Calendar size={14} style={{ marginRight: '0.25rem' }} />
              Période (optionnel)
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Du</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="input"
                  style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Au</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="input"
                  style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem' }}
                />
              </div>
            </div>
          </div>

          <button
            onClick={handleExport}
            disabled={isLoading}
            className="btn btn--primary"
            style={{ width: '100%', padding: '0.75rem' }}
          >
            {isLoading ? (
              'Export en cours...'
            ) : (
              <>
                <Download size={18} />
                Télécharger l'export
              </>
            )}
          </button>
        </div>

        <p style={{ marginTop: '1rem', fontSize: '0.75rem', color: 'var(--color-text-secondary)', textAlign: 'center' }}>
          L'export contient tous vos rapports avec leurs travaux supplémentaires.
        </p>
      </div>
    </div>
  );
};
