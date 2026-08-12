import { AuthProvider } from "@refinedev/core";
import { supabase } from "./supabase";

export const authProvider: AuthProvider = {
    login: async ({ email, password }) => {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            return {
                success: false,
                error: {
                    message: "Erreur de connexion",
                    name: error.message,
                },
            };
        }

        if (data.user) {
            return {
                success: true,
                redirectTo: "/admin",
            };
        }

        return {
            success: false,
            error: {
                message: "Identifiants invalides",
                name: "Invalid credentials",
            },
        };
    },

    logout: async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
            return {
                success: false,
                error,
            };
        }

        return {
            success: true,
            redirectTo: "/admin/login",
        };
    },
    check: async () => {
        // Use getUser() instead of getSession() : it validates the token
        // server-side and works even if cookies were recently refreshed.
        // getSession() only reads local cookies which can fail on Vercel
        // if old httpOnly cookies are stuck in the browser.
        try {
            const { data, error } = await supabase.auth.getUser();
            if (data.user && !error) {
                return {
                    authenticated: true,
                };
            }
        } catch {
            // Network error : treat as not authenticated
        }

        return {
            authenticated: false,
            redirectTo: "/admin/login",
        };
    },
    getPermissions: async () => {
        const { data } = await supabase.auth.getUser();
        const role = data.user?.role;
        return role ? [role] : [];
    },
    getIdentity: async () => {
        const { data } = await supabase.auth.getUser();
        if (data.user) {
            return {
                ...data.user,
                name: data.user.email,
            };
        }
        return null;
    },
    forgotPassword: async ({ email }: { email: string }) => {
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || ''
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${siteUrl}/admin/reset-password`,
        })
        if (error) {
            return {
                success: false,
                error: {
                    message: "Erreur lors de l'envoi du lien de réinitialisation",
                    name: error.message,
                },
            }
        }
        return { success: true }
    },
    onError: async (error) => {
        console.error(error);
        return { error };
    },
};
