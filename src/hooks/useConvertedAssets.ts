'use client';

import { useCallback, useEffect, useState } from 'react';

import {
  CONVERTED_ASSET_EVENT,
  announceConvertedAssetChange,
  convertAssetFile,
  deleteConvertedAsset,
  listConvertedAssets,
  saveConvertedAsset,
  type ConvertedAsset,
} from '@/lib/convertedAssets';

export type ConvertedAssetLibraryController = {
  assets: ConvertedAsset[];
  busy: boolean;
  error: string | null;
  importFiles: (files: File[], maxDimension: number) => Promise<ConvertedAsset[]>;
  removeAsset: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
};

export function useConvertedAssets(): ConvertedAssetLibraryController {
  const [assets, setAssets] = useState<ConvertedAsset[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setAssets(await listConvertedAssets());
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'The asset library could not be loaded.');
    }
  }, []);

  useEffect(() => {
    void refresh();
    window.addEventListener(CONVERTED_ASSET_EVENT, refresh);
    return () => window.removeEventListener(CONVERTED_ASSET_EVENT, refresh);
  }, [refresh]);

  const importFiles = useCallback(async (files: File[], maxDimension: number) => {
    setBusy(true);
    setError(null);
    const converted: ConvertedAsset[] = [];
    try {
      converted.push(...await Promise.all(
        files.map((file) => convertAssetFile(file, maxDimension))
      ));
      await Promise.all(converted.map((asset) => saveConvertedAsset(asset)));
      announceConvertedAssetChange();
      await refresh();
      return converted;
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'The selected asset could not be converted.');
      throw nextError;
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const removeAsset = useCallback(async (id: string) => {
    await deleteConvertedAsset(id);
    announceConvertedAssetChange();
    await refresh();
  }, [refresh]);

  return { assets, busy, error, importFiles, refresh, removeAsset };
}
