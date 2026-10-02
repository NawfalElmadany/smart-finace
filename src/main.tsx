import {StrictMode, useEffect, useState, type FormEvent} from 'react';
import {createRoot} from 'react-dom/client';
import type {Session} from '@supabase/supabase-js';
import {Eye, EyeOff} from 'lucide-react';
import FinanceApp from './App.tsx';
import {isSupabaseConfigured, supabase} from './lib/supabase';
import './index.css';

const USERNAME_REGEX = /^[a-z0-9._-]{3,32}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REMEMBER_EMAIL_KEY = 'sf_auth_remembered_email';
const RESET_PASSWORD_PATH = '/reset-password';

const normalizeUsername = (value: string) => value.trim().toLowerCase();
const normalizeEmail = (value: string) => value.trim().toLowerCase();

const isRecoveryUrl = () => {
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const searchParams = new URLSearchParams(window.location.search);

  return (
    hashParams.get('type') === 'recovery' ||
    searchParams.get('type') === 'recovery' ||
    (window.location.pathname === RESET_PASSWORD_PATH && Boolean(hashParams.get('access_token')))
  );
};

function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState(() => localStorage.getItem(REMEMBER_EMAIL_KEY) ?? '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);
  const [rememberEmail, setRememberEmail] = useState(() => Boolean(localStorage.getItem(REMEMBER_EMAIL_KEY)));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResendingVerification, setIsResendingVerification] = useState(false);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState('');
  const [notice, setNotice] = useState('');

  const persistRememberedEmail = (nextEmail: string) => {
    if (rememberEmail) {
      localStorage.setItem(REMEMBER_EMAIL_KEY, nextEmail);
      return;
    }

    localStorage.removeItem(REMEMBER_EMAIL_KEY);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!supabase) {
      return;
    }

    const normalizedEmail = normalizeEmail(email);
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      setNotice('Masukkan email yang valid.');
      return;
    }

    if (mode === 'forgot') {
      persistRememberedEmail(normalizedEmail);
      setIsSubmitting(true);
      setNotice('');

      const {error} = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: `${window.location.origin}${RESET_PASSWORD_PATH}`,
      });

      if (error) {
        setNotice(`Gagal kirim reset password: ${error.message}`);
      } else {
        setNotice('Link reset password sudah dikirim. Cek inbox/spam email kamu.');
      }

      setIsSubmitting(false);
      return;
    }

    if (password.length < 6) {
      setNotice('Password minimal 6 karakter.');
      return;
    }

    if (mode === 'register') {
      const normalizedUsername = normalizeUsername(username);
      if (!normalizedUsername) {
        setNotice('Masukkan username terlebih dahulu.');
        return;
      }

      if (!USERNAME_REGEX.test(normalizedUsername)) {
        setNotice('Username hanya boleh huruf kecil, angka, titik, underscore, atau minus (3-32 karakter).');
        return;
      }

      if (password !== confirmPassword) {
        setNotice('Konfirmasi password belum sama.');
        return;
      }
    }

    persistRememberedEmail(normalizedEmail);
    setIsSubmitting(true);
    setNotice('');

    if (mode === 'login') {
      const {data, error} = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (error) {
        if (error.message.toLowerCase().includes('email not confirmed')) {
          setPendingVerificationEmail(normalizedEmail);
          setNotice('Email kamu belum diverifikasi. Cek inbox lalu klik link verifikasi.');
        } else {
          setNotice(`Login gagal: ${error.message}`);
        }
        setIsSubmitting(false);
        return;
      }

      if (data.user && !data.user.email_confirmed_at) {
        await supabase.auth.signOut();
        setPendingVerificationEmail(normalizedEmail);
        setNotice('Email kamu belum diverifikasi. Cek inbox lalu klik link verifikasi.');
      }

      setIsSubmitting(false);
      return;
    }

    const normalizedUsername = normalizeUsername(username);
    const {data, error} = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          username: normalizedUsername,
        },
      },
    });

    if (error) {
      setNotice(`Daftar gagal: ${error.message}`);
      setIsSubmitting(false);
      return;
    }

    const isEmailConfirmed = Boolean(data.user?.email_confirmed_at);
    if (isEmailConfirmed && data.session?.user) {
      setNotice('Akun berhasil dibuat dan kamu sudah login.');
    } else {
      setPendingVerificationEmail(normalizedEmail);
      setNotice('Akun berhasil dibuat. Cek email untuk verifikasi, lalu kembali login.');
      setMode('login');
      setPassword('');
      setConfirmPassword('');
    }

    setIsSubmitting(false);
  };

  const handleResendVerification = async () => {
    if (!supabase) {
      return;
    }

    const targetEmail = normalizeEmail(pendingVerificationEmail || email);
    if (!EMAIL_REGEX.test(targetEmail)) {
      setNotice('Masukkan email valid untuk kirim ulang verifikasi.');
      return;
    }

    setIsResendingVerification(true);

    const {error} = await supabase.auth.resend({
      type: 'signup',
      email: targetEmail,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) {
      setNotice(`Gagal kirim ulang verifikasi: ${error.message}`);
    } else {
      setPendingVerificationEmail(targetEmail);
      setNotice('Email verifikasi sudah dikirim ulang. Cek inbox/spam.');
    }

    setIsResendingVerification(false);
  };

  return (
    <div className="premium-auth-shell">
      <div className="premium-auth-card">
        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#8D96A5]">Supabase Login</p>
          <h1 className="text-[34px] leading-[1.05] font-bold text-[#111827]">
            {mode === 'login' ? 'Masuk dengan Email' : mode === 'register' ? 'Buat Akun Baru' : 'Reset Password'}
          </h1>
          <p className="text-sm text-[#6F7888]">
            {mode === 'forgot'
              ? 'Masukkan email, lalu kami kirim link verifikasi untuk ganti password.'
              : 'Data keuangan akan disimpan aman per akun pengguna.'}
          </p>
        </div>

        <form className="space-y-3.5" onSubmit={handleSubmit}>
          {mode === 'register' && (
            <input
              type="text"
              name="username"
              autoComplete="username"
              required
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="username (contoh: nawfal)"
              className="premium-input"
            />
          )}

          <input
            type="email"
            name="email"
            autoComplete={mode === 'login' ? 'email' : 'username'}
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="email aktif (contoh: kamu@email.com)"
            className="premium-input"
          />

          {mode !== 'forgot' && (
            <div className="relative">
              <input
                type={isPasswordVisible ? 'text' : 'password'}
                name="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
                minLength={6}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="password minimal 6 karakter"
                className="premium-input pr-12"
              />
              <button
                type="button"
                onClick={() => setIsPasswordVisible((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-[#8390A3] hover:text-[#1A74FF] transition-colors"
                aria-label={isPasswordVisible ? 'Sembunyikan password' : 'Tampilkan password'}
              >
                {isPasswordVisible ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          )}

          {mode === 'register' && (
            <div className="relative">
              <input
                type={isConfirmPasswordVisible ? 'text' : 'password'}
                name="confirmPassword"
                autoComplete="new-password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="ulangi password"
                className="premium-input pr-12"
              />
              <button
                type="button"
                onClick={() => setIsConfirmPasswordVisible((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-[#8390A3] hover:text-[#1A74FF] transition-colors"
                aria-label={isConfirmPasswordVisible ? 'Sembunyikan konfirmasi password' : 'Tampilkan konfirmasi password'}
              >
                {isConfirmPasswordVisible ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          )}

          {mode === 'login' && (
            <label className="flex items-center gap-2 text-sm text-[#657085]">
              <input
                type="checkbox"
                className="accent-[#1A74FF]"
                checked={rememberEmail}
                onChange={(event) => {
                  const shouldRemember = event.target.checked;
                  setRememberEmail(shouldRemember);

                  if (!shouldRemember) {
                    localStorage.removeItem(REMEMBER_EMAIL_KEY);
                  } else if (email.trim()) {
                    localStorage.setItem(REMEMBER_EMAIL_KEY, normalizeEmail(email));
                  }
                }}
              />
              Ingat email di perangkat ini
            </label>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="premium-primary-btn"
          >
            {isSubmitting ? 'Memproses...' : mode === 'login' ? 'Masuk' : mode === 'register' ? 'Daftar' : 'Kirim Link Reset'}
          </button>
        </form>

        {mode !== 'forgot' && (
          <p className="text-xs text-[#6F7888]">
            Agar password tersimpan, pilih <span className="font-semibold">Save password</span> saat browser meminta.
          </p>
        )}

        {mode === 'login' && (
          <>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setNotice('');
                setIsPasswordVisible(false);
                setIsConfirmPasswordVisible(false);
              }}
              className="premium-link-btn"
            >
              Belum punya akun? Daftar
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('forgot');
                setNotice('');
                setPassword('');
                setConfirmPassword('');
                setIsPasswordVisible(false);
                setIsConfirmPasswordVisible(false);
              }}
              className="premium-link-btn text-[#0F766E] hover:text-[#0b655c]"
            >
              Lupa password?
            </button>
          </>
        )}

        {mode === 'register' && (
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setNotice('');
              setPassword('');
              setConfirmPassword('');
              setIsPasswordVisible(false);
              setIsConfirmPasswordVisible(false);
            }}
            className="premium-link-btn"
          >
            Sudah punya akun? Masuk
          </button>
        )}

        {mode === 'forgot' && (
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setNotice('');
              setPassword('');
              setConfirmPassword('');
              setIsPasswordVisible(false);
              setIsConfirmPasswordVisible(false);
            }}
            className="premium-link-btn"
          >
            Kembali ke login
          </button>
        )}

        {pendingVerificationEmail && (
          <button
            type="button"
            disabled={isResendingVerification}
            onClick={() => {
              void handleResendVerification();
            }}
            className="premium-link-btn text-[#0F766E] hover:text-[#0b655c] disabled:opacity-60"
          >
            {isResendingVerification ? 'Mengirim ulang...' : `Kirim ulang verifikasi ke ${pendingVerificationEmail}`}
          </button>
        )}

        {notice && <p className="premium-notice">{notice}</p>}
      </div>
    </div>
  );
}

function PasswordRecoveryScreen({onDone}: {onDone: () => void}) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState('');

  const handleUpdatePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!supabase) {
      return;
    }

    if (password.length < 6) {
      setNotice('Password baru minimal 6 karakter.');
      return;
    }

    if (password !== confirmPassword) {
      setNotice('Konfirmasi password belum sama.');
      return;
    }

    setIsSubmitting(true);
    setNotice('');

    const {error} = await supabase.auth.updateUser({password});
    if (error) {
      setNotice(`Gagal mengubah password: ${error.message}`);
      setIsSubmitting(false);
      return;
    }

    setNotice('Password berhasil diubah. Silakan login ulang dengan password baru.');
    await supabase.auth.signOut();
    onDone();
    setIsSubmitting(false);
  };

  return (
    <div className="premium-auth-shell">
      <div className="premium-auth-card">
        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#8D96A5]">Reset Password</p>
          <h1 className="text-[34px] leading-[1.05] font-bold text-[#111827]">Buat Password Baru</h1>
          <p className="text-sm text-[#6F7888]">Verifikasi email berhasil. Sekarang masukkan password baru.</p>
        </div>

        <form className="space-y-3.5" onSubmit={handleUpdatePassword}>
          <div className="relative">
            <input
              type={isPasswordVisible ? 'text' : 'password'}
              name="newPassword"
              autoComplete="new-password"
              required
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="password baru minimal 6 karakter"
              className="premium-input pr-12"
            />
            <button
              type="button"
              onClick={() => setIsPasswordVisible((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-[#8390A3] hover:text-[#1A74FF] transition-colors"
              aria-label={isPasswordVisible ? 'Sembunyikan password baru' : 'Tampilkan password baru'}
            >
              {isPasswordVisible ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          <div className="relative">
            <input
              type={isConfirmPasswordVisible ? 'text' : 'password'}
              name="confirmNewPassword"
              autoComplete="new-password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="ulangi password baru"
              className="premium-input pr-12"
            />
            <button
              type="button"
              onClick={() => setIsConfirmPasswordVisible((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-[#8390A3] hover:text-[#1A74FF] transition-colors"
              aria-label={isConfirmPasswordVisible ? 'Sembunyikan konfirmasi password baru' : 'Tampilkan konfirmasi password baru'}
            >
              {isConfirmPasswordVisible ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="premium-primary-btn"
          >
            {isSubmitting ? 'Memproses...' : 'Simpan Password Baru'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            void supabase?.auth.signOut();
            onDone();
          }}
          className="premium-link-btn"
        >
          Kembali ke login
        </button>

        {notice && <p className="premium-notice">{notice}</p>}
      </div>
    </div>
  );
}

function RootApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(isSupabaseConfigured);
  const [isRecoveryMode, setIsRecoveryMode] = useState(() => isRecoveryUrl());

  useEffect(() => {
    if (!supabase || !isSupabaseConfigured) {
      setIsCheckingSession(false);
      return;
    }

    let isActive = true;
    const searchParams = new URLSearchParams(window.location.search);
    const code = searchParams.get('code');

    if (code) {
      void supabase.auth.exchangeCodeForSession(code).then(({error}) => {
        if (!isActive || error) return;
        if (isRecoveryUrl()) {
          setIsRecoveryMode(true);
        }
      });
    } else if (isRecoveryUrl()) {
      setIsRecoveryMode(true);
    }

    supabase.auth.getSession().then(({data}) => {
      if (!isActive) return;
      setSession(data.session ?? null);
      setIsCheckingSession(false);
    });

    const {
      data: {subscription},
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      setIsCheckingSession(false);
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecoveryMode(true);
      }
      if (event === 'SIGNED_OUT') {
        setIsRecoveryMode(false);
      }
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, []);

  if (!isSupabaseConfigured) {
    return <FinanceApp userId={null} />;
  }

  if (isCheckingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[#6F7888] font-semibold">
        Mengecek sesi login...
      </div>
    );
  }

  if (isRecoveryMode) {
    return (
      <PasswordRecoveryScreen
        onDone={() => {
          setIsRecoveryMode(false);
          window.history.replaceState({}, document.title, '/');
        }}
      />
    );
  }

  if (!session?.user?.id) {
    return <AuthScreen />;
  }

  return (
    <FinanceApp
      userId={session.user.id}
      onSignOut={() => {
        void supabase?.auth.signOut();
      }}
    />
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootApp />
  </StrictMode>,
);
