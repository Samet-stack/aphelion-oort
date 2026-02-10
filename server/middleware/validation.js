import { z } from 'zod';

// Helper to create validation middleware
const validate = (schema) => (req, res, next) => {
  try {
    schema.parse(req.body);
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Données invalides',
        errors: error.errors.map(e => ({
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

// Plan schemas
export const createPlanSchema = z.object({
  siteName: z.string().min(1, 'Nom du chantier requis').max(200),
  address: z.string().max(500).optional(),
  imageDataUrl: z.string().min(1, 'Image du plan requise'),
});

export const updatePlanSchema = z.object({
  siteName: z.string().min(1).max(200).optional(),
  address: z.string().max(500).optional(),
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
  photoDataUrl: z.string().optional(),
  dateLabel: z.string().max(100).optional(),
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
  title: z.string().min(1, 'Titre requis').max(200),
  siteName: z.string().min(1, 'Nom du chantier requis').max(200),
  address: z.string().max(500).optional(),
  description: z.string().max(5000).optional(),
  imageDataUrl: z.string().min(1, 'Image requise'),
  priority: z.enum(['low', 'medium', 'high']),
  aiAnalysis: z.object({
    category: z.string().optional(),
    priority: z.enum(['low', 'medium', 'high']).optional(),
    description: z.string().optional(),
  }).optional(),
  extraWork: z.array(z.object({
    description: z.string(),
    lot: z.string().optional(),
    estimatedCost: z.number().optional(),
  })).optional(),
  planId: z.string().uuid().optional(),
  planPointId: z.string().uuid().optional(),
});

// AI schemas
export const analyzeImageSchema = z.object({
  imageBase64: z.string().min(1, 'Image requise'),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']).default('image/jpeg'),
  language: z.enum(['fr', 'en']).default('fr'),
});

export const compareImagesSchema = z.object({
  beforeImageBase64: z.string().min(1, 'Image avant requise'),
  afterImageBase64: z.string().min(1, 'Image après requise'),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']).default('image/jpeg'),
  language: z.enum(['fr', 'en']).default('fr'),
});

// Export validation middlewares
export const validateRegister = validate(registerSchema);
export const validateLogin = validate(loginSchema);
export const validateUpdateProfile = validate(updateProfileSchema);
export const validateChangePassword = validate(changePasswordSchema);
export const validateCreatePlan = validate(createPlanSchema);
export const validateUpdatePlan = validate(updatePlanSchema);
export const validateCreatePoint = validate(createPointSchema);
export const validateUpdatePoint = validate(updatePointSchema);
export const validateCreateReport = validate(createReportSchema);
export const validateAnalyzeImage = validate(analyzeImageSchema);
export const validateCompareImages = validate(compareImagesSchema);
