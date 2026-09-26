import React, { useState } from 'react';
import { useAdmin } from '../context/AdminContext.js';
import {
  Shield,
  Lock,
  Mail,
  Eye,
  EyeOff,
  Smartphone,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  AlertCircle,
} from 'lucide-react';

export const LoginView: React.FC = () => {
  const { config, login, showToast } = useAdmin();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [requires2fa, setRequires2fa] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleDemoFill = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const res = await login(email, password, requires2fa ? totpCode : undefined);
      if (res?.requires2fa) {
        setRequires2fa(true);
        showToast('2FA verification required. Please enter your 6-digit authenticator code.', 'info');
      } else {
        showToast(`Welcome back! Logged in as ${email}`);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        background:
          'radial-gradient(ellipse at top, rgba(13, 148, 136, 0.15), transparent 70%), radial-gradient(ellipse at bottom, rgba(14, 165, 233, 0.1), transparent 70%), var(--chakra-colors-bg-default)',
      }}
    >
      <div
        className="chakra-card"
        style={{
          maxWidth: 440,
          width: '100%',
          padding: '2.25rem',
          borderRadius: 16,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px var(--chakra-colors-border-subtle)',
          backdropFilter: 'blur(16px)',
        }}
      >
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: 'linear-gradient(135deg, #0d9488 0%, #0284c7 100%)',
              color: '#ffffff',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 900,
              fontSize: '1.375rem',
              boxShadow: '0 8px 20px rgba(13, 148, 136, 0.35)',
              marginBottom: '1rem',
            }}
          >
            JS
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.025em' }}>
            {config.title}
          </h1>
          <p style={{ fontSize: '0.8125rem', color: 'var(--chakra-colors-fg-muted)', marginTop: 4 }}>
            {requires2fa
              ? 'Two-Step Authenticator Verification'
              : 'Sign in to access the administrator platform'}
          </p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.6rem',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 8,
              padding: '0.75rem 1rem',
              marginBottom: '1.25rem',
              fontSize: '0.8125rem',
              color: '#f87171',
            }}
          >
            <AlertCircle style={{ width: 16, height: 16, flexShrink: 0, marginTop: 1 }} />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {!requires2fa ? (
            <>
              {/* Email / Username */}
              <div className="chakra-field">
                <label htmlFor="login-email" style={{ fontSize: '0.8125rem', fontWeight: 600 }}>
                  Email or Username
                </label>
                <div style={{ position: 'relative' }}>
                  <Mail
                    style={{
                      position: 'absolute',
                      left: 12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: 16,
                      height: 16,
                      color: 'var(--chakra-colors-fg-muted)',
                    }}
                  />
                  <input
                    id="login-email"
                    type="text"
                    required
                    autoFocus
                    autoComplete="username"
                    className="chakra-input"
                    placeholder="admin@jsango.dev"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{ paddingLeft: '2.35rem' }}
                  />
                </div>
              </div>

              {/* Password */}
              <div className="chakra-field">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label htmlFor="login-password" style={{ fontSize: '0.8125rem', fontWeight: 600 }}>
                    Password
                  </label>
                </div>
                <div style={{ position: 'relative' }}>
                  <Lock
                    style={{
                      position: 'absolute',
                      left: 12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: 16,
                      height: 16,
                      color: 'var(--chakra-colors-fg-muted)',
                    }}
                  />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    className="chakra-input"
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{ paddingLeft: '2.35rem', paddingRight: '2.5rem' }}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: 10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--chakra-colors-fg-muted)',
                      padding: 4,
                      display: 'flex',
                    }}
                  >
                    {showPassword ? (
                      <EyeOff style={{ width: 16, height: 16 }} />
                    ) : (
                      <Eye style={{ width: 16, height: 16 }} />
                    )}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="chakra-button solid"
                disabled={isLoading}
                style={{
                  width: '100%',
                  marginTop: '0.75rem',
                  padding: '0.75rem 1rem',
                  fontSize: '0.9375rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                }}
              >
                {isLoading ? (
                  'Signing in...'
                ) : (
                  <>
                    <span>Sign In to Admin</span>
                    <ArrowRight style={{ width: 16, height: 16 }} />
                  </>
                )}
              </button>

              {/* Quick Demo Fill Helper */}
              <div
                style={{
                  marginTop: '1.5rem',
                  paddingTop: '1.25rem',
                  borderTop: '1px solid var(--chakra-colors-border-subtle)',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--chakra-colors-fg-muted)',
                    marginBottom: '0.6rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                  }}
                >
                  <Sparkles style={{ width: 13, height: 13, color: '#f59e0b' }} />
                  <span>Quick Demo Credentials</span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                  <button
                    type="button"
                    className="chakra-button subtle"
                    style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                    onClick={() => handleDemoFill('admin@jsango.dev', 'admin123')}
                  >
                    👑 Superuser
                  </button>
                  <button
                    type="button"
                    className="chakra-button subtle"
                    style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                    onClick={() => handleDemoFill('staff@jsango.dev', 'staff123')}
                  >
                    🛡️ Staff
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* 2FA Step */}
              <div className="chakra-field" style={{ textAlign: 'center' }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 9999,
                    background: 'rgba(13, 148, 136, 0.15)',
                    color: '#0d9488',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '0.75rem',
                  }}
                >
                  <Smartphone style={{ width: 24, height: 24 }} />
                </div>
                <label htmlFor="login-totp" style={{ fontSize: '0.875rem', fontWeight: 700, display: 'block' }}>
                  Enter 6-Digit Authenticator Code
                </label>
                <p style={{ fontSize: '0.75rem', color: 'var(--chakra-colors-fg-muted)', marginBottom: '1rem' }}>
                  Open your Authenticator app and enter the code, or use an emergency recovery backup code.
                </p>

                <input
                  id="login-totp"
                  type="text"
                  maxLength={9}
                  autoFocus
                  required
                  className="chakra-input"
                  placeholder="123456"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  style={{
                    letterSpacing: '0.3em',
                    fontSize: '1.25rem',
                    textAlign: 'center',
                    fontFamily: 'var(--chakra-fonts-mono)',
                    fontWeight: 700,
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  className="chakra-button subtle"
                  style={{ flex: 1 }}
                  onClick={() => {
                    setRequires2fa(false);
                    setTotpCode('');
                  }}
                >
                  <ArrowLeft style={{ width: 14, height: 14 }} /> Back
                </button>
                <button
                  type="submit"
                  className="chakra-button solid"
                  disabled={isLoading || totpCode.length < 6}
                  style={{ flex: 2 }}
                >
                  {isLoading ? 'Verifying...' : 'Verify & Sign In'}
                </button>
              </div>
            </>
          )}
        </form>

        {/* Footer info */}
        <div
          style={{
            marginTop: '1.5rem',
            textAlign: 'center',
            fontSize: '0.6875rem',
            color: 'var(--chakra-colors-fg-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
          }}
        >
          <Shield style={{ width: 12, height: 12, color: 'var(--chakra-colors-brand-fg)' }} />
          <span>Protected by JSango Security Framework</span>
        </div>
      </div>
    </div>
  );
};
