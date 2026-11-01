import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/routes/paths";
import { APP_NAME } from "@/utils/constants";

/** Placeholder login. TODO (Member 1): connect to backend auth endpoint. */
export default function Login() {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <form
        className="w-full max-w-sm space-y-4 rounded-lg border border-slate-200 bg-white p-8 shadow-sm"
        onSubmit={(e) => {
          e.preventDefault();
          navigate(ROUTES.DASHBOARD);
        }}
      >
        <h1 className="text-xl font-semibold text-teal-700">{APP_NAME}</h1>
        <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Username" />
        <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Password" type="password" />
        <button className="w-full rounded-md bg-teal-700 py-2 text-sm font-medium text-white hover:bg-teal-800">
          Sign in
        </button>
      </form>
    </div>
  );
}
