export type ImageSurfaceHandle = {toggleZoom: () => void};
export type ImageSurfaceProps = {
  tile: number; label: string; width: number; height: number;
  resetKey?: string;
  onZoomChange: (zoomed: boolean) => void;
};
