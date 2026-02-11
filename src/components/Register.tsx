import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, User, ArrowRight, AlertCircle, Briefcase } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '../contexts/AuthContext';
import { registerFormSchema, type RegisterFormValues } from '../schemas/auth';
import { Button, SurfaceCard, TextField } from './ui';

interface RegisterProps {
  onSwitchToLogin: () => void;
}

export const Register: React.FC<RegisterProps> = ({ onSwitchToLogin }) => {
  const navigate = useNavigate();
  const { register: createAccount } = useAuth();
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      firstName: '',
      lastName: '',
      companyName: '',
    },
  });

  const onSubmit = async (values: RegisterFormValues) => {
    setError('');
    try {
      await createAccount({
        email: values.email,
        password: values.password,
        firstName: values.firstName || undefined,
        lastName: values.lastName || undefined,
        companyName: values.companyName || undefined,
      });
      navigate(`/register-success?email=${encodeURIComponent(values.email)}`, { replace: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur lors de l'inscription";
      setError(message);
    }
  };

  return (
    <div className="view view--centered">
      <div className="auth-shell">
        <div className="auth-brand">
          <img src="/logo.png" alt="SiteFlow Pro" className="auth-brand__logo" />
          <h1 className="auth-brand__title">SiteFlow Pro</h1>
          <p className="auth-brand__subtitle">Créez votre compte professionnel</p>
        </div>

        <SurfaceCard>
          {error && (
            <div className="auth-alert auth-alert--error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="auth-form">
            <div className="auth-form__grid">
              <TextField
                id="register-first-name"
                type="text"
                label="Prénom"
                icon={User}
                placeholder="Jean"
                error={errors.firstName?.message}
                {...register('firstName')}
              />

              <TextField
                id="register-last-name"
                type="text"
                label="Nom"
                icon={User}
                placeholder="Dupont"
                error={errors.lastName?.message}
                {...register('lastName')}
              />
            </div>

            <TextField
              id="register-company-name"
              type="text"
              label="Entreprise"
              icon={Briefcase}
              placeholder="Votre entreprise"
              error={errors.companyName?.message}
              {...register('companyName')}
            />

            <TextField
              id="register-email"
              type="email"
              label="Email"
              icon={Mail}
              placeholder="votre@email.com"
              autoComplete="email"
              error={errors.email?.message}
              {...register('email')}
            />

            <TextField
              id="register-password"
              type="password"
              label="Mot de passe"
              icon={Lock}
              placeholder="••••••••"
              autoComplete="new-password"
              hint="Minimum 6 caractères"
              error={errors.password?.message}
              {...register('password')}
            />

            <TextField
              id="register-confirm-password"
              type="password"
              label="Confirmer le mot de passe"
              icon={Lock}
              placeholder="••••••••"
              autoComplete="new-password"
              error={errors.confirmPassword?.message}
              {...register('confirmPassword')}
            />

            <Button type="submit" loading={isSubmitting} className="w-full mt-2" aria-label="Créer mon compte">
              {isSubmitting ? (
                'Inscription...'
              ) : (
                <>
                  Créer mon compte
                  <ArrowRight size={18} />
                </>
              )}
            </Button>
          </form>

          <p className="auth-switch">
            Déjà un compte ?{' '}
            <button type="button" onClick={onSwitchToLogin} className="auth-switch__btn">
              Se connecter
            </button>
          </p>
        </SurfaceCard>

        <p className="auth-meta">
          En créant un compte, vous acceptez nos conditions d'utilisation.
          <br />
          Vos données sont chiffrées et sécurisées.
        </p>
      </div>
    </div>
  );
};
