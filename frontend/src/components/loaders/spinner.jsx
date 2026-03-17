/**
 * Componente de Spinner reutilizable para mostrar estados de carga en la aplicación
 *
 * @param {Object} props - Propiedades del componente
 * @param {string} props.size - Tamaño del spinner: "xs", "sm", "md", "lg", "xl"
 * @param {string} props.color - Color principal del spinner (clases de Tailwind)
 * @param {string} props.secondaryColor - Color secundario del spinner (clases de Tailwind)
 * @param {string} props.className - Clases CSS adicionales
 * @param {boolean} props.inline - Si debe mostrarse como elemento inline-block
 * @param {number} props.strokeWidth - Grosor del trazo del círculo (1-8)
 * @returns {JSX.Element} Componente Spinner
 */
export const Spinner = ({
  size = "md",
  color = "text-blue-600",
  secondaryColor = "text-gray-200",
  className = "",
  inline = true,
  strokeWidth = 4
}) => {
  // Mapeo de tamaños a clases de Tailwind
  const sizeClasses = {
    'xs': 'h-3 w-3',
    'sm': 'h-4 w-4',
    'md': 'h-5 w-5',
    'lg': 'h-6 w-6',
    'xl': 'h-8 w-8'
  };

  // Determinar las clases de tamaño
  const sizeClass = sizeClasses[size] || sizeClasses.md;

  // Determinar display (inline o block)
  const displayClass = inline ? 'inline-block' : 'block';

  // Limitar el valor de strokeWidth entre 1 y 8
  const validStrokeWidth = Math.min(8, Math.max(1, strokeWidth));

  return (
    <svg
      className={`animate-spin ${sizeClass} ${displayClass} ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className={`opacity-25 ${secondaryColor}`}
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth={validStrokeWidth}
      ></circle>
      <path
        className={`opacity-75 ${color}`}
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      ></path>
    </svg>
  );
};

export default Spinner;
