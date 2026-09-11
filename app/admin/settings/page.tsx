import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import SettingsForm from "./SettingsForm";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/admin");
  return <SettingsForm />;
}
