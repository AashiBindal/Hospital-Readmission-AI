import { Navigate, Route, Routes } from "react-router-dom";
import MainLayout from "@/components/layout/MainLayout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Patients from "@/pages/Patients";
import Upload from "@/pages/Upload";
import DataQuality from "@/pages/DataQuality";
import Predictions from "@/pages/Predictions";
import Followups from "@/pages/Followups";
import Reports from "@/pages/Reports";
import NotFound from "@/pages/NotFound";
import { ROUTES } from "./paths";

/**
 * Central route table.
 * TODO (Member 1): wrap the layout route in a ProtectedRoute once auth is implemented.
 */
export default function AppRoutes() {
  return (
    <Routes>
      <Route path={ROUTES.LOGIN} element={<Login />} />
      <Route element={<MainLayout />}>
        <Route path="/" element={<Navigate to={ROUTES.DASHBOARD} replace />} />
        <Route path={ROUTES.DASHBOARD} element={<Dashboard />} />
        <Route path={ROUTES.PATIENTS} element={<Patients />} />
        <Route path={ROUTES.UPLOAD} element={<Upload />} />
        <Route path={ROUTES.DATA_QUALITY} element={<DataQuality />} />
        <Route path={ROUTES.PREDICTIONS} element={<Predictions />} />
        <Route path={ROUTES.FOLLOWUPS} element={<Followups />} />
        <Route path={ROUTES.REPORTS} element={<Reports />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
