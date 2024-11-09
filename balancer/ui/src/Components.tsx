import { classNames } from "./util/classNames";

export const Input = ({ ...props }) => (
  <input
    className="bg-gray-300 border-none rounded p-3 text-sm block w-full text-gray-800 invalid:outline-red-500 invalid:bg-red-100 outline"
    {...props}
  />
);

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

export const BodyCard = ({
  children,
  className,
  ...props
}: {
  children: React.ReactNode;
  className?: string;
}) => (
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

export const CenteredCard = ({
  children,
  ...props
}: {
  children: React.ReactNode;
}) => (
  <BodyCard className="flex justify-center items-center" {...props}>
    {children}
  </BodyCard>
);
