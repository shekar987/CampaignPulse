import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DeadLetterStatusBadge, IncidentStatusBadge, SeverityBadge } from "./StatusBadge";

describe("incident and dead-letter badges", () => {
  it("labels every incident status with words, not just colour", () => {
    render(
      <>
        <IncidentStatusBadge status="OPEN" />
        <IncidentStatusBadge status="ACKNOWLEDGED" />
        <IncidentStatusBadge status="RESOLVED" />
      </>,
    );
    expect(screen.getByText("Investigating")).toBeInTheDocument();
    expect(screen.getByText("Acknowledged")).toBeInTheDocument();
    expect(screen.getByText("Resolved")).toBeInTheDocument();
  });

  it("labels severities", () => {
    render(
      <>
        <SeverityBadge severity="CRITICAL" />
        <SeverityBadge severity="WARNING" />
      </>,
    );
    expect(screen.getByText("Critical")).toBeInTheDocument();
    expect(screen.getByText("Warning")).toBeInTheDocument();
  });

  it("labels dead-letter statuses", () => {
    render(<DeadLetterStatusBadge status="PENDING" />);
    expect(screen.getByText("Awaiting replay")).toBeInTheDocument();
  });
});
