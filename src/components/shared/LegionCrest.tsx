import { useState } from 'react';

type LegionCrestProps = {
  className?: string;
  alt?: string;
};

const CREST_SOURCES = ['/Dukes_Own_Crest.png', '/dukes_own_crest.png', '/legion-crest.png', '/crest.png', '/logo.png', '/vaspirian-crest.png'];

export default function LegionCrest({ className, alt = 'Vaspirian Legion crest' }: LegionCrestProps) {
  const [sourceIndex, setSourceIndex] = useState(0);

  const currentSource = CREST_SOURCES[sourceIndex];

  if (!currentSource) {
    return <span className={className} aria-label={alt} />;
  }

  return <img src={currentSource} alt={alt} className={className} onError={() => setSourceIndex((index) => index + 1)} />;
}
