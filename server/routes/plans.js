import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, get, run } from '../database.js';
import { authMiddleware } from '../middleware/auth.js';
import { 
  validateCreatePlan, 
  validateUpdatePlan, 
  validateCreatePoint, 
  validateUpdatePoint 
} from '../middleware/validation.js';

const router = express.Router();

// Toutes les routes sont protégées
router.use(authMiddleware);

// Liste des plans de l'utilisateur (sans image_data_url pour la perf)
// Optimisé: utilise une sous-requête pour compter les points (évite N+1)
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const plans = await query(
      `SELECT 
         p.id, p.user_id, p.site_name, p.address, p.created_at, p.updated_at,
         (SELECT COUNT(*) FROM plan_points WHERE plan_id = p.id) as points_count
       FROM plans p 
       WHERE p.user_id = ?
       ORDER BY p.created_at DESC`,
      [userId]
    );

    // Mapper points_count vers pointsCount pour camelCase
    for (const plan of plans) {
      plan.pointsCount = Number(plan.points_count || 0);
      delete plan.points_count;
    }

    res.json({ success: true, data: { plans } });
  } catch (error) {
    console.error('Get plans error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des plans.'
    });
  }
});

// Récupérer un plan avec tous ses points
router.get('/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const plan = await get(
      'SELECT * FROM plans WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Plan non trouvé.'
      });
    }

    const points = await query(
      'SELECT * FROM plan_points WHERE plan_id = ? ORDER BY point_number ASC',
      [id]
    );
    plan.points = points;

    res.json({ success: true, data: { plan } });
  } catch (error) {
    console.error('Get plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du plan.'
    });
  }
});

// Créer un nouveau plan
router.post('/', validateCreatePlan, async (req, res) => {
  try {
    const userId = req.user.id;
    const { siteName, address, imageDataUrl } = req.body;

    if (!siteName || !imageDataUrl) {
      return res.status(400).json({
        success: false,
        message: 'Nom du chantier et image du plan sont requis.'
      });
    }

    const id = uuidv4();
    await run(
      `INSERT INTO plans (id, user_id, site_name, address, image_data_url)
       VALUES (?, ?, ?, ?, ?)`,
      [id, userId, siteName, address || null, imageDataUrl]
    );

    const plan = await get('SELECT * FROM plans WHERE id = ?', [id]);
    plan.points = [];

    res.status(201).json({
      success: true,
      message: 'Plan créé avec succès.',
      data: { plan }
    });
  } catch (error) {
    console.error('Create plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du plan.'
    });
  }
});

// Supprimer un plan (cascade vers plan_points)
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const plan = await get(
      'SELECT id FROM plans WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Plan non trouvé.'
      });
    }

    await run('DELETE FROM plans WHERE id = ?', [id]);

    res.json({ success: true, message: 'Plan supprimé.' });
  } catch (error) {
    console.error('Delete plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression.'
    });
  }
});

// Ajouter un point sur un plan
router.post('/:id/points', validateCreatePoint, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id: planId } = req.params;

    const plan = await get(
      'SELECT id FROM plans WHERE id = ? AND user_id = ?',
      [planId, userId]
    );
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Plan non trouvé.'
      });
    }

    const { positionX, positionY, title, description, category, photoDataUrl, dateLabel, room, status } = req.body;

    if (!title || !photoDataUrl || positionX == null || positionY == null) {
      return res.status(400).json({
        success: false,
        message: 'Titre, photo et position sont requis.'
      });
    }

    // Calculer le prochain numéro de point
    const maxResult = await get(
      'SELECT COALESCE(MAX(point_number), 0) as max_num FROM plan_points WHERE plan_id = ?',
      [planId]
    );
    const pointNumber = Number(maxResult.maxNum || 0) + 1;

    const pointId = uuidv4();
    await run(
      `INSERT INTO plan_points (id, plan_id, user_id, position_x, position_y, title, description,
        category, photo_data_url, date_label, room, status, point_number)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [pointId, planId, userId, positionX, positionY, title, description || null,
       category || 'autre', photoDataUrl, dateLabel, room || null, status || 'a_faire', pointNumber]
    );

    const point = await get('SELECT * FROM plan_points WHERE id = ?', [pointId]);

    res.status(201).json({
      success: true,
      message: 'Point ajouté.',
      data: { point }
    });
  } catch (error) {
    console.error('Create point error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du point.'
    });
  }
});

// Modifier un point
router.put('/:id/points/:pointId', validateUpdatePoint, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id: planId, pointId } = req.params;

    const point = await get(
      'SELECT id FROM plan_points WHERE id = ? AND plan_id = ? AND user_id = ?',
      [pointId, planId, userId]
    );
    if (!point) {
      return res.status(404).json({
        success: false,
        message: 'Point non trouvé.'
      });
    }

    const { title, description, category, photoDataUrl, dateLabel, room, status } = req.body;

    await run(
      `UPDATE plan_points SET
        title = COALESCE(?, title),
        description = COALESCE(?, description),
        category = COALESCE(?, category),
        photo_data_url = COALESCE(?, photo_data_url),
        date_label = COALESCE(?, date_label),
        room = COALESCE(?, room),
        status = COALESCE(?, status)
       WHERE id = ?`,
      [title || null, description, category || null, photoDataUrl || null,
       dateLabel || null, room, status || null, pointId]
    );

    const updated = await get('SELECT * FROM plan_points WHERE id = ?', [pointId]);

    res.json({
      success: true,
      message: 'Point mis à jour.',
      data: { point: updated }
    });
  } catch (error) {
    console.error('Update point error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour.'
    });
  }
});

// Supprimer un point
router.delete('/:id/points/:pointId', async (req, res) => {
  try {
    const userId = req.user.id;
    const { id: planId, pointId } = req.params;

    const point = await get(
      'SELECT id FROM plan_points WHERE id = ? AND plan_id = ? AND user_id = ?',
      [pointId, planId, userId]
    );
    if (!point) {
      return res.status(404).json({
        success: false,
        message: 'Point non trouvé.'
      });
    }

    await run('DELETE FROM plan_points WHERE id = ?', [pointId]);

    res.json({ success: true, message: 'Point supprimé.' });
  } catch (error) {
    console.error('Delete point error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression.'
    });
  }
});

export default router;
