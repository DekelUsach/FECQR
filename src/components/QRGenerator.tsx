'use client';

import { QRCodeCanvas } from 'qrcode.react';
import { FC } from 'react';

interface QRGeneratorProps {
  sesionId: string;
}

export const QRGenerator: FC<QRGeneratorProps> = ({ sesionId }) => {
  const qrUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/estudiante/sesion/${sesionId}`;

  return (
    <div className="flex flex-col items-center justify-center p-8 bg-white rounded-[2rem] shadow-sm border border-gray-100 ios-shadow">
      <h2 className="text-[22px] font-semibold tracking-tight text-[#1C1C1E] mb-6">
         Escanear para Asistencia
      </h2>
      <div className="p-4 bg-white rounded-2xl shadow-sm border border-gray-100">
         <QRCodeCanvas 
           value={qrUrl} 
           size={260} 
           level="H" 
           includeMargin={false}
           className="rounded-xl"
         />
      </div>
      <p className="mt-8 text-sm text-[#8E8E93] text-center max-w-[240px]">
        Los estudiantes deben escanear este código para registrar su presente.
      </p>
    </div>
  );
};
