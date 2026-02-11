import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, get, run, withTransaction } from '../database.js';
import { authMiddleware } from '../middleware/auth.js';
import { validateCreateReport } from '../middleware/validation.js';
import { CACHE_TTLS, cacheKeys, getOrSetCache, invalidateUserCache } from '../services/cache.js';
import { logRouteError } from '../services/logger.js';

const router = express.Router();
const createHttpError = (statusCode, message) => Object.assign(new Error(message), { statusCode });

// Toutes les routes sont protégées
router.use(authMiddleware);

// Get all reports for current user
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 50, offset = 0, mode = 'summary' } = req.query;
    const parsedLimit = Number.parseInt(String(limit), 10);
    const parsedOffset = Number.parseInt(String(offset), 10);
    const limitNum = Number.isFinite(parsedLimit) ? Math.min(100, Math.max(1, parsedLimit)) : 50;
    const offsetNum = Number.isFinite(parsedOffset) ? Math.max(0, parsedOffset) : 0;
    const isFull = mode === 'full';
    const key = cacheKeys.reportsList({
      userId,
      mode: isFull ? 'full' : 'summary',
      limit: limitNum,
      offset: offsetNum,
    });

    const { data, hit } = await getOrSetCache({
      key,
      ttlSeconds: CACHE_TTLS.reportsList,
      loader: async () => {
        // Default to "summary" to keep mobile fast:
        // - no base64 images
        // - no extra_works rows (only aggregates)
        if (!isFull) {
          const reports = await query(
            `SELECT
              r.id,
              r.report_id,
              r.created_at,
              r.date_label,
              r.address,
              r.site_name,
              r.operator_name,
              r.client_name,
              r.priority,
              r.category,
              r.integrity_hash,
              COUNT(e.id) as extra_works_count,
              COALESCE(SUM(e.estimated_cost), 0) as extra_works_total
            FROM reports r
            LEFT JOIN extra_works e ON e.report_id = r.id
            WHERE r.user_id = ?
            GROUP BY r.id
            ORDER BY r.created_at DESC
            LIMIT ? OFFSET ?`,
            [userId, limitNum, offsetNum]
          );

          const sanitized = reports.map((r) => ({
            ...r,
            // Keep a stable client shape; full report can be fetched by id on demand.
            coordinates: '',
            accuracy: null,
            locationSource: 'unavailable',
            description: '',
            imageDataUrl: '',
            clientSignature: '',
            extraWorks: [],
            extraWorksCount: Number(r.extraWorksCount || 0),
            extraWorksTotal: Number(r.extraWorksTotal || 0),
          }));

          return {
            success: true,
            data: { reports: sanitized, mode: 'summary' }
          };
        }

        const reports = await query(
          `SELECT * FROM reports
           WHERE user_id = ?
           ORDER BY created_at DESC
           LIMIT ? OFFSET ?`,
          [userId, limitNum, offsetNum]
        );

        // Optimisé: récupérer tous les extra_works en une requête (évite N+1)
        if (reports.length > 0) {
          const reportIds = reports.map((r) => r.id);
          const placeholders = reportIds.map(() => '?').join(',');
          const allExtraWorks = await query(
            `SELECT * FROM extra_works WHERE report_id IN (${placeholders})`,
            reportIds
          );
          
          // Grouper les extra_works par report_id
          const extraWorksByReport = allExtraWorks.reduce((acc, work) => {
            if (!acc[work.reportId]) acc[work.reportId] = [];
            acc[work.reportId].push(work);
            return acc;
          }, {});
          
          // Attacher les extra_works à chaque rapport
          for (const report of reports) {
            report.extraWorks = extraWorksByReport[report.id] || [];
          }
        }
        
        return {
          success: true,
          data: { reports, mode: 'full' }
        };
      },
    });

    res.set('X-Cache', hit ? 'HIT' : 'MISS');
    res.json(data);
    
  } catch (error) {
    logRouteError(req, 'Get reports error', error, { statusCode: 500 });
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
    const key = cacheKeys.reportDetail({ userId, reportId: id });
    const { data, hit } = await getOrSetCache({
      key,
      ttlSeconds: CACHE_TTLS.reportDetail,
      loader: async () => {
        const report = await get(
          'SELECT * FROM reports WHERE id = ? AND user_id = ?',
          [id, userId]
        );
        
        if (!report) {
          return { success: false, message: 'Rapport non trouvé.', __statusCode: 404 };
        }
        
        // Récupérer les travaux supplémentaires
        const extraWorks = await query(
          'SELECT * FROM extra_works WHERE report_id = ?',
          [id]
        );
        report.extraWorks = extraWorks;
        
        return {
          success: true,
          data: { report }
        };
      },
    });

    if (data.__statusCode) {
      return res.status(data.__statusCode).json({
        success: false,
        message: data.message,
      });
    }

    res.set('X-Cache', hit ? 'HIT' : 'MISS');
    res.json(data);
    
  } catch (error) {
    logRouteError(req, 'Get report error', error, { statusCode: 500, reportId: req.params.id });
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du rapport.'
    });
  }
});

// Create report
router.post('/', validateCreateReport, async (req, res) => {
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
      extraWorks = [],
      planId,
      planPointId
    } = req.body;
    
    const id = uuidv4();
    const report = await withTransaction(async (tx) => {
      // Derive site_id when the report is linked to a plan.
      // This keeps the DB consistent even if siteName is edited client-side.
      let siteId = null;
      if (planId) {
        const plan = await tx.get('select id, site_id from plans where id = ? and user_id = ?', [planId, userId]);
        if (!plan) {
          throw createHttpError(404, 'Plan non trouvé.');
        }
        siteId = plan.siteId || null;
      }

      if (planPointId) {
        const point = await tx.get(
          'select id, plan_id from plan_points where id = ? and user_id = ?',
          [planPointId, userId]
        );
        if (!point) {
          throw createHttpError(404, 'Point du plan non trouvé.');
        }
        if (planId && point.planId !== planId) {
          throw createHttpError(400, 'Le point sélectionné ne correspond pas au plan choisi.');
        }
      }
      
      await tx.run(
        `INSERT INTO reports (
          id, user_id, report_id, date_label, address, coordinates, accuracy,
          location_source, description, image_data_url, site_name, operator_name,
          client_name, priority, category, integrity_hash, client_signature,
          site_id, plan_id, plan_point_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, userId, reportId, dateLabel, address, coordinates, accuracy,
          locationSource, description, imageDataUrl, siteName, operatorName,
          clientName, priority, category, integrityHash, clientSignature,
          siteId, planId || null, planPointId || null
        ]
      );
      
      // Insérer les travaux supplémentaires
      for (const work of extraWorks) {
        await tx.run(
          `INSERT INTO extra_works (id, report_id, user_id, description, estimated_cost, urgency, category)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [uuidv4(), id, userId, work.description, work.estimatedCost, work.urgency, work.category]
        );
      }
      
      // Récupérer le rapport créé
      const createdReport = await tx.get('SELECT * FROM reports WHERE id = ?', [id]);
      createdReport.extraWorks = await tx.query('SELECT * FROM extra_works WHERE report_id = ?', [id]);
      return createdReport;
    });

    await invalidateUserCache(userId, ['reports']);
    
    res.status(201).json({
      success: true,
      message: 'Rapport créé avec succès.',
      data: { report }
    });
    
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    }

    logRouteError(req, 'Create report error', error, { statusCode: 500 });
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
    await invalidateUserCache(userId, ['reports']);
    
    res.json({
      success: true,
      message: 'Rapport supprimé.'
    });
    
  } catch (error) {
    logRouteError(req, 'Delete report error', error, { statusCode: 500, reportId: req.params.id });
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

    const key = cacheKeys.reportStats({ userId });
    const { data, hit } = await getOrSetCache({
      key,
      ttlSeconds: CACHE_TTLS.reportStats,
      loader: async () => {
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
        
        return {
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
        };
      },
    });

    res.set('X-Cache', hit ? 'HIT' : 'MISS');
    res.json(data);
    
  } catch (error) {
    logRouteError(req, 'Stats error', error, { statusCode: 500 });
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques.'
    });
  }
});

export default router;
