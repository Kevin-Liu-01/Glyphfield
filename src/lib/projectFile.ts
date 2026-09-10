/** Shared lightweight project-file contract; editor parsers load only on Open. */
export const STUDIO_PROJECT_FILE_ACCEPT = '.glyphfield.json,.json,application/json';
export const STUDIO_PROJECT_FILE_MAX_BYTES = 128 * 1024 * 1024;

export type StudioProjectFile = {
  blob: Blob;
  description: string;
  fileName: string;
  format: 'JSON';
  previewKind: 'file';
};
