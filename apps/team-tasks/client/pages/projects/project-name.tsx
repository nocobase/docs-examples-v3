import { useEffect, useRef, useState } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '#components/ui/tooltip';

export function ProjectName({ name }: { name: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() =>
      setOverflow(element.scrollWidth > element.clientWidth),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [name]);
  return (
    <Tooltip disabled={!overflow}>
      <TooltipTrigger
        render={
          <span
            ref={ref}
            className='block truncate'
            tabIndex={overflow ? 0 : undefined}
          />
        }
      >
        {name}
      </TooltipTrigger>
      <TooltipContent className='max-w-xs break-all'>{name}</TooltipContent>
    </Tooltip>
  );
}
