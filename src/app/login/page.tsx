'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) router.push('/profesor/dashboard');
    });
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) throw signInError;
      router.push('/profesor/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
      <div className="w-full max-w-sm mb-8 text-center">
        <h2 className="text-3xl font-semibold tracking-tight text-foreground">
          Bienvenido
        </h2>
        <p className="text-muted mt-2">Acceso a profesores</p>
        <div className="mt-4 flex justify-center mt-6">
          <ThemeToggle />
        </div>
      </div>

      <div className="w-full max-w-sm">
        {error && (
          <div className="mb-4 p-3 bg-red-100/50 text-[#FF3B30] rounded-xl text-center text-sm font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="bg-surface rounded-2xl overflow-hidden shadow-sm border border-subtle">
            <input 
              type="email" 
              required 
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-4 border-b border-subtle bg-transparent text-foreground focus:outline-none focus:bg-surface-hover/50 transition-colors placeholder:text-placeholder"
              placeholder="Email: profesor@test.com"
            />
            <input 
              type="password" 
              required 
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-4 bg-transparent text-foreground focus:outline-none focus:bg-surface-hover/50 transition-colors placeholder:text-placeholder"
              placeholder="Contraseña"
            />
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-[#007AFF] hover:bg-[#007AFF]/90 text-white font-semibold py-4 px-4 rounded-xl transition-all disabled:opacity-50 active:scale-[0.98]"
          >
            {loading ? 'Ingresando...' : 'Iniciar Sesión'}
          </button>
        </form>
      </div>
    </div>
  );
}
