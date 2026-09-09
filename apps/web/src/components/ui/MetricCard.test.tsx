import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MetricCard, NO_DATA_MESSAGE } from "./MetricCard";

describe("MetricCard", () => {
  it("renders the label and formatted value", () => {
    render(<MetricCard label="Success rate" value="98.4%" hint="Last 24 hours" />);
    expect(screen.getByText("Success rate")).toBeInTheDocument();
    expect(screen.getByText("98.4%")).toBeInTheDocument();
    expect(screen.getByText("Last 24 hours")).toBeInTheDocument();
  });

  it("shows an explicit no-data message instead of a misleading zero", () => {
    render(<MetricCard label="Success rate" value={null} />);
    expect(screen.getByText(NO_DATA_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByText("0%")).not.toBeInTheDocument();
  });
});
