import AuthForm from "@/components/AuthForm";

export const metadata = { title: "Sign in — WEJI ويجي" };

export default function LoginPage() {
  return <AuthForm mode="signin" />;
}
