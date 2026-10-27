/**
 * Riesgo por distrito en Lima Metropolitana y Callao.
 *
 * Nivel = según la tasa de homicidios por 10 mil habitantes de ene–ago 2025
 * (≥ 1.0 muy alto, 0.5–1.0 alto, < 0.5 medio), subiendo a "alto" los distritos
 * que lideran robos o extorsiones (ene–abr 2025) aunque su tasa sea menor.
 */
export type DistrictLevel = 'muy_alto' | 'alto' | 'medio';

export interface DistrictRisk {
  distrito: string;
  provincia: 'Lima' | 'Callao';
  nivel: DistrictLevel;
  homicidios2025?: number; // ene–ago 2025
  tasa2025?: number; // por 10 mil hab., ene–ago 2025
  robos2025?: number; // ene–abr 2025
  extorsiones2025?: number; // ene–abr 2025
  nota?: string;
}

export const DISTRICT_SOURCES = [
  {
    medio: 'Observatorio del Crimen y la Violencia (Ipsos), 4.º reporte',
    detalle: 'Homicidios por distrito, enero–agosto 2025',
    url: 'https://www.ipsos.com/sites/default/files/ct/news/documents/2025-10/Cuarto_Reporte_del_Observatorio_del_Crimen_y_la_Violencia.pdf'
  },
  {
    medio: 'El Comercio, con datos del Observatorio Nacional de Seguridad Ciudadana (Mininter)',
    detalle: 'Robos, extorsiones y homicidios por distrito, enero–abril 2025',
    url: 'https://elcomercio.pe/lima/cercado-de-lima-lidera-las-denuncias-por-extorsion-y-homicidio-en-el-ano-cifras-ya-superan-el-registro-del-2024-cercado-de-lima-extorsion-robo-hurto-homicidio-crimen-organizado-noticia/'
  },
  {
    medio: 'La República / Infobae, con datos del Sinadef',
    detalle: 'Homicidios en el Callao 2024 y 2025',
    url: 'https://larepublica.pe/sociedad/2025/10/26/callao-registra-en-2025-la-cifra-mas-alta-de-homicidios-de-los-ultimos-anos-la-extorsion-sigue-entre-los-delitos-mas-denunciados-ntpe-2508610'
  }
];

export const DISTRICT_RISK: DistrictRisk[] = [
  { distrito: 'Bellavista', provincia: 'Callao', nivel: 'muy_alto', homicidios2025: 28, tasa2025: 3.44, nota: 'Mayor tasa de homicidios; 61 en 2024 y 69 a oct. 2025 (Sinadef).' },
  { distrito: 'La Perla', provincia: 'Callao', nivel: 'muy_alto', homicidios2025: 15, tasa2025: 2.32 },
  { distrito: 'Ventanilla', provincia: 'Callao', nivel: 'muy_alto', homicidios2025: 44, tasa2025: 1.12 },
  { distrito: 'El Agustino', provincia: 'Lima', nivel: 'muy_alto', homicidios2025: 24, tasa2025: 1.05 },
  { distrito: 'San Juan de Miraflores', provincia: 'Lima', nivel: 'alto', homicidios2025: 34, tasa2025: 0.8 },
  { distrito: 'Callao', provincia: 'Callao', nivel: 'alto', homicidios2025: 41, tasa2025: 0.78 },
  { distrito: 'Carabayllo', provincia: 'Lima', nivel: 'alto', homicidios2025: 28, tasa2025: 0.66 },
  { distrito: 'San Martín de Porres', provincia: 'Lima', nivel: 'alto', homicidios2025: 44, tasa2025: 0.57, robos2025: 809 },
  { distrito: 'Mi Perú', provincia: 'Callao', nivel: 'alto', tasa2025: 0.55 },
  { distrito: 'La Victoria', provincia: 'Lima', nivel: 'alto', homicidios2025: 10, tasa2025: 0.53 },
  { distrito: 'San Juan de Lurigancho', provincia: 'Lima', nivel: 'alto', homicidios2025: 53, tasa2025: 0.43, robos2025: 946, extorsiones2025: 497, nota: 'Mayor número absoluto de homicidios.' },
  { distrito: 'Cercado de Lima', provincia: 'Lima', nivel: 'alto', homicidios2025: 9, tasa2025: 0.34, robos2025: 1266, extorsiones2025: 543, nota: 'Primero en robos y extorsiones.' },
  { distrito: 'Comas', provincia: 'Lima', nivel: 'alto', homicidios2025: 21, tasa2025: 0.36, extorsiones2025: 283 },
  { distrito: 'Villa María del Triunfo', provincia: 'Lima', nivel: 'alto', homicidios2025: 11, tasa2025: 0.25, robos2025: 741 },
  { distrito: 'Ate', provincia: 'Lima', nivel: 'alto', homicidios2025: 17, tasa2025: 0.24, extorsiones2025: 216 },
  { distrito: 'Villa El Salvador', provincia: 'Lima', nivel: 'alto', homicidios2025: 13, tasa2025: 0.3, extorsiones2025: 184 },
  { distrito: 'Santa Anita', provincia: 'Lima', nivel: 'medio', homicidios2025: 8, tasa2025: 0.35 },
  { distrito: 'Lurigancho-Chosica', provincia: 'Lima', nivel: 'medio', homicidios2025: 10, tasa2025: 0.33 },
  { distrito: 'Chorrillos', provincia: 'Lima', nivel: 'medio', homicidios2025: 12, tasa2025: 0.33 },
  { distrito: 'Rímac', provincia: 'Lima', nivel: 'medio', tasa2025: 0.27 },
  { distrito: 'Puente Piedra', provincia: 'Lima', nivel: 'medio', homicidios2025: 11 },
  { distrito: 'Los Olivos', provincia: 'Lima', nivel: 'medio', homicidios2025: 10 }
];
