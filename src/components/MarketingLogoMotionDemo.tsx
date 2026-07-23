'use client';

import Image from 'next/image';
import { Pause, Play } from 'lucide-react';
import { T, useGT } from 'gt-next';
import { useState } from 'react';

import type { CSSProperties } from 'react';

import BezierEditor from '@/components/BezierEditor';
import ColorControl from '@/components/ui/ColorControl';
import type { CubicBezier } from '@/lib/animation';
import {
  DEFAULT_LOGO_APPEARANCE,
  logoAppearanceCssFilter,
} from '@/lib/logoAppearance';

type DemoBrand = {
  name: string;
  src: string;
};

type DemoTool = 'logo' | 'motion';

const BACKGROUNDS = [
  {
    background: 'radial-gradient(circle at 24% 22%, #bdaaff 0, transparent 31%), radial-gradient(circle at 82% 76%, #77f2d8 0, transparent 38%), #24106f',
    id: 'violet',
    label: 'Violet field',
  },
  {
    background: 'radial-gradient(circle at 72% 24%, #f4ffb3 0, transparent 28%), radial-gradient(circle at 22% 78%, #4de2c5 0, transparent 40%), #073d43',
    id: 'teal',
    label: 'Teal field',
  },
  {
    background: 'radial-gradient(circle at 50% 0%, #f1f1f1 0, transparent 38%), linear-gradient(145deg, #090909, #323232)',
    id: 'graphite',
    label: 'Graphite field',
  },
] as const;

const MOTION_FRAMES = ['logo', 'Welcome', 'Bienvenidos', '你好', 'ようこそ'] as const;

export default function MarketingLogoMotionDemo({ brands }: { brands: readonly DemoBrand[] }) {
  const gt = useGT();
  const [activeTool, setActiveTool] = useState<DemoTool>('motion');
  const [backgroundId, setBackgroundId] = useState<(typeof BACKGROUNDS)[number]['id']>('violet');
  const [curve, setCurve] = useState<CubicBezier>([0.2, 0.8, 0.2, 1]);
  const [duration, setDuration] = useState(1.25);
  const [logoColor, setLogoColor] = useState('#FFFFFF');
  const [playing, setPlaying] = useState(true);
  const [selectedBrand, setSelectedBrand] = useState(0);
  const [appearance, setAppearance] = useState({
    ...DEFAULT_LOGO_APPEARANCE,
    borderColor: '#FFFFFF',
  });
  const activeBackground = BACKGROUNDS.find(({ id }) => id === backgroundId) ?? BACKGROUNDS[0];
  const activeBrand = brands[selectedBrand] ?? brands[0];
  const filter = logoAppearanceCssFilter(appearance);
  const totalDuration = duration * MOTION_FRAMES.length;

  function updateAppearance(patch: Partial<typeof appearance>) {
    setAppearance((current) => ({ ...current, ...patch }));
  }

  return (
    <div className='marketing-v5-composer-demo' data-motion-item>
      <span className='marketing-v5-corners marketing-v5-corners--dark' aria-hidden='true'><i /><i /><i /><i /></span>
      <header>
        <span>MARK + MOTION</span>
        <div role='tablist' aria-label={gt('Demo tools')}>
          <button aria-selected={activeTool === 'logo'} onClick={() => setActiveTool('logo')} role='tab' type='button'>
            <T>Logo Lab</T>
          </button>
          <button aria-selected={activeTool === 'motion'} onClick={() => setActiveTool('motion')} role='tab' type='button'>
            <T>Animation</T>
          </button>
        </div>
        <small><T>Live editor</T></small>
      </header>

      <div className='marketing-v5-composer-body'>
        <aside data-lenis-prevent>
          <section className='marketing-v5-demo-source-list'>
            <p><T>Source mark</T></p>
            <div>
              {brands.map(({ name, src }, index) => (
                <button
                  aria-pressed={selectedBrand === index}
                  className={selectedBrand === index ? 'is-active' : ''}
                  key={name}
                  onClick={() => setSelectedBrand(index)}
                  type='button'
                >
                  <Image alt='' aria-hidden='true' height={22} src={src} width={70} />
                  <span>{gt(name)}</span>
                </button>
              ))}
            </div>
          </section>

          {activeTool === 'logo' ? (
            <section className='marketing-v5-demo-inspector'>
              <p><T>Appearance</T></p>
              <ColorControl ariaLabel={gt('Demo logo color')} label={<T>Logo color</T>} onChange={setLogoColor} value={logoColor} />
              <label><span><T>Invert</T></span><input checked={appearance.invert} onChange={(event) => updateAppearance({ invert: event.target.checked })} type='checkbox' /></label>
              <label><span><T>SVG outline</T></span><input checked={appearance.borderEnabled} onChange={(event) => updateAppearance({ borderEnabled: event.target.checked })} type='checkbox' /></label>
              <label><span><T>Shadow</T></span><input checked={appearance.shadowEnabled} onChange={(event) => updateAppearance({ shadowEnabled: event.target.checked })} type='checkbox' /></label>
              <p><T>Background</T></p>
              <div className='marketing-v5-demo-backgrounds'>
                {BACKGROUNDS.map((background) => (
                  <button
                    aria-label={gt(background.label)}
                    aria-pressed={background.id === backgroundId}
                    key={background.id}
                    onClick={() => setBackgroundId(background.id)}
                    style={{ background: background.background }}
                    type='button'
                  />
                ))}
              </div>
            </section>
          ) : (
            <section className='marketing-v5-demo-inspector marketing-v5-demo-inspector--motion'>
              <label className='marketing-v5-demo-duration'>
                <span><T>Word duration</T><output>{duration.toFixed(2)}s</output></span>
                <input max={2.5} min={0.5} onChange={(event) => setDuration(Number(event.target.value))} step={0.25} type='range' value={duration} />
              </label>
              <BezierEditor curve={curve} onChange={setCurve} />
            </section>
          )}
        </aside>

        <section>
          <div className='marketing-v5-demo-stage' style={{ background: activeBackground.background }}>
            <div className='marketing-v5-demo-arcs' aria-hidden='true'><i /><i /><i /></div>
            {activeTool === 'logo' ? (
              <div className='marketing-v5-live-logo-wrap'>
                <div
                  aria-label={gt(`${activeBrand?.name ?? 'Brand'} logo preview`)}
                  className='marketing-v5-live-logo'
                  style={{
                    backgroundColor: logoColor,
                    filter,
                    maskImage: `url('${activeBrand?.src ?? ''}')`,
                    maskPosition: 'center',
                    maskRepeat: 'no-repeat',
                    maskSize: 'contain',
                  }}
                />
                <span className='marketing-v5-selection-box' aria-hidden='true'><i /><i /><i /><i /></span>
              </div>
            ) : (
              <div
                className='marketing-v5-live-motion'
                data-playing={playing}
                style={{ '--demo-ease': `cubic-bezier(${curve.join(',')})` } as CSSProperties}
              >
                {MOTION_FRAMES.map((frame, index) => (
                  <div
                    className='marketing-v5-live-motion-frame'
                    key={frame}
                    style={{
                      animationDelay: `${index === 0 ? 0 : -(MOTION_FRAMES.length - index) * duration}s`,
                      animationDuration: `${totalDuration}s`,
                      animationTimingFunction: `cubic-bezier(${curve.join(',')})`,
                    }}
                  >
                    {frame === 'logo' ? (
                      <div
                        aria-label={gt(`${activeBrand?.name ?? 'Brand'} logo animation frame`)}
                        className='marketing-v5-live-motion-logo'
                        style={{
                          backgroundColor: logoColor,
                          filter,
                          maskImage: `url('${activeBrand?.src ?? ''}')`,
                          maskPosition: 'center',
                          maskRepeat: 'no-repeat',
                          maskSize: 'contain',
                        }}
                      />
                    ) : <span>{frame}</span>}
                  </div>
                ))}
              </div>
            )}
            <button
              aria-label={playing ? gt('Pause animation preview') : gt('Play animation preview')}
              className='marketing-v5-demo-play'
              onClick={() => setPlaying((current) => !current)}
              type='button'
            >
              {playing ? <Pause aria-hidden='true' /> : <Play aria-hidden='true' />}
              <span>{playing ? <T>Pause</T> : <T>Play</T>}</span>
            </button>
          </div>
          <div className='marketing-v5-timeline'>
            <span>00:00</span>
            <div>
              {MOTION_FRAMES.map((frame, index) => (
                <i className={index === 0 ? 'is-active' : ''} key={frame}><b>{frame === 'logo' ? activeBrand?.name ?? 'Logo' : frame}</b></i>
              ))}
            </div>
            <span>{totalDuration.toFixed(2)}s</span>
          </div>
        </section>
      </div>

      <footer>
        <span><T>Cubic Bézier</T> {curve.map((value) => value.toFixed(2)).join(', ')}</span>
        <span>{duration.toFixed(2)}s / <T>frame</T></span>
        <strong><T>Live preview</T></strong>
      </footer>
    </div>
  );
}
