import { redirect } from "next/navigation";

export default function LegacySettingsRedirectPage() {
  redirect("/member-settings");
}
