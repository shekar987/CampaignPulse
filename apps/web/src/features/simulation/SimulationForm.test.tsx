import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SimulationForm } from "./SimulationForm";

const campaignId = "0192b1c2-7f3e-7a4b-9c1d-2e3f4a5b6c7e";

describe("SimulationForm", () => {
  it("submits a preset scenario for the selected channels", async () => {
    const onSubmit = vi.fn(async () => {});
    render(
      <SimulationForm
        campaignId={campaignId}
        channels={["WEB", "SMARTSHOP"]}
        onSubmit={onSubmit}
        submitting={false}
      />,
    );
    const user = userEvent.setup();

    expect(screen.getByText(/200 deliveries will be requested/i)).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Scenario"), "RETRY_SUCCESS");
    await user.click(screen.getByLabelText("SmartShop"));
    expect(screen.getByText(/1 delivery will be requested/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /run simulation/i }));
    expect(onSubmit).toHaveBeenCalledWith({
      campaignId,
      channels: ["WEB"],
      scenario: "RETRY_SUCCESS",
    });
  });

  it("shows custom controls and converts the failure percentage to a rate", async () => {
    const onSubmit = vi.fn(async () => {});
    render(
      <SimulationForm
        campaignId={campaignId}
        channels={["WEB"]}
        onSubmit={onSubmit}
        submitting={false}
      />,
    );
    const user = userEvent.setup();

    expect(screen.queryByLabelText(/deliveries per channel/i)).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Scenario"), "CUSTOM");
    await user.clear(screen.getByLabelText(/deliveries per channel/i));
    await user.type(screen.getByLabelText(/deliveries per channel/i), "120");
    await user.clear(screen.getByLabelText(/failure rate/i));
    await user.type(screen.getByLabelText(/failure rate/i), "12.5");
    await user.type(screen.getByLabelText(/seed/i), "42");
    await user.click(screen.getByRole("button", { name: /run simulation/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      campaignId,
      channels: ["WEB"],
      scenario: "CUSTOM",
      deliveries: 120,
      failureRate: 0.125,
      seed: 42,
    });
  });

  it("refuses to run without a channel", async () => {
    const onSubmit = vi.fn(async () => {});
    render(
      <SimulationForm
        campaignId={campaignId}
        channels={["WEB"]}
        onSubmit={onSubmit}
        submitting={false}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByLabelText("Website"));
    await user.click(screen.getByRole("button", { name: /run simulation/i }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/select at least one channel/i)).toBeInTheDocument();
  });
});
