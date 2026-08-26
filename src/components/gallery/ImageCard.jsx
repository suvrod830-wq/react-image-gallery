import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Eye } from 'lucide-react';
import { cloudinaryUrl, cloudinaryBlur } from '../../lib/cloudinary';
import { formatNumber } from '../../utils/format';
import { useAuth } from '../../contexts/AuthContext';

/**
 * A single gallery card. Loads an optimized, appropriately-sized Cloudinary
 * image with lazy loading (spec §10, §52). Avoids heavy metadata per card.
 */
export function ImageCard({ image, onOpen }) {
  const { isAdmin } = useAuth();

  const ratio = useMemo(() => {
    if (image.width && image.height) return (image.height / image.width) * 100;
    return 100; // square fallback
  }, [image.width, image.height]);

  const card = (
    <figure className="group relative block w-full cursor-pointer overflow-hidden rounded-xl bg-stone-200 dark:bg-stone-800">
      <div style={{ paddingTop: `${Math.min(ratio, 150)}%` }} />
      <img
        src={cloudinaryUrl({ publicId: image.cloudinary_public_id, width: 600 })}
        srcSet={`
          ${cloudinaryUrl({ publicId: image.cloudinary_public_id, width: 400 })} 400w,
          ${cloudinaryUrl({ publicId: image.cloudinary_public_id, width: 600 })} 600w,
          ${cloudinaryUrl({ publicId: image.cloudinary_public_id, width: 900 })} 900w
        `}
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        alt={image.alt_text || image.title || ''}
        loading="lazy"
        decoding="async"
        style={{ backgroundImage: `url("${cloudinaryBlur(image.cloudinary_public_id)}")` }}
        className="absolute inset-0 h-full w-full bg-cover object-cover transition duration-300 group-hover:scale-[1.03]"
        onError={(e) => {
          e.currentTarget.style.backgroundImage = '';
          e.currentTarget.src =
            'data:image/svg+xml;utf8,' +
            encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#e7e5e4"/></svg>');
        }}
      />
      <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-3 pt-10 opacity-0 transition duration-200 group-hover:opacity-100">
        <p className="truncate text-sm font-medium text-white">{image.title}</p>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-white/70">
          {image.category?.name && <span>{image.category.name}</span>}
          {image.author?.name && (
            <>
              <span aria-hidden>·</span>
              <span>{image.author.name}</span>
            </>
          )}
        </div>
      </figcaption>
      {image.view_count > 0 && (
        <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-[11px] text-white backdrop-blur">
          <Eye className="h-3 w-3" aria-hidden /> {formatNumber(image.view_count)}
        </span>
      )}
      {isAdmin && (
        <span className="absolute left-2 top-2 rounded-full bg-brand-500 px-2 py-0.5 text-[11px] font-medium text-white">
          {image.is_published ? 'Live' : 'Draft'}
        </span>
      )}
    </figure>
  );

  if (onOpen) {
    return (
      <button type="button" onClick={() => onOpen(image)} className="block w-full text-left">
        {card}
      </button>
    );
  }
  return <Link to={`/image/${image.slug}`}>{card}</Link>;
}
