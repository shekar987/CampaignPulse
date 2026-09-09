import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CampaignStatusBadge, EventStatusBadge, HealthBadge } from "./StatusBadge";

describe("HealthBadge", () => {
  it.each([
    ["HEALTHY", "Healthy"],
    ["DEGRADED", "Degraded"],
    ["CRITICAL", "Critical"],
    ["UNKNOWN", "No data"],
  ] as const)("renders a text label for %s so colour is never the only cue", (status, label) => {
    render(<HealthBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("marks its icon as decorative", () => {
    const { container } = render(<HealthBadge status="CRITICAL" />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });
});

describe("CampaignStatusBadge and EventStatusBadge", () => {
  it("render human-readable labels", () => {
    render(
      <>
        <CampaignStatusBadge status="PAUSED" />
        <EventStatusBadge status="FINAL_FAILURE" />
      </>,
    );
    expect(screen.getByText("Paused")).toBeInTheDocument();
    expect(screen.getByText("Final failure")).toBeInTheDocument();
  });
});
