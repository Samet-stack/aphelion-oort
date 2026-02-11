import { describe, it, expect } from 'vitest';
import { 
  registerSchema, 
  loginSchema, 
  createReportSchema,
  createPlanSchema,
  createPointSchema,
  compareImagesSchema
} from '../../middleware/validation.js';

describe('Zod Validation Schemas', () => {
  describe('registerSchema', () => {
    it('should validate correct registration data', () => {
      const data = {
        email: 'test@example.com',
        password: 'password123',
        firstName: 'John',
        lastName: 'Doe',
        companyName: 'Test Company'
      };
      
      const result = registerSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const data = {
        email: 'invalid-email',
        password: 'password123'
      };
      
      const result = registerSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject short password', () => {
      const data = {
        email: 'test@example.com',
        password: '123' // Less than 6 chars
      };
      
      const result = registerSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should accept minimal valid data', () => {
      const data = {
        email: 'test@example.com',
        password: 'password123'
      };
      
      const result = registerSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });

  describe('loginSchema', () => {
    it('should validate correct login data', () => {
      const data = {
        email: 'test@example.com',
        password: 'password123'
      };
      
      const result = loginSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should reject missing email', () => {
      const data = {
        password: 'password123'
      };
      
      const result = loginSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject missing password', () => {
      const data = {
        email: 'test@example.com'
      };
      
      const result = loginSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  describe('createReportSchema', () => {
    it('should validate correct report data', () => {
      const data = {
        reportId: 'RPT-20260211-001',
        dateLabel: '11 fév. 2026, 10:30',
        siteName: 'Test Site',
        description: 'Test description',
        priority: 'high',
        category: 'anomaly',
        imageDataUrl: 'data:image/jpeg;base64,test123',
      };
      
      const result = createReportSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should reject invalid priority', () => {
      const data = {
        reportId: 'RPT-20260211-002',
        dateLabel: '11 fév. 2026, 10:31',
        siteName: 'Test Site',
        priority: 'invalid-priority',
        category: 'anomaly',
        imageDataUrl: 'data:image/jpeg;base64,test',
      };
      
      const result = createReportSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject missing required fields', () => {
      const data = {
        title: 'Test Report'
        // Missing siteName and imageDataUrl
      };
      
      const result = createReportSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  describe('createPointSchema', () => {
    it('should validate correct point data', () => {
      const data = {
        positionX: 50.5,
        positionY: 30.2,
        title: 'Test Point',
        category: 'defaut',
        status: 'a_faire',
        photoDataUrl: 'data:image/jpeg;base64,test123',
        dateLabel: '11 fév. 2026, 10:45',
      };
      
      const result = createPointSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should reject position outside valid range', () => {
      const data = {
        positionX: 150, // > 100
        positionY: 50,
        title: 'Test Point',
        category: 'defaut'
      };
      
      const result = createPointSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject negative position', () => {
      const data = {
        positionX: -10,
        positionY: 50,
        title: 'Test Point',
        category: 'defaut'
      };
      
      const result = createPointSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject invalid category', () => {
      const data = {
        positionX: 50,
        positionY: 50,
        title: 'Test Point',
        category: 'invalid-category'
      };
      
      const result = createPointSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  describe('compareImagesSchema', () => {
    it('should validate the new payload keys', () => {
      const result = compareImagesSchema.safeParse({
        beforeImageBase64: 'base64-before',
        afterImageBase64: 'base64-after',
        mimeType: 'image/jpeg',
        language: 'fr',
      });

      expect(result.success).toBe(true);
    });

    it('should validate legacy payload keys', () => {
      const result = compareImagesSchema.safeParse({
        beforeBase64: 'base64-before',
        afterBase64: 'base64-after',
        mimeType: 'image/png',
        language: 'en',
      });

      expect(result.success).toBe(true);
    });

    it('should reject when before/after images are missing', () => {
      const result = compareImagesSchema.safeParse({
        mimeType: 'image/jpeg',
      });

      expect(result.success).toBe(false);
    });
  });
});
