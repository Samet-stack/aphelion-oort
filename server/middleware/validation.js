import { z } from 'zod';

// Helper to create validation middleware
const validate = (schema) => (req, res, next) => {
  try {
    schema.parse(req.body);
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues || error.errors || [];
      return res.status(400).json({
        success: false,
        message: 'Données invalides',
        errors: issues.map((e) => ({
          field: e.path.join('.'),
          message: e.message
        }))
      });
    }
    next(error);
  }
};

// Auth schemas
export const registerSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères'),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  companyName: z.string().max(200).optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
});

export const updateProfileSchema = z.object({
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  companyName: z.string().max(200).optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Mot de passe actuel requis'),
  newPassword: z.string().min(6, 'Le nouveau mot de passe doit contenir au moins 6 caractères'),
});

// Site schemas (chantier)
export const createSiteSchema = z.object({
  siteName: z.string().min(1, 'Nom du chantier requis').max(200),
  address: z.string().max(500).optional(),
});

export const updateSiteSchema = z.object({
  siteName: z.string().min(1).max(200).optional(),
  address: z.string().max(500).optional(),
});

// Plan schemas (plan dans un chantier)
const createPlanNewSchema = z.object({
  siteId: z.string().uuid('siteId invalide'),
  planName: z.string().min(1, 'Nom du plan requis').max(200),
  imageDataUrl: z.string().min(1, 'Image du plan requise'),
});

const createPlanLegacySchema = z.object({
  siteName: z.string().min(1, 'Nom du chantier requis').max(200),
  address: z.string().max(500).optional(),
  planName: z.string().min(1).max(200).optional(),
  imageDataUrl: z.string().min(1, 'Image du plan requise'),
});

export const createPlanSchema = z.union([createPlanNewSchema, createPlanLegacySchema]);

export const updatePlanSchema = z.object({
  planName: z.string().min(1).max(200).optional(),
  imageDataUrl: z.string().min(1).optional(),
});

// Point schemas
export const pointStatusEnum = z.enum(['a_faire', 'en_cours', 'termine']);
export const pointCategoryEnum = z.enum([
  'radiateur', 'electricite', 'defaut', 'validation', 
  'plomberie', 'maconnerie', 'menuiserie', 'autre'
]);

export const createPointSchema = z.object({
  positionX: z.number().min(0).max(100),
  positionY: z.number().min(0).max(100),
  title: z.string().min(1, 'Titre requis').max(200),
  description: z.string().max(2000).optional(),
  category: pointCategoryEnum,
  status: pointStatusEnum.default('a_faire'),
  room: z.string().max(100).optional(),
  photoDataUrl: z.string().min(1, 'Photo requise'),
  dateLabel: z.string().min(1, 'Date requise').max(100),
});

export const updatePointSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  category: pointCategoryEnum.optional(),
  status: pointStatusEnum.optional(),
  room: z.string().max(100).optional(),
  photoDataUrl: z.string().optional(),
  dateLabel: z.string().max(100).optional(),
});

// Report schemas
export const createReportSchema = z.object({
  reportId: z.string().min(1, 'ID rapport requis').max(80),
  dateLabel: z.string().min(1, 'Date requise').max(120),
  address: z.string().max(500).optional(),
  coordinates: z.string().max(200).optional(),
  accuracy: z.number().nullable().optional(),
  locationSource: z.enum(['gps', 'demo', 'unavailable']).default('unavailable'),
  description: z.string().max(5000).optional(),
  imageDataUrl: z.string().min(1, 'Image requise'),
  siteName: z.string().min(1, 'Nom du chantier requis').max(200),
  operatorName: z.string().max(200).optional(),
  clientName: z.string().max(200).optional(),
  priority: z.enum(['low', 'medium', 'high']),
  category: z.enum(['safety', 'progress', 'anomaly', 'other']),
  integrityHash: z.string().max(256).optional(),
  clientSignature: z.string().optional(),
  planId: z.string().uuid().optional(),
  planPointId: z.string().uuid().optional(),
  extraWorks: z
    .array(
      z.object({
        description: z.string().min(1).max(1000),
        estimatedCost: z.number().min(0).optional(),
        urgency: z.enum(['low', 'medium', 'high']).optional(),
        category: z.string().max(200).optional(),
      })
    )
    .optional(),
});

// AI schemas
export const analyzeImageSchema = z.object({
  imageBase64: z.string().min(1, 'Image requise'),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']).default('image/jpeg'),
  language: z.enum(['fr', 'en']).default('fr'),
});

export const compareImagesSchema = z
  .object({
    // Nouveau contrat
    beforeImageBase64: z.string().min(1, 'Image avant requise').optional(),
    afterImageBase64: z.string().min(1, 'Image après requise').optional(),
    // Compatibilité legacy
    beforeBase64: z.string().min(1, 'Image avant requise').optional(),
    afterBase64: z.string().min(1, 'Image après requise').optional(),
    mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']).default('image/jpeg'),
    language: z.enum(['fr', 'en']).default('fr'),
  })
  .superRefine((data, ctx) => {
    if (!data.beforeImageBase64 && !data.beforeBase64) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['beforeImageBase64'],
        message: 'Image avant requise',
      });
    }
    if (!data.afterImageBase64 && !data.afterBase64) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['afterImageBase64'],
        message: 'Image après requise',
      });
    }
  });

// Export validation middlewares
export const validateRegister = validate(registerSchema);
export const validateLogin = validate(loginSchema);
export const validateUpdateProfile = validate(updateProfileSchema);
export const validateChangePassword = validate(changePasswordSchema);
export const validateCreateSite = validate(createSiteSchema);
export const validateUpdateSite = validate(updateSiteSchema);
export const validateCreatePlan = validate(createPlanSchema);
export const validateUpdatePlan = validate(updatePlanSchema);
export const validateCreatePoint = validate(createPointSchema);
export const validateUpdatePoint = validate(updatePointSchema);
export const validateCreateReport = validate(createReportSchema);
export const validateAnalyzeImage = validate(analyzeImageSchema);
export const validateCompareImages = validate(compareImagesSchema);
