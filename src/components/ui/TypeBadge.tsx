import { showType, typeCategory, type HaskellType } from '../../types/haskell';

interface Props {
  type: HaskellType;
  className?: string;
}

const CATEGORY_STYLES: Record<string, string> = {
  int:     'bg-blue-100 text-blue-800 border-blue-300',
  float:   'bg-sky-100 text-sky-800 border-sky-300',
  bool:    'bg-green-100 text-green-800 border-green-300',
  list:    'bg-purple-100 text-purple-800 border-purple-300',
  fun:     'bg-orange-100 text-orange-800 border-orange-300',
  string:  'bg-yellow-100 text-yellow-800 border-yellow-300',
  unknown: 'bg-gray-100 text-gray-500 border-gray-300',
};

export function TypeBadge({ type, className = '' }: Props) {
  const cat = typeCategory(type);
  const style = CATEGORY_STYLES[cat] ?? CATEGORY_STYLES.unknown;
  return (
    <span
      className={`inline-block px-1.5 py-0.5 text-xs font-mono rounded border ${style} ${className}`}
      title={showType(type)}
    >
      {showType(type)}
    </span>
  );
}
