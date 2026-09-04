# Export verification reference

## Format selection

| Need | Format | Important check |
| --- | --- | --- |
| Editable vector | SVG | Valid XML, intended dimensions, embedded/portable assets |
| Transparent still | PNG | Alpha channel and edge treatment |
| Smaller opaque still | JPG | No accidental transparency flattening or excessive artifacts |
| Short silent loop | GIF | Multiple distinct frames and visual closure |
| Video or audio | MP4 | Video codec, duration, frame rate, and audio stream when requested |
| Printable standards | PDF | Page count, print sizing, and font rendering |
| Editable data | JSON / `.lottie` | Parseability, schema, and referenced assets |

## Export supported Design Lab formats

```js
const studio = window.glyphfield.studio;
const requested = ['png', 'jpg', 'gif', 'mp4'];

for (const format of requested) {
  const artifact = await studio.invoke('design.export', {
    format,
    download: false,
  });
  if (!(artifact.blob instanceof Blob) || artifact.blob.size === 0) {
    throw new Error(`${format} export is empty.`);
  }
  console.log({
    format,
    fileName: artifact.fileName,
    mime: artifact.blob.type,
    bytes: artifact.blob.size,
    width: artifact.width,
    height: artifact.height,
  });
}
```

Do not run this loop concurrently.

## Still checks

- The pixel dimensions match the selected output, not the viewport zoom.
- Transparent PNG preserves alpha where expected.
- JPG uses an intentional opaque background.
- Text, logos, effects, and shaders match the inspected canvas frame.
- File naming is safe and the extension matches MIME.

## GIF checks

- Decode at least the first, middle, penultimate, and final displayed frame.
- Confirm motion exists for animated materials such as Prismatic Sphere.
- Confirm authored text colors do not flash because of palette drift.
- Compare the final displayed frame to the first displayed frame for closure.
- Confirm duration and frame rate are within the requested settings.
- Do not look for audio; GIF has no audio channel.

## MP4 checks

- Inspect container/codec, width, height, duration, and effective frame rate.
- Sample multiple video frames rather than trusting a poster image.
- When audio is requested, confirm an audio stream exists and its duration aligns.
- Treat browser codec failure as a capability error, not permission to change formats.

## Source preservation

If encoding fails, keep the applied/saved source and report the exact terminal error. A user should be able to retry on a capable browser without rebuilding the composition.

The complete current format matrix is available from `/docs/artifacts/formats-and-portability.md` on the running Glyphfield origin.
