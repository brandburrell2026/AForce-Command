// React 19 removed the global JSX namespace. @react-three/fiber v9 augments
// React's own JSX namespace with the three.js intrinsic elements; this file
// restates that augmentation so the package typechecks on its own even if
// the fiber declaration is tree-shaken out of the program.
import type { ThreeElements } from "@react-three/fiber";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements extends ThreeElements {}
  }
}
