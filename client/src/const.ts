import { supabase } from "@/lib/supabase";

export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Dang nhap bang Supabase Auth. startLogin giu ten cu de Home/Admin
// khong phai sua: mac dinh mo Google OAuth, fallback ve trang chu sau login.
export const signInWithGoogle = () => {
  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin },
  });
};

export const signInWithEmail = (email: string) => {
  return supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin },
  });
};

export const startLogin = () => {
  void signInWithGoogle();
};
