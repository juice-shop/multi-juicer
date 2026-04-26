function FirstPlace({ ...props }) {
  return <img src="/balancer/icons/first-place.svg" {...props} />;
}

function SecondPlace({ ...props }) {
  return <img src="/balancer/icons/second-place.svg" {...props} />;
}

function ThirdPlace({ ...props }) {
  return <img src="/balancer/icons/third-place.svg" {...props} />;
}

export function PositionDisplay({ place }: { place: number }) {
  switch (place) {
    case 1:
      return <FirstPlace className="h-10" />;
    case 2:
      return <SecondPlace className="h-10" />;
    case 3:
      return <ThirdPlace className="h-10" />;
    default:
      return (
        <>
          <small>#</small>
          {place}
        </>
      );
  }
}
