'use client';

import { QRCodeCanvas } from 'qrcode.react';
import { FC } from 'react';

interface QRGeneratorProps {
  sesionId: string;
}

export const QRGenerator: FC<QRGeneratorProps> = ({ sesionId }) => {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const qrUrl = `${origin}/estudiante/sesion/${sesionId}`;

  return (
    <div className="flex flex-col items-center justify-center p-8 bg-surface rounded-[2rem] shadow-sm border border-subtle ios-shadow">
      <h2 className="text-[22px] font-semibold tracking-tight text-foreground mb-6">
         Escanear para Asistencia
      </h2>
      <div className="p-4 bg-surface rounded-2xl shadow-sm border border-subtle">
         <QRCodeCanvas 
           value={qrUrl} 
           size={260} 
           level="H" 
           includeMargin={false}
           className="rounded-xl"
         />
      </div>
      <p className="mt-8 text-sm text-muted text-center max-w-[240px]">
        Los estudiantes deben escanear este código para registrar su presente.
      </p>
    </div>
  );
};
