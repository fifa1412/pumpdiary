import { gradeBadgeUrl } from "@/lib/scores/grade-badges";
import { cn } from "@/lib/utils";

/**
 * A score's grade: the version's grade image when it has one, the grade as text
 * (styled by className) otherwise.
 */
export function GradeBadge({
  grade,
  version,
  className,
  imageClassName,
}: {
  grade: string;
  /** game_series name whose grade art to show; Phoenix 2 when left out. */
  version?: string;
  className?: string;
  /** Sizes the image, e.g. "h-8"; its width follows the image. */
  imageClassName?: string;
}) {
  const url = gradeBadgeUrl(grade, version);
  if (!url) return <span className={className}>{grade}</span>;
  // The images differ in width, so a plain img keeps each one's own aspect ratio.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={grade} className={cn("w-auto shrink-0 object-contain", imageClassName)} />;
}
