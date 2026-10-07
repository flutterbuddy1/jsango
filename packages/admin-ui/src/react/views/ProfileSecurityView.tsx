import React, { useState, useEffect, useCallback } from 'react';
import { useAdmin } from '../context/AdminContext.js';
import {
  Key,
  Shield,
  Smartphone,
  Copy,
  Laptop,
  Trash2,
  RefreshCw,
  X,
  CheckCircle2,
} from 'lucide-react';

export interface AdminSessionItem {
  id: string;
  device: string;
  ip: string;
  location: string;
  lastActive: string;
  isCurrent: boolean;
  createdAt?: string;
}

export const ProfileSecurityView: React.FC = () => {
  const { user, fetchApi, showToast, setBreadcrumbs } = useAdmin();

  useEffect(() => {
    setBreadcrumbs([{ label: 'Account Profile & Security' }]);
  }, [setBreadcrumbs]);

  // Password State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [strengthScore, setStrengthScore] = useState(0);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // 2FA State
  const [is2faEnabled, setIs2faEnabled] = useState(false);
  const [isTotpModalOpen, setTotpModalOpen] = useState(false);
  const [isBackupModalOpen, setBackupModalOpen] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [totpSetupData, setTotpSetupData] = useState<{
    secret: string;
    uri: string;
  } | null>(null);
  const [isVerifyingTotp, setIsVerifyingTotp] = useState(false);
  /** Accounts from the app's own auth (createAuth) change password / 2FA in the app. */
  const [managedByApp, setManagedByApp] = useState(false);

  // Active Sessions State
  const [sessions, setSessions] = useState<AdminSessionItem[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);

  // Load Initial Profile & Sessions
  const loadProfileAndSessions = useCallback(async () => {
    try {
      setIsLoadingSessions(true);
      const [profileRes, sessionsRes] = await Promise.all([
        fetchApi<any>('/auth/profile').catch(() => null),
        fetchApi<any>('/auth/sessions').catch(() => null),
      ]);

      setIs2faEnabled(Boolean(profileRes?.is2faEnabled));
      setManagedByApp(Boolean(profileRes?.managedByApp));
      setSessions(Array.isArray(sessionsRes?.sessions) ? sessionsRes.sessions : []);
    } finally {
      setIsLoadingSessions(false);
    }
  }, [fetchApi]);

  useEffect(() => {
    loadProfileAndSessions();
  }, [loadProfileAndSessions]);

  // Calculate Password Strength
  const handlePasswordChange = (val: string) => {
    setNewPassword(val);
    let score = 0;
    if (val.length >= 8) score++;
    if (/[A-Z]/.test(val) && /[a-z]/.test(val)) score++;
    if (/\d/.test(val)) score++;
    if (/[^A-Za-z0-9]/.test(val)) score++;
    setStrengthScore(score);
  };

  const getStrengthMeta = () => {
    switch (strengthScore) {
      case 1:
        return { label: 'Weak password', color: '#ef4444', width: '25%' };
      case 2:
        return { label: 'Fair password', color: '#f59e0b', width: '50%' };
      case 3:
        return { label: 'Good password', color: '#0ea5e9', width: '75%' };
      case 4:
        return { label: 'Strong password', color: '#10b981', width: '100%' };
      default:
        return { label: 'Enter a strong password', color: '#ef4444', width: '0%' };
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      showToast('New passwords do not match', 'error');
      return;
    }
    if (newPassword.length < 12 || strengthScore < 2) {
      showToast('Use at least 12 characters with letters, numbers and symbols.', 'warning');
      return;
    }

    try {
      setIsUpdatingPassword(true);
      await fetchApi('/auth/password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      showToast('Password updated. Set JSANGO_ADMIN_PASSWORD to keep it after a restart.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setStrengthScore(0);
    } catch (err: any) {
      showToast(err.message || 'Failed to update password', 'error');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  // 2FA Handlers
  const handleStartTotpSetup = async () => {
    try {
      const setup = await fetchApi<{ secret: string; uri: string }>('/auth/2fa/setup', { method: 'POST' });
      setTotpSetupData(setup);
      setTotpCode('');
      setTotpModalOpen(true);
    } catch (err: any) {
      showToast(err.message || 'Could not start two-factor setup', 'error');
    }
  };

  const handleVerifyTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totpCode.length < 6) {
      showToast('Please enter a 6-digit TOTP verification code', 'error');
      return;
    }

    try {
      setIsVerifyingTotp(true);
      const res = await fetchApi<any>('/auth/2fa/verify', {
        method: 'POST',
        body: JSON.stringify({ code: totpCode }),
      });

      setIs2faEnabled(true);
      setTotpModalOpen(false);
      setTotpCode('');
      setBackupCodes(res.backupCodes ?? []);
      setBackupModalOpen(true);
      showToast('Two-Factor Authentication activated successfully!');
    } catch (err: any) {
      showToast(err.message || 'Verification failed. Please check your authenticator code.', 'error');
    } finally {
      setIsVerifyingTotp(false);
    }
  };

  const handleDisable2fa = async () => {
    const password = prompt('Enter your password to disable two-factor authentication:');
    if (!password) return;
    try {
      await fetchApi('/auth/2fa/disable', { method: 'POST', body: JSON.stringify({ password }) });
      setIs2faEnabled(false);
      showToast('Two-Factor Authentication has been disabled');
    } catch (err: any) {
      showToast(err.message || 'Failed to disable 2FA', 'error');
    }
  };

  // Sessions Handlers
  const handleTerminateSingleSession = async (sessionId: string) => {
    if (!confirm('Terminate this device session?')) return;
    try {
      await fetchApi(`/auth/sessions/${sessionId}`, { method: 'DELETE' });
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      showToast('Session terminated successfully');
    } catch (err: any) {
      showToast(err.message || 'Failed to terminate session', 'error');
    }
  };

  const handleTerminateOtherSessions = async () => {
    if (!confirm('Are you sure you want to terminate all other active administrator sessions?')) return;
    try {
      await fetchApi('/auth/sessions/terminate-others', { method: 'POST' });
      setSessions((prev) => prev.filter((s) => s.isCurrent));
      showToast('All other active sessions have been terminated.');
    } catch (err: any) {
      showToast(err.message || 'Failed to terminate sessions', 'error');
    }
  };

  const strengthMeta = getStrengthMeta();

  return (
    <div style={{ maxWidth: 960 }}>
      {/* Profile Header Summary Card */}
      <div
        className="chakra-card"
        style={{
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 9999,
              background: 'linear-gradient(135deg, #0d9488 0%, #0284c7 100%)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '1.5rem',
              boxShadow: '0 4px 12px rgba(13, 148, 136, 0.35)',
            }}
          >
            {user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || 'SU'}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <h1 style={{ fontSize: '1.375rem', fontWeight: 800 }}>{user.name}</h1>
              <span className="chakra-badge purple">{user.role}</span>
              {is2faEnabled && <span className="chakra-badge teal">2FA Protected</span>}
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--chakra-colors-fg-muted)', marginTop: 2 }}>
              {user.email} • Staff Administrator
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            className="chakra-button subtle"
            onClick={() => {
              loadProfileAndSessions();
              showToast('Security status and active sessions refreshed');
            }}
          >
            <RefreshCw style={{ width: 14, height: 14 }} /> Refresh
          </button>
        </div>
      </div>

      {managedByApp && (
        <div className="chakra-card" style={{ marginBottom: '1.5rem', fontSize: '0.8125rem' }}>
          Your password and two-factor authentication are managed by the application you signed in with.
        </div>
      )}

      {/* Grid: Password Change + 2FA */}
      {!managedByApp && <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: '1.5rem',
          marginBottom: '1.5rem',
        }}
      >
        {/* 1. Password Change Card */}
        <div className="chakra-card">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              fontWeight: 700,
              fontSize: '1rem',
              marginBottom: '0.5rem',
            }}
          >
            <Key style={{ width: 18, height: 18, color: 'var(--chakra-colors-brand-fg)' }} />
            <span>Change Password</span>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--chakra-colors-fg-muted)', marginBottom: '1.25rem' }}>
            Ensure your account uses a strong, unique password with letters, digits, and symbols.
          </p>

          <form onSubmit={handlePasswordSubmit}>
            <div className="chakra-field">
              <label htmlFor="pwd-current">
                Current Password <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="password"
                id="pwd-current"
                className="chakra-input"
                placeholder="••••••••••••"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>

            <div className="chakra-field">
              <label htmlFor="pwd-new">
                New Password <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="password"
                id="pwd-new"
                className="chakra-input"
                placeholder="••••••••••••"
                required
                value={newPassword}
                onChange={(e) => handlePasswordChange(e.target.value)}
              />

              {/* Strength Meter Bar */}
              <div
                style={{
                  height: 4,
                  borderRadius: 9999,
                  background: 'var(--chakra-colors-bg-muted)',
                  marginTop: 6,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: strengthMeta.width,
                    transition: 'all 0.2s ease',
                    background: strengthMeta.color,
                  }}
                />
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--chakra-colors-fg-muted)', marginTop: 2 }}>
                {strengthMeta.label}
              </div>
            </div>

            <div className="chakra-field">
              <label htmlFor="pwd-confirm">
                Confirm New Password <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="password"
                id="pwd-confirm"
                className="chakra-input"
                placeholder="••••••••••••"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            <button
              type="submit"
              className="chakra-button solid"
              disabled={isUpdatingPassword}
              style={{ width: '100%', marginTop: '0.5rem' }}
            >
              <Shield style={{ width: 15, height: 15 }} />{' '}
              {isUpdatingPassword ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>

        {/* 2. Two-Factor Authentication (2FA) */}
        <div className="chakra-card">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              fontWeight: 700,
              fontSize: '1rem',
              marginBottom: '0.5rem',
            }}
          >
            <Smartphone style={{ width: 18, height: 18, color: 'var(--chakra-colors-brand-fg)' }} />
            <span>Two-Step Verification (2FA / TOTP)</span>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--chakra-colors-fg-muted)', marginBottom: '1.25rem' }}>
            Add an extra layer of security using an authenticator application (Google Authenticator, Microsoft Authenticator, Authy, or 1Password).
          </p>

          <div
            style={{
              background: 'var(--chakra-colors-bg-subtle)',
              border: '1px solid var(--chakra-colors-border-subtle)',
              borderRadius: 8,
              padding: '1rem',
              marginBottom: '1.25rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>
                  {is2faEnabled ? '2FA is Enabled' : '2FA is Currently Disabled'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--chakra-colors-fg-muted)', marginTop: 2 }}>
                  {is2faEnabled
                    ? 'Your account is secured with a TOTP authenticator code.'
                    : 'We strongly recommend enabling 2FA for all administrative accounts.'}
                </div>
              </div>
              <span className={`chakra-badge ${is2faEnabled ? 'teal' : 'gray'}`}>
                {is2faEnabled ? 'Protected' : 'Off'}
              </span>
            </div>
          </div>

          {is2faEnabled ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <button
                type="button"
                className="chakra-button subtle"
                style={{ width: '100%' }}
                onClick={() => setBackupModalOpen(true)}
              >
                View Emergency Backup Codes
              </button>
              <button
                type="button"
                className="chakra-button subtle"
                style={{ width: '100%', color: '#ef4444' }}
                onClick={handleDisable2fa}
              >
                Disable 2FA Protection
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="chakra-button solid"
              style={{ width: '100%' }}
              onClick={handleStartTotpSetup}
            >
              <Shield style={{ width: 15, height: 15 }} /> Set Up Two-Factor Authentication
            </button>
          )}
        </div>
      </div>}

      {/* 3. Active Administrator Sessions */}
      <div className="chakra-card">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem',
            marginBottom: '1rem',
          }}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem' }}>Active Administrator Sessions</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--chakra-colors-fg-muted)', marginTop: 2 }}>
              Devices currently signed in with this administrator account
            </div>
          </div>
          {sessions.length > 1 && (
            <button
              type="button"
              className="chakra-button subtle"
              style={{ color: '#ef4444' }}
              onClick={handleTerminateOtherSessions}
            >
              <Trash2 style={{ width: 14, height: 14 }} /> Log Out Other Sessions
            </button>
          )}
        </div>

        {isLoadingSessions ? (
          <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--chakra-colors-fg-muted)', fontSize: '0.8125rem' }}>
            Loading active sessions...
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {sessions.map((sess) => (
              <div
                key={sess.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem 1rem',
                  borderRadius: 8,
                  background: 'var(--chakra-colors-bg-subtle)',
                  border: '1px solid var(--chakra-colors-border-subtle)',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Laptop style={{ width: 18, height: 18, color: 'var(--chakra-colors-brand-fg)' }} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{sess.device}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--chakra-colors-fg-muted)' }}>
                      {sess.ip} • {sess.location}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  {sess.isCurrent ? (
                    <span className="chakra-badge teal">This Session</span>
                  ) : (
                    <>
                      <span style={{ fontSize: '0.75rem', color: 'var(--chakra-colors-fg-muted)' }}>
                        {sess.lastActive}
                      </span>
                      <button
                        type="button"
                        className="chakra-button ghost"
                        style={{ color: '#ef4444', padding: '2px 6px', fontSize: '0.75rem' }}
                        title="Revoke session"
                        onClick={() => handleTerminateSingleSession(sess.id)}
                      >
                        <Trash2 style={{ width: 13, height: 13 }} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* TOTP Setup Modal Dialog */}
      {isTotpModalOpen && totpSetupData && (
        <div className="admin-modal-overlay" onClick={() => setTotpModalOpen(false)}>
          <div
            className="chakra-card"
            style={{ maxWidth: 460, width: '100%', position: 'relative' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '1rem',
              }}
            >
              <div style={{ fontWeight: 800, fontSize: '1.125rem' }}>Setup Authenticator App</div>
              <button
                type="button"
                className="chakra-button ghost"
                style={{ padding: 4 }}
                onClick={() => setTotpModalOpen(false)}
              >
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>

            <p style={{ fontSize: '0.8125rem', color: 'var(--chakra-colors-fg-muted)', marginBottom: '1rem' }}>
              Scan the QR code below in your Authenticator app (e.g. Google Authenticator, 1Password, Authy).
            </p>

            {/* The secret never leaves this page: open it in an authenticator app or type the key. */}
            <a
              href={totpSetupData.uri}
              className="chakra-button solid"
              style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem', textDecoration: 'none' }}
            >
              Open in authenticator app
            </a>

            {/* Secret key copy */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: 4 }}>Or enter key manually:</div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'var(--chakra-colors-bg-subtle)',
                  padding: '0.4rem 0.6rem',
                  borderRadius: 6,
                  fontFamily: 'var(--chakra-fonts-mono)',
                  fontSize: '0.8125rem',
                }}
              >
                <span style={{ userSelect: 'all' }}>{totpSetupData.secret}</span>
                <button
                  type="button"
                  className="chakra-button ghost"
                  style={{ padding: '2px 6px' }}
                  onClick={() => {
                    navigator.clipboard.writeText(totpSetupData.secret);
                    showToast('Secret key copied to clipboard');
                  }}
                >
                  <Copy style={{ width: 14, height: 14 }} />
                </button>
              </div>
            </div>

            {/* Code verification input */}
            <form onSubmit={handleVerifyTotp}>
              <div className="chakra-field">
                <label htmlFor="totp-input">Enter 6-Digit Authenticator Code</label>
                <input
                  id="totp-input"
                  type="text"
                  maxLength={6}
                  autoFocus
                  className="chakra-input"
                  placeholder="123456"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                  style={{
                    letterSpacing: '0.3em',
                    fontSize: '1.125rem',
                    textAlign: 'center',
                    fontFamily: 'var(--chakra-fonts-mono)',
                  }}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  className="chakra-button subtle"
                  onClick={() => setTotpModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="chakra-button solid" disabled={isVerifyingTotp}>
                  {isVerifyingTotp ? 'Verifying...' : 'Verify & Activate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Backup Codes Modal Dialog */}
      {isBackupModalOpen && (
        <div className="admin-modal-overlay" onClick={() => setBackupModalOpen(false)}>
          <div
            className="chakra-card"
            style={{ maxWidth: 480, width: '100%', position: 'relative' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '0.75rem',
              }}
            >
              <div style={{ fontWeight: 800, fontSize: '1.125rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle2 style={{ width: 20, height: 20, color: '#10b981' }} /> Emergency Backup Codes
              </div>
              <button
                type="button"
                className="chakra-button ghost"
                style={{ padding: 4 }}
                onClick={() => setBackupModalOpen(false)}
              >
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>

            <p style={{ fontSize: '0.8125rem', color: 'var(--chakra-colors-fg-muted)', marginBottom: '1rem' }}>
              Save these recovery codes in a secure password manager. If you lose access to your authenticator device, each code can be used once to access the admin portal.
            </p>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '0.5rem',
                fontFamily: 'var(--chakra-fonts-mono)',
                fontSize: '0.8125rem',
                background: 'var(--chakra-colors-bg-subtle)',
                padding: '1rem',
                borderRadius: 8,
                border: '1px solid var(--chakra-colors-border-subtle)',
                marginBottom: '1rem',
              }}
            >
              {backupCodes.map((c, i) => (
                <div key={i} style={{ fontWeight: 600 }}>
                  • {c}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                type="button"
                className="chakra-button subtle"
                onClick={() => {
                  navigator.clipboard.writeText(backupCodes.join('\n'));
                  showToast('Backup codes copied to clipboard');
                }}
              >
                <Copy style={{ width: 14, height: 14 }} /> Copy Codes
              </button>
              <button
                type="button"
                className="chakra-button solid"
                onClick={() => setBackupModalOpen(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
