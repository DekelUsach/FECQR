import * as XLSX from 'xlsx';

export interface FilaAsistencia {
  nombre: string;
  estado: 'Presente' | 'Tarde' | 'Ausente';
  horaEscaneo: string;
}

export interface MetadatosSesion {
  materia: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
}

const ESTADO_STYLE: Record<string, { font: object; fill: object }> = {
  Presente: {
    font: { bold: true, color: { rgb: '1B5E20' } },
    fill: { fgColor: { rgb: 'E8F5E9' }, patternType: 'solid' },
  },
  Tarde: {
    font: { bold: true, color: { rgb: '7B4700' } },
    fill: { fgColor: { rgb: 'FFF8E1' }, patternType: 'solid' },
  },
  Ausente: {
    font: { bold: true, color: { rgb: 'B71C1C' } },
    fill: { fgColor: { rgb: 'FFEBEE' }, patternType: 'solid' },
  },
};

const HEADER_STYLE = {
  font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
  fill: { fgColor: { rgb: '1565C0' }, patternType: 'solid' },
  alignment: { horizontal: 'center', vertical: 'center' },
  border: {
    top: { style: 'thin', color: { rgb: 'FFFFFF' } },
    bottom: { style: 'thin', color: { rgb: 'FFFFFF' } },
  },
};

const TITLE_STYLE = {
  font: { bold: true, sz: 14, color: { rgb: '0D47A1' } },
  alignment: { horizontal: 'center', vertical: 'center' },
};

const META_LABEL_STYLE = {
  font: { bold: true, color: { rgb: '455A64' } },
  fill: { fgColor: { rgb: 'ECEFF1' }, patternType: 'solid' },
};

const META_VALUE_STYLE = {
  font: { color: { rgb: '1C1C1E' } },
};

function applyStyle(ws: XLSX.WorkSheet, cellRef: string, style: object) {
  if (!ws[cellRef]) ws[cellRef] = { t: 's', v: '' };
  ws[cellRef].s = style;
}

function cellRef(row: number, col: number): string {
  const colLetter = XLSX.utils.encode_col(col);
  return `${colLetter}${row}`;
}

export function exportarAsistenciaExcel(
  filas: FilaAsistencia[],
  meta: MetadatosSesion
): void {
  const wb = XLSX.utils.book_new();

  // Construir las filas de la hoja manualmente para tener control total
  const wsData: any[][] = [
    // Fila 1: título principal (se mergea luego)
    [`REGISTRO DE ASISTENCIA — ${meta.materia.toUpperCase()}`],
    [],
    // Fila 3: metadatos
    ['Materia:', meta.materia, '', 'Fecha:', meta.fecha],
    ['Hora de inicio:', meta.horaInicio, '', 'Hora de fin:', meta.horaFin],
    [],
    // Fila 6: cabeceras de tabla
    ['#', 'Nombre del Alumno', 'Estado', 'Hora de Registro'],
    // Filas de datos
    ...filas.map((f, i) => [i + 1, f.nombre, f.estado, f.horaEscaneo]),
    [],
    // Pie de página
    [`Total alumnos: ${filas.length}`, '',
      `Presentes: ${filas.filter(f => f.estado === 'Presente').length}`,
      `Tardes: ${filas.filter(f => f.estado === 'Tarde').length}`,
      `Ausentes: ${filas.filter(f => f.estado === 'Ausente').length}`],
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Anchos de columna
  ws['!cols'] = [
    { wch: 5 },   // #
    { wch: 32 },  // Nombre
    { wch: 14 },  // Estado
    { wch: 20 },  // Hora
    { wch: 16 },  // (extra para metadatos)
  ];

  // Merge: título en fila 1 (A1:E1)
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
  ];

  // --- Estilos ---

  // Título
  applyStyle(ws, 'A1', TITLE_STYLE);

  // Metadatos
  (['A3', 'D3', 'A4', 'D4'] as const).forEach(c => applyStyle(ws, c, META_LABEL_STYLE));
  (['B3', 'E3', 'B4', 'E4'] as const).forEach(c => applyStyle(ws, c, META_VALUE_STYLE));

  // Cabeceras de tabla (fila 6 = índice 5 → row 6 en hoja)
  [0, 1, 2, 3].forEach(col => applyStyle(ws, cellRef(6, col), HEADER_STYLE));

  // Filas de datos
  filas.forEach((fila, i) => {
    const row = 7 + i; // filas empiezan en 7
    const estilo = ESTADO_STYLE[fila.estado];

    // Nro y nombre con borde sutil
    const baseCellStyle = {
      alignment: { vertical: 'center' },
      border: { bottom: { style: 'hair', color: { rgb: 'BDBDBD' } } },
    };

    [0, 1].forEach(col => applyStyle(ws, cellRef(row, col), baseCellStyle));

    // Estado con color
    applyStyle(ws, cellRef(row, 2), {
      ...estilo,
      alignment: { horizontal: 'center', vertical: 'center' },
      border: { bottom: { style: 'hair', color: { rgb: 'BDBDBD' } } },
    });

    // Hora
    applyStyle(ws, cellRef(row, 3), {
      alignment: { horizontal: 'center', vertical: 'center' },
      border: { bottom: { style: 'hair', color: { rgb: 'BDBDBD' } } },
    });

    // Filas alternas con fondo muy suave
    if (i % 2 === 0 && fila.estado === 'Ausente' === false) return;
    if (fila.estado !== 'Ausente' && fila.estado !== 'Tarde') {
      [0, 1, 3].forEach(col =>
        applyStyle(ws, cellRef(row, col), {
          ...baseCellStyle,
          fill: { fgColor: { rgb: 'FAFAFA' }, patternType: 'solid' },
        })
      );
    }
  });

  XLSX.utils.book_append_sheet(wb, ws, 'Asistencia');

  const filename = `Asistencia_${meta.materia.replace(/\s+/g, '_')}_${meta.fecha}.xlsx`;
  XLSX.writeFile(wb, filename);
}
