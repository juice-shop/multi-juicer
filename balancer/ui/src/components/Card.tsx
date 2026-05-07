import { classNames } from "@/util/classNames";

export const Card = ({
  children,
  className,
  ...props
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <div
    className={classNames(
      "rounded-lg shadow-md bg-ctf-primary dark:bg-ctf-primary",
      className
    )}
    {...props}
  >
    {children}
  </div>
);
