import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/**
 * Custom HTML shell for the Expo Router web bundle.
 *
 * Sole purpose: paint the document pure black BEFORE the JS bundle
 * evaluates, so the Replit preview iframe never flashes white between
 * "HTML received" and "React tree mounted". Without this, the default
 * browser white background shows for the multi-second cold-load
 * window and reads as a broken / blank app.
 *
 * Everything else mirrors Expo's default template (charset, viewport,
 * react-native-web ScrollViewStyleReset).
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: backgroundCss }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const backgroundCss = `
html, body, #root {
  background-color: #000000;
}
body {
  color: #FFFFFF;
}
`;
