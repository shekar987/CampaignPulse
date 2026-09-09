import { ButtonLink } from "../ui/Button";
import { EmptyState } from "../ui/States";

export function NotFoundPage() {
  return (
    <EmptyState
      icon="search"
      title="Page not found"
      description="The page you are looking for does not exist or has moved."
      action={
        <ButtonLink to="/" variant="primary">
          Back to overview
        </ButtonLink>
      }
    />
  );
}
