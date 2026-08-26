import { ImageCard } from './ImageCard';

/** Masonry layout via CSS columns (spec §4, §17). */
export function MasonryGrid({ images, onOpen }) {
  return (
    <div className="columns-1 gap-3 sm:columns-2 lg:columns-3 xl:columns-4 [&>*]:mb-3 [&>*]:break-inside-avoid">
      {images.map((image) => (
        <ImageCard key={image.id} image={image} onOpen={onOpen} />
      ))}
    </div>
  );
}
