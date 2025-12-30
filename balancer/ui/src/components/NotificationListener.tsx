import { useAdminMessage } from "@/hooks/useAdminMessage";

export default function NotificationListener() {
  const { data } = useAdminMessage();
  return (<div>
    {/*will add toast here*/}
          <p>{data?.title}</p>
          <div>{data?.message}</div>
       </div>
  );
}
