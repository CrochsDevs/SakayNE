import { type PropsWithChildren } from 'react';
import { ScrollViewStyleReset } from 'expo-router/html';

export default function RootHTML({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <title>Sakay</title>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content" />
        <meta name="color-scheme" content="only light" />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
