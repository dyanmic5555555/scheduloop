// src/business/BusinessProfileContext.jsx
/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext } from "react";

const BusinessProfileContext = createContext(null);

export { BusinessProfileContext };

export function useBusinessProfile() {
  const ctx = useContext(BusinessProfileContext);
  if (!ctx) {
    throw new Error(
      "useBusinessProfile must be used within BusinessProfileProvider"
    );
  }
  return ctx;
}
