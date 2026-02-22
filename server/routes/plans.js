import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, get, run, withTransaction } from '../database.js';
import { authMiddleware } from '../middleware/auth.js';
import { CACHE_TTLS, cacheKeys, getOrSetCache, invalidateUserCache } from '../services/cache.js';
import { logRouteError } from '../services/logger.js';
import { 
  validateCreatePlan, 
  validateUpdatePlan, 
  validateCreatePoint, 
  validateUpdatePoint 
} from '../middleware/validation.js';

const router = express.Router();
const createHttpError = (statusCode, message) => Object.assign(new Error(message), { statusCode });
const bumpSiteActivity = async (executor, siteId, userId) => {
  if (!siteId) return;
  await executor(
    'UPDATE sites SET updated_at = now() WHERE id = ? AND user_id = ?',
    [siteId, userId]
  );
};

// Toutes les routes sont protégées
router.use(authMiddleware);

// Liste des plans de l'utilisateur (sans image_data_url pour la perf)
// Optimise: sans image_data_url, et avec compteurs.
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const { siteId } = req.query;
    const key = cacheKeys.plansList({ userId, siteId });
    const { data, hit } = await getOrSetCache({
      key,
      ttlSeconds: CACHE_TTLS.plansList,
      loader: async () => {
        const params = [userId];
        let where = 'where p.user_id = ?';
        if (siteId) {
          where += ' and p.site_id = ?';
          params.push(siteId);
        }

        const plans = await query(
          `select
             p.id,
             p.user_id,
             p.site_id,
             p.plan_name,
             p.created_at,
             p.updated_at,
             s.site_name,
             s.address,
             (select count(*) from plan_points where plan_id = p.id) as points_count
           from plans p
           join sites s on s.id = p.site_id and s.user_id = p.user_id
           ${where}
           order by p.created_at desc`,
          params
        );

        for (const plan of plans) {
          plan.pointsCount = Number(plan.pointsCount || 0);
        }

        return { success: true, data: { plans } };
      },
    });

    res.set('X-Cache', hit ? 'HIT' : 'MISS');
    res.json(data);
  } catch (error) {
    logRouteError(req, 'Get plans error', error, { statusCode: 500 });
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
    const key = cacheKeys.planDetail({ userId, planId: id });
    const { data, hit } = await getOrSetCache({
      key,
      ttlSeconds: CACHE_TTLS.planDetail,
      loader: async () => {
        const plan = await get(
          `select
             p.id,
             p.user_id,
             p.site_id,
             p.plan_name,
             p.image_data_url,
             p.created_at,
             p.updated_at,
             s.site_name,
             s.address
           from plans p
           join sites s on s.id = p.site_id and s.user_id = p.user_id
           where p.id = ? and p.user_id = ?`,
          [id, userId]
        );

        if (!plan) {
          return { success: false, message: 'Plan non trouvé.', __statusCode: 404 };
        }

        const points = await query(
          'SELECT * FROM plan_points WHERE plan_id = ? ORDER BY point_number ASC',
          [id]
        );
        plan.points = points;
        return { success: true, data: { plan } };
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
    logRouteError(req, 'Get plan error', error, { statusCode: 500, planId: req.params.id });
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
    const { siteId, planName, siteName, address, imageDataUrl } = req.body;

    const id = uuidv4();
    const plan = await withTransaction(async (tx) => {
      // Nouveau flux: ajouter un plan dans un chantier existant
      if (siteId) {
        const site = await tx.get('select id, site_name, address from sites where id = ? and user_id = ?', [
          siteId,
          userId,
        ]);
        if (!site) {
          throw createHttpError(404, 'Chantier non trouvé.');
        }

        await tx.run(
          `insert into plans (id, user_id, site_id, plan_name, site_name, address, image_data_url)
           values (?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            userId,
            siteId,
            planName || 'Plan principal',
            site.siteName,
            site.address || null,
            imageDataUrl,
          ]
        );
        await bumpSiteActivity(tx.run, siteId, userId);
      } else {
        // Legacy: creer chantier + plan en une seule action
        if (!siteName || !imageDataUrl) {
          throw createHttpError(400, 'Nom du chantier et image du plan sont requis.');
        }

        const newSiteId = uuidv4();
        await tx.run(
          `insert into sites (id, user_id, site_name, address)
           values (?, ?, ?, ?)`,
          [newSiteId, userId, siteName, address || null]
        );

        await tx.run(
          `insert into plans (id, user_id, site_id, plan_name, site_name, address, image_data_url)
           values (?, ?, ?, ?, ?, ?, ?)`,
          [id, userId, newSiteId, planName || 'Plan principal', siteName, address || null, imageDataUrl]
        );
      }

      const createdPlan = await tx.get(
        `select
           p.id,
           p.user_id,
           p.site_id,
           p.plan_name,
           p.image_data_url,
           p.created_at,
           p.updated_at,
           s.site_name,
           s.address
         from plans p
         join sites s on s.id = p.site_id and s.user_id = p.user_id
         where p.id = ? and p.user_id = ?`,
        [id, userId]
      );

      if (!createdPlan) {
        throw new Error('Le plan a été créé mais introuvable après insertion.');
      }

      createdPlan.points = [];
      return createdPlan;
    });

    await invalidateUserCache(userId, ['plans', 'sites', 'reports']);
    res.status(201).json({
      success: true,
      message: 'Plan créé avec succès.',
      data: { plan }
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    }

    logRouteError(req, 'Create plan error', error, { statusCode: 500 });
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
      'SELECT id, site_id FROM plans WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Plan non trouvé.'
      });
    }

    await run('DELETE FROM plans WHERE id = ?', [id]);
    await bumpSiteActivity(run, plan.siteId, userId);
    await invalidateUserCache(userId, ['plans', 'sites', 'reports']);

    res.json({ success: true, message: 'Plan supprimé.' });
  } catch (error) {
    logRouteError(req, 'Delete plan error', error, { statusCode: 500, planId: req.params.id });
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

    const { positionX, positionY, title, description, category, photoDataUrl, dateLabel, room, status } = req.body;

    if (!title || !photoDataUrl || positionX == null || positionY == null) {
      return res.status(400).json({
        success: false,
        message: 'Titre, photo et position sont requis.'
      });
    }

    const pointId = uuidv4();
    const point = await withTransaction(async (tx) => {
      // Verrouille le plan pour serialiser la numerotation des points.
      const plan = await tx.get(
        'SELECT id, site_id FROM plans WHERE id = ? AND user_id = ? FOR UPDATE',
        [planId, userId]
      );
      if (!plan) {
        throw createHttpError(404, 'Plan non trouvé.');
      }

      const maxResult = await tx.get(
        'SELECT COALESCE(MAX(point_number), 0) as max_num FROM plan_points WHERE plan_id = ?',
        [planId]
      );
      const pointNumber = Number(maxResult.maxNum || 0) + 1;

      await tx.run(
        `INSERT INTO plan_points (id, plan_id, user_id, position_x, position_y, title, description,
          category, photo_data_url, date_label, room, status, point_number)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [pointId, planId, userId, positionX, positionY, title, description || null,
         category || 'autre', photoDataUrl, dateLabel, room || null, status || 'a_faire', pointNumber]
      );
      await bumpSiteActivity(tx.run, plan.siteId, userId);

      return tx.get('SELECT * FROM plan_points WHERE id = ?', [pointId]);
    });

    await invalidateUserCache(userId, ['plans', 'sites', 'reports']);
    res.status(201).json({
      success: true,
      message: 'Point ajouté.',
      data: { point }
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    }

    logRouteError(req, 'Create point error', error, { statusCode: 500, planId: req.params.id });
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
      `SELECT pp.id, p.site_id
       FROM plan_points pp
       JOIN plans p ON p.id = pp.plan_id
       WHERE pp.id = ? AND pp.plan_id = ? AND pp.user_id = ? AND p.user_id = ?`,
      [pointId, planId, userId, userId]
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
    await bumpSiteActivity(run, point.siteId, userId);

    const updated = await get('SELECT * FROM plan_points WHERE id = ?', [pointId]);
    await invalidateUserCache(userId, ['plans', 'sites', 'reports']);

    res.json({
      success: true,
      message: 'Point mis à jour.',
      data: { point: updated }
    });
  } catch (error) {
    logRouteError(req, 'Update point error', error, {
      statusCode: 500,
      planId: req.params.id,
      pointId: req.params.pointId,
    });
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
      `SELECT pp.id, p.site_id
       FROM plan_points pp
       JOIN plans p ON p.id = pp.plan_id
       WHERE pp.id = ? AND pp.plan_id = ? AND pp.user_id = ? AND p.user_id = ?`,
      [pointId, planId, userId, userId]
    );
    if (!point) {
      return res.status(404).json({
        success: false,
        message: 'Point non trouvé.'
      });
    }

    await run('DELETE FROM plan_points WHERE id = ?', [pointId]);
    await bumpSiteActivity(run, point.siteId, userId);
    await invalidateUserCache(userId, ['plans', 'sites', 'reports']);

    res.json({ success: true, message: 'Point supprimé.' });
  } catch (error) {
    logRouteError(req, 'Delete point error', error, {
      statusCode: 500,
      planId: req.params.id,
      pointId: req.params.pointId,
    });
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression.'
    });
  }
});

export default router;
