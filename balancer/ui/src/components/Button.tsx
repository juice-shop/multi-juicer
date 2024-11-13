import { classNames } from "../util/classNames";

export function Button({
  children,
  as,
  className,
  ...props
}: {
  children: React.ReactNode;
  as?: "button" | "a";
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement> &
  React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  if (as === "button" || as === undefined) {
    return (
      <button
        className={classNames(
          "bg-red-600 p-3 text-sm font-semibold text-white block w-full rounded border-none cursor-pointer text-center no-underline disabled:bg-red-600/30 disabled:cursor-wait",
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  } else if (as === "a") {
    return (
      <a
        className={classNames(
          "bg-red-600 p-3 text-sm font-semibold text-white block w-full rounded border-none cursor-pointer text-center no-underline disabled:bg-red-600/30 disabled:cursor-wait",
          className
        )}
        {...props}
      >
        {children}
      </a>
    );
  }

  throw new Error(`Invalid "as" prop passed to Button component: "${as}"`);
}
