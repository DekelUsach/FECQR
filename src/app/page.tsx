'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) router.push('/profesor/dashboard');
    });
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-semibold tracking-tight text-foreground mb-3">
          Asistencia FECQR
        </h1>
        <p className="text-lg text-muted max-w-sm mx-auto leading-relaxed">
          Control de asistencia inteligente mediante códigos QR dinámicos.
        </p>
      </div>

      <div className="w-full max-w-xs space-y-3">
        <Link
          href="/login"
          className="flex items-center justify-between w-full py-4 px-5 bg-surface hover:bg-surface-hover text-[#007AFF] font-medium rounded-2xl transition-all shadow-sm active:scale-[0.98]"
        >
          <span>Acceso Docente</span>
          <ArrowRight size={20} className="text-[#007AFF]/60" />
        </Link>
        {/* 
        <Link
          href="/admin"
          className="flex items-center justify-between w-full py-4 px-5 bg-surface hover:bg-surface-hover text-muted font-medium rounded-2xl transition-all shadow-sm active:scale-[0.98]"
        >
          <span>Panel de Administración</span>
          <ArrowRight size={20} className="text-muted/60" />
        </Link> */}
      </div>
    </div>
  );
}
