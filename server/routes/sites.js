import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, get, run } from '../database.js';
import { authMiddleware } from '../middleware/auth.js';
import { validateCreateSite, validateUpdateSite } from '../middleware/validation.js';
import { CACHE_TTLS, cacheKeys, getOrSetCache, invalidateUserCache } from '../services/cache.js';
import { logRouteError } from '../services/logger.js';

const router = express.Router();

// Toutes les routes sont protegees
router.use(authMiddleware);

// Liste des chantiers de l'utilisateur (avec compteurs)
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const key = cacheKeys.sitesList({ userId });
    const { data, hit } = await getOrSetCache({
      key,
      ttlSeconds: CACHE_TTLS.sitesList,
      loader: async () => {
        const sites = await query(
          `select
             s.id,
             s.user_id,
             s.site_name,
             s.address,
             s.created_at,
             s.updated_at,
             count(distinct p.id) as plans_count,
             count(pp.id) as points_count
           from sites s
           left join plans p on p.site_id = s.id
           left join plan_points pp on pp.plan_id = p.id
           where s.user_id = ?
           group by s.id
           order by s.updated_at desc, s.created_at desc`,
          [userId]
        );

        for (const s of sites) {
          s.plansCount = Number(s.plansCount || 0);
          s.pointsCount = Number(s.pointsCount || 0);
        }

        return { success: true, data: { sites } };
      },
    });

    res.set('X-Cache', hit ? 'HIT' : 'MISS');
    res.json(data);
  } catch (error) {
    logRouteError(req, 'Get sites error', error, { statusCode: 500 });
    res.status(500).json({ success: false, message: 'Erreur lors de la récupération des chantiers.' });
  }
});

// Recuperer un chantier + ses plans (liste)
router.get('/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const key = cacheKeys.siteDetail({ userId, siteId: id });
    const { data, hit } = await getOrSetCache({
      key,
      ttlSeconds: CACHE_TTLS.siteDetail,
      loader: async () => {
        const site = await get('select * from sites where id = ? and user_id = ?', [id, userId]);
        if (!site) {
          return { success: false, message: 'Chantier non trouvé.', __statusCode: 404 };
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
           where p.user_id = ? and p.site_id = ?
           order by p.created_at desc`,
          [userId, id]
        );

        for (const p of plans) {
          p.pointsCount = Number(p.pointsCount || 0);
        }

        site.plans = plans;
        return { success: true, data: { site } };
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
    logRouteError(req, 'Get site error', error, { statusCode: 500, siteId: req.params.id });
    res.status(500).json({ success: false, message: 'Erreur lors de la récupération du chantier.' });
  }
});

// Creer un chantier
router.post('/', validateCreateSite, async (req, res) => {
  try {
    const userId = req.user.id;
    const { siteName, address } = req.body;

    const id = uuidv4();
    await run(
      `insert into sites (id, user_id, site_name, address)
       values (?, ?, ?, ?)`,
      [id, userId, siteName, address || null]
    );

    const site = await get('select * from sites where id = ?', [id]);
    site.plansCount = 0;
    site.pointsCount = 0;

    await invalidateUserCache(userId, ['sites', 'plans', 'reports']);

    res.status(201).json({ success: true, message: 'Chantier créé.', data: { site } });
  } catch (error) {
    logRouteError(req, 'Create site error', error, { statusCode: 500 });
    res.status(500).json({ success: false, message: 'Erreur lors de la création du chantier.' });
  }
});

// Mettre a jour un chantier
router.put('/:id', validateUpdateSite, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { siteName, address } = req.body;

    const existing = await get('select id from sites where id = ? and user_id = ?', [id, userId]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Chantier non trouvé.' });
    }

    await run(
      `update sites set
         site_name = coalesce(?, site_name),
         address = coalesce(?, address)
       where id = ?`,
      [siteName || null, address ?? null, id]
    );

    const site = await get('select * from sites where id = ?', [id]);
    await invalidateUserCache(userId, ['sites', 'plans', 'reports']);
    res.json({ success: true, message: 'Chantier mis à jour.', data: { site } });
  } catch (error) {
    logRouteError(req, 'Update site error', error, { statusCode: 500, siteId: req.params.id });
    res.status(500).json({ success: false, message: 'Erreur lors de la mise à jour du chantier.' });
  }
});

// Supprimer un chantier (cascade vers plans + points)
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const existing = await get('select id from sites where id = ? and user_id = ?', [id, userId]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Chantier non trouvé.' });
    }

    await run('delete from sites where id = ?', [id]);
    await invalidateUserCache(userId, ['sites', 'plans', 'reports']);
    res.json({ success: true, message: 'Chantier supprimé.' });
  } catch (error) {
    logRouteError(req, 'Delete site error', error, { statusCode: 500, siteId: req.params.id });
    res.status(500).json({ success: false, message: 'Erreur lors de la suppression du chantier.' });
  }
});

export default router;
