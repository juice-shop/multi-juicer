import { classNames } from "../util/classNames";

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
      "rounded-lg shadow-md bg-white dark:bg-gray-800",
      className
    )}
    {...props}
  >
    {children}
  </div>
);
