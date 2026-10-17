// MathML Core elements for JSX. React 19 renders them natively; its type definitions do not list them yet.
// Type-only: no runtime code, no dependency.
import "react";

type MathMLProps = import("react").HTMLAttributes<HTMLElement> & {
  display?: "block" | "inline";
  mathvariant?: string;
  accent?: "true" | "false";
  width?: string;
};

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      math: MathMLProps;
      mrow: MathMLProps;
      mi: MathMLProps;
      mn: MathMLProps;
      mo: MathMLProps;
      msub: MathMLProps;
      msup: MathMLProps;
      mfrac: MathMLProps;
      msqrt: MathMLProps;
      mover: MathMLProps;
      munder: MathMLProps;
      mspace: MathMLProps;
      mtext: MathMLProps;
    }
  }
}
