import React from 'react';
import { useTranslation } from 'react-i18next';

import { namespaces } from '../i18n/i18n.constants';
import { ProficiencyLevel } from '../shared/constants';

interface CategoryToggleProps {
  categoryKey: string;
  label: string;
  value: ProficiencyLevel;
  /** Categories with no advanced variant cycle off ↔ basic only. */
  hasAdvanced: boolean;
  /** Locked categories render at their level and cannot be changed. */
  locked?: boolean;
  onChange: (next: ProficiencyLevel) => void;
}

/**
 * Three-state category control: off → basic → advanced → off.
 *
 * Mirrors the dashboard's triple toggle so the two read the same way. The
 * levels map onto `config.disabled_categories`, which is the only thing the API
 * accepts:
 *
 *   off       the category key is disabled
 *   basic     only `<key>_advanced` is disabled
 *   advanced  neither is disabled
 *
 * A category without an advanced variant skips that third stop rather than
 * offering a level the API would ignore. Categories whose proficiency level is
 * `openly_discriminating` — slurs and hate speech — are locked on, matching the
 * dashboard, where they are likewise not switchable.
 */
const CategoryToggle: React.FC<CategoryToggleProps> = ({
  categoryKey,
  label,
  value,
  hasAdvanced,
  locked = false,
  onChange,
}: CategoryToggleProps) => {
  const { t } = useTranslation(namespaces.options);

  const levelName = [t('levelOff'), t('levelBasic'), t('levelAdvanced')][value];

  const advance = () => {
    if (locked) {
      return;
    }

    const top = hasAdvanced
      ? ProficiencyLevel.Advanced
      : ProficiencyLevel.Basic;

    onChange(value >= top ? ProficiencyLevel.Off : ((value + 1) as ProficiencyLevel));
  };

  return (
    <div className='witty-category'>
      <button
        type='button'
        className={[
          'witty-category-toggle',
          value > ProficiencyLevel.Off ? 'is-on' : '',
          value === ProficiencyLevel.Basic ? 'is-middle' : '',
          locked ? 'is-locked' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        data-category={categoryKey}
        data-level={value}
        // Tri-state, so `aria-pressed` alone cannot describe it; the level is
        // announced in the accessible name instead.
        aria-label={`${label}: ${levelName}`}
        aria-disabled={locked}
        title={locked ? t('levelLocked') : levelName}
        onClick={advance}
      >
        <span className='witty-category-knob' />
      </button>
      <span className='witty-category-label'>{label}</span>
      <span className='witty-category-level'>{levelName}</span>
    </div>
  );
};

export default CategoryToggle;
