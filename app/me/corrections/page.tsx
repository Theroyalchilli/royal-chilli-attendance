import { redirect } from "next/navigation";

export default function MyCorrectionsRedirect() {
  redirect("/me/requests?tab=corrections");
}
