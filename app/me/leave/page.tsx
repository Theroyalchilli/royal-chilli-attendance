import { redirect } from "next/navigation";

export default function MyLeaveRedirect() {
  redirect("/me/requests?tab=leave");
}
