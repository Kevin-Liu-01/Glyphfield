'use client';

// Image effect picker for Design Lab Effect layers: the Shaders.com image
// effects grouped by upstream category, searchable, with static thumbnails.
import { memo, useDeferredValue, useState } from 'react';

import { Search } from '@/components/ui/SolidIcons';
import { useValueStore, type ValueStore } from '@/hooks/useValueStore';
import {
  DESIGN_LAB_IMAGE_EFFECTS,
  designLabImageEffectGroups,
  type DesignLabImageEffectId,
  type DesignLabImageEffectStatus,
} from '@/lib/designLabImageEffects';
import { shaderPreviewAssetPath } from '@/lib/shaderLab';
import styles from './DesignLabEffectPicker.module.css';

export type DesignLabImageEffectStatusStore = ValueStore<ReadonlyMap<string, DesignLabImageEffectStatus>>;

export const DesignLabEffectPicker = memo(function DesignLabEffectPicker({
  onSelect,
  selectedEffectId,
}: {
  onSelect: (effectId: DesignLabImageEffectId) => void;
  selectedEffectId?: DesignLabImageEffectId;
}) {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const groups = designLabImageEffectGroups(deferredQuery);
  return (
    <div className={styles.picker}>
      <label className={styles.search}>
        <Search aria-hidden='true' />
        <input
          aria-label='Search image effects'
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`Search ${DESIGN_LAB_IMAGE_EFFECTS.length} image effects`}
          type='search'
          value={query}
        />
      </label>
      <div aria-label='Image effects' className={`${styles.list} studio-scroll-area`} role='group'>
        {groups.map(({ category, effects }) => (
          <section aria-label={`${category} image effects`} className={styles.group} key={category}>
            <h4 className={styles.category}>{category}<span>{effects.length}</span></h4>
            <div className={styles.grid}>
              {effects.map((effect) => (
                <button
                  aria-label={`${effect.name} image effect`}
                  aria-pressed={selectedEffectId === effect.id}
                  className={styles.option}
                  key={effect.id}
                  onClick={() => onSelect(effect.id)}
                  title={effect.description}
                  type='button'
                >
                  <img alt='' decoding='async' height={60} loading='lazy' src={shaderPreviewAssetPath(effect.id)} width={80} />
                  <span>{effect.name}</span>
                </button>
              ))}
            </div>
          </section>
        ))}
        {groups.length === 0 ? <p className={styles.empty} role='status'>No image effects match “{deferredQuery.trim()}”.</p> : null}
      </div>
    </div>
  );
});

const STATUS_MESSAGES: Record<'inspector' | 'stage', Partial<Record<DesignLabImageEffectStatus, string>>> = {
  inspector: {
    error: 'This effect could not render. The canvas shows the layers beneath it.',
    unsupported: 'This effect needs WebGPU, which this browser does not offer. The canvas shows the layers beneath it. Exports need WebGPU too, so hide this layer to export without it.',
  },
  stage: {
    error: 'Image effect could not render',
    unsupported: 'Image effect needs WebGPU',
  },
};

/** Explains why an image effect is missing from the preview. Renders nothing while the effect works. */
export function DesignLabImageEffectNotice({
  layerId,
  store,
  variant = 'inspector',
}: {
  layerId: string;
  store: DesignLabImageEffectStatusStore;
  variant?: 'inspector' | 'stage';
}) {
  const status = useValueStore(store).get(layerId);
  const message = status ? STATUS_MESSAGES[variant][status] : undefined;
  if (!message) return null;
  return (
    <p
      aria-hidden={variant === 'stage' ? true : undefined}
      className={variant === 'stage' ? styles.stageNotice : styles.notice}
      data-image-effect-status={status}
      role={variant === 'stage' ? undefined : 'status'}
    >
      {message}
    </p>
  );
}
