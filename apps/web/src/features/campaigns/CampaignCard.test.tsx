import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import type { CampaignListItem } from "../../api/hooks";
import { CampaignCard } from "./CampaignCard";

const campaign: CampaignListItem = {
  id: "0192b1c2-7f3e-7a4b-9c1d-2e3f4a5b6c7d",
  name: "Summer Drinks",
  advertiserName: "Fizz Beverages",
  status: "ACTIVE",
  healthStatus: "CRITICAL",
  openIncidentCount: 1,
  deadLetterCount: 2,
  createdAt: "2026-09-06T09:00:00.000Z",
  metrics: {
    totalEvents: 300,
    successfulEvents: 276,
    failedEvents: 24,
    successRate: 0.92,
    errorRate: 0.08,
    avgLatencyMs: 240,
  },
  channels: [
    {
      id: "c1",
      channel: "WEB",
      healthStatus: "HEALTHY",
      metrics: { totalEvents: 100, successRate: 0.99, errorRate: 0.01 },
    },
    {
      id: "c2",
      channel: "SMARTSHOP",
      healthStatus: "CRITICAL",
      metrics: { totalEvents: 100, successRate: 0.78, errorRate: 0.22 },
    },
  ],
};

function renderCard(item: CampaignListItem) {
  return render(
    <MemoryRouter>
      <CampaignCard campaign={item} />
    </MemoryRouter>,
  );
}

describe("CampaignCard", () => {
  it("links to the campaign detail page", () => {
    renderCard(campaign);
    const link = screen.getByRole("link", { name: "Summer Drinks" });
    expect(link).toHaveAttribute("href", `/campaigns/${campaign.id}`);
  });

  it("shows overall health, lifecycle status and per-channel success rates", () => {
    renderCard(campaign);
    expect(screen.getByText("Critical")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("92.0%")).toBeInTheDocument();
    const channels = screen.getByRole("list", { name: "Channels" });
    expect(channels).toHaveTextContent("Website");
    expect(channels).toHaveTextContent("99.0%");
    expect(channels).toHaveTextContent("SmartShop");
    expect(channels).toHaveTextContent("78.0%");
  });

  it("explains missing data rather than showing zero", () => {
    renderCard({
      ...campaign,
      healthStatus: "UNKNOWN",
      metrics: {
        totalEvents: 0,
        successfulEvents: 0,
        failedEvents: 0,
        successRate: null,
        errorRate: null,
        avgLatencyMs: null,
      },
      channels: [
        {
          id: "c1",
          channel: "WEB",
          healthStatus: "UNKNOWN",
          metrics: { totalEvents: 0, successRate: null, errorRate: null },
        },
      ],
    });
    expect(screen.getByText("No delivery data")).toBeInTheDocument();
    expect(screen.getByText("None yet")).toBeInTheDocument();
    expect(screen.queryByText("0%")).not.toBeInTheDocument();
  });
});
