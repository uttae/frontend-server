type BrandLogoProps = {
  variant: "symbol" | "wordmark" | "combination";
  size: "S" | "M" | "L";
  alt?: string;
};

/**
 * 앱 공식 로고 SVG — Safari 호환을 위해 네이티브 `<img>` 사용.
 */
export function BrandLogo({
  variant = "combination",
  size = "M",
  alt = "우때 로고",
}: Readonly<BrandLogoProps>) {
  const LOGO_ASSETS = {
    symbol: {
      S: { src: "/brand/App_Icon.svg", width: 23, height: 23 },
      M: { src: "/brand/App_Icon.svg", width: 45, height: 45 },
      L: { src: "/brand/App_Icon.svg", width: 290, height: 130 },
    },
    wordmark: {
      S: { src: "/brand/Wordmark_S.svg", width: 47, height: 23 },
      M: { src: "/brand/Wordmark_M.svg", width: 93, height: 45 },
      L: { src: "/brand/Wordmark_L.svg", width: 186, height: 90 },
    },
    combination: {
      S: { src: "/brand/Combination_Mark_S_DefaultBlue.svg", width: 76, height: 23 },
      M: { src: "/brand/Combination_Mark_M_DefaultBlue.svg", width: 147, height: 45 },
      L: { src: "/brand/Combination_Mark_L_DefaultBlue.svg", width: 290, height: 90 },
    },
  };

  const logoConfig = LOGO_ASSETS[variant][size];

  return (
    // eslint-disable-next-line @next/next/no-img-element -- local brand asset; Safari-safe
    <img
      src={logoConfig.src}
      alt={alt}
      width={logoConfig.width}
      height={logoConfig.height}
      decoding="async"
      className="block shrink-0"
    />
  );
}
