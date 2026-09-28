import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { useAdmin } from '../context/AdminContext.js';
import { Shield, Lock, Mail, Eye, EyeOff, Smartphone, ArrowRight, ArrowLeft, Sparkles, AlertCircle, } from 'lucide-react';
export const LoginView = () => {
    const { config, login, showToast } = useAdmin();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [totpCode, setTotpCode] = useState('');
    const [requires2fa, setRequires2fa] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState(null);
    const handleDemoFill = (demoEmail, demoPass) => {
        setEmail(demoEmail);
        setPassword(demoPass);
        setErrorMessage(null);
    };
    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMessage(null);
        setIsLoading(true);
        try {
            const res = await login(email, password, requires2fa ? totpCode : undefined);
            if (res?.requires2fa) {
                setRequires2fa(true);
                showToast('2FA verification required. Please enter your 6-digit authenticator code.', 'info');
            }
            else {
                showToast(`Welcome back! Logged in as ${email}`);
            }
        }
        catch (err) {
            setErrorMessage(err.message || 'Authentication failed. Please check your credentials.');
        }
        finally {
            setIsLoading(false);
        }
    };
    return (_jsx("div", { style: {
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
            background: 'radial-gradient(ellipse at top, rgba(13, 148, 136, 0.15), transparent 70%), radial-gradient(ellipse at bottom, rgba(14, 165, 233, 0.1), transparent 70%), var(--chakra-colors-bg-default)',
        }, children: _jsxs("div", { className: "chakra-card", style: {
                maxWidth: 440,
                width: '100%',
                padding: '2.25rem',
                borderRadius: 16,
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px var(--chakra-colors-border-subtle)',
                backdropFilter: 'blur(16px)',
            }, children: [_jsxs("div", { style: { textAlign: 'center', marginBottom: '1.75rem' }, children: [_jsx("div", { style: {
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
                            }, children: "JS" }), _jsx("h1", { style: { fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.025em' }, children: config.title }), _jsx("p", { style: { fontSize: '0.8125rem', color: 'var(--chakra-colors-fg-muted)', marginTop: 4 }, children: requires2fa
                                ? 'Two-Step Authenticator Verification'
                                : 'Sign in to access the administrator platform' })] }), errorMessage && (_jsxs("div", { style: {
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
                    }, children: [_jsx(AlertCircle, { style: { width: 16, height: 16, flexShrink: 0, marginTop: 1 } }), _jsx("span", { children: errorMessage })] })), _jsx("form", { onSubmit: handleSubmit, children: !requires2fa ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "chakra-field", children: [_jsx("label", { htmlFor: "login-email", style: { fontSize: '0.8125rem', fontWeight: 600 }, children: "Email or Username" }), _jsxs("div", { style: { position: 'relative' }, children: [_jsx(Mail, { style: {
                                                    position: 'absolute',
                                                    left: 12,
                                                    top: '50%',
                                                    transform: 'translateY(-50%)',
                                                    width: 16,
                                                    height: 16,
                                                    color: 'var(--chakra-colors-fg-muted)',
                                                } }), _jsx("input", { id: "login-email", type: "text", required: true, autoFocus: true, autoComplete: "username", className: "chakra-input", placeholder: "admin@jsango.dev", value: email, onChange: (e) => setEmail(e.target.value), style: { paddingLeft: '2.35rem' } })] })] }), _jsxs("div", { className: "chakra-field", children: [_jsx("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, children: _jsx("label", { htmlFor: "login-password", style: { fontSize: '0.8125rem', fontWeight: 600 }, children: "Password" }) }), _jsxs("div", { style: { position: 'relative' }, children: [_jsx(Lock, { style: {
                                                    position: 'absolute',
                                                    left: 12,
                                                    top: '50%',
                                                    transform: 'translateY(-50%)',
                                                    width: 16,
                                                    height: 16,
                                                    color: 'var(--chakra-colors-fg-muted)',
                                                } }), _jsx("input", { id: "login-password", type: showPassword ? 'text' : 'password', required: true, autoComplete: "current-password", className: "chakra-input", placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022", value: password, onChange: (e) => setPassword(e.target.value), style: { paddingLeft: '2.35rem', paddingRight: '2.5rem' } }), _jsx("button", { type: "button", tabIndex: -1, onClick: () => setShowPassword(!showPassword), style: {
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
                                                }, children: showPassword ? (_jsx(EyeOff, { style: { width: 16, height: 16 } })) : (_jsx(Eye, { style: { width: 16, height: 16 } })) })] })] }), _jsx("button", { type: "submit", className: "chakra-button solid", disabled: isLoading, style: {
                                    width: '100%',
                                    marginTop: '0.75rem',
                                    padding: '0.75rem 1rem',
                                    fontSize: '0.9375rem',
                                    fontWeight: 700,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.5rem',
                                }, children: isLoading ? ('Signing in...') : (_jsxs(_Fragment, { children: [_jsx("span", { children: "Sign In to Admin" }), _jsx(ArrowRight, { style: { width: 16, height: 16 } })] })) }), _jsxs("div", { style: {
                                    marginTop: '1.5rem',
                                    paddingTop: '1.25rem',
                                    borderTop: '1px solid var(--chakra-colors-border-subtle)',
                                    textAlign: 'center',
                                }, children: [_jsxs("div", { style: {
                                            fontSize: '0.75rem',
                                            color: 'var(--chakra-colors-fg-muted)',
                                            marginBottom: '0.6rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: 4,
                                        }, children: [_jsx(Sparkles, { style: { width: 13, height: 13, color: '#f59e0b' } }), _jsx("span", { children: "Quick Demo Credentials" })] }), _jsxs("div", { style: { display: 'flex', gap: '0.5rem', justifyContent: 'center' }, children: [_jsx("button", { type: "button", className: "chakra-button subtle", style: { fontSize: '0.75rem', padding: '4px 10px' }, onClick: () => handleDemoFill('admin@jsango.dev', 'admin123'), children: "\uD83D\uDC51 Superuser" }), _jsx("button", { type: "button", className: "chakra-button subtle", style: { fontSize: '0.75rem', padding: '4px 10px' }, onClick: () => handleDemoFill('staff@jsango.dev', 'staff123'), children: "\uD83D\uDEE1\uFE0F Staff" })] })] })] })) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: "chakra-field", style: { textAlign: 'center' }, children: [_jsx("div", { style: {
                                            width: 48,
                                            height: 48,
                                            borderRadius: 9999,
                                            background: 'rgba(13, 148, 136, 0.15)',
                                            color: '#0d9488',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            marginBottom: '0.75rem',
                                        }, children: _jsx(Smartphone, { style: { width: 24, height: 24 } }) }), _jsx("label", { htmlFor: "login-totp", style: { fontSize: '0.875rem', fontWeight: 700, display: 'block' }, children: "Enter 6-Digit Authenticator Code" }), _jsx("p", { style: { fontSize: '0.75rem', color: 'var(--chakra-colors-fg-muted)', marginBottom: '1rem' }, children: "Open your Authenticator app and enter the code, or use an emergency recovery backup code." }), _jsx("input", { id: "login-totp", type: "text", maxLength: 9, autoFocus: true, required: true, className: "chakra-input", placeholder: "123456", value: totpCode, onChange: (e) => setTotpCode(e.target.value), style: {
                                            letterSpacing: '0.3em',
                                            fontSize: '1.25rem',
                                            textAlign: 'center',
                                            fontFamily: 'var(--chakra-fonts-mono)',
                                            fontWeight: 700,
                                        } })] }), _jsxs("div", { style: { display: 'flex', gap: '0.5rem', marginTop: '1rem' }, children: [_jsxs("button", { type: "button", className: "chakra-button subtle", style: { flex: 1 }, onClick: () => {
                                            setRequires2fa(false);
                                            setTotpCode('');
                                        }, children: [_jsx(ArrowLeft, { style: { width: 14, height: 14 } }), " Back"] }), _jsx("button", { type: "submit", className: "chakra-button solid", disabled: isLoading || totpCode.length < 6, style: { flex: 2 }, children: isLoading ? 'Verifying...' : 'Verify & Sign In' })] })] })) }), _jsxs("div", { style: {
                        marginTop: '1.5rem',
                        textAlign: 'center',
                        fontSize: '0.6875rem',
                        color: 'var(--chakra-colors-fg-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                    }, children: [_jsx(Shield, { style: { width: 12, height: 12, color: 'var(--chakra-colors-brand-fg)' } }), _jsx("span", { children: "Protected by JSango Security Framework" })] })] }) }));
};
//# sourceMappingURL=LoginView.js.map