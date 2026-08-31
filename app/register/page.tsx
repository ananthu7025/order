import type { Metadata } from "next";
import { RegisterWizard } from "@/components/RegisterWizard";

export const metadata: Metadata = {
  title: "Create your manufacturer account — MOQ Pool",
};

export default function RegisterPage() {
  return <RegisterWizard />;
}
