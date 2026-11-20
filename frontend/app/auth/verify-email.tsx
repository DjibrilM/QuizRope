import { Redirect } from "expo-router";

export default function VerifyEmailRedirect() {
  return <Redirect href="/auth/login" />;
}
