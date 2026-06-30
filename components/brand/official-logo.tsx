import Image from "next/image";

type OfficialLogoProps = {
  size?: number;
  className?: string;
  themeAware?: boolean;
};

export function OfficialLogo({
  size = 40,
  className = "",
  themeAware = false,
}: OfficialLogoProps) {
  if (themeAware) {
    return (
      <span
        className={`relative block shrink-0 overflow-hidden ${className}`}
        style={{
          width: size,
          height: size,
          minWidth: size,
          minHeight: size,
          maxWidth: size,
          maxHeight: size,
          display: "block",
          position: "relative",
          overflow: "hidden",
          flexShrink: 0,
        }}
        aria-label="VVVeco official logo"
      >
        <Image
          src="/brand/vvveco-logo-navy.png"
          alt="VVVeco"
          width={size}
          height={size}
          className="object-contain dark:hidden"
          style={{ width: size, height: size, maxWidth: size, maxHeight: size }}
          priority
        />
        <Image
          src="/brand/vvveco-logo-cream.png"
          alt="VVVeco"
          width={size}
          height={size}
          className="object-contain hidden dark:block"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: size,
            height: size,
            maxWidth: size,
            maxHeight: size,
          }}
          priority
        />
      </span>
    );
  }

  return (
    <Image
      src="/brand/vvveco-logo-navy.png"
      alt="VVVeco official logo"
      width={size}
      height={size}
      className={`shrink-0 object-contain ${className}`}
      style={{ width: size, height: size, maxWidth: size, maxHeight: size, flexShrink: 0 }}
      priority
    />
  );
}
