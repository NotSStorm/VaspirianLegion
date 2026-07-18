import { useState } from 'react';
import { Shield } from 'lucide-react';

type LegionCrestProps = {
  className?: string;
  alt?: string;
};

export default function LegionCrest({ className, alt = 'Vaspirian Legion crest' }: LegionCrestProps) {
  const [loadFailed, setLoadFailed] = useState(false);

  if (loadFailed) {
    return <Shield className={className} aria-label={alt} />;
  }

  return <img src="/legion-crest.png" alt={alt} className={className} onError={() => setLoadFailed(true)} />;
}
