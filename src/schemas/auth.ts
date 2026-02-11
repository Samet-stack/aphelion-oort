import { z } from 'zod';

export const loginFormSchema = z.object({
  email: z.string().trim().email('Email invalide'),
  password: z.string().min(6, 'Minimum 6 caractères'),
});

export type LoginFormValues = z.infer<typeof loginFormSchema>;

export const registerFormSchema = z
  .object({
    email: z.string().trim().email('Email invalide'),
    password: z.string().min(6, 'Minimum 6 caractères'),
    confirmPassword: z.string().min(6, 'Minimum 6 caractères'),
    firstName: z.string().trim().max(80, 'Maximum 80 caractères').optional().or(z.literal('')),
    lastName: z.string().trim().max(80, 'Maximum 80 caractères').optional().or(z.literal('')),
    companyName: z.string().trim().max(120, 'Maximum 120 caractères').optional().or(z.literal('')),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmPassword'],
  });

export type RegisterFormValues = z.infer<typeof registerFormSchema>;
