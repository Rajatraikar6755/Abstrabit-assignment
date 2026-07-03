'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Zap, KeyRound, AlertCircle, CheckCircle } from 'lucide-react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase/config';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await sendPasswordResetEmail(auth, email);
      setSuccess('A password reset email has been sent to your inbox!');
      setLoading(false);
    } catch (err: any) {
      console.error('Firebase Reset Error:', err);
      if (err.code === 'auth/user-not-found') {
        setError('No account found with this email address.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Invalid email address format.');
      } else {
        setError(err.message || 'Failed to send reset email. Please try again.');
      }
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      {/* Background */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: '30%', left: '50%', transform: 'translate(-50%, -50%)', width: '60%', height: '60%', background: 'radial-gradient(circle, rgba(6,182,212,0.06) 0%, transparent 60%)', borderRadius: '50%' }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="glass-card"
        style={{ width: '100%', maxWidth: 420, padding: 40, position: 'relative', zIndex: 10 }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32, justifyContent: 'center' }}>
          <div style={{ width: 40, height: 40, background: 'var(--accent-gradient)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={22} color="white" />
          </div>
          <span style={{ fontSize: 22, fontWeight: 700 }} className="gradient-text">CommandPulse</span>
        </div>

        <h1 style={{ fontSize: 24, fontWeight: 700, textAlign: 'center', marginBottom: 8 }}>Reset Password</h1>
        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginBottom: 32, fontSize: 14 }}>
          Enter your email to receive a secure password reset link
        </p>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(240,71,71,0.1)', border: '1px solid rgba(240,71,71,0.3)', borderRadius: 8, marginBottom: 20, fontSize: 14, color: 'var(--danger)' }}
          >
            <AlertCircle size={16} />
            {error}
          </motion.div>
        )}

        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(67,181,129,0.1)', border: '1px solid rgba(67,181,129,0.3)', borderRadius: 8, marginBottom: 20, fontSize: 14, color: 'var(--success)' }}
          >
            <CheckCircle size={16} />
            {success}
          </motion.div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>Email Address</label>
            <input
              type="email"
              className="input-field"
              placeholder="admin@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 20px' }}>
            {loading ? (
              <div className="animate-spin" style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%' }} />
            ) : (
              <><KeyRound size={18} /> Send Reset Link</>
            )}
          </button>

          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: 24, fontSize: 14 }}>
            Remembered your password?{' '}
            <span 
              onClick={() => router.push('/login')} 
              style={{ color: 'var(--primary)', cursor: 'pointer', fontWeight: 500, textDecoration: 'underline' }}
              className="hover-bright"
            >
              Sign In
            </span>
          </p>
        </form>
      </motion.div>
    </div>
  );
}
