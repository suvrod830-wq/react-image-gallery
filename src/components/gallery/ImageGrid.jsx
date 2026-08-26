import { ImageCard } from './ImageCard';

/**
 * Responsive grid (spec §42): 1–2 columns on mobile, 2–3 tablet, 3–5 desktop.
 * `onOpen` enables lightbox mode; otherwise cards link to detail pages.
 */
export function ImageGrid({ images, onOpen, columns = 4 }) {
  return (
    <div
      className={`grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 ${
        columns >= 4 ? 'xl:grid-cols-4' : ''
      } ${columns >= 5 ? '2xl:grid-cols-5' : ''}`}
    >
      {images.map((image) => (
        <ImageCard key={image.id} image={image} onOpen={onOpen} />
      ))}
    </div>
  );
}
