import express from 'express';
import { query } from '../database.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

router.use(authMiddleware);

// Export CSV
router.get('/csv', async (req, res) => {
  try {
    const userId = req.user.id;
    const { startDate, endDate } = req.query;
    
    let dateFilter = '';
    const params = [userId];
    
    if (startDate && endDate) {
      dateFilter = 'AND r.created_at BETWEEN ? AND ?';
      params.push(startDate, endDate + ' 23:59:59');
    }
    
    // Récupérer tous les rapports avec leurs TS
    const reports = await query(
      `SELECT 
        r.report_id, r.created_at, r.site_name, r.client_name, r.address, 
        r.coordinates, r.priority, r.category, r.description,
        COALESCE(SUM(ew.estimated_cost), 0) as total_extra_cost,
        COUNT(ew.id) as extra_works_count
       FROM reports r
       LEFT JOIN extra_works ew ON r.id = ew.report_id
       WHERE r.user_id = ? ${dateFilter}
       GROUP BY r.id
       ORDER BY r.created_at DESC`,
      params
    );
    
    // Générer CSV
    const headers = [
      'ID Rapport',
      'Date',
      'Chantier',
      'Client',
      'Adresse',
      'Coordonnées',
      'Priorité',
      'Catégorie',
      'Nb Travaux Supp.',
      'Montant TS (€)',
      'Description'
    ];
    
    const csvRows = [headers.join(';')];
    
    for (const r of reports) {
      const row = [
        r.reportId,
        new Date(r.createdAt).toLocaleDateString('fr-FR'),
        r.siteName || '',
        r.clientName || '',
        r.address || '',
        r.coordinates || '',
        r.priority || '',
        r.category || '',
        Number(r.extraWorksCount || 0),
        Number(r.totalExtraCost || 0),
        (r.description || '').replace(/\n/g, ' ').replace(/;/g, ',')
      ];
      csvRows.push(row.map(cell => `"${cell}"`).join(';'));
    }
    
    const csv = csvRows.join('\n');
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="rapports_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send('\uFEFF' + csv); // BOM pour Excel
    
  } catch (error) {
    console.error('Export CSV error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'export CSV.'
    });
  }
});

// Export Excel (JSON + métadonnées pour le frontend)
router.get('/excel', async (req, res) => {
  try {
    const userId = req.user.id;
    const { startDate, endDate } = req.query;
    
    let dateFilter = '';
    const params = [userId];
    
    if (startDate && endDate) {
      dateFilter = 'AND r.created_at BETWEEN ? AND ?';
      params.push(startDate, endDate + ' 23:59:59');
    }
    
    // Données principales
    const reports = await query(
      `SELECT 
        r.*,
        COALESCE(SUM(ew.estimated_cost), 0) as total_extra_cost,
        COUNT(ew.id) as extra_works_count
       FROM reports r
       LEFT JOIN extra_works ew ON r.id = ew.report_id
       WHERE r.user_id = ? ${dateFilter}
       GROUP BY r.id
       ORDER BY r.created_at DESC`,
      params
    );
    
    // Travaux supplémentaires détaillés
    const extraWorks = await query(
      `SELECT 
        ew.*,
        r.report_id as parent_report_id
       FROM extra_works ew
       JOIN reports r ON ew.report_id = r.id
       WHERE r.user_id = ? ${dateFilter.replace(/r\.created_at/g, 'ew.created_at')}
       ORDER BY ew.created_at DESC`,
      params
    );
    
    // Statistiques
    const stats = await query(
      `SELECT 
        COUNT(*) as total_reports,
        SUM(CASE WHEN category = 'safety' THEN 1 ELSE 0 END) as safety_count,
        SUM(CASE WHEN category = 'progress' THEN 1 ELSE 0 END) as progress_count,
        SUM(CASE WHEN category = 'anomaly' THEN 1 ELSE 0 END) as anomaly_count
       FROM reports
       WHERE user_id = ? ${dateFilter.replace(/r\.created_at/g, 'created_at')}`,
      params
    );
    
    res.json({
      success: true,
      data: {
        reports,
        extraWorks,
        stats: {
          totalReports: Number(stats[0]?.totalReports || 0),
          safetyCount: Number(stats[0]?.safetyCount || 0),
          progressCount: Number(stats[0]?.progressCount || 0),
          anomalyCount: Number(stats[0]?.anomalyCount || 0)
        },
        exportedAt: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Export Excel error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la préparation de l\'export Excel.'
    });
  }
});

// Export détaillé d'un seul rapport (pour PDF avec données complètes)
router.get('/report/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    // Vérifier que l'utilisateur a accès au rapport (propriétaire ou partagé)
    const report = await query(
      `SELECT r.* FROM reports r
       LEFT JOIN shares s ON r.id = s.report_id AND (s.shared_with_id = ? OR s.shared_with_email = ?) AND s.status = 'active'
       WHERE (r.user_id = ? OR s.id IS NOT NULL) AND r.id = ?`,
      [userId, req.user.email, userId, id]
    );
    
    if (!report || report.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Rapport non trouvé.'
      });
    }
    
    const extraWorks = await query(
      'SELECT * FROM extra_works WHERE report_id = ?',
      [id]
    );
    
    res.json({
      success: true,
      data: {
        report: report[0],
        extraWorks
      }
    });
    
  } catch (error) {
    console.error('Export report error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'export du rapport.'
    });
  }
});

export default router;
