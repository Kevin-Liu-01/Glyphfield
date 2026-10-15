# Third-party notices

## WebGL Fluid Simulation

Glyphfield's “Fluid Energy” material adapts the GPU feedback and fluid-advection
approach from [WebGL Fluid Simulation](https://github.com/PavelDoGreat/WebGL-Fluid-Simulation)
by Pavel Dobryakov.

Copyright (c) 2017 Pavel Dobryakov

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the “Software”), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Paper Shaders

Glyphfield includes the official
[`@paper-design/shaders-react`](https://github.com/paper-design/shaders)
package to render the Paper collection inside the shared Shader Library.
The integration registers 29 shader families and 120 upstream-authored presets. The Shader Library
does not list the plain Perlin noise, simplex noise and waves families; saved projects that use them
still load.

Paper Shaders

Copyright 2026 Paper

Licensed under the Apache License, Version 2.0. A copy of the license is
distributed with the package and is available in the
[upstream repository](https://github.com/paper-design/shaders/blob/main/LICENSE).

Powered by Paper Shaders: <https://shaders.paper.design>

## Visual references for original shader studies

Glyphfield includes original GLSL studies informed by the visual directions shown by:

- Evil Rabbit Shaders: <https://shaders.evilrabbit.com/>
- GRADIENTOOL: <https://www.gradientool.com/>
- Grainient Freebies: <https://grainient.supply/freebies>

No source code, shader code, or downloadable assets from these sites are bundled in Glyphfield. The studies are independently implemented and link back to their visual references from the material inspector.

## Shader Lab workflow references

The rebuilt Shader Lab's one-canvas lifecycle, standard editable uniform model,
fast static discovery cards, and compact designer/developer handoff were informed by
the interaction patterns in these open-source projects:

- [glslCanvas](https://github.com/patriciogonzalezvivo/glslCanvas) (MIT)
- [glslEditor](https://github.com/patriciogonzalezvivo/glslEditor) (MIT)
- [Paper Shaders](https://github.com/paper-design/shaders) (Apache-2.0)
- [Pixel Play](https://github.com/anvaka/pplay) (MIT)
- [WebGL Shader Editor](https://github.com/gkjohnson/webgl-shader-editor) (MIT)

Their source code is not bundled by this workflow-reference section; individual
material implementations and bundled packages are attributed separately above and below.

## Open PBR surface assets

The tactile backgrounds that `POST /api/generate` renders and the `/api/surface-textures` route can load
selected texture map sets from [Poly Haven](https://polyhaven.com/textures)
and [ambientCG](https://ambientcg.com/). Both providers release these assets under
[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). The asset catalog keeps the
provider, original asset page, and license attached to every entry. These files are fetched
on demand from their official distribution hosts and are not committed to this repository.

## GMHoloSticker

Glyphfield's live holographic sticker optical layer adapts the spectrum-offset, mask-strength,
and view-tilt model from [GMHoloSticker](https://github.com/HannulaTero/GMHoloSticker)
by Tero Hannula.

Copyright (c) 2025 Tero Hannula

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the “Software”), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## FoilStickerShader

Glyphfield's live prismatic and glitter optical layers adapt the diagonal animated shimmer
model from [FoilStickerShader](https://github.com/TastiestLemon/FoilStickerShader), which is
released into the public domain under the Unlicense. See the upstream repository for the
complete dedication and warranty disclaimer.

## HoloSticker

Glyphfield's die-cut sticker renderer adapts the exact distance-field cutline,
foil laminate, print relief, micro-facet, pointer-tilt, and peel-mesh techniques
from [HoloSticker](https://github.com/jal-co/holosticker) by Justin Levine.

MIT License

Copyright (c) 2026 Justin Levine

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the “Software”), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## HoloCloth

Glyphfield's interactive holographic textile surface adapts the Verlet cloth,
structural/shear/bend constraints, UV-locked surface response, woven foil, and
view-angle diffraction techniques from
[HoloCloth](https://github.com/dmitrykurash/holocloth) by Dmitry Kurash.

MIT License

Copyright (c) 2026 Dmitry Kurash

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the “Software”), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Shaders.com WebGPU components

Glyphfield uses `shaders` 4.0.1 by Shader Effects, Inc., from
https://github.com/shader-effects-inc/shaders (upstream revision
`dbfd42abe341e7a6ea0b8ea1f5bab018b8e8439a`). The engine and component library are
MIT-licensed. Glyphfield does not redistribute the separately licensed paid
Shaders.com editor presets or sections. Native components use the
`shader-effects-` ID prefix; the older `shaders-` materials remain original
Glyphfield studies.

MIT License

Copyright (c) 2026 Shader Effects Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Inter

`public/fonts/inter-variable.ttf` is Inter Variable 4.1 (font version 4.001) by Rasmus Andersson, from
[rsms/inter](https://github.com/rsms/inter), with its optical-size and weight axes and every OpenType
feature. `public/fonts/inter-variable-latin.ttf` is a Latin subset of the same file, used only when a
generated SVG embeds its fonts inline. Both are licensed under the SIL Open Font License 1.1; the license
text is in [`public/fonts/inter-OFL.txt`](./public/fonts/inter-OFL.txt).

`public/og/inter-text-400.ttf`, `public/og/inter-text-500.ttf` and `public/og/inter-display-600.ttf` are static
instances of the same Inter Variable file, generated by `scripts/generate-og-assets.py` for the social
preview images. They are licensed under the SIL Open Font License 1.1 as well.

## ShaderGradient

The ShaderGradient materials render with
[`@shadergradient/react`](https://github.com/ruucm/shadergradient) by ruucm, licensed under the MIT
License. The npm package declares the license in its `package.json` and does not ship a separate
license file.

## Geist Mono

`public/fonts/geist-mono-variable.ttf` and `public/fonts/geist-mono-latin.woff2` are Geist Mono by The
Geist Project Authors, from [vercel/geist-font](https://github.com/vercel/geist-font), licensed under
the SIL Open Font License 1.1. The license text is in [`public/fonts/OFL.txt`](./public/fonts/OFL.txt).

## General Translation brand assets

The General Translation identity bundles GT's marks and brand-system artwork in
`public/brands/gt` and GT's onboarding email panels in
`public/examples/email-lifecycle/cards`. They are © General Translation, Inc.,
included with permission for that identity, and are not covered by Glyphfield's
MIT license. See [`public/brands/ASSET-NOTICE.md`](./public/brands/ASSET-NOTICE.md).

## General Translation artifact pictures

These files in `public/brands/gt/library` are General Translation's screens of the
originals below: each picture is reduced to a tone grid and printed through an
8 × 8 Bayer matrix. A screen of a public-domain original stays public domain. A
screen of a CC BY-SA 4.0 original is an adaptation released under
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), with the credit below.

| File | Original | Credit | License |
| --- | --- | --- | --- |
| `blue-marble.png` | [Blue Marble, Western Hemisphere](https://commons.wikimedia.org/wiki/File:Blue_Marble_Western_Hemisphere.jpg) | NASA, Reto Stöckli, 2007 | Public domain |
| `rosetta-stone.png` | [The Rosetta Stone](https://commons.wikimedia.org/wiki/File:Rosetta_Stone.JPG) | Photograph: Hans Hillewaert | CC BY-SA 4.0 |
| `marginal-gloss.png` | [Alexandreis with gloss, page 69](https://commons.wikimedia.org/wiki/File:Alexandreis_with_gloss_-_in_Latin_-_DPLA_-_98b56ea1ebec780d88ec0bdfa6750159_%28page_69%29.jpg) | MS f Med. 23, Boston Public Library | Public domain |
| `great-wave.png` | [The Great Wave off Kanagawa](https://commons.wikimedia.org/wiki/File:Tsunami_by_hokusai_19th_century.jpg) | Katsushika Hokusai, about 1831 | Public domain |
| `telegraph-cables.png` | [Eastern Telegraph cables, 1901](https://commons.wikimedia.org/wiki/File:1901_Eastern_Telegraph_cables.png) | Eastern Telegraph Company, 1901 | Public domain |
| `devanagari-manuscript.png` | [Prashna Upanishad manuscript page](https://commons.wikimedia.org/wiki/File:Prashna_Upanishad_sample_manuscript_page,_Sanskrit,_Devanagari_script.jpg) | Photograph: Ms Sarah Welch | CC BY-SA 4.0 |
| `karahisari-calligraphy.png` | [Karalama (calligraphy exercise)](https://commons.wikimedia.org/wiki/File:Ahmed_Karahisari_-_Karalama_%28calligraphy_exercise%29_-_Google_Art_Project.jpg) | Ahmed Karahisari, 16th century | Public domain |
| `cuneiform-tablet.png` | [Proto-cuneiform tablet, image DP293245](https://images.metmuseum.org/CRDImages/an/original/DP293245.jpg) | The Metropolitan Museum of Art, Open Access | Public domain |
| `bowen-compass.png` | [Mariner's Compass and Armillary Sphere](https://commons.wikimedia.org/wiki/File:1748_Bowen_Mariner%27s_Compass_and_Armillary_Sphere_-_Geographicus_-_CircleofWinds-bowen-1747.jpg) | Emanuel Bowen, 1748 | Public domain |
| `louisbourg-lighthouse.png` | [Louisbourg Lighthouse, waves breaking in a fall storm](https://commons.wikimedia.org/wiki/File:Louisbourg_Lighthouse,_waves_breaking_in_a_fall_storm_1.jpg) | Photograph: Ken Heaton | CC BY-SA 4.0 |

Show the credit with a picture wherever you publish it, and release adaptations of
the three CC BY-SA 4.0 screens under the same license.
