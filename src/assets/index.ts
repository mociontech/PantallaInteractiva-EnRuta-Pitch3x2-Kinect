/** Assets de marca (descargados de Figma, creatividad). Importados con Vite para que se empaqueten en el build. */
import bgIdle from './bg/bg-idle.webp';
import bgSwoosh from './bg/bg-swoosh.webp';
import bgPlain from './bg/bg-plain.webp';
import logoWordmark from './logo/wordmark.svg';
import logoMark from './logo/mark.svg';
import logoMarkDetail from './logo/mark-detail.svg';
import logoSub from './logo/sub.svg';
import areaAprenderIcon from './icons/area-aprender.svg';
import areaAprenderS2Icon from './icons/area-aprender-s2.svg';
import areaConectarIcon from './icons/area-conectar.svg';
import areaConectarS2Icon from './icons/area-conectar-s2.svg';
import areaEventosIcon from './icons/area-eventos.svg';
import areaOrganizarIcon from './icons/area-organizar.svg';
import areaVenderIcon from './icons/area-vender.svg';
import areaVenderS2Icon from './icons/area-vender-s2.svg';
import catCaracterizacionIcon from './icons/cat-caracterizacion.svg';
import catDiagnosticoIcon from './icons/cat-diagnostico.svg';
import catEnrutamientoIcon from './icons/cat-enrutamiento.svg';
import catImpactoIcon from './icons/cat-impacto.svg';
import catSeguimientoIcon from './icons/cat-seguimiento.svg';
import catServiciosIcon from './icons/cat-servicios.svg';
import clockIcon from './icons/clock.svg';
import companyIcon from './icons/company.svg';
import docIcon from './icons/doc.svg';
import handIcon from './icons/hand.svg';
import lockIcon from './icons/lock.svg';
import mailIcon from './icons/mail.svg';
import monitorIcon from './icons/monitor.svg';
import obsAsesoriaIcon from './icons/obs-asesoria.svg';
import obsCertificacionIcon from './icons/obs-certificacion.svg';
import obsFinanciacionIcon from './icons/obs-financiacion.svg';
import plantFinalIcon from './icons/plant-final.svg';
import routeDoneIcon from './icons/route-done.svg';
import solAcompanamientoIcon from './icons/sol-acompanamiento.svg';
import solContactosIcon from './icons/sol-contactos.svg';
import solEventosIcon from './icons/sol-eventos.svg';
import solFormacionIcon from './icons/sol-formacion.svg';
import solInformacionIcon from './icons/sol-informacion.svg';
import solProgramasIcon from './icons/sol-programas.svg';

export const BG = { idle: bgIdle, swoosh: bgSwoosh, plain: bgPlain } as const;
export type BgKind = keyof typeof BG;
export const LOGO = { wordmark: logoWordmark, mark: logoMark, markDetail: logoMarkDetail, sub: logoSub } as const;

/** Iconos por nombre (los usan content.ts y los componentes). */
export const ICONS: Record<string, string> = {
  'area-aprender': areaAprenderIcon,
  'area-aprender-s2': areaAprenderS2Icon,
  'area-conectar': areaConectarIcon,
  'area-conectar-s2': areaConectarS2Icon,
  'area-eventos': areaEventosIcon,
  'area-organizar': areaOrganizarIcon,
  'area-vender': areaVenderIcon,
  'area-vender-s2': areaVenderS2Icon,
  'cat-caracterizacion': catCaracterizacionIcon,
  'cat-diagnostico': catDiagnosticoIcon,
  'cat-enrutamiento': catEnrutamientoIcon,
  'cat-impacto': catImpactoIcon,
  'cat-seguimiento': catSeguimientoIcon,
  'cat-servicios': catServiciosIcon,
  'clock': clockIcon,
  'company': companyIcon,
  'doc': docIcon,
  'hand': handIcon,
  'lock': lockIcon,
  'mail': mailIcon,
  'monitor': monitorIcon,
  'obs-asesoria': obsAsesoriaIcon,
  'obs-certificacion': obsCertificacionIcon,
  'obs-financiacion': obsFinanciacionIcon,
  'plant-final': plantFinalIcon,
  'route-done': routeDoneIcon,
  'sol-acompanamiento': solAcompanamientoIcon,
  'sol-contactos': solContactosIcon,
  'sol-eventos': solEventosIcon,
  'sol-formacion': solFormacionIcon,
  'sol-informacion': solInformacionIcon,
  'sol-programas': solProgramasIcon,
};

/** Todas las imágenes, para precargar antes de mostrar IDLE (Fase 4). */
export const ALL_IMAGES: readonly string[] = [...Object.values(BG), ...Object.values(LOGO), ...Object.values(ICONS)];
