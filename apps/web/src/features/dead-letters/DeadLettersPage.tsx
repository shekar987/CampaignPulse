import { PageHeader } from "../../components/ui/PageHeader";
import { DeadLetterPanel } from "./DeadLetterPanel";

export function DeadLettersPage() {
  return (
    <>
      <PageHeader
        title="Dead letters"
        description="Every delivery across all campaigns that gave up after its retries. Widespread entries point at a shared dependency; isolated ones at a single campaign."
      />
      <DeadLetterPanel />
    </>
  );
}
