import { useNotifications } from "@/hooks/useNotifications";

export default function NotificationListener() {
  const { data } = useNotifications();
  return (
    <ul>
      {data?.map((item, index) => (
        <li key={index} className={``}>
          <p>{item.title}</p>
          <div>{item.message}</div>
        </li>
      ))}
    </ul>
  );
}
