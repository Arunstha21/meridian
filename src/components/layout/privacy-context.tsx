"use client";

import React, { createContext, useContext } from "react";

const PrivacyContext = createContext<boolean>(false);

export function PrivacyProvider({
  value,
  children
}: {
  value: boolean;
  children: React.ReactNode;
}) {
  return <PrivacyContext.Provider value={value}>{children}</PrivacyContext.Provider>;
}

export function usePrivacy(): boolean {
  return useContext(PrivacyContext);
}
