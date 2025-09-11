/** @type {import('tailwindcss').Config} */
const flattenColorPalette =
  require("tailwindcss/lib/util/flattenColorPalette").default;

module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      screens: {
        xs: "320px",
        xms: "440px",
        sm: "640px",
        md: "768px",
        mdl: "840px",
        lgm: "910px",
        lg: "1024px",
        xl: "1280px",
        "2xl": "1536px",
        "3xl": "1920px",
        "4xl": "2560px",
      },
      fontSize: {
        xxs: "0.625rem", // 10px
      },
      colors: {
        primary: "#002B2B ",
        second: "#1E453E",
        third: "#ffcb74",
        warn: "#FFA500", // Orange warning color
        success: "#22C55E", // Green success color
        edit: "#3B82F6", // Blue edit color
        danger: "#EF4444", // Red danger color
      },
      animation: {
        spin: "spin 1s linear infinite",
      },
      keyframes: {
        spin: {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-100%)" },
        },
      },
      zIndex: {
        base: 0,
        overlay: 10,
        tooltip: 20,
        modal: 30,
      },
    },
  },
  plugins: [
    function ({ addUtilities, matchUtilities, theme }) {
      // 1) Flex utilities
      const newUtilities = {
        ".center-flex": {
          display: "flex",
          "justify-content": "center",
          "align-items": "center",
        },
        ".between-flex": {
          display: "flex",
          "justify-content": "space-between",
          "align-items": "center",
        },
        ".start-flex": {
          display: "flex",
          "justify-content": "flex-start",
          "align-items": "center",
        },
        ".end-flex": {
          display: "flex",
          "justify-content": "flex-end",
          "align-items": "center",
        },
        ".evenly-flex": {
          display: "flex",
          "justify-content": "space-evenly",
          "align-items": "center",
        },
        ".around-flex": {
          display: "flex",
          "justify-content": "space-around",
          "align-items": "center",
        },
      };

      // 2) Base button styles
      const btnUtilities = {
        ".btn": {
          "@apply inline-flex transition-all duration-200 ease-in-out focus:outline-none cursor-pointer":
            {},
        },
        ".btn-icon": {
          "@apply center-flex transition-all duration-200 ease-in-out focus:outline-none cursor-pointer":
            {},
        },
      };

      const inputUtilities = {
        ".input": {
          "@apply center-flex font-semibold transition-all duration-200 outline-none":
            {},
        },
      };

      // 3) Size Utilities
      const sizeUtilities = {
        ".btn-xxs": {
          "@apply p-1 text-[0.65rem]": {},
        },
        ".btn-xs": {
          "@apply p-1.5 text-[0.75rem]": {},
        },
        ".btn-sm": {
          "@apply px-2 py-2 text-xs": {},
        },
        ".btn-md": {
          "@apply px-4 py-2.5 text-sm": {},
        },
        ".btn-lg": {
          "@apply px-6 py-3 text-base": {},
        },
        ".btn-xl": {
          "@apply px-8 py-4 text-lg": {},
        },
      };
      const iconSizeUtilities = {
        ".btn-icon-sm": {
          "@apply w-8 h-8 text-xs": {},
        },
        ".btn-icon-md": {
          "@apply w-10 h-10 text-sm": {},
        },
        ".btn-icon-lg": {
          "@apply w-14 h-14 text-base": {},
        },
        ".btn-icon-xl": {
          "@apply w-16 h-16 text-lg": {},
        },
      };

      // 4) State / Color Utilities (Success, Danger, Edit)
      const stateUtilities = {
        ".btn-success": {
          "@apply bg-success border border-success text-white": {},
          "&:hover": {
            "@apply bg-success/60": {},
          },
        },
        ".btn-warn": {
          "@apply bg-warn border border-warn text-white": {},
          "&:hover": {
            "@apply bg-warn/60": {},
          },
        },
        ".btn-edit": {
          "@apply bg-edit border border-edit text-white": {},
          "&:hover": {
            "@apply bg-edit/60": {},
          },
        },
      };

      // Input size utilities (similar to button sizes)
      const inputSizeUtilities = {
        ".input-sm": {
          "@apply px-2 py-2.5 text-xs": {},
        },
        ".input-md": {
          "@apply px-4 py-3 text-sm": {},
        },
        ".input-lg": {
          "@apply px-6 py-4 text-base": {},
        },
        ".input-xl": {
          "@apply px-8 py-5 text-lg": {},
        },
      };

      // 4) Custom input color utilities (primary, success, danger, etc.)
      const inputStateUtilities = {
        ".input-primary": {
          "@apply border-primary text-primary opacity-70": {},
          "&:focus": {
            "@apply opacity-100": {},
          },
        },
        ".input-success": {
          "@apply border-success text-success opacity-70": {},
          "&:focus": {
            "@apply opacity-100": {},
          },
        },
        ".input-danger": {
          "@apply border-danger text-danger opacity-70": {},
          "&:focus": {
            "@apply opacity-100": {},
          },
        },
        ".input-edit": {
          "@apply border-edit text-edit opacity-70": {},
          "&:focus": {
            "@apply opacity-100": {},
          },
        },
        ".input-warn": {
          "@apply border-warn text-warn opacity-70": {},
          "&:focus": {
            "@apply opacity-100": {},
          },
        },
      };

      matchUtilities(
        {
          "input-outline": (value) => ({
            border: `2px solid ${value}`,
            borderBottomWidth: `4px`,
            color: value,
            backgroundColor: "transparent",
            transition: "opacity 0.2s ease-in-out",
            "&::placeholder": {
              color: value,
            },
            "&:focus": {
              borderColor: value,
            },
          }),
        },
        { values: flattenColorPalette(theme("colors")) }
      );

      // matchUtilities(
      //   {
      //     // Generates .btn-{colorName} classes
      //     btn: (value) => ({
      //       backgroundColor: value,
      //       borderColor: value,
      //       color: "#fff",
      //       border: `1px solid ${value}`,
      //       borderRightWidth: `4px`,
      //       borderLeftWidth: `4px`,

      //       "&:hover": {
      //         backgroundColor: `rgba(${parseInt(
      //           value.slice(1, 3),
      //           16
      //         )}, ${parseInt(value.slice(3, 5), 16)}, ${parseInt(
      //           value.slice(5, 7),
      //           16
      //         )}, 0.6)`,
      //       },
      //     }),
      //   },
      //   { values: flattenColorPalette(theme("colors")) }
      // );

      addUtilities(
        {
          ".btn-slide": {
            // Isolate transform transition from btn's transition-all
            "transition-property": "transform",
            "transition-duration": "400ms",
            "transition-timing-function": "ease-in-out",
            "&:not(:hover)": {
              transform: "translate(0, 0)",
            },
          },
        },
        { respectImportant: true }
      );

      // 2. Then add the directional variants
      matchUtilities(
        {
          "btn-slide": (value) => {
            // Handle both predefined directions and arbitrary values
            const directions = {
              right: "6px, 0",
              left: "-6px, 0",
              top: "0, -6px",
              bottom: "0, 6px",
            };

            // If value matches a direction key, use that, otherwise use the raw value
            const translateValue = directions[value] || value;

            return {
              "&:hover": {
                transform: `translate(${translateValue})`,
              },
            };
          },
        },
        {
          values: {
            right: "right",
            left: "left",
            top: "top",
            bottom: "bottom",
          },
          // Enable arbitrary values with custom syntax
          type: ["any"],
          supportsArbitraryValues: true,
          supportsNegativeValues: true,
        }
      );

      // Add this to your plugins section (where you have other button utilities)
      addUtilities({
        ".btn-group": {
          // Base group styles
          "@apply flex items-center": {},
          "& > .btn": {
            "&:not(:last-child)": {
              // Add divider between buttons (optional)
              "border-right": "1px solid rgba(255, 255, 255, 0.2)",
            },
            "&:hover": {
              // Special hover effect when in group
              transform: "translateY(-1px)",
              "box-shadow": "0 2px 4px rgba(0,0,0,0.1)",
            },
            "&:active": {
              // Pressed state
              transform: "translateY(0)",
            },
          },
          "& > .btn-icon": {
            // Special treatment for icon buttons in group
            "@apply rounded-none": {},
            "&:hover": {
              transform: "scale(1.05)",
            },
          },
        },
      });

      addUtilities({
        ".btn-tooltip": {
          position: "relative",
          "&:hover .tooltip": {
            visibility: "visible",
            opacity: "1",
          },
          "& .tooltip": {
            visibility: "hidden",
            position: "absolute",
            padding: "4px 8px",
            backgroundColor: "#71717a",
            color: "#fff",
            fontSize: "11px",
            whiteSpace: "nowrap",
            opacity: "0",
            transition: "all 0.2s ease",
            zIndex: "10",
            "&:after": {
              content: '""',
              position: "absolute",
              borderWidth: "4px",
              borderStyle: "solid",
            },
          },
        },

        // Position variants
        ".btn-tooltip-top": {
          "& .tooltip": {
            bottom: "100%",
            left: "50%",
            transform: "translateX(-50%)",
            marginBottom: "8px",
            "&:after": {
              top: "100%",
              left: "50%",
              marginLeft: "-4px",
              borderColor: "#71717a transparent transparent transparent",
            },
          },
        },
        ".btn-tooltip-bottom": {
          "& .tooltip": {
            top: "100%",
            left: "50%",
            transform: "translateX(-50%)",
            marginTop: "8px",
            "&:after": {
              bottom: "100%",
              left: "50%",
              marginLeft: "-4px",
              borderColor: "transparent transparent #71717a transparent",
            },
          },
        },
        ".btn-tooltip-left": {
          "& .tooltip": {
            right: "100%",
            top: "50%",
            transform: "translateY(-50%)",
            marginRight: "8px",
            "&:after": {
              left: "100%",
              top: "50%",
              marginTop: "-4px",
              borderColor: "transparent transparent transparent #71717a",
            },
          },
        },
        ".btn-tooltip-right": {
          "& .tooltip": {
            left: "100%",
            top: "50%",
            transform: "translateY(-50%)",
            marginLeft: "8px",
            "&:after": {
              right: "100%",
              top: "50%",
              marginTop: "-4px",
              borderColor: "transparent #71717a transparent transparent",
            },
          },
        },
      });

      addUtilities({
        ".btn-badge": {
          position: "relative",
          "& .badge": {
            position: "absolute",
            top: "-0.5rem",
            right: "-0.5rem",
            width: "2rem",
            height: "1.4rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          },
        },
      });

      addUtilities({
        ".btn-loading-infinity": {
          "&::after": {
            content: '""',
            display: "inline-block",
            width: "1em",
            height: "1em",
            border: "2px solid currentColor",
            borderRightColor: "transparent",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
            marginLeft: "0.5em",
          },
        },
      });

      addUtilities(inputStateUtilities);
      addUtilities(inputUtilities);
      addUtilities(inputSizeUtilities);
      addUtilities(newUtilities);
      addUtilities(btnUtilities);
      addUtilities(sizeUtilities);
      addUtilities(iconSizeUtilities);
      addUtilities(stateUtilities);
    },
  ],
};
