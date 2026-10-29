import type { CategoryId } from "../core/types";

/**
 * Feedback educativo por categoría (plantilla base del documento de contenido v2.1).
 * Es una plantilla inicial, no una explicación individual validada: se muestra
 * DESPUÉS de la acción, nunca antes.
 */
export const CATEGORY_FEEDBACK: Record<CategoryId, string> = {
  datos_personales: "Evita compartir datos que puedan identificarte o localizarte. Puedes participar sin revelar información privada.",
  interacciones_seguras: "No toda interacción es peligrosa. Comprueba que se realice mediante funciones normales del juego y sin pedir datos innecesarios.",
  suplantacion: "Un nombre parecido o conocer partidas anteriores no demuestra la identidad. Comprueba por medios confiables.",
  intercambios_recompensas: "Revisa las condiciones y utiliza las funciones oficiales del juego. No entregues objetos o acceso por promesas.",
  anuncios_fuentes: "Distingue una comunicación comprobable de una afirmación sin respaldo. Revisa su origen y contexto.",
  enlaces_externos: "Desconfía de accesos, descargas o formularios ajenos al juego que prometen solucionar problemas o reclamar premios.",
  presion_de_grupo: "Puedes poner límites y decidir por tu cuenta, aunque el equipo te presione o amenace con excluirte.",
  contrasenas_acceso: "Nunca compartas contraseñas, códigos de verificación ni el acceso a tu cuenta, incluso con compañeros.",
  convivencia_digital: "Ante el acoso, apoya a la persona afectada, evita represalias y utiliza las herramientas de reporte."
};

/** Confirmación corta cuando la decisión fue correcta. */
export const CORRECT_CONFIRMATION: Record<CategoryId, string> = {
  datos_personales: "Bien: protegiste tus datos.",
  interacciones_seguras: "Bien: era una interacción normal del juego.",
  suplantacion: "Bien: no te fiaste solo del nombre.",
  intercambios_recompensas: "Bien: usaste las funciones oficiales.",
  anuncios_fuentes: "Bien: revisaste el origen del mensaje.",
  enlaces_externos: "Bien: desconfiaste de lo que viene de fuera del juego.",
  presion_de_grupo: "Bien: decidiste por tu cuenta.",
  contrasenas_acceso: "Bien: tu acceso sigue siendo solo tuyo.",
  convivencia_digital: "Bien: ayudaste sin devolver el golpe."
};

export function feedbackFor(categoria: CategoryId, correct: boolean): string {
  return correct ? CORRECT_CONFIRMATION[categoria] : CATEGORY_FEEDBACK[categoria];
}

export const CATEGORY_LABEL: Record<CategoryId, string> = {
  datos_personales: "Datos personales",
  interacciones_seguras: "Interacciones seguras",
  suplantacion: "Suplantación",
  intercambios_recompensas: "Intercambios y recompensas",
  anuncios_fuentes: "Anuncios y fuentes",
  enlaces_externos: "Enlaces externos",
  presion_de_grupo: "Presión de grupo",
  contrasenas_acceso: "Contraseñas y acceso",
  convivencia_digital: "Convivencia digital"
};
