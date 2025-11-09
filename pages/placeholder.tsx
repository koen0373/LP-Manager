import { useState } from 'react';
import Head from 'next/head';

// Build: 2025-11-09-v1
export default function Placeholder() {
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/placeholder/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pass }),
      });

      const data = await res.json();

      if (data.ok) {
        window.location.href = '/';
      } else {
        setError(data.reason || 'Invalid password');
      }
    } catch (err) {
      setError('Connection error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>LiquiLab — Preview Access</title>
      </Head>

      <main 
        className="min-h-screen flex items-center justify-center relative overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, #0a1628 0%, #1a2744 100%)',
        }}
      >
        {/* Wave Hero Background */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-40"
          style={{
            backgroundImage: 'url(/water-splash.webp)',
            filter: 'blur(2px)',
          }}
        />

        {/* Gradient Overlay */}
        <div 
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at center, transparent 0%, rgba(10, 22, 40, 0.8) 100%)',
          }}
        />

        {/* Content */}
        <div className="relative z-10 w-full max-w-md px-6">
          {/* Logo */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">
              Liqui<span style={{ color: '#00D9FF' }}>Lab</span>
            </h1>
            <p className="text-gray-300 text-sm">
              Preview Access
            </p>
          </div>

          {/* Login Card */}
          <div 
            className="backdrop-blur-xl rounded-2xl p-8 shadow-2xl"
            style={{
              background: 'rgba(11, 21, 48, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label 
                  htmlFor="password" 
                  className="block text-sm font-medium text-gray-200 mb-2"
                >
                  Access Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  placeholder="Enter preview password"
                  className="w-full px-4 py-3 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                  }}
                  disabled={loading}
                  autoFocus
                />
              </div>

              {error && (
                <div 
                  className="text-sm p-3 rounded-lg text-center"
                  style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#fca5a5',
                  }}
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !pass}
                className="w-full py-3 rounded-xl font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  background: 'linear-gradient(135deg, #2D6AE3 0%, #00D9FF 100%)',
                  boxShadow: '0 4px 20px rgba(45, 106, 227, 0.3)',
                }}
              >
                {loading ? 'Verifying...' : 'Enter Preview'}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-white/10 text-center">
              <p className="text-sm text-gray-400">
                Want access?{' '}
                <a 
                  href="mailto:hello@liquilab.io" 
                  className="text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Contact us
                </a>
              </p>
            </div>
          </div>

          {/* Footer Note */}
          <div className="mt-8 text-center">
            <p className="text-xs text-gray-500">
              © {new Date().getFullYear()} LiquiLab. All rights reserved.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}

