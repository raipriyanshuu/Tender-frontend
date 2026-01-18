import * as React from "react";

export const Separator = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className = "", ...props }, ref) => (
  <div
    ref={ref}
    className={`h-px w-full bg-zinc-200 ${className}`}
    {...props}
  />
));
Separator.displayName = "Separator";
