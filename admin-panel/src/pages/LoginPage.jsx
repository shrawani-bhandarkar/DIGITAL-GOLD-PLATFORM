import { useState } from 'react';
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import useDocumentTitle from '../hooks/useDocumentTitle.js';

export default function LoginPage() {
  useDocumentTitle('Sign in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [touched, setTouched] = useState({});
  const { login, authError } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const emailError = touched.email && (!email.trim() ? 'Email is required.' : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? 'Enter a valid email address.' : '');
  const passwordError = touched.password && !password ? 'Password is required.' : '';

  async function submit(event) {
    event.preventDefault();
    setTouched({ email: true, password: true });
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password) return;
    setIsSubmitting(true);
    setError('');
    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch (loginError) {
      setError(loginError.message || 'Sign in failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-showcase">
        <div className="login-showcase-inner">
          <div className="login-brand"><span className="brand-mark"><Sparkles size={20} /></span><span>aurum<span>admin</span></span></div>
          <div className="showcase-content">
            <div className="showcase-kicker"><span /> BUILT FOR CONFIDENT OPERATIONS</div>
            <h1>Clarity for every<br /><span>golden</span> decision.</h1>
            <p>A thoughtful command center for managing customers, transactions, and the details that build trust.</p>
            <div className="showcase-orbit" aria-hidden="true">
              <div className="orbit-ring orbit-ring-outer" /><div className="orbit-ring orbit-ring-inner" />
              <div className="orbit-core"><Sparkles size={31} /></div>
              <span className="orbit-dot dot-one" /><span className="orbit-dot dot-two" /><span className="orbit-dot dot-three" />
            </div>
          </div>
          <div className="showcase-footer"><ShieldCheck size={16} /> Secure workspace <span>·</span> Digital Gold Platform</div>
        </div>
      </section>
      <section className="login-panel">
        <div className="login-form-wrap">
          <div className="mobile-login-brand"><span className="brand-mark"><Sparkles size={19} /></span><span>aurum<span>admin</span></span></div>
          <div className="login-heading">
            <div className="welcome-tag"><span className="welcome-tag-dot" /> ADMIN PORTAL</div>
            <h2>Welcome back</h2>
            <p>Sign in to your administration workspace.</p>
          </div>

          <div className="demo-banner"><span className="demo-banner-icon"><ShieldCheck size={17} /></span><div><strong>Administrator sign-in</strong><span>Use the administrator account provisioned for your platform.</span></div></div>
          <form className="login-form" onSubmit={submit} noValidate>
            <label className="form-label" htmlFor="email">Email address</label>
            <div className={`input-wrap ${emailError ? 'input-error' : ''}`}>
              <Mail size={17} /><input id="email" type="email" autoComplete="username" placeholder="name@company.com" value={email} onChange={(event) => { setEmail(event.target.value); setError(''); }} onBlur={() => setTouched((current) => ({ ...current, email: true }))} aria-invalid={Boolean(emailError)} aria-describedby={emailError ? 'email-error' : undefined} />
            </div>
            {emailError && <span className="field-error" id="email-error">{emailError}</span>}
            <div className="password-label-row"><label className="form-label" htmlFor="password">Password</label></div>
            <div className={`input-wrap ${passwordError ? 'input-error' : ''}`}>
              <LockKeyhole size={17} /><input id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password" value={password} onChange={(event) => { setPassword(event.target.value); setError(''); }} onBlur={() => setTouched((current) => ({ ...current, password: true }))} aria-invalid={Boolean(passwordError)} aria-describedby={passwordError ? 'password-error' : undefined} />
              <button type="button" className="password-toggle" onClick={() => setShowPassword((shown) => !shown)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
            </div>
            {passwordError && <span className="field-error" id="password-error">{passwordError}</span>}
            {(error || authError) && <div className="login-error" role="alert">{error || authError}</div>}
            <button className="button button-login" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Signing in…' : 'Sign in to workspace'} {!isSubmitting && <ArrowRight size={17} />}</button>
          </form>
          <p className="login-security-note"><LockKeyhole size={13} /> Access is verified by the platform server.</p>
        </div>
        <div className="login-copyright">© 2026 Digital Gold Platform <span>·</span> Admin Console</div>
      </section>
    </main>
  );
}
