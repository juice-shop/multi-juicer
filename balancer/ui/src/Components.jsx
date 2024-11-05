function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

export const Input = ({ ...props }) => (
  <input
    className="bg-gray-300 border-none rounded p-3 text-sm block w-full invalid:outline-red-500"
    {...props}
  />
);

export const Label = ({ children, ...props }) => (
  <label className="font-light block mb-1" {...props}>
    {children}
  </label>
);

export const Form = ({ children, ...props }) => (
  <form className="mt-8" {...props}>
    {children}
  </form>
);

export const Button = ({ children, ...props }) => (
  <button
    className="bg-red-600 p-3 text-sm font-semibold text-white block w-full rounded border-none mt-3 cursor-pointer text-center no-underline disabled:bg-red-600/30 disabled:cursor-wait"
    {...props}
  >
    {children}
  </button>
);

export const SecondaryButton = ({ children, ...props }) => (
  <Button
    className="bg-gray-300 text-gray-900 disabled:bg-gray-300/50"
    {...props}
  >
    {children}
  </Button>
);

export const Card = ({ children, className, ...props }) => (
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

export const BodyCard = ({ children, className, ...props }) => (
  <div
    className={classNames(
      "rounded-lg shadow-md bg-white dark:bg-gray-800 p-12 w-2/5 min-w-[400px] max-w-[650px] mb-8 md:min-w-[328px] lg:w-9/20 lg:my-2 lg:p-12",
      className
    )}
    {...props}
  >
    {children}
  </div>
);

export const CenteredCard = ({ children, ...props }) => (
  <BodyCard className="flex justify-center items-center" {...props}>
    {children}
  </BodyCard>
);
