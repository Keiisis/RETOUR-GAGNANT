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
            // Force la session à être lue et les cookies écrits
            // AVANT que Refine ne fasse la redirection
            await supabase.auth.getSession();

            // Hard redirect au lieu de redirectTo pour garantir
            // que les cookies sont envoyés avec la nouvelle requête
            if (typeof window !== 'undefined') {
                window.location.href = '/admin';
            }

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
        const { data } = await supabase.auth.getSession();
        const { session } = data;

        if (session) {
            return {
                authenticated: true,
            };
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
