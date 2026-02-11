import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, Lock, ArrowRight, AlertCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '../contexts/AuthContext';
import { loginFormSchema, type LoginFormValues } from '../schemas/auth';
import { Button, SurfaceCard, TextField } from './ui';

interface LoginProps {
  onSwitchToRegister: () => void;
}

export const Login: React.FC<LoginProps> = ({ onSwitchToRegister }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login: loginUser } = useAuth();
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  useEffect(() => {
    const emailFromUrl = searchParams.get('email');
    if (!emailFromUrl || getValues('email')) return;
    setValue('email', emailFromUrl, { shouldValidate: true });
  }, [getValues, searchParams, setValue]);

  const onSubmit = async (values: LoginFormValues) => {
    setError('');
    try {
      await loginUser(values.email, values.password);
      navigate('/', { replace: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur de connexion';
      setError(message);
    }
  };

  return (
    <div className="view view--centered">
      <div className="auth-shell">
        <div className="auth-brand">
          <img src="/logo.png" alt="SiteFlow Pro" className="auth-brand__logo" />
          <h1 className="auth-brand__title">SiteFlow Pro</h1>
          <p className="auth-brand__subtitle">Connectez-vous à votre compte</p>
        </div>

        <SurfaceCard>
          {error && (
            <div className="auth-alert auth-alert--error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="auth-form">
            <TextField
              id="login-email"
              type="email"
              label="Email"
              icon={Mail}
              placeholder="votre@email.com"
              autoComplete="email"
              error={errors.email?.message}
              {...register('email')}
            />

            <TextField
              id="login-password"
              type="password"
              label="Mot de passe"
              icon={Lock}
              placeholder="••••••••"
              autoComplete="current-password"
              error={errors.password?.message}
              {...register('password')}
            />

            <Button type="submit" loading={isSubmitting} className="w-full mt-2" aria-label="Se connecter">
              {isSubmitting ? (
                'Connexion...'
              ) : (
                <>
                  Se connecter
                  <ArrowRight size={18} />
                </>
              )}
            </Button>
          </form>

          <p className="auth-switch">
            Pas encore de compte ?{' '}
            <button type="button" onClick={onSwitchToRegister} className="auth-switch__btn">
              Créer un compte
            </button>
          </p>
        </SurfaceCard>

        <div className="auth-features" aria-hidden="true">
          <div className="auth-feature">
            <div className="auth-feature__icon">🔒</div>
            Données sécurisées
          </div>
          <div className="auth-feature">
            <div className="auth-feature__icon">☁️</div>
            Sauvegarde cloud
          </div>
          <div className="auth-feature">
            <div className="auth-feature__icon">📱</div>
            Accès multi-appareils
          </div>
        </div>
      </div>
    </div>
  );
};
