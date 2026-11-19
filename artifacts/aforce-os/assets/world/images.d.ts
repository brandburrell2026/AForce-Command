/** A bundled photograph: Metro gives the import an image source. */
declare module '*.jpg' {
  import type { ImageSourcePropType } from 'react-native';
  const source: ImageSourcePropType;
  export default source;
}
