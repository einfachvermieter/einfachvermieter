import type { ReactNode } from "react";

type TextWithLinkProps = {
  template: string;
  link: ReactNode;
  placeholder?: string;
};

export const TextWithLink = ({
  template,
  link,
  placeholder = "{link}",
}: TextWithLinkProps) => {
  const [before, after] = template.split(placeholder);
  if (after === undefined) {
    return <>{template}</>;
  }
  return (
    <>
      {before}
      {link}
      {after}
    </>
  );
};
