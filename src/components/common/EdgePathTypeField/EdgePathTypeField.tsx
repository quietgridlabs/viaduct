import {
  EDGE_PATH_TYPES,
  normalizeEdgePathType,
  type EdgePathType,
} from '@/types/c4Extensions';
import ThemedSelect from '@components/common/ThemedSelect';
import { CornerDownRight, MoveRight, Spline } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/* One per shape, and each one is the shape: a curve, a straight run, a turn. */
const ICONS: Record<EdgePathType, typeof Spline> = {
  bezier: Spline,
  straight: MoveRight,
  step: CornerDownRight,
};

/**
 * How the connection is drawn.
 *
 * Three buttons side by side, which is what this was, need about 260px to keep
 * their words. In the panel's value column they had 230 and showed "C..",
 * "S.." and "O..", which is three controls saying nothing. As one value it
 * reads like the row above and below it, and the choice is one click away
 * rather than always on screen.
 */
export type EdgePathTypeFieldProps = {
  value: EdgePathType | string | undefined;
  onChange: (pathType: EdgePathType) => void;
};

export default function EdgePathTypeField({
  value,
  onChange,
}: EdgePathTypeFieldProps) {
  const { t } = useTranslation();

  return (
    <ThemedSelect
      label={t('edge_path')}
      value={normalizeEdgePathType(value)}
      onChange={(next) => onChange(normalizeEdgePathType(next))}
      options={EDGE_PATH_TYPES.map((type) => {
        const Icon = ICONS[type];
        return {
          value: type,
          label: t(`edge_path_${type}`),
          icon: <Icon size={15} />,
        };
      })}
      data-testid="input_edge_path"
    />
  );
}
