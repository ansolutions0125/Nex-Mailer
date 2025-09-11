// app/fonts.ts (or fonts.js)
import localFont from 'next/font/local'

// Basic usage
export const myFont = localFont({
  src: '../fonts/MyFont.ttf',
  display: 'swap',
})