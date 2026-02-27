"use client";

import { ConfigProvider, theme } from "antd";
import React, { createContext, PropsWithChildren, useEffect, useState } from "react";

type ColorModeContextType = {
    mode: string;
    setMode: (mode: string) => void;
};

export const ColorModeContext = createContext<ColorModeContextType>(
    {} as ColorModeContextType
);

export const ColorModeContextProvider: React.FC<PropsWithChildren> = ({
    children,
}) => {
    const [isMounted, setIsMounted] = useState(false);
    const [mode, setMode] = useState("dark");

    useEffect(() => {
        setIsMounted(true);
    }, []);

    useEffect(() => {
        if (isMounted) {
            const theme = localStorage.getItem("colorMode");
            if (theme) {
                setMode(theme);
            }
        }
    }, [isMounted]);

    const toggleConfig = (mode: string) => {
        setMode(mode);
        localStorage.setItem("colorMode", mode);
    };

    const { darkAlgorithm, defaultAlgorithm } = theme;

    return (
        <ColorModeContext.Provider
            value={{
                setMode: toggleConfig,
                mode,
            }}
        >
            <ConfigProvider
                theme={{
                    algorithm: mode === "light" ? defaultAlgorithm : darkAlgorithm,
                    token: {
                        colorPrimary: "#FCD116",
                    },
                }}
            >
                {children}
            </ConfigProvider>
        </ColorModeContext.Provider>
    );
};
