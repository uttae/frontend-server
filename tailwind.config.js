/** @type {import('tailwindcss').Config} */
const layoutTokens = require("./src/lib/layout-tokens");

module.exports = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)"],
        heading: ["var(--font-sans)"],
      },
      colors: {
        "light-gray": "#d9d9d9",
        "dark-gray": "#6a7282",
        "gray-border": "#e5e7eb",
        "bubble-gray": "#f1f1f1",
        /** AI 응답 말풍선 — 밝은 뉴트럴 서피스에 진한 글자 (WCAG 대비용), 상대방 회색 말풍선과 톤 구분 */
        "ai-bubble": "#ebf1f5",
        "ai-bubble-border": "#c9d4df",
        "muted-brown": "#695656",
        "gray-300": "#e2e8f0",

        /* ===== Figma 디자인 시스템 — Semantic =====
         * primitive(gray/blue/lime…)는 Tailwind 기본 팔레트와 이름이 겹쳐
         * 일부러 등록하지 않는다. globals.css 의 CSS 변수로만 존재한다.
         * 신규 코드는 아래 semantic 만 사용할 것. */
        primary: {
          subtle: "var(--color-primary-subtle)",
          DEFAULT: "var(--color-primary-default)",
          strong: "var(--color-primary-strong)",
        },
        secondary: {
          subtle: "var(--color-secondary-subtle)",
          DEFAULT: "var(--color-secondary-default)",
          strong: "var(--color-secondary-strong)",
        },
        text: {
          subtle: "var(--color-text-subtle)",
          DEFAULT: "var(--color-text-default)",
          disabled: "var(--color-text-disabled)",
          inverse: "var(--color-text-inverse)",
        },
        icon: {
          subtle: "var(--color-icon-subtle)",
          DEFAULT: "var(--color-icon-default)",
          disabled: "var(--color-icon-disabled)",
          inverse: "var(--color-icon-inverse)",
        },
        fill: {
          subtle: "var(--color-fill-subtle)",
          DEFAULT: "var(--color-fill-default)",
          strong: "var(--color-fill-strong)",
        },
        border: {
          subtle: "var(--color-border-subtle)",
          DEFAULT: "var(--color-border-default)",
          hover: "var(--color-border-hover)",
        },
        background: {
          DEFAULT: "var(--color-background-default)",
          strong: "var(--color-background-strong)",
        },
        status: {
          positive: "var(--color-status-positive)",
          cautionary: "var(--color-status-cautionary)",
          negative: "var(--color-status-negative)",
        },
      },
      fontSize: {
        /* Figma Type Scale 기준 (Foundation 설명문이 아님) */
        "display-l": ["48px", { lineHeight: "60px", fontWeight: "700", letterSpacing: "-0.02em" }],
        "display-m": ["40px", { lineHeight: "52px", fontWeight: "700", letterSpacing: "-0.02em" }],
        "heading-l": ["32px", { lineHeight: "42px", fontWeight: "700", letterSpacing: "-0.02em" }],
        "heading-m": ["28px", { lineHeight: "38px", fontWeight: "700", letterSpacing: "-0.02em" }],
        "heading-s": ["24px", { lineHeight: "34px", fontWeight: "600", letterSpacing: "-0.02em" }],
        "title-l": ["22px", { lineHeight: "30px", fontWeight: "600", letterSpacing: "-0.02em" }],
        "title-m": ["20px", { lineHeight: "28px", fontWeight: "600", letterSpacing: "-0.02em" }],
        "title-s": ["18px", { lineHeight: "26px", fontWeight: "600", letterSpacing: "-0.02em" }],
        "body-l-regular": ["18px", { lineHeight: "28px", fontWeight: "400", letterSpacing: "-0.02em" }],
        "body-l-emphasis": ["18px", { lineHeight: "28px", fontWeight: "500", letterSpacing: "-0.02em" }],
        "body-m-regular": ["16px", { lineHeight: "24px", fontWeight: "400", letterSpacing: "-0.02em" }],
        "body-m-emphasis": ["16px", { lineHeight: "24px", fontWeight: "500", letterSpacing: "-0.02em" }],
        "body-s-regular": ["14px", { lineHeight: "20px", fontWeight: "400", letterSpacing: "-0.02em" }],
        "body-s-emphasis": ["14px", { lineHeight: "20px", fontWeight: "500", letterSpacing: "-0.02em" }],
        "body-xs-regular": ["12px", { lineHeight: "16px", fontWeight: "400", letterSpacing: "-0.01em" }],
        "body-xs-emphasis": ["12px", { lineHeight: "16px", fontWeight: "500", letterSpacing: "-0.01em" }],
        "label-xl-regular": ["18px", { lineHeight: "24px", fontWeight: "500", letterSpacing: "-0.02em" }],
        "label-xl-emphasis": ["18px", { lineHeight: "24px", fontWeight: "700", letterSpacing: "-0.02em" }],
        "label-l-regular": ["16px", { lineHeight: "22px", fontWeight: "500", letterSpacing: "-0.02em" }],
        "label-l-emphasis": ["16px", { lineHeight: "22px", fontWeight: "700", letterSpacing: "-0.02em" }],
        "label-m-regular": ["14px", { lineHeight: "20px", fontWeight: "500", letterSpacing: "-0.02em" }],
        "label-m-emphasis": ["14px", { lineHeight: "20px", fontWeight: "700", letterSpacing: "-0.02em" }],
        "label-s-regular": ["13px", { lineHeight: "18px", fontWeight: "500", letterSpacing: "-0.01em" }],
        "label-s-emphasis": ["13px", { lineHeight: "18px", fontWeight: "700", letterSpacing: "-0.01em" }],
        "label-xs-regular": ["12px", { lineHeight: "16px", fontWeight: "400", letterSpacing: "-0.01em" }],
        "label-xs-emphasis": ["12px", { lineHeight: "16px", fontWeight: "700", letterSpacing: "-0.01em" }],
        "caption-l-regular": ["13px", { lineHeight: "18px", fontWeight: "500", letterSpacing: "-0.01em" }],
        "caption-l-emphasis": ["13px", { lineHeight: "18px", fontWeight: "500", letterSpacing: "-0.01em" }],
        "caption-m-regular": ["12px", { lineHeight: "16px", fontWeight: "500", letterSpacing: "0.00em" }],
        "caption-m-emphasis": ["12px", { lineHeight: "16px", fontWeight: "500", letterSpacing: "0.00em" }],
        "caption-s-regular": ["11px", { lineHeight: "16px", fontWeight: "500", letterSpacing: "0.00em" }],
        "caption-s-emphasis": ["11px", { lineHeight: "16px", fontWeight: "500", letterSpacing: "0.00em" }],
      },

      borderRadius: {
        sm: "0.375rem",
        md: "0.5rem",
        lg: "0.625rem",
        xl: "0.875rem",
        "2xl": "1.125rem",
        "3xl": "1.375rem",
        "4xl": "1.625rem",
      },
      width: layoutTokens.width,
      screens: {
        s1: layoutTokens.width.s1,
        s2: layoutTokens.width.s2,
        /** 랜딩 전용 — 기본 sm(640)·lg(1024)보다 낮은 기준 */
        "landing-sm": "480px",
        "landing-lg": "720px",
      },
      keyframes: {
        chatHistoryIn: {
          from: { opacity: "0", transform: "translateY(-4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "chat-history-in": "chatHistoryIn 0.2s ease-out forwards",
      },
    },
  },
};
