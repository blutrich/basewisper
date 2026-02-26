import { forwardRef } from "react";

const Badge = forwardRef(({ className = "", variant = "default", ...props }, ref) => {
  const baseStyles =
    "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none";

  const variantStyles = {
    default: "border-transparent bg-primary text-primary-foreground",
    secondary: "border-transparent bg-secondary text-secondary-foreground",
    destructive: "border-transparent bg-destructive text-destructive-foreground",
    outline: "text-foreground",
  };

  return (
    <div
      ref={ref}
      className={`${baseStyles} ${variantStyles[variant] || variantStyles.default} ${className}`}
      {...props}
    />
  );
});

Badge.displayName = "Badge";

export { Badge };
