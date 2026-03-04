import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, get, run } from '../database.js';
import { authMiddleware } from '../middleware/auth.js';
const router = express.Router();
router.use(authMiddleware);
// Partager un rapport
router.post('/', async (req, res) => {
    try {
        const { reportId, email, message, permission = 'view' } = req.body;
        const ownerId = req.user.id;
        if (!reportId || !email) {
            return res.status(400).json({
                success: false,
                message: 'Report ID et email requis.'
            });
        }
        // Vérifier que le rapport appartient à l'utilisateur
        const report = await get('SELECT id FROM reports WHERE id = ? AND user_id = ?', [reportId, ownerId]);
        if (!report) {
            return res.status(404).json({
                success: false,
                message: 'Rapport non trouvé ou non autorisé.'
            });
        }
        // Vérifier si l'email correspond à un utilisateur existant
        const recipient = await get('SELECT id, email FROM users WHERE email = ?', [email.toLowerCase()]);
        // Créer le partage
        const shareId = uuidv4();
        await run(`INSERT INTO shares (id, report_id, owner_id, shared_with_email, shared_with_id, permission, message, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
            shareId,
            reportId,
            ownerId,
            email.toLowerCase(),
            recipient?.id || null,
            permission,
            message || null,
            recipient ? 'active' : 'pending'
        ]);
        res.status(201).json({
            success: true,
            message: recipient
                ? 'Rapport partagé avec succès.'
                : 'Invitation envoyée. L\'utilisateur verra le rapport après création de compte.',
            data: {
                shareId,
                status: recipient ? 'active' : 'pending'
            }
        });
    }
    catch (error) {
        console.error('Share report error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du partage du rapport.'
        });
    }
});
// Récupérer les rapports partagés avec moi
router.get('/received', async (req, res) => {
    try {
        const userId = req.user.id;
        const userEmail = req.user.email;
        // Rapports partagés avec moi
        const shares = await query(`SELECT 
        s.id as "shareId", s.permission, s.status, s.message, s.created_at as "createdAt",
        r.*,
        u.first_name as "ownerFirstName", u.last_name as "ownerLastName", u.email as "ownerEmail",
        (SELECT COUNT(*) FROM extra_works WHERE report_id = r.id) as "extraWorksCount",
        (SELECT SUM(estimated_cost) FROM extra_works WHERE report_id = r.id) as "extraWorksValue"
       FROM shares s
       JOIN reports r ON s.report_id = r.id
       JOIN users u ON s.owner_id = u.id
       WHERE (s.shared_with_id = ? OR s.shared_with_email = ?) AND s.status = 'active'
       ORDER BY s.created_at DESC`, [userId, userEmail]);
        // Ajouter les travaux supplémentaires pour chaque rapport
        for (const share of shares) {
            const extraWorks = await query('SELECT * FROM extra_works WHERE report_id = ?', [share.id]);
            share.extraWorks = extraWorks;
        }
        res.json({
            success: true,
            data: { shares }
        });
    }
    catch (error) {
        console.error('Get shared reports error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des rapports partagés.'
        });
    }
});
// Récupérer les rapports que j'ai partagés
router.get('/sent', async (req, res) => {
    try {
        const ownerId = req.user.id;
        const shares = await query(`SELECT 
        s.id as "shareId", s.permission, s.status, s.message, s.created_at as "createdAt",
        r.id as "reportId", r.report_id as "reportRef", r.site_name as "siteName", r.date_label as "dateLabel",
        u.first_name as "recipientFirstName", u.last_name as "recipientLastName", u.email as "recipientEmail"
       FROM shares s
       JOIN reports r ON s.report_id = r.id
       LEFT JOIN users u ON s.shared_with_id = u.id
       WHERE s.owner_id = ?
       ORDER BY s.created_at DESC`, [ownerId]);
        res.json({
            success: true,
            data: { shares }
        });
    }
    catch (error) {
        console.error('Get sent shares error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des partages.'
        });
    }
});
// Révoquer un partage
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const ownerId = req.user.id;
        const share = await get('SELECT id FROM shares WHERE id = ? AND owner_id = ?', [id, ownerId]);
        if (!share) {
            return res.status(404).json({
                success: false,
                message: 'Partage non trouvé.'
            });
        }
        await run('DELETE FROM shares WHERE id = ?', [id]);
        res.json({
            success: true,
            message: 'Partage révoqué.'
        });
    }
    catch (error) {
        console.error('Delete share error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la révocation du partage.'
        });
    }
});
// Accepter un partage (pour les invitations pending)
router.put('/:id/accept', async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const userEmail = req.user.email;
        // Vérifier que l'invitation est pour cet utilisateur
        const share = await get("SELECT * FROM shares WHERE id = ? AND shared_with_email = ? AND status = 'pending'", [id, userEmail]);
        if (!share) {
            return res.status(404).json({
                success: false,
                message: 'Invitation non trouvée ou déjà acceptée.'
            });
        }
        // Mettre à jour le partage
        await run("UPDATE shares SET shared_with_id = ?, status = 'active', accepted_at = NOW() WHERE id = ?", [userId, id]);
        res.json({
            success: true,
            message: 'Invitation acceptée.'
        });
    }
    catch (error) {
        console.error('Accept share error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'acceptation du partage.'
        });
    }
});
export default router;
