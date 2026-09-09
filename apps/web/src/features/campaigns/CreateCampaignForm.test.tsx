import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { CreateCampaignForm } from "./CreateCampaignForm";

function renderForm(onSubmit = vi.fn().mockResolvedValue(undefined)) {
  render(
    <MemoryRouter>
      <CreateCampaignForm onSubmit={onSubmit} submitting={false} />
    </MemoryRouter>,
  );
  return onSubmit;
}

describe("CreateCampaignForm", () => {
  it("shows validation messages tied to their fields and does not submit", async () => {
    const user = userEvent.setup();
    const onSubmit = renderForm();

    await user.click(screen.getByRole("button", { name: "Create campaign" }));

    expect(onSubmit).not.toHaveBeenCalled();
    const nameInput = screen.getByLabelText("Campaign name");
    expect(nameInput).toHaveAttribute("aria-invalid", "true");
    expect(nameInput).toHaveAccessibleDescription(/Campaign name is required/);
    expect(screen.getByText("Advertiser name is required")).toBeInTheDocument();
    expect(screen.getByText("Select at least one channel")).toBeInTheDocument();
  });

  it("submits trimmed values with the selected channels", async () => {
    const user = userEvent.setup();
    const onSubmit = renderForm();

    await user.type(screen.getByLabelText("Campaign name"), "  Autumn Homeware ");
    await user.type(screen.getByLabelText("Advertiser"), "Hearth Living");
    await user.click(screen.getByLabelText(/Website/));
    await user.click(screen.getByLabelText(/In-store display/));
    await user.click(screen.getByRole("button", { name: "Create campaign" }));

    expect(onSubmit).toHaveBeenCalledWith({
      name: "Autumn Homeware",
      advertiserName: "Hearth Living",
      channels: ["WEB", "IN_STORE_DISPLAY"],
    });
  });

  it("surfaces server-side field issues", () => {
    render(
      <MemoryRouter>
        <CreateCampaignForm
          onSubmit={vi.fn()}
          submitting={false}
          serverIssues={[{ path: "name", message: "Campaign name is required" }]}
        />
      </MemoryRouter>,
    );
    expect(screen.getByLabelText("Campaign name")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Campaign name is required")).toBeInTheDocument();
  });
});
