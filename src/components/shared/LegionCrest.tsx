type LegionCrestProps = {
  className?: string;
  alt?: string;
};

export default function LegionCrest({ className, alt = 'Vaspirian Legion crest' }: LegionCrestProps) {
  return <img src="/legion-crest.png" alt={alt} className={className} />;
}
