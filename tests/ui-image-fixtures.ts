import {vi} from 'vitest';

// jsdom cannot paint the artwork. Keep its real dimensions and distinct sources
// while avoiding repeated parsing of megabytes of data URLs in DOM/CSS setters.
// App components, Image layout, SVGs and animation behavior remain real.
vi.mock('../src/ui/images/libraryPreview', async importOriginal => {
  const {libraryPreviewAtlas} = await importOriginal<typeof import('../src/ui/images/libraryPreview')>();
  return {libraryPreviewAtlas: {...libraryPreviewAtlas, uri: '/test-artwork/library-atlas.jpg'}};
});
vi.mock('../src/ui/images/nightLibraryCover', async importOriginal => {
  const {nightLibraryCover} = await importOriginal<typeof import('../src/ui/images/nightLibraryCover')>();
  return {nightLibraryCover: {...nightLibraryCover, uri: '/test-artwork/night-library-cover.jpg'}};
});
vi.mock('../src/ui/images/galleryArtwork', async importOriginal => {
  const {galleryArtwork} = await importOriginal<typeof import('../src/ui/images/galleryArtwork')>();
  return {galleryArtwork: galleryArtwork.map((image, index) => ({...image, uri: `/test-artwork/gallery-${index}.jpg`}))};
});
