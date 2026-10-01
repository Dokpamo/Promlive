export type ImageSurfaceHandle = {toggleZoom: () => void};
export type ImageSurfaceProps = {
  tile: number; label: string; width: number; height: number;
  onZoomChange: (zoomed: boolean) => void;
};
