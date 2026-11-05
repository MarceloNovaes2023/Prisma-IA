import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { NewLeadForm } from "@/components/leads/new-lead-form";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default function NovoLeadPage() {
  return (
    <div className="mx-auto max-w-[1200px] space-y-4">
      <PageHeader
        eyebrow="Captação manual"
        title="Novo lead"
        description="Escolha o nicho: o formulário de qualificação, o score e a cadência mudam automaticamente."
        actions={
          <Link href="/leads" className="btn">
            <ArrowLeft size={13} /> Voltar
          </Link>
        }
      />
      <NewLeadForm />
    </div>
  );
}
