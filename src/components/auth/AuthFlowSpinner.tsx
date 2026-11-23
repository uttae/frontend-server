import { Spinner } from "@/components/ui/spinner";

export function AuthFlowSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-bubble-gray/80 via-white to-white px-4">
      <Spinner size={32} />
    </div>
  );
}
