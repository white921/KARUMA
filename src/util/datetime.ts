import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

export function showLogMessage(str: String) {
  const nowJST = dayjs().tz("Asia/Tokyo").format("YYYY-MM-DD HH:mm");
  console.log(`${str} ${nowJST}`);
}
