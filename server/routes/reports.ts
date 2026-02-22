import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, get, run } from '../database.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Toutes les routes sont protégées
router.use(authMiddleware);

// Get all reports for current user
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 50, offset = 0 } = req.query;

    const reports = await query(
      `SELECT * FROM reports 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT ? OFFSET ?`,
      [userId, parseInt(limit as string), parseInt(offset as string)]
    );

    // Pour chaque rapport, récupérer les travaux supplémentaires
    for (const report of reports) {
      const extraWorks = await query(
        'SELECT * FROM extra_works WHERE report_id = ?',
        [report.id]
      );
      report.extraWorks = extraWorks;
    }

    res.json({
      success: true,
      data: { reports }
    });

  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des rapports.'
    });
  }
});

// Get single report
router.get('/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const report = await get(
      'SELECT * FROM reports WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Rapport non trouvé.'
      });
    }

    // Récupérer les travaux supplémentaires
    const extraWorks = await query(
      'SELECT * FROM extra_works WHERE report_id = ?',
      [id]
    );
    report.extraWorks = extraWorks;

    res.json({
      success: true,
      data: { report }
    });

  } catch (error) {
    console.error('Get report error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du rapport.'
    });
  }
});

// Create report
router.post('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      reportId,
      dateLabel,
      address,
      coordinates,
      accuracy,
      locationSource,
      description,
      imageDataUrl,
      siteName,
      operatorName,
      clientName,
      priority,
      category,
      integrityHash,
      clientSignature,
      extraWorks = []
    } = req.body;

    const id = uuidv4();

    await run(
      `INSERT INTO reports (
        id, user_id, report_id, date_label, address, coordinates, accuracy,
        location_source, description, image_data_url, site_name, operator_name,
        client_name, priority, category, integrity_hash, client_signature
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, userId, reportId, dateLabel, address, coordinates, accuracy,
        locationSource, description, imageDataUrl, siteName, operatorName,
        clientName, priority, category, integrityHash, clientSignature
      ]
    );

    // Insérer les travaux supplémentaires
    for (const work of extraWorks) {
      await run(
        `INSERT INTO extra_works (id, report_id, user_id, description, estimated_cost, urgency, category)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [uuidv4(), id, userId, work.description, work.estimatedCost, work.urgency, work.category]
      );
    }

    // Récupérer le rapport créé
    const report = await get('SELECT * FROM reports WHERE id = ?', [id]);
    report.extraWorks = await query('SELECT * FROM extra_works WHERE report_id = ?', [id]);

    res.status(201).json({
      success: true,
      message: 'Rapport créé avec succès.',
      data: { report }
    });

  } catch (error) {
    console.error('Create report error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du rapport.'
    });
  }
});

// Delete report
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    // Vérifier que le rapport appartient à l'utilisateur
    const report = await get('SELECT id FROM reports WHERE id = ? AND user_id = ?', [id, userId]);

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Rapport non trouvé.'
      });
    }

    await run('DELETE FROM reports WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Rapport supprimé.'
    });

  } catch (error) {
    console.error('Delete report error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression.'
    });
  }
});

// Get stats for dashboard
router.get('/stats/summary', async (req, res) => {
  try {
    const userId = req.user.id;

    const totalReports = await get(
      'SELECT COUNT(*) as count FROM reports WHERE user_id = ?',
      [userId]
    );

    const totalExtraWorks = await get(
      'SELECT COUNT(*) as count FROM extra_works WHERE user_id = ?',
      [userId]
    );

    const totalValue = await get(
      'SELECT SUM(estimated_cost) as total FROM extra_works WHERE user_id = ?',
      [userId]
    );

    const byCategory = await query(
      `SELECT category, COUNT(*) as count 
       FROM reports 
       WHERE user_id = ? AND category IS NOT NULL
       GROUP BY category`,
      [userId]
    );

    res.json({
      success: true,
      data: {
        totalReports: Number(totalReports.count || 0),
        totalExtraWorks: Number(totalExtraWorks.count || 0),
        totalExtraValue: Number(totalValue.total || 0),
        byCategory: byCategory.map((item) => ({
          ...item,
          count: Number(item.count || 0)
        }))
      }
    });

  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques.'
    });
  }
});

export default router;
