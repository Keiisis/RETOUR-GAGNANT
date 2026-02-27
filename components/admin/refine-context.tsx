"use client";

import { Refine } from "@refinedev/core";
import { dataProvider } from "@/lib/refine-data-provider";
import { authProvider } from "@/lib/auth-provider";
import routerProvider from "@refinedev/nextjs-router/app";
import { ColorModeContextProvider } from "@/components/admin/color-mode";
import { AntdInferencer } from "@refinedev/inferencer/antd";

export const RefineContext = ({ children }: { children: React.ReactNode }) => {
    return (
        <ColorModeContextProvider>
            <Refine
                dataProvider={dataProvider}
                authProvider={authProvider}
                routerProvider={routerProvider}
                resources={[
                    {
                        name: "patrimoine",
                        list: "/admin/patrimoine",
                        create: "/admin/patrimoine/create",
                        edit: "/admin/patrimoine/edit/:id",
                        show: "/admin/patrimoine/show/:id",
                        meta: { label: "Patrimoine", canDelete: true },
                    },
                    {
                        name: "services",
                        list: "/admin/services",
                        create: "/admin/services/create",
                        edit: "/admin/services/edit/:id",
                        show: "/admin/services/show/:id",
                        meta: { label: "Services", canDelete: true },
                    },
                    {
                        name: "testimonials",
                        list: "/admin/testimonials",
                        create: "/admin/testimonials/create",
                        edit: "/admin/testimonials/edit/:id",
                        show: "/admin/testimonials/show/:id",
                        meta: { label: "Témoignages", canDelete: true },
                    },
                    {
                        name: "messages",
                        list: "/admin/messages",
                        show: "/admin/messages/show/:id",
                        meta: { label: "Messages (Contact)", canDelete: true },
                    },
                    {
                        name: "gallery",
                        list: "/admin/gallery",
                        create: "/admin/gallery/create",
                        edit: "/admin/gallery/edit/:id",
                        show: "/admin/gallery/show/:id",
                        meta: { label: "Galerie Photos", canDelete: true },
                    },
                    {
                        name: "settings",
                        list: "/admin/settings",
                        create: "/admin/settings/create",
                        edit: "/admin/settings/edit/:id",
                        show: "/admin/settings/show/:id",
                        meta: { label: "Paramètres Site", canDelete: true },
                    },
                    {
                        name: "products",
                        list: "/admin/boutique",
                        create: "/admin/boutique/create",
                        edit: "/admin/boutique/edit/:id",
                        show: "/admin/boutique/show/:id",
                        meta: { label: "Boutique", canDelete: true },
                    },
                    {
                        name: "orders",
                        list: "/admin/orders",
                        show: "/admin/orders/show/:id",
                        meta: { label: "Commandes", canDelete: false },
                    },
                    {
                        name: "coupons",
                        list: "/admin/coupons",
                        create: "/admin/coupons/create",
                        edit: "/admin/coupons/edit/:id",
                        meta: { label: "Coupons", canDelete: true },
                    },
                    {
                        name: "user_profiles",
                        list: "/admin/users",
                        show: "/admin/users/show/:id",
                        edit: "/admin/users/edit/:id",
                        meta: { label: "Utilisateurs", canDelete: false },
                    },
                    {
                        name: "process_steps",
                        list: "/admin/process-steps",
                        create: "/admin/process-steps/create",
                        edit: "/admin/process-steps/edit/:id",
                        meta: { label: "Parcours (Frontend)", canDelete: true },
                    },
                    {
                        name: "nationality_requests",
                        list: "/admin/nationality-requests",
                        meta: { label: "Nationalité", canDelete: true },
                    },
                    {
                        name: "email_templates",
                        list: "/admin/email-templates",
                        meta: { label: "Templates Email", canDelete: false },
                    },
                    {
                        name: "ai_config",
                        list: "/admin/settings/ai",
                        meta: { label: "Configuration IA", canDelete: false },
                    },
                ]}
                options={{
                    syncWithLocation: true,
                    warnWhenUnsavedChanges: true,
                }}
            >
                {children}
            </Refine>
        </ColorModeContextProvider>
    );
};
