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
        className={`relative block shrink-0 ${className}`}
        style={{ width: size, height: size }}
        aria-label="VVVeco official logo"
      >
        <Image
          src="/brand/vvveco-logo-navy.png"
          alt="VVVeco"
          fill
          sizes={`${size}px`}
          className="object-contain dark:hidden"
          priority
        />
        <Image
          src="/brand/vvveco-logo-cream.png"
          alt="VVVeco"
          fill
          sizes={`${size}px`}
          className="hidden object-contain dark:block"
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
      priority
    />
  );
}
