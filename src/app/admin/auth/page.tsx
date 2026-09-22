import { AuthForm } from "@/components/admin/auth-form";
import { getDemoCredentials } from "@/lib/demo";

/*
 * A server component purely so DEMO_MODE is read from the running process
 * rather than from the build. The form itself is a client component; see
 * components/admin/auth-form.tsx.
 */
export const dynamic = "force-dynamic";

export default function AuthPage() {
    return <AuthForm demoCredentials={getDemoCredentials()} />;
}
