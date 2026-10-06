// Omakey layout format v1. See spec/LAYOUT.md.

export type KeyStyle = "normal" | "mod" | "fkey" | "accent" | "space";

export const KEY_STYLES: KeyStyle[] = ["normal", "mod", "fkey", "accent", "space"];

export interface LayerOverride {
  code?: string;
  label?: string;
}

export interface LayoutKey {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  sub?: string;
  code?: string;
  layer?: string;
  style?: KeyStyle;
  layers?: Record<string, LayerOverride>;
}

export interface Layout {
  format: "omakey-layout";
  version: 1;
  id: string;
  name: string;
  author?: string;
  description?: string;
  width: number;
  height: number;
  keys: LayoutKey[];
}

export const LIMITS = {
  maxKeys: 256,
  maxIdLength: 64,
  maxNameLength: 64,
  maxAuthorLength: 64,
  maxDescriptionLength: 512,
  maxLabelLength: 16,
  maxFileBytes: 256 * 1024,
  minKeySize: 0.25,
  maxKeySize: 16,
  maxWidth: 64,
  maxHeight: 32,
} as const;
