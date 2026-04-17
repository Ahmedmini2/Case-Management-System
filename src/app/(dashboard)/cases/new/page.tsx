import { CaseForm } from "@/components/cases/CaseForm";

export default function NewCasePage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Create Case</h1>
      <CaseForm />
    </div>
  );
}
