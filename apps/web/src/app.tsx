import { Route, Routes } from "react-router";

import { AppShell } from "./components/layout/AppShell";
import { NotFoundPage } from "./components/layout/NotFoundPage";
import { CampaignDetailPage } from "./features/campaigns/CampaignDetailPage";
import { CampaignsPage } from "./features/campaigns/CampaignsPage";
import { CreateCampaignPage } from "./features/campaigns/CreateCampaignPage";
import { DashboardPage } from "./features/dashboard/DashboardPage";

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="campaigns" element={<CampaignsPage />} />
        <Route path="campaigns/new" element={<CreateCampaignPage />} />
        <Route path="campaigns/:campaignId" element={<CampaignDetailPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
