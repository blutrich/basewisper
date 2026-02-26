import { Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import HistoryPage from "@/pages/HistoryPage";
import SettingsPage from "@/pages/SettingsPage";
import AnalyticsPage from "@/pages/AnalyticsPage";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HistoryPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </Layout>
  );
}
